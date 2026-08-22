from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .context import CONTEXT_FEATURES

POSITIONS = ("QB", "RB", "WR", "TE")

COUNTING_FEATURES = [
    "games", "pass_attempts", "completions", "passing_yards", "passing_tds",
    "interceptions", "sacks", "pass_first_downs", "pass_air_yards",
    "red_zone_pass_attempts", "end_zone_pass_attempts", "carries",
    "rushing_yards", "rushing_tds", "rush_first_downs", "explosive_runs",
    "red_zone_carries", "goal_line_carries", "targets", "receptions",
    "receiving_yards", "receiving_tds", "receiving_air_yards", "yac",
    "receive_first_downs", "red_zone_targets", "end_zone_targets",
    "fumbles_lost", "two_point_conversions", "fantasy_points_ppr",
]
RATE_FEATURES = [
    "pass_epa_per_play", "cpoe", "pass_success_rate", "rush_epa_per_play",
    "rush_success_rate", "catch_rate", "adot", "racr", "target_share",
    "air_yards_share", "wopr", "points_per_game", "opportunities_per_game",
    "weekly_median", "weekly_std", "weekly_floor", "weekly_ceiling",
    "boom_rate", "bust_rate", "recent_4_points", "recent_8_points",
    "team_plays_per_game", "team_pass_rate", "team_neutral_pass_rate",
    "team_success_rate", "team_epa_per_play", "team_red_zone_rate",
    "team_scoring_rate", "opportunity_share", "year_over_year_points_change",
]
PROFILE_FEATURES = [
    "age", "years_since_draft", "draft_round", "draft_pick", "height",
    "weight", "forty", "bench", "vertical", "broad_jump", "cone", "shuttle",
    "career_seasons", "missed_games", "era_index",
]
NUMERIC_FEATURES = list(dict.fromkeys(
    COUNTING_FEATURES + RATE_FEATURES + PROFILE_FEATURES + CONTEXT_FEATURES
))
CATEGORICAL_FEATURES = ["position"]
TARGET_PPG = "next_points_per_game"
TARGET_AVAILABILITY = "next_availability"


@dataclass
class CanonicalTables:
    player_week: pd.DataFrame
    team_week: pd.DataFrame


def _number(frame: pd.DataFrame, column: str, default: float = 0.0) -> pd.Series:
    if column not in frame:
        return pd.Series(default, index=frame.index, dtype="float64")
    return pd.to_numeric(frame[column], errors="coerce").fillna(default)


def _text(frame: pd.DataFrame, column: str) -> pd.Series:
    if column not in frame:
        return pd.Series(pd.NA, index=frame.index, dtype="string")
    return frame[column].astype("string")


def _role_rows(pbp: pd.DataFrame, role: str) -> pd.DataFrame:
    ids = _text(pbp, f"{role}_player_id")
    mask = ids.notna() & ids.ne("")
    base = pd.DataFrame({
        "season": _number(pbp, "season"), "week": _number(pbp, "week"),
        "game_id": _text(pbp, "game_id"), "team": _text(pbp, "posteam"),
        "player_id": ids, "player_name": _text(pbp, f"{role}_player_name"),
    })
    rows, source = base.loc[mask].copy(), pbp.loc[mask]
    rz = _number(source, "yardline_100").between(1, 20)
    ez = _number(source, "yardline_100").between(1, 10)

    if role == "passer":
        attempt = _number(source, "pass_attempt")
        rows["pass_attempts"] = attempt
        rows["completions"] = _number(source, "complete_pass")
        rows["passing_yards"] = _number(source, "passing_yards")
        rows["passing_tds"] = _number(source, "pass_touchdown")
        rows["interceptions"] = _number(source, "interception")
        rows["sacks"] = _number(source, "sack")
        rows["pass_first_downs"] = _number(source, "first_down_pass")
        rows["pass_air_yards"] = _number(source, "air_yards")
        rows["red_zone_pass_attempts"] = attempt * rz.astype(float)
        rows["end_zone_pass_attempts"] = attempt * ez.astype(float)
        rows["pass_epa_total"] = _number(source, "qb_epa")
        rows["cpoe_total"] = _number(source, "cpoe") * attempt
        rows["pass_successes"] = _number(source, "success") * attempt
        rows["two_point_conversions"] = _text(source, "two_point_conv_result").eq("success").astype(float)
    elif role == "rusher":
        attempt, yards = _number(source, "rush_attempt"), _number(source, "rushing_yards")
        rows["carries"] = attempt
        rows["rushing_yards"] = yards
        rows["rushing_tds"] = _number(source, "rush_touchdown")
        rows["rush_first_downs"] = _number(source, "first_down_rush")
        rows["explosive_runs"] = (yards >= 10).astype(float) * attempt
        rows["red_zone_carries"] = attempt * rz.astype(float)
        rows["goal_line_carries"] = attempt * ez.astype(float)
        rows["rush_epa_total"] = _number(source, "epa") * attempt
        rows["rush_successes"] = _number(source, "success") * attempt
    else:
        target = _number(source, "pass_attempt") * (1 - _number(source, "sack"))
        yards = _number(source, "receiving_yards") if "receiving_yards" in source else _number(source, "passing_yards")
        rows["targets"] = target
        rows["receptions"] = _number(source, "complete_pass")
        rows["receiving_yards"] = yards
        rows["receiving_tds"] = _number(source, "pass_touchdown")
        rows["receiving_air_yards"] = _number(source, "air_yards")
        rows["yac"] = _number(source, "yards_after_catch")
        rows["receive_first_downs"] = _number(source, "first_down_pass")
        rows["red_zone_targets"] = target * rz.astype(float)
        rows["end_zone_targets"] = target * ez.astype(float)

    extras = ["pass_epa_total", "cpoe_total", "pass_successes", "rush_epa_total", "rush_successes"]
    for column in COUNTING_FEATURES + extras:
        if column not in rows:
            rows[column] = 0.0
    return rows


def aggregate_pbp(pbp: pd.DataFrame, crosswalk: pd.DataFrame) -> CanonicalTables:
    """Convert event-level nflverse PBP into player-week and team-week tables."""
    roles = pd.concat([_role_rows(pbp, role) for role in ("passer", "rusher", "receiver")], ignore_index=True)
    key = ["season", "week", "game_id", "team", "player_id"]
    numeric = roles.select_dtypes(include="number").columns.difference(["season", "week"])
    player_week = roles.groupby(key, dropna=False)[list(numeric)].sum().reset_index()
    names = roles.dropna(subset=["player_name"]).drop_duplicates("player_id", keep="last")
    player_week = player_week.merge(names[["player_id", "player_name"]], on="player_id", how="left")

    fumbles = pd.DataFrame({
        "season": _number(pbp, "season"), "week": _number(pbp, "week"),
        "game_id": _text(pbp, "game_id"), "team": _text(pbp, "posteam"),
        "player_id": _text(pbp, "fumbled_1_player_id"),
        "fumbles_lost_extra": _number(pbp, "fumble_lost"),
    })
    fumbles = fumbles[fumbles["player_id"].notna()].groupby(key, dropna=False)["fumbles_lost_extra"].sum().reset_index()
    player_week = player_week.merge(fumbles, on=key, how="left")
    player_week["fumbles_lost"] += player_week.pop("fumbles_lost_extra").fillna(0)
    player_week["games"] = 1.0
    player_week["fantasy_points_ppr"] = (
        player_week["passing_yards"] * .04 + player_week["passing_tds"] * 4
        - player_week["interceptions"] * 2 + player_week["rushing_yards"] * .1
        + player_week["rushing_tds"] * 6 + player_week["receptions"]
        + player_week["receiving_yards"] * .1 + player_week["receiving_tds"] * 6
        - player_week["fumbles_lost"] * 2 + player_week["two_point_conversions"] * 2
    )

    ids = crosswalk.drop_duplicates("gsis_id").copy()
    player_week = player_week.merge(ids, left_on="player_id", right_on="gsis_id", how="left")
    inferred = np.select(
        [player_week["pass_attempts"].gt(0), player_week["carries"].gt(player_week["targets"])],
        ["QB", "RB"], default="WR",
    )
    player_week["position"] = player_week["position"].fillna(pd.Series(inferred, index=player_week.index))
    player_week = player_week[player_week["position"].isin(POSITIONS)].copy()

    neutral = _number(pbp, "score_differential").abs().le(7) & _number(pbp, "qtr").le(3)
    team = pd.DataFrame({
        "season": _number(pbp, "season"), "week": _number(pbp, "week"),
        "game_id": _text(pbp, "game_id"), "team": _text(pbp, "posteam"),
        "pass_attempt": _number(pbp, "pass_attempt"), "rush_attempt": _number(pbp, "rush_attempt"),
        "success": _number(pbp, "success"), "epa": _number(pbp, "epa"),
        "touchdown": _number(pbp, "touchdown"),
        "red_zone": _number(pbp, "yardline_100").between(1, 20).astype(float),
        "neutral_pass": _number(pbp, "pass_attempt") * neutral.astype(float),
        "neutral_play": ((_number(pbp, "pass_attempt") + _number(pbp, "rush_attempt")) > 0).astype(float) * neutral.astype(float),
    })
    team = team[team["team"].notna()]
    team_week = team.groupby(["season", "week", "game_id", "team"], dropna=False).sum(numeric_only=True).reset_index()
    return CanonicalTables(player_week, team_week)


def scheduled_games(season: int) -> int:
    return 17 if season >= 2021 else 16


def build_player_seasons(player_week: pd.DataFrame, team_week: pd.DataFrame) -> pd.DataFrame:
    extras = ["pass_epa_total", "cpoe_total", "pass_successes", "rush_epa_total", "rush_successes"]
    sums = player_week.groupby(["player_id", "season"], dropna=False)[COUNTING_FEATURES + extras].sum().reset_index()
    first = player_week.sort_values(["season", "week"]).groupby(["player_id", "season"], dropna=False).last().reset_index()
    context = [
        "player_id", "season", "player_name", "team", "position", "sleeper_id",
        "birthdate", "draft_year", "draft_round", "draft_pick", "height", "weight",
        "forty", "bench", "vertical", "broad_jump", "cone", "shuttle",
    ]
    seasons = sums.merge(first[context], on=["player_id", "season"], how="left")

    weekly = player_week.groupby(["player_id", "season"])["fantasy_points_ppr"]
    distribution = weekly.agg(weekly_median="median", weekly_std="std", weekly_floor=lambda x: x.quantile(.2), weekly_ceiling=lambda x: x.quantile(.8)).reset_index()
    tagged = player_week.assign(boom=player_week["fantasy_points_ppr"].ge(20), bust=player_week["fantasy_points_ppr"].lt(8))
    boom = tagged.groupby(["player_id", "season"])[["boom", "bust"]].mean().reset_index().rename(columns={"boom": "boom_rate", "bust": "bust_rate"})
    ordered = player_week.sort_values(["player_id", "season", "week"])
    recent = ordered.groupby(["player_id", "season"])["fantasy_points_ppr"].agg(recent_4_points=lambda x: x.tail(4).mean(), recent_8_points=lambda x: x.tail(8).mean()).reset_index()
    seasons = seasons.merge(distribution, on=["player_id", "season"]).merge(boom, on=["player_id", "season"]).merge(recent, on=["player_id", "season"])

    pass_n, rush_n, target_n = seasons["pass_attempts"].clip(lower=1), seasons["carries"].clip(lower=1), seasons["targets"].clip(lower=1)
    seasons["pass_epa_per_play"] = seasons["pass_epa_total"] / pass_n
    seasons["cpoe"] = seasons["cpoe_total"] / pass_n
    seasons["pass_success_rate"] = seasons["pass_successes"] / pass_n
    seasons["rush_epa_per_play"] = seasons["rush_epa_total"] / rush_n
    seasons["rush_success_rate"] = seasons["rush_successes"] / rush_n
    seasons["catch_rate"] = seasons["receptions"] / target_n
    seasons["adot"] = seasons["receiving_air_yards"] / target_n
    seasons["racr"] = seasons["receiving_yards"] / seasons["receiving_air_yards"].replace(0, np.nan)
    seasons["points_per_game"] = seasons["fantasy_points_ppr"] / seasons["games"].clip(lower=1)
    seasons["opportunities_per_game"] = (seasons["pass_attempts"] + seasons["carries"] + seasons["targets"]) / seasons["games"].clip(lower=1)

    team_season = team_week.groupby(["season", "team"]).agg(
        team_games=("game_id", "nunique"), team_plays=("neutral_play", "size"),
        team_passes=("pass_attempt", "sum"), team_rushes=("rush_attempt", "sum"),
        team_neutral_passes=("neutral_pass", "sum"), team_neutral_plays=("neutral_play", "sum"),
        team_successes=("success", "sum"), team_epa=("epa", "sum"),
        team_red_zone_plays=("red_zone", "sum"), team_touchdowns=("touchdown", "sum"),
    ).reset_index()
    plays = (team_season["team_passes"] + team_season["team_rushes"]).clip(lower=1)
    team_season["team_plays_per_game"] = plays / team_season["team_games"].clip(lower=1)
    team_season["team_pass_rate"] = team_season["team_passes"] / plays
    team_season["team_neutral_pass_rate"] = team_season["team_neutral_passes"] / team_season["team_neutral_plays"].clip(lower=1)
    team_season["team_success_rate"] = team_season["team_successes"] / plays
    team_season["team_epa_per_play"] = team_season["team_epa"] / plays
    team_season["team_red_zone_rate"] = team_season["team_red_zone_plays"] / plays
    team_season["team_scoring_rate"] = team_season["team_touchdowns"] / plays
    team_features = ["season", "team"] + [column for column in RATE_FEATURES if column.startswith("team_")]
    seasons = seasons.merge(team_season[team_features], on=["season", "team"], how="left")

    totals = seasons.groupby(["season", "team"])[["targets", "carries", "pass_attempts", "receiving_air_yards"]].transform("sum")
    opportunity = seasons["targets"] + seasons["carries"] + seasons["pass_attempts"]
    seasons["opportunity_share"] = opportunity / (totals["targets"] + totals["carries"] + totals["pass_attempts"]).clip(lower=1)
    seasons["target_share"] = seasons["targets"] / totals["targets"].clip(lower=1)
    seasons["air_yards_share"] = seasons["receiving_air_yards"] / totals["receiving_air_yards"].clip(lower=1)
    seasons["wopr"] = 1.5 * seasons["target_share"] + .7 * seasons["air_yards_share"]

    birth_year = pd.to_datetime(seasons["birthdate"], errors="coerce").dt.year
    seasons["age"] = seasons["season"] - birth_year
    seasons["years_since_draft"] = seasons["season"] - pd.to_numeric(seasons["draft_year"], errors="coerce")
    seasons["career_seasons"] = seasons.groupby("player_id").cumcount() + 1
    seasons["missed_games"] = seasons["season"].map(scheduled_games) - seasons["games"]
    seasons["era_index"] = seasons["season"] - 1999
    seasons["year_over_year_points_change"] = seasons.groupby("player_id")["fantasy_points_ppr"].diff()
    return seasons.replace([np.inf, -np.inf], np.nan)


def build_training_frame(
    seasons: pd.DataFrame,
    forecast_context: pd.DataFrame | None = None,
) -> pd.DataFrame:
    frame = seasons.copy().sort_values(["player_id", "season"])
    target_columns = ["player_id", "season", "points_per_game", "games"]
    for column in ("team", "position"):
        if column in frame:
            target_columns.append(column)
    targets = frame[target_columns].copy()
    targets["season"] -= 1
    targets[TARGET_PPG] = targets.pop("points_per_game")
    targets[TARGET_AVAILABILITY] = targets.pop("games") / (targets["season"] + 1).map(scheduled_games)
    targets = targets.rename(columns={"team": "forecast_team", "position": "forecast_position"})
    frame = frame.merge(targets, on=["player_id", "season"], how="left")
    frame["forecast_season"] = frame["season"] + 1
    if "forecast_team" not in frame:
        frame["forecast_team"] = frame.get("team")
    else:
        frame["forecast_team"] = frame["forecast_team"].fillna(frame.get("team"))
    if "forecast_position" not in frame:
        frame["forecast_position"] = frame.get("position")
    else:
        frame["forecast_position"] = frame["forecast_position"].fillna(frame.get("position"))
    if forecast_context is not None and not forecast_context.empty:
        frame = frame.merge(
            forecast_context,
            left_on=["forecast_season", "forecast_team", "forecast_position"],
            right_on=["season", "team", "position"],
            how="left",
            suffixes=("", "_context"),
        )
        frame = frame.drop(columns=[
            column for column in ("season_context", "team_context", "position_context")
            if column in frame
        ])
    for column in NUMERIC_FEATURES:
        if column not in frame:
            frame[column] = np.nan
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    return frame
