import type { Metadata } from "next";
import Link from "next/link";
import { ActivityList } from "@/components/league-ui";
import { Badge, Card, ErrorState, PageHeader } from "@/components/ui";
import {
  getCurrentSeason,
  getNflState,
  getPlayers,
  getTransactions,
} from "@/lib/sleeper";

export const metadata: Metadata = { title: "League Activity" };
export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; type?: string }>;
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
    const query = await searchParams;
    const parsed = Number(query.week);
    const week =
      Number.isInteger(parsed) && parsed >= 1 && parsed <= current
        ? parsed
        : current;
    const type = ["all", "trade", "waiver", "free_agent"].includes(
      query.type ?? "",
    )
      ? query.type!
      : "all";
    const [transactions, players] = await Promise.all([
      getTransactions(
        season.league.league_id,
        week,
        season.league.status === "complete",
      ),
      getPlayers().catch(() => ({})),
    ]);
    const successful = transactions.filter(
      (item) => item.type !== "waiver" || item.status === "complete",
    );
    const filtered =
      type === "all"
        ? successful
        : successful.filter((item) => item.type === type);
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${season.league.season} transaction wire`}
          title="League activity"
          description="Trades, waivers, adds, and drops—every move that changed the league."
        />
        <div className="filter-bar">
          <div className="week-nav">
            {Array.from({ length: current }, (_, i) => i + 1).map((number) => (
              <Link
                key={number}
                className={week === number ? "active" : ""}
                href={`/activity?week=${number}&type=${type}`}
              >
                {number}
              </Link>
            ))}
          </div>
          <div className="tabs compact-tabs">
            {[
              { id: "all", label: "All" },
              { id: "trade", label: "Trades" },
              { id: "waiver", label: "Waivers" },
              { id: "free_agent", label: "Adds & drops" },
            ].map((item) => (
              <Link
                key={item.id}
                className={type === item.id ? "active" : ""}
                href={`/activity?week=${week}&type=${item.id}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="section-header">
          <div>
            <span className="eyebrow">Transaction log</span>
            <h2>Week {week}</h2>
          </div>
          <Badge tone="aqua">{filtered.length} moves</Badge>
        </div>
        <Card>
          <ActivityList
            key={`${week}-${type}`}
            transactions={filtered.sort(
              (a, b) => b.status_updated - a.status_updated,
            )}
            teams={season.teams}
            players={players}
          />
        </Card>
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader title="League activity" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
