import type { PlayerRole } from "./types";

/** "Bob" + "Sleepy Eagle" → "Bob the Sleepy Eagle" while fun names are on. */
export function funDisplayName(
  name: string,
  funTitle: string | undefined,
  funNames: boolean
): string {
  const title = funTitle?.trim();
  if (!funNames || !title) return name;
  return `${name} the ${title}`;
}

/** Product (BA) or a player whose real name is Tyler. Keep in sync with server/fun-name.mjs. */
export function canToggleFunNames(
  player: { name?: string; role?: PlayerRole } | null | undefined
): boolean {
  if (!player) return false;
  if (player.role === "product") return true;
  return (player.name ?? "").trim().toLowerCase() === "tyler";
}
