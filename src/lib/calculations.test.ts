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

  it("keeps partial scores live, including negative scores", () => {
    for (const score of [20, -2]) {
      expect(
        pairMatchups(
          [matchup(1, score), matchup(2, 0)],
          [team(1, 0, 0), team(2, 0, 0)],
        )[0].status,
      ).toBe("live");
    }
    expect(
      pairMatchups(
        [matchup(1, 0), matchup(2, 0)],
        [team(1, 0, 0), team(2, 0, 0)],
      )[0].status,
    ).toBe("upcoming");
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

  it("uses the three power-ranking inputs and ranks the stronger team first", () => {
    const teams = [team(1, 1, 120), team(2, 0, 80)];
    const players: Record<string, SleeperPlayer> = {};
    const weeks = [{ week: 1, matchups: [matchup(1, 120), matchup(2, 80)] }];
    expect(powerRankings(teams, weeks, 1, league(), players)[0].rosterId).toBe(
      1,
    );
  });

  it("rewards weekly strength over a lucky head-to-head win", () => {
    const teams = [1, 2, 3, 4].map((id) => team(id, 0, 0));
    const rows = [
      matchup(1, 100),
      matchup(2, 110),
      { ...matchup(3, 20), matchup_id: 2 },
      { ...matchup(4, 10), matchup_id: 2 },
    ];
    const result = powerRankings(
      teams,
      [{ week: 1, matchups: rows }],
      1,
      league(),
      {},
    );
    const unlucky = result.find((r) => r.rosterId === 1)!;
    const lucky = result.find((r) => r.rosterId === 3)!;
    expect(unlucky.components.winPercentage).toBe(0);
    expect(lucky.components.winPercentage).toBe(1);
    expect(unlucky.score).toBe(67.5);
    expect(lucky.score).toBe(57.5);
    expect(unlucky.components.allPlayWins).toBe(2);
    expect(unlucky.rank).toBeLessThan(lucky.rank);
  });

  it("splits tied category points and counts tied games as half wins", () => {
    const result = powerRankings(
      [team(1, 0, 0), team(2, 0, 0)],
      [{ week: 1, matchups: [matchup(1, 50), matchup(2, 50)] }],
      1,
      league(),
      {},
    );
    for (const row of result) {
      expect(row.components.pointsRankPoints).toBe(1.5);
      expect(row.components.allPlayRankPoints).toBe(1.5);
      expect(row.components.recordRankPoints).toBe(1.5);
      expect(row.components.winPercentage).toBe(0.5);
      expect(row.components.allPlayWinPercentage).toBe(0.5);
      expect(row.components.allPlayTies).toBe(1);
      expect(row.score).toBe(75);
    }
  });

  it("excludes live and incomplete data and measures movement from the last snapshot", () => {
    const teams = [team(1, 0, 0), team(2, 0, 0)];
    const weeks = [
      { week: 2, matchups: [matchup(1, 0), matchup(2, 300)] },
      { week: 1, matchups: [matchup(1, 100), matchup(2, 10)] },
    ];
    expect(powerRankings(teams, weeks, 0, league(), {})).toEqual([]);
    expect(powerRankings(teams, weeks, 1, league(), {})[0].rosterId).toBe(1);
    const result = powerRankings(teams, weeks, 2, league(), {});
    expect(result[0].rosterId).toBe(2);
    expect(result[0].movement).toBe(1);
    expect(result[1].movement).toBe(-1);
    expect(
      powerRankings(
        teams,
        [{ week: 1, matchups: [matchup(1, 100)] }],
        1,
        league(),
        {},
      ),
    ).toEqual([]);
  });

  it("counts bye scoring for PF and all-play without inventing a head-to-head game", () => {
    const result = powerRankings(
      [team(1, 0, 0), team(2, 0, 0)],
      [
        {
          week: 1,
          matchups: [
            { ...matchup(1, 60), matchup_id: null },
            { ...matchup(2, 40), matchup_id: null },
          ],
        },
      ],
      1,
      league(),
      {},
    );
    expect(result[0].components.totalPoints).toBe(60);
    expect(result[0].components.allPlayWins).toBe(1);
    expect(result[0].components.wins).toBe(0);
    expect(result[0].components.losses).toBe(0);
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
