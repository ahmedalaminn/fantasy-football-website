import "server-only";
import { cache } from "react";
import { deriveChampion } from "./calculations";
import {
  getLosersBracket,
  getSeasonBundle,
  getSeasonChain,
  getWinnersBracket,
} from "./sleeper";
import type { Champion } from "./types";

export const getChampions = cache(async (): Promise<Champion[]> => {
  const leagues = await getSeasonChain();
  const seasonData = await Promise.all(
    leagues.map(async (league) => {
      const [bundle, winners, losers] = await Promise.all([
        getSeasonBundle(league.league_id),
        getWinnersBracket(league.league_id).catch(() => []),
        getLosersBracket(league.league_id).catch(() => []),
      ]);
      return { bundle, winners, losers };
    }),
  );
  const runningTitles = new Map<string, number>();
  const champions = [...seasonData]
    .reverse()
    .flatMap(({ bundle, winners, losers }) => {
      const champion = deriveChampion(
        bundle.league,
        bundle.teams,
        winners,
        losers,
        runningTitles,
      );
      return champion ? [champion] : [];
    });
  const careerTitles = new Map<string, number>();
  for (const entry of champions) {
    const key =
      entry.champion.ownerId || `${entry.leagueId}:${entry.champion.rosterId}`;
    careerTitles.set(key, (careerTitles.get(key) ?? 0) + 1);
  }
  return champions
    .map((entry) => ({
      ...entry,
      titleCount:
        careerTitles.get(
          entry.champion.ownerId ||
            `${entry.leagueId}:${entry.champion.rosterId}`,
        ) ?? 1,
    }))
    .reverse();
});
