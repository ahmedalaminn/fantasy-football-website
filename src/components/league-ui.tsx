import Image from "next/image";
import Link from "next/link";
import { formatPoints } from "@/lib/calculations";
import { playerImageUrl } from "@/lib/sleeper";
import type {
  MatchupPair,
  SleeperPlayer,
  SleeperTransaction,
  Standing,
  Team,
} from "@/lib/types";
import { Icon } from "./icon";
import { Avatar, Badge, EmptyState, TeamIdentity } from "./ui";

export function MatchupList({
  matchups,
  limit,
}: {
  matchups: MatchupPair[];
  limit?: number;
}) {
  const rows = limit ? matchups.slice(0, limit) : matchups;
  if (!rows.length)
    return (
      <EmptyState
        icon="calendar"
        title="No matchups yet"
        description="Games will appear as soon as Sleeper publishes the schedule."
      />
    );
  return (
    <div className="matchup-list">
      {rows.map((pair) => {
        const [left, right] = pair.teams;
        if (!left) return null;
        const leftWins = right && left.matchup.points > right.matchup.points;
        const rightWins = right && right.matchup.points > left.matchup.points;
        return (
          <Link
            href={`/matchups?week=current#matchup-${pair.matchupId}`}
            className="matchup-row"
            key={pair.matchupId}
          >
            <TeamIdentity team={left.team} compact />
            <div className="score">
              <span className={leftWins ? "winner" : ""}>
                {formatPoints(left.matchup.points)}
              </span>
              <i>—</i>
              <span className={rightWins ? "winner" : ""}>
                {right ? formatPoints(right.matchup.points) : "BYE"}
              </span>
            </div>
            {right ? <TeamIdentity team={right.team} compact /> : <span />}
          </Link>
        );
      })}
    </div>
  );
}

export function StandingsTable({
  rows,
  compact = false,
}: {
  rows: Standing[];
  compact?: boolean;
}) {
  const visible = compact ? rows.slice(0, 6) : rows;
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Record</th>
            <th>PF</th>
            {!compact && (
              <>
                <th>PA</th>
                <th>Pct</th>
                <th>Streak</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr
              key={row.rosterId}
              className={
                index === rows.filter((team) => team.playoff).length
                  ? "playoff-line"
                  : ""
              }
            >
              <td>
                <span className={`rank-number ${row.rank <= 3 ? "top" : ""}`}>
                  {String(row.rank).padStart(2, "0")}
                </span>
              </td>
              <td>
                <Link href={`/teams/${row.rosterId}`}>
                  <TeamIdentity team={row} compact />
                </Link>
              </td>
              <td>
                {row.wins}-{row.losses}
                {row.ties ? `-${row.ties}` : ""}
              </td>
              <td>{formatPoints(row.pointsFor)}</td>
              {!compact && (
                <>
                  <td>{formatPoints(row.pointsAgainst)}</td>
                  <td>{row.winPercentage.toFixed(3).replace(/^0/, "")}</td>
                  <td>{row.streak}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ActivityList({
  transactions,
  teams,
  players,
  limit,
}: {
  transactions: SleeperTransaction[];
  teams: Team[];
  players: Record<string, SleeperPlayer>;
  limit?: number;
}) {
  const teamMap = new Map(teams.map((team) => [team.rosterId, team]));
  const rows = limit ? transactions.slice(0, limit) : transactions;
  if (!rows.length)
    return (
      <EmptyState
        icon="activity"
        title="No recent activity"
        description="Trades, waivers, adds, and drops will show up here."
      />
    );
  return (
    <div className="activity-list">
      {rows.map((transaction) => {
        const managers = transaction.roster_ids
          .map((id) => teamMap.get(id)?.managerName)
          .filter(Boolean);
        const added = Object.keys(transaction.adds ?? {}).map(
          (id) => players[id]?.full_name || "Unknown player",
        );
        const dropped = Object.keys(transaction.drops ?? {}).map(
          (id) => players[id]?.full_name || "Unknown player",
        );
        const detail =
          transaction.type === "trade"
            ? `${managers.join(" ↔ ")} · ${[...added, ...dropped].slice(0, 3).join(", ")}`
            : `${managers[0] || "League"} · ${added.length ? `Added ${added.join(", ")}` : ""}${added.length && dropped.length ? " · " : ""}${dropped.length ? `Dropped ${dropped.join(", ")}` : ""}`;
        return (
          <div className="activity-row" key={transaction.transaction_id}>
            <span className="activity-icon">
              <Icon
                name={transaction.type === "trade" ? "activity" : "spark"}
              />
            </span>
            <div className="activity-copy">
              <strong>
                {transaction.type === "trade"
                  ? "Trade completed"
                  : transaction.type === "waiver"
                    ? "Waiver processed"
                    : "Roster move"}
              </strong>
              <p>{detail || "Transaction processed in Sleeper"}</p>
            </div>
            <span className="activity-time">
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
              }).format(transaction.status_updated)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PlayerRow({
  playerId,
  players,
  points,
  starter,
}: {
  playerId: string;
  players: Record<string, SleeperPlayer>;
  points?: number;
  starter?: boolean;
}) {
  const player = players[playerId];
  return (
    <div className="player-row">
      <span className="player-thumb">
        <Image src={playerImageUrl(playerId)} alt="" fill sizes="35px" />
      </span>
      <span className="player-row-copy">
        <strong>{player?.full_name || `Player ${playerId}`}</strong>
        <small>
          {[player?.position, player?.team || "FA", starter ? "Starter" : null]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </span>
      {points != null && (
        <span className="player-points">{formatPoints(points)}</span>
      )}
    </div>
  );
}

export function ChampionMini({
  champion,
}: {
  champion: import("@/lib/types").Champion;
}) {
  return (
    <div className="champion-card">
      <div className="champion-top">
        <Avatar
          src={champion.champion.avatarUrl}
          name={champion.champion.managerName}
          size="lg"
          ring
        />
        <div>
          <Badge tone="aqua">
            <Icon name="trophy" style={{ width: 11, marginRight: 4 }} />{" "}
            {champion.season} Champion
          </Badge>
          <h3>{champion.champion.teamName}</h3>
          <p>Managed by {champion.champion.managerName}</p>
        </div>
      </div>
      <div className="champion-stats">
        <div className="stat">
          <span>Record</span>
          <strong>
            {champion.champion.wins}-{champion.champion.losses}
          </strong>
        </div>
        <div className="stat stat-aqua">
          <span>Points</span>
          <strong>{formatPoints(champion.champion.pointsFor)}</strong>
        </div>
        <div className="stat stat-violet">
          <span>Titles</span>
          <strong>{champion.titleCount}</strong>
        </div>
      </div>
    </div>
  );
}
