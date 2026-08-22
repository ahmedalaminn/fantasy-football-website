from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline

from .context import build_forecast_context, load_optional_staff
from .data import load_pbp_season, load_player_context, load_schedules
from .feature_registry import (
    CORE_FEATURES, PRODUCTION_FEATURES, RESEARCH_FEATURES, feature_group_manifest,
)
from .features import (
    NUMERIC_FEATURES, POSITIONS, TARGET_AVAILABILITY, TARGET_PPG,
    aggregate_pbp, build_player_seasons, build_training_frame, scheduled_games,
)

ML_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[2]
RECENCY_HALF_LIFE = 5.0


def make_model(loss: str = "absolute_error", quantile: float | None = None) -> Pipeline:
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("regressor", HistGradientBoostingRegressor(
            loss=loss, quantile=quantile, max_iter=180, learning_rate=.05,
            max_leaf_nodes=24, min_samples_leaf=15, l2_regularization=.1,
            random_state=42,
        )),
    ])


def recency_weights(seasons: pd.Series, newest: int) -> np.ndarray:
    return np.power(.5, (newest - seasons.to_numpy(dtype=float)) / RECENCY_HALF_LIFE)


def load_tables(start_season: int, latest_season: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    raw_dir, processed_dir = ML_ROOT / "data/raw", ML_ROOT / "data/processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    crosswalk = load_player_context(raw_dir)
    player_frames, team_frames = [], []
    for season in range(start_season, latest_season + 1):
        player_path = processed_dir / f"player_week_{season}.csv.gz"
        team_path = processed_dir / f"team_week_{season}.csv.gz"
        if player_path.exists() and team_path.exists():
            player_frames.append(pd.read_csv(
                player_path, low_memory=False,
                dtype={"player_id": "string", "sleeper_id": "string"},
            ))
            team_frames.append(pd.read_csv(team_path, low_memory=False))
            continue
        pbp = load_pbp_season(season, raw_dir)
        tables = aggregate_pbp(pbp, crosswalk)
        tables.player_week.to_csv(player_path, index=False, compression="gzip")
        tables.team_week.to_csv(team_path, index=False, compression="gzip")
        player_frames.append(tables.player_week)
        team_frames.append(tables.team_week)
    return pd.concat(player_frames, ignore_index=True), pd.concat(team_frames, ignore_index=True)


def _fit_position_models(
    rows: pd.DataFrame,
    newest: int,
    features: list[str] = PRODUCTION_FEATURES,
    include_intervals: bool = True,
) -> dict[str, Pipeline]:
    weights = recency_weights(rows["season"], newest)
    models = {"median": make_model()}
    if include_intervals:
        models.update({
            "floor": make_model("quantile", .2),
            "ceiling": make_model("quantile", .8),
            "availability": make_model("squared_error"),
        })
    for name, model in models.items():
        target = TARGET_AVAILABILITY if name == "availability" else TARGET_PPG
        model.fit(rows[features], rows[target], regressor__sample_weight=weights)
    return models


def rolling_metrics(
    frame: pd.DataFrame,
    features: list[str] = PRODUCTION_FEATURES,
    include_intervals: bool = True,
) -> dict:
    labeled = frame.dropna(subset=[TARGET_PPG, TARGET_AVAILABILITY]).copy()
    seasons = sorted(int(value) for value in labeled["season"].unique())
    folds, fold_metrics, actual, predicted, baseline, covered = [], [], [], [], [], []
    for validation_season in seasons[-5:]:
        train, validation = labeled[labeled["season"] < validation_season], labeled[labeled["season"] == validation_season]
        if len(train) < 100 or len(validation) < 20:
            continue
        fold_pred = pd.Series(index=validation.index, dtype=float)
        fold_floor = pd.Series(index=validation.index, dtype=float)
        fold_ceiling = pd.Series(index=validation.index, dtype=float)
        for position in POSITIONS:
            train_position, validation_position = train[train["position"] == position], validation[validation["position"] == position]
            if len(train_position) < 30 or validation_position.empty:
                continue
            models = _fit_position_models(
                train_position, validation_season - 1, features, include_intervals
            )
            fold_pred.loc[validation_position.index] = models["median"].predict(
                validation_position[features]
            )
            if include_intervals:
                fold_floor.loc[validation_position.index] = models["floor"].predict(
                    validation_position[features]
                )
                fold_ceiling.loc[validation_position.index] = models["ceiling"].predict(
                    validation_position[features]
                )
        valid = fold_pred.notna()
        if not valid.any():
            continue
        fold_actual = validation.loc[valid, TARGET_PPG]
        fold_predicted = fold_pred.loc[valid]
        fold_baseline = validation.loc[valid, "points_per_game"]
        fold_covered = (
            (fold_actual >= fold_floor.loc[valid]) & (fold_actual <= fold_ceiling.loc[valid])
            if include_intervals else pd.Series(dtype=bool)
        )
        actual.extend(validation.loc[valid, TARGET_PPG])
        predicted.extend(fold_pred.loc[valid])
        baseline.extend(validation.loc[valid, "points_per_game"])
        if include_intervals:
            covered.extend(fold_covered)
        folds.append(validation_season + 1)
        fold_metrics.append({
            "season": validation_season + 1,
            "rows": int(valid.sum()),
            "mae": round(float(mean_absolute_error(fold_actual, fold_predicted)), 3),
            "baselineMae": round(float(mean_absolute_error(fold_actual, fold_baseline)), 3),
            "quantileCoverage": round(float(fold_covered.mean()), 3)
            if include_intervals else None,
        })
    if not actual:
        return {"validationSeasons": [], "rows": 0, "mae": None, "baselineMae": None, "quantileCoverage": None}
    return {
        "validationSeasons": folds, "bySeason": fold_metrics, "rows": len(actual),
        "mae": round(float(mean_absolute_error(actual, predicted)), 3),
        "baselineMae": round(float(mean_absolute_error(actual, baseline)), 3),
        "quantileCoverage": round(float(np.mean(covered)), 3) if covered else None,
    }


def fit_models(frame: pd.DataFrame, latest_season: int) -> tuple[dict, dict]:
    labeled = frame.dropna(subset=[TARGET_PPG, TARGET_AVAILABILITY])
    models = {}
    for position in POSITIONS:
        rows = labeled[labeled["position"] == position]
        if len(rows) >= 30:
            models[position] = _fit_position_models(rows, latest_season)
    metrics = rolling_metrics(frame)
    core_metrics = rolling_metrics(frame, CORE_FEATURES, include_intervals=False)
    metrics["coreOnlyMae"] = core_metrics["mae"]
    metrics["supplementalUplift"] = (
        round(core_metrics["mae"] - metrics["mae"], 3)
        if core_metrics["mae"] is not None and metrics["mae"] is not None
        else None
    )
    core_by_season = {row["season"]: row for row in core_metrics.get("bySeason", [])}
    metrics["supplementalWinningSeasons"] = sum(
        row["mae"] < core_by_season[row["season"]]["mae"]
        for row in metrics.get("bySeason", [])
        if row["season"] in core_by_season
    )
    return models, metrics


def export(
    models: dict,
    frame: pd.DataFrame,
    forecast_context: pd.DataFrame,
    forecast_season: int,
    latest_season: int,
    metrics: dict,
    stale: bool,
):
    current, rows = frame[frame["season"] == latest_season].copy(), []
    for position, position_models in models.items():
        position_rows = current[current["position"] == position]
        if position_rows.empty:
            continue
        ppg = {
            name: position_models[name].predict(position_rows[PRODUCTION_FEATURES])
            for name in ("floor", "median", "ceiling")
        }
        availability = np.clip(
            position_models["availability"].predict(position_rows[PRODUCTION_FEATURES]), .1, 1
        )
        expected_games = availability * scheduled_games(forecast_season)
        for index, (_, player) in enumerate(position_rows.iterrows()):
            if pd.isna(player.get("sleeper_id")):
                continue
            floor, median, ceiling = sorted([
                max(0, ppg["floor"][index] * max(1, expected_games[index] - 1)),
                max(0, ppg["median"][index] * expected_games[index]),
                max(0, ppg["ceiling"][index] * min(scheduled_games(forecast_season), expected_games[index] + 1)),
            ])
            sleeper_id = str(player["sleeper_id"]).removesuffix(".0")
            rows.append({
                "playerId": sleeper_id, "name": player["player_name"], "position": position,
                "floor": round(floor, 1), "median": round(median, 1), "ceiling": round(ceiling, 1),
                "availability": round(float(availability[index]), 3), "expectedGames": round(float(expected_games[index]), 1),
                "confidence": round(float(min(.95, .45 + player["career_seasons"] * .08)), 2),
                "context": {
                    "team": player.get("forecast_team") if pd.notna(player.get("forecast_team")) else player.get("team"),
                    "headCoach": player.get("head_coach") if pd.notna(player.get("head_coach")) else None,
                    "offensiveCoordinator": player.get("offensive_coordinator") if pd.notna(player.get("offensive_coordinator")) else None,
                    "playCaller": player.get("play_caller") if pd.notna(player.get("play_caller")) else None,
                    "coachContinuity": round(float(player.get("forecast_head_coach_continuity")), 3) if pd.notna(player.get("forecast_head_coach_continuity")) else None,
                    "teamPassRate": round(float(player.get("forecast_team_pass_rate")), 3) if pd.notna(player.get("forecast_team_pass_rate")) else None,
                    "teamScoringRate": round(float(player.get("forecast_team_scoring_rate")), 4) if pd.notna(player.get("forecast_team_scoring_rate")) else None,
                    "schedulePositionPointsAllowed": round(float(player.get("forecast_sos_position_points_allowed")), 2) if pd.notna(player.get("forecast_sos_position_points_allowed")) else None,
                },
            })
    now = datetime.now(UTC)
    artifact = {
        "schemaVersion": 3, "modelVersion": now.strftime("pbp-context-%Y%m%dT%H%M%SZ"), "generatedAt": now.isoformat(),
        "forecastSeason": forecast_season, "latestInputSeason": latest_season, "dataStartSeason": int(frame["season"].min()),
        "scoringProfile": "full_ppr", "stale": stale, "metrics": metrics,
        "featureCount": len(PRODUCTION_FEATURES),
        "researchFeatureCount": len(RESEARCH_FEATURES),
        "availableFeatureCount": len(NUMERIC_FEATURES),
        "featureGroups": feature_group_manifest(),
        "sources": [
            "nflverse_pbp", "nflverse_schedules", "dynastyprocess_player_ids",
            "optional_coaching_staff_csv",
        ],
        "contextCoverage": {
            "forecastSeason": forecast_season,
            "teamPositionRows": int(len(forecast_context[forecast_context["season"] == forecast_season])),
            "offensiveStaffOptional": True,
        },
        "players": rows,
    }
    destination = REPO_ROOT / "src/data/draft-projections.json"
    destination.write_text(json.dumps(artifact, indent=2) + "\n")
    return destination, len(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-season", type=int, default=1999)
    parser.add_argument("--latest-season", type=int, required=True)
    parser.add_argument("--forecast-season", type=int, required=True)
    parser.add_argument("--allow-stale", action="store_true")
    args = parser.parse_args()
    stale = args.latest_season != args.forecast_season - 1
    if stale and not args.allow_stale:
        raise SystemExit("latest-season must immediately precede forecast-season; pass --allow-stale only for development")
    player_week, team_week = load_tables(args.start_season, args.latest_season)
    schedules = load_schedules(ML_ROOT / "data/raw")
    staff = load_optional_staff(ML_ROOT / "config/coaching_staff.csv")
    forecast_context = build_forecast_context(player_week, team_week, schedules, staff)
    frame = build_training_frame(
        build_player_seasons(player_week, team_week), forecast_context
    )
    models, metrics = fit_models(frame, args.latest_season)
    artifact_dir = ML_ROOT / "artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(models, artifact_dir / f"projection-model-{args.forecast_season}.joblib")
    destination, count = export(
        models, frame, forecast_context, args.forecast_season, args.latest_season, metrics, stale
    )
    print(json.dumps({"artifact": str(destination), "players": count, "metrics": metrics}))


if __name__ == "__main__":
    main()
