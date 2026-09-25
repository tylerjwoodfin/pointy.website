/**
 * Running vote totals shown beside each name while a round is open.
 * Only Product/BA and players named Tyler receive them.
 */

/**
 * @param {{ name?: string, role?: string } | null | undefined} player
 */
export function canSeeLiveVoteCounts(player) {
  if (!player) return false;
  if (player.role === "product") return true;
  return String(player.name ?? "").trim().toLowerCase() === "tyler";
}

/**
 * Rounds so far include the open round. A player's count includes a vote
 * already cast in that round, so "Voted 1/5" means one vote across five rounds.
 *
 * @param {{
 *   revealed: boolean,
 *   players: Map<string, { name?: string, role?: string }>,
 *   votes: Map<string, number | null>,
 *   participation?: { rounds: number, players: Record<string, { votes?: number }> },
 * }} session
 * @param {string} viewerId
 * @returns {{ rounds: number, votesByPlayer: Record<string, number> } | null}
 */
export function liveVoteCountsForViewer(session, viewerId) {
  const viewer = session.players.get(viewerId);
  if (!canSeeLiveVoteCounts(viewer)) return null;

  const participation = session.participation;
  const completed = participation?.rounds ?? 0;
  const includeOpenRound = !session.revealed;
  const rounds = completed + (includeOpenRound ? 1 : 0);
  /** @type {Record<string, number>} */
  const votesByPlayer = {};

  for (const [playerId] of session.players) {
    const historical = participation?.players?.[playerId]?.votes ?? 0;
    const current = session.votes.get(playerId);
    const votedNow = includeOpenRound && typeof current === "number";
    votesByPlayer[playerId] = historical + (votedNow ? 1 : 0);
  }

  return { rounds, votesByPlayer };
}
