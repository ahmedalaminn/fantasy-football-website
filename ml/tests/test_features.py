import unittest

import pandas as pd

from src.feature_registry import CORE_FEATURES, FEATURE_GROUPS, PRODUCTION_FEATURES
from src.features import (
    NUMERIC_FEATURES,
    TARGET_AVAILABILITY,
    TARGET_PPG,
    aggregate_pbp,
    build_training_frame,
)


def crosswalk():
    return pd.DataFrame([{
        "gsis_id": "rb-1", "sleeper_id": "123", "name": "A Player",
        "position": "RB", "birthdate": "2000-01-01", "draft_year": 2022,
        "draft_round": 2, "draft_pick": 40, "height": 70, "weight": 210,
    }])


class FeatureTests(unittest.TestCase):
    def test_aggregates_pbp_into_player_week_and_scores_ppr(self):
        pbp = pd.DataFrame([
            {
                "season": 2025, "week": 1, "game_id": "g1", "posteam": "BUF",
                "rusher_player_id": "rb-1", "rusher_player_name": "A Player",
                "rush_attempt": 1, "rushing_yards": 12, "rush_touchdown": 1,
                "success": 1, "epa": 1.2, "yardline_100": 8,
            },
            {
                "season": 2025, "week": 1, "game_id": "g1", "posteam": "BUF",
                "receiver_player_id": "rb-1", "receiver_player_name": "A Player",
                "pass_attempt": 1, "complete_pass": 1, "receiving_yards": 8,
                "pass_touchdown": 0, "air_yards": 3, "yards_after_catch": 5,
                "success": 1, "yardline_100": 30,
            },
        ])
        tables = aggregate_pbp(pbp, crosswalk())
        player = tables.player_week.iloc[0]
        self.assertEqual(len(tables.player_week), 1)
        self.assertEqual(player["carries"], 1)
        self.assertEqual(player["targets"], 1)
        self.assertAlmostEqual(player["fantasy_points_ppr"], 9.0)
        self.assertEqual(player["sleeper_id"], "123")

    def test_builds_next_season_conditional_and_availability_targets(self):
        rows = pd.DataFrame([
            {"player_id": "rb-1", "season": 2023, "position": "RB", "points_per_game": 14.0, "games": 10},
            {"player_id": "rb-1", "season": 2024, "position": "RB", "points_per_game": 16.0, "games": 12},
        ])
        result = build_training_frame(rows)
        first = result[result["season"] == 2023].iloc[0]
        self.assertEqual(first[TARGET_PPG], 16)
        self.assertEqual(first[TARGET_AVAILABILITY], 12 / 17)

    def test_feature_tiers_keep_research_metrics_out_of_production(self):
        self.assertIn("fantasy_points_ppr", CORE_FEATURES)
        self.assertIn("forecast_head_coach_pass_rate", PRODUCTION_FEATURES)
        self.assertIn("forecast_sos_position_points_allowed", PRODUCTION_FEATURES)
        research = {
            feature
            for group in FEATURE_GROUPS
            if group.status == "research"
            for feature in group.features
        }
        self.assertTrue(research.isdisjoint(PRODUCTION_FEATURES))
        classified = {
            feature
            for group in FEATURE_GROUPS
            if group.model_input
            for feature in group.features
        }
        self.assertEqual(classified, set(NUMERIC_FEATURES))


if __name__ == "__main__":
    unittest.main()
