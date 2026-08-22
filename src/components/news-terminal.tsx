"use client";

import { useState } from "react";
import type { NewsAnalysis } from "@/lib/news";
import { Badge } from "./ui";
import { SleeperPlayerLink } from "./sleeper-player-link";

export function NewsTerminal({
  analyses,
  onAnalysis,
}: {
  analyses: NewsAnalysis[];
  onAnalysis: (analysis: NewsAnalysis) => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(url.trim() ? { url: url.trim() } : { text: text.trim() }),
      });
      const payload = await response.json() as NewsAnalysis | { error?: string };
      if (!response.ok || !("event" in payload)) {
        throw new Error("error" in payload ? payload.error : "Article analysis failed.");
      }
      onAnalysis(payload);
      setUrl("");
      setText("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Article analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="news-terminal-grid">
      <section className="assistant-card news-analyzer">
        <span className="eyebrow">Gemini-first signal processing</span>
        <h2>Analyze public NFL news</h2>
        <p>
          Paste a public HTTPS article URL or its text. Results are cached; rules take over automatically if Gemini is unavailable.
        </p>
        <label>
          <span>Article URL</span>
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" />
        </label>
        <div className="news-divider"><span>or</span></div>
        <label>
          <span>Article text</span>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a public article excerpt or report…" rows={9} />
        </label>
        {error && <p className="news-error" role="alert">{error}</p>}
        <button className="button button-primary" disabled={loading || (!url.trim() && text.trim().length < 20)} onClick={analyze}>
          {loading ? "Analyzing…" : "Analyze signal"}
        </button>
        <small>Only high-confidence availability events can change projections. Coach quotes remain context-only.</small>
      </section>

      <section className="assistant-card news-feed">
        <div className="panel-heading">
          <div><span className="eyebrow">Event timeline</span><h2>{analyses.length} signals</h2></div>
        </div>
        {analyses.length ? analyses.map((analysis) => (
          <article key={`${analysis.contentHash}-${analysis.event.processor}`}>
            <div className="news-event-meta">
              <Badge tone={analysis.event.processor === "gemini" ? "aqua" : "neutral"}>{analysis.event.processor}</Badge>
              <Badge tone={analysis.projectionEffect.eligible ? "violet" : "neutral"}>
                {analysis.projectionEffect.eligible ? `${Math.round(analysis.projectionEffect.percent * 100)}% projection` : "Context only"}
              </Badge>
              <span>{analysis.cacheStatus}</span>
            </div>
            <h3>{analysis.event.summary}</h3>
            <p>{analysis.event.evidence || analysis.projectionEffect.reason}</p>
            <small>
              {analysis.event.playerNames.length
                ? analysis.event.playerNames.map((name, index) => {
                    const id = analysis.event.playerIds[index];
                    return id ? (
                      <span key={id}>
                        {index > 0 ? ", " : ""}
                        <SleeperPlayerLink id={id} name={name} />
                      </span>
                    ) : null;
                  })
                : "No player matched"} · {Math.round(analysis.event.confidence * 100)}% confidence
              {analysis.event.source.publisher ? ` · ${analysis.event.source.publisher}` : ""}
            </small>
          </article>
        )) : <p className="assistant-empty">No news has been analyzed in this session.</p>}
      </section>
    </div>
  );
}
