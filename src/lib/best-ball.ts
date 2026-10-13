export interface AdpRow {
  playerId: string;
  name: string;
  position: string;
  adp: number;
}
export interface AdpSnapshot {
  season: string;
  snapshotDate: string;
  sourceName: string;
  sourceUrl: string;
  players: AdpRow[];
}
export function draftDay(timestamp: number | null | undefined): string | null {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function preseasonBenchmark(
  snapshot: AdpSnapshot,
  season: string,
): AdpRow[] {
  return snapshot.season === season ? snapshot.players : [];
}
export function pickValue(pick: number, adp: number) {
  const delta = pick - adp;
  const threshold = Math.max(3, adp * 0.1);
  return {
    delta,
    grade:
      delta >= threshold ? "value" : delta <= -threshold ? "reach" : "fair",
  } as const;
}
export function performanceRankings(
  adp: AdpRow[],
  scores: Record<string, number>,
) {
  // Use the same observed population for both ranks, so missing scoring cannot create phantom gains.
  const observed = adp.filter((row) => Number.isFinite(scores[row.playerId]));
  return observed
    .map((row) => {
      const peers = observed.filter((other) => other.position === row.position);
      const adpPositionRank =
        1 + peers.filter((other) => other.adp < row.adp).length;
      const scoringRank =
        1 +
        peers.filter((other) => scores[other.playerId] > scores[row.playerId])
          .length;
      return {
        ...row,
        points: scores[row.playerId],
        adpPositionRank,
        scoringRank,
        gain: adpPositionRank - scoringRank,
      };
    })
    .sort((a, b) => b.gain - a.gain || b.points - a.points || a.adp - b.adp);
}

export function performanceView(
  rows: ReturnType<typeof performanceRankings>,
  direction: "outperformers" | "underperformers",
  draftStatus: "all" | "drafted" | "undrafted",
  drafted: ReadonlySet<string>,
) {
  return rows
    .filter(
      (row) =>
        (direction === "outperformers" ? row.gain > 0 : row.gain < 0) &&
        (draftStatus === "all" ||
          (draftStatus === "drafted"
            ? drafted.has(row.playerId)
            : !drafted.has(row.playerId))),
    )
    .sort((a, b) =>
      direction === "outperformers"
        ? b.gain - a.gain || b.points - a.points || a.adp - b.adp
        : a.gain - b.gain || a.points - b.points || a.adp - b.adp,
    );
}

export function seasonGrade(gain: number | null | undefined) {
  return gain == null || !Number.isFinite(gain)
    ? "unknown"
    : gain > 0
      ? "value"
      : gain < 0
        ? "reach"
        : "fair";
}

export function perGameRankings(
  adp: AdpRow[],
  scores: Record<string, number>,
  production: Record<string, { played: number; available: boolean }>,
) {
  const averages = Object.fromEntries(
    Object.entries(scores).flatMap(([id, points]) => {
      const games = production[id];
      return games?.available && games.played > 0 && Number.isFinite(points)
        ? [[id, points / games.played]]
        : [];
    }),
  );
  return performanceRankings(adp, averages);
}
