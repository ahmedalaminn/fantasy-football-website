import { describe, expect, it } from "vitest";
import {
  deriveChampion,
  optimalLineupScore,
  pairMatchups,
  powerRankings,
  standings,
  traverseSeasonChain,
} from "./calculations";
import type {
  SleeperLeague,
  SleeperMatchup,
  SleeperPlayer,
  Team,
} from "./types";

const league = (id = "new", previous: string | null = null): SleeperLeague => ({
  league_id: id,
  name: "Test League",
  season: id,
  status: "complete",
  previous_league_id: previous,
  total_rosters: 2,
  avatar: null,
  roster_positions: ["QB", "RB", "WR", "FLEX"],
  scoring_settings: {},
  settings: { playoff_teams: 1, playoff_week_start: 15, leg: 17 },
});

const team = (rosterId: number, wins: number, pointsFor: number): Team => ({
  rosterId,
  ownerId: `owner-${rosterId}`,
  managerName: `Manager ${rosterId}`,
  teamName: `Team ${rosterId}`,
  avatarUrl: null,
  wins,
  losses: 10 - wins,
  ties: 0,
  pointsFor,
  pointsAgainst: 1000,
  streak: "W1",
  players: [],
  starters: [],
  reserve: [],
  taxi: [],
  raw: {
    roster_id: rosterId,
    owner_id: `owner-${rosterId}`,
    players: [],
    starters: [],
    settings: {},
  },
});

const matchup = (rosterId: number, points: number): SleeperMatchup => ({
  matchup_id: 1,
  roster_id: rosterId,
  points,
  custom_points: null,
  players: [],
  starters: [],
  players_points: {},
});

describe("league calculations", () => {
  it("sorts standings by wins then points and marks the playoff cutoff", () => {
    const result = standings([team(1, 7, 1200), team(2, 7, 1300)], 1);
    expect(result.map((entry) => entry.rosterId)).toEqual([2, 1]);
    expect(result[0].playoff).toBe(true);
    expect(result[1].playoff).toBe(false);
  });

  it("pairs matchup rows and identifies completed results", () => {
    const result = pairMatchups(
      [matchup(1, 110), matchup(2, 95)],
      [team(1, 1, 110), team(2, 0, 95)],
      true,
    );
    expect(result).toHaveLength(1);
    expect(result[0].teams).toHaveLength(2);
    expect(result[0].status).toBe("final");
  });

  it("derives champion, runner-up, and third place from bracket placements", () => {
    const teams = [team(1, 10, 1500), team(2, 8, 1400)];
    const result = deriveChampion(
      league(),
      teams,
      [{ r: 3, m: 1, t1: 1, t2: 2, w: 1, l: 2, p: 1 }],
      [],
      new Map(),
    );
    expect(result?.champion.rosterId).toBe(1);
    expect(result?.runnerUp?.rosterId).toBe(2);
  });

  it("builds a legal optimal lineup across fixed and flex slots", () => {
    const players: Record<string, SleeperPlayer> = {
      qb: {
        player_id: "qb",
        full_name: "QB",
        team: "BUF",
        position: "QB",
        fantasy_positions: ["QB"],
      },
      rb: {
        player_id: "rb",
        full_name: "RB",
        team: "DET",
        position: "RB",
        fantasy_positions: ["RB"],
      },
      wr: {
        player_id: "wr",
        full_name: "WR",
        team: "MIN",
        position: "WR",
        fantasy_positions: ["WR"],
      },
      te: {
        player_id: "te",
        full_name: "TE",
        team: "SF",
        position: "TE",
        fantasy_positions: ["TE"],
      },
    };
    const row = {
      ...matchup(1, 70),
      players_points: { qb: 20, rb: 15, wr: 25, te: 10 },
    };
    expect(optimalLineupScore(row, ["QB", "RB", "WR", "FLEX"], players)).toBe(
      70,
    );
  });

  it("uses all four power-ranking inputs and ranks the stronger team first", () => {
    const teams = [team(1, 1, 120), team(2, 0, 80)];
    const players: Record<string, SleeperPlayer> = {};
    const weeks = [{ week: 1, matchups: [matchup(1, 120), matchup(2, 80)] }];
    expect(powerRankings(teams, weeks, 1, league(), players)[0].rosterId).toBe(
      1,
    );
  });

  it("stops historical traversal when a season link cycles", async () => {
    const fixtures = new Map([
      ["new", league("new", "old")],
      ["old", league("old", "new")],
    ]);
    const result = await traverseSeasonChain(
      "new",
      async (id) => fixtures.get(id)!,
      10,
    );
    expect(result.map((entry) => entry.league_id)).toEqual(["new", "old"]);
  });
});
