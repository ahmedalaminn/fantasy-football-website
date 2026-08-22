from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class FeatureGroup:
    id: str
    label: str
    tier: str
    source: str
    status: str
    features: tuple[str, ...]
    description: str
    model_input: bool = True


# "Core" is intentionally strict: these fields either score fantasy points or
# are the availability denominator for those points. Volume, team, coach, and
# schedule signals remain visibly supplemental even when validation earns them
# a place in the production model.
FEATURE_GROUPS = (
    FeatureGroup(
        "core_scoring",
        "Core fantasy scoring",
        "core",
        "nflverse_pbp",
        "production",
        (
            "games", "passing_yards", "passing_tds", "interceptions",
            "rushing_yards", "rushing_tds", "receptions", "receiving_yards",
            "receiving_tds", "fumbles_lost", "two_point_conversions",
            "fantasy_points_ppr", "points_per_game",
        ),
        "Box-score fields that directly determine fantasy points, plus games played.",
    ),
    FeatureGroup(
        "sleeper_context",
        "Sleeper league and draft context",
        "sleeper",
        "sleeper_api",
        "production",
        (
            "scoring_settings", "roster_positions", "flex_eligibility", "team_count",
            "draft_order", "traded_picks", "live_availability", "player_status",
            "depth_chart_order", "market_search_rank",
        ),
        "Applied by the web optimizer for the selected league and manager.",
        False,
    ),
    FeatureGroup(
        "basic_usage",
        "Basic opportunity",
        "supplemental",
        "nflverse_pbp",
        "production",
        ("pass_attempts", "carries", "targets", "opportunities_per_game"),
        "Simple workload signals kept separate from scoring output.",
    ),
    FeatureGroup(
        "player_form",
        "Player form and availability",
        "supplemental",
        "nflverse_pbp",
        "production",
        ("recent_4_points", "recent_8_points", "missed_games"),
        "Recent form and missed-time history available before the forecast season.",
    ),
    FeatureGroup(
        "player_profile",
        "Player profile",
        "supplemental",
        "nflverse_and_dynastyprocess",
        "production",
        ("age", "career_seasons", "draft_round", "draft_pick"),
        "Compact aging and career prior.",
    ),
    FeatureGroup(
        "team_environment",
        "Team environment",
        "supplemental",
        "nflverse_pbp",
        "production",
        (
            "team_plays_per_game", "team_pass_rate", "team_scoring_rate",
            "opportunity_share", "forecast_team_plays_per_game",
            "forecast_team_pass_rate", "forecast_team_scoring_rate",
        ),
        "Prior team volume and the forecast team's leak-safe offensive baseline.",
    ),
    FeatureGroup(
        "coaching",
        "Coaching and continuity",
        "supplemental",
        "nflverse_schedules_and_optional_staff",
        "production",
        (
            "forecast_head_coach_experience", "forecast_head_coach_continuity",
            "forecast_head_coach_pass_rate", "forecast_head_coach_scoring_rate",
            "forecast_head_coach_epa_per_play",
        ),
        "Historical head-coach tendencies calculated only from earlier seasons.",
    ),
    FeatureGroup(
        "offensive_staff",
        "Offensive staff",
        "supplemental",
        "optional_coaching_staff_csv",
        "research",
        (
            "forecast_oc_experience", "forecast_oc_continuity",
            "forecast_oc_pass_rate", "forecast_oc_scoring_rate",
            "forecast_play_caller_continuity",
        ),
        "OC and play-caller signals remain research-only until coverage is reliable.",
    ),
    FeatureGroup(
        "strength_of_schedule",
        "Strength of schedule",
        "supplemental",
        "nflverse_schedules_and_pbp",
        "production",
        (
            "forecast_sos_defense_epa_allowed",
            "forecast_sos_defense_td_rate_allowed",
            "forecast_sos_position_points_allowed",
            "forecast_playoff_position_points_allowed",
        ),
        "Position-aware opponents using only defenses observed before the scheduled season.",
    ),
    FeatureGroup(
        "advanced_efficiency",
        "Advanced efficiency",
        "supplemental",
        "nflverse_pbp",
        "research",
        (
            "pass_epa_per_play", "cpoe", "pass_success_rate", "rush_epa_per_play",
            "rush_success_rate", "catch_rate", "adot", "racr", "target_share",
            "air_yards_share", "wopr", "team_neutral_pass_rate",
            "team_success_rate", "team_epa_per_play", "team_red_zone_rate",
        ),
        "Retained for ablation research; excluded from the default production model.",
    ),
    FeatureGroup(
        "additional_detail",
        "Additional play and profile detail",
        "supplemental",
        "nflverse_pbp_and_combine",
        "research",
        (
            "completions", "sacks", "pass_first_downs", "pass_air_yards",
            "red_zone_pass_attempts", "end_zone_pass_attempts", "rush_first_downs",
            "explosive_runs", "red_zone_carries", "goal_line_carries",
            "receiving_air_yards", "yac", "receive_first_downs",
            "red_zone_targets", "end_zone_targets", "weekly_median", "weekly_std",
            "weekly_floor", "weekly_ceiling", "boom_rate", "bust_rate",
            "year_over_year_points_change", "years_since_draft", "height", "weight",
            "forty", "bench", "vertical", "broad_jump", "cone", "shuttle", "era_index",
        ),
        "Available in the research table but omitted from the compact default model.",
    ),
)

PRODUCTION_FEATURES = [
    feature
    for group in FEATURE_GROUPS
    if group.status == "production" and group.model_input
    for feature in group.features
]
CORE_FEATURES = list(next(group for group in FEATURE_GROUPS if group.id == "core_scoring").features)
RESEARCH_FEATURES = [
    feature
    for group in FEATURE_GROUPS
    if group.status == "research" and group.model_input
    for feature in group.features
]


def feature_group_manifest() -> list[dict]:
    return [
        {**asdict(group), "features": list(group.features)}
        for group in FEATURE_GROUPS
    ]
