export const NEWS_SCHEMA_VERSION = 1;
export const NEWS_PROMPT_VERSION = "2026-08-22";

export type NewsEventType =
  | "injury"
  | "suspension"
  | "inactive"
  | "transaction"
  | "role_change"
  | "coach_quote"
  | "other";
export type NewsDirection = "up" | "down" | "neutral";
export type NewsMagnitude = "low" | "medium" | "high";
export type NewsProcessor = "gemini" | "rules";

export interface NewsSource {
  url: string | null;
  title: string | null;
  publisher: string | null;
  publishedAt: string | null;
}

export interface NewsEvent {
  eventType: NewsEventType;
  playerIds: string[];
  playerNames: string[];
  status: string;
  roleDirection: NewsDirection;
  magnitude: NewsMagnitude;
  effectiveAt: string | null;
  expectedDuration: string | null;
  confidence: number;
  sourceCredibility: number;
  evidence: string;
  summary: string;
  processor: NewsProcessor;
  source: NewsSource;
}

export interface ProjectionEffect {
  eligible: boolean;
  percent: number;
  reason: string;
}

export interface NewsAnalysis {
  event: NewsEvent;
  projectionEffect: ProjectionEffect;
  cacheStatus: "hit" | "miss" | "fallback";
  contentHash: string;
}

export interface KnownPlayer {
  id: string;
  name: string;
}

export interface ArticleInput {
  text: string;
  source: NewsSource;
  knownPlayers: KnownPlayer[];
}

const EVENT_TYPES = new Set<NewsEventType>([
  "injury", "suspension", "inactive", "transaction", "role_change", "coach_quote", "other",
]);
const DIRECTIONS = new Set<NewsDirection>(["up", "down", "neutral"]);
const MAGNITUDES = new Set<NewsMagnitude>(["low", "medium", "high"]);

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.max(minimum, Math.min(maximum, value));

function shortText(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function identifyPlayers(text: string, knownPlayers: KnownPlayer[]) {
  const haystack = text.toLocaleLowerCase();
  const matches = new Map<string, KnownPlayer>();
  for (const player of knownPlayers) {
    const key = player.name.toLocaleLowerCase();
    if (player.name.length >= 5 && haystack.includes(key) && !matches.has(key)) {
      matches.set(key, player);
    }
  }
  return [...matches.values()];
}

export function validateNewsEvent(
  value: unknown,
  input: ArticleInput,
  processor: NewsProcessor,
): NewsEvent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const eventType = EVENT_TYPES.has(record.eventType as NewsEventType)
    ? (record.eventType as NewsEventType)
    : null;
  const roleDirection = DIRECTIONS.has(record.roleDirection as NewsDirection)
    ? (record.roleDirection as NewsDirection)
    : null;
  const magnitude = MAGNITUDES.has(record.magnitude as NewsMagnitude)
    ? (record.magnitude as NewsMagnitude)
    : null;
  if (!eventType || !roleDirection || !magnitude) return null;

  const mentioned = identifyPlayers(input.text, input.knownPlayers);
  const proposedNames = Array.isArray(record.playerNames)
    ? record.playerNames.filter((name): name is string => typeof name === "string")
    : [];
  const matched = mentioned.filter((player) =>
    proposedNames.length === 0 || proposedNames.some((name) => name.toLowerCase() === player.name.toLowerCase()),
  );
  const confidence = clamp(Number(record.confidence));
  if (!Number.isFinite(confidence)) return null;
  return {
    eventType,
    playerIds: matched.map((player) => player.id),
    playerNames: matched.map((player) => player.name),
    status: shortText(record.status, 80) || "reported",
    roleDirection,
    magnitude,
    effectiveAt: shortText(record.effectiveAt, 40) || null,
    expectedDuration: shortText(record.expectedDuration, 80) || null,
    confidence,
    sourceCredibility: clamp(Number(record.sourceCredibility) || sourceCredibility(input.source.url)),
    evidence: shortText(record.evidence, 280),
    summary: shortText(record.summary, 360) || "Football news event detected.",
    processor,
    source: input.source,
  };
}

export function sourceCredibility(url: string | null) {
  if (!url) return .55;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "nfl.com" || host.endsWith(".nfl.com")) return .95;
    if (host === "espn.com" || host.endsWith(".espn.com")) return .85;
    if (host.includes("sleeper")) return .8;
  } catch {
    return .45;
  }
  return .65;
}

export function extractWithRules(input: ArticleInput): NewsEvent {
  const text = input.text.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const players = identifyPlayers(text, input.knownPlayers);
  let eventType: NewsEventType = "other";
  let direction: NewsDirection = "neutral";
  let magnitude: NewsMagnitude = "low";
  let status = "reported";
  let confidence = .45;

  if (/\b(suspend(?:ed|sion)?|banned)\b/.test(lower)) {
    eventType = "suspension"; direction = "down"; magnitude = "high";
    status = "suspended"; confidence = .94;
  } else if (/\b(inactive|ruled out|will not play)\b/.test(lower)) {
    eventType = "inactive"; direction = "down"; magnitude = "high";
    status = "out"; confidence = .92;
  } else if (/\b(injured reserve|season[- ]ending|torn (acl|achilles))\b/.test(lower)) {
    eventType = "injury"; direction = "down"; magnitude = "high";
    status = lower.includes("season") ? "season-ending" : "injured reserve"; confidence = .92;
  } else if (/\b(injur(?:y|ed)|questionable|doubtful|limited practice)\b/.test(lower)) {
    eventType = "injury"; direction = "down";
    magnitude = /\b(doubtful|will miss|weeks)\b/.test(lower) ? "medium" : "low";
    status = lower.includes("doubtful") ? "doubtful" : lower.includes("questionable") ? "questionable" : "injured";
    confidence = .72;
  } else if (/\b(traded|signed|released|waived|activated)\b/.test(lower)) {
    eventType = "transaction"; magnitude = "medium"; status = "transaction"; confidence = .86;
  } else if (/\b(more involved|larger role|starting role|named the starter)\b/.test(lower)) {
    eventType = /coach|head coach|offensive coordinator/.test(lower) ? "coach_quote" : "role_change";
    direction = "up"; magnitude = "medium"; status = "role increase reported"; confidence = .66;
  } else if (/\b(demoted|reduced role|fewer touches|backup role)\b/.test(lower)) {
    eventType = "role_change"; direction = "down"; magnitude = "medium";
    status = "role decrease reported"; confidence = .68;
  }

  return {
    eventType, playerIds: players.map((player) => player.id),
    playerNames: players.map((player) => player.name), status,
    roleDirection: direction, magnitude, effectiveAt: null, expectedDuration: null,
    confidence, sourceCredibility: sourceCredibility(input.source.url),
    evidence: text.slice(0, 280),
    summary: `${status[0].toUpperCase()}${status.slice(1)}${players.length ? `: ${players.map((player) => player.name).join(", ")}` : "."}`,
    processor: "rules", source: input.source,
  };
}

export function projectionEffect(event: NewsEvent): ProjectionEffect {
  const officialEnough = event.confidence >= .8 && event.sourceCredibility >= .65;
  if (!officialEnough || event.playerIds.length === 0) {
    return { eligible: false, percent: 0, reason: "Displayed as context; confidence or player identity is insufficient." };
  }
  if (event.eventType === "coach_quote" || event.eventType === "role_change" || event.eventType === "other") {
    return { eligible: false, percent: 0, reason: "Soft role reports are explanation-only until historical backtests validate them." };
  }
  const status = event.status.toLowerCase();
  let percent = 0;
  if (status.includes("season-ending")) percent = -.6;
  else if (event.eventType === "suspension") percent = -.25;
  else if (event.eventType === "inactive" || status === "out") percent = -.18;
  else if (status.includes("injured reserve")) percent = -.3;
  else if (status.includes("doubtful")) percent = -.08;
  else if (status.includes("questionable") || event.eventType === "injury") percent = -.04;
  return percent
    ? { eligible: true, percent, reason: "Bounded deterministic adjustment from a high-confidence availability event." }
    : { eligible: false, percent: 0, reason: "No approved deterministic adjustment applies." };
}
