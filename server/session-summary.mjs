/**
 * Vote participation for the Pointy session summary email.
 *
 * A round counts when cards are revealed. A player counts as having voted
 * that round when they had a numeric vote at reveal time.
 */

/** Sessions smaller than this do not get a summary email. */
export const MIN_SUMMARY_PARTICIPANTS = 3;

/** After the last explicit leave, wait before emailing so a quick rejoin cancels it. */
export const LEAVE_SUMMARY_GRACE_MS = 10_000;

/**
 * After everyone is offline but still listed (closed the tab), wait long enough
 * that a reconnect or server restart does not look like the meeting ended.
 */
export const OFFLINE_SUMMARY_GRACE_MS = 2 * 60 * 1000;

const EXCLUDED_NAMES = new Set(["ba"]);

/**
 * @returns {{ rounds: number, sent: boolean, players: Record<string, { name: string, role: string, votes: number }> }}
 */
export function emptyParticipation() {
  return { rounds: 0, sent: false, players: {} };
}

/**
 * @param {unknown} raw
 */
export function normalizeParticipation(raw) {
  const empty = emptyParticipation();
  if (!raw || typeof raw !== "object") return empty;
  const src = /** @type {{ rounds?: unknown, sent?: unknown, players?: unknown }} */ (raw);
  const players = {};
  const rawPlayers =
    src.players && typeof src.players === "object" ? src.players : {};
  for (const [id, value] of Object.entries(rawPlayers)) {
    if (!value || typeof value !== "object") continue;
    const row = /** @type {{ name?: unknown, role?: unknown, votes?: unknown }} */ (value);
    const role =
      row.role === "product" || row.role === "qa" || row.role === "dev"
        ? row.role
        : "dev";
    const votes =
      typeof row.votes === "number" && Number.isInteger(row.votes) && row.votes >= 0
        ? row.votes
        : 0;
    players[id] = {
      name: typeof row.name === "string" && row.name.trim() ? row.name : "Player",
      role,
      votes,
    };
  }
  const rounds =
    typeof src.rounds === "number" && Number.isInteger(src.rounds) && src.rounds >= 0
      ? src.rounds
      : 0;
  return { rounds, sent: src.sent === true, players };
}

/**
 * @param {string} name
 */
export function isExcludedFromSummary(name) {
  return EXCLUDED_NAMES.has(String(name ?? "").trim().toLowerCase());
}

/**
 * @param {ReturnType<typeof emptyParticipation>} participation
 * @param {string} playerId
 * @param {{ name?: string, role?: string }} player
 */
export function touchParticipant(participation, playerId, player) {
  const existing = participation.players[playerId];
  const name =
    typeof player.name === "string" && player.name.trim() ? player.name.trim() : "Player";
  const role =
    player.role === "product" || player.role === "qa" || player.role === "dev"
      ? player.role
      : "dev";
  if (existing) {
    existing.name = name;
    existing.role = role;
    return;
  }
  participation.players[playerId] = { name, role, votes: 0 };
}

/**
 * @param {ReturnType<typeof emptyParticipation>} participation
 * @param {Iterable<[string, unknown]>} votes
 */
export function recordRevealedRound(participation, votes) {
  participation.rounds += 1;
  for (const [playerId, value] of votes) {
    if (typeof value !== "number") continue;
    const player = participation.players[playerId];
    if (!player) continue;
    player.votes += 1;
  }
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {ReturnType<typeof emptyParticipation>} participation
 * @returns {Array<{ name: string, votes: string }>}
 */
export function sessionSummaryRows(participation) {
  const rounds = participation.rounds;
  const noun = rounds === 1 ? "round" : "rounds";
  return Object.values(participation.players)
    .filter((player) => !isExcludedFromSummary(player.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .map((player) => ({
      name: player.name,
      votes: `${player.votes} out of ${rounds} ${noun}`,
    }));
}

/**
 * Plain-text fallback. The message itself is the HTML table.
 * @param {ReturnType<typeof emptyParticipation>} participation
 * @returns {string}
 */
export function formatSessionSummary(participation) {
  return sessionSummaryRows(participation)
    .map((row) => `${row.name} / ${row.votes}`)
    .join("\n");
}

const CELL_STYLE =
  "border:1px solid #cccccc;padding:8px 12px;text-align:left;font-family:sans-serif;font-size:14px;";

/**
 * HTML table of names and vote counts.
 * @param {ReturnType<typeof emptyParticipation>} participation
 * @param {string} [sessionId]
 * @returns {string}
 */
export function formatSessionSummaryHtml(participation, sessionId) {
  const rows = sessionSummaryRows(participation);
  if (!rows.length) return "";
  const body = rows
    .map(
      (row) =>
        `<tr><td style="${CELL_STYLE}">${escapeHtml(row.name)}</td><td style="${CELL_STYLE}">${escapeHtml(row.votes)}</td></tr>`
    )
    .join("");
  const caption =
    typeof sessionId === "string" && sessionId.trim()
      ? `<caption style="caption-side:top;text-align:left;font-family:sans-serif;font-size:14px;padding:0 0 8px;">Room ${escapeHtml(sessionId.trim())}</caption>`
      : "";
  return (
    `<table style="border-collapse:collapse;">` +
    caption +
    `<thead><tr><th style="${CELL_STYLE}">Name</th><th style="${CELL_STYLE}">Votes</th></tr></thead>` +
    `<tbody>${body}</tbody></table>`
  );
}

/**
 * @param {ReturnType<typeof emptyParticipation>} participation
 */
export function summaryParticipantCount(participation) {
  return Object.keys(participation.players).length;
}

/**
 * Delay before emailing, or null when the room is not ready.
 * Everyone who joined counts toward the minimum, including names omitted from the table.
 *
 * @param {{ online: number, playersRemaining: number, participation: ReturnType<typeof emptyParticipation> }} state
 * @returns {number | null}
 */
export function summaryDelayMs(state) {
  if (state.participation.sent) return null;
  if (state.online > 0) return null;
  if (summaryParticipantCount(state.participation) < MIN_SUMMARY_PARTICIPANTS) return null;
  if (!formatSessionSummary(state.participation).trim()) return null;
  return state.playersRemaining === 0 ? LEAVE_SUMMARY_GRACE_MS : OFFLINE_SUMMARY_GRACE_MS;
}
