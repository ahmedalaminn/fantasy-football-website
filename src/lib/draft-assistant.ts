import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperPlayer,
  Team,
  TradedPick,
} from "./types";
import type { NewsAnalysis } from "./news";

export const DRAFT_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
export type DraftPosition = (typeof DRAFT_POSITIONS)[number];

export interface DraftPlayer {
  id: string;
  name: string;
  team: string;
  position: DraftPosition;
  marketRank: number;
  positionRank: number;
  projectedPoints: number;
  floor: number;
  ceiling: number;
  replacementValue: number;
  age: number | null;
  experience: number | null;
  injuryStatus: string | null;
  depthChartOrder: number | null;
  depthChartAdjustment: number;
  byeWeek: number | null;
  availabilityRisk: number;
  confidence: number;
  newsImpact: number;
  projectionContext?: ProjectionContext;
  projectionSource:
    "python-model" | "market-fallback" | "rookie-fallback" | "news-adjusted";
}

export interface ProjectionContext {
  team?: string | null;
  headCoach?: string | null;
  offensiveCoordinator?: string | null;
  playCaller?: string | null;
  coachContinuity?: number | null;
  teamPassRate?: number | null;
  teamScoringRate?: number | null;
  schedulePositionPointsAllowed?: number | null;
}

export interface ProjectionFeatureGroup {
  id: string;
  label: string;
  tier: "core" | "sleeper" | "supplemental";
  source: string;
  status: "production" | "research";
  features: string[];
  description: string;
  model_input?: boolean;
}

export interface ProjectionArtifact {
  schemaVersion: number;
  modelVersion: string;
  generatedAt: string | null;
  forecastSeason: number;
  latestInputSeason: number | null;
  stale: boolean;
  dataStartSeason?: number;
  scoringProfile?: string;
  featureCount?: number;
  researchFeatureCount?: number;
  availableFeatureCount?: number;
  featureGroups?: ProjectionFeatureGroup[];
  sources?: string[];
  contextCoverage?: {
    forecastSeason: number;
    teamPositionRows: number;
    offensiveStaffOptional: boolean;
  };
  metrics: {
    validationSeason?: number;
    validationSeasons?: number[];
    bySeason?: Array<{
      season: number;
      rows: number;
      mae: number;
      baselineMae: number;
      quantileCoverage?: number | null;
    }>;
    rows: number;
    mae: number | null;
    baselineMae: number | null;
    quantileCoverage?: number | null;
    coreOnlyMae?: number | null;
    supplementalUplift?: number | null;
    supplementalWinningSeasons?: number;
  } | null;
  players: Array<{
    playerId: string;
    name: string;
    position: string;
    floor: number;
    median: number;
    ceiling: number;
    availability?: number;
    expectedGames?: number;
    confidence?: number;
    context?: ProjectionContext;
  }>;
}

export interface ManagerDraftProfile {
  ownerId: string;
  sampleSize: number;
  positionShare: Partial<Record<DraftPosition, number>>;
  averageRound: Partial<Record<DraftPosition, number>>;
}

export interface DraftRecommendation extends DraftPlayer {
  score: number;
  personalizedScore: number;
  availabilityAtNextPick: number;
  valueOverReplacement: number;
  rosterNeed: number;
  reason: string;
}

export interface DraftLeagueContext {
  teams: number;
  rosterPositions: string[];
  scoringSettings?: Record<string, number>;
  riskPreference?: "floor" | "balanced" | "upside";
}

const projectionBase: Record<DraftPosition, [number, number]> = {
  QB: [355, 2.15],
  RB: [325, 1.7],
  WR: [320, 1.55],
  TE: [255, 1.5],
  K: [165, 0.28],
  DEF: [170, 0.3],
};

const replacementRank: Record<DraftPosition, number> = {
  QB: 12,
  RB: 32,
  WR: 38,
  TE: 13,
  K: 11,
  DEF: 11,
};

const rosterTargets: Record<DraftPosition, number> = {
  QB: 1,
  RB: 4,
  WR: 4,
  TE: 1,
  K: 1,
  DEF: 1,
};

function targetForPosition(
  position: DraftPosition,
  rosterPositions?: string[],
) {
  if (!rosterPositions?.length) return rosterTargets[position];
  const starters = rosterPositions.filter((slot) => slot === position).length;
  const flex = rosterPositions.filter(
    (slot) =>
      slot === "FLEX" ||
      slot === "WRRB_FLEX" ||
      (slot === "SUPER_FLEX" && position === "QB"),
  ).length;
  if (position === "RB" || position === "WR")
    return Math.max(2, starters + Math.ceil(flex / 2) + 2);
  if (position === "QB") return Math.max(1, starters + (flex ? 1 : 0));
  if (position === "TE") return Math.max(1, starters);
  return Math.max(1, starters);
}

const asPosition = (value: string | null): DraftPosition | null =>
  DRAFT_POSITIONS.includes(value as DraftPosition)
    ? (value as DraftPosition)
    : null;

const INELIGIBLE_PLAYER_STATUSES = new Set([
  "inactive",
  "out of league",
  "practice squad",
  "retired",
]);

export function isDraftEligiblePlayer(player: SleeperPlayer) {
  const status = player.status?.trim().toLowerCase();
  return Boolean(
    asPosition(player.position) &&
    player.full_name &&
    player.active === true &&
    player.team &&
    (!status || !INELIGIBLE_PLAYER_STATUSES.has(status)) &&
    player.search_rank != null &&
    player.search_rank > 0 &&
    player.search_rank <= 500,
  );
}

export function depthChartLabel(
  player: Pick<DraftPlayer, "position" | "depthChartOrder">,
) {
  if (
    player.depthChartOrder == null ||
    player.depthChartOrder < 1 ||
    player.position === "K" ||
    player.position === "DEF"
  )
    return null;
  return `${player.position}${player.depthChartOrder}`;
}

export function sleeperDepthChartAdjustment(
  position: DraftPosition,
  order: number | null | undefined,
) {
  if (order == null || order < 1 || position === "K" || position === "DEF")
    return 0;
  const byPosition: Record<"QB" | "RB" | "WR" | "TE", number[]> = {
    QB: [0.02, -0.06, -0.08],
    RB: [0.05, 0, -0.04, -0.06],
    WR: [0.04, 0.02, 0, -0.04],
    TE: [0.04, -0.03, -0.06],
  };
  const values = byPosition[position];
  return values[Math.min(order, values.length) - 1];
}

export function buildDraftPlayerPool(
  players: Record<string, SleeperPlayer>,
  artifact?: ProjectionArtifact,
  context?: Pick<
    DraftLeagueContext,
    "teams" | "rosterPositions" | "scoringSettings"
  >,
): DraftPlayer[] {
  const modelProjections = new Map(
    (artifact?.stale ? [] : (artifact?.players ?? [])).map((player) => [
      player.playerId,
      player,
    ]),
  );
  const eligible = Object.entries(players)
    .flatMap(([id, player]) => {
      const position = asPosition(player.position);
      if (!position || !isDraftEligiblePlayer(player)) return [];
      return [{ id, player, position }];
    })
    .sort(
      (a, b) =>
        (a.player.search_rank ?? 999) - (b.player.search_rank ?? 999) ||
        a.player.full_name!.localeCompare(b.player.full_name!),
    );

  const positionCounts = new Map<DraftPosition, number>();
  const pool: DraftPlayer[] = eligible
    .slice(0, 420)
    .map(({ id, player, position }, index) => {
      const positionRank = (positionCounts.get(position) ?? 0) + 1;
      positionCounts.set(position, positionRank);
      const [base, slope] = projectionBase[position];
      const fallbackPoints = Math.max(
        position === "K" || position === "DEF" ? 80 : 45,
        base - slope * (player.search_rank ?? index + 1),
      );
      const model = modelProjections.get(id);
      const rec = context?.scoringSettings?.rec ?? 1;
      const receptionAdjustment =
        position === "WR" || position === "TE"
          ? 0.82 + 0.18 * rec
          : position === "RB"
            ? 0.9 + 0.1 * rec
            : 1;
      const passTdAdjustment =
        position === "QB" ? (context?.scoringSettings?.pass_td ?? 4) / 4 : 1;
      const scoringAdjustment = Math.max(
        0.78,
        Math.min(1.25, receptionAdjustment * passTdAdjustment),
      );
      const depthChartOrder = player.depth_chart_order ?? null;
      const depthChartAdjustment = sleeperDepthChartAdjustment(
        position,
        depthChartOrder,
      );
      const projectionMultiplier =
        scoringAdjustment * (1 + depthChartAdjustment);
      const projectedPoints =
        (model?.median ?? fallbackPoints) * projectionMultiplier;
      const volatility =
        position === "RB" ? 0.29 : position === "WR" ? 0.25 : 0.2;
      return {
        id,
        name: player.full_name!,
        team: player.team || "FA",
        position,
        marketRank: player.search_rank ?? index + 1,
        positionRank,
        projectedPoints: Math.round(projectedPoints),
        floor: Math.round(
          (model?.floor ?? fallbackPoints * (1 - volatility)) *
            projectionMultiplier,
        ),
        ceiling: Math.round(
          (model?.ceiling ?? fallbackPoints * (1 + volatility)) *
            projectionMultiplier,
        ),
        replacementValue: 0,
        age: player.age ?? null,
        experience: player.years_exp ?? null,
        injuryStatus: player.injury_status ?? null,
        depthChartOrder,
        depthChartAdjustment,
        byeWeek: player.bye_week ?? null,
        availabilityRisk:
          model?.availability == null
            ? player.injury_status
              ? 0.25
              : 0.12
            : 1 - model.availability,
        confidence: model?.confidence ?? (player.years_exp === 0 ? 0.42 : 0.5),
        newsImpact: 0,
        projectionContext: model?.context,
        projectionSource: model
          ? "python-model"
          : player.years_exp === 0
            ? "rookie-fallback"
            : "market-fallback",
      };
    });
  const replacementPoints = new Map<DraftPosition, number>();
  for (const position of DRAFT_POSITIONS) {
    const dynamicRank = context
      ? Math.max(
          1,
          context.teams * targetForPosition(position, context.rosterPositions),
        )
      : replacementRank[position];
    const candidates = pool.filter((player) => player.position === position);
    replacementPoints.set(
      position,
      candidates[Math.min(candidates.length - 1, dynamicRank - 1)]
        ?.projectedPoints ?? 0,
    );
  }
  return pool.map((player) => ({
    ...player,
    replacementValue: Math.round(
      player.projectedPoints - (replacementPoints.get(player.position) ?? 0),
    ),
  }));
}

export function pickNumber(round: number, slot: number, teams: number) {
  return (round - 1) * teams + (round % 2 === 1 ? slot : teams - slot + 1);
}

export function managerPickNumbers(
  draft: SleeperDraft,
  rosterId: number,
  tradedPicks: TradedPick[],
) {
  const teams = draft.settings.teams;
  const rounds = draft.settings.rounds;
  const rosterSlots = new Map(
    Object.entries(draft.slot_to_roster_id).map(([slot, id]) => [
      id,
      Number(slot),
    ]),
  );
  const results: number[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    for (const [originalRoster, slot] of rosterSlots) {
      const trade = tradedPicks.find(
        (entry) => entry.round === round && entry.roster_id === originalRoster,
      );
      const owner = trade?.owner_id ?? originalRoster;
      if (owner === rosterId) results.push(pickNumber(round, slot, teams));
    }
  }
  return results.sort((a, b) => a - b);
}

export function buildManagerProfiles(
  teams: Team[],
  picks: SleeperDraftPick[],
  players: Record<string, SleeperPlayer>,
): ManagerDraftProfile[] {
  const profiles = new Map<
    string,
    {
      total: number;
      positions: Map<DraftPosition, number>;
      roundTotals: Map<DraftPosition, number>;
      roundCounts: Map<DraftPosition, number>;
    }
  >();
  const rosterOwners = new Map(
    teams.flatMap((team) =>
      team.ownerId ? [[team.rosterId, team.ownerId] as const] : [],
    ),
  );
  for (const pick of picks) {
    const ownerId = rosterOwners.get(pick.roster_id);
    const position = asPosition(
      players[pick.player_id]?.position ?? pick.metadata?.position ?? null,
    );
    if (!ownerId || !position) continue;
    const profile = profiles.get(ownerId) ?? {
      total: 0,
      positions: new Map(),
      roundTotals: new Map(),
      roundCounts: new Map(),
    };
    const weight = pick.round <= 8 ? 2 : 1;
    profile.total += weight;
    profile.positions.set(
      position,
      (profile.positions.get(position) ?? 0) + weight,
    );
    profile.roundTotals.set(
      position,
      (profile.roundTotals.get(position) ?? 0) + pick.round,
    );
    profile.roundCounts.set(
      position,
      (profile.roundCounts.get(position) ?? 0) + 1,
    );
    profiles.set(ownerId, profile);
  }
  return [...profiles].map(([ownerId, profile]) => ({
    ownerId,
    sampleSize: profile.total,
    positionShare: Object.fromEntries(
      [...profile.positions].map(([position, count]) => [
        position,
        count / profile.total,
      ]),
    ),
    averageRound: Object.fromEntries(
      [...profile.roundTotals].map(([position, total]) => [
        position,
        total / (profile.roundCounts.get(position) ?? 1),
      ]),
    ),
  }));
}

function seedFor(value: string) {
  let state = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    state = Math.imul(state ^ value.charCodeAt(index), 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateNextPickAvailability(
  player: Pick<DraftPlayer, "id" | "marketRank" | "position">,
  nextPick: number | null,
  trials = 500,
) {
  if (!nextPick) return 0;
  const random = seedFor(`${player.id}:${nextPick}`);
  const volatility =
    player.position === "RB" ? 10 : player.position === "WR" ? 9 : 7;
  let survives = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    const u1 = Math.max(Number.EPSILON, random());
    const u2 = random();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const simulatedSelection = player.marketRank + normal * volatility;
    if (simulatedSelection >= nextPick) survives += 1;
  }
  return Math.round((survives / trials) * 100);
}

export function applyNewsAnalyses(
  players: DraftPlayer[],
  analyses: NewsAnalysis[],
) {
  const effects = new Map<string, number>();
  for (const analysis of analyses) {
    if (!analysis.projectionEffect.eligible) continue;
    for (const playerId of analysis.event.playerIds) {
      effects.set(
        playerId,
        Math.max(
          -0.65,
          Math.min(
            0.25,
            (effects.get(playerId) ?? 0) + analysis.projectionEffect.percent,
          ),
        ),
      );
    }
  }
  return players.map((player) => {
    const impact = effects.get(player.id) ?? 0;
    if (!impact) return player;
    const multiplier = 1 + impact;
    return {
      ...player,
      projectedPoints: Math.max(
        0,
        Math.round(player.projectedPoints * multiplier),
      ),
      floor: Math.max(0, Math.round(player.floor * multiplier)),
      ceiling: Math.max(0, Math.round(player.ceiling * multiplier)),
      replacementValue: Math.round(
        player.projectedPoints * multiplier -
          (player.projectedPoints - player.replacementValue),
      ),
      newsImpact: impact,
      projectionSource: "news-adjusted" as const,
    };
  });
}

export function parseMarketRankCsv(csv: string) {
  const overrides = new Map<string, number>();
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (!lines.length) return overrides;
  const headers = lines[0]
    .split(",")
    .map((value) => value.trim().toLowerCase());
  const idIndex = headers.findIndex((value) =>
    ["player_id", "playerid", "sleeper_id", "id"].includes(value),
  );
  const rankIndex = headers.findIndex((value) =>
    ["rank", "adp", "overall_rank", "overall"].includes(value),
  );
  if (idIndex < 0 || rankIndex < 0) return overrides;
  for (const line of lines.slice(1)) {
    const values = line
      .split(",")
      .map((value) => value.trim().replace(/^"|"$/g, ""));
    const rank = Number(values[rankIndex]);
    if (values[idIndex] && Number.isFinite(rank) && rank > 0)
      overrides.set(values[idIndex], rank);
  }
  return overrides;
}

function rosterCounts(ids: string[], players: DraftPlayer[]) {
  const lookup = new Map(players.map((player) => [player.id, player]));
  const counts = Object.fromEntries(
    DRAFT_POSITIONS.map((position) => [position, 0]),
  ) as Record<DraftPosition, number>;
  ids.forEach((id) => {
    const position = lookup.get(id)?.position;
    if (position) counts[position] += 1;
  });
  return counts;
}

export function recommendPlayers({
  players,
  draftedIds,
  rosterIds,
  overallPick,
  nextPick,
  profile,
  personalized = true,
  league,
}: {
  players: DraftPlayer[];
  draftedIds: string[];
  rosterIds: string[];
  overallPick: number;
  nextPick: number | null;
  profile?: ManagerDraftProfile;
  personalized?: boolean;
  league?: DraftLeagueContext;
}): DraftRecommendation[] {
  const drafted = new Set(draftedIds);
  const counts = rosterCounts(rosterIds, players);
  const gap = Math.max(1, (nextPick ?? overallPick + 20) - overallPick);
  const round = Math.ceil(overallPick / (league?.teams ?? 10));
  const riskPreference = league?.riskPreference ?? "balanced";
  const rosterPlayers = rosterIds.flatMap((id) => {
    const entry = players.find((player) => player.id === id);
    return entry ? [entry] : [];
  });
  return players
    .filter((player) => !drafted.has(player.id))
    .map((player) => {
      const target = targetForPosition(
        player.position,
        league?.rosterPositions,
      );
      const need = Math.max(
        -1,
        Math.min(1, (target - counts[player.position]) / target),
      );
      const specialTeamsPenalty =
        overallPick < 120 &&
        (player.position === "K" || player.position === "DEF")
          ? 28
          : 0;
      const availabilityAtNextPick = simulateNextPickAvailability(
        player,
        nextPick,
      );
      const marketUrgency = Math.max(
        -10,
        Math.min(22, overallPick + gap - player.marketRank),
      );
      const riskScore =
        riskPreference === "floor"
          ? (player.floor - player.projectedPoints) * 0.08
          : riskPreference === "upside"
            ? (player.ceiling - player.projectedPoints) * 0.08
            : (player.ceiling - player.floor) * 0.015;
      const sameBye =
        player.byeWeek == null
          ? 0
          : rosterIds.filter(
              (id) =>
                players.find((entry) => entry.id === id)?.byeWeek ===
                player.byeWeek,
            ).length;
      const byePenalty = sameBye >= 3 ? 2 : 0;
      const teammates = rosterPlayers.filter(
        (entry) => entry.team === player.team,
      );
      const stackBoost =
        player.position === "QB"
          ? teammates.some(
              (entry) => entry.position === "WR" || entry.position === "TE",
            )
            ? 1.5
            : 0
          : player.position === "WR" || player.position === "TE"
            ? teammates.some((entry) => entry.position === "QB")
              ? 1.5
              : 0
            : 0;
      const concentrationPenalty = teammates.length >= 3 ? 2 : 0;
      const depthChartScore = player.depthChartAdjustment * 30;
      const baseScore =
        56 +
        player.replacementValue * 0.12 +
        need * 12 +
        marketUrgency * 0.45 -
        specialTeamsPenalty -
        player.availabilityRisk * 8 +
        riskScore -
        byePenalty -
        concentrationPenalty +
        depthChartScore +
        stackBoost -
        (player.injuryStatus ? 3 : 0);
      const learnedShare = profile?.positionShare[player.position] ?? 0;
      const historicalRound = profile?.averageRound[player.position];
      const roundAffinity =
        historicalRound == null
          ? 0
          : Math.max(-2, 2 - Math.abs(historicalRound - round));
      const preference =
        personalized && profile && profile.sampleSize >= 8
          ? (learnedShare - 0.18) * 16 + roundAffinity
          : 0;
      const personalizedScore = Math.max(
        1,
        Math.min(99, baseScore + preference),
      );
      const reason =
        availabilityAtNextPick < 25
          ? `${player.position}${player.positionRank} is unlikely to return at pick ${nextPick}.`
          : need > 0.45
            ? `Adds scarce ${player.position} value while filling an open roster need.`
            : `Strong value over the expected ${player.position} replacement pool.`;
      return {
        ...player,
        score: Math.round(Math.max(1, Math.min(99, baseScore))),
        personalizedScore: Math.round(personalizedScore),
        availabilityAtNextPick,
        valueOverReplacement: player.replacementValue,
        rosterNeed: need,
        reason,
      };
    })
    .sort(
      (a, b) =>
        b.personalizedScore - a.personalizedScore ||
        a.marketRank - b.marketRank,
    );
}
