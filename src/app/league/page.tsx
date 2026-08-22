import type { Metadata } from "next";
import { Badge, Card, ErrorState, PageHeader, Tabs } from "@/components/ui";
import { getCurrentSeason } from "@/lib/sleeper";

export const metadata: Metadata = { title: "League Info" };
export const dynamic = "force-dynamic";
const tabs = [
  { id: "settings", label: "Settings" },
  { id: "scoring", label: "Scoring" },
  { id: "rules", label: "Constitution" },
];
const labels: Record<string, string> = {
  playoff_teams: "Playoff teams",
  playoff_week_start: "Playoffs begin",
  trade_deadline: "Trade deadline",
  waiver_type: "Waiver system",
  waiver_budget: "FAAB budget",
  reserve_slots: "IR slots",
  taxi_slots: "Taxi slots",
  daily_waivers: "Daily waivers",
  max_keepers: "Keepers",
  draft_rounds: "Draft rounds",
  type: "League type",
  best_ball: "Best ball",
  last_scored_leg: "Last scored week",
  leg: "Current week",
  num_teams: "Teams",
  start_week: "Start week",
  pass_yd: "Passing yards",
  pass_td: "Passing touchdown",
  pass_int: "Interception thrown",
  rush_yd: "Rushing yards",
  rush_td: "Rushing touchdown",
  rec: "Reception",
  rec_yd: "Receiving yards",
  rec_td: "Receiving touchdown",
  fum_lost: "Fumble lost",
  fgm: "Field goal made",
  xpm: "Extra point made",
  sack: "Defense sack",
  int: "Defense interception",
  def_td: "Defense touchdown",
  pts_allow_0: "Shutout",
  bonus_rec_te: "Tight end reception bonus",
};
const humanize = (key: string) =>
  labels[key] ||
  key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
export default async function LeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  try {
    const season = await getCurrentSeason();
    const query = await searchParams;
    const active = tabs.some((item) => item.id === query.tab)
      ? query.tab!
      : "settings";
    const positionCounts = season.league.roster_positions.reduce<
      Record<string, number>
    >((map, position) => {
      map[position] = (map[position] || 0) + 1;
      return map;
    }, {});
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow={`${season.league.season} rulebook`}
          title="League information"
          description="The format, scoring, and rules that define UD Fantasy Football."
        />
        <Tabs items={tabs} active={active} basePath="/league" />
        {active === "settings" && (
          <div className="stack">
            <Card className="league-section">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Lineup architecture</span>
                  <h2>Roster construction</h2>
                </div>
                <Badge tone="violet">
                  {season.league.roster_positions.length} total slots
                </Badge>
              </div>
              <div className="settings-grid">
                {Object.entries(positionCounts).map(([position, count]) => (
                  <div className="setting-item" key={position}>
                    <span>{humanize(position)}</span>
                    <strong>
                      {count} {count === 1 ? "slot" : "slots"}
                    </strong>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="league-section">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Sleeper configuration</span>
                  <h2>General settings</h2>
                </div>
              </div>
              <div className="settings-grid">
                {Object.entries(season.league.settings)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, value]) => (
                    <div className="setting-item" key={key}>
                      <span>{humanize(key)}</span>
                      <strong>{String(value)}</strong>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        )}
        {active === "scoring" && (
          <Card className="league-section">
            <div className="section-header">
              <div>
                <span className="eyebrow">Official scoring</span>
                <h2>Scoring system</h2>
              </div>
              <Badge tone="aqua">From Sleeper</Badge>
            </div>
            <div className="settings-grid">
              {Object.entries(season.league.scoring_settings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => (
                  <div className="setting-item" key={key}>
                    <span>{humanize(key)}</span>
                    <strong>
                      {value > 0 ? "+" : ""}
                      {value} pts
                    </strong>
                  </div>
                ))}
            </div>
          </Card>
        )}
        {active === "rules" && (
          <Card className="league-section">
            <div className="section-header">
              <div>
                <span className="eyebrow">League constitution</span>
                <h2>Rules & conduct</h2>
              </div>
            </div>
            <p>ahad this is ur job</p>
          </Card>
        )}
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader title="League information" />
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
          />
        </Card>
      </div>
    );
  }
}
