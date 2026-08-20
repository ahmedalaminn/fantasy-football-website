import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar, Card, ErrorState, PageHeader, Stat } from "@/components/ui";
import { formatPoints, standings } from "@/lib/calculations";
import { getChampions } from "@/lib/history";
import { getCurrentSeason, playerImageUrl } from "@/lib/sleeper";

export const metadata: Metadata = { title: "Teams" };
export const dynamic = "force-dynamic";
export default async function TeamsPage() {
  try {
    const [season, champions] = await Promise.all([
      getCurrentSeason(),
      getChampions().catch(() => []),
    ]);
    const table = standings(
      season.teams,
      season.league.settings.playoff_teams ?? 6,
    );
    const titles = new Map<string, number>();
    champions.forEach((entry) => {
      if (entry.champion.ownerId)
        titles.set(entry.champion.ownerId, entry.titleCount);
    });
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${season.league.total_rosters} franchises`}
          title="Teams & managers"
          description="Meet the league, inspect every roster, and see who has the hardware."
        />
        <div className="team-grid">
          {table.map((team) => (
            <Link href={`/teams/${team.rosterId}`} key={team.rosterId}>
              <Card className="team-card">
                <div className="team-card-top">
                  <div className="team-identity">
                    <Avatar
                      src={team.avatarUrl}
                      name={team.managerName}
                      size="lg"
                    />
                    <span>
                      <strong>{team.teamName}</strong>
                      <small>{team.managerName}</small>
                    </span>
                  </div>
                  <span className="team-record">
                    {team.wins}-{team.losses}
                  </span>
                </div>
                <div className="team-card-stats">
                  <Stat
                    label="Standing"
                    value={`#${team.rank}`}
                    tone={team.rank <= 3 ? "aqua" : undefined}
                  />
                  <Stat label="Points" value={formatPoints(team.pointsFor)} />
                  <Stat
                    label="Titles"
                    value={team.ownerId ? (titles.get(team.ownerId) ?? 0) : 0}
                    tone="violet"
                  />
                </div>
                <div className="roster-preview">
                  {team.players.slice(0, 6).map((id) => (
                    <span className="player-thumb" key={id}>
                      <Image
                        src={playerImageUrl(id)}
                        alt=""
                        fill
                        sizes="35px"
                      />
                    </span>
                  ))}
                  {team.players.length > 6 && (
                    <span className="roster-more">
                      +{team.players.length - 6}
                    </span>
                  )}
                </div>
                <span className="team-card-link">
                  View franchise <Icon name="arrow" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader title="Teams & managers" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
