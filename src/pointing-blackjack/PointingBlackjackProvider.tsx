import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SessionState } from "./types";
import { whenWsConnectAllowed } from "./wsDefer";
import { pointingBlackjackWsUrl } from "./wsUrl";

const STORAGE_PREFIX = "pointingBlackjack:";
const RECONNECT_DELAY_MS = 1_000;

function storageKey(sessionId: string) {
  return `${STORAGE_PREFIX}${sessionId}`;
}

export function readStoredIdentity(sessionId: string): {
  playerId: string;
  name: string;
} | null {
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const o = JSON.parse(raw) as { playerId?: string; name?: string };
    if (typeof o.playerId === "string" && typeof o.name === "string") {
      return { playerId: o.playerId, name: o.name };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStoredIdentity(sessionId: string, playerId: string, name: string) {
  sessionStorage.setItem(storageKey(sessionId), JSON.stringify({ playerId, name }));
}

export type SessionProbeResult = {
  exists: boolean;
  invalid: boolean;
  /** WebSocket never connected, timed out, or closed before a response. */
  unreachable?: boolean;
};

const SESSION_EXISTS_PROBE_TIMEOUT_MS = 15_000;

type Ctx = {
  connectionStatus: "idle" | "connecting" | "open" | "error";
  state: SessionState | null;
  lastError: string | null;
  createSession: (name: string, sessionId?: string) => void;
  joinSession: (sessionId: string, name: string, resume?: { playerId: string }) => void;
  /** Whether a live session with this room id is on the server (also invalid if the code format is wrong). */
  querySessionExists: (sessionId: string) => Promise<SessionProbeResult>;
  clearLastError: () => void;
  vote: (value: number) => void;
  clearVote: () => void;
  reveal: () => void;
  newRound: () => void;
  leaveTable: () => void;
  setBrb: (brb: boolean) => void;
};

const PointingBlackjackContext = createContext<Ctx | null>(null);

export function usePointingBlackjack(): Ctx {
  const v = useContext(PointingBlackjackContext);
  if (!v) {
    throw new Error("usePointingBlackjack must be used inside provider");
  }
  return v;
}

export const PointingBlackjackProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const closedByUserRef = useRef(false);
  const resumedSocketsRef = useRef(new WeakSet<WebSocket>());
  const sessionExistsWaiters = useRef<
    Map<
      string,
      { resolve: (r: SessionProbeResult) => void }[]
    >
  >(new Map());
  const sessionExistsProbeTimeouts = useRef<Map<string, number>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "open" | "error"
  >("idle");
  const [state, setState] = useState<SessionState | null>(null);
  const stateRef = useRef<SessionState | null>(null);
  stateRef.current = state;
  const [lastError, setLastError] = useState<string | null>(null);
  const sendWhenReadyRef = useRef<(payload: object, onCant?: () => void) => void>(() => {});

  const clearSessionExistsDeadline = useCallback((sessionId: string) => {
    const t = sessionExistsProbeTimeouts.current.get(sessionId);
    if (t !== undefined) {
      window.clearTimeout(t);
      sessionExistsProbeTimeouts.current.delete(sessionId);
    }
  }, []);

  const flushSessionExistsWaiters = useCallback(
    (sessionId: string, result: SessionProbeResult) => {
      const list = sessionExistsWaiters.current.get(sessionId);
      if (!list?.length) return;
      sessionExistsWaiters.current.delete(sessionId);
      clearSessionExistsDeadline(sessionId);
      for (const w of list) w.resolve(result);
    },
    [clearSessionExistsDeadline]
  );

  /** Only resolve waiters — never touch `wsRef` (stale close handlers must not kill a newer socket). */
  const flushAllSessionExistsWaiters = useCallback((result: SessionProbeResult) => {
    const entries = [...sessionExistsWaiters.current.entries()];
    sessionExistsWaiters.current.clear();
    for (const [sessionId] of entries) {
      clearSessionExistsDeadline(sessionId);
    }
    for (const [, list] of entries) {
      for (const w of list) w.resolve(result);
    }
  }, [clearSessionExistsDeadline]);

  const persistIdentity = useCallback((s: SessionState) => {
    const me = s.players.find((p) => p.id === s.myPlayerId);
    if (!me) return;
    writeStoredIdentity(s.sessionId, s.myPlayerId, me.name);
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const buildResumePayload = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.gameOver) return null;
    const stored = readStoredIdentity(current.sessionId);
    if (!stored) return null;
    return {
      type: "join" as const,
      sessionId: current.sessionId,
      name: stored.name,
      playerId: stored.playerId,
    };
  }, []);

  const resumeSocketSession = useCallback(
    (ws: WebSocket) => {
      if (resumedSocketsRef.current.has(ws)) return false;
      const payload = buildResumePayload();
      if (!payload) return false;
      ws.send(JSON.stringify(payload));
      resumedSocketsRef.current.add(ws);
      return true;
    },
    [buildResumePayload]
  );

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) return;
    const current = stateRef.current;
    if (!current || current.gameOver) return;
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      ensureOpenSocketRef.current();
    }, RECONNECT_DELAY_MS);
  }, []);

  const ensureOpenSocketRef = useRef<() => WebSocket | null>(() => null);

  const attachHandlers = useCallback(
    (ws: WebSocket) => {
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            type?: string;
            state?: SessionState;
            message?: string;
          };
          if (msg.type === "state" && msg.state) {
            setState(msg.state);
            persistIdentity(msg.state);
            setLastError(null);
          }
          if (msg.type === "sessionExistsResult") {
            const m = msg as {
              type: string;
              sessionId?: string;
              exists?: boolean;
              invalid?: boolean;
            };
            const sid = typeof m.sessionId === "string" ? m.sessionId : "";
            if (!sid) return;
            const invalid = m.invalid === true;
            const exists = invalid ? false : m.exists === true;
            flushSessionExistsWaiters(sid, { exists, invalid });
          }
          if (msg.type === "error" && msg.message) {
            if (msg.message === "Not in a session") {
              const s = stateRef.current;
              const id = s ? readStoredIdentity(s.sessionId) : null;
              if (s && !s.gameOver && id) {
                sendWhenReadyRef.current({
                  type: "join",
                  sessionId: s.sessionId,
                  name: id.name,
                  playerId: id.playerId,
                });
                return;
              }
            }
            if (msg.message === "Session not found") {
              setState(null);
            }
            setLastError(msg.message);
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        const stillCurrent = wsRef.current === ws;
        if (stillCurrent) {
          wsRef.current = null;
        }
        // Stale sockets must not clear waiters; any *current* socket close while probes are pending must
        // resolve them (covers: opened then dropped before sessionExistsResult, refresh races, dev strict mode).
        if (stillCurrent && sessionExistsWaiters.current.size > 0) {
          flushAllSessionExistsWaiters({
            exists: false,
            invalid: false,
            unreachable: true,
          });
        }
        if (stillCurrent) {
          setConnectionStatus("idle");
          if (closedByUserRef.current) {
            closedByUserRef.current = false;
          } else {
            scheduleReconnect();
          }
        }
      };
      ws.onerror = () => {
        setConnectionStatus("error");
      };
    },
    [
      persistIdentity,
      flushSessionExistsWaiters,
      flushAllSessionExistsWaiters,
      scheduleReconnect,
    ]
  );

  const ensureOpenSocket = useCallback((): WebSocket | null => {
    const existing = wsRef.current;
    if (existing && existing.readyState === WebSocket.OPEN) {
      return existing;
    }
    if (existing && existing.readyState === WebSocket.CONNECTING) {
      return existing;
    }
    if (existing && existing.readyState === WebSocket.CLOSING) {
      return existing;
    }
    clearReconnectTimer();
    closedByUserRef.current = false;
    setConnectionStatus("connecting");
    setLastError(null);
    const ws = new WebSocket(pointingBlackjackWsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      setConnectionStatus("open");
      resumeSocketSession(ws);
    };
    attachHandlers(ws);
    return ws;
  }, [attachHandlers, clearReconnectTimer, resumeSocketSession]);

  ensureOpenSocketRef.current = ensureOpenSocket;

  useEffect(() => {
    return () => {
      clearReconnectTimer();
      closedByUserRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [clearReconnectTimer]);

  const sendWhenReady = useCallback(
    (payload: object, onCant?: () => void) => {
      void (async () => {
        await whenWsConnectAllowed();
        const trySend = (ws: WebSocket) => {
          if (ws.readyState === WebSocket.OPEN) {
            const messageType =
              "type" in payload && typeof payload.type === "string" ? payload.type : null;
            if (
              messageType !== "create" &&
              messageType !== "join" &&
              messageType !== "sessionExists" &&
              messageType !== "listSessions"
            ) {
              resumeSocketSession(ws);
            }
            ws.send(JSON.stringify(payload));
            return true;
          }
          return false;
        };
        const ws = ensureOpenSocket();
        if (!ws) {
          onCant?.();
          return;
        }
        if (trySend(ws)) return;
        if (ws.readyState === WebSocket.CLOSING) {
          ws.addEventListener(
            "close",
            () => {
              const next = ensureOpenSocket();
              if (!next) {
                onCant?.();
                return;
              }
              if (trySend(next)) return;
              next.addEventListener(
                "open",
                () => {
                  trySend(next);
                },
                { once: true }
              );
            },
            { once: true }
          );
          return;
        }
        const onOpen = () => {
          ws.removeEventListener("open", onOpen);
          trySend(ws);
        };
        ws.addEventListener("open", onOpen);
      })();
    },
    [ensureOpenSocket, resumeSocketSession]
  );

  sendWhenReadyRef.current = sendWhenReady;

  const createSession = useCallback(
    (name: string, sessionId?: string) => {
      const n = name.trim();
      if (!n) return;
      setState(null);
      const sid = sessionId?.trim();
      sendWhenReady({
        type: "create",
        name: n,
        ...(sid ? { sessionId: sid } : {}),
      });
    },
    [sendWhenReady]
  );

  const scheduleSessionExistsProbeDeadline = useCallback(
    (sid: string) => {
      const unreachable: SessionProbeResult = {
        exists: false,
        invalid: false,
        unreachable: true,
      };
      clearSessionExistsDeadline(sid);
      const timeoutId = window.setTimeout(() => {
        sessionExistsProbeTimeouts.current.delete(sid);
        if (!sessionExistsWaiters.current.has(sid)) return;
        flushSessionExistsWaiters(sid, unreachable);
        const dead = wsRef.current;
        if (
          dead &&
          dead.readyState !== WebSocket.OPEN &&
          dead.readyState !== WebSocket.CLOSING
        ) {
          try {
            dead.close();
          } catch {
            // ignore
          }
          wsRef.current = null;
        }
      }, SESSION_EXISTS_PROBE_TIMEOUT_MS);
      sessionExistsProbeTimeouts.current.set(sid, timeoutId);
    },
    [clearSessionExistsDeadline, flushSessionExistsWaiters]
  );

  const querySessionExists = useCallback(
    (sessionId: string): Promise<SessionProbeResult> =>
      new Promise((resolve) => {
        const sid = sessionId.trim();
        const list = sessionExistsWaiters.current.get(sid) ?? [];
        const first = list.length === 0;
        list.push({ resolve });
        sessionExistsWaiters.current.set(sid, list);
        const unreachable: SessionProbeResult = {
          exists: false,
          invalid: false,
          unreachable: true,
        };
        if (first) {
          sendWhenReady({ type: "sessionExists", sessionId: sid }, () =>
            flushSessionExistsWaiters(sid, unreachable)
          );
        }
        // Strict mode adds a second waiter without a second send; still need a deadline per round-trip.
        scheduleSessionExistsProbeDeadline(sid);
      }),
    [sendWhenReady, flushSessionExistsWaiters, scheduleSessionExistsProbeDeadline]
  );

  const clearLastError = useCallback(() => setLastError(null), []);

  const joinSession = useCallback(
    (sessionId: string, name: string, resume?: { playerId: string }) => {
      const n = name.trim();
      if (!n || !sessionId.trim()) return;
      sendWhenReady({
        type: "join",
        sessionId: sessionId.trim(),
        name: n,
        ...(resume ? { playerId: resume.playerId } : {}),
      });
    },
    [sendWhenReady]
  );

  const vote = useCallback(
    (value: number) => {
      sendWhenReady({ type: "vote", value });
    },
    [sendWhenReady]
  );

  const clearVote = useCallback(() => {
    sendWhenReady({ type: "clearVote" });
  }, [sendWhenReady]);

  const reveal = useCallback(() => {
    sendWhenReady({ type: "reveal" });
  }, [sendWhenReady]);

  const newRound = useCallback(() => {
    sendWhenReady({ type: "newRound" });
  }, [sendWhenReady]);

  const leaveTable = useCallback(() => {
    clearReconnectTimer();
    closedByUserRef.current = true;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "leave" }));
      } catch {
        // ignore
      }
    }
    wsRef.current?.close();
    wsRef.current = null;
    setState(null);
    setConnectionStatus("idle");
    setLastError(null);
  }, [clearReconnectTimer]);

  const setBrb = useCallback(
    (brb: boolean) => {
      sendWhenReady({ type: "setBrb", brb });
    },
    [sendWhenReady]
  );

  const value: Ctx = {
    connectionStatus,
    state,
    lastError,
    createSession,
    joinSession,
    querySessionExists,
    clearLastError,
    vote,
    clearVote,
    reveal,
    newRound,
    leaveTable,
    setBrb,
  };

  return (
    <PointingBlackjackContext.Provider value={value}>
      {children}
    </PointingBlackjackContext.Provider>
  );
};
