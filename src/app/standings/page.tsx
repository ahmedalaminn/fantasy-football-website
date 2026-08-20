import type { Metadata } from "next";
import { StandingsTable } from "@/components/league-ui";
import {
  Badge,
  Card,
  ErrorState,
  PageHeader,
  SectionHeader,
  Stat,
  TeamIdentity,
} from "@/components/ui";
import { powerRankings, standings } from "@/lib/calculations";
import {
  getAllWeeks,
  getCurrentSeason,
  getNflState,
  getPlayers,
} from "@/lib/sleeper";

export const metadata: Metadata = { title: "Standings" };
export const dynamic = "force-dynamic";
export default async function StandingsPage() {
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
    const [weeks, players] = await Promise.all([
      getAllWeeks(season.league).catch(() => []),
      getPlayers().catch(() => ({})),
    ]);
    const table = standings(
      season.teams,
      season.league.settings.playoff_teams ?? 6,
    );
    const power = powerRankings(
      season.teams,
      weeks,
      week,
      season.league,
      players,
    );
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${season.league.season} season`}
          title="Standings"
          description="The official Sleeper table and a performance-based view of who is really moving."
        />
        <div className="stack">
          <div>
            <SectionHeader
              kicker="Official Sleeper order"
              title="League table"
            />
            <Card>
              <StandingsTable rows={table} />
            </Card>
          </div>
          <div>
            <SectionHeader
              kicker={`Through Week ${week}`}
              title="Power rankings"
            />
            <Card className="panel-pad">
              <div className="formula">
                <Badge tone="violet">Transparent formula</Badge>
                <p>
                  <strong>35%</strong> win percentage · <strong>30%</strong>{" "}
                  points per game · <strong>20%</strong> last-three scoring ·{" "}
                  <strong>15%</strong> lineup efficiency
                </p>
              </div>
              {power.length ? (
                <div className="power-grid">
                  {power.map((entry) => (
                    <div className="power-card" key={entry.rosterId}>
                      <span className="rank-number top">
                        {String(entry.rank).padStart(2, "0")}
                      </span>
                      <TeamIdentity team={entry.team} />
                      <div className="power-total">
                        <strong>{entry.score}</strong>
                        <small>Power score</small>
                      </div>
                      <div className="power-components">
                        <Stat
                          label="Win pct"
                          value={`${Math.round(entry.components.winPercentage * 100)}%`}
                        />
                        <Stat
                          label="PPG"
                          value={entry.components.pointsPerGame.toFixed(1)}
                          tone="aqua"
                        />
                        <Stat
                          label="Last 3"
                          value={entry.components.recentForm.toFixed(1)}
                        />
                        <Stat
                          label="Efficiency"
                          value={`${Math.round(entry.components.lineupEfficiency * 100)}%`}
                          tone="violet"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>Awaiting results</h3>
                  <p>Power rankings unlock after the first completed week.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader title="Standings" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
