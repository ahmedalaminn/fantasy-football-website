import snapshot from "@/data/sleeper-adp-2026.json";
import { draftDay, preseasonBenchmark } from "@/lib/best-ball";
import { BestBallBoard } from "@/components/best-ball-board";
import { Card, ErrorState, PageHeader } from "@/components/ui";
import {
  getPlayers,
  getCurrentSeason,
  getDrafts,
  getLiveDraftPicks,
  getAllWeeks,
  getNflState,
} from "@/lib/sleeper";
export const dynamic = "force-dynamic";
export const metadata = { title: "Best Ball Report" };
export default async function BestBallPage() {
  try {
    const [players, season, nfl] = await Promise.all([
      getPlayers(),
      getCurrentSeason(),
      getNflState().catch(() => null),
    ]);
    const drafts = await getDrafts(season.league.league_id);
    const draft = [...drafts].sort(
      (a, b) => (b.start_time ?? 0) - (a.start_time ?? 0),
    )[0];
    const [draftPicks, weeks] = await Promise.all([
      draft ? getLiveDraftPicks(draft.draft_id) : Promise.resolve([]),
      getAllWeeks(season.league),
    ]);
    const currentWeek =
      season.league.settings.leg ||
      (nfl?.season === season.league.season ? nfl.week : 1);
    const scores: Record<string, number> = {};
    for (const week of weeks.filter(
      (w) => season.league.status === "complete" || w.week < currentWeek,
    )) {
      const weekly = new Map<string, number>();
      for (const matchup of week.matchups)
        for (const [id, points] of Object.entries(matchup.players_points ?? {}))
          weekly.set(id, points);
      for (const [id, points] of weekly)
        scores[id] = (scores[id] ?? 0) + points;
    }
    const managers = Object.fromEntries(
      season.teams.map((team) => [team.rosterId, team.managerName]),
    );
    const date = draftDay(draft?.start_time);
    const adp = preseasonBenchmark(snapshot, season.league.season);
    const ranked = new Map(adp.map((p) => [p.playerId, p]));
    const drafted = new Set(draftPicks.map((p) => p.player_id));
    const pool = Object.values(players)
      .filter(
        (p) =>
          ranked.has(p.player_id) ||
          drafted.has(p.player_id) ||
          (p.active &&
            ["QB", "RB", "WR", "TE", "K", "DEF"].includes(p.position ?? "")),
      )
      .map((p) => ({
        id: p.player_id,
        name:
          p.full_name ||
          ranked.get(p.player_id)?.name ||
          `${p.first_name ?? ""} ${p.last_name ?? ""}`,
        position: ranked.get(p.player_id)?.position ?? p.position ?? "",
        team: p.team ?? "FA",
      }));
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${season.league.season} · Draft review`}
          title="Best ball report"
          description="Every pick measured against frozen Sleeper ADP as the season progresses."
        />
        <BestBallBoard
          players={pool}
          draftPicks={draftPicks.sort((a, b) => a.pick_no - b.pick_no)}
          managers={managers}
          scores={scores}
          leagueName={season.league.name}
          adp={adp}
          snapshotDate={snapshot.snapshotDate}
          draftDate={date}
          sourceName={snapshot.sourceName}
          sourceUrl={snapshot.sourceUrl}
          throughWeek={
            season.league.status === "complete"
              ? currentWeek
              : Math.max(0, currentWeek - 1)
          }
          draftStatus={draft?.status ?? "unavailable"}
          managersInfo={Object.fromEntries(
            season.teams.map((team) => [
              team.rosterId,
              { name: team.managerName, avatar: team.avatarUrl },
            ]),
          )}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader title="Best ball report" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
