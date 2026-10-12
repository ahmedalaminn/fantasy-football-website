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
    const hasScore = grouped.some((row) => row.points !== 0);
    return {
      matchupId,
      teams: entries,
      status:
        entries.length < 2
          ? "bye"
          : complete
            ? "final"
            : hasScore
              ? "live"
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

// Award N..1 category points. Tied teams share the average of occupied places.
function categoryPoints(values: Map<number, number>) {
  const all = [...values.values()];
  return new Map(
    [...values].map(([id, value]) => {
      const better = all.filter((other) => other > value).length;
      const tied = all.filter((other) => other === value).length;
      return [id, all.length - better - (tied - 1) / 2];
    }),
  );
}

function calculateRankingSnapshot(
  teams: Team[],
  weeks: Array<{ week: number; matchups: SleeperMatchup[] }>,
  league: SleeperLeague,
  players: Record<string, SleeperPlayer>,
) {
  const metrics = teams.map((team) => {
    let totalPoints = 0,
      wins = 0,
      losses = 0,
      ties = 0;
    let allPlayWins = 0,
      allPlayLosses = 0,
      allPlayTies = 0,
      optimal = 0;
    for (const week of weeks) {
      const row = week.matchups.find(
        (entry) => entry.roster_id === team.rosterId,
      )!;
      totalPoints += row.points;
      // Kept as a history diagnostic; efficiency does not affect power scores.
      optimal += optimalLineupScore(row, league.roster_positions, players);
      const others = week.matchups.filter(
        (entry) =>
          entry.roster_id !== team.rosterId &&
          teams.some((team) => team.rosterId === entry.roster_id),
      );
      for (const other of others) {
        if (row.points > other.points) allPlayWins++;
        else if (row.points < other.points) allPlayLosses++;
        else allPlayTies++;
      }
      const opponent =
        row.matchup_id == null
          ? undefined
          : others.find((entry) => entry.matchup_id === row.matchup_id);
      if (opponent) {
        if (row.points > opponent.points) wins++;
        else if (row.points < opponent.points) losses++;
        else ties++;
      }
    }
    const games = wins + losses + ties;
    const comparisons = allPlayWins + allPlayLosses + allPlayTies;
    return {
      team,
      totalPoints,
      wins,
      losses,
      ties,
      allPlayWins,
      allPlayLosses,
      allPlayTies,
      winPercentage: games ? (wins + ties * 0.5) / games : 0,
      allPlayWinPercentage: comparisons
        ? (allPlayWins + allPlayTies * 0.5) / comparisons
        : 0,
      lineupEfficiency: optimal ? totalPoints / optimal : 0,
    };
  });
  const pf = categoryPoints(
    new Map(metrics.map((m) => [m.team.rosterId, m.totalPoints])),
  );
  const bd = categoryPoints(
    new Map(metrics.map((m) => [m.team.rosterId, m.allPlayWinPercentage])),
  );
  const rec = categoryPoints(
    new Map(metrics.map((m) => [m.team.rosterId, m.winPercentage])),
  );
  return metrics
    .map((m) => {
      const pointsRankPoints = pf.get(m.team.rosterId)!;
      const allPlayRankPoints = bd.get(m.team.rosterId)!;
      const recordRankPoints = rec.get(m.team.rosterId)!;
      const weightedPoints =
        2 * pointsRankPoints + 2 * allPlayRankPoints + recordRankPoints;
      return {
        rosterId: m.team.rosterId,
        team: m.team,
        score: (weightedPoints / (5 * teams.length)) * 100,
        components: {
          totalPoints: m.totalPoints,
          winPercentage: m.winPercentage,
          wins: m.wins,
          losses: m.losses,
          ties: m.ties,
          allPlayWins: m.allPlayWins,
          allPlayLosses: m.allPlayLosses,
          allPlayTies: m.allPlayTies,
          allPlayWinPercentage: m.allPlayWinPercentage,
          pointsRankPoints,
          allPlayRankPoints,
          recordRankPoints,
          weightedPoints,
          lineupEfficiency: m.lineupEfficiency,
        },
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.components.totalPoints - a.components.totalPoints ||
        a.rosterId - b.rosterId,
    );
}

// throughWeek is the last completed week, never the live scoring week.
export function powerRankings(
  teams: Team[],
  weeks: Array<{ week: number; matchups: SleeperMatchup[] }>,
  throughWeek: number,
  league: SleeperLeague,
  players: Record<string, SleeperPlayer>,
): PowerRanking[] {
  if (throughWeek < 1 || !teams.length) return [];
  const completed = weeks
    .filter(
      (week) =>
        week.week <= throughWeek &&
        teams.every((team) =>
          week.matchups.some(
            (row) =>
              row.roster_id === team.rosterId && Number.isFinite(row.points),
          ),
        ),
    )
    .sort((a, b) => a.week - b.week);
  if (!completed.length) return [];
  const current = calculateRankingSnapshot(teams, completed, league, players);
  const previous =
    completed.length > 1
      ? calculateRankingSnapshot(teams, completed.slice(0, -1), league, players)
      : [];
  const previousRanks = new Map(
    previous.map((entry, index) => [entry.rosterId, index + 1]),
  );
  return current.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    score: Math.round(entry.score * 10) / 10,
    movement: previousRanks.has(entry.rosterId)
      ? previousRanks.get(entry.rosterId)! - (index + 1)
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
