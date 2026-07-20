/**
 * Real-time session server for Pointy.
 * Run: node server/pointing-blackjack.mjs
 * Port: POINTING_BLACKJACK_PORT or 3333
 *
 * Session state is persisted in Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *
 * Also serves POST /create-pointy-feedback (shared-secret) so Cloudflare Pages can
 * create Taiga tickets via this host (which reaches taiga-back).
 */
import http from "http";
import { WebSocketServer } from "ws";
import { randomUUID, timingSafeEqual } from "crypto";
import {
  createPointingStore,
  loadSupabaseConfig,
} from "./pointing-blackjack-store.mjs";
import { cabinetLog } from "./cabinet-log.mjs";
import { createPointyFeedbackTicket } from "./taiga-feedback.mjs";

const PORT = Number(process.env.POINTING_BLACKJACK_PORT || 3333);
const FEEDBACK_PATH = "/create-pointy-feedback";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 25 * 1000;
const EXPIRED_SESSION_CLEANUP_MS = 10 * 60 * 1000;

/** @typedef {'product' | 'qa' | 'dev'} PlayerRole */
/** @typedef {{ name: string, online: boolean, brb?: boolean, role?: PlayerRole }} Player */
/** @typedef {{ id: string, revealed: boolean, gameOver: boolean, expiresAt: number, players: Map<string, Player>, votes: Map<string, number|null> }} Session */

/** @type {Map<string, Session>} */
const sessions = new Map();
/** @type {Map<import('ws').WebSocket, { sessionId: string, playerId: string }>} */
const socketMeta = new Map();
/** @type {Map<string, Set<import('ws').WebSocket>>} */
const roomSockets = new Map();
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const sessionExpiryTimers = new Map();

/** @type {ReturnType<typeof createPointingStore> | null} */
let store = null;

/**
 * @param {Session} session
 */
async function saveSession(session) {
  if (!store) return;
  try {
    await store.persistSession(session);
  } catch (err) {
    console.error(`Failed to persist session ${session.id}:`, err);
  }
}

/**
 * @param {string} sessionId
 */
async function removeSessionFromStore(sessionId) {
  if (!store) return;
  try {
    await store.deleteSession(sessionId);
  } catch (err) {
    console.error(`Failed to delete session ${sessionId}:`, err);
  }
}

function clearSessionExpiryTimer(sessionId) {
  const t = sessionExpiryTimers.get(sessionId);
  if (t) {
    clearTimeout(t);
    sessionExpiryTimers.delete(sessionId);
  }
}

function closeAllSessionSockets(sessionId) {
  const set = roomSockets.get(sessionId);
  if (set) {
    const clients = [...set];
    for (const c of clients) {
      socketMeta.delete(c);
      removeFromRoom(sessionId, c);
    }
    roomSockets.delete(sessionId);
    for (const c of clients) {
      try {
        c.close();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Drop an empty session (no participants left).
 * @param {string} sessionId
 * @deprecated Sessions now expire via TTL only; kept for expireSession cleanup.
 */
function deleteEmptySession(sessionId) {
  clearSessionExpiryTimer(sessionId);
  closeAllSessionSockets(sessionId);
  sessions.delete(sessionId);
}

/**
 * End session after the configured TTL (2 hours).
 * @param {string} sessionId
 */
function expireSession(sessionId) {
  clearSessionExpiryTimer(sessionId);
  const session = sessions.get(sessionId);
  if (!session) return;
  session.gameOver = true;
  broadcastSession(sessionId);
  closeAllSessionSockets(sessionId);
  sessions.delete(sessionId);
  void removeSessionFromStore(sessionId);
}

function scheduleSessionExpiry(sessionId) {
  clearSessionExpiryTimer(sessionId);
  const session = sessions.get(sessionId);
  if (!session) return;
  const delay = Math.max(0, session.expiresAt - Date.now());
  const tid = setTimeout(() => expireSession(sessionId), delay);
  sessionExpiryTimers.set(sessionId, tid);
}

function sessionIsLive(session) {
  return session && !session.gameOver && Date.now() <= session.expiresAt;
}

/** @param {Session} session @param {string} viewerId */
function buildStateForPlayer(session, viewerId) {
  const players = [...session.players.entries()].map(([id, pl]) => ({
    id,
    name: pl.name,
    online: pl.online !== false,
    brb: pl.brb === true,
    role: pl.role ?? "dev",
  }));

  /** @type {Record<string, number | null | 'hidden'>} */
  const voteByPlayer = {};
  for (const [pid] of session.players) {
    const v = session.votes.get(pid);
    if (session.revealed) {
      voteByPlayer[pid] = v === undefined ? null : v;
    } else if (pid === viewerId) {
      voteByPlayer[pid] = v === undefined ? null : v;
    } else {
      voteByPlayer[pid] = v !== undefined && v !== null ? "hidden" : null;
    }
  }

  return {
    sessionId: session.id,
    myPlayerId: viewerId,
    revealed: session.revealed,
    gameOver: session.gameOver,
    players,
    voteByPlayer,
    expiresAt: session.expiresAt,
  };
}

function sendJson(ws, payload) {
  try {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  } catch {
    // ignore stale socket
  }
}

function sendError(ws, message) {
  sendJson(ws, { type: "error", message });
}

function broadcastSession(sessionId) {
  const set = roomSockets.get(sessionId);
  const session = sessions.get(sessionId);
  if (!set || !session) return;
  for (const ws of set) {
    if (ws.readyState !== 1) continue;
    const meta = socketMeta.get(ws);
    if (!meta) continue;
    const state = buildStateForPlayer(session, meta.playerId);
    sendJson(ws, { type: "state", state });
  }
}

function addToRoom(sessionId, ws) {
  if (!roomSockets.has(sessionId)) roomSockets.set(sessionId, new Set());
  roomSockets.get(sessionId).add(ws);
}

function removeFromRoom(sessionId, ws) {
  const set = roomSockets.get(sessionId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) roomSockets.delete(sessionId);
}

function shortSessionId() {
  return randomUUID().replace(/-/g, "").slice(0, 10);
}

/** Keep in sync with src/pointing-blackjack/roomCode.ts */
function isValidSessionId(raw) {
  if (typeof raw !== "string") return false;
  const sessionId = raw.trim();
  if (sessionId.length < 4 || sessionId.length > 64) return false;
  return /^[a-zA-Z0-9_-]+$/.test(sessionId);
}

/** @param {unknown} raw @returns {PlayerRole | null} */
function parsePlayerRole(raw) {
  if (raw === "product" || raw === "qa" || raw === "dev") return raw;
  return null;
}

/**
 * @param {import('ws').WebSocket} ws
 * @param {Session} session
 * @param {string} playerId
 */
function registerPlayerSocket(ws, session, playerId) {
  const prev = socketMeta.get(ws);
  if (prev && prev.sessionId !== session.id) {
    removeFromRoom(prev.sessionId, ws);
  }
  const pl = session.players.get(playerId);
  if (pl) pl.online = true;
  socketMeta.set(ws, { sessionId: session.id, playerId });
  addToRoom(session.id, ws);
  broadcastSession(session.id);
}

/**
 * @param {import('ws').WebSocket} ws
 */
function handleClose(ws) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  socketMeta.delete(ws);
  const { sessionId, playerId } = meta;
  removeFromRoom(sessionId, ws);
  const session = sessions.get(sessionId);
  if (!session) return;

  // Reconnects can briefly overlap two sockets for the same player; only remove the
  // participant when no remaining connection still represents them.
  for (const [, m] of socketMeta) {
    if (m.sessionId === sessionId && m.playerId === playerId) {
      return;
    }
  }

  const pl = session.players.get(playerId);
  if (pl) {
    pl.online = false;
  }

  broadcastSession(sessionId);
}

function markSocketAlive(ws) {
  ws.isAlive = true;
}

/**
 * @param {import('ws').WebSocketServer} wss
 */
function attachSocketHandlers(wss) {
  wss.on("connection", (ws) => {
    markSocketAlive(ws);
    ws.on("pong", () => markSocketAlive(ws));
  });

  wss.on("connection", (ws) => {
    ws.on("close", () => handleClose(ws));
    ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "sessionExists") {
      const raw = typeof msg.sessionId === "string" ? msg.sessionId.trim() : "";
      if (!isValidSessionId(raw)) {
        ws.send(
          JSON.stringify({
            type: "sessionExistsResult",
            sessionId: raw,
            exists: false,
            invalid: true,
          })
        );
        return;
      }
      const session = sessions.get(raw);
      const exists = !!(session && sessionIsLive(session));
      /** @type {string[]} */
      const playerNames = exists
        ? [...session.players.values()].map((pl) => pl.name)
        : [];
      ws.send(
        JSON.stringify({
          type: "sessionExistsResult",
          sessionId: raw,
          exists,
          invalid: false,
          playerNames,
        })
      );
      return;
    }

    if (msg.type === "create") {
      const name = typeof msg.name === "string" ? msg.name.trim().slice(0, 40) : "";
      if (!name) {
        ws.send(JSON.stringify({ type: "error", message: "Name required" }));
        return;
      }
      const requestedId =
        typeof msg.sessionId === "string" && msg.sessionId.trim()
          ? msg.sessionId.trim()
          : "";
      if (requestedId && !isValidSessionId(requestedId)) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid room id" }));
        return;
      }
      if (requestedId) {
        const existing = sessions.get(requestedId);
        if (existing && sessionIsLive(existing)) {
          ws.send(JSON.stringify({ type: "error", message: "Session already exists" }));
          return;
        }
      }
      const sessionId = requestedId || shortSessionId();
      const creatorId = randomUUID();
      const expiresAt = Date.now() + SESSION_TTL_MS;
      const role = parsePlayerRole(msg.role) ?? "product";
      /** @type {Session} */
      const session = {
        id: sessionId,
        revealed: false,
        gameOver: false,
        expiresAt,
        players: new Map([[creatorId, { name, online: true, role }]]),
        votes: new Map(),
      };
      sessions.set(sessionId, session);
      scheduleSessionExpiry(sessionId);
      registerPlayerSocket(ws, session, creatorId);
      void saveSession(session);
      cabinetLog(
        `session started sessionId=${sessionId} player=${name} role=${role}`
      );
      return;
    }

    if (msg.type === "join") {
      const sessionId = typeof msg.sessionId === "string" ? msg.sessionId.trim() : "";
      const name = typeof msg.name === "string" ? msg.name.trim().slice(0, 40) : "";
      const existingId = typeof msg.playerId === "string" ? msg.playerId : null;
      const role = parsePlayerRole(msg.role) ?? "dev";
      if (!sessionId || !name) {
        ws.send(JSON.stringify({ type: "error", message: "Session and name required" }));
        return;
      }
      const session = sessions.get(sessionId);
      if (!session || session.gameOver) {
        ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
        return;
      }
      if (Date.now() > session.expiresAt) {
        expireSession(sessionId);
        ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
        return;
      }
      let playerId = existingId;
      if (playerId && session.players.has(playerId)) {
        const pl = session.players.get(playerId);
        if (pl) {
          pl.name = name;
          pl.online = true;
        }
      } else if (playerId) {
        session.players.set(playerId, { name, online: true, role });
      } else {
        playerId = randomUUID();
        session.players.set(playerId, { name, online: true, role });
      }
      registerPlayerSocket(ws, session, playerId);
      void saveSession(session);
      cabinetLog(
        `session joined sessionId=${sessionId} player=${name} role=${role}`
      );
      return;
    }

    const meta = socketMeta.get(ws);
    if (!meta) {
      ws.send(JSON.stringify({ type: "error", message: "Not in a session" }));
      return;
    }
    const session = sessions.get(meta.sessionId);
    if (!session || session.gameOver) {
      sendError(ws, "Session not found");
      return;
    }
    if (Date.now() > session.expiresAt) {
      expireSession(meta.sessionId);
      sendError(ws, "Session not found");
      return;
    }

    if (msg.type === "leave") {
      session.players.delete(meta.playerId);
      session.votes.delete(meta.playerId);
      socketMeta.delete(ws);
      removeFromRoom(meta.sessionId, ws);
      broadcastSession(meta.sessionId);
      void saveSession(session);
      return;
    }

    if (msg.type === "setBrb") {
      const pl = session.players.get(meta.playerId);
      if (pl) {
        pl.brb = msg.brb === true;
        broadcastSession(session.id);
        void saveSession(session);
      }
      return;
    }

    if (msg.type === "updateName") {
      const name = typeof msg.name === "string" ? msg.name.trim().slice(0, 40) : "";
      if (!name) {
        sendError(ws, "Name required");
        return;
      }
      const pl = session.players.get(meta.playerId);
      if (pl) {
        pl.name = name;
        broadcastSession(session.id);
        void saveSession(session);
      }
      return;
    }

    if (msg.type === "vote") {
      const v = msg.value;
      const allowed = [1, 2, 3, 5, 8, 13];
      if (!allowed.includes(v)) return;
      if (!session.players.has(meta.playerId)) {
        sendError(ws, "Not in a session");
        return;
      }
      session.votes.set(meta.playerId, v);
      broadcastSession(session.id);
      void saveSession(session);
      {
        const pl = session.players.get(meta.playerId);
        cabinetLog(
          `vote sessionId=${session.id} player=${pl?.name ?? meta.playerId} value=${v}`
        );
      }
      return;
    }

    if (msg.type === "clearVote") {
      session.votes.delete(meta.playerId);
      broadcastSession(session.id);
      void saveSession(session);
      return;
    }

    if (msg.type === "reveal") {
      session.revealed = true;
      broadcastSession(session.id);
      void saveSession(session);
      cabinetLog(`cards revealed sessionId=${session.id}`);
      return;
    }

    if (msg.type === "newRound") {
      session.revealed = false;
      session.votes.clear();
      broadcastSession(session.id);
      void saveSession(session);
      return;
    }
    });
  });
}

async function main() {
  const supabaseCfg = loadSupabaseConfig();
  if (!supabaseCfg) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — Pointy requires Supabase."
    );
    process.exit(1);
  }
  store = createPointingStore(supabaseCfg);
  try {
    await store.hydrateSessions(sessions);
    for (const sessionId of sessions.keys()) {
      scheduleSessionExpiry(sessionId);
    }
    console.log(`Hydrated ${sessions.size} session(s) from Supabase`);
  } catch (err) {
    console.error("Failed to hydrate sessions from Supabase:", err);
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    void handleHttpRequest(req, res);
  });
  const wss = new WebSocketServer({ server });
  attachSocketHandlers(wss);

  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions) {
      if (!sessionIsLive(session) || now > session.expiresAt) {
        expireSession(sessionId);
      }
    }
    void store.deleteExpiredSessions().catch((err) => {
      console.error("Failed to delete expired Supabase sessions:", err);
    });
  }, EXPIRED_SESSION_CLEANUP_MS);

  wss.on("close", () => {
    clearInterval(heartbeatTimer);
    clearInterval(cleanupTimer);
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Pointy server on ws://localhost:${PORT}`);
    console.log(`Pointy feedback Taiga bridge on http://localhost:${PORT}${FEEDBACK_PATH}`);
  });
}

/**
 * @param {string | undefined} provided
 * @param {string} expected
 */
function secretsMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const max = 32_000;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
async function handleHttpRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "POST" && url.pathname === FEEDBACK_PATH) {
    await handleCreatePointyFeedback(req, res);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
async function handleCreatePointyFeedback(req, res) {
  const expected = (process.env.POINTY_FEEDBACK_SECRET || "").trim();
  if (!expected) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Feedback Taiga bridge not configured" }));
    return;
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!secretsMatch(token, expected)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const description =
    body && typeof body === "object" && typeof body.description === "string"
      ? body.description
      : "";
  const subject =
    body && typeof body === "object" && typeof body.subject === "string"
      ? body.subject
      : "Pointy Feedback";

  if (description.trim().length < 4) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "description too short" }));
    return;
  }

  try {
    const ticket = await createPointyFeedbackTicket({ subject, description });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(ticket));
  } catch (err) {
    console.error("Failed to create Pointy feedback Taiga ticket:", err);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Failed to create Taiga ticket",
        detail: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
