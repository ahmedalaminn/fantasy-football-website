"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  DraftPlayer,
  ManagerDraftProfile,
  ProjectionArtifact,
} from "@/lib/draft-assistant";
import {
  applyNewsAnalyses,
  depthChartLabel,
  managerPickNumbers,
  parseMarketRankCsv,
  recommendPlayers,
} from "@/lib/draft-assistant";
import type { NewsAnalysis } from "@/lib/news";
import type { SleeperDraft, SleeperDraftPick, TradedPick } from "@/lib/types";
import { Avatar, Badge } from "./ui";
import { NewsTerminal } from "./news-terminal";
import { SleeperPlayerLink } from "./sleeper-player-link";

export interface AssistantManager {
  rosterId: number;
  ownerId: string;
  managerName: string;
  teamName: string;
  avatarUrl: string | null;
}

type View =
  "recommendations" | "board" | "roster" | "players" | "strategy" | "news";
type Mode = "mock" | "live";

const views: Array<{ id: View; label: string }> = [
  { id: "recommendations", label: "Recommendations" },
  { id: "board", label: "Draft board" },
  { id: "roster", label: "My roster" },
  { id: "players", label: "Player explorer" },
  { id: "strategy", label: "Strategy" },
  { id: "news", label: "News terminal" },
];

function ownerForPick(pick: number, draft: SleeperDraft, trades: TradedPick[]) {
  const teams = draft.settings.teams;
  const round = Math.ceil(pick / teams);
  const withinRound = ((pick - 1) % teams) + 1;
  const slot = round % 2 === 1 ? withinRound : teams - withinRound + 1;
  const originalRoster = draft.slot_to_roster_id[String(slot)];
  return (
    trades.find(
      (trade) => trade.round === round && trade.roster_id === originalRoster,
    )?.owner_id ?? originalRoster
  );
}

function slotForPick(pick: number, teams: number) {
  const round = Math.ceil(pick / teams);
  const withinRound = ((pick - 1) % teams) + 1;
  return round % 2 === 1 ? withinRound : teams - withinRound + 1;
}

export function DraftAssistant({
  draft,
  managers,
  players,
  initialPicks,
  tradedPicks,
  profiles,
  artifact,
  defaultOwnerId,
  rosterPositions,
  scoringSettings,
}: {
  draft: SleeperDraft;
  managers: AssistantManager[];
  players: DraftPlayer[];
  initialPicks: SleeperDraftPick[];
  tradedPicks: TradedPick[];
  profiles: ManagerDraftProfile[];
  artifact: ProjectionArtifact;
  defaultOwnerId: string;
  rosterPositions: string[];
  scoringSettings: Record<string, number>;
}) {
  const defaultManager =
    managers.find((manager) => manager.ownerId === defaultOwnerId) ??
    managers[0];
  const [managerId, setManagerId] = useState(defaultManager?.rosterId ?? 0);
  const [mode, setMode] = useState<Mode>(
    draft.status === "drafting" ? "live" : "mock",
  );
  const [view, setView] = useState<View>("recommendations");
  const [livePicks, setLivePicks] = useState(initialPicks);
  const [mockPicks, setMockPicks] = useState<SleeperDraftPick[]>([]);
  const [personalized, setPersonalized] = useState(true);
  const [query, setQuery] = useState("");
  const [compared, setCompared] = useState<string[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [riskPreference, setRiskPreference] = useState<
    "floor" | "balanced" | "upside"
  >("balanced");
  const [newsAnalyses, setNewsAnalyses] = useState<NewsAnalysis[]>([]);
  const [marketRanks, setMarketRanks] = useState<Map<string, number>>(
    new Map(),
  );

  const selectedManager = managers.find(
    (manager) => manager.rosterId === managerId,
  )!;
  const activePicks = mode === "live" ? livePicks : mockPicks;
  const effectivePlayers = useMemo(() => {
    const ranked = players
      .map((player) => ({
        ...player,
        marketRank: marketRanks.get(player.id) ?? player.marketRank,
      }))
      .sort((a, b) => a.marketRank - b.marketRank);
    const counts = new Map<string, number>();
    const withPositionRanks = ranked.map((player) => {
      const rank = (counts.get(player.position) ?? 0) + 1;
      counts.set(player.position, rank);
      return { ...player, positionRank: rank };
    });
    return applyNewsAnalyses(withPositionRanks, newsAnalyses);
  }, [players, marketRanks, newsAnalyses]);
  const totalPicks = draft.settings.rounds * draft.settings.teams;
  const currentPick = Math.min(
    totalPicks + 1,
    (activePicks.length
      ? Math.max(...activePicks.map((pick) => pick.pick_no))
      : 0) + 1,
  );
  const pickInventory = useMemo(
    () => managerPickNumbers(draft, managerId, tradedPicks),
    [draft, managerId, tradedPicks],
  );
  const nextManagerPick =
    pickInventory.find((pick) => pick >= currentPick) ?? null;
  const followingManagerPick =
    pickInventory.find((pick) => pick > currentPick) ?? null;
  const draftedIds = activePicks.map((pick) => pick.player_id);
  const rosterIds = activePicks
    .filter((pick) => pick.roster_id === managerId)
    .map((pick) => pick.player_id);
  const managerProfile = profiles.find(
    (profile) => profile.ownerId === selectedManager?.ownerId,
  );
  const recommendations = recommendPlayers({
    players: effectivePlayers,
    draftedIds,
    rosterIds,
    overallPick: currentPick,
    nextPick: followingManagerPick,
    profile: managerProfile,
    personalized,
    league: {
      teams: draft.settings.teams,
      rosterPositions,
      scoringSettings,
      riskPreference,
    },
  });
  const playerMap = useMemo(
    () => new Map(effectivePlayers.map((player) => [player.id, player])),
    [effectivePlayers],
  );
  const searchedPlayers = recommendations
    .filter((player) =>
      `${player.name} ${player.team} ${player.position}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .slice(0, query ? 30 : 12);

  useEffect(() => {
    setMockPicks([]);
    setCompared([]);
  }, [managerId]);

  useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    const refresh = async () => {
      const response = await fetch(`/api/draft/${draft.draft_id}`, {
        cache: "no-store",
      }).catch(() => null);
      if (!response?.ok || cancelled) return;
      setLivePicks((await response.json()) as SleeperDraftPick[]);
      setLastSync(new Date());
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [draft.draft_id, mode]);

  function addMockPick(player: DraftPlayer, rosterId: number) {
    if (currentPick > totalPicks) return;
    setMockPicks((picks) => [
      ...picks,
      {
        pick_no: currentPick,
        round: Math.ceil(currentPick / draft.settings.teams),
        draft_slot: slotForPick(currentPick, draft.settings.teams),
        player_id: player.id,
        roster_id: rosterId,
        picked_by:
          managers.find((manager) => manager.rosterId === rosterId)?.ownerId ??
          "",
      },
    ]);
  }

  function simulateToManager() {
    if (mode !== "mock") return;
    const simulated = [...mockPicks];
    const taken = new Set(simulated.map((pick) => pick.player_id));
    let pick = currentPick;
    while (
      pick <= totalPicks &&
      ownerForPick(pick, draft, tradedPicks) !== managerId
    ) {
      const available = recommendations.find((player) => !taken.has(player.id));
      if (!available) break;
      const rosterId = ownerForPick(pick, draft, tradedPicks);
      simulated.push({
        pick_no: pick,
        round: Math.ceil(pick / draft.settings.teams),
        draft_slot: slotForPick(pick, draft.settings.teams),
        player_id: available.id,
        roster_id: rosterId,
        picked_by:
          managers.find((manager) => manager.rosterId === rosterId)?.ownerId ??
          "",
      });
      taken.add(available.id);
      pick += 1;
    }
    setMockPicks(simulated);
  }

  async function importMarketRanks(file: File | null) {
    if (!file) return;
    setMarketRanks(parseMarketRankCsv(await file.text()));
  }

  const onClock =
    currentPick <= totalPicks &&
    ownerForPick(currentPick, draft, tradedPicks) === managerId;
  const modelReady = !artifact.stale && artifact.players.length > 0;
  const productionGroups =
    artifact.featureGroups?.filter((group) => group.status === "production") ??
    [];
  const coreFeatureCount = productionGroups
    .filter((group) => group.tier === "core")
    .reduce((total, group) => total + group.features.length, 0);
  const supplementalFeatureCount = productionGroups
    .filter((group) => group.tier === "supplemental")
    .reduce((total, group) => total + group.features.length, 0);

  return (
    <div className="assistant-workspace">
      <div className="assistant-toolbar">
        <label className="manager-select">
          <span>Recommendations for</span>
          <select
            value={managerId}
            onChange={(event) => setManagerId(Number(event.target.value))}
          >
            {managers.map((manager) => (
              <option value={manager.rosterId} key={manager.rosterId}>
                {manager.managerName} — {manager.teamName}
              </option>
            ))}
          </select>
        </label>
        <div className="mode-switch" aria-label="Draft mode">
          <button
            className={mode === "mock" ? "active" : ""}
            onClick={() => setMode("mock")}
          >
            Mock draft
          </button>
          <button
            className={mode === "live" ? "active" : ""}
            onClick={() => setMode("live")}
          >
            Live draft
          </button>
        </div>
        <label className="personalize-toggle">
          <input
            type="checkbox"
            checked={personalized}
            onChange={(event) => setPersonalized(event.target.checked)}
          />
          Personalized
        </label>
        <label className="manager-select risk-select">
          <span>Risk style</span>
          <select
            value={riskPreference}
            onChange={(event) =>
              setRiskPreference(event.target.value as typeof riskPreference)
            }
          >
            <option value="floor">Floor</option>
            <option value="balanced">Balanced</option>
            <option value="upside">Upside</option>
          </select>
        </label>
      </div>

      <div className="assistant-status-grid">
        <div>
          <span>Current pick</span>
          <strong>
            {currentPick <= totalPicks ? currentPick : "Complete"}
          </strong>
        </div>
        <div>
          <span>{selectedManager.managerName}&apos;s next pick</span>
          <strong>{nextManagerPick ?? "—"}</strong>
        </div>
        <div>
          <span>Roster</span>
          <strong>
            {rosterIds.length}/{draft.settings.rounds}
          </strong>
        </div>
        <div>
          <span>Projection engine</span>
          <strong className={modelReady ? "status-good" : "status-warn"}>
            {modelReady ? "Python model" : "Market fallback"}
          </strong>
        </div>
      </div>

      <nav className="assistant-tabs" aria-label="Draft assistant sections">
        {views.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? "active" : ""}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {view === "recommendations" && (
        <div className="assistant-grid">
          <div className="recommendation-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Decision room</span>
                <h2>
                  {onClock
                    ? `${selectedManager.managerName} is on the clock`
                    : `Preparing pick ${nextManagerPick ?? "—"}`}
                </h2>
              </div>
              {mode === "mock" && (
                <div className="mock-actions">
                  <button
                    className="button"
                    onClick={() => setMockPicks((picks) => picks.slice(0, -1))}
                    disabled={!mockPicks.length}
                  >
                    Undo
                  </button>
                  <button
                    className="button"
                    onClick={() => setMockPicks([])}
                    disabled={!mockPicks.length}
                  >
                    Reset
                  </button>
                  <button
                    className="button button-primary"
                    onClick={simulateToManager}
                    disabled={onClock}
                  >
                    {onClock ? "You’re on the clock" : "Simulate to my pick"}
                  </button>
                </div>
              )}
            </div>
            <div className="recommendation-list">
              {recommendations.slice(0, 5).map((player, index) => (
                <article
                  className={`recommendation ${index === 0 ? "best" : ""}`}
                  key={player.id}
                >
                  <span className="recommendation-rank">{index + 1}</span>
                  <span
                    className={`position-chip position-${player.position.toLowerCase()}`}
                  >
                    {player.position}
                  </span>
                  <div className="recommendation-copy">
                    <div>
                      <h3>
                        <SleeperPlayerLink
                          id={player.id}
                          name={player.name}
                          position={player.position}
                        />
                      </h3>
                      <Badge
                        tone={
                          player.projectionSource === "python-model" ||
                          player.projectionSource === "news-adjusted"
                            ? "aqua"
                            : "neutral"
                        }
                      >
                        {player.projectionSource === "news-adjusted"
                          ? "News adjusted"
                          : player.projectionSource === "python-model"
                            ? player.depthChartOrder
                              ? "ML + Sleeper role"
                              : "ML projection"
                            : player.projectionSource === "rookie-fallback"
                              ? "Rookie baseline"
                              : "Market baseline"}
                      </Badge>
                      {depthChartLabel(player) && (
                        <span className="depth-chart-chip">
                          {depthChartLabel(player)}
                        </span>
                      )}
                    </div>
                    <p>
                      {player.team} · {player.position}
                      {player.positionRank} · {player.reason}
                    </p>
                    {player.projectionContext?.headCoach && (
                      <small>
                        {player.projectionContext.headCoach}
                        {player.projectionContext.coachContinuity
                          ? " · returning staff"
                          : " · staff change"}
                        {player.projectionContext
                          .schedulePositionPointsAllowed != null
                          ? " · schedule modeled"
                          : ""}
                      </small>
                    )}
                    <div className="projection-range">
                      <span>
                        Floor <strong>{player.floor}</strong>
                      </span>
                      <span>
                        Median <strong>{player.projectedPoints}</strong>
                      </span>
                      <span>
                        Ceiling <strong>{player.ceiling}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="recommendation-score">
                    <strong>{player.personalizedScore}</strong>
                    <span>Fit score</span>
                    <small>
                      {player.availabilityAtNextPick}% next-pick chance
                    </small>
                  </div>
                  {mode === "mock" && onClock && (
                    <button
                      className="button button-primary draft-player-button"
                      onClick={() => addMockPick(player, managerId)}
                    >
                      Draft
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
          <aside className="manager-profile-card">
            <Avatar
              src={selectedManager.avatarUrl}
              name={selectedManager.managerName}
              size="lg"
              ring
            />
            <span className="eyebrow">Manager intelligence</span>
            <h3>{selectedManager.teamName}</h3>
            <p>
              {managerProfile?.sampleSize
                ? `Personalized from ${managerProfile.sampleSize} weighted historical selections.`
                : "No reliable historical sample yet. Recommendations use pure optimization."}
            </p>
            <div className="profile-tendencies">
              {Object.entries(managerProfile?.positionShare ?? {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([position, share]) => (
                  <div key={position}>
                    <span>{position}</span>
                    <i>
                      <b style={{ width: `${Math.min(100, share * 300)}%` }} />
                    </i>
                    <strong>{Math.round(share * 100)}%</strong>
                  </div>
                ))}
            </div>
            <small>
              Preferences adjust close calls only. Turn personalization off to
              see the pure optimizer.
            </small>
          </aside>
        </div>
      )}

      {view === "board" && (
        <div className="assistant-card">
          <div className="panel-heading panel-pad">
            <div>
              <span className="eyebrow">{mode} board</span>
              <h2>{activePicks.length} selections</h2>
            </div>
            {mode === "live" && (
              <small>
                {lastSync
                  ? `Synced ${lastSync.toLocaleTimeString()}`
                  : "Connecting to Sleeper…"}
              </small>
            )}
          </div>
          <div
            className="assistant-draft-board"
            style={{
              gridTemplateColumns: `repeat(${draft.settings.teams}, minmax(125px, 1fr))`,
            }}
          >
            {Array.from({ length: totalPicks }, (_, index) => index + 1).map(
              (number) => {
                const pick = activePicks.find(
                  (entry) => entry.pick_no === number,
                );
                const player = pick ? playerMap.get(pick.player_id) : null;
                const owner = ownerForPick(number, draft, tradedPicks);
                const manager = managers.find(
                  (entry) => entry.rosterId === owner,
                );
                return (
                  <div
                    className={`assistant-board-pick ${owner === managerId ? "mine" : ""}`}
                    key={number}
                  >
                    <span>{number}</span>
                    <strong>
                      {player ? (
                        <SleeperPlayerLink
                          id={player.id}
                          name={player.name}
                          position={player.position}
                        />
                      ) : (
                        "Available"
                      )}
                    </strong>
                    <small>
                      {player
                        ? `${player.position} · ${player.team}${depthChartLabel(player) ? ` · ${depthChartLabel(player)}` : ""}`
                        : (manager?.managerName ?? "—")}
                    </small>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      {view === "roster" && (
        <div className="assistant-card roster-assistant-list">
          <div className="panel-heading panel-pad">
            <div>
              <span className="eyebrow">Current build</span>
              <h2>{selectedManager.teamName}</h2>
            </div>
          </div>
          {rosterIds.length ? (
            rosterIds.map((id, index) => {
              const player = playerMap.get(id);
              return player ? (
                <div className="assistant-roster-row" key={id}>
                  <span>{index + 1}</span>
                  <span
                    className={`position-chip position-${player.position.toLowerCase()}`}
                  >
                    {player.position}
                  </span>
                  <strong>
                    <SleeperPlayerLink
                      id={player.id}
                      name={player.name}
                      position={player.position}
                    />
                  </strong>
                  <small>
                    {player.team}
                    {depthChartLabel(player)
                      ? ` · ${depthChartLabel(player)}`
                      : ""}{" "}
                    · {player.projectedPoints} projected
                  </small>
                </div>
              ) : null;
            })
          ) : (
            <p className="assistant-empty">
              No players drafted in this {mode} yet.
            </p>
          )}
        </div>
      )}

      {view === "players" && (
        <div className="player-explorer-grid">
          <div className="assistant-card">
            <div className="player-search-wrap">
              <span className="eyebrow">Player selector</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search player, team, or position…"
              />
              <label className="market-import">
                <span>
                  {marketRanks.size
                    ? `${marketRanks.size} custom market ranks loaded`
                    : "Optional ADP/rank CSV"}
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) =>
                    void importMarketRanks(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            </div>
            <div className="explorer-results">
              {searchedPlayers.map((player) => (
                <div
                  key={player.id}
                  className={`explorer-player-row ${compared.includes(player.id) ? "selected" : ""}`}
                >
                  <span
                    className={`position-chip position-${player.position.toLowerCase()}`}
                  >
                    {player.position}
                  </span>
                  <span>
                    <strong>
                      <SleeperPlayerLink
                        id={player.id}
                        name={player.name}
                        position={player.position}
                      />
                    </strong>
                    <small>
                      {player.team}
                      {depthChartLabel(player)
                        ? ` · ${depthChartLabel(player)}`
                        : ""}{" "}
                      · {player.projectedPoints} median
                    </small>
                  </span>
                  <button
                    type="button"
                    aria-pressed={compared.includes(player.id)}
                    onClick={() =>
                      setCompared((ids) =>
                        ids.includes(player.id)
                          ? ids.filter((id) => id !== player.id)
                          : [...ids.slice(-2), player.id],
                      )
                    }
                    title={
                      compared.includes(player.id)
                        ? `Remove ${player.name} from comparison`
                        : `Compare ${player.name}`
                    }
                  >
                    {player.personalizedScore}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="assistant-card comparison-card">
            <span className="eyebrow">Compare up to three</span>
            {compared.length ? (
              compared.map((id) => {
                const player = recommendations.find((entry) => entry.id === id);
                return player ? (
                  <article key={id}>
                    <div>
                      <span
                        className={`position-chip position-${player.position.toLowerCase()}`}
                      >
                        {player.position}
                      </span>
                      <h3>
                        <SleeperPlayerLink
                          id={player.id}
                          name={player.name}
                          position={player.position}
                        />
                      </h3>
                      <small>
                        {player.team}
                        {depthChartLabel(player)
                          ? ` · ${depthChartLabel(player)}`
                          : ""}
                      </small>
                    </div>
                    <dl>
                      <div>
                        <dt>Fit</dt>
                        <dd>{player.personalizedScore}</dd>
                      </div>
                      <div>
                        <dt>Floor</dt>
                        <dd>{player.floor}</dd>
                      </div>
                      <div>
                        <dt>Median</dt>
                        <dd>{player.projectedPoints}</dd>
                      </div>
                      <div>
                        <dt>Ceiling</dt>
                        <dd>{player.ceiling}</dd>
                      </div>
                      <div>
                        <dt>Next pick</dt>
                        <dd>{player.availabilityAtNextPick}%</dd>
                      </div>
                    </dl>
                  </article>
                ) : null;
              })
            ) : (
              <p className="assistant-empty">
                Select players to compare their range, roster fit, and
                availability.
              </p>
            )}
          </div>
        </div>
      )}

      {view === "strategy" && (
        <div className="strategy-grid">
          <div className="assistant-card strategy-card">
            <span className="eyebrow">Pick inventory</span>
            <h3>{pickInventory.join(" · ")}</h3>
            <p>Includes the snake order and all currently traded picks.</p>
          </div>
          <div className="assistant-card strategy-card">
            <span className="eyebrow">Projection status</span>
            <h3>
              {modelReady
                ? `Model ${artifact.modelVersion}`
                : "Fallback active"}
            </h3>
            <p>
              {modelReady
                ? `Validated on ${artifact.metrics?.rows ?? 0} player seasons with ${artifact.metrics?.mae ?? "—"} MAE.`
                : "The Python artifact is stale or untrained, so current market rank is being used transparently."}
            </p>
          </div>
          <div className="assistant-card strategy-card">
            <span className="eyebrow">Optimization target</span>
            <h3>Starting-lineup value</h3>
            <p>
              Balances value over replacement, position need, availability at
              the next pick, injury status, and manager tendencies.
            </p>
          </div>
          <div className="assistant-card strategy-card">
            <span className="eyebrow">Feature contract</span>
            <h3>
              {coreFeatureCount || "—"} core · {supplementalFeatureCount || "—"}{" "}
              supplemental
            </h3>
            <p>
              Core fields directly determine fantasy scoring. Sleeper supplies
              league context; validated nflverse features add team, coach, and
              schedule context. {artifact.researchFeatureCount ?? "Additional"}{" "}
              fields remain research-only.
            </p>
          </div>
          <div className="assistant-card strategy-card">
            <span className="eyebrow">Coaching model</span>
            <h3>Staff tendencies, not labels</h3>
            <p>
              Uses prior pass rate, scoring, efficiency, experience, and
              continuity. New coaches begin near the league prior.
            </p>
          </div>
          <div className="assistant-card strategy-card">
            <span className="eyebrow">Schedule model</span>
            <h3>Position-specific opponents</h3>
            <p>
              Uses the current schedule with prior defensive EPA, touchdown
              rate, and fantasy points allowed by position.
            </p>
          </div>
        </div>
      )}

      {view === "news" && (
        <NewsTerminal
          analyses={newsAnalyses}
          onAnalysis={(analysis) =>
            setNewsAnalyses((items) => [
              analysis,
              ...items.filter(
                (item) => item.contentHash !== analysis.contentHash,
              ),
            ])
          }
        />
      )}
    </div>
  );
}
