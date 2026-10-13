import type { SleeperPlayer } from "./types";
export interface Production {
  played: number;
  scheduled: number;
  missed: number;
  available: boolean;
}
export interface ParticipationRow {
  player_id: string;
  team: string;
  stats: Record<string, number>;
}
export function productionSummary(
  players: Record<string, SleeperPlayer>,
  weeks: Array<ParticipationRow[] | null>,
) {
  const indexed = weeks.map((rows) =>
    rows
      ? {
          byPlayer: new Map(rows.map((row) => [row.player_id, row])),
          teamsPlayed: new Set(
            rows
              .filter((row) => row.player_id === row.team && row.stats.gp > 0)
              .map((row) => row.team),
          ),
        }
      : null,
  );
  return Object.fromEntries(
    Object.entries(players).map(([id, player]) => {
      let played = 0,
        scheduled = 0;
      for (const rows of indexed) {
        if (!rows) continue;
        const row = rows.byPlayer.get(id);
        const team = row?.team ?? player.team;
        // Team-defense participation establishes that a scheduled game occurred;
        // no defense game means bye (or game has not occurred yet).
        if (!rows.teamsPlayed.has(team ?? "")) continue;
        scheduled++;
        if ((row?.stats.gp ?? 0) > 0) played++;
      }
      return [
        id,
        {
          played,
          scheduled,
          missed: scheduled - played,
          available: weeks.every(Boolean),
        },
      ];
    }),
  ) as Record<string, Production>;
}
