# Fantasy Draft Assistant ML Pipeline

## Executive summary

The lowest raw-MAE model developed so far was the earlier 75-feature PBP model.
The current 40-feature context model is the better production choice: its MAE
is only 0.018 fantasy points per game worse, while it is smaller, more
explainable, includes coaching and schedule context, and produces better
prediction-interval coverage.

| Model | Features | MAE | Improvement vs baseline | P20-P80 coverage | Status |
|---|---:|---:|---:|---:|---|
| Prior-season points | — | 3.004 | — | — | Baseline |
| Core fantasy stats | 13 | 2.732 | 9.1% | Not measured | Comparator |
| All-feature PBP | 75 | **2.622** | **12.7%** | 44.1% | Superseded |
| Current compact context | 40 | 2.640 | 12.1% | **49.7%** | Production |

MAE is measured in next-season fantasy points per active game, not total season
points. The difference between the all-feature and compact models is 0.018 PPG,
or roughly 0.3 points across 17 games. We have not calculated confidence
intervals establishing that this difference is statistically significant.

The current supplemental feature set improved on the core-only model in every
recent held-out season:

| Forecast season | Production MAE | Prior-season baseline MAE |
|---|---:|---:|
| 2021 | 2.700 | 3.134 |
| 2022 | 2.481 | 2.845 |
| 2023 | 2.703 | 3.042 |
| 2024 | 2.838 | 3.062 |
| 2025 | 2.488 | 2.940 |
| **Combined** | **2.640** | **3.004** |

The production model improves on the core-only model by 0.092 PPG, or about
3.4%. Its P20-P80 interval contains 49.7% of outcomes. A calibrated 20th-to-80th
percentile range should contain approximately 60%, so the current intervals
remain too narrow.

## Model types

Numeric player projections use scikit-learn gradient-boosted decision trees:

- `HistGradientBoostingRegressor`
- Median imputation with missing-value indicators
- Position-specific models for QB, RB, WR, and TE
- Exponential recency weighting with a five-season half-life
- L2 regularization
- 180 boosting iterations
- A maximum of 24 leaf nodes
- A minimum of 15 samples per leaf

Four estimators are trained for every supported position:

1. 20th-percentile points per active game
2. Median points per active game
3. 80th-percentile points per active game
4. Next-season availability

This produces 16 fitted estimators:

```text
4 positions x 4 outcomes = 16 models
```

These are tree-based regression models, not neural networks, deep-learning
models, or LLMs.

## End-to-end architecture

```text
nflverse PBP, schedules, draft/combine data, and player IDs
                              |
                              v
             Player-week and team-week aggregation
                              |
                              v
        Player-season, team, coaching, and schedule features
                              |
                              v
           Position-specific gradient-boosted models
                              |
                              v
              Versioned 2026 projection artifact
                              |
                              v
     Sleeper league settings, players, and live draft state
                              |
                              v
        Scoring, depth-chart, news, and roster adjustments
                              |
                              v
          Replacement-value and draft recommendation engine
```

Python trains the shared football projection offline. Python does not run during
website requests. Next.js reads the exported artifact and applies current
Sleeper and draft context.

## 1. Data acquisition

The Python pipeline downloads and caches:

- nflverse regular-season play-by-play from 1999 through 2025
- nflverse historical and current schedules
- nflverse combine measurements and draft capital
- DynastyProcess player-ID mappings
- An optional maintained coaching-staff CSV

Next.js separately retrieves current Sleeper players, league rules, rosters,
drafts, traded picks, injuries, statuses, depth charts, and market search rank.

Raw downloads, processed tables, and fitted model files are cached locally so
normal runs do not need to download and process the complete history again.

## 2. Play-by-play aggregation

Every PBP event is assigned to its passer, rusher, receiver, offensive team, and
opposing defense. The pipeline creates canonical player-week and team-week
tables, then aggregates those tables into player-season and team-season rows.

```text
Raw plays
   -> player-game/player-week rows
   -> team-week rows
   -> player-season/team-season rows
```

Fantasy points are reconstructed from passing, rushing, receiving, turnover,
and two-point-conversion components under a full-PPR training profile.

## 3. Feature contract

The research table contains 92 available numeric fields, but only 40 are active
Python model inputs. Sleeper contributes another 10 live context fields to the
website optimizer.

### Core scoring: 13 active features

- Games played
- Passing yards and touchdowns
- Interceptions
- Rushing yards and touchdowns
- Receptions
- Receiving yards and touchdowns
- Fumbles lost
- Two-point conversions
- Fantasy points
- Points per game

These directly determine fantasy scoring or the availability denominator.

### Validated supplemental context: 27 active features

- Pass attempts, carries, targets, and opportunities per game
- Recent four-game and eight-game form
- Missed games
- Age, career seasons, and draft capital
- Opportunity share
- Team plays per game, pass rate, and scoring rate
- Forecast team volume, pass rate, and scoring rate
- Head-coach experience and continuity
- Historical head-coach pass rate, scoring rate, and EPA
- Position-specific full-season strength of schedule
- Playoff-week strength of schedule

### Sleeper production context: 10 fields

- League scoring settings
- Roster positions and FLEX eligibility
- Number of teams
- Draft order and traded picks
- Live player availability
- Player status and injury information
- Depth-chart order
- Market search rank

These are applied by Next.js rather than fitted by the Python model.

### Research-only: 52 features

Research fields include CPOE, WOPR, RACR, aDOT, detailed EPA and success rates,
air-yard share, red-zone subdivisions, weekly boom/bust metrics, combine
measurements, offensive-staff fields, and other detailed play metrics.

They remain available for ablation studies but are excluded from production
until they demonstrate stable season-forward improvement.

## 4. Team environment

Team context estimates how much opportunity and scoring an offense can support.
Active team features include:

- Plays per game
- Pass rate
- Scoring rate
- Player opportunity share
- Forecast offensive volume
- Forecast pass/run balance
- Forecast scoring environment

These affect positions differently. High pass volume benefits quarterbacks and
pass catchers, while rushing volume and scoring opportunities support running
backs. The tree models learn these nonlinear interactions separately by
position.

## 5. Coaching context

For each forecast season, the pipeline identifies the team's head coach and
calculates:

- Prior NFL coaching seasons
- Same-team continuity
- Historical pass rate
- Historical scoring rate
- Historical EPA per play

All historical tendencies are shifted. A 2026 coaching row can use performance
through 2025 but cannot use 2026 results.

Coaches are not manually labeled as good or bad. The model receives measurable
history and determines whether it predicts subsequent player performance.

Offensive coordinator and play-caller columns are supported by
`ml/config/coaching_staff.csv`, but remain research-only until reliable
point-in-time historical coverage is populated.

## 6. Strength of schedule

For every scheduled opponent, the pipeline calculates prior-season:

- Defensive EPA allowed
- Touchdown rate allowed
- Fantasy points allowed by position

The current schedule is then used to create:

- Full-season defensive difficulty
- Position-specific schedule difficulty
- Weeks 15-17 playoff schedule difficulty

For the 2026 forecast, schedule ratings use 2025 defensive performance. This
prevents future-game leakage.

## 7. Training targets

A player's season `S` features predict season `S+1`:

```text
2024 features -> 2025 PPG and availability
2025 features -> 2026 forecast
```

Production and availability are modeled separately:

- `next_points_per_game`: fantasy points conditional on being active
- `next_availability`: share of scheduled games expected to be played

This prevents missed games from being treated as ordinary low-productivity
games.

## 8. Missing data and recency

Each model uses median imputation and automatically adds missing-value
indicators. This supports older seasons, missing combine measurements,
incomplete staff records, and players with limited history.

Training examples receive exponential recency weights:

```text
weight = 0.5 ^ ((newest season - row season) / 5)
```

Recent seasons therefore matter most, while older football still contributes
career, aging, and coaching priors.

## 9. Rolling validation

Validation is season-forward rather than randomly shuffled:

```text
Train on earlier seasons
        -> predict the next held-out season
        -> compare prediction with actual PPG
```

The current artifact evaluates 2,179 player-seasons across forecast seasons
2021 through 2025. No validation fold trains on a season later than its held-out
season.

The prior-season-points baseline predicts that the player's next-season PPG
will equal their current PPG.

## 10. Season distribution export

The fitted models produce:

- P20 points per game
- Median points per game
- P80 points per game
- Availability probability

Availability is clipped to a safe range and converted to expected games. The
website artifact then contains season-level floor, median, and ceiling values:

```text
Median season points = median PPG x expected games
Floor = P20 PPG x approximately one fewer game
Ceiling = P80 PPG x approximately one additional game
```

The current schema-3 artifact forecasts 579 Sleeper-mapped players for 2026.

## 11. Website inference context

Next.js combines the Python projection with current Sleeper information:

- Reception scoring
- Passing-touchdown scoring
- Current player team and status
- Injury information
- Current depth-chart role
- Market rank
- League roster requirements
- Replacement level
- Live drafted-player removals
- Manager roster and pick inventory

The Python artifact is shared across managers. Personalization occurs in the
optimizer, not by fine-tuning a separate player model for every manager.

## 12. Depth-chart adjustment

Sleeper roles such as `RB1`, `WR2`, and `TE1` are applied after Python inference.
The adjustment is bounded:

- Leading roles: up to +5%
- Secondary roles: neutral or a small adjustment
- Deep backups: approximately -4% to -8%

Current depth chart is not trained inside Python because reliable historical,
point-in-time Sleeper depth-chart snapshots are not yet available. Applying it
at inference time avoids leaking present-day roles into historical rows.

## 13. Draft optimizer

The final draft score combines:

- Value over replacement
- Roster need
- Position scarcity
- Market urgency
- Expected availability at the manager's next pick
- Injury and availability risk
- Current depth-chart role
- Floor/upside preference
- Bye-week concentration
- QB/pass-catcher correlation
- Manager drafting tendencies

Next-pick availability uses a deterministic seeded Monte Carlo-style simulation
around market rank. It is not a separately trained ML model.

## 14. News and Gemini

Gemini is a structured news extractor, not the numeric projection model. It
classifies public reports into events such as injuries, suspensions, inactive
status, transactions, and role commentary.

Gemini does not directly add or remove fantasy points. Only high-confidence
official availability events can trigger bounded deterministic projection
changes. Softer coach quotes and speculative role reports remain explanatory.

## Fallbacks

- Rookies use market, draft-capital, and rule-based fallbacks because they have
  no NFL PBP history.
- Kickers and team defenses use transparent market/rule fallbacks.
- Unmapped players remain eligible through Sleeper market rank.
- Missing or stale ML artifacts fall back to market projections.
- News processing falls back to cached extraction and deterministic rules when
  Gemini is unavailable.

## Current limitations

1. P20-P80 coverage is 49.7%, below the desired approximately 60%.
2. Validation metrics are aggregated instead of reported separately by position.
3. The Python target is full PPR; other league scoring uses approximate website
   adjustments rather than component-level rescoring or retraining.
4. Rookies, kickers, and defenses are not covered by the main trained models.
5. Offensive coordinator and play-caller history is incomplete.
6. Current depth-chart influence is deterministic because historical snapshots
   are unavailable.
7. Player team changes can cause the artifact's original team context to lag
   current Sleeper information.
8. Strength of schedule uses prior-season defense and does not fully account for
   defensive personnel changes.
9. The all-feature versus compact-model difference has not been tested for
   statistical significance.
10. Current next-pick simulation approximates market availability; it is not yet
    a full multi-team draft-policy simulator.

## Recommended next ML work

1. Calibrate the P20-P80 prediction intervals.
2. Add validation metrics by position and season.
3. Backtest component-level scoring projections for arbitrary Sleeper settings.
4. Preserve point-in-time roster, team, injury, and depth-chart snapshots.
5. Add a reliable historical offensive-staff table.
6. Recalculate team context for current player-team changes.
7. Test supplemental feature families with confidence intervals or bootstrap
   comparisons rather than relying only on small MAE differences.

## Source files

- `ml/src/data.py`: source downloads and player context
- `ml/src/features.py`: PBP aggregation and player-season features
- `ml/src/context.py`: team, coaching, defense, and schedule features
- `ml/src/feature_registry.py`: feature tiers and production status
- `ml/src/train.py`: training, validation, and artifact export
- `ml/config/coaching_staff.csv`: optional staff identities
- `src/data/draft-projections.json`: current projection artifact
- `src/lib/draft-assistant.ts`: Sleeper adjustments and draft optimizer
- `src/lib/news.ts`: structured news schema and deterministic effects

