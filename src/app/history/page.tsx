import { redirect } from "next/navigation";
import { Icon } from "@/components/icon";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Tabs,
} from "@/components/ui";
import {
  formatPoints,
  matchupRecords,
  powerRankings,
} from "@/lib/calculations";
import { getChampions } from "@/lib/history";
import {
  getAllWeeks,
  getPlayers,
  getSeasonBundle,
  getSeasonChain,
  getTransactions,
} from "@/lib/sleeper";
import type { SeasonBundle, SleeperPlayer } from "@/lib/types";

export const metadata: Metadata = { title: "League History" };
export const dynamic = "force-dynamic";
const tabs = [
  { id: "awards", label: "Awards" },
  { id: "records", label: "Records" },
];

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
    Array.from({ length: end }, (_, i) =>
      getTransactions(bundle.league.league_id, i + 1, true).catch(() => []),
    ),
  );
  return weeks.flat();
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    season?: string;
    records?: string;
  }>;
}) {
  const query = await searchParams;
  if (query.tab === "drafts")
    redirect(
      query.season
        ? `/drafts?season=${encodeURIComponent(query.season)}`
        : "/drafts",
    );
  try {
    const active = tabs.some((item) => item.id === query.tab)
      ? query.tab!
      : "awards";
    const [champions, bundles] = await Promise.all([
      getChampions().catch(() => []),
      loadBundles(),
    ]);
    const selected =
      bundles.find((bundle) => bundle.league.season === query.season) ||
      (active === "awards"
        ? bundles.find(
            (bundle) => bundle.league.season === champions[0]?.season,
          )
        : null) ||
      bundles[0];
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${bundles.length} seasons archived`}
          title="League history"
          description="Championships, records, and draft nights from across the league."
        />
        <Tabs items={tabs} active={active} basePath="/history" />
        {active === "awards" && (
          <>
            <SeasonLinks
              bundles={bundles}
              selected={selected?.league.season || ""}
              tab="awards"
            />
            <Awards
              champions={champions.filter(
                (entry) => entry.season === selected?.league.season,
              )}
            />
          </>
        )}{" "}
        {active === "records" && (
          <Records
            bundles={bundles}
            champions={champions}
            view={query.records === "managers" ? "managers" : "highlights"}
          />
        )}{" "}
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader title="League history" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}

function Awards({
  champions,
}: {
  champions: Awaited<ReturnType<typeof getChampions>>;
}) {
  if (!champions.length)
    return (
      <Card>
        <EmptyState
          icon="trophy"
          title="Awards await the season finish"
          description="Choose a completed season to explore its award cabinet."
        />
      </Card>
    );
  return (
    <div className="award-section">
      {champions.map((entry) => (
        <Card className="award-season" key={entry.leagueId}>
          <h2>{entry.season} Award Cabinet</h2>
          <div className="awards-podium" aria-label="Season podium">
            <PodiumPlace place={2} team={entry.runnerUp} />
            <PodiumPlace place={1} team={entry.champion} />
            <PodiumPlace place={3} team={entry.thirdPlace} />
          </div>
          <div className="season-honors">
            <SeasonHonor kind="last" team={entry.lastPlace} />
            <SeasonHonor kind="regular" team={entry.regularSeasonChampion} />
          </div>
        </Card>
      ))}
    </div>
  );
}
function PodiumPlace({
  place,
  team,
}: {
  place: 1 | 2 | 3;
  team: import("@/lib/types").Team | null;
}) {
  const title =
    place === 1 ? "League champion" : place === 2 ? "Runner-up" : "Third place";
  return (
    <article
      className={`podium-place podium-place-${place}`}
      aria-label={`${place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"} place: ${team?.teamName || "Not available"}`}
    >
      <div className="podium-person">
        <span className="podium-medal" aria-hidden="true">
          {place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}
        </span>
        {team && (
          <Avatar
            src={team.avatarUrl}
            name={team.managerName}
            size="lg"
            ring={place === 1}
          />
        )}
        <strong>{team?.teamName || "Not available"}</strong>
        {team && <small>{team.managerName}</small>}
      </div>
      <div className="podium-step">
        <span>{place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}</span>
        <strong>{title}</strong>
      </div>
    </article>
  );
}
function SeasonHonor({
  kind,
  team,
}: {
  kind: "last" | "regular";
  team: import("@/lib/types").Team | null;
}) {
  return (
    <article className={`season-honor season-honor-${kind}`}>
      <div className="season-honor-icon">
        <Icon name={kind === "last" ? "toilet" : "flag"} />
      </div>
      <div className="season-honor-copy">
        <span>
          {kind === "last" ? "The porcelain throne" : "Regular-season winner"}
        </span>
        <strong>{team?.teamName || "Not available"}</strong>
        <small>
          {team?.managerName || ""}
          {team ? " · " : ""}
          {kind === "last"
            ? "Last-place finisher"
            : "Regular-season honors · Before the playoffs"}
        </small>
      </div>
      {team && (
        <Avatar src={team.avatarUrl} name={team.managerName} size="sm" />
      )}
    </article>
  );
}

async function Records({
  bundles,
  champions,
  view,
}: {
  bundles: SeasonBundle[];
  champions: Awaited<ReturnType<typeof getChampions>>;
  view: "highlights" | "managers";
}) {
  const [seasons, players, transactionSets] = await Promise.all([
    loadSeasonWeeks(bundles),
    getPlayers().catch(() => ({}) as Record<string, SleeperPlayer>),
    Promise.all(bundles.map(loadTransactions)),
  ]);
  const records = matchupRecords(seasons);
  const totals = new Map<
    string,
    {
      name: string;
      wins: number;
      losses: number;
      points: number;
      seasons: number;
      transactions: number;
    }
  >();
  bundles.forEach((bundle, index) =>
    bundle.teams.forEach((team) => {
      if (!team.ownerId) return;
      const old = totals.get(team.ownerId) || {
        name: team.managerName,
        wins: 0,
        losses: 0,
        points: 0,
        seasons: 0,
        transactions: 0,
      };
      old.wins += team.wins;
      old.losses += team.losses;
      old.points += team.pointsFor;
      old.seasons += 1;
      old.transactions += transactionSets[index].filter((item) =>
        item.roster_ids.includes(team.rosterId),
      ).length;
      totals.set(team.ownerId, old);
    }),
  );
  const managers = [...totals.entries()].sort(
    (a, b) => b[1].wins - a[1].wins || b[1].points - a[1].points,
  );
  const bestSeason = bundles
    .flatMap((bundle) =>
      bundle.teams.map((team) => ({ team, season: bundle.league.season })),
    )
    .sort((a, b) => b.team.pointsFor - a.team.pointsFor)[0];
  const efficiency = seasons
    .flatMap((season) =>
      powerRankings(
        season.teams,
        season.weeks,
        season.weeks.at(-1)?.week || 0,
        season.league,
        players,
      ),
    )
    .sort(
      (a, b) => b.components.lineupEfficiency - a.components.lineupEfficiency,
    )[0];
  const mostActive = managers
    .slice()
    .sort((a, b) => b[1].transactions - a[1].transactions)[0];
  return (
    <div className="stack">
      <Tabs
        items={[
          { id: "highlights", label: "Record holders" },
          { id: "managers", label: "Manager leaderboard" },
        ]}
        active={view}
        basePath="/history?tab=records"
        param="records"
      />
      {view === "highlights" && (
        <div className="four-col record-gallery">
          {records.map((record) => (
            <Card className="record-card" key={record.label}>
              <Avatar
                src={
                  bundles
                    .flatMap((bundle) => bundle.teams)
                    .find((team) => team.managerName === record.manager)
                    ?.avatarUrl
                }
                name={record.manager}
                size="sm"
              />
              <Icon name="standings" />
              <span>{record.label}</span>
              <h3>{record.value}</h3>
              <p>{record.teamName}</p>
              <small>
                {record.manager} · {record.season} Week {record.week}
              </small>
            </Card>
          ))}
          {bestSeason && (
            <Card className="record-card">
              <span>Highest season total</span>
              <h3>{formatPoints(bestSeason.team.pointsFor)}</h3>
              <p>{bestSeason.team.teamName}</p>
              <small>
                {bestSeason.team.managerName} · {bestSeason.season}
              </small>
            </Card>
          )}
          {efficiency && (
            <Card className="record-card">
              <span>Best lineup efficiency</span>
              <h3>
                {Math.round(efficiency.components.lineupEfficiency * 100)}%
              </h3>
              <p>{efficiency.team.teamName}</p>
              <small>Best full-season rate</small>
            </Card>
          )}
          {mostActive && (
            <Card className="record-card">
              <span>Most transactions</span>
              <h3>{mostActive[1].transactions}</h3>
              <p>{mostActive[1].name}</p>
              <small>Across {mostActive[1].seasons} seasons</small>
            </Card>
          )}
        </div>
      )}
      {view === "managers" && (
        <div>
          <div className="section-header">
            <div>
              <span className="eyebrow">All-time totals</span>
              <h2>Manager leaderboard</h2>
            </div>
          </div>
          <Card className="record-leaderboard">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Manager</th>
                    <th>Seasons</th>
                    <th>W</th>
                    <th>L</th>
                    <th>PF</th>
                    <th>Titles</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map(([id, item], index) => (
                    <tr key={id}>
                      <td>
                        <span
                          className={`rank-number ${index < 3 ? "top" : ""}`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td>{item.name}</td>
                      <td>{item.seasons}</td>
                      <td>{item.wins}</td>
                      <td>{item.losses}</td>
                      <td>{formatPoints(item.points)}</td>
                      <td>
                        {
                          champions.filter(
                            (entry) => entry.champion.ownerId === id,
                          ).length
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SeasonLinks({
  bundles,
  selected,
  tab,
}: {
  bundles: SeasonBundle[];
  selected: string;
  tab: string;
}) {
  return (
    <nav className="week-nav" aria-label="Select season">
      {bundles.map((bundle) => (
        <Link
          className={bundle.league.season === selected ? "active" : ""}
          key={bundle.league.league_id}
          href={`/history?tab=${tab}&season=${bundle.league.season}`}
        >
          {bundle.league.season}
        </Link>
      ))}
    </nav>
  );
}
