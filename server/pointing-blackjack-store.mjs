/**
 * Supabase persistence for Pointing Showdown sessions.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

/**
 * @typedef {'product' | 'qa' | 'dev'} PlayerRole
 * @typedef {{ name: string, online: boolean, brb?: boolean, role?: PlayerRole }} Player
 * @typedef {{ id: string, revealed: boolean, gameOver: boolean, expiresAt: number, players: Map<string, Player>, votes: Map<string, number|null> }} Session
 */

/**
 * @returns {{ url: string, serviceRoleKey: string } | null}
 */
export function loadSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

/**
 * @param {{ url: string, serviceRoleKey: string }} cfg
 */
export function createPointingStore(cfg) {
  const supabase = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  });

  /** @type {boolean | null} */
  let roleColumnSupported = null;

  /**
   * @param {unknown} error
   */
  function isMissingRoleColumn(error) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      /** @type {{ code?: string }} */ (error).code === "42703"
    );
  }

  /**
   * @param {string} sessionId
   */
  async function fetchPlayerRows(sessionId) {
    if (roleColumnSupported === false) {
      const { data, error } = await supabase
        .from("pointing_players")
        .select("id, name, brb")
        .eq("session_id", sessionId);
      if (error) throw error;
      return data ?? [];
    }

    const { data, error } = await supabase
      .from("pointing_players")
      .select("id, name, brb, role")
      .eq("session_id", sessionId);
    if (error && isMissingRoleColumn(error)) {
      roleColumnSupported = false;
      console.warn(
        "pointing_players.role column missing — run supabase/migrations/20260708000000_pointing_player_role.sql"
      );
      return fetchPlayerRows(sessionId);
    }
    if (error) throw error;
    roleColumnSupported = true;
    return data ?? [];
  }

  /**
   * @param {Array<{ id: string, session_id: string, name: string, brb: boolean, role: PlayerRole }>} playerRows
   */
  async function insertPlayerRows(playerRows) {
    if (!playerRows.length) return;

    if (roleColumnSupported === false) {
      const legacyRows = playerRows.map(({ id, session_id, name, brb }) => ({
        id,
        session_id,
        name,
        brb,
      }));
      const { error } = await supabase.from("pointing_players").insert(legacyRows);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("pointing_players").insert(playerRows);
    if (error && isMissingRoleColumn(error)) {
      roleColumnSupported = false;
      console.warn(
        "pointing_players.role column missing — run supabase/migrations/20260708000000_pointing_player_role.sql"
      );
      await insertPlayerRows(playerRows);
      return;
    }
    if (error) throw error;
    roleColumnSupported = true;
  }

  /**
   * @param {Session} session
   */
  async function persistSession(session) {
    const { error: sessionErr } = await supabase.from("pointing_sessions").upsert({
      id: session.id,
      revealed: session.revealed,
      game_over: session.gameOver,
      expires_at: new Date(session.expiresAt).toISOString(),
    });
    if (sessionErr) throw sessionErr;

    const { error: deleteVotesErr } = await supabase
      .from("pointing_votes")
      .delete()
      .eq("session_id", session.id);
    if (deleteVotesErr) throw deleteVotesErr;

    const { error: deletePlayersErr } = await supabase
      .from("pointing_players")
      .delete()
      .eq("session_id", session.id);
    if (deletePlayersErr) throw deletePlayersErr;

    const playerRows = [...session.players.entries()].map(([id, pl]) => ({
      id,
      session_id: session.id,
      name: pl.name,
      brb: pl.brb === true,
      role: pl.role ?? "dev",
    }));
    if (playerRows.length) {
      await insertPlayerRows(playerRows);
    }

    const voteRows = [...session.votes.entries()]
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([playerId, value]) => ({
        session_id: session.id,
        player_id: playerId,
        value,
      }));
    if (voteRows.length) {
      const { error: votesErr } = await supabase.from("pointing_votes").insert(voteRows);
      if (votesErr) throw votesErr;
    }
  }

  /**
   * @param {string} sessionId
   */
  async function deleteSession(sessionId) {
    const { error } = await supabase.from("pointing_sessions").delete().eq("id", sessionId);
    if (error) throw error;
  }

  async function deleteExpiredSessions() {
    const now = new Date().toISOString();
    const { error } = await supabase.from("pointing_sessions").delete().lt("expires_at", now);
    if (error) throw error;
  }

  /**
   * Load live sessions from Supabase into the in-memory map.
   * @param {Map<string, Session>} sessions
   */
  async function hydrateSessions(sessions) {
    const now = new Date().toISOString();
    const { data: sessionRows, error: sessionErr } = await supabase
      .from("pointing_sessions")
      .select("id, revealed, game_over, expires_at")
      .gt("expires_at", now)
      .eq("game_over", false);
    if (sessionErr) throw sessionErr;

    for (const row of sessionRows ?? []) {
      const playerRows = await fetchPlayerRows(row.id);

      const { data: voteRows, error: votesErr } = await supabase
        .from("pointing_votes")
        .select("player_id, value")
        .eq("session_id", row.id);
      if (votesErr) throw votesErr;

      /** @type {Session} */
      const session = {
        id: row.id,
        revealed: row.revealed === true,
        gameOver: row.game_over === true,
        expiresAt: new Date(row.expires_at).getTime(),
        players: new Map(
          playerRows.map((p) => [
            p.id,
            {
              name: p.name,
              online: false,
              brb: p.brb === true,
              role:
                "role" in p &&
                (p.role === "product" || p.role === "qa" || p.role === "dev")
                  ? p.role
                  : "dev",
            },
          ])
        ),
        votes: new Map((voteRows ?? []).map((v) => [v.player_id, v.value])),
      };
      sessions.set(row.id, session);
    }
  }

  return {
    persistSession,
    deleteSession,
    deleteExpiredSessions,
    hydrateSessions,
  };
}
