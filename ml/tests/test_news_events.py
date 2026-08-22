import unittest

import pandas as pd

from src.news_events import build_event_outcomes, event_type_report


class NewsEventTests(unittest.TestCase):
    def test_aligns_events_without_using_pre_event_games_as_outcomes(self):
        weeks = pd.DataFrame([
            {"player_id": "p1", "season": 2025, "week": week, "fantasy_points_ppr": points, "carries": 10 + week, "targets": 2}
            for week, points in enumerate([8, 9, 10, 11, 15, 16, 17, 18], start=1)
        ])
        events = pd.DataFrame([{
            "player_id": "p1", "season": 2025, "week": 4,
            "event_type": "coach_quote", "direction": "up",
            "confidence": .7, "source_credibility": .8,
        }])
        outcomes = build_event_outcomes(events, weeks)
        self.assertEqual(outcomes.iloc[0]["before_points"], 9.5)
        self.assertEqual(outcomes.iloc[0]["after_points"], 16.5)
        report = event_type_report(outcomes, minimum_samples=1)
        self.assertTrue(report.iloc[0]["eligible_for_model"])
        self.assertEqual(report.iloc[0]["direction_accuracy"], 1)


if __name__ == "__main__":
    unittest.main()
