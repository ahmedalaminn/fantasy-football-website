from __future__ import annotations

import pandas as pd

REQUIRED_EVENT_COLUMNS = {
    "player_id", "season", "week", "event_type", "direction",
    "confidence", "source_credibility",
}


def build_event_outcomes(events: pd.DataFrame, player_week: pd.DataFrame) -> pd.DataFrame:
    """Attach pre/post four-game performance deltas to historical news events.

    The caller supplies only structured event metadata, never full article text.
    Games at or before the event week form the baseline; later games form the
    outcome, preventing the event from seeing future performance at extraction.
    """
    missing = REQUIRED_EVENT_COLUMNS.difference(events.columns)
    if missing:
        raise ValueError(f"events missing required columns: {sorted(missing)}")
    rows = []
    ordered = player_week.sort_values(["player_id", "season", "week"])
    for event in events.itertuples(index=False):
        games = ordered[
            (ordered["player_id"] == event.player_id)
            & (ordered["season"] == event.season)
        ]
        before = games[games["week"] <= event.week].tail(4)
        after = games[games["week"] > event.week].head(4)
        if before.empty or after.empty:
            continue
        before_points = before["fantasy_points_ppr"].mean()
        after_points = after["fantasy_points_ppr"].mean()
        before_opportunity = _opportunities(before).mean()
        after_opportunity = _opportunities(after).mean()
        row = event._asdict()
        row.update({
            "before_points": before_points,
            "after_points": after_points,
            "points_delta": after_points - before_points,
            "opportunity_delta": after_opportunity - before_opportunity,
            "outcome_games": len(after),
        })
        rows.append(row)
    return pd.DataFrame(rows)


def _opportunities(frame: pd.DataFrame) -> pd.Series:
    total = pd.Series(0.0, index=frame.index)
    for column in ("pass_attempts", "carries", "targets"):
        if column in frame:
            total += pd.to_numeric(frame[column], errors="coerce").fillna(0)
    return total


def event_type_report(outcomes: pd.DataFrame, minimum_samples: int = 30) -> pd.DataFrame:
    """Report which soft signal families have enough evidence for backtesting.

    `eligible_for_model` is deliberately only a sample gate. Promotion still
    requires a season-forward comparison against the projection baseline.
    """
    if outcomes.empty:
        return pd.DataFrame(columns=["event_type", "samples", "mean_points_delta", "direction_accuracy", "eligible_for_model"])
    scored = outcomes.copy()
    expected = scored["direction"].map({"up": 1, "down": -1, "neutral": 0}).fillna(0)
    observed = scored["points_delta"].apply(lambda value: 1 if value > 0 else -1 if value < 0 else 0)
    scored["direction_correct"] = expected.eq(observed)
    report = scored.groupby("event_type").agg(
        samples=("player_id", "size"),
        mean_points_delta=("points_delta", "mean"),
        direction_accuracy=("direction_correct", "mean"),
    ).reset_index()
    report["eligible_for_model"] = report["samples"] >= minimum_samples
    return report
