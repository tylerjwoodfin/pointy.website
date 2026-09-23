import type { PlayerRow } from "./types";

/** People who have disconnected stay in the session so they can rejoin, but they are not shown. */
export function playersAtTable(players: readonly PlayerRow[]): PlayerRow[] {
  return players.filter((player) => player.online);
}
