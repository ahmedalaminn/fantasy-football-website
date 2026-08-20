import type { Metadata } from "next";
import Link from "next/link";
import { PlayerRow } from "@/components/league-ui";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/ui";
import { pairMatchups, formatPoints } from "@/lib/calculations";
import {
  getCurrentSeason,
  getMatchups,
  getNflState,
  getPlayers,
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
      Number.isFinite(parsed) && parsed >= 1 && parsed <= 18 ? parsed : current;
    const [rows, players] = await Promise.all([
      getMatchups(
        season.league.league_id,
        week,
        season.league.status === "complete",
      ),
      getPlayers().catch(() => ({})),
    ]);
    const pairs = pairMatchups(
      rows,
      season.teams,
      season.league.status === "complete" || week < current,
    );
    const playoffStart = season.league.settings.playoff_week_start ?? 15;
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${season.league.season} season`}
          title="Matchups"
          description="Every head-to-head result, from opening week through the championship."
        />
        <nav className="week-nav" aria-label="Select week">
          {Array.from({ length: 18 }, (_, i) => i + 1).map((number) => (
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
          <div className="two-col">
            {pairs.map((pair) => {
              const [left, right] = pair.teams;
              if (!left) return null;
              const leftWin =
                right && left.matchup.points > right.matchup.points;
              const rightWin =
                right && right.matchup.points > left.matchup.points;
              return (
                <Card className="game-card" key={pair.matchupId}>
                  <div id={`matchup-${pair.matchupId}`} className="game-head">
                    <Badge tone={pair.status === "final" ? "good" : "neutral"}>
                      {pair.status}
                    </Badge>
                    <span className="eyebrow">Matchup {pair.matchupId}</span>
                  </div>
                  <div className="game-teams">
                    <div className={`game-team ${leftWin ? "winner" : ""}`}>
                      <Avatar
                        src={left.team.avatarUrl}
                        name={left.team.managerName}
                        size="lg"
                      />
                      <strong>{left.team.teamName}</strong>
                      <small>{left.team.managerName}</small>
                      <span className="game-team-score">
                        {formatPoints(left.matchup.points)}
                      </span>
                    </div>
                    <span className="vs">VS</span>
                    {right ? (
                      <div className={`game-team ${rightWin ? "winner" : ""}`}>
                        <Avatar
                          src={right.team.avatarUrl}
                          name={right.team.managerName}
                          size="lg"
                        />
                        <strong>{right.team.teamName}</strong>
                        <small>{right.team.managerName}</small>
                        <span className="game-team-score">
                          {formatPoints(right.matchup.points)}
                        </span>
                      </div>
                    ) : (
                      <div className="game-team">
                        <strong>Bye week</strong>
                      </div>
                    )}
                  </div>
                  {right && (
                    <details className="lineup">
                      <summary>View scoring breakdown</summary>
                      <div className="two-col">
                        {[left, right].map((entry) => (
                          <div key={entry.team.rosterId}>
                            {(entry.matchup.starters ?? []).map((id) => (
                              <PlayerRow
                                key={id}
                                playerId={id}
                                players={players}
                                points={entry.matchup.players_points?.[id] ?? 0}
                                starter
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </Card>
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
