import unittest

import pandas as pd

from src.context import build_forecast_context


class ContextTests(unittest.TestCase):
    def test_coach_and_schedule_features_use_prior_season_performance(self):
        team_week = pd.DataFrame([
            {
                "season": season, "week": 1, "game_id": f"{season}-g", "team": team,
                "pass_attempt": passes, "rush_attempt": 10, "success": successes,
                "epa": epa, "touchdown": touchdowns,
            }
            for season, team, passes, successes, epa, touchdowns in (
                (2024, "AAA", 30, 25, 12, 4),
                (2024, "BBB", 10, 5, -8, 1),
                (2025, "AAA", 10, 6, -4, 1),
                (2025, "BBB", 30, 22, 10, 4),
            )
        ])
        player_week = pd.DataFrame([
            {
                "season": season, "week": 1, "game_id": f"{season}-g", "team": team,
                "position": position, "fantasy_points_ppr": points,
            }
            for season, team, position, points in (
                (2024, "AAA", "QB", 20), (2024, "BBB", "QB", 8),
                (2025, "AAA", "QB", 7), (2025, "BBB", "QB", 22),
            )
        ])
        schedules = pd.DataFrame([
            {
                "season": season, "game_type": "REG", "week": 1,
                "home_team": "AAA", "away_team": "BBB",
                "home_coach": "Coach A", "away_coach": "Coach B",
            }
            for season in (2024, 2025, 2026)
        ])

        context = build_forecast_context(player_week, team_week, schedules)
        aaa_2025 = context[
            (context["season"] == 2025)
            & (context["team"] == "AAA")
            & (context["position"] == "QB")
        ].iloc[0]
        aaa_2026 = context[
            (context["season"] == 2026)
            & (context["team"] == "AAA")
            & (context["position"] == "QB")
        ].iloc[0]

        self.assertAlmostEqual(aaa_2025["forecast_team_pass_rate"], 30 / 40)
        self.assertAlmostEqual(aaa_2026["forecast_team_pass_rate"], 10 / 20)
        self.assertEqual(aaa_2026["forecast_head_coach_experience"], 2)
        self.assertEqual(aaa_2026["forecast_head_coach_continuity"], 1)
        self.assertAlmostEqual(aaa_2026["forecast_head_coach_pass_rate"], 0.625)
        self.assertEqual(aaa_2026["forecast_sos_position_points_allowed"], 7)


if __name__ == "__main__":
    unittest.main()
