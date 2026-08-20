import type {
  BracketMatch,
  Champion,
  LeagueRecord,
  MatchupPair,
  PowerRanking,
  SleeperLeague,
  SleeperMatchup,
  SleeperPlayer,
  Standing,
  Team,
} from "./types";

export async function traverseSeasonChain(
  rootLeagueId: string,
  fetchLeague: (leagueId: string) => Promise<SleeperLeague>,
  maximumSeasons = 15,
) {
  const seasons: SleeperLeague[] = [];
  const seen = new Set<string>();
  let leagueId: string | null = rootLeagueId;
  while (leagueId && seasons.length < maximumSeasons) {
    if (seen.has(leagueId)) break;
    seen.add(leagueId);
    const league = await fetchLeague(leagueId);
    seasons.push(league);
    leagueId = league.previous_league_id;
  }
  return seasons;
}

export const formatPoints = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);

export function standings(teams: Team[], playoffTeams = 6): Standing[] {
  return [...teams]
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.pointsFor - a.pointsFor ||
        a.pointsAgainst - b.pointsAgainst,
    )
    .map((team, index) => {
      const games = team.wins + team.losses + team.ties;
      return {
        ...team,
        rank: index + 1,
        winPercentage: games ? (team.wins + team.ties * 0.5) / games : 0,
        playoff: index < playoffTeams,
      };
    });
}

export function pairMatchups(
  rows: SleeperMatchup[],
  teams: Team[],
  complete = false,
): MatchupPair[] {
  const teamMap = new Map(teams.map((team) => [team.rosterId, team]));
  const groups = new Map<number, SleeperMatchup[]>();

  for (const row of rows) {
    const key = row.matchup_id ?? -row.roster_id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()].map(([matchupId, grouped]) => {
    const entries = grouped.flatMap((matchup) => {
      const team = teamMap.get(matchup.roster_id);
      return team ? [{ team, matchup }] : [];
    });
    const hasScore = grouped.some((row) => row.points > 0);
    return {
      matchupId,
      teams: entries,
      status:
        entries.length < 2
          ? "bye"
          : complete || hasScore
            ? "final"
            : "upcoming",
    };
  });
}

function findPlacement(bracket: BracketMatch[], place: number) {
  return bracket.find((match) => match.p === place);
}

export function deriveChampion(
  league: SleeperLeague,
  teams: Team[],
  winners: BracketMatch[],
  losers: BracketMatch[],
  titleCounts: Map<string, number>,
): Champion | null {
  if (!winners.length) return null;
  const final =
    findPlacement(winners, 1) ??
    [...winners]
      .sort((a, b) => b.r - a.r || a.m - b.m)
      .find((match) => match.w != null);
  if (!final?.w) return null;

  const teamMap = new Map(teams.map((team) => [team.rosterId, team]));
  const champion = teamMap.get(final.w);
  if (!champion) return null;
  const thirdMatch = findPlacement(winners, 3);
  const lastMatch = [...losers]
    .sort((a, b) => b.r - a.r)
    .find((match) => match.l != null);
  const regularSeasonChampion =
    standings(teams, league.settings.playoff_teams ?? 6)[0] ?? null;
  const ownerKey =
    champion.ownerId || `${league.league_id}:${champion.rosterId}`;
  const titleCount = (titleCounts.get(ownerKey) ?? 0) + 1;
  titleCounts.set(ownerKey, titleCount);

  return {
    season: league.season,
    leagueId: league.league_id,
    champion,
    runnerUp: final.l ? (teamMap.get(final.l) ?? null) : null,
    thirdPlace: thirdMatch?.w ? (teamMap.get(thirdMatch.w) ?? null) : null,
    regularSeasonChampion,
    lastPlace: lastMatch?.l ? (teamMap.get(lastMatch.l) ?? null) : null,
    titleCount,
  };
}

const eligible = (slot: string, positions: string[]) => {
  if (positions.includes(slot)) return true;
  if (slot === "FLEX")
    return positions.some((position) => ["RB", "WR", "TE"].includes(position));
  if (slot === "WRRB_FLEX")
    return positions.some((position) => ["RB", "WR"].includes(position));
  if (slot === "REC_FLEX")
    return positions.some((position) => ["WR", "TE"].includes(position));
  if (slot === "SUPER_FLEX")
    return positions.some((position) =>
      ["QB", "RB", "WR", "TE"].includes(position),
    );
  return false;
};

export function optimalLineupScore(
  matchup: SleeperMatchup,
  rosterPositions: string[],
  players: Record<string, SleeperPlayer>,
) {
  const slots = rosterPositions
    .filter((slot) => !["BN", "IR", "TAXI"].includes(slot))
    .sort((a, b) => {
      const flexibility = (slot: string) =>
        slot === "SUPER_FLEX"
          ? 4
          : slot === "FLEX"
            ? 3
            : slot.includes("FLEX")
              ? 2
              : 1;
      return flexibility(a) - flexibility(b);
    });
  const available = Object.entries(matchup.players_points ?? {}).map(
    ([id, points]) => ({
      id,
      points,
      positions:
        players[id]?.fantasy_positions ??
        (players[id]?.position ? [players[id].position!] : []),
    }),
  );
  let total = 0;

  for (const slot of slots) {
    const candidates = available
      .filter((player) => eligible(slot, player.positions))
      .sort((a, b) => b.points - a.points);
    const selected = candidates[0];
    if (!selected) continue;
    total += selected.points;
    available.splice(
      available.findIndex((player) => player.id === selected.id),
      1,
    );
  }

  return total;
}

const percentileScores = (values: Map<number, number>) => {
  const sorted = [...values.values()].sort((a, b) => a - b);
  const scores = new Map<number, number>();
  for (const [id, value] of values) {
    if (sorted.length <= 1) scores.set(id, 100);
    else
      scores.set(
        id,
        (sorted.findLastIndex((entry) => entry <= value) /
          (sorted.length - 1)) *
          100,
      );
  }
  return scores;
};

function calculateRankingSnapshot(
  teams: Team[],
  weeks: Array<{ week: number; matchups: SleeperMatchup[] }>,
  throughWeek: number,
  league: SleeperLeague,
  players: Record<string, SleeperPlayer>,
) {
  const relevant = weeks.filter((week) => week.week <= throughWeek);
  const recentWeeks = relevant.slice(-3);
  const winPct = new Map<number, number>();
  const ppg = new Map<number, number>();
  const recent = new Map<number, number>();
  const efficiency = new Map<number, number>();

  for (const team of teams) {
    const rows = relevant.flatMap((week) =>
      week.matchups.filter((row) => row.roster_id === team.rosterId),
    );
    const games = rows.filter((row) => row.matchup_id != null);
    let wins = 0;
    let ties = 0;
    for (const week of relevant) {
      const row = week.matchups.find(
        (entry) => entry.roster_id === team.rosterId,
      );
      if (!row?.matchup_id) continue;
      const opponent = week.matchups.find(
        (entry) =>
          entry.matchup_id === row.matchup_id &&
          entry.roster_id !== team.rosterId,
      );
      if (!opponent) continue;
      if (row.points > opponent.points) wins += 1;
      else if (row.points === opponent.points) ties += 1;
    }
    const totalPoints = games.reduce((sum, row) => sum + row.points, 0);
    const recentRows = recentWeeks.flatMap((week) =>
      week.matchups.filter((row) => row.roster_id === team.rosterId),
    );
    const optimal = games.reduce(
      (sum, row) =>
        sum + optimalLineupScore(row, league.roster_positions, players),
      0,
    );
    winPct.set(
      team.rosterId,
      games.length ? (wins + ties * 0.5) / games.length : 0,
    );
    ppg.set(team.rosterId, games.length ? totalPoints / games.length : 0);
    recent.set(
      team.rosterId,
      recentRows.length
        ? recentRows.reduce((sum, row) => sum + row.points, 0) /
            recentRows.length
        : 0,
    );
    efficiency.set(team.rosterId, optimal ? totalPoints / optimal : 0);
  }

  const metrics = {
    winPercentage: percentileScores(winPct),
    pointsPerGame: percentileScores(ppg),
    recentForm: percentileScores(recent),
    lineupEfficiency: percentileScores(efficiency),
  };

  return teams
    .map((team) => ({
      rosterId: team.rosterId,
      team,
      score:
        (metrics.winPercentage.get(team.rosterId) ?? 0) * 0.35 +
        (metrics.pointsPerGame.get(team.rosterId) ?? 0) * 0.3 +
        (metrics.recentForm.get(team.rosterId) ?? 0) * 0.2 +
        (metrics.lineupEfficiency.get(team.rosterId) ?? 0) * 0.15,
      components: {
        winPercentage: winPct.get(team.rosterId) ?? 0,
        pointsPerGame: ppg.get(team.rosterId) ?? 0,
        recentForm: recent.get(team.rosterId) ?? 0,
        lineupEfficiency: efficiency.get(team.rosterId) ?? 0,
      },
    }))
    .sort((a, b) => b.score - a.score);
}

export function powerRankings(
  teams: Team[],
  weeks: Array<{ week: number; matchups: SleeperMatchup[] }>,
  throughWeek: number,
  league: SleeperLeague,
  players: Record<string, SleeperPlayer>,
): PowerRanking[] {
  if (throughWeek < 1 || !weeks.length) return [];
  const current = calculateRankingSnapshot(
    teams,
    weeks,
    throughWeek,
    league,
    players,
  );
  const previous =
    throughWeek > 1
      ? calculateRankingSnapshot(teams, weeks, throughWeek - 1, league, players)
      : [];
  const previousRanks = new Map(
    previous.map((entry, index) => [entry.rosterId, index + 1]),
  );

  return current.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    score: Math.round(entry.score * 10) / 10,
    movement: previousRanks.has(entry.rosterId)
      ? (previousRanks.get(entry.rosterId) ?? index + 1) - (index + 1)
      : 0,
  }));
}

export function matchupRecords(
  seasons: Array<{
    league: SleeperLeague;
    teams: Team[];
    weeks: Array<{ week: number; matchups: SleeperMatchup[] }>;
  }>,
): LeagueRecord[] {
  const scored: Array<{
    points: number;
    opponent: number;
    team: Team;
    season: string;
    week: number;
  }> = [];
  for (const season of seasons) {
    for (const week of season.weeks) {
      for (const row of week.matchups) {
        const team = season.teams.find(
          (entry) => entry.rosterId === row.roster_id,
        );
        const opponent = week.matchups.find(
          (entry) =>
            entry.matchup_id === row.matchup_id &&
            entry.roster_id !== row.roster_id,
        );
        if (team && opponent && row.points > 0) {
          scored.push({
            points: row.points,
            opponent: opponent.points,
            team,
            season: season.league.season,
            week: week.week,
          });
        }
      }
    }
  }
  if (!scored.length) return [];
  const highest = [...scored].sort((a, b) => b.points - a.points)[0];
  const lowest = [...scored].sort((a, b) => a.points - b.points)[0];
  const blowout = [...scored].sort(
    (a, b) => Math.abs(b.points - b.opponent) - Math.abs(a.points - a.opponent),
  )[0];
  const closest = [...scored].sort(
    (a, b) => Math.abs(a.points - a.opponent) - Math.abs(b.points - b.opponent),
  )[0];
  const record = (
    label: string,
    item: typeof highest,
    value: string,
  ): LeagueRecord => ({
    label,
    value,
    manager: item.team.managerName,
    teamName: item.team.teamName,
    season: item.season,
    week: item.week,
  });

  return [
    record("Highest weekly score", highest, formatPoints(highest.points)),
    record("Lowest weekly score", lowest, formatPoints(lowest.points)),
    record(
      "Largest blowout",
      blowout,
      `${formatPoints(Math.abs(blowout.points - blowout.opponent))} pts`,
    ),
    record(
      "Closest matchup",
      closest,
      `${formatPoints(Math.abs(closest.points - closest.opponent))} pts`,
    ),
  ];
}
