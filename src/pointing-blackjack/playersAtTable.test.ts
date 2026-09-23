import { playersAtTable } from "./playersAtTable";
import type { PlayerRow } from "./types";

function player(partial: Partial<PlayerRow> & Pick<PlayerRow, "id" | "name">): PlayerRow {
  return { online: true, ...partial };
}

describe("playersAtTable", () => {
  it("drops people who have disconnected", () => {
    const players = [
      player({ id: "a", name: "Tiny Viper" }),
      player({ id: "b", name: "Mighty Raven", online: false }),
      player({ id: "c", name: "Luke", brb: true }),
    ];

    expect(playersAtTable(players).map((p) => p.name)).toEqual([
      "Tiny Viper",
      "Luke",
    ]);
  });
});
