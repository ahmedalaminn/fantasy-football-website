import { InfoPopover } from "@/components/info-popover";
import type { Metadata } from "next";
import { StandingsTable } from "@/components/league-ui";
import {
  Card,
  ErrorState,
  PageHeader,
  SectionHeader,
  Tabs,
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
export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const view = (await searchParams).view === "power" ? "power" : "official";
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
        <Tabs
          items={[
            { id: "official", label: "Official standings" },
            { id: "power", label: "Power rankings" },
          ]}
          active={view}
          basePath="/standings"
          param="view"
        />
        <div className="stack standings-view">
          {view === "official" && (
            <div>
              <SectionHeader
                kicker="Official Sleeper order"
                title="League table"
              />
              <Card>
                <StandingsTable rows={table} />
              </Card>
            </div>
          )}
          {view === "power" && (
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
              <Card>
                {power.length ? (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Team</th>
                          <th>Score</th>
                          <th>Movement</th>
                          <th>Points</th>
                          <th>Win %</th>
                          <th>All-play %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {power.map((entry) => (
                          <tr key={entry.rosterId}>
                            <td>
                              <span className="rank-number top">
                                {entry.rank}
                              </span>
                            </td>
                            <td>
                              <TeamIdentity team={entry.team} compact />
                            </td>
                            <td>
                              <strong>{entry.score}</strong>
                            </td>
                            <td>
                              {entry.movement > 0
                                ? `↑ ${entry.movement}`
                                : entry.movement < 0
                                  ? `↓ ${Math.abs(entry.movement)}`
                                  : "—"}
                            </td>
                            <td>{entry.components.totalPoints.toFixed(1)}</td>
                            <td>
                              {Math.round(entry.components.winPercentage * 100)}
                              %
                            </td>
                            <td>
                              {Math.round(
                                entry.components.allPlayWinPercentage * 100,
                              )}
                              %
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <h3>Awaiting results</h3>
                    <p>Power rankings unlock after the first completed week.</p>
                  </div>
                )}
              </Card>
            </div>
          )}
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
