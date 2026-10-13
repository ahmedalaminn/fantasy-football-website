"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Avatar, Badge } from "./ui";
import { SleeperPlayerLink } from "./sleeper-player-link";
import { playerImageUrl } from "@/lib/player-image";
import { formatPoints } from "@/lib/calculations";
export interface MatchupPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  points?: number;
  projected?: number;
  opponent?: string;
  bye?: boolean;
  status?: string;
}
export interface MatchupSide {
  name: string;
  manager: string;
  avatar: string | null;
  points: number;
  starters: MatchupPlayer[];
  bench: MatchupPlayer[];
}
export function MatchupCard({
  left,
  right,
  status,
  week,
  matchupId,
  slots,
}: {
  left: MatchupSide;
  right?: MatchupSide;
  status: string;
  week: number;
  matchupId: number;
  slots: string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<"starters" | "bench">("starters");
  function identity(side: MatchupSide) {
    return (
      <div className="duel-team">
        <Avatar src={side.avatar} name={side.manager} size="sm" />
        <strong>{side.name}</strong>
        <small>{side.manager}</small>
        <span className="duel-score">{formatPoints(side.points)}</span>
      </div>
    );
  }
  function player(p: MatchupPlayer | undefined, reverse = false) {
    return p ? (
      <div className={`duel-player ${reverse ? "reverse" : ""}`}>
        <Image src={playerImageUrl(p.id)} width={32} height={32} alt="" />
        <div>
          <strong>
            <SleeperPlayerLink id={p.id} name={p.name} position={p.position} />
          </strong>
          <small>
            {p.position} · {p.team} {p.bye ? <span className="duel-bye">BYE</span> : p.opponent}
          </small>
        </div>
        <span className="duel-points">
          <span className={p.status ? "duel-play-status" : `duel-player-score ${p.projected != null && p.points != null ? p.points > p.projected ? "above" : p.points < p.projected ? "below" : "" : ""}`}>
            {p.status || (p.points != null ? formatPoints(p.points) : "No data")}
          </span>
          {p.projected != null && <small>Proj {formatPoints(p.projected)}</small>}
        </span>
      </div>
    ) : (
      <div className="duel-player duel-empty">—</div>
    );
  }
  const a = left[view],
    b = right?.[view] ?? [];
  return (
    <section className="card duel-card" id={`matchup-${matchupId}`}>
      <div className="duel-card-head">
        <Badge tone={status === "final" ? "good" : "neutral"}>{status}</Badge>
        <small>Week {week}</small>
      </div>
      <div className="duel-scoreboard">
        {identity(left)}
        <span className="duel-vs">VS</span>
        {right ? identity(right) : <div className="duel-team">Bye week</div>}
      </div>
      {right && (
        <button
          type="button"
          className="duel-open"
          onClick={() => {
            setView("starters");
            dialog.current?.showModal();
          }}
        >
          View matchup <span aria-hidden="true">↗</span>
        </button>
      )}
      <dialog
        ref={dialog}
        className="matchup-dialog"
        aria-label={`Week ${week}: ${left.manager} versus ${right?.manager || "bye"}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="matchup-dialog-inner">
          <header className="duel-dialog-head">
            <span>
              Week {week} · {status}
            </span>
            <button
              type="button"
              className="icon-button"
              autoFocus
              aria-label="Close matchup"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="duel-scoreboard">
            {identity(left)}
            <span className="duel-vs">VS</span>
            {right && identity(right)}
          </div>
          <div className="duel-view-tabs" aria-label="Lineup view">
            {(["starters", "bench"] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                className={view === id ? "active" : ""}
                onClick={() => setView(id)}
              >
                {id === "starters" ? "Starting lineup" : "Bench"}
              </button>
            ))}
          </div>
          <p className="duel-projection-note">Sleeper projections · Green: above projected · Red: below projected</p>
          <div className="duel-lineups">
            {Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (
              <div className="duel-lineup-row" key={i}>
                {player(a[i])}
                <span className="duel-slot">
                  {view === "bench"
                    ? "BN"
                    : slots[i] || a[i]?.position || b[i]?.position || "—"}
                </span>
                {player(b[i], true)}
              </div>
            ))}
          </div>
        </div>
      </dialog>
    </section>
  );
}
