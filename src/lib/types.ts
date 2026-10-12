export type LeagueStatus =
  "pre_draft" | "drafting" | "in_season" | "post_season" | "complete";

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: LeagueStatus;
  previous_league_id: string | null;
  total_rosters: number;
  avatar: string | null;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  settings: Record<string, number>;
  draft_id?: string | null;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    team_name?: string;
  };
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  co_owners?: string[] | null;
  players: string[] | null;
  starters: string[] | null;
  reserve?: string[] | null;
  taxi?: string[] | null;
  settings: Record<string, number>;
  metadata?: Record<string, string>;
}

export interface SleeperPlayer {
  player_id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  team: string | null;
  position: string | null;
  fantasy_positions: string[] | null;
  status?: string | null;
  active?: boolean;
  age?: number | null;
  years_exp?: number | null;
  search_rank?: number | null;
  depth_chart_order?: number | null;
  injury_status?: string | null;
  bye_week?: number | null;
}

export interface SleeperMatchup {
  matchup_id: number | null;
  roster_id: number;
  points: number;
  custom_points: number | null;
  players: string[] | null;
  starters: string[] | null;
  players_points: Record<string, number> | null;
  starters_points?: number[] | null;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: "trade" | "waiver" | "free_agent" | "commissioner";
  status: string;
  status_updated: number;
  created: number;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: TradedPick[];
  waiver_budget: Array<{ sender: number; receiver: number; amount: number }>;
  settings?: { waiver_bid?: number; seq?: number };
}

export interface TradedPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: string;
  type: string;
  status: string;
  start_time: number | null;
  settings: Record<string, number>;
  slot_to_roster_id: Record<string, number>;
  draft_order?: Record<string, number>;
  metadata?: Record<string, string>;
}

export interface SleeperDraftPick {
  pick_no: number;
  round: number;
  draft_slot: number;
  player_id: string;
  roster_id: number;
  picked_by: string;
  metadata?: Record<string, string>;
}

export interface BracketMatch {
  r: number;
  m: number;
  t1: number | null;
  t2: number | null;
  w?: number | null;
  l?: number | null;
  p?: number;
}

export interface NflState {
  season: string;
  season_type: string;
  week: number;
  leg: number;
}

export interface Team {
  rosterId: number;
  ownerId: string | null;
  managerName: string;
  teamName: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
  players: string[];
  starters: string[];
  reserve: string[];
  taxi: string[];
  raw: SleeperRoster;
}

export interface MatchupPair {
  matchupId: number;
  teams: Array<{ team: Team; matchup: SleeperMatchup }>;
  status: "upcoming" | "live" | "final" | "bye";
}

export interface Standing extends Team {
  rank: number;
  winPercentage: number;
  playoff: boolean;
}

export interface Champion {
  season: string;
  leagueId: string;
  champion: Team;
  runnerUp: Team | null;
  thirdPlace: Team | null;
  regularSeasonChampion: Team | null;
  lastPlace: Team | null;
  titleCount: number;
}

export interface PowerRanking {
  rosterId: number;
  team: Team;
  rank: number;
  score: number;
  movement: number;
  components: {
    winPercentage: number;
    totalPoints: number;
    wins: number;
    losses: number;
    ties: number;
    allPlayWins: number;
    allPlayLosses: number;
    allPlayTies: number;
    allPlayWinPercentage: number;
    pointsRankPoints: number;
    allPlayRankPoints: number;
    recordRankPoints: number;
    weightedPoints: number;
    lineupEfficiency: number;
  };
}

export interface LeagueRecord {
  label: string;
  value: string;
  manager: string;
  teamName: string;
  season: string;
  week?: number;
}

export interface SeasonBundle {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  teams: Team[];
}
