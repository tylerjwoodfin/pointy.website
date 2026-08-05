import type { PlayerRole, PlayerRow } from "./types";

export type RoleParticipation = {
  voted: number;
  total: number;
  percent: number;
};

export type TeamVoteParticipation = {
  dev: RoleParticipation | null;
  qa: RoleParticipation | null;
};

function hasSubmittedVote(
  vote: number | null | "hidden" | undefined
): boolean {
  return vote === "hidden" || typeof vote === "number";
}

function roleParticipation(
  players: PlayerRow[],
  voteByPlayer: Record<string, number | null | "hidden">,
  role: PlayerRole
): RoleParticipation | null {
  const group = players.filter((p) => p.role === role);
  if (group.length === 0) return null;
  const voted = group.filter((p) => hasSubmittedVote(voteByPlayer[p.id])).length;
  return {
    voted,
    total: group.length,
    percent: Math.round((voted / group.length) * 100),
  };
}

/** Separate Dev and QA vote participation for the current round. */
export function teamVoteParticipation(
  players: PlayerRow[],
  voteByPlayer: Record<string, number | null | "hidden">
): TeamVoteParticipation | null {
  const dev = roleParticipation(players, voteByPlayer, "dev");
  const qa = roleParticipation(players, voteByPlayer, "qa");
  if (!dev && !qa) return null;
  return { dev, qa };
}
