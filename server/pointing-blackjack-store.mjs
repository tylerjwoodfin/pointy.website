/**
 * Supabase persistence for Pointing Showdown sessions.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";

/**
 * @typedef {{ name: string, online: boolean, brb?: boolean }} Player
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
  });

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
    }));
    if (playerRows.length) {
      const { error: playersErr } = await supabase.from("pointing_players").insert(playerRows);
      if (playersErr) throw playersErr;
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
      const { data: playerRows, error: playersErr } = await supabase
        .from("pointing_players")
        .select("id, name, brb")
        .eq("session_id", row.id);
      if (playersErr) throw playersErr;

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
          (playerRows ?? []).map((p) => [
            p.id,
            { name: p.name, online: false, brb: p.brb === true },
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
