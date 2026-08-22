import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Avatar,
  Badge,
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
import { leagueContent } from "@/lib/content";
import { getChampions } from "@/lib/history";
import {
  getAllWeeks,
  getDraftPicks,
  getDrafts,
  getPlayers,
  getSeasonBundle,
  getSeasonChain,
  getTransactions,
} from "@/lib/sleeper";
import type { SeasonBundle, SleeperPlayer } from "@/lib/types";
import { SleeperPlayerLink } from "@/components/sleeper-player-link";

export const metadata: Metadata = { title: "League History" };
export const dynamic = "force-dynamic";
const tabs = [
  { id: "champions", label: "Champions" },
  { id: "awards", label: "Awards" },
  { id: "records", label: "Records" },
  { id: "drafts", label: "Drafts" },
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
  }>;
}) {
  try {
    const query = await searchParams;
    const active = tabs.some((item) => item.id === query.tab)
      ? query.tab!
      : "champions";
    const [champions, bundles] = await Promise.all([
      getChampions().catch(() => []),
      loadBundles(),
    ]);
    const selected =
      bundles.find((bundle) => bundle.league.season === query.season) ||
      bundles[0];
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${bundles.length} seasons archived`}
          title="League history"
          description="Championships, records, and draft nights from across the league."
        />
        <Tabs items={tabs} active={active} basePath="/history" />
        {active === "champions" && <Champions champions={champions} />}{" "}
        {active === "awards" && <Awards champions={champions} />}{" "}
        {active === "records" && (
          <Records bundles={bundles} champions={champions} />
        )}{" "}
        {active === "drafts" && selected && (
          <Drafts bundles={bundles} selected={selected} />
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

function Champions({
  champions,
}: {
  champions: Awaited<ReturnType<typeof getChampions>>;
}) {
  if (!champions.length)
    return (
      <Card>
        <EmptyState
          icon="trophy"
          title="No completed championships found"
          description="The Hall will populate from each linked season's playoff bracket."
        />
      </Card>
    );
  return (
    <div className="champion-grid">
      {champions.map((entry) => (
        <Card className="legacy-card" key={entry.leagueId}>
          <div className="legacy-year">
            <Badge tone="aqua">League champion</Badge>
            <strong>{entry.season}</strong>
          </div>
          <div className="legacy-winner">
            <Avatar
              src={entry.champion.avatarUrl}
              name={entry.champion.managerName}
              size="xl"
              ring
            />
            <div>
              <h2>{entry.champion.teamName}</h2>
              <p>
                {entry.champion.managerName} ·{" "}
                {entry.titleCount === 1
                  ? "First title"
                  : `${entry.titleCount}× champion`}
              </p>
              {leagueContent.championStories[entry.season] && (
                <p className="champion-story">
                  {leagueContent.championStories[entry.season]}
                </p>
              )}
            </div>
          </div>
          <div className="legacy-footer">
            <div>
              <span>Record</span>
              <strong>
                {entry.champion.wins}-{entry.champion.losses}
              </strong>
            </div>
            <div>
              <span>Points for</span>
              <strong>{formatPoints(entry.champion.pointsFor)}</strong>
            </div>
            <div>
              <span>Runner-up</span>
              <strong>{entry.runnerUp?.managerName || "—"}</strong>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Awards({
  champions,
}: {
  champions: Awaited<ReturnType<typeof getChampions>>;
}) {
  return (
    <div className="award-section">
      {champions.map((entry) => (
        <Card className="award-season" key={entry.leagueId}>
          <h2>{entry.season} Award Cabinet</h2>
          <div className="award-grid">
            <Award label="League champion" team={entry.champion} />
            <Award label="Runner-up" team={entry.runnerUp} />
            <Award label="Third place" team={entry.thirdPlace} />
            <Award
              label="Regular-season winner"
              team={entry.regularSeasonChampion}
            />
            <Award label="Last-place finisher" team={entry.lastPlace} />
            <div className="award">
              <span>Legacy</span>
              <strong>
                {entry.titleCount} career title
                {entry.titleCount === 1 ? "" : "s"}
              </strong>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
function Award({
  label,
  team,
}: {
  label: string;
  team: import("@/lib/types").Team | null;
}) {
  return (
    <div className="award">
      <span>{label}</span>
      <strong>{team ? team.teamName : "Not available"}</strong>
      {team && <small>{team.managerName}</small>}
    </div>
  );
}

async function Records({
  bundles,
  champions,
}: {
  bundles: SeasonBundle[];
  champions: Awaited<ReturnType<typeof getChampions>>;
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
      <div className="four-col">
        {records.map((record) => (
          <Card className="record-card" key={record.label}>
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
            <h3>{Math.round(efficiency.components.lineupEfficiency * 100)}%</h3>
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
      <div>
        <div className="section-header">
          <div>
            <span className="eyebrow">All-time totals</span>
            <h2>Manager leaderboard</h2>
          </div>
        </div>
        <Card>
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
                      <span className={`rank-number ${index < 3 ? "top" : ""}`}>
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
    </div>
  );
}

async function Drafts({
  bundles,
  selected,
}: {
  bundles: SeasonBundle[];
  selected: SeasonBundle;
}) {
  const drafts = await getDrafts(selected.league.league_id).catch(() => []);
  const draft = drafts[0];
  const [picks, players] = await Promise.all([
    draft ? getDraftPicks(draft.draft_id).catch(() => []) : [],
    getPlayers().catch(() => ({}) as Record<string, SleeperPlayer>),
  ]);
  const rounds =
    draft?.settings.rounds || Math.max(0, ...picks.map((pick) => pick.round));
  const slots = draft?.settings.teams || selected.league.total_rosters;
  return (
    <div>
      <SeasonLinks
        bundles={bundles}
        selected={selected.league.season}
        tab="drafts"
      />
      {draft ? (
        <Card>
          <div className="draft-meta panel-pad">
            <div>
              <Badge tone="violet">{draft.status}</Badge>
              <h2>{selected.league.season} Draft</h2>
              <p>
                {draft.type} · {rounds} rounds · {slots} teams
              </p>
            </div>
          </div>
          <div
            className="draft-board"
            style={{ "--team-count": slots } as CSSProperties}
          >
            {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
              <div className="draft-round" key={round}>
                <div className="draft-round-label">RD {round}</div>
                {Array.from({ length: slots }, (_, i) => i + 1).map((slot) => {
                  const pick = picks.find(
                    (entry) =>
                      entry.round === round && entry.draft_slot === slot,
                  );
                  const player = pick ? players[pick.player_id] : null;
                  const playerName = pick
                    ? player?.full_name ||
                      [pick.metadata?.first_name, pick.metadata?.last_name]
                        .filter(Boolean)
                        .join(" ") ||
                      pick.player_id
                    : "";
                  const team = pick
                    ? selected.teams.find(
                        (entry) => entry.rosterId === pick.roster_id,
                      )
                    : null;
                  return (
                    <div className="draft-pick" key={slot}>
                      {pick ? (
                        <>
                          <strong>
                            <SleeperPlayerLink
                              id={pick.player_id}
                              name={playerName}
                              position={
                                player?.position || pick.metadata?.position
                              }
                            />
                          </strong>
                          <small>
                            {player?.position || pick.metadata?.position} ·{" "}
                            {team?.managerName || "Unknown"}
                          </small>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="No draft found"
            description="Sleeper did not return a draft for this season."
          />
        </Card>
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
