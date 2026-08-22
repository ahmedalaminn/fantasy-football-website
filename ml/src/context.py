from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


CONTEXT_FEATURES = [
    "forecast_team_plays_per_game",
    "forecast_team_pass_rate",
    "forecast_team_scoring_rate",
    "forecast_head_coach_experience",
    "forecast_head_coach_continuity",
    "forecast_head_coach_pass_rate",
    "forecast_head_coach_scoring_rate",
    "forecast_head_coach_epa_per_play",
    "forecast_oc_experience",
    "forecast_oc_continuity",
    "forecast_oc_pass_rate",
    "forecast_oc_scoring_rate",
    "forecast_play_caller_continuity",
    "forecast_sos_defense_epa_allowed",
    "forecast_sos_defense_td_rate_allowed",
    "forecast_sos_position_points_allowed",
    "forecast_playoff_position_points_allowed",
]


def _team_seasons(team_week: pd.DataFrame) -> pd.DataFrame:
    grouped = team_week.groupby(["season", "team"], dropna=False).agg(
        games=("game_id", "nunique"),
        pass_attempts=("pass_attempt", "sum"),
        rush_attempts=("rush_attempt", "sum"),
        successes=("success", "sum"),
        epa=("epa", "sum"),
        touchdowns=("touchdown", "sum"),
    ).reset_index()
    plays = (grouped["pass_attempts"] + grouped["rush_attempts"]).clip(lower=1)
    grouped["plays_per_game"] = plays / grouped["games"].clip(lower=1)
    grouped["pass_rate"] = grouped["pass_attempts"] / plays
    grouped["scoring_rate"] = grouped["touchdowns"] / plays
    grouped["epa_per_play"] = grouped["epa"] / plays
    grouped["success_rate"] = grouped["successes"] / plays
    return grouped


def _team_opponents(team_week: pd.DataFrame) -> pd.DataFrame:
    teams = team_week[["season", "week", "game_id", "team"]].drop_duplicates()
    opponents = teams.merge(teams, on=["season", "week", "game_id"], suffixes=("", "_opponent"))
    return opponents[opponents["team"].ne(opponents["team_opponent"])].drop_duplicates(
        ["season", "week", "game_id", "team"]
    )


def normalize_schedules(schedules: pd.DataFrame) -> pd.DataFrame:
    frame = schedules.copy()
    if "game_type" in frame:
        frame = frame[frame["game_type"].eq("REG")]
    home = frame[["season", "week", "home_team", "away_team", "home_coach"]].rename(
        columns={"home_team": "team", "away_team": "opponent", "home_coach": "head_coach"}
    )
    away = frame[["season", "week", "away_team", "home_team", "away_coach"]].rename(
        columns={"away_team": "team", "home_team": "opponent", "away_coach": "head_coach"}
    )
    return pd.concat([home, away], ignore_index=True).dropna(subset=["team", "opponent"])


def _staff_seasons(schedule_rows: pd.DataFrame, staff: pd.DataFrame | None) -> pd.DataFrame:
    coaches = schedule_rows[["season", "team", "head_coach"]].drop_duplicates(["season", "team"])
    for column in ("offensive_coordinator", "play_caller"):
        coaches[column] = pd.NA
    if staff is not None and not staff.empty:
        expected = ["season", "team", "head_coach", "offensive_coordinator", "play_caller"]
        supplied = staff.copy()
        for column in expected:
            if column not in supplied:
                supplied[column] = pd.NA
        supplied = supplied[expected].drop_duplicates(["season", "team"], keep="last")
        coaches = coaches.merge(supplied, on=["season", "team"], how="outer", suffixes=("", "_staff"))
        coaches["head_coach"] = coaches["head_coach_staff"].fillna(coaches["head_coach"])
        coaches = coaches.drop(columns=["head_coach_staff"])
        for column in ("offensive_coordinator", "play_caller"):
            coaches[column] = coaches[f"{column}_staff"].fillna(coaches[column])
            coaches = coaches.drop(columns=[f"{column}_staff"])
    return coaches


def _prior_staff_tendencies(coaches: pd.DataFrame, ratings: pd.DataFrame) -> pd.DataFrame:
    rows = coaches.merge(ratings, on=["season", "team"], how="left").sort_values("season")
    metrics = ("pass_rate", "scoring_rate", "epa_per_play")
    for role, prefix in (("head_coach", "head_coach"), ("offensive_coordinator", "oc")):
        rows[f"{prefix}_experience"] = rows.groupby(role, dropna=False).cumcount()
        for metric in metrics:
            rows[f"{prefix}_{metric}"] = rows.groupby(role, dropna=False)[metric].transform(
                lambda values: values.shift().expanding().mean()
            )
        missing_role = rows[role].isna() | rows[role].astype("string").fillna("").eq("")
        rows.loc[missing_role, [
            f"{prefix}_experience",
            *[f"{prefix}_{metric}" for metric in metrics],
        ]] = np.nan
    rows = rows.sort_values(["team", "season"])
    for role, output in (
        ("head_coach", "head_coach_continuity"),
        ("offensive_coordinator", "oc_continuity"),
        ("play_caller", "play_caller_continuity"),
    ):
        current = rows[role].astype("string").fillna("")
        previous = rows.groupby("team")[role].shift().astype("string").fillna("")
        rows[output] = (current.ne("") & current.eq(previous)).astype(float)
    return rows


def build_forecast_context(
    player_week: pd.DataFrame,
    team_week: pd.DataFrame,
    schedules: pd.DataFrame,
    staff: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Build as-of-season team, coach, and position-specific schedule context.

    Every performance rating is shifted forward one season. A 2026 schedule
    therefore uses 2025 defenses and staff tendencies learned through 2025.
    """
    ratings = _team_seasons(team_week)
    prior_offense = ratings[[
        "season", "team", "plays_per_game", "pass_rate", "scoring_rate",
    ]].copy()
    prior_offense["season"] += 1
    prior_offense = prior_offense.rename(columns={
        "plays_per_game": "forecast_team_plays_per_game",
        "pass_rate": "forecast_team_pass_rate",
        "scoring_rate": "forecast_team_scoring_rate",
    })

    opponent_map = _team_opponents(team_week)
    offense_games = team_week.merge(
        opponent_map, on=["season", "week", "game_id", "team"], how="inner"
    )
    defense = offense_games.groupby(["season", "team_opponent"]).agg(
        games=("game_id", "nunique"), epa_allowed=("epa", "sum"),
        touchdowns_allowed=("touchdown", "sum"), pass_attempts=("pass_attempt", "sum"),
        rush_attempts=("rush_attempt", "sum"),
    ).reset_index().rename(columns={"team_opponent": "defense_team"})
    defense_plays = (defense["pass_attempts"] + defense["rush_attempts"]).clip(lower=1)
    defense["defense_epa_allowed"] = defense["epa_allowed"] / defense_plays
    defense["defense_td_rate_allowed"] = defense["touchdowns_allowed"] / defense_plays
    defense["season"] += 1

    position_games = player_week.merge(
        opponent_map, on=["season", "week", "game_id", "team"], how="inner"
    ).groupby(
        ["season", "week", "game_id", "team_opponent", "position"], dropna=False
    )["fantasy_points_ppr"].sum().reset_index()
    position_defense = position_games.groupby(["season", "team_opponent", "position"])[
        "fantasy_points_ppr"
    ].mean().reset_index().rename(columns={
        "team_opponent": "defense_team",
        "fantasy_points_ppr": "position_points_allowed",
    })
    position_defense["season"] += 1

    schedule_rows = normalize_schedules(schedules)
    schedule_defense = schedule_rows.merge(
        defense[["season", "defense_team", "defense_epa_allowed", "defense_td_rate_allowed"]],
        left_on=["season", "opponent"], right_on=["season", "defense_team"], how="left",
    )
    generic_sos = schedule_defense.groupby(["season", "team"], dropna=False).agg(
        forecast_sos_defense_epa_allowed=("defense_epa_allowed", "mean"),
        forecast_sos_defense_td_rate_allowed=("defense_td_rate_allowed", "mean"),
    ).reset_index()

    positions = player_week[["position"]].drop_duplicates().assign(_key=1)
    expanded = schedule_rows.assign(_key=1).merge(positions, on="_key").drop(columns="_key")
    expanded = expanded.merge(
        position_defense,
        left_on=["season", "opponent", "position"],
        right_on=["season", "defense_team", "position"],
        how="left",
    )
    position_sos = expanded.groupby(["season", "team", "position"], dropna=False).agg(
        forecast_sos_position_points_allowed=("position_points_allowed", "mean"),
        forecast_playoff_position_points_allowed=(
            "position_points_allowed",
            lambda values: values[expanded.loc[values.index, "week"].between(15, 17)].mean(),
        ),
    ).reset_index()

    coaches = _prior_staff_tendencies(_staff_seasons(schedule_rows, staff), ratings)
    coach_columns = [
        "season", "team", "head_coach", "offensive_coordinator", "play_caller",
        "head_coach_experience", "head_coach_continuity", "head_coach_pass_rate",
        "head_coach_scoring_rate", "head_coach_epa_per_play", "oc_experience",
        "oc_continuity", "oc_pass_rate", "oc_scoring_rate", "play_caller_continuity",
    ]
    coaches = coaches[coach_columns].rename(columns={
        column: f"forecast_{column}"
        for column in coach_columns
        if column not in ("season", "team", "head_coach", "offensive_coordinator", "play_caller")
    })
    context = position_sos.merge(generic_sos, on=["season", "team"], how="left")
    context = context.merge(prior_offense, on=["season", "team"], how="left")
    context = context.merge(coaches, on=["season", "team"], how="left")
    for column in CONTEXT_FEATURES:
        if column not in context:
            context[column] = np.nan
        context[column] = pd.to_numeric(context[column], errors="coerce")
    return context.replace([np.inf, -np.inf], np.nan)


def load_optional_staff(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    frame = pd.read_csv(path)
    return None if frame.empty else frame
