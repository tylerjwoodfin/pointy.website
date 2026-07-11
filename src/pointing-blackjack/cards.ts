import type { VoteValue } from "./types";

export const POINT_VALUES: readonly VoteValue[] = [1, 2, 3, 5, 8, 13] as const;

export function cardLabel(n: VoteValue): { main: string; sub: string } {
  if (n === 1) return { main: "A", sub: "(1)" };
  if (n === 13) return { main: "K", sub: "(13)" };
  return { main: String(n), sub: "" };
}

export function formatVoteDisplay(
  v: number | null | "hidden" | undefined,
  revealed: boolean
): string {
  if (v === "hidden") return revealed ? "?" : "···";
  if (v === null || v === undefined) return "—";
  const { main, sub } = cardLabel(v as VoteValue);
  return sub ? `${main} ${sub}` : main;
}
