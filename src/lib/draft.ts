import type { SleeperDraftPick, Team } from "./types";
// picked_by records the drafter, even when the original slot was traded.
// Never infer draft ownership from today's player roster.
export function attributeDraftPicks(picks: SleeperDraftPick[], teams: Team[]) {
  return picks.map((pick) => ({
    ...pick,
    roster_id:
      teams.find(
        (team) =>
          team.ownerId === pick.picked_by ||
          team.raw.co_owners?.includes(pick.picked_by),
      )?.rosterId ?? pick.roster_id,
  }));
}

export function draftSlotOwners(
  draft: import("./types").SleeperDraft | undefined,
  teams: Team[],
): Record<number, number> {
  const slots: Record<number, number> = {};
  for (const [ownerId, slot] of Object.entries(draft?.draft_order ?? {})) {
    const team = teams.find(
      (team) =>
        team.ownerId === ownerId || team.raw.co_owners?.includes(ownerId),
    );
    if (team) slots[slot] = team.rosterId;
  }
  for (const [slot, rosterId] of Object.entries(draft?.slot_to_roster_id ?? {}))
    slots[Number(slot)] = rosterId;
  return slots;
}
