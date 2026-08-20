import type { Metadata } from "next";
import {
  ActivityList,
  ChampionMini,
  MatchupList,
  StandingsTable,
} from "@/components/league-ui";
import { Icon } from "@/components/icon";
import {
  Badge,
  Card,
  ErrorState,
  PageHeader,
  SectionHeader,
  TeamIdentity,
} from "@/components/ui";
import { pairMatchups, powerRankings, standings } from "@/lib/calculations";
import { leagueContent } from "@/lib/content";
import { getChampions } from "@/lib/history";
import {
  getAllWeeks,
  getCurrentSeason,
  getMatchups,
  getNflState,
  getPlayers,
  getRecentTransactions,
} from "@/lib/sleeper";

export const metadata: Metadata = { title: "League Dashboard" };
export const dynamic = "force-dynamic";
const statusLabel: Record<string, string> = {
  pre_draft: "Preseason",
  drafting: "Drafting",
  in_season: "In season",
  post_season: "Playoffs",
  complete: "Season complete",
};

export default async function Home() {
  try {
    const season = await getCurrentSeason();
    const nfl = await getNflState().catch(() => null);
    const week = Math.min(
      18,
      Math.max(
        1,
        season.league.settings.leg ||
          (nfl?.season === season.league.season ? nfl.week : 1),
      ),
    );
    const [matchupRows, allWeeks, players, transactions, champions] =
      await Promise.all([
        getMatchups(
          season.league.league_id,
          week,
          season.league.status === "complete",
        ).catch(() => []),
        getAllWeeks(season.league).catch(() => []),
        getPlayers().catch(() => ({})),
        getRecentTransactions(season.league, week).catch(() => []),
        getChampions().catch(() => []),
      ]);
    const table = standings(
      season.teams,
      season.league.settings.playoff_teams ?? 6,
    );
    const matchups = pairMatchups(
      matchupRows,
      season.teams,
      season.league.status === "complete",
    );
    const rankings = powerRankings(
      season.teams,
      allWeeks,
      week,
      season.league,
      players,
    );
    const champion = champions[0];
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${season.league.season} season · Week ${week}`}
          title="League command center"
          description="Scores, movement, and the latest storylines from UD Fantasy Football."
          actions={
            <a
              className="button button-primary"
              href={`https://sleeper.com/leagues/${season.league.league_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open Sleeper <Icon name="external" />
            </a>
          }
        />
        <div className="grid-main reveal-delay">
          <div className="stack">
            <Card className="hero" accent="violet">
              <div className="hero-copy">
                <Badge
                  tone={
                    season.league.status === "in_season" ? "good" : "violet"
                  }
                >
                  {statusLabel[season.league.status] || season.league.status}
                </Badge>
                <h2>{season.league.name}</h2>
                <p>{leagueContent.introduction}</p>
                <div className="hero-meta">
                  <Badge>{season.league.total_rosters} teams</Badge>
                  <Badge>
                    {season.league.settings.playoff_teams ?? 6} playoff spots
                  </Badge>
                  <Badge tone="aqua">Season {season.league.season}</Badge>
                </div>
              </div>
              <div className="hero-orbit" aria-hidden="true" />
            </Card>
            <div>
              <SectionHeader
                kicker={`Week ${week}`}
                title="Matchup pulse"
                href="/matchups"
              />
              <Card>
                <MatchupList matchups={matchups} limit={5} />
              </Card>
            </div>
            <div>
              <SectionHeader
                kicker="Official order"
                title="Standings"
                href="/standings"
              />
              <Card>
                <StandingsTable rows={table} compact />
              </Card>
            </div>
          </div>
          <div className="stack">
            {champion && (
              <div>
                <SectionHeader
                  kicker="League royalty"
                  title="Reigning champion"
                  href="/history"
                  action="Hall of Champions"
                />
                <Card accent="aqua">
                  <ChampionMini champion={champion} />
                </Card>
              </div>
            )}
            <div>
              <SectionHeader
                kicker="Calculated weekly"
                title="Power rankings"
                href="/standings"
                action="See formula"
              />
              <Card>
                {rankings.length ? (
                  <div className="ranking-list">
                    {rankings.slice(0, 6).map((entry) => (
                      <div className="ranking-row" key={entry.rosterId}>
                        <span
                          className={`rank-number ${entry.rank <= 3 ? "top" : ""}`}
                        >
                          {entry.rank}
                        </span>
                        <TeamIdentity team={entry.team} compact />
                        <span
                          className={`movement ${entry.movement > 0 ? "up" : entry.movement < 0 ? "down" : ""}`}
                        >
                          {entry.movement > 0
                            ? `▲ ${entry.movement}`
                            : entry.movement < 0
                              ? `▼ ${Math.abs(entry.movement)}`
                              : "—"}
                        </span>
                        <span className="power-score">
                          <strong>{entry.score}</strong>
                          <small>Power</small>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Icon name="spark" />
                    </span>
                    <h3>Rankings start after Week 1</h3>
                    <p>
                      Once a matchup is complete, the formula will combine
                      record, scoring, recent form, and lineup efficiency.
                    </p>
                  </div>
                )}
              </Card>
            </div>
            <div>
              <SectionHeader
                kicker="League wire"
                title="Recent activity"
                href="/activity"
              />
              <Card>
                <ActivityList
                  transactions={transactions}
                  teams={season.teams}
                  players={players}
                  limit={5}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow="League HQ"
          title="UD Fantasy Football"
          description="Your league command center is ready to reconnect."
        />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
