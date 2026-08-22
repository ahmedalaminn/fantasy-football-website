import { describe, expect, it } from "vitest";
import {
  buildDraftPlayerPool,
  managerPickNumbers,
  depthChartLabel,
  isDraftEligiblePlayer,
  parseMarketRankCsv,
  pickNumber,
  recommendPlayers,
  simulateNextPickAvailability,
  sleeperDepthChartAdjustment,
  type DraftPlayer,
} from "./draft-assistant";
import type { SleeperDraft } from "./types";
import { sleeperPlayerUrl } from "./sleeper-player";

const draft: SleeperDraft = {
  draft_id: "draft",
  league_id: "league",
  season: "2026",
  type: "snake",
  status: "pre_draft",
  start_time: null,
  settings: { teams: 10, rounds: 4 },
  slot_to_roster_id: Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [String(index + 1), index + 1]),
  ),
};

const player = (
  id: string,
  position: DraftPlayer["position"],
  rank: number,
): DraftPlayer => ({
  id,
  name: id,
  team: "BUF",
  position,
  marketRank: rank,
  positionRank: rank,
  projectedPoints: 250 - rank,
  floor: 180,
  ceiling: 310,
  replacementValue: 80 - rank,
  age: 25,
  experience: 3,
  injuryStatus: null,
  depthChartOrder: 1,
  depthChartAdjustment: 0.05,
  byeWeek: 7,
  availabilityRisk: 0.1,
  confidence: 0.8,
  newsImpact: 0,
  projectionSource: "python-model",
});

describe("draft assistant", () => {
  it("calculates the pick-four snake inventory", () => {
    expect([1, 2, 3, 4].map((round) => pickNumber(round, 4, 10))).toEqual([
      4, 17, 24, 37,
    ]);
    expect(managerPickNumbers(draft, 4, [])).toEqual([4, 17, 24, 37]);
  });

  it("moves a traded pick to its current owner", () => {
    const trade = {
      season: "2026",
      round: 2,
      roster_id: 4,
      previous_owner_id: 4,
      owner_id: 7,
    };
    expect(managerPickNumbers(draft, 4, [trade])).toEqual([4, 24, 37]);
    expect(managerPickNumbers(draft, 7, [trade])).toContain(17);
  });

  it("removes drafted players and changes close calls with personalization", () => {
    const players = [player("RB One", "RB", 1), player("WR One", "WR", 2)];
    const result = recommendPlayers({
      players,
      draftedIds: ["RB One"],
      rosterIds: [],
      overallPick: 4,
      nextPick: 17,
      profile: {
        ownerId: "owner",
        sampleSize: 20,
        positionShare: { WR: 0.6 },
        averageRound: { WR: 2 },
      },
      personalized: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("WR One");
    expect(result[0].personalizedScore).toBeGreaterThan(result[0].score);
  });

  it("uses deterministic draft simulations for next-pick availability", () => {
    const early = simulateNextPickAvailability(player("Early", "RB", 5), 25);
    const late = simulateNextPickAvailability(player("Late", "RB", 45), 25);
    expect(early).toBeLessThan(late);
    expect(simulateNextPickAvailability(player("Early", "RB", 5), 25)).toBe(
      early,
    );
  });

  it("loads optional market rank CSV overrides", () => {
    const ranks = parseMarketRankCsv("sleeper_id,rank\n123,4.5\n456,18");
    expect(ranks.get("123")).toBe(4.5);
    expect(ranks.get("456")).toBe(18);
  });

  it("builds Sleeper profile URLs for players and team defenses", () => {
    expect(
      sleeperPlayerUrl({ id: "4984", name: "Josh Allen", position: "QB" }),
    ).toBe("https://sleeper.com/nfl/players/josh-allen-4984");
    expect(
      sleeperPlayerUrl({
        id: "ARI",
        name: "Arizona Cardinals",
        position: "DEF",
      }),
    ).toBe("https://sleeper.com/nfl/players/ari");
  });

  it("labels and bounds Sleeper depth-chart context", () => {
    expect(depthChartLabel(player("Starter", "RB", 1))).toBe("RB1");
    expect(sleeperDepthChartAdjustment("RB", 1)).toBe(0.05);
    expect(sleeperDepthChartAdjustment("WR", 2)).toBe(0.02);
    expect(sleeperDepthChartAdjustment("QB", 4)).toBe(-0.08);
    expect(sleeperDepthChartAdjustment("DEF", 1)).toBe(0);
  });

  it("applies current Sleeper depth-chart role to projections", () => {
    const pool = buildDraftPlayerPool({
      starter: {
        player_id: "starter",
        full_name: "Starter Back",
        team: "BUF",
        position: "RB",
        fantasy_positions: ["RB"],
        active: true,
        search_rank: 10,
        depth_chart_order: 1,
      },
      reserve: {
        player_id: "reserve",
        full_name: "Reserve Back",
        team: "BUF",
        position: "RB",
        fantasy_positions: ["RB"],
        active: true,
        search_rank: 10,
        depth_chart_order: 3,
      },
    });
    const starter = pool.find((entry) => entry.id === "starter")!;
    const reserve = pool.find((entry) => entry.id === "reserve")!;
    expect(starter.depthChartAdjustment).toBe(0.05);
    expect(reserve.depthChartAdjustment).toBe(-0.04);
    expect(starter.projectedPoints).toBeGreaterThan(reserve.projectedPoints);
  });

  it("excludes retired, inactive, teamless, and ambiguously active players", () => {
    const candidate = {
      player_id: "candidate",
      full_name: "Current Player",
      team: "BUF",
      position: "QB",
      fantasy_positions: ["QB"],
      active: true,
      status: "Active",
      search_rank: 20,
    };

    expect(isDraftEligiblePlayer(candidate)).toBe(true);
    expect(isDraftEligiblePlayer({ ...candidate, active: false })).toBe(false);
    expect(isDraftEligiblePlayer({ ...candidate, active: undefined })).toBe(
      false,
    );
    expect(isDraftEligiblePlayer({ ...candidate, status: "Retired" })).toBe(
      false,
    );
    expect(isDraftEligiblePlayer({ ...candidate, status: "Inactive" })).toBe(
      false,
    );
    expect(isDraftEligiblePlayer({ ...candidate, team: null })).toBe(false);
  });

  it("does not create fallback projections for ineligible historical players", () => {
    const pool = buildDraftPlayerPool({
      current: {
        player_id: "current",
        full_name: "Current Quarterback",
        team: "BUF",
        position: "QB",
        fantasy_positions: ["QB"],
        active: true,
        status: "Active",
        search_rank: 25,
      },
      retired: {
        player_id: "retired",
        full_name: "Retired Quarterback",
        team: null,
        position: "QB",
        fantasy_positions: ["QB"],
        active: true,
        status: "Retired",
        search_rank: 1,
      },
    });

    expect(pool.map((entry) => entry.id)).toEqual(["current"]);
  });
});
