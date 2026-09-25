import { teamVoteParticipation } from "./teamVoteParticipation";
import type { PlayerRow } from "./types";

function player(
  id: string,
  role: PlayerRow["role"],
  online = true
): PlayerRow {
  return { id, name: id, online, role };
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

  it("excludes offline players from voted and total", () => {
    const players = [
      player("d1", "dev"),
      player("d2", "dev", false),
      player("q1", "qa", false),
      player("q2", "qa"),
    ];
    expect(
      teamVoteParticipation(players, {
        d1: 5,
        d2: 8,
        q1: "hidden",
        q2: null,
      })
    ).toEqual({
      dev: { voted: 1, total: 1, percent: 100 },
      qa: { voted: 0, total: 1, percent: 0 },
    });
  });

  it("omits a role when every player in it is offline", () => {
    const players = [
      player("d1", "dev", false),
      player("q1", "qa"),
    ];
    expect(teamVoteParticipation(players, { d1: 5, q1: 3 })).toEqual({
      dev: null,
      qa: { voted: 1, total: 1, percent: 100 },
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
