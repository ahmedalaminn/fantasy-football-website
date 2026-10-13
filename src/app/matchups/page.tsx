import type { SleeperPlayer } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { MatchupCard, type MatchupSide } from "@/components/matchup-card";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/ui";
import { fantasyPoints } from "@/lib/season-scoring";
import { pairMatchups } from "@/lib/calculations";
import {
  getCurrentSeason,
  getMatchups,
  getNflState,
  getPlayers,
  getWeeklyPlayerStats,
  getWeeklyProjections,
  getNflSchedule,
} from "@/lib/sleeper";

export const metadata: Metadata = { title: "Matchups" };
export const dynamic = "force-dynamic";

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  try {
    const season = await getCurrentSeason();
    const nfl = await getNflState().catch(() => null);
    const current = Math.min(
      18,
      Math.max(
        1,
        season.league.settings.leg ||
          (nfl?.season === season.league.season ? nfl.week : 1),
      ),
    );
    const query = (await searchParams).week;
    const parsed = Number(query);
    const week =
      Number.isInteger(parsed) && parsed >= 1 && parsed <= current
        ? parsed
        : current;
    const [rows, players] = await Promise.all([
      getMatchups(
        season.league.league_id,
        week,
        season.league.status === "complete",
      ),
      getPlayers().catch(() => ({}) as Record<string, SleeperPlayer>),
    ]);
    const [participation, projections, schedule] = await Promise.all([
      getWeeklyPlayerStats(season.league.season, week).catch(() => null),
      getWeeklyProjections(season.league.season, week).catch(() => null),
      getNflSchedule(season.league.season).catch(() => null),
    ]);
    const projectionById = new Map(projections?.map((row) => [row.player_id, row]));
    const statsById = new Map(participation?.map((row) => [row.player_id, row]));
    const games = schedule?.filter((game) => game.week === week);
    const played = new Set(
      participation
        ?.filter((row) => row.stats.gp > 0)
        .map((row) => row.player_id),
    );
    const pairs = pairMatchups(
      rows,
      season.teams,
      season.league.status === "complete" || week < current,
    );
    const playoffStart = season.league.settings.playoff_week_start ?? 15;
    return (
      <div className="content-wrap matchups-page">
        <PageHeader
          eyebrow={`${season.league.season} season`}
          title="Matchups"
          description="Every head-to-head result, from opening week through the championship."
        />
        <nav className="week-nav" aria-label="Select week">
          {Array.from({ length: current }, (_, i) => i + 1).map((number) => (
            <Link
              key={number}
              className={week === number ? "active" : ""}
              href={`/matchups?week=${number}`}
            >
              {number}
            </Link>
          ))}
        </nav>
        <div className="section-header">
          <div>
            <span className="eyebrow">
              {week >= playoffStart ? "Postseason" : "Regular season"}
            </span>
            <h2>Week {week}</h2>
          </div>
          <Badge tone={week >= playoffStart ? "violet" : "aqua"}>
            {pairs.length} matchups
          </Badge>
        </div>
        {pairs.length ? (
          <div className="two-col matchup-grid">
            {pairs.map((pair) => {
              const [left, right] = pair.teams;
              if (!left) return null;
              const side = (entry: typeof left): MatchupSide => {
                const player = (id: string) => {
                  const projected = projectionById.get(id);
                  const team = statsById.get(id)?.team || projected?.team || players[id]?.team || "FA";
                  const game = games?.find((g) => g.home === team || g.away === team);
                  const bye = team !== "FA" && games != null && games.length > 0 && !game;
                  const opponent = game
                    ? `${game.home === team ? "vs" : "@"} ${game.home === team ? game.away : game.home}`
                    : projected?.opponent ? `vs ${projected.opponent}` : undefined;
                  const points = entry.matchup.players_points?.[id];
                  return {
                    id,
                    name: players[id]?.full_name ||
                      [players[id]?.first_name, players[id]?.last_name].filter(Boolean).join(" ") ||
                      (id === "0" ? "Empty slot" : `Player ${id}`),
                    position: players[id]?.position || "",
                    team,
                    opponent,
                    bye,
                    projected: !bye && projected && projected.stats.gp > 0
                      ? fantasyPoints(projected.stats, season.league.scoring_settings)
                      : undefined,
                    points,
                    status: bye ? "Bye week"
                      : participation && !played.has(id)
                        ? game?.status === "complete" || week < current || season.league.status === "complete"
                          ? "Did not play"
                          : "Not played yet"
                        : points == null ? "No data" : undefined,
                  };
                };
                const starters = entry.matchup.starters || [];
                return {
                  name: entry.team.teamName,
                  manager: entry.team.managerName,
                  avatar: entry.team.avatarUrl,
                  points: entry.matchup.points,
                  starters: starters.map(player),
                  bench: (entry.matchup.players || [])
                    .filter((id) => !starters.includes(id))
                    .map(player),
                };
              };
              return (
                <MatchupCard
                  key={pair.matchupId}
                  matchupId={pair.matchupId}
                  week={week}
                  status={pair.status}
                  left={side(left)}
                  right={right ? side(right) : undefined}
                  slots={season.league.roster_positions.filter(
                    (slot) => !["BN", "IR"].includes(slot),
                  )}
                />
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon="calendar"
              title="No games this week"
              description="Sleeper has not published matchup data for this week."
            />
          </Card>
        )}
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader title="Matchups" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
