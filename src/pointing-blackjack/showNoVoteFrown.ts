import type { PlayerRole } from "./types";

/** Product is discouraged from voting, so a missing vote stays blank. */
export function showNoVoteFrown(role: PlayerRole | undefined): boolean {
  return role !== "product";
}
