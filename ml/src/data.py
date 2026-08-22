from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from urllib.request import urlretrieve

import pandas as pd

PBP_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/pbp/"
    "play_by_play_{season}.csv.gz"
)
CROSSWALK_URL = (
    "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv"
)
COMBINE_URL = "https://github.com/nflverse/nflverse-data/releases/download/combine/combine.csv"
DRAFT_URL = "https://github.com/nflverse/nflverse-data/releases/download/draft_picks/draft_picks.csv"
SCHEDULES_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"

# Reading only fields used by the feature builder keeps one season comfortably
# in memory and tolerates old seasons that lack newer metrics.
PBP_COLUMNS = {
    "season", "season_type", "week", "game_id", "play_id", "posteam",
    "qtr", "score_differential", "yardline_100", "epa", "success",
    "pass_attempt", "complete_pass", "passing_yards", "pass_touchdown",
    "interception", "sack", "qb_epa", "cpoe", "first_down_pass",
    "air_yards", "two_point_conv_result", "passer_player_id",
    "passer_player_name", "rush_attempt", "rushing_yards",
    "rush_touchdown", "first_down_rush", "rusher_player_id",
    "rusher_player_name", "receiver_player_id", "receiver_player_name",
    "receiving_yards", "yards_after_catch", "fumble_lost",
    "fumbled_1_player_id", "touchdown",
}


def download(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        urlretrieve(url, destination)
    return destination


def iter_pbp(
    start_season: int,
    latest_season: int,
    raw_dir: Path,
) -> Iterator[tuple[int, pd.DataFrame]]:
    """Yield one regular-season PBP frame at a time."""
    for season in range(start_season, latest_season + 1):
        yield season, load_pbp_season(season, raw_dir)


def load_pbp_season(season: int, raw_dir: Path) -> pd.DataFrame:
    path = download(PBP_URL.format(season=season), raw_dir / f"play_by_play_{season}.csv.gz")
    frame = pd.read_csv(
        path, compression="gzip", low_memory=False,
        usecols=lambda column: column in PBP_COLUMNS,
    )
    if "season" not in frame:
        frame["season"] = season
    if "season_type" in frame:
        frame = frame[frame["season_type"].eq("REG")]
    return frame


def load_crosswalk(raw_dir: Path) -> pd.DataFrame:
    path = download(CROSSWALK_URL, raw_dir / "db_playerids.csv")
    ids = pd.read_csv(path, low_memory=False, dtype={"sleeper_id": "string"})
    wanted = [
        "gsis_id", "sleeper_id", "name", "position", "birthdate",
        "draft_year", "draft_round", "draft_pick", "height", "weight", "pfr_id",
    ]
    for column in wanted:
        if column not in ids:
            ids[column] = pd.NA
    return ids[wanted]


def load_player_context(raw_dir: Path) -> pd.DataFrame:
    """Combine the ID map with free nflverse draft and combine measurements."""
    ids = load_crosswalk(raw_dir)
    combine = pd.read_csv(download(COMBINE_URL, raw_dir / "combine.csv"), low_memory=False)
    draft = pd.read_csv(download(DRAFT_URL, raw_dir / "draft_picks.csv"), low_memory=False)

    combine_key = next((column for column in ("pfr_id", "pfr_player_id") if column in combine), None)
    if combine_key:
        measurements = {
            "forty": ("forty", "forty_yard"), "bench": ("bench", "bench_reps"),
            "vertical": ("vertical",), "broad_jump": ("broad_jump",),
            "cone": ("cone", "three_cone"), "shuttle": ("shuttle",),
        }
        selected = [combine_key]
        rename = {combine_key: "pfr_id"}
        for output, candidates in measurements.items():
            source = next((column for column in candidates if column in combine), None)
            if source:
                selected.append(source)
                rename[source] = output
        ids = ids.merge(combine[selected].rename(columns=rename).drop_duplicates("pfr_id"), on="pfr_id", how="left")

    if "gsis_id" in draft:
        selected = ["gsis_id"]
        rename = {}
        for output, candidates in {
            "draft_year_nflverse": ("season", "draft_year"),
            "draft_round_nflverse": ("round", "draft_round"),
            "draft_pick_nflverse": ("pick", "draft_pick"),
        }.items():
            source = next((column for column in candidates if column in draft), None)
            if source:
                selected.append(source)
                rename[source] = output
        ids = ids.merge(draft[selected].rename(columns=rename).drop_duplicates("gsis_id"), on="gsis_id", how="left")
        for field in ("draft_year", "draft_round", "draft_pick"):
            nflverse = f"{field}_nflverse"
            if nflverse in ids:
                ids[field] = ids[field].fillna(ids.pop(nflverse))

    for column in ("forty", "bench", "vertical", "broad_jump", "cone", "shuttle"):
        if column not in ids:
            ids[column] = pd.NA
    return ids


def load_schedules(raw_dir: Path) -> pd.DataFrame:
    """Load nflverse's historical and current schedule/coaching table."""
    path = download(SCHEDULES_URL, raw_dir / "games.csv")
    wanted = [
        "season", "game_type", "week", "away_team", "home_team",
        "away_coach", "home_coach",
    ]
    frame = pd.read_csv(path, low_memory=False, usecols=lambda column: column in wanted)
    for column in wanted:
        if column not in frame:
            frame[column] = pd.NA
    return frame[wanted]
