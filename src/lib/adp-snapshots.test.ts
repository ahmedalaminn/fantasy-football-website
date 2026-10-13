import { describe, expect, it } from "vitest";
import season2023 from "../data/sleeper-adp-2023.json";
import season2024 from "../data/sleeper-adp-2024.json";
import season2025 from "../data/sleeper-adp-2025.json";
import { performanceRankings, preseasonBenchmark } from "./best-ball";
describe("historical ADP snapshots", () => {
  for (const snapshot of [season2023, season2024, season2025]) {
    it(`uses ${snapshot.season} benchmarks with usable ADP and unique player IDs`, () => {
      const rows = preseasonBenchmark(snapshot, snapshot.season);
      expect(rows.length).toBeGreaterThan(600);
      expect(rows.every((row) => row.adp > 0 && row.adp < 999)).toBe(true);
      expect(new Set(rows.map((row) => row.playerId)).size).toBe(rows.length);
      expect(preseasonBenchmark(snapshot, "2026")).toEqual([]);
      expect(
        performanceRankings(rows, { "4034": 100 }).find(
          (row) => row.playerId === "4034",
        )?.position,
      ).toBe("RB");
    });
  }
  it("covers Travis Hunter's WR eligibility rather than dropping his ADP", () => {
    expect(
      season2025.players.find((row) => row.playerId === "12530"),
    ).toMatchObject({ position: "WR", adp: 68.9 });
  });
});
