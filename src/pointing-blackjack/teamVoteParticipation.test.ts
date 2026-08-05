import { teamVoteParticipation } from "./teamVoteParticipation";
import type { PlayerRow } from "./types";

function player(
  id: string,
  role: PlayerRow["role"]
): PlayerRow {
  return { id, name: id, online: true, role };
}

describe("teamVoteParticipation", () => {
  it("returns null when there are no QA or Dev players", () => {
    expect(
      teamVoteParticipation([player("a", "product")], { a: 5 })
    ).toBeNull();
    expect(teamVoteParticipation([], {})).toBeNull();
  });

  it("counts only QA and Dev, including hidden votes", () => {
    const players = [
      player("p", "product"),
      player("d1", "dev"),
      player("d2", "dev"),
      player("q1", "qa"),
      player("q2", "qa"),
    ];
    const result = teamVoteParticipation(players, {
      p: 8,
      d1: "hidden",
      d2: null,
      q1: 3,
      q2: null,
    });
    expect(result).toEqual({ voted: 2, total: 4, percent: 50 });
  });

  it("treats players without a role as team (non-product)", () => {
    const players: PlayerRow[] = [
      { id: "x", name: "x", online: true },
      player("d", "dev"),
    ];
    expect(teamVoteParticipation(players, { x: 1, d: null })).toEqual({
      voted: 1,
      total: 2,
      percent: 50,
    });
  });

  it("rounds percent to nearest integer", () => {
    const players = [
      player("a", "dev"),
      player("b", "dev"),
      player("c", "qa"),
    ];
    expect(teamVoteParticipation(players, { a: 1 })).toEqual({
      voted: 1,
      total: 3,
      percent: 33,
    });
  });
});
