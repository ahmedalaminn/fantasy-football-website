# UD Fantasy Football

A public league hub powered by the Sleeper API, with current matchups, standings, transactions, team pages, historical drafts, records, rivalries, and a Hall of Champions.

## Features

- Live matchup scores and completed-week results.
- Power rankings combining points scored, all-play record, and actual record with 40% / 40% / 20% weights. Rankings use completed weeks and scale category points to league size.
- Activity cards showing managers, players, trades, draft picks, and FAAB moves.
- Best ball draft reports using the configured league's actual Sleeper picks, with color-coded value ratings against a frozen Sleeper ADP benchmark, scoring outperformers and underperformers, and a drafted/undrafted filter.
- Light mode by default, with a saved light/dark toggle on desktop and mobile.

## Local development

Set the newest Sleeper league ID in `.env.local`:

```bash
LEAGUE_ID=your_newest_sleeper_league_id
```

The app follows Sleeper's `previous_league_id` links to build league history.

```bash
npm install
npm run dev
```

League copy, manager profiles, champion stories, rules, and resource links live in `src/lib/content.ts`. Empty optional profile fields are hidden automatically.

## Best ball draft report

Open `/best-ball` to review the configured league's latest Sleeper draft in a round-by-manager board. Each pick shows only its rating color, player photo, and name. Hover or focus a pick for a preview, or select it to open full details. The completed draft has no automatic refresh. The page uses a frozen **Sleeper PPR ADP snapshot captured October 12, 2026**, archived in `src/data/sleeper-adp-2026.json`. Source: https://api.sleeper.com/projections/nfl/2026?season_type=regular. The snapshot contains 2,440 QB/RB/WR/TE/K/DEF entries with finite ADP greater than zero and below the 999 placeholder. All 170 original draft picks have ADP coverage. The endpoint's historical cutoff is unverified, so the capture date is displayed separately from the August 30 draft date. The saved ADP never refreshes during the season. Other seasons remain unrated. ESPN and LineupBeat datasets are no longer used.

Board colors reflect current-season positional scoring versus frozen Sleeper ADP order: green for outperformance, red for underperformance, yellow for unchanged rank, and gray for missing rankings or scoring. These ranks match the performance tabs. Pick details show both a current-season state (rank movement, expected/current positional ranks, and fantasy points) and a separate draft-value state (expected overall pick (ADP), actual pick, and steal / just right / reach rating). Draft-value ratings compare actual pick number with frozen Sleeper ADP, with a threshold of 10% of ADP and a minimum of three picks. All summary values include pick, rank, or fantasy-point units.

The outperformers and underperformers tabs compare positional scoring rank with positional frozen Sleeper ADP order among players with league matchup scoring data, using completed weeks only. Outperformers have positive gains and sort by the largest gain; underperformers have negative gains and sort by the largest shortfall. Both tabs share an All players / Undrafted only / Drafted only filter. Draft status means selected in the original draft, regardless of later waiver moves. Filtering preserves the full comparison ranks.

## Validation

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Rating explanations use the shared `InfoPopover` component (`src/components/info-popover.tsx`): a hover/focus/click info icon with titled bullet groups, source links, viewport bounds, and a close button. Best ball and standings use the same pattern.
