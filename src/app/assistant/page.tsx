import type { Metadata } from "next";
import { DraftAssistant, type AssistantManager } from "@/components/draft-assistant";
import { Icon } from "@/components/icon";
import { Badge, Card, ErrorState, PageHeader } from "@/components/ui";
import projectionData from "@/data/draft-projections.json";
import {
  DRAFT_POSITIONS,
  buildDraftPlayerPool,
  buildManagerProfiles,
  type ManagerDraftProfile,
  type ProjectionArtifact,
} from "@/lib/draft-assistant";
import {
  getCurrentSeason,
  getDraft,
  getDraftPicks,
  getDrafts,
  getLiveDraftPicks,
  getPlayers,
  getSeasonBundle,
  getSeasonChain,
  getTradedPicks,
} from "@/lib/sleeper";

export const metadata: Metadata = { title: "AI Assistant" };
export const dynamic = "force-dynamic";

const capabilities = [
  {
    title: "Draft Assistant",
    description: "Live recommendations, mock drafts, player comparisons, and manager-aware strategy.",
    status: "Active",
    tone: "aqua" as const,
  },
  {
    title: "Lineup Assistant",
    description: "Weekly start, sit, floor, ceiling, and matchup decisions.",
    status: "Next",
    tone: "violet" as const,
  },
  {
    title: "Waiver + Trade Lab",
    description: "Roster-aware waiver priorities and fair trade construction.",
    status: "Planned",
    tone: "neutral" as const,
  },
  {
    title: "News Terminal",
    description: "Credibility-weighted NFL news translated into player impact.",
    status: "Active",
    tone: "aqua" as const,
  },
];

async function loadHistoricalProfiles(
  players: Awaited<ReturnType<typeof getPlayers>>,
) {
  const leagues = (await getSeasonChain()).slice(1, 7);
  const seasonProfiles = await Promise.all(
    leagues.map(async (league) => {
      const [bundle, drafts] = await Promise.all([
        getSeasonBundle(league.league_id),
        getDrafts(league.league_id).catch(() => []),
      ]);
      const picks = drafts[0]
        ? await getDraftPicks(drafts[0].draft_id).catch(() => [])
        : [];
      return buildManagerProfiles(bundle.teams, picks, players);
    }),
  );
  const merged = new Map<string, ManagerDraftProfile>();
  for (const profile of seasonProfiles.flat()) {
    const previous = merged.get(profile.ownerId);
    if (!previous) {
      merged.set(profile.ownerId, profile);
      continue;
    }
    const total = previous.sampleSize + profile.sampleSize;
    const positionShare = { ...previous.positionShare };
    for (const position of DRAFT_POSITIONS) {
      const oldWeighted = (previous.positionShare[position] ?? 0) * previous.sampleSize;
      const newWeighted = (profile.positionShare[position] ?? 0) * profile.sampleSize;
      positionShare[position] = (oldWeighted + newWeighted) / total;
    }
    const averageRound = { ...previous.averageRound };
    for (const position of DRAFT_POSITIONS) {
      const oldCount = previous.positionShare[position] ? previous.sampleSize : 0;
      const newCount = profile.positionShare[position] ? profile.sampleSize : 0;
      const denominator = oldCount + newCount;
      if (denominator) {
        averageRound[position] =
          ((previous.averageRound[position] ?? 0) * oldCount
            + (profile.averageRound[position] ?? 0) * newCount) / denominator;
      }
    }
    merged.set(profile.ownerId, {
      ownerId: profile.ownerId, sampleSize: total, positionShare, averageRound,
    });
  }
  return [...merged.values()];
}

export default async function AssistantPage() {
  try {
    const [season, players] = await Promise.all([getCurrentSeason(), getPlayers()]);
    const drafts = await getDrafts(season.league.league_id);
    const draftSummary =
      drafts.find((entry) => entry.draft_id === season.league.draft_id) ?? drafts[0];
    if (!draftSummary) throw new Error("Sleeper has not created this season’s draft yet.");
    const draft = await getDraft(draftSummary.draft_id);
    const [picks, tradedPicks, profiles] = await Promise.all([
      getLiveDraftPicks(draft.draft_id).catch(() => []),
      getTradedPicks(draft.draft_id).catch(() => []),
      loadHistoricalProfiles(players).catch(() => []),
    ]);
    const artifact = projectionData as ProjectionArtifact;
    const playerPool = buildDraftPlayerPool(players, artifact, {
      teams: draft.settings.teams,
      rosterPositions: season.league.roster_positions,
      scoringSettings: season.league.scoring_settings,
    });
    const managers: AssistantManager[] = season.teams.flatMap((team) =>
      team.ownerId
        ? [
            {
              rosterId: team.rosterId,
              ownerId: team.ownerId,
              managerName: team.managerName,
              teamName: team.teamName,
              avatarUrl: team.avatarUrl,
            },
          ]
        : [],
    );
    const ahmed = managers.find(
      (manager) => manager.managerName.toLowerCase() === "ahmedalamin",
    );
    const defaultOwnerId =
      process.env.ASSISTANT_DEFAULT_USER_ID ?? ahmed?.ownerId ?? managers[0]?.ownerId ?? "";
    return (
      <div className="content-wrap">
        <PageHeader
          eyebrow="League intelligence"
          title="AI Assistant"
          description="One shared football model, tuned to every manager’s roster, draft capital, history, and preferences."
          actions={
            <a
              className="button"
              href={`https://sleeper.com/draft/nfl/${draft.draft_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open Sleeper <Icon name="external" />
            </a>
          }
        />

        <div className="capability-grid reveal-delay">
          {capabilities.map((capability, index) => (
            <Card className={`capability-card ${index === 0 ? "active" : ""}`} key={capability.title}>
              <div className="capability-icon"><Icon name="spark" /></div>
              <Badge tone={capability.tone}>{capability.status}</Badge>
              <h2>{capability.title}</h2>
              <p>{capability.description}</p>
            </Card>
          ))}
        </div>

        <div className="assistant-section-heading">
          <div>
            <span className="eyebrow">Capability 01</span>
            <h2>Draft Assistant</h2>
          </div>
          <p>
            {draft.settings.teams}-team {draft.metadata?.scoring_type?.toUpperCase() ?? "PPR"} · {draft.settings.rounds} rounds · {draft.type}
          </p>
        </div>
        <DraftAssistant
          draft={draft}
          managers={managers}
          players={playerPool}
          initialPicks={picks}
          tradedPicks={tradedPicks}
          profiles={profiles}
          artifact={artifact}
          defaultOwnerId={defaultOwnerId}
          rosterPositions={season.league.roster_positions}
          scoringSettings={season.league.scoring_settings}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="content-wrap">
        <PageHeader title="AI Assistant" description="The league intelligence layer is ready to reconnect." />
        <Card><ErrorState message={error instanceof Error ? error.message : undefined} /></Card>
      </div>
    );
  }
}
