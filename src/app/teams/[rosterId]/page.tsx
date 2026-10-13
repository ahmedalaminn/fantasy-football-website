import type { Metadata } from "next";
import Link from "next/link";
import { ActivityList, PlayerRow } from "@/components/league-ui";
import { Icon } from "@/components/icon";
import {
  Avatar,
  Badge,
  Card,
  ErrorState,
  PageHeader,
  SectionHeader,
  Stat,
} from "@/components/ui";
import { formatPoints } from "@/lib/calculations";
import { leagueContent } from "@/lib/content";
import { getChampions } from "@/lib/history";
import {
  getCurrentSeason,
  getPlayers,
  getRecentTransactions,
  getSeasonBundle,
  getSeasonChain,
} from "@/lib/sleeper";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ rosterId: string }>;
}): Promise<Metadata> {
  const { rosterId } = await params;
  return { title: `Team ${rosterId}` };
}
export default async function TeamPage({
  params,
}: {
  params: Promise<{ rosterId: string }>;
}) {
  try {
    const rosterId = Number((await params).rosterId);
    const season = await getCurrentSeason();
    const team = season.teams.find((entry) => entry.rosterId === rosterId);
    if (!team)
      throw new Error(
        "This roster could not be found in the configured league.",
      );
    const week = Math.min(18, Math.max(1, season.league.settings.leg || 1));
    const [players, transactions, champions, seasons] = await Promise.all([
      getPlayers().catch(() => ({})),
      getRecentTransactions(season.league, week, 30).catch(() => []),
      getChampions().catch(() => []),
      getSeasonChain(),
    ]);
    const ownerChampionships = champions.filter(
      (entry) =>
        entry.champion.ownerId && entry.champion.ownerId === team.ownerId,
    );
    const history = (
      await Promise.all(
        seasons.map((league) => getSeasonBundle(league.league_id)),
      )
    ).flatMap((bundle) => {
      const old = team.ownerId
        ? bundle.teams.find((entry) => entry.ownerId === team.ownerId)
        : null;
      return old ? [{ season: bundle.league.season, team: old }] : [];
    });
    const profile = team.ownerId
      ? leagueContent.managerProfiles[team.ownerId]
      : undefined;
    const bench = team.players.filter(
      (id) =>
        !team.starters.includes(id) &&
        !team.reserve.includes(id) &&
        !team.taxi.includes(id),
    );
    const recent = transactions.filter((entry) =>
      entry.roster_ids.includes(team.rosterId),
    );
    return (
      <div className="content-wrap team-profile">
        <Link href="/teams" className="back-link">
          ‹ All teams
        </Link>
        <PageHeader
          eyebrow={`${season.league.season} franchise`}
          title={team.teamName}
        />
        <div className="profile-hero">
          <Card className="profile-card" accent="violet">
            <Avatar
              src={team.avatarUrl}
              name={team.managerName}
              size="xl"
              ring
            />
            <div>
              <Badge tone="violet">Manager profile</Badge>
              <h2>{team.managerName}</h2>
              {profile?.bio && <p>{profile.bio}</p>}
              {profile && (
                <div className="profile-tags">
                  {profile.favoriteTeam && (
                    <Badge>Fan of {profile.favoriteTeam}</Badge>
                  )}
                  {profile.philosophy && (
                    <Badge tone="aqua">{profile.philosophy}</Badge>
                  )}
                </div>
              )}
            </div>
            <div className="profile-stats">
              <Stat label="Record" value={`${team.wins}-${team.losses}`} />
              <Stat
                label="Points"
                value={formatPoints(team.pointsFor)}
                tone="aqua"
              />
              <Stat
                label="Titles"
                value={ownerChampionships.length}
                tone="violet"
              />
            </div>
          </Card>
        </div>
        <div className="grid-main">
          <div className="stack">
            <div>
              <SectionHeader kicker="Active lineup" title="Starters" />
              <Card className="panel-pad">
                <div className="two-col">
                  {team.starters.map((id) => (
                    <PlayerRow
                      key={id}
                      playerId={id}
                      players={players}
                      starter
                    />
                  ))}
                </div>
              </Card>
            </div>
            <div>
              <SectionHeader kicker="Depth chart" title="Bench & reserve" />
              <Card className="panel-pad">
                <div className="two-col">
                  {bench.map((id) => (
                    <PlayerRow key={id} playerId={id} players={players} />
                  ))}
                  {team.reserve.map((id) => (
                    <PlayerRow key={id} playerId={id} players={players} />
                  ))}
                </div>
              </Card>
            </div>
          </div>
          <div className="stack">
            <div>
              <SectionHeader
                kicker="Across seasons"
                title="Franchise history"
              />
              <Card className="history-list">
                {history.map((entry) => (
                  <div className="history-row" key={entry.season}>
                    <strong>{entry.season}</strong>
                    <span>
                      {entry.team.teamName}
                      <small>
                        {entry.team.wins}-{entry.team.losses} ·{" "}
                        {formatPoints(entry.team.pointsFor)} PF
                      </small>
                    </span>
                  </div>
                ))}
              </Card>
            </div>
            {ownerChampionships.length > 0 && (
              <div>
                <SectionHeader kicker="Trophy case" title="Championships" />
                <Card className="panel-pad">
                  <div className="title-years">
                    {ownerChampionships.map((entry) => (
                      <Badge tone="aqua" key={entry.season}>
                        <Icon name="trophy" /> {entry.season}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </div>
            )}
            <div>
              <SectionHeader kicker="Latest moves" title="Recent activity" />
              <Card>
                <ActivityList
                  transactions={recent.slice(0, 2)}
                  teams={season.teams}
                  players={players}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap team-profile">
        <PageHeader title="Team profile" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
