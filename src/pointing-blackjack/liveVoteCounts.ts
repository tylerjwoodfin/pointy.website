export type LiveVoteCounts = {
  rounds: number;
  votesByPlayer: Record<string, number>;
};

/** "Voted 1/5" or "Waiting 1/5" — votes cast out of rounds so far. */
export function statusWithCountLabel(
  status: "Voted" | "Waiting",
  playerId: string,
  counts: LiveVoteCounts | null | undefined
): string {
  if (!counts || counts.rounds <= 0) return status;
  const votes = counts.votesByPlayer[playerId] ?? 0;
  return `${status}: ${votes}/${counts.rounds}`;
}
