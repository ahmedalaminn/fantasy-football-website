import Link from "next/link";
import { HistoryDraftBoard } from "@/components/history-draft-board";
import { attributeDraftPicks, draftSlotOwners } from "@/lib/draft";
import { seasonScores } from "@/lib/season-scoring";
import { productionSummary } from "@/lib/production";
import { adpSnapshots } from "@/lib/adp-snapshots";
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
  getWeeklyPlayerStats,
  getSeasonChain,
  getSeasonBundle,
  getDraftPicks,
} from "@/lib/sleeper";
export const dynamic = "force-dynamic";
export const metadata = { title: "Drafts" };
export default async function DraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  try {
    const [players, current, nfl, leagues, query] = await Promise.all([
      getPlayers(),
      getCurrentSeason(),
      getNflState().catch(() => null),
      getSeasonChain(),
      searchParams,
    ]);
    const chosenLeague =
      leagues.find((league) => league.season === query.season) ??
      current.league;
    const season =
      chosenLeague.league_id === current.league.league_id
        ? current
        : await getSeasonBundle(chosenLeague.league_id);
    const header = (
      <>
        <PageHeader
          eyebrow={`${season.league.season} season`}
          title="Drafts"
          description="Explore every draft and see how this season’s picks are performing."
        />
        <nav className="week-nav" aria-label="Select draft season">
          {leagues.map((league) => (
            <Link
              key={league.league_id}
              href={`/drafts?season=${league.season}`}
              className={
                league.league_id === season.league.league_id ? "active" : ""
              }
            >
              {league.season}
            </Link>
          ))}
        </nav>
      </>
    );
    const drafts = await getDrafts(season.league.league_id);
    const draft = [...drafts].sort(
      (a, b) => (b.start_time ?? 0) - (a.start_time ?? 0),
    )[0];
    const snapshot = adpSnapshots[season.league.season];
    if (!snapshot) {
      const picks = draft ? await getDraftPicks(draft.draft_id) : [];
      return (
        <div className="content-wrap">
          {header}
          <HistoryDraftBoard
            key={season.league.league_id}
            leagueName={season.league.name}
            draftDate={draftDay(draft?.start_time)}
            draftSlots={draftSlotOwners(draft, season.teams)}
            picks={attributeDraftPicks(picks, season.teams)}
            players={players}
            teams={season.teams}
          />
        </div>
      );
    }
    const [draftPicks, weeks] = await Promise.all([
      draft
        ? season.league.status === "complete"
          ? getDraftPicks(draft.draft_id)
          : getLiveDraftPicks(draft.draft_id)
        : Promise.resolve([]),
      getAllWeeks(season.league),
    ]);
    const currentWeek =
      season.league.settings.leg ||
      (nfl?.season === season.league.season ? nfl.week : 1);
    const completed = weeks.filter(
      (w) => season.league.status === "complete" || w.week < currentWeek,
    );
    const participation = await Promise.all(
      completed.map((w) =>
        getWeeklyPlayerStats(season.league.season, w.week).catch(() => null),
      ),
    );
    const draftMetadata = new Map(
      draftPicks.map((pick) => [pick.player_id, pick.metadata]),
    );
    const seasonPlayers = Object.fromEntries(
      Object.entries(players).map(([id, player]) => [
        id,
        {
          ...player,
          team: draftMetadata.get(id)?.team || player.team,
          position: draftMetadata.get(id)?.position || player.position,
        },
      ]),
    );
    const production = productionSummary(seasonPlayers, participation);
    const scores = seasonScores(
      completed.map((week, index) => ({
        stats: participation[index],
        matchups: week.matchups,
      })),
      season.league.scoring_settings,
    );
    const managers = Object.fromEntries(
      season.teams.map((team) => [team.rosterId, team.managerName]),
    );
    const date = draftDay(draft?.start_time);
    const adp = preseasonBenchmark(snapshot, season.league.season).map(
      (row) => ({
        ...row,
        position: draftMetadata.get(row.playerId)?.position || row.position,
      }),
    );
    const ranked = new Map(adp.map((p) => [p.playerId, p]));
    const drafted = new Set(draftPicks.map((p) => p.player_id));
    const pool = Object.values(seasonPlayers)
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
        {header}
        {participation.some((week) => week === null) && (
          <p role="status">
            Some NFL stats could not be loaded. Points for unrostered players
            may be incomplete.
          </p>
        )}
        <BestBallBoard
          key={season.league.league_id}
          draftSlots={draftSlotOwners(draft, season.teams)}
          players={pool}
          production={production}
          draftPicks={attributeDraftPicks(draftPicks, season.teams).sort(
            (a, b) => a.pick_no - b.pick_no,
          )}
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
        <PageHeader title="Drafts" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
