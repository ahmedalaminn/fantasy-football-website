import { describe, expect, it } from "vitest";
import { productionSummary } from "./production";
import type { SleeperPlayer } from "./types";
const players = { p: { team: "SEA" } as SleeperPlayer };
describe("production participation", () => {
  it("counts a zero-point appearance, excludes byes, and counts missed games", () => {
    const result = productionSummary(players, [
      [
        { player_id: "SEA", team: "SEA", stats: { gp: 1 } },
        { player_id: "p", team: "SEA", stats: { gp: 1, pts_ppr: 0 } },
      ],
      [],
      [{ player_id: "SEA", team: "SEA", stats: { gp: 1 } }],
    ]);
    expect(result.p).toEqual({
      played: 1,
      scheduled: 2,
      missed: 1,
      available: true,
    });
  });
  it("marks incomplete upstream data unavailable instead of inventing missed games", () => {
    expect(productionSummary(players, [null]).p.available).toBe(false);
  });
  it("uses the team in the historical game for players who changed NFL teams", () => {
    expect(
      productionSummary(players, [
        [
          { player_id: "DET", team: "DET", stats: { gp: 1 } },
          { player_id: "p", team: "DET", stats: { gp: 1 } },
        ],
      ]).p.played,
    ).toBe(1);
  });
});
