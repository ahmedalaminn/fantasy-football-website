export interface ManagerProfile {
  bio?: string;
  favoriteTeam?: string;
  philosophy?: string;
}

export interface LeagueResource {
  name: string;
  description: string;
  href: string;
  category: "Analysis" | "News" | "Tools" | "Community";
}

export const leagueContent = {
  introduction:
    "Five seasons. Ten managers. One trophy. Welcome to the home of UD Fantasy Football—where every matchup adds another chapter to the league story.",
  managerProfiles: {} as Record<string, ManagerProfile>,
  championStories: {} as Record<string, string>,
  constitution: [
    {
      title: "League format",
      body: "Official roster, playoff, waiver, and scoring settings are shown directly from Sleeper below. Add league-specific rules here when they are finalized.",
    },
    {
      title: "Competition",
      body: "Managers are expected to set a competitive lineup every week and act in the best interest of fair league play.",
    },
    {
      title: "Trades and conduct",
      body: "Trades process according to the settings configured in Sleeper. Collusion and roster dumping are not permitted.",
    },
  ],
  resources: [
    {
      name: "Sleeper",
      description: "Official league, lineup, and transaction home.",
      href: "https://sleeper.com/",
      category: "Tools" as const,
    },
    {
      name: "FantasyPros",
      description: "Weekly rankings, analysis, and start/sit tools.",
      href: "https://www.fantasypros.com/nfl/",
      category: "Analysis" as const,
    },
    {
      name: "FantasyCalc",
      description: "Crowdsourced dynasty trade values and calculator.",
      href: "https://fantasycalc.com/",
      category: "Tools" as const,
    },
    {
      name: "r/fantasyfootball",
      description: "Fantasy news, discussion, and community analysis.",
      href: "https://www.reddit.com/r/fantasyfootball/",
      category: "Community" as const,
    },
  ] satisfies LeagueResource[],
};
