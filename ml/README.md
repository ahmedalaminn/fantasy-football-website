# UD Fantasy projection model

This directory owns model training and evaluation. The web app does not train a
model at request time. Python exports a compact, versioned artifact to
`src/data/draft-projections.json`; Next.js combines those projections with the
live Sleeper board and manager-specific roster state.

## Data

The pipeline downloads regular-season play-by-play for 1999 onward from the
CC BY 4.0 [nflverse PBP releases](https://github.com/nflverse/nflverse-data/releases/tag/pbp)
and the GPL-3.0 [DynastyProcess player ID crosswalk](https://github.com/dynastyprocess/data).
It aggregates one season at a time into player-week and team-week caches, so
the full history does not need to live in memory at once. Raw downloads,
processed caches, and fitted model binaries are ignored by git.

## Run

```bash
cd ml
python3 -m pip install -e '.[dev]'
python3 -m src.train --start-season 1999 --latest-season 2025 --forecast-season 2026
python3 -m unittest discover -s tests
```

The command deliberately fails when the requested latest-season input is not
available. Use `--allow-stale` only for development; stale output is visibly
marked in the exported metadata and should never be presented as a current
projection.

The model learns next-season active-game scoring and availability separately.
It fits recency-weighted, position-specific gradient-boosted models for the
20th, 50th, and 80th percentiles, reports rolling out-of-time validation, and
exports Sleeper-keyed season distributions. Rookies, K/DEF, and unmapped
players remain eligible through the explicit market-rank fallback.

## Feature contract

Features are deliberately separated instead of sending every available PBP
column into production:

- **Core:** box-score fields that directly determine fantasy points.
- **Sleeper context:** league scoring, roster rules, live availability, player
  status, draft order, and market rank; these are applied by Next.js.
- **Supplemental:** basic opportunity, player form, team environment, coaching,
  and position-specific strength of schedule derived from nflverse.
- **Research:** advanced efficiency and incomplete staff fields retained for
  ablation tests but excluded from the default model.

`src/feature_registry.py` is the source of truth. The exported artifact records
each group, source, tier, status, and active feature count. Rolling validation
also reports a core-only MAE and the number of recent folds in which the compact
supplemental set improves the core baseline.

## Coaching and schedule context

The nflverse schedule supplies head-coach identity and the current schedule.
Coach experience, continuity, historical pass rate, scoring rate, and EPA are
calculated only from earlier seasons. Position-specific schedule difficulty
uses the forecast schedule with prior-season opponent defense, preventing
post-draft or future-game leakage.

Offensive coordinator and play-caller fields can be maintained in
`config/coaching_staff.csv` with this schema:

```csv
season,team,head_coach,offensive_coordinator,play_caller
```

Those fields remain research-only until the table has reliable historical
coverage. Missing staff values are imputed with an explicit missing indicator;
they are never converted into subjective good/bad labels.
