import { describe, expect, it } from "vitest";
import {
  draftDay,
  performanceRankings,
  perGameRankings,
  performanceView,
  pickValue,
  seasonGrade,
  preseasonBenchmark,
} from "./best-ball";
import snapshot from "../data/sleeper-adp-2026.json";
describe("best ball preseason benchmark", () => {
  it("grades discounts, reaches, and near-rank picks", () => {
    expect(pickValue(35, 20).grade).toBe("value");
    expect(pickValue(10, 20).grade).toBe("reach");
    expect(pickValue(21, 20).grade).toBe("fair");
    expect(pickValue(105, 100).grade).toBe("fair");
  });
  it("uses the frozen Sleeper ADP snapshot for the matching season", () => {
    expect(preseasonBenchmark(snapshot, "2026")).toHaveLength(2440);
    expect(preseasonBenchmark(snapshot, "2027")).toEqual([]);
    expect(snapshot.snapshotDate).toBe("2026-10-12");
    expect(new Set(snapshot.players.map((p) => p.playerId)).size).toBe(2440);
    expect(
      snapshot.players.every((p) => Number.isFinite(p.adp) && p.adp > 0),
    ).toBe(true);
    expect(snapshot.players.find((p) => p.playerId === "9226")).toMatchObject({
      adp: 13.7,
    });
    expect(snapshot.players.some((p) => p.playerId === "DET")).toBe(true);
    expect(snapshot.players.some((p) => p.playerId === "11533")).toBe(true);
    expect(snapshot.players.every((p) => p.adp < 999)).toBe(true);
  });
  it("displays the actual New York draft date separately from the source date", () => {
    expect(draftDay(Date.parse("2026-08-31T01:19:04Z"))).toBe("2026-08-30");
    expect(draftDay(null)).toBeNull();
  });
  it("compares scoring within positions and excludes missing points", () => {
    const players = [
      { playerId: "a", name: "A", position: "WR", adp: 1 },
      { playerId: "b", name: "B", position: "WR", adp: 10 },
      { playerId: "c", name: "C", position: "QB", adp: 20 },
      { playerId: "d", name: "D", position: "WR", adp: 5 },
    ];
    const result = performanceRankings(players, { a: 0, b: 30, c: 80 });
    expect(result[0]).toMatchObject({
      playerId: "b",
      gain: 1,
      scoringRank: 1,
      adpPositionRank: 2,
    });
    expect(result.find((p) => p.playerId === "c")?.gain).toBe(0);
    expect(result.find((p) => p.playerId === "a")?.points).toBe(0);
    expect(result.some((p) => p.playerId === "d")).toBe(false);
  });
  it("separates gains and shortfalls, orders shortfalls first, and preserves ranks when filtering", () => {
    const adp = [1, 2, 3, 4].map((id) => ({
      playerId: String(id),
      name: String(id),
      position: "WR",
      adp: id,
    }));
    const rows = performanceRankings(adp, {
      "1": 10,
      "2": 20,
      "3": 30,
      "4": 40,
    });
    const drafted = new Set(["1", "3"]);
    expect(
      performanceView(rows, "outperformers", "all", drafted).map(
        (r) => r.playerId,
      ),
    ).toEqual(["4", "3"]);
    expect(
      performanceView(rows, "underperformers", "all", drafted).map(
        (r) => r.playerId,
      ),
    ).toEqual(["1", "2"]);
    expect(
      performanceView(rows, "outperformers", "undrafted", drafted),
    ).toMatchObject([
      { playerId: "4", gain: 3, scoringRank: 1, adpPositionRank: 4 },
    ]);
    expect(
      performanceView(rows, "underperformers", "drafted", drafted).map(
        (r) => r.playerId,
      ),
    ).toEqual(["1"]);
    expect(
      performanceView(rows, "underperformers", "undrafted", drafted).map(
        (r) => r.playerId,
      ),
    ).toEqual(["2"]);
    const neutral = performanceRankings(adp, {
      "1": 40,
      "2": 30,
      "3": 20,
      "4": 10,
    });
    expect(performanceView(neutral, "outperformers", "all", drafted)).toEqual(
      [],
    );
    expect(performanceView(neutral, "underperformers", "all", drafted)).toEqual(
      [],
    );
  });
  it("colors by season performance even when the draft-day value was a steal", () => {
    expect(pickValue(17, 10.3).grade).toBe("value");
    expect(seasonGrade(-27)).toBe("reach");
    expect(seasonGrade(5)).toBe("value");
    expect(seasonGrade(0)).toBe("fair");
    expect(seasonGrade(undefined)).toBe("unknown");
    expect(seasonGrade(NaN)).toBe("unknown");
  });
});

describe("per-game positional ranks", () => {
  const adp = [
    { playerId: "injured", name: "Injured", position: "WR", adp: 1 },
    { playerId: "healthy", name: "Healthy", position: "WR", adp: 2 },
    { playerId: "qb", name: "Quarterback", position: "QB", adp: 3 },
    { playerId: "dnp", name: "Did not play", position: "WR", adp: 4 },
    { playerId: "unknown", name: "Unknown", position: "WR", adp: 5 },
  ];
  it("ranks an injured player's points per appearance instead of dividing by elapsed weeks", () => {
    const scores = { injured: 20, healthy: 60, qb: 100, dnp: 0, unknown: 50 };
    const production = {
      injured: { played: 1, available: true },
      healthy: { played: 4, available: true },
      qb: { played: 4, available: true },
      dnp: { played: 0, available: true },
      unknown: { played: 2, available: false },
    };
    expect(
      performanceRankings(adp, scores).find((row) => row.playerId === "injured")
        ?.scoringRank,
    ).toBe(3);
    const rows = perGameRankings(adp, scores, production);
    expect(rows.find((row) => row.playerId === "injured")).toMatchObject({
      points: 20,
      scoringRank: 1,
    });
    expect(rows.find((row) => row.playerId === "healthy")).toMatchObject({
      points: 15,
      scoringRank: 2,
    });
    expect(rows.find((row) => row.playerId === "qb")?.scoringRank).toBe(1);
    expect(rows.map((row) => row.playerId)).not.toContain("dnp");
    expect(rows.map((row) => row.playerId)).not.toContain("unknown");
  });
  it("shares ranks for equal averages and keeps zero-point appearances", () => {
    const rows = perGameRankings(
      adp,
      { injured: 0, healthy: 0 },
      {
        injured: { played: 1, available: true },
        healthy: { played: 4, available: true },
      },
    );
    expect(rows.map((row) => row.scoringRank)).toEqual([1, 1]);
  });
});
