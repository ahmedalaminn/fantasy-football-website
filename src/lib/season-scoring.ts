import type { ParticipationRow } from "./production";
import type { SleeperMatchup } from "./types";

/** Apply this league's weights to Sleeper's weekly stat counters, not its standard point totals. */
export function fantasyPoints(
  stats: Record<string, number>,
  scoring: Record<string, number>,
) {
  const total = Object.entries(scoring).reduce(
    (points, [stat, weight]) => points + (stats[stat] ?? 0) * weight,
    0,
  );
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function seasonScores(
  weeks: Array<{
    stats: ParticipationRow[] | null;
    matchups: Pick<SleeperMatchup, "players_points">[];
  }>,
  scoring: Record<string, number>,
) {
  const totals: Record<string, number> = {};
  for (const week of weeks) {
    const points = new Map<string, number>();
    for (const row of week.stats ?? []) {
      // Missing games must not become artificial zero-point performances.
      if (row.stats.gp > 0)
        points.set(row.player_id, fantasyPoints(row.stats, scoring));
    }
    // Official league scores take priority, including commissioner adjustments.
    // A Map counts each player once even when matchup rosters contain duplicates.
    for (const matchup of week.matchups)
      for (const [id, score] of Object.entries(matchup.players_points ?? {}))
        if (Number.isFinite(score)) points.set(id, score);
    for (const [id, score] of points)
      totals[id] = Math.round(((totals[id] ?? 0) + score) * 100) / 100;
  }
  return totals;
}
