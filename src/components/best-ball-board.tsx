"use client";
import { DraftTradeIndicator } from "./draft-trade-indicator";
import Image from "next/image";
import { InfoPopover } from "./info-popover";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playerImageUrl } from "@/lib/player-image";
import type { SleeperDraftPick } from "@/lib/types";
import {
  performanceRankings,
  perGameRankings,
  performanceView,
  pickValue,
  seasonGrade,
  type AdpRow,
} from "@/lib/best-ball";
import { Avatar, Badge, Card, EmptyState } from "./ui";
import { SleeperPlayerLink } from "./sleeper-player-link";
import type { Production } from "@/lib/production";
type Player = { id: string; name: string; position: string; team: string };
const gradeLabel = {
  value: "Steal",
  fair: "Just right",
  reach: "Reach",
  unknown: "Unrated",
};
const seasonLabel = {
  value: "Outperforming",
  fair: "Meeting expectations",
  reach: "Underperforming",
  unknown: "Unrated",
};
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
const displayDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${date}T12:00:00Z`))
    : "Date unavailable";
export function BestBallBoard({
  players,
  historical = false,
  production,
  draftPicks,
  draftSlots,
  managers,
  managersInfo,
  scores,
  leagueName,
  adp,
  snapshotDate,
  draftDate,
  sourceName,
  sourceUrl,
  throughWeek,
}: {
  players: Player[];
  historical?: boolean;
  production: Record<string, Production>;
  draftPicks: SleeperDraftPick[];
  draftSlots: Record<number, number>;
  managers: Record<number, string>;
  managersInfo: Record<number, { name: string; avatar: string | null }>;
  scores: Record<string, number>;
  leagueName: string;
  adp: AdpRow[];
  snapshotDate: string;
  draftDate: string | null;
  sourceName: string;
  sourceUrl: string;
  throughWeek: number;
}) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("All");
  const [manager, setManager] = useState("All");
  const [tab, setTab] = useState("board");
  const [round, setRound] = useState("All");
  const [draftFilter, setDraftFilter] = useState<
    "all" | "drafted" | "undrafted"
  >("all");
  const [hovered, setHovered] = useState<{
    pick: SleeperDraftPick;
    x: number;
    y: number;
  } | null>(null);
  const [selected, setSelected] = useState<SleeperDraftPick | null>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected && !detailDialog.current?.open)
      detailDialog.current?.showModal();
  }, [selected]);
  useEffect(() => {
    const hide = () => {
      const element = document.activeElement;
      if (element instanceof HTMLElement && element.matches(".bb-board-pick")) {
        const pick = draftPicks.find(
          (p) => p.pick_no === Number(element.dataset.pickNumber),
        );
        if (pick) showPreview(pick, element);
      } else setHovered(null);
    };
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [draftPicks]);
  const benchmarks = new Map(adp.map((row) => [row.playerId, row]));
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const drafted = new Set(draftPicks.map((pick) => pick.player_id));
  const ratedPicks = draftPicks.flatMap((pick) => {
    const baseline = benchmarks.get(pick.player_id);
    return baseline ? [{ pick, ...pickValue(pick.pick_no, baseline.adp) }] : [];
  });
  const rounds = [...new Set(draftPicks.map((p) => p.round))].sort(
    (a, b) => a - b,
  );
  const matches = (p: Player | undefined) =>
    p &&
    (position === "All" || p.position === position) &&
    `${p.name} ${p.team}`.toLowerCase().includes(query.toLowerCase());
  const roundMatches = (r: number) =>
    round === "All" ||
    (round.includes("-")
      ? r >= Number(round.split("-")[0]) && r <= Number(round.split("-")[1])
      : r === Number(round));
  const visiblePicks = draftPicks.filter(
    (pick) =>
      matches(playerMap.get(pick.player_id)) &&
      (manager === "All" || pick.roster_id === Number(manager)) &&
      roundMatches(pick.round),
  );
  const seasonRankings = performanceRankings(adp, scores);
  const perGameMap = new Map(
    perGameRankings(adp, scores, production).map((row) => [row.playerId, row]),
  );
  const seasonMap = new Map(seasonRankings.map((row) => [row.playerId, row]));
  const performance = performanceView(
    seasonRankings,
    tab === "underperformance" ? "underperformers" : "outperformers",
    draftFilter,
    drafted,
  ).filter((row) => matches(playerMap.get(row.playerId)));
  function identity(p: Player) {
    return (
      <div className="board-player">
        <Image src={playerImageUrl(p.id)} width={40} height={40} alt="" />
        <span>
          <strong>
            <SleeperPlayerLink id={p.id} name={p.name} position={p.position} />
          </strong>
          <small>
            <span
              className={`bb-position position-${p.position.toLowerCase()}`}
            >
              {p.position}
            </span>{" "}
            {p.team}
          </small>
        </span>
      </div>
    );
  }
  const slots = Array.from(
    {
      length: Math.max(
        0,
        ...Object.keys(draftSlots).map(Number),
        ...draftPicks.map((p) => p.draft_slot),
      ),
    },
    (_, index) => index + 1,
  );
  const visiblePickNumbers = new Set(visiblePicks.map((p) => p.pick_no));
  function showPreview(pick: SleeperDraftPick, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 32);
    const x = Math.max(
      16,
      Math.min(
        rect.left + rect.width / 2 - width / 2,
        window.innerWidth - width - 16,
      ),
    );
    const y =
      rect.bottom + 12 + 620 < window.innerHeight - 16
        ? rect.bottom + 12
        : Math.max(16, rect.top - 620 - 12);
    setHovered({ pick, x, y });
  }
  function pickDetails(pick: SleeperDraftPick, interactive = false) {
    const player = playerMap.get(pick.player_id);
    const games = production[pick.player_id];
    const baseline = benchmarks.get(pick.player_id);
    const value = baseline ? pickValue(pick.pick_no, baseline.adp) : null;
    const grade = value?.grade ?? "unknown";
    const season = seasonMap.get(pick.player_id);
    const currentGrade = seasonGrade(season?.gain);
    const perGame = perGameMap.get(pick.player_id);
    if (historical)
      return (
        <>
          <div className="bb-detail-heading">
            <strong>Draft pick</strong>
            <small>
              Round {pick.round} · Pick {pick.pick_no}
            </small>
          </div>
          <div className="board-player">
            <Image
              src={playerImageUrl(pick.player_id)}
              width={40}
              height={40}
              alt=""
            />
            <span>
              <strong>
                {interactive && player ? (
                  <SleeperPlayerLink
                    id={player.id}
                    name={player.name}
                    position={player.position}
                  />
                ) : (
                  player?.name || pick.player_id
                )}
              </strong>
              <small>
                {player?.position} · {player?.team}
              </small>
            </span>
          </div>
          <section className="bb-rating-section">
            <h4>Draft details</h4>
            <dl className="bb-detail-stats">
              <div>
                <dt>Drafted by</dt>
                <dd>{managers[pick.roster_id] || "Unknown"}</dd>
              </div>
              <div>
                <dt>Original slot</dt>
                <dd>
                  {pick.draft_slot} ·{" "}
                  {managers[draftSlots[pick.draft_slot]] || "Unknown"}
                </dd>
              </div>
              <div>
                <dt>Selected at</dt>
                <dd>#{pick.pick_no} overall</dd>
              </div>
              <div>
                <dt>Draft date</dt>
                <dd>{displayDate(draftDate)}</dd>
              </div>
            </dl>
            {draftSlots[pick.draft_slot] != null &&
              pick.roster_id !== draftSlots[pick.draft_slot] && (
                <p className="bb-production-disclaimer">
                  Traded pick: {managers[draftSlots[pick.draft_slot]]} →{" "}
                  {managers[pick.roster_id]}
                </p>
              )}
          </section>
        </>
      );
    return (
      <>
        <div className="bb-detail-heading">
          <span className={`bb-grade grade-${currentGrade}`}>
            {seasonLabel[currentGrade]}
          </span>
          <small>
            Round {pick.round} · Pick {pick.pick_no}
          </small>
        </div>
        <div className="board-player">
          <Image
            src={playerImageUrl(pick.player_id)}
            width={40}
            height={40}
            alt=""
          />
          <span>
            <strong>
              {interactive && player ? (
                <SleeperPlayerLink
                  id={player.id}
                  name={player.name}
                  position={player.position}
                />
              ) : (
                (player?.name ?? `Player ${pick.player_id}`)
              )}
            </strong>
            <small>
              {player?.position} · {player?.team}
            </small>
          </span>
        </div>
        <div className="bb-manager">
          <Avatar
            src={managersInfo[pick.roster_id]?.avatar}
            name={managers[pick.roster_id] ?? "Manager"}
            size="xs"
          />
          <span>{managers[pick.roster_id] ?? "Manager"}</span>
        </div>
        <section className="bb-rating-section">
          <h4>
            Season performance{" "}
            <span className={`grade-${currentGrade}`}>
              {seasonLabel[currentGrade]}
            </span>
          </h4>
          <dl className="bb-detail-stats">
            <div>
              <dt>Expected positional rank</dt>
              <dd>
                {season
                  ? `${season.position}${season.adpPositionRank} rank`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Rank by total points</dt>
              <dd>
                {season
                  ? `${season.position}${season.scoringRank} rank`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Rank difference</dt>
              <dd className={`grade-${currentGrade}`}>
                {season
                  ? `${season.gain > 0 ? "+" : ""}${season.gain} rank places`
                  : "Not rated"}
              </dd>
            </div>
            <div>
              <dt>Rank when playing</dt>
              <dd>
                {perGame
                  ? `${perGame.position}${perGame.scoringRank}`
                  : games?.available && games.played === 0
                    ? "Has not played"
                    : "Unavailable"}
              </dd>
            </div>
          </dl>
          <p className="bb-production-disclaimer">
            Ranks players at the same position by points per game played. Less
            reliable with fewer games.
          </p>
        </section>
        <section className="bb-rating-section">
          <h4>
            Draft day{" "}
            <span className={`grade-${grade}`}>{gradeLabel[grade]}</span>
          </h4>
          <dl className="bb-detail-stats">
            <div>
              <dt>Expected draft pick</dt>
              <dd>
                {baseline
                  ? `${baseline.adp.toFixed(1)} overall pick`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Actual draft pick</dt>
              <dd>#{pick.pick_no} overall pick</dd>
            </div>
            <div>
              <dt>Pick difference</dt>
              <dd className={`grade-${grade}`}>
                {value ? `${signed(value.delta)} picks` : "Not rated"}
              </dd>
            </div>
          </dl>
        </section>
        <section className="bb-rating-section">
          <h4>Production</h4>
          <dl className="bb-detail-stats">
            <div>
              <dt>Total points</dt>
              <dd>
                {games?.available && games.played === 0
                  ? "Has not played"
                  : scores[pick.player_id] != null
                    ? `${scores[pick.player_id].toFixed(1)} fantasy pts`
                    : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Average / game played</dt>
              <dd>
                {scores[pick.player_id] != null &&
                games?.available &&
                games.played > 0
                  ? `${(scores[pick.player_id] / games.played).toFixed(1)} pts/game`
                  : games?.available && games.played === 0
                    ? "Has not played"
                    : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Games played</dt>
              <dd>
                {games?.available
                  ? `${games.played}/${games.scheduled}`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Games missed</dt>
              <dd>{games?.available ? games.missed : "Unavailable"}</dd>
            </div>
          </dl>
        </section>
      </>
    );
  }
  function pickCell(pick: SleeperDraftPick) {
    const player = playerMap.get(pick.player_id);
    const grade = seasonGrade(seasonMap.get(pick.player_id)?.gain);
    return (
      <button
        type="button"
        className={`bb-board-pick ${historical ? "bb-board-historical" : `bb-board-${grade}`}`}
        key={pick.pick_no}
        aria-label={`${player?.name ?? `Player ${pick.player_id}`}, round ${pick.round}, pick ${pick.pick_no}, ${historical ? "Draft pick" : seasonLabel[grade]}${draftSlots[pick.draft_slot] != null && pick.roster_id !== draftSlots[pick.draft_slot] ? `. Pick traded to ${managers[pick.roster_id] ?? "drafting manager"}` : ""}. View details`}
        aria-describedby={
          hovered?.pick.pick_no === pick.pick_no && !selected
            ? "bb-pick-tooltip"
            : undefined
        }
        data-pick-number={pick.pick_no}
        aria-haspopup="dialog"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse")
            showPreview(pick, event.currentTarget);
        }}
        onPointerLeave={(event) => {
          if (document.activeElement !== event.currentTarget) setHovered(null);
        }}
        onFocus={(event) => {
          const element = event.currentTarget;
          requestAnimationFrame(() => {
            if (
              document.activeElement === element &&
              !detailDialog.current?.open
            )
              showPreview(pick, element);
          });
        }}
        onBlur={() => setHovered(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setHovered(null);
        }}
        onClick={() => {
          setHovered(null);
          setSelected(pick);
        }}
      >
        <span className="draft-cell-top">
          <small className="draft-pick-number">#{pick.pick_no}</small>
          <span
            className={`draft-position-chip position-${player?.position.toLowerCase() || "unknown"}`}
          >
            {player?.position || "—"}
          </span>
        </span>
        <Image
          src={playerImageUrl(pick.player_id)}
          width={42}
          height={42}
          alt=""
        />
        <strong>{player?.name ?? `Player ${pick.player_id}`}</strong>
        <small className="draft-cell-team">{player?.team || "FA"}</small>
        <span className="draft-cell-footer">
          {draftSlots[pick.draft_slot] != null &&
            pick.roster_id !== draftSlots[pick.draft_slot] && (
              <DraftTradeIndicator
                original={managers[draftSlots[pick.draft_slot]]}
                recipient={managers[pick.roster_id]}
              />
            )}
        </span>
      </button>
    );
  }
  return (
    <div className="stack bb-report">
      <div className="bb-board-context">
        <div>
          <strong>{leagueName}</strong>
          <span>
            {historical
              ? `Drafted ${displayDate(draftDate)}`
              : `Through Week ${throughWeek}`}{" "}
            · Draft review
            <InfoPopover
              title={
                historical ? "About the draft board" : "How the ratings work"
              }
              sections={
                historical
                  ? [
                      {
                        title: "Draft picks",
                        items: [
                          "Each column stays with its original draft slot. An arrow names the receiving manager for traded picks.",
                          "Hover or select a pick for its draft-day details.",
                        ],
                      },
                    ]
                  : [
                      {
                        title: "Draft board",
                        items: [
                          "Each column is an original draft slot. → names the receiving manager for a traded pick. Hover or select a player for details.",
                        ],
                      },
                      {
                        title: "Board colors",
                        items: [
                          "Green: scoring above draft expectations. Yellow: matching them. Red: below them. Gray: no rating.",
                          "We compare scoring rank with preseason draft rank within each position.",
                        ],
                      },
                      {
                        title: "Draft value",
                        items: [
                          "ADP is the average pick where a player was drafted on Sleeper. Picking later can be a steal; earlier can be a reach.",
                        ],
                      },
                      {
                        title: "Production",
                        items: [
                          "Points use your league’s scoring. Averages count games played only.",
                          "Rank when playing compares players at the same position by points per game played. Less reliable with fewer games.",
                        ],
                      },
                      {
                        title: "Source",
                        items: [
                          `ADP captured ${displayDate(snapshotDate)} · Draft ${displayDate(draftDate)}.`,
                          `${ratedPicks.length}/${draftPicks.length} picks have ADP.`,
                          "Sleeper’s exact ADP cutoff is unverified; it may differ from draft-day ADP.",
                        ],
                      },
                    ]
              }
              footer={
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link"
                >
                  {sourceName} ↗
                </a>
              }
            />
          </span>
        </div>
      </div>
      {!historical && !adp.length && (
        <p role="status">
          Sleeper ADP for this season is unavailable. Picks remain unrated.
        </p>
      )}
      <div className="bb-toolbar">
        <div
          className="tabs bb-tabs"
          role="tablist"
          aria-label="Draft report views"
        >
          {[
            ["board", "Draft board"],
            ["performance", "Outperformers"],
            ["underperformance", "Underperformers"],
          ].map(([id, label]) => (
            <button
              type="button"
              role="tab"
              id={`bb-tab-${id}`}
              aria-controls={`bb-panel-${id}`}
              aria-selected={tab === id}
              className={tab === id ? "active" : ""}
              key={id}
              disabled={historical && id !== "board"}
              title={
                historical && id !== "board"
                  ? "Best Ball analysis is available for the current season"
                  : undefined
              }
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Card className="bb-results">
        <div className="bb-filters">
          <label className="bb-search">
            Find a player
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or NFL team…"
            />
          </label>
          <label>
            Position
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              {["All", "QB", "RB", "WR", "TE", "K", "DEF"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          {tab === "board" && (
            <>
              <label>
                Manager
                <select
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                >
                  <option>All</option>
                  {Object.entries(managers).map(([id, name]) => (
                    <option value={id} key={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Round
                <select
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                >
                  <option>All</option>
                  {rounds
                    .filter((_, i) => i % 3 === 0)
                    .map((r) => (
                      <option key={`group-${r}`} value={`${r}-${r + 2}`}>
                        Rounds {r}–{Math.min(r + 2, rounds.at(-1) ?? r)}
                      </option>
                    ))}
                  {rounds.map((r) => (
                    <option key={r} value={r}>
                      Round {r}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {tab !== "board" && (
            <label>
              Draft status
              <select
                value={draftFilter}
                onChange={(event) =>
                  setDraftFilter(
                    event.target.value as "all" | "drafted" | "undrafted",
                  )
                }
              >
                <option value="all">All players</option>
                <option value="undrafted">Undrafted only</option>
                <option value="drafted">Drafted only</option>
              </select>
            </label>
          )}
        </div>
        {tab === "board" && (
          <section
            role="tabpanel"
            id="bb-panel-board"
            aria-labelledby="bb-tab-board"
          >
            <div className="bb-section-copy">
              <h3>Draft board</h3>
            </div>
            {visiblePicks.length ? (
              <div
                className="bb-board-scroll"
                role="region"
                aria-label="Draft board, scroll horizontally to see all managers"
                tabIndex={0}
              >
                <table className="bb-draft-board">
                  <thead>
                    <tr>
                      <th scope="col" className="bb-round-axis">
                        Round
                      </th>
                      {slots.map((slot) => (
                        <th scope="col" key={slot}>
                          <Avatar
                            src={managersInfo[draftSlots[slot]]?.avatar}
                            name={managers[draftSlots[slot]] ?? `Slot ${slot}`}
                            size="sm"
                          />
                          <span>
                            {managers[draftSlots[slot]] ?? `Slot ${slot}`}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.filter(roundMatches).map((r) => (
                      <tr key={r}>
                        <th scope="row" className="bb-round-axis">
                          {String(r).padStart(2, "0")}
                        </th>
                        {slots.map((slot) => (
                          <td key={slot}>
                            {draftPicks
                              .filter(
                                (p) =>
                                  p.round === r &&
                                  p.draft_slot === slot &&
                                  visiblePickNumbers.has(p.pick_no),
                              )
                              .map(pickCell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon="calendar"
                title={
                  draftPicks.length ? "No matching picks" : "No draft picks yet"
                }
                description={
                  draftPicks.length
                    ? "Try a different player, position, manager, or round."
                    : "The report fills automatically when Sleeper publishes the draft."
                }
              />
            )}
          </section>
        )}
        {(tab === "performance" || tab === "underperformance") && (
          <section
            role="tabpanel"
            id={`bb-panel-${tab}`}
            aria-labelledby={`bb-tab-${tab}`}
          >
            <div className="bb-section-copy">
              <h3>
                {tab === "underperformance"
                  ? "Who is falling short?"
                  : "Who is beating expectations?"}{" "}
                <Badge>{performance.length}</Badge>
              </h3>
              <p>
                Movement from positional Sleeper ADP order to positional scoring
                rank, among ADP-covered players with scoring data. Completed
                weeks only.{" "}
                {tab === "underperformance"
                  ? "Largest shortfalls first."
                  : "Largest gains first."}{" "}
                Draft status refers to the original draft, regardless of later
                waiver moves.
              </p>
            </div>
            {performance.length ? (
              <div className="bb-player-list">
                {performance.map((row, index) => {
                  const p = playerMap.get(row.playerId)!;
                  return (
                    <div
                      className="bb-list-row bb-performance-row"
                      key={row.playerId}
                    >
                      <span className="bb-list-number">{index + 1}</span>
                      {identity(p)}
                      <div className="bb-list-stat">
                        <small>ADP → scoring</small>
                        <strong>
                          {row.position}
                          {row.adpPositionRank} → {row.position}
                          {row.scoringRank}
                        </strong>
                      </div>
                      <div className="bb-list-stat">
                        <small>Season points</small>
                        <strong>
                          {production[row.playerId]?.available &&
                          production[row.playerId].played === 0
                            ? "Has not played"
                            : `${row.points.toFixed(1)} fantasy pts`}
                        </strong>
                      </div>
                      <span
                        className={`bb-gain grade-${row.gain > 0 ? "value" : row.gain < 0 ? "reach" : "fair"}`}
                      >
                        {row.gain > 0 ? "+" : ""}
                        {row.gain}
                        <small>places</small>
                      </span>
                      <Badge>
                        {drafted.has(row.playerId) ? "Drafted" : "Undrafted"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon="standings"
                title={
                  draftFilter === "undrafted"
                    ? `No undrafted ${tab === "underperformance" ? "underperformers" : "outperformers"} match`
                    : "No matching players"
                }
                description="Try another search, position, or draft-status filter. Players need Sleeper ADP and completed-week scoring data to appear."
              />
            )}
          </section>
        )}
      </Card>
      {hovered &&
        !selected &&
        createPortal(
          <div
            className="bb-pick-tooltip"
            id="bb-pick-tooltip"
            role="tooltip"
            style={{ left: hovered.x, top: hovered.y }}
          >
            {pickDetails(hovered.pick)}
          </div>,
          document.body,
        )}
      <dialog
        ref={detailDialog}
        className="bb-pick-dialog"
        aria-label="Draft pick details"
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget)
            detailDialog.current?.close();
        }}
      >
        <div
          className="bb-dialog-content"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="icon-button bb-detail-close"
            aria-label="Close pick details"
            autoFocus
            onClick={() => detailDialog.current?.close()}
          >
            ×
          </button>
          {selected && pickDetails(selected, true)}
        </div>
      </dialog>
    </div>
  );
}
