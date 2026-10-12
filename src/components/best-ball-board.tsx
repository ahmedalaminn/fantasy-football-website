"use client";
import Image from "next/image";
import { InfoPopover } from "./info-popover";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playerImageUrl } from "@/lib/player-image";
import type { SleeperDraftPick } from "@/lib/types";
import {
  performanceRankings,
  performanceView,
  pickValue,
  seasonGrade,
  type AdpRow,
} from "@/lib/best-ball";
import { Avatar, Badge, Card, EmptyState } from "./ui";
import { SleeperPlayerLink } from "./sleeper-player-link";
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
  draftPicks,
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
  draftStatus,
}: {
  players: Player[];
  draftPicks: SleeperDraftPick[];
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
  draftStatus: string;
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
  const visiblePicks = draftPicks.filter(
    (pick) =>
      matches(playerMap.get(pick.player_id)) &&
      (manager === "All" || pick.roster_id === Number(manager)) &&
      (round === "All" || pick.round === Number(round)),
  );
  const seasonRankings = performanceRankings(adp, scores);
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
  const managerIds = [
    ...new Set([
      ...draftPicks
        .slice()
        .sort((a, b) => a.draft_slot - b.draft_slot)
        .map((p) => p.roster_id),
      ...Object.keys(managers).map(Number),
    ]),
  ].filter((id) => manager === "All" || id === Number(manager));
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
    const baseline = benchmarks.get(pick.player_id);
    const value = baseline ? pickValue(pick.pick_no, baseline.adp) : null;
    const grade = value?.grade ?? "unknown";
    const season = seasonMap.get(pick.player_id);
    const currentGrade = seasonGrade(season?.gain);
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
            This season{" "}
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
              <dt>Actual positional rank</dt>
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
          </dl>
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
              <dt>Actual total</dt>
              <dd>
                {scores[pick.player_id] != null
                  ? `${scores[pick.player_id].toFixed(1)} fantasy pts`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Actual weekly average</dt>
              <dd>
                {scores[pick.player_id] != null && throughWeek > 0
                  ? `${(scores[pick.player_id] / throughWeek).toFixed(1)} pts/week`
                  : "Unavailable"}
              </dd>
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
        className={`bb-board-pick bb-board-${grade}`}
        key={pick.pick_no}
        aria-label={`${player?.name ?? `Player ${pick.player_id}`}, round ${pick.round}, pick ${pick.pick_no}, ${seasonLabel[grade]}. View details`}
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
        <Image
          src={playerImageUrl(pick.player_id)}
          width={42}
          height={42}
          alt=""
        />
        <strong>{player?.name ?? `Player ${pick.player_id}`}</strong>
      </button>
    );
  }
  return (
    <div className="stack bb-report">
      <div className="bb-board-context">
        <div>
          <strong>{leagueName}</strong>
          <span>
            Draft review
            <InfoPopover
              title="How the ratings work"
              sections={[
                {
                  title: "This season · Sets board color",
                  items: [
                    "Expected positional rank − actual scoring rank = rank difference.",
                    "Green: positive · Yellow: unchanged · Red: negative · Gray: unavailable.",
                    "Both ranks compare the same players with recorded points, within each position.",
                  ],
                },
                {
                  title: "Draft day · Pick value",
                  items: [
                    "Actual pick − Sleeper ADP = pick difference.",
                    "Steal/reach: at least 10% of ADP, minimum 3 picks. Otherwise, just right.",
                  ],
                },
                {
                  title: "Production",
                  items: [
                    `Weekly average = recorded fantasy points ÷ ${throughWeek} completed weeks, including missing-point weeks.`,
                    "ADP supplies no expected point projections. League roster data can omit unrostered scoring.",
                  ],
                },
                {
                  title: "Data dates",
                  items: [
                    `Drafted ${displayDate(draftDate)} · Scoring through Week ${throughWeek}.`,
                    `ADP frozen ${displayDate(snapshotDate)}; historical cutoff unverified.`,
                    `${ratedPicks.length} of ${draftPicks.length} draft picks have ADP.`,
                  ],
                },
              ]}
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
        <Badge tone="aqua">
          {draftStatus === "complete"
            ? "Draft complete"
            : draftStatus === "drafting"
              ? "Draft in progress"
              : "Awaiting draft"}
        </Badge>
      </div>
      {!adp.length && (
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
            ["performance", "ADP outperformers"],
            ["underperformance", "ADP underperformers"],
          ].map(([id, label]) => (
            <button
              type="button"
              role="tab"
              id={`bb-tab-${id}`}
              aria-controls={`bb-panel-${id}`}
              aria-selected={tab === id}
              className={tab === id ? "active" : ""}
              key={id}
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
              <h3>League draft board</h3>
              <p>
                <span className="grade-value">Green: outperforming</span> ·{" "}
                <span className="grade-fair">Yellow: meeting expectations</span>{" "}
                · <span className="grade-reach">Red: underperforming</span> ·
                Gray: unrated. Hover or select a player for details.
              </p>
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
                      {managerIds.map((id) => (
                        <th scope="col" key={id}>
                          <Avatar
                            src={managersInfo[id]?.avatar}
                            name={managers[id] ?? "Manager"}
                            size="sm"
                          />
                          <span>{managers[id] ?? "Manager"}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rounds
                      .filter((r) => round === "All" || r === Number(round))
                      .map((r) => (
                        <tr key={r}>
                          <th scope="row" className="bb-round-axis">
                            {String(r).padStart(2, "0")}
                          </th>
                          {managerIds.map((id) => (
                            <td key={id}>
                              {draftPicks
                                .filter(
                                  (p) =>
                                    p.round === r &&
                                    p.roster_id === id &&
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
                rank, among ADP-covered players with league scoring data.
                Completed weeks only.{" "}
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
                        <strong>{row.points.toFixed(1)} fantasy pts</strong>
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
