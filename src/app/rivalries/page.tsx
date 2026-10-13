import { RivalryPicker } from "@/components/rivalry-picker";
import type { Metadata } from "next";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Stat,
} from "@/components/ui";
import { formatPoints } from "@/lib/calculations";
import {
  getAllWeeks,
  getSeasonBundle,
  getSeasonChain,
  getTransactions,
} from "@/lib/sleeper";
import type { SeasonBundle } from "@/lib/types";

export const metadata: Metadata = { title: "League Rivalries" };
export const dynamic = "force-dynamic";

async function loadBundles() {
  const leagues = await getSeasonChain();
  return Promise.all(
    leagues.map((league) => getSeasonBundle(league.league_id)),
  );
}

async function loadSeasonWeeks(bundles: SeasonBundle[]) {
  return Promise.all(
    bundles.map(async (bundle) => ({
      league: bundle.league,
      teams: bundle.teams,
      weeks: await getAllWeeks(bundle.league).catch(() => []),
    })),
  );
}

async function loadTransactions(bundle: SeasonBundle) {
  const end = Math.min(18, Math.max(1, bundle.league.settings.leg || 17));
  const weeks = await Promise.all(
    Array.from({ length: end }, (_, index) =>
      getTransactions(bundle.league.league_id, index + 1, true).catch(() => []),
    ),
  );
  return weeks.flat();
}

export default async function RivalriesPage({
  searchParams,
}: {
  searchParams: Promise<{ p1?: string; p2?: string }>;
}) {
  try {
    const [query, bundles] = await Promise.all([searchParams, loadBundles()]);
    const people = new Map<string, string>();
    bundles.forEach((bundle) =>
      bundle.teams.forEach((team) => {
        if (team.ownerId && !people.has(team.ownerId))
          people.set(team.ownerId, team.managerName);
      }),
    );
    const ids = [...people.keys()];
    const preferredOne = ids.find(
      (id) => people.get(id)?.toLowerCase() === "ahmedalamin",
    );
    const preferredTwo = ids.find(
      (id) => people.get(id)?.toLowerCase() === "snsadat04",
    );
    const one = people.has(query.p1 || "") ? query.p1! : preferredOne || ids[0];
    const two =
      people.has(query.p2 || "") && query.p2 !== one
        ? query.p2!
        : (preferredTwo !== one ? preferredTwo : undefined) ||
          ids.find((id) => id !== one) ||
          ids[0];
    const seasons = await loadSeasonWeeks(bundles);
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let forPoints = 0;
    let against = 0;
    let games = 0;
    const history: Array<{
      season: string;
      week: number;
      one: number;
      two: number;
    }> = [];

    for (const season of seasons) {
      const teamOne = season.teams.find((team) => team.ownerId === one);
      const teamTwo = season.teams.find((team) => team.ownerId === two);
      if (!teamOne || !teamTwo) continue;
      for (const week of season.weeks.filter(
        (w) =>
          season.league.status === "complete" ||
          w.week < (season.league.settings.leg || 1),
      )) {
        const a = week.matchups.find(
          (row) => row.roster_id === teamOne.rosterId,
        );
        const b = week.matchups.find(
          (row) => row.roster_id === teamTwo.rosterId,
        );
        if (!a || !b || a.matchup_id == null || a.matchup_id !== b.matchup_id)
          continue;
        games++;
        forPoints += a.points;
        against += b.points;
        if (a.points > b.points) wins++;
        else if (a.points < b.points) losses++;
        else ties++;
        history.push({
          season: season.league.season,
          week: week.week,
          one: a.points,
          two: b.points,
        });
      }
    }

    const tradeSets = await Promise.all(bundles.map(loadTransactions));
    let trades = 0;
    bundles.forEach((bundle, index) => {
      const a = bundle.teams.find((team) => team.ownerId === one);
      const b = bundle.teams.find((team) => team.ownerId === two);
      if (a && b) {
        trades += tradeSets[index].filter(
          (transaction) =>
            transaction.type === "trade" &&
            transaction.roster_ids.includes(a.rosterId) &&
            transaction.roster_ids.includes(b.rosterId),
        ).length;
      }
    });

    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${bundles.length} seasons compared`}
          title="League rivalries"
          description="Head-to-head records, scoring, and trade history between league managers."
        />
        <RivalryPicker
          one={one}
          two={two}
          people={ids.map((id) => ({
            id,
            name: people.get(id)!,
            avatar:
              bundles.flatMap((b) => b.teams).find((t) => t.ownerId === id)
                ?.avatarUrl ?? null,
          }))}
        />
        <Card className="panel-pad rivalry-summary">
          <div className="rivalry-head">
            <div>
              <Avatar
                src={
                  bundles.flatMap((b) => b.teams).find((t) => t.ownerId === one)
                    ?.avatarUrl
                }
                name={people.get(one) || "Manager"}
                size="lg"
              />
              <h2>{people.get(one)}</h2>
            </div>
            <div>
              <Badge tone="violet">Head to head</Badge>
              <strong>
                {wins} — {losses}
              </strong>
              <small>
                {ties} ties · {games} meetings
              </small>
            </div>
            <div>
              <Avatar
                src={
                  bundles.flatMap((b) => b.teams).find((t) => t.ownerId === two)
                    ?.avatarUrl
                }
                name={people.get(two) || "Manager"}
                size="lg"
              />
              <h2>{people.get(two)}</h2>
            </div>
          </div>
          <div className="four-col rivalry-stats">
            <Stat
              label="Win pct"
              value={games ? `${Math.round((wins / games) * 100)}%` : "—"}
              tone="aqua"
            />
            <Stat label="Points for" value={formatPoints(forPoints)} />
            <Stat label="Points against" value={formatPoints(against)} />
            <Stat label="Trades" value={trades} tone="violet" />
          </div>
        </Card>
        <div className="section-header rivalry-history-title">
          <div>
            <span className="eyebrow">Every meeting</span>
            <h2>Matchup history</h2>
          </div>
        </div>
        <Card className="rivalry-history">
          {history.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Season</th>
                    <th>Week</th>
                    <th>{people.get(one)}</th>
                    <th>{people.get(two)}</th>
                    <th>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .sort(
                      (a, b) =>
                        b.season.localeCompare(a.season) || b.week - a.week,
                    )
                    .map((game) => (
                      <tr key={`${game.season}-${game.week}`}>
                        <td>{game.season}</td>
                        <td>{game.week}</td>
                        <td>{formatPoints(game.one)}</td>
                        <td>{formatPoints(game.two)}</td>
                        <td>
                          {game.one === game.two
                            ? "Tie"
                            : game.one > game.two
                              ? people.get(one)
                              : people.get(two)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No head-to-head matchups"
              description="These managers have not faced each other in the linked seasons."
            />
          )}
        </Card>
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader title="League rivalries" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
