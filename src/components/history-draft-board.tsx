import { BestBallBoard } from "./best-ball-board";
import type { SleeperDraftPick, SleeperPlayer, Team } from "@/lib/types";
export function HistoryDraftBoard({
  picks,
  players,
  teams,
  draftSlots,
  leagueName,
  draftDate,
}: {
  picks: SleeperDraftPick[];
  players: Record<string, SleeperPlayer>;
  teams: Team[];
  draftSlots: Record<number, number>;
  leagueName: string;
  draftDate: string | null;
}) {
  return (
    <BestBallBoard
      historical
      players={picks.map((p) => ({
        id: p.player_id,
        name:
          players[p.player_id]?.full_name ||
          [p.metadata?.first_name, p.metadata?.last_name]
            .filter(Boolean)
            .join(" ") ||
          p.player_id,
        position: p.metadata?.position || players[p.player_id]?.position || "",
        team: p.metadata?.team || players[p.player_id]?.team || "FA",
      }))}
      draftPicks={picks.slice().sort((a, b) => a.pick_no - b.pick_no)}
      draftSlots={draftSlots}
      managers={Object.fromEntries(
        teams.map((t) => [t.rosterId, t.managerName]),
      )}
      managersInfo={Object.fromEntries(
        teams.map((t) => [
          t.rosterId,
          { name: t.managerName, avatar: t.avatarUrl },
        ]),
      )}
      production={{}}
      scores={{}}
      leagueName={leagueName}
      adp={[]}
      snapshotDate=""
      draftDate={draftDate}
      sourceName="Sleeper"
      sourceUrl="https://sleeper.com"
      throughWeek={0}
    />
  );
}
