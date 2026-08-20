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
  Stat,
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

export const metadata: Metadata = { title: "League History" };
export const dynamic = "force-dynamic";
const tabs = [
  { id: "champions", label: "Champions" },
  { id: "awards", label: "Awards" },
  { id: "records", label: "Records" },
  { id: "drafts", label: "Drafts" },
  { id: "rivalries", label: "Rivalries" },
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
    p1?: string;
    p2?: string;
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
          description="Championships, records, draft nights, and the matchups that built the league."
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
        {active === "rivalries" && (
          <Rivalries bundles={bundles} p1={query.p1} p2={query.p2} />
        )}
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
                            {player?.full_name ||
                              pick.metadata?.first_name +
                                " " +
                                pick.metadata?.last_name ||
                              pick.player_id}
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

async function Rivalries({
  bundles,
  p1,
  p2,
}: {
  bundles: SeasonBundle[];
  p1?: string;
  p2?: string;
}) {
  const people = new Map<string, string>();
  bundles.forEach((bundle) =>
    bundle.teams.forEach((team) => {
      if (team.ownerId) people.set(team.ownerId, team.managerName);
    }),
  );
  const ids = [...people.keys()];
  const one = people.has(p1 || "") ? p1! : ids[0];
  const two =
    people.has(p2 || "") && p2 !== one
      ? p2!
      : ids.find((id) => id !== one) || ids[0];
  const seasons = await loadSeasonWeeks(bundles);
  let wins = 0,
    losses = 0,
    ties = 0,
    forPoints = 0,
    against = 0,
    games = 0;
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
    for (const week of season.weeks) {
      const a = week.matchups.find((row) => row.roster_id === teamOne.rosterId);
      const b = week.matchups.find((row) => row.roster_id === teamTwo.rosterId);
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
    if (a && b)
      trades += tradeSets[index].filter(
        (tx) =>
          tx.type === "trade" &&
          tx.roster_ids.includes(a.rosterId) &&
          tx.roster_ids.includes(b.rosterId),
      ).length;
  });
  return (
    <div>
      <form className="rival-selects" action="/history">
        <input type="hidden" name="tab" value="rivalries" />
        <label>
          <span>Manager one</span>
          <select name="p1" defaultValue={one}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {people.get(id)}
              </option>
            ))}
          </select>
        </label>
        <span className="rival-vs">VS</span>
        <label>
          <span>Manager two</span>
          <select name="p2" defaultValue={two}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {people.get(id)}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-primary" type="submit">
          Compare
        </button>
      </form>
      <Card className="panel-pad">
        <div className="rivalry-head">
          <div>
            <Avatar name={people.get(one) || "Manager"} size="lg" />
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
            <Avatar name={people.get(two) || "Manager"} size="lg" />
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
      <Card>
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
}
