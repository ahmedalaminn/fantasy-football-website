import { InfoPopover } from "@/components/info-popover";
import type { Metadata } from "next";
import { StandingsTable } from "@/components/league-ui";
import {
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
      season.league.status === "complete" ? week : week - 1,
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
              kicker={
                season.league.status === "complete"
                  ? `Through Week ${week}`
                  : week > 1
                    ? `Through Week ${week - 1} · Completed weeks`
                    : "Awaiting Week 1 results"
              }
              title="Power rankings"
              info={
                <InfoPopover
                  title="Power ranking formula"
                  sections={[
                    {
                      title: "Three factors",
                      items: [
                        "40% points scored (PF)",
                        "40% all-play win percentage",
                        "20% head-to-head win percentage",
                      ],
                    },
                    {
                      title: "Score · 0–100 scale",
                      items: [
                        `Each category gives ${season.teams.length} rank points for first, down to 1 for last. Ties average their places.`,
                        `(2 × PF rank points + 2 × all-play rank points + record rank points) ÷ ${5 * season.teams.length} × 100.`,
                      ],
                    },
                    {
                      title: "How results count",
                      items: [
                        "Completed weeks only; scoring on byes counts. All-play compares your score with every other team; ties count as half a win.",
                        "Movement compares the previous completed week. Equal scores sort by PF, then roster ID.",
                      ],
                    },
                  ]}
                />
              }
            />
            <Card className="panel-pad">
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
                          label="Points scored"
                          value={entry.components.totalPoints.toFixed(1)}
                          tone="aqua"
                        />
                        <Stat
                          label="All-play"
                          value={`${entry.components.allPlayWins}-${entry.components.allPlayLosses}${entry.components.allPlayTies ? `-${entry.components.allPlayTies}` : ""}`}
                        />
                        <Stat
                          label="All-play win pct"
                          value={`${Math.round(entry.components.allPlayWinPercentage * 100)}%`}
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
