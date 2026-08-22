import { describe, expect, it } from "vitest";
import { extractWithRules, projectionEffect, validateNewsEvent, type ArticleInput } from "./news";

const article = (text: string): ArticleInput => ({
  text,
  source: { url: "https://www.nfl.com/news/example", title: "Report", publisher: "NFL", publishedAt: null },
  knownPlayers: [{ id: "123", name: "Josh Allen" }],
});

describe("news extraction", () => {
  it("turns an official suspension into a bounded deterministic effect", () => {
    const event = extractWithRules(article("The NFL announced Josh Allen has been suspended for four games."));
    expect(event.eventType).toBe("suspension");
    expect(event.playerIds).toEqual(["123"]);
    expect(projectionEffect(event)).toMatchObject({ eligible: true, percent: -.25 });
  });

  it("keeps coach involvement quotes explanation-only", () => {
    const event = extractWithRules(article("The head coach said Josh Allen will be more involved this season."));
    expect(event.eventType).toBe("coach_quote");
    expect(projectionEffect(event).eligible).toBe(false);
  });

  it("rejects malformed Gemini output and maps known player IDs", () => {
    expect(validateNewsEvent({ eventType: "made-up" }, article("Josh Allen news report with enough text."), "gemini")).toBeNull();
    const event = validateNewsEvent({
      eventType: "injury", playerNames: ["Josh Allen"], status: "questionable",
      roleDirection: "down", magnitude: "low", confidence: .9,
      sourceCredibility: .9, evidence: "Josh Allen is questionable.", summary: "Questionable",
    }, article("Josh Allen is questionable after practice today."), "gemini");
    expect(event?.playerIds).toEqual(["123"]);
  });
});
