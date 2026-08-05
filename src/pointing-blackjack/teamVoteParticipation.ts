import type { PlayerRow } from "./types";

function hasSubmittedVote(
  vote: number | null | "hidden" | undefined
): boolean {
  return vote === "hidden" || typeof vote === "number";
}

/** QA + Dev participation for the current round (Product excluded). */
export function teamVoteParticipation(
  players: PlayerRow[],
  voteByPlayer: Record<string, number | null | "hidden">
): { voted: number; total: number; percent: number } | null {
  const team = players.filter((p) => p.role !== "product");
  if (team.length === 0) return null;
  const voted = team.filter((p) => hasSubmittedVote(voteByPlayer[p.id])).length;
  return {
    voted,
    total: team.length,
    percent: Math.round((voted / team.length) * 100),
  };
}
