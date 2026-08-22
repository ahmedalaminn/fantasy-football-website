import "server-only";

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import {
  NEWS_PROMPT_VERSION,
  NEWS_SCHEMA_VERSION,
  extractWithRules,
  projectionEffect,
  validateNewsEvent,
  type ArticleInput,
  type KnownPlayer,
  type NewsAnalysis,
  type NewsEvent,
  type NewsSource,
} from "./news";
import { assertPublicUrl } from "./public-url";

const ARTICLE_LIMIT = 200_000;
const GEMINI_TEXT_LIMIT = 16_000;
const SUCCESS_TTL = 60 * 60 * 24 * 30;
const FAILURE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export interface NewsExtractor {
  extract(input: ArticleInput): Promise<NewsEvent>;
}

type FailureEntry = { expiresAt: number; event: NewsEvent };
const globalNews = globalThis as typeof globalThis & {
  __udNewsFailures?: Map<string, FailureEntry>;
  __udNewsInflight?: Map<string, Promise<NewsAnalysis>>;
};
const failures = globalNews.__udNewsFailures ?? (globalNews.__udNewsFailures = new Map());
const inflight = globalNews.__udNewsInflight ?? (globalNews.__udNewsInflight = new Map());

async function limitedText(response: Response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > ARTICLE_LIMIT) throw new Error("Article is larger than 200 KB.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > ARTICLE_LIMIT) {
      await reader.cancel();
      throw new Error("Article is larger than 200 KB.");
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

function decodeHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ").trim();
}

export async function fetchArticle(value: string) {
  const url = await assertPublicUrl(value);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "text/html,text/plain;q=0.9", "User-Agent": "UD-Fantasy-News/1.0" },
  });
  if (!response.ok) throw new Error(`Article request failed (${response.status}).`);
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error("Article URL must return HTML or plain text.");
  }
  const raw = await limitedText(response);
  const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    text: contentType.includes("text/html") ? decodeHtml(raw) : raw.replace(/\s+/g, " ").trim(),
    source: {
      url: url.toString(), title: title ? decodeHtml(title).slice(0, 180) : null,
      publisher: url.hostname, publishedAt: null,
    } satisfies NewsSource,
  };
}

const responseSchema = {
  type: "object",
  properties: {
    eventType: { type: "string", enum: ["injury", "suspension", "inactive", "transaction", "role_change", "coach_quote", "other"] },
    playerNames: { type: "array", items: { type: "string" } },
    status: { type: "string" }, roleDirection: { type: "string", enum: ["up", "down", "neutral"] },
    magnitude: { type: "string", enum: ["low", "medium", "high"] },
    effectiveAt: { type: ["string", "null"] }, expectedDuration: { type: ["string", "null"] },
    confidence: { type: "number" }, sourceCredibility: { type: "number" },
    evidence: { type: "string" }, summary: { type: "string" },
  },
  required: ["eventType", "playerNames", "status", "roleDirection", "magnitude", "effectiveAt", "expectedDuration", "confidence", "sourceCredibility", "evidence", "summary"],
};

class GeminiExtractor implements NewsExtractor {
  constructor(private key: string, private model: string) {}

  async extract(input: ArticleInput) {
    const names = input.knownPlayers.map((player) => player.name).join(", ");
    const prompt = `Extract one primary fantasy-football news event as JSON. Use only the supplied article; do not infer facts not stated. Match players only from this candidate list: ${names || "none"}. Coach optimism and speculative role language must be coach_quote or role_change, never an injury. Evidence must be a short exact excerpt.\n\nARTICLE:\n${input.text.slice(0, GEMINI_TEXT_LIMIT)}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: "POST", signal: AbortSignal.timeout(12_000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: .1, responseMimeType: "application/json", responseJsonSchema: responseSchema },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini request failed (${response.status}).`);
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no structured event.");
    const event = validateNewsEvent(JSON.parse(text), input, "gemini");
    if (!event) throw new Error("Gemini returned an invalid event schema.");
    return event;
  }
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, ARTICLE_LIMIT);
}

function remap(event: NewsEvent, input: ArticleInput): NewsEvent {
  const names = new Set(event.playerNames.map((name) => name.toLowerCase()));
  const players = input.knownPlayers.filter((player) => names.has(player.name.toLowerCase()));
  return { ...event, playerIds: players.map((player) => player.id), playerNames: players.map((player) => player.name), source: input.source };
}

async function runAnalysis(input: ArticleInput, hash: string): Promise<NewsAnalysis> {
  const failure = failures.get(hash);
  if (failure && failure.expiresAt > Date.now()) {
    const event = remap(failure.event, input);
    return { event, projectionEffect: projectionEffect(event), cacheStatus: "fallback", contentHash: hash };
  }
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_NEWS_MODEL || DEFAULT_MODEL;
  if (!key) {
    const event = extractWithRules(input);
    failures.set(hash, { event, expiresAt: Date.now() + FAILURE_TTL_MS });
    return { event, projectionEffect: projectionEffect(event), cacheStatus: "fallback", contentHash: hash };
  }
  let executed = false;
  try {
    const cached = unstable_cache(
      async () => { executed = true; return new GeminiExtractor(key, model).extract(input); },
      [`assistant-news-${hash}`], { revalidate: SUCCESS_TTL, tags: [`assistant-news-${hash}`] },
    );
    const event = remap(await cached(), input);
    return { event, projectionEffect: projectionEffect(event), cacheStatus: executed ? "miss" : "hit", contentHash: hash };
  } catch {
    const event = extractWithRules(input);
    failures.set(hash, { event, expiresAt: Date.now() + FAILURE_TTL_MS });
    return { event, projectionEffect: projectionEffect(event), cacheStatus: "fallback", contentHash: hash };
  }
}

export async function analyzeNews(input: ArticleInput): Promise<NewsAnalysis> {
  const normalized: ArticleInput = { ...input, text: normalize(input.text) };
  if (normalized.text.length < 20) throw new Error("Provide at least 20 characters of article text.");
  const model = process.env.GEMINI_NEWS_MODEL || DEFAULT_MODEL;
  const hash = createHash("sha256")
    .update(`${NEWS_SCHEMA_VERSION}|${NEWS_PROMPT_VERSION}|${model}|${normalized.text}`)
    .digest("hex");
  const existing = inflight.get(hash);
  if (existing) return existing;
  const promise = runAnalysis(normalized, hash).finally(() => inflight.delete(hash));
  inflight.set(hash, promise);
  return promise;
}

export function manualSource(source?: Partial<NewsSource>): NewsSource {
  return {
    url: source?.url || null, title: source?.title?.slice(0, 180) || null,
    publisher: source?.publisher?.slice(0, 100) || null,
    publishedAt: source?.publishedAt || null,
  };
}

export function knownPlayerCandidates(text: string, players: KnownPlayer[]) {
  const lower = text.toLowerCase();
  const direct = players.filter((player) => lower.includes(player.name.toLowerCase()));
  return direct.length ? direct.slice(0, 20) : players.slice(0, 500);
}
