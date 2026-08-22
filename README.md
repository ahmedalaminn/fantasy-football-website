# UD Fantasy Football

A modern, public league hub powered directly by the Sleeper API. It includes current matchups, standings, power rankings, transactions, team pages, historical drafts, records, rivalries, and a Hall of Champions.

The AI Assistant adds manager-aware live and mock draft help. Python owns the
projection training pipeline in `ml/`; the Next.js app consumes its versioned
artifact and combines it with live Sleeper draft state. See `ml/README.md` for
model setup and data provenance.

For the complete architecture, model comparison, validation metrics, feature
contract, and current limitations, see [`docs/ml-pipeline.md`](docs/ml-pipeline.md).

The projection feature contract is intentionally layered: direct fantasy
scoring fields are the core model, Sleeper supplies league and live-draft
context, and validated nflverse team/coaching/schedule signals are supplemental.
Advanced metrics remain research-only until season-forward tests earn their use.

## Local development

Set the newest Sleeper league ID in `.env.local`:

```bash
LEAGUE_ID=your_newest_sleeper_league_id
# Optional: enables Gemini-first news extraction. Without it, rules are used.
GEMINI_API_KEY=your_google_ai_studio_key
# Optional override; defaults to the current free-tier Flash-Lite model.
GEMINI_NEWS_MODEL=gemini-3.5-flash-lite
# Optional override for the initially selected manager.
ASSISTANT_DEFAULT_USER_ID=your_sleeper_user_id
```

The app follows Sleeper's `previous_league_id` links automatically to build league history. Then run:

```bash
npm install
npm run dev
```

Human-authored copy, manager profiles, champion stories, rules, and resource links live in `src/lib/content.ts`. Empty optional profile fields are hidden automatically.

## Draft and news assistant

The `/assistant` workspace supports live Sleeper polling, mock drafting,
manager selection, Monte Carlo next-pick availability, roster/scoring-aware
recommendations, risk styles, player comparisons, and optional ADP CSV files
with `sleeper_id,rank` columns.

The News Terminal accepts public HTTPS URLs or pasted public text. Successful
Gemini extractions use the Next.js data cache for 30 days. Missing credentials,
quota errors, timeouts, and invalid model output fall back to deterministic
rules for five minutes. Only high-confidence injury, inactive, or suspension
events can trigger bounded numeric changes; softer reports remain explanatory.
