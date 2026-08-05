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

  it("returns separate Dev and QA stats, including hidden votes", () => {
    const players = [
      player("p", "product"),
      player("d1", "dev"),
      player("d2", "dev"),
      player("q1", "qa"),
      player("q2", "qa"),
    ];
    expect(
      teamVoteParticipation(players, {
        p: 8,
        d1: "hidden",
        d2: null,
        q1: 3,
        q2: null,
      })
    ).toEqual({
      dev: { voted: 1, total: 2, percent: 50 },
      qa: { voted: 1, total: 2, percent: 50 },
    });
  });

  it("omits a role that has no players", () => {
    const players = [player("d1", "dev"), player("d2", "dev")];
    expect(
      teamVoteParticipation(players, { d1: 5, d2: "hidden" })
    ).toEqual({
      dev: { voted: 2, total: 2, percent: 100 },
      qa: null,
    });
  });

  it("rounds percent to nearest integer", () => {
    const players = [
      player("a", "dev"),
      player("b", "dev"),
      player("c", "dev"),
    ];
    expect(teamVoteParticipation(players, { a: 1 })).toEqual({
      dev: { voted: 1, total: 3, percent: 33 },
      qa: null,
    });
  });
});
