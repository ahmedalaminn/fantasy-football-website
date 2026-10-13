import "server-only";

import { cache } from "react";
import { traverseSeasonChain } from "./calculations";
import type {
  BracketMatch,
  NflState,
  SeasonBundle,
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperMatchup,
  SleeperPlayer,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
  Team,
} from "./types";

const API_ROOT = "https://api.sleeper.app/v1";
const ACTIVE_TTL = 300;
const HISTORY_TTL = 86400 * 30;
const PLAYER_TTL = 86400;
const MAX_HISTORY_SEASONS = 15;

async function sleeperFetch<T>(
  path: string,
  revalidate = ACTIVE_TTL,
): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    next: { revalidate },
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Sleeper request failed (${response.status}) for ${path}`);
  }

  return response.json() as Promise<T>;
}

export const getRootLeagueId = () => {
  const leagueId = process.env.LEAGUE_ID;
  if (!leagueId) throw new Error("LEAGUE_ID is not configured.");
  return leagueId;
};

export const getLeague = cache((leagueId: string) =>
  sleeperFetch<SleeperLeague>(`/league/${leagueId}`),
);

export const getUsers = cache((leagueId: string, historical = false) =>
  sleeperFetch<SleeperUser[]>(
    `/league/${leagueId}/users`,
    historical ? HISTORY_TTL : ACTIVE_TTL,
  ),
);

export const getRosters = cache((leagueId: string, historical = false) =>
  sleeperFetch<SleeperRoster[]>(
    `/league/${leagueId}/rosters`,
    historical ? HISTORY_TTL : ACTIVE_TTL,
  ),
);

export const getMatchups = cache(
  (leagueId: string, week: number, historical = false) =>
    sleeperFetch<SleeperMatchup[]>(
      `/league/${leagueId}/matchups/${week}`,
      historical ? HISTORY_TTL : ACTIVE_TTL,
    ),
);

export const getTransactions = cache(
  (leagueId: string, week: number, historical = false) =>
    sleeperFetch<SleeperTransaction[]>(
      `/league/${leagueId}/transactions/${week}`,
      historical ? HISTORY_TTL : ACTIVE_TTL,
    ),
);

export const getWinnersBracket = cache((leagueId: string) =>
  sleeperFetch<BracketMatch[]>(
    `/league/${leagueId}/winners_bracket`,
    HISTORY_TTL,
  ),
);

export const getLosersBracket = cache((leagueId: string) =>
  sleeperFetch<BracketMatch[]>(
    `/league/${leagueId}/losers_bracket`,
    HISTORY_TTL,
  ),
);

export const getDrafts = cache((leagueId: string) =>
  sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`, ACTIVE_TTL),
);

export const getDraftPicks = cache((draftId: string) =>
  sleeperFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`, HISTORY_TTL),
);

export const getLiveDraftPicks = (draftId: string) =>
  sleeperFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`, 2);

export const getNflState = cache(() =>
  sleeperFetch<NflState>("/state/nfl", ACTIVE_TTL),
);

type PlayerCache = {
  value?: Record<string, SleeperPlayer>;
  promise?: Promise<Record<string, SleeperPlayer>>;
  expiresAt?: number;
};

const globalPlayerCache = globalThis as typeof globalThis & {
  __udFantasyPlayerCache?: PlayerCache;
};
const playerCache =
  globalPlayerCache.__udFantasyPlayerCache ??
  (globalPlayerCache.__udFantasyPlayerCache = {});

export async function getPlayers(): Promise<Record<string, SleeperPlayer>> {
  if (playerCache.value && (playerCache.expiresAt ?? 0) > Date.now()) {
    return playerCache.value;
  }
  if (playerCache.promise) return playerCache.promise;

  playerCache.promise = fetch(`${API_ROOT}/players/nfl`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Sleeper request failed (${response.status}) for /players/nfl`,
        );
      }
      const players = (await response.json()) as Record<string, SleeperPlayer>;
      playerCache.value = players;
      playerCache.expiresAt = Date.now() + PLAYER_TTL * 1000;
      return players;
    })
    .finally(() => {
      playerCache.promise = undefined;
    });

  return playerCache.promise;
}

export function avatarUrl(avatar: string | null | undefined) {
  return avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : null;
}

export { playerImageUrl } from "./player-image";

export function buildTeams(
  users: SleeperUser[],
  rosters: SleeperRoster[],
): Team[] {
  const userMap = new Map(users.map((user) => [user.user_id, user]));

  return rosters.map((roster) => {
    const user = roster.owner_id ? userMap.get(roster.owner_id) : undefined;
    const pointsFor =
      (roster.settings.fpts ?? 0) + (roster.settings.fpts_decimal ?? 0) / 100;
    const pointsAgainst =
      (roster.settings.fpts_against ?? 0) +
      (roster.settings.fpts_against_decimal ?? 0) / 100;

    return {
      rosterId: roster.roster_id,
      ownerId: roster.owner_id,
      managerName: user?.display_name || `Manager ${roster.roster_id}`,
      teamName:
        user?.metadata?.team_name || `${user?.display_name || "Orphan"}'s Team`,
      avatarUrl: avatarUrl(user?.avatar),
      wins: roster.settings.wins ?? 0,
      losses: roster.settings.losses ?? 0,
      ties: roster.settings.ties ?? 0,
      pointsFor,
      pointsAgainst,
      streak: roster.metadata?.streak || "—",
      players: roster.players ?? [],
      starters: roster.starters ?? [],
      reserve: roster.reserve ?? [],
      taxi: roster.taxi ?? [],
      raw: roster,
    };
  });
}

export const getSeasonBundle = cache(
  async (leagueId: string): Promise<SeasonBundle> => {
    const league = await getLeague(leagueId);
    const historical = league.status === "complete";
    const [users, rosters] = await Promise.all([
      getUsers(leagueId, historical),
      getRosters(leagueId, historical),
    ]);

    return { league, users, rosters, teams: buildTeams(users, rosters) };
  },
);

export const getCurrentSeason = cache(() => getSeasonBundle(getRootLeagueId()));

export const getSeasonChain = cache(async (): Promise<SleeperLeague[]> => {
  return traverseSeasonChain(getRootLeagueId(), getLeague, MAX_HISTORY_SEASONS);
});

export async function getAllWeeks(
  league: SleeperLeague,
  includePlayoffs = true,
): Promise<Array<{ week: number; matchups: SleeperMatchup[] }>> {
  const regularEnd = league.settings.playoff_week_start
    ? league.settings.playoff_week_start - 1
    : 14;
  const lastWeek = includePlayoffs
    ? Math.min(18, Math.max(regularEnd, league.settings.leg ?? regularEnd + 3))
    : regularEnd;

  const results = await Promise.all(
    Array.from({ length: lastWeek }, (_, index) => {
      const week = index + 1;
      return getMatchups(
        league.league_id,
        week,
        league.status === "complete",
      ).then((matchups) => ({
        week,
        matchups,
      }));
    }),
  );

  return results.filter(({ matchups }) => matchups.length > 0);
}

export async function getRecentTransactions(
  league: SleeperLeague,
  throughWeek: number,
  count = 8,
) {
  const start = Math.max(1, throughWeek - 2);
  const weeks = await Promise.all(
    Array.from({ length: throughWeek - start + 1 }, (_, index) => {
      const week = start + index;
      return getTransactions(
        league.league_id,
        week,
        league.status === "complete",
      );
    }),
  );

  return weeks
    .flat()
    .sort((a, b) => b.status_updated - a.status_updated)
    .slice(0, count);
}

export interface WeeklyPlayerStat {
  player_id: string;
  team: string;
  stats: Record<string, number>;
}
export const getWeeklyPlayerStats = cache(
  async (season: string, week: number): Promise<WeeklyPlayerStat[]> => {
    const response = await fetch(
      `https://api.sleeper.app/stats/nfl/${season}/${week}?season_type=regular`,
      { next: { revalidate: ACTIVE_TTL } },
    );
    if (!response.ok)
      throw new Error(`Participation data unavailable for Week ${week}`);
    return response.json();
  },
);
