import { statusWithCountLabel } from "./liveVoteCounts";

describe("statusWithCountLabel", () => {
  it("appends votes out of rounds so far", () => {
    expect(
      statusWithCountLabel("Voted", "a", { rounds: 5, votesByPlayer: { a: 1 } })
    ).toBe("Voted: 1/5");
    expect(
      statusWithCountLabel("Waiting", "a", { rounds: 5, votesByPlayer: { a: 1 } })
    ).toBe("Waiting: 1/5");
  });

  it("stays plain when counts are hidden", () => {
    expect(statusWithCountLabel("Voted", "a", null)).toBe("Voted");
    expect(statusWithCountLabel("Waiting", "a", undefined)).toBe("Waiting");
  });
});
