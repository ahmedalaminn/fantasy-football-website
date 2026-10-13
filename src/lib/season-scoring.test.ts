import { describe, expect, it } from "vitest";
import { fantasyPoints, seasonScores } from "./season-scoring";
import { performanceRankings } from "./best-ball";

const scoring = {
  sack: 1,
  int: 2,
  ff: 1,
  fum_rec: 2,
  yds_allow_450_499: -5,
  yds_allow_400_449: -3,
  pts_allow_28_34: -1,
  pts_allow_35p: -4,
};
const detroit: Record<string, number>[] = [
  {
    gp: 1,
    sack: 5,
    int: 2,
    ff: 1,
    fum_rec: 1,
    yds_allow_450_499: 1,
    pts_allow_28_34: 1,
  },
  { gp: 1, sack: 2, ff: 1, yds_allow_400_449: 1, pts_allow_35p: 1 },
  { gp: 1, sack: 5, ff: 1, fum_rec: 1 },
  { gp: 1, sack: 3, ff: 1, yds_allow_400_449: 1, pts_allow_28_34: 1 },
];
describe("complete season scoring", () => {
  it("includes Detroit's unrostered games with custom league scoring and a performance rating", () => {
    const totals = seasonScores(
      detroit.map((stats) => ({
        stats: [{ player_id: "DET", team: "DET", stats }],
        matchups: [],
      })),
      scoring,
    );
    expect(totals.DET).toBe(10);
    expect(
      performanceRankings(
        [{ playerId: "DET", name: "Detroit Lions", position: "DEF", adp: 140 }],
        totals,
      )[0],
    ).toMatchObject({ playerId: "DET", points: 10, scoringRank: 1 });
  });
  it("preserves official scores, never doubles roster appearances, and fills dropped-player games", () => {
    const totals = seasonScores(
      [
        {
          stats: [{ player_id: "p", team: "DET", stats: { gp: 1, rec: 2 } }],
          matchups: [
            { players_points: { p: 3.5 } },
            { players_points: { p: 3.5 } },
          ],
        },
        {
          stats: [{ player_id: "p", team: "DET", stats: { gp: 1, rec: 4 } }],
          matchups: [],
        },
      ],
      { rec: 1 },
    );
    expect(totals.p).toBe(7.5);
  });
  it("keeps genuine zero and negative games but does not invent scores for non-participants", () => {
    const totals = seasonScores(
      [
        {
          stats: [
            { player_id: "zero", team: "DET", stats: { gp: 1 } },
            {
              player_id: "negative",
              team: "DET",
              stats: { gp: 1, pass_int: 1 },
            },
            { player_id: "absent", team: "DET", stats: { gp: 0 } },
          ],
          matchups: [],
        },
      ],
      { pass_int: -2 },
    );
    expect(totals).toEqual({ zero: 0, negative: -2 });
  });
  it("uses available official scores when the full NFL feed fails", () => {
    expect(
      seasonScores(
        [{ stats: null, matchups: [{ players_points: { p: 12.4 } }] }],
        scoring,
      ),
    ).toEqual({ p: 12.4 });
  });
  it("rounds league yardage scoring without using standard fantasy totals", () => {
    expect(
      fantasyPoints(
        { pass_yd: 237, pass_td: 2, pts_ppr: 99 },
        { pass_yd: 0.04, pass_td: 4 },
      ),
    ).toBe(17.48);
  });
});
