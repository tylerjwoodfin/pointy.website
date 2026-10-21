/**
 * Supabase persistence for Pointy sessions.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import { emptyParticipation, normalizeParticipation, touchParticipant } from "./session-summary.mjs";

/**
 * @typedef {'product' | 'qa' | 'dev'} PlayerRole
 * @typedef {{ name: string, online: boolean, brb?: boolean, role?: PlayerRole, funTitle?: string }} Player
 * @typedef {{ rounds: number, sent: boolean, players: Record<string, { name: string, role: string, votes: number }> }} Participation
 * @typedef {{ id: string, revealed: boolean, gameOver: boolean, expiresAt: number, funNames?: boolean, players: Map<string, Player>, votes: Map<string, number|null>, participation?: Participation }} Session
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
  /** @type {boolean | null} */
  let funNamesColumnSupported = null;
  /** @type {boolean | null} */
  let funTitleColumnSupported = null;
  /** @type {boolean | null} */
  let participationColumnSupported = null;

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
   * @param {unknown} error
   */
  /**
   * @param {unknown} error
   * @param {string} column
   */
  function isMissingNamedColumn(error, column) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      /** @type {{ code?: string }} */ (error).code !== "42703"
    ) {
      return false;
    }
    const message =
      "message" in error && typeof error.message === "string" ? error.message : "";
    return new RegExp(column, "i").test(message);
  }

  /**
   * @param {unknown} error
   */
  function isMissingParticipationColumn(error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      /** @type {{ code?: string }} */ (error).code !== "42703"
    ) {
      return false;
    }
    const message =
      "message" in error && typeof error.message === "string" ? error.message : "";
    return /participation/i.test(message);
  }

  /**
   * @param {string} sessionId
   */
  async function fetchPlayerRows(sessionId) {
    const columns = ["id", "name", "brb"];
    if (roleColumnSupported !== false) columns.push("role");
    if (funTitleColumnSupported !== false) columns.push("fun_title");

    const { data, error } = await supabase
      .from("pointing_players")
      .select(columns.join(", "))
      .eq("session_id", sessionId);
    if (error && funTitleColumnSupported !== false && isMissingNamedColumn(error, "fun_title")) {
      funTitleColumnSupported = false;
      console.warn(
        "pointing_players.fun_title column missing — run supabase/migrations/20261020000000_pointing_fun_names.sql"
      );
      return fetchPlayerRows(sessionId);
    }
    if (error && roleColumnSupported !== false && isMissingRoleColumn(error)) {
      roleColumnSupported = false;
      console.warn(
        "pointing_players.role column missing — run supabase/migrations/20260708000000_pointing_player_role.sql"
      );
      return fetchPlayerRows(sessionId);
    }
    if (error) throw error;
    if (roleColumnSupported !== false) roleColumnSupported = true;
    if (funTitleColumnSupported !== false) funTitleColumnSupported = true;
    return data ?? [];
  }

  /**
   * @param {Array<{ id: string, session_id: string, name: string, brb: boolean, role: PlayerRole, fun_title?: string | null }>} playerRows
   */
  function playerInsertPayload(playerRows) {
    return playerRows.map((player) => {
      /** @type {Record<string, unknown>} */
      const row = {
        id: player.id,
        session_id: player.session_id,
        name: player.name,
        brb: player.brb,
      };
      if (roleColumnSupported !== false) row.role = player.role;
      if (funTitleColumnSupported !== false) row.fun_title = player.fun_title ?? null;
      return row;
    });
  }

  /**
   * @param {Array<{ id: string, session_id: string, name: string, brb: boolean, role: PlayerRole, fun_title?: string | null }>} playerRows
   */
  async function insertPlayerRows(playerRows) {
    if (!playerRows.length) return;

    const { error } = await supabase.from("pointing_players").insert(playerInsertPayload(playerRows));
    if (error && funTitleColumnSupported !== false && isMissingNamedColumn(error, "fun_title")) {
      funTitleColumnSupported = false;
      console.warn(
        "pointing_players.fun_title column missing — run supabase/migrations/20261020000000_pointing_fun_names.sql"
      );
      await insertPlayerRows(playerRows);
      return;
    }
    if (error && roleColumnSupported !== false && isMissingRoleColumn(error)) {
      roleColumnSupported = false;
      console.warn(
        "pointing_players.role column missing — run supabase/migrations/20260708000000_pointing_player_role.sql"
      );
      await insertPlayerRows(playerRows);
      return;
    }
    if (error) throw error;
    if (roleColumnSupported !== false) roleColumnSupported = true;
    if (funTitleColumnSupported !== false) funTitleColumnSupported = true;
  }

  /**
   * @param {Session} session
   */
  async function upsertSessionRow(session) {
    /** @type {Record<string, unknown>} */
    const row = {
      id: session.id,
      revealed: session.revealed,
      game_over: session.gameOver,
      expires_at: new Date(session.expiresAt).toISOString(),
    };
    if (funNamesColumnSupported !== false) {
      row.fun_names = session.funNames !== false;
    }
    if (participationColumnSupported !== false) {
      row.participation = session.participation ?? emptyParticipation();
    }

    const { error } = await supabase.from("pointing_sessions").upsert(row);
    if (error && isMissingNamedColumn(error, "fun_names")) {
      funNamesColumnSupported = false;
      console.warn(
        "pointing_sessions.fun_names column missing — run supabase/migrations/20261020000000_pointing_fun_names.sql"
      );
      await upsertSessionRow(session);
      return;
    }
    if (error && isMissingParticipationColumn(error)) {
      participationColumnSupported = false;
      console.warn(
        "pointing_sessions.participation column missing — run supabase/migrations/20260921000000_pointing_participation.sql"
      );
      await upsertSessionRow(session);
      return;
    }
    if (error) throw error;
    if (funNamesColumnSupported !== false) funNamesColumnSupported = true;
    if (participationColumnSupported !== false) participationColumnSupported = true;
  }

  /**
   * @param {Session} session
   */
  async function persistSession(session) {
    await upsertSessionRow(session);

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
      fun_title: pl.funTitle ?? null,
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
  async function fetchSessionRows() {
    const now = new Date().toISOString();
    const columns = ["id", "revealed", "game_over", "expires_at"];
    if (funNamesColumnSupported !== false) columns.push("fun_names");
    if (participationColumnSupported !== false) columns.push("participation");

    const { data, error } = await supabase
      .from("pointing_sessions")
      .select(columns.join(", "))
      .gt("expires_at", now)
      .eq("game_over", false);
    if (error && isMissingNamedColumn(error, "fun_names")) {
      funNamesColumnSupported = false;
      console.warn(
        "pointing_sessions.fun_names column missing — run supabase/migrations/20261020000000_pointing_fun_names.sql"
      );
      return fetchSessionRows();
    }
    if (error && isMissingParticipationColumn(error)) {
      participationColumnSupported = false;
      console.warn(
        "pointing_sessions.participation column missing — run supabase/migrations/20260921000000_pointing_participation.sql"
      );
      return fetchSessionRows();
    }
    if (error) throw error;
    if (funNamesColumnSupported !== false) funNamesColumnSupported = true;
    if (participationColumnSupported !== false) participationColumnSupported = true;
    return data ?? [];
  }

  async function hydrateSessions(sessions) {
    const sessionRows = await fetchSessionRows();

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
        funNames: row.fun_names !== false,
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
              funTitle:
                "fun_title" in p && typeof p.fun_title === "string" && p.fun_title.trim()
                  ? p.fun_title.trim()
                  : undefined,
            },
          ])
        ),
        votes: new Map((voteRows ?? []).map((v) => [v.player_id, v.value])),
        participation: normalizeParticipation(
          "participation" in row ? row.participation : null
        ),
      };
      for (const [playerId, player] of session.players) {
        touchParticipant(session.participation, playerId, player);
      }
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
