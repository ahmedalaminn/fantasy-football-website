# Detroit Lions missing Best Ball data

Investigated October 12, 2026. Subsequently fixed at the user’s request.

Detroit exists in Sleeper's player directory as `DET` (DEF), in the preseason ADP snapshot, and in this league's draft at overall pick 140, round 14.

The Best Ball page aggregates `players_points` from the league's weekly matchup endpoint. Detroit was absent from every league matchup roster and its points map in Weeks 1–5. It consequently receives no total in this aggregation and no scoring rank in `performanceRankings`.

Sleeper's separate NFL statistics endpoint does contain Detroit participation and points for those weeks. Missing league-roster coverage is therefore the confirmed cause of missing production and rating, rather than a missing NFL player or draft pick. Its standard-scoring totals are not a substitute for this league's custom scoring.

A separate display issue exists in generic player rows: defenses have first/last names but no `full_name`, and PlayerRow falls back to `Player DET`. PlayerRow now falls back to those first/last names before a generic player ID.

Relevant public sources: `/v1/players/nfl`, `/v1/draft/{draft_id}/picks`, `/v1/league/{league_id}/matchups/{week}` at api.sleeper.app; `/stats/nfl/2026/{week}?season_type=regular` at the same host.

The fix calculates weekly fantasy points for participating players from the NFL statistics and this league’s scoring weights, then overlays official league player scores when present. This fills unrostered games, avoids double-counting players, and preserves official scoring and adjustments. Only completed weeks are aggregated.

Verified against official roster scores in Weeks 1–4: no differences for any comparable player. Detroit’s league-scored weekly totals are 6.0, -4.0, 8.0, and 0.0: **10.0 total points, 2.5 points per game, 4/4 games played, 0 games missed** through Week 4. Its standard-scoring total of 21.0 is deliberately not used.
