import { NextResponse } from "next/server";
import { analyzeNews, fetchArticle, knownPlayerCandidates, manualSource } from "@/lib/news-server";
import { getPlayers } from "@/lib/sleeper";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 220_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = await request.json() as {
      url?: unknown; text?: unknown; title?: unknown; publisher?: unknown; publishedAt?: unknown;
    };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const suppliedText = typeof body.text === "string" ? body.text.trim() : "";
    if (!url && !suppliedText) {
      return NextResponse.json({ error: "Provide an article URL or article text." }, { status: 400 });
    }
    const article = url ? await fetchArticle(url) : {
      text: suppliedText,
      source: manualSource({
        title: typeof body.title === "string" ? body.title : null,
        publisher: typeof body.publisher === "string" ? body.publisher : "Manual article",
        publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : null,
      }),
    };
    const sleeperPlayers = await getPlayers();
    const fantasyPositions = new Set(["QB", "RB", "WR", "TE", "K"]);
    const allPlayers = Object.entries(sleeperPlayers).flatMap(([id, player]) =>
      player.full_name && player.position && fantasyPositions.has(player.position)
        ? [{ id, name: player.full_name }]
        : [],
    );
    const analysis = await analyzeNews({
      ...article,
      knownPlayers: knownPlayerCandidates(article.text, allPlayers),
    });
    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Article analysis failed." },
      { status: 400 },
    );
  }
}
