# UD Fantasy Football

A modern, public league hub powered directly by the Sleeper API. It includes current matchups, standings, power rankings, transactions, team pages, historical drafts, records, rivalries, and a Hall of Champions.

## Local development

Set the newest Sleeper league ID in `.env.local`:

```bash
LEAGUE_ID=your_newest_sleeper_league_id
```

The app follows Sleeper's `previous_league_id` links automatically to build league history. Then run:

```bash
npm install
npm run dev
```

Human-authored copy, manager profiles, champion stories, rules, and resource links live in `src/lib/content.ts`. Empty optional profile fields are hidden automatically.
