import { describe, it, expect } from "vitest";
import { attributeDraftPicks, draftSlotOwners } from "./draft";
import type { SleeperDraft, SleeperDraftPick, Team } from "./types";
const teams = [
  { rosterId: 1, ownerId: "original", raw: {} },
  { rosterId: 2, ownerId: "recipient", raw: {} },
] as Team[];
const pick = {
  pick_no: 8,
  round: 1,
  draft_slot: 1,
  player_id: "123",
  roster_id: 1,
  picked_by: "recipient",
} as SleeperDraftPick;
describe("draft-day attribution", () => {
  it("credits the drafter of a traded pick and preserves the original slot", () => {
    expect(attributeDraftPicks([pick], teams)[0]).toEqual({
      ...pick,
      roster_id: 2,
    });
    expect(pick.roster_id).toBe(1);
  });
  it("does not use later player ownership", () => {
    expect(
      attributeDraftPicks(
        [{ ...pick, picked_by: "original" }],
        [
          { ...teams[0], players: [] },
          { ...teams[1], players: ["123"] },
        ],
      )[0].roster_id,
    ).toBe(1);
  });
  it("falls back to recorded roster when the drafter is unavailable", () => {
    expect(
      attributeDraftPicks([{ ...pick, picked_by: "" }], teams)[0].roster_id,
    ).toBe(1);
  });
});

describe("original draft columns", () => {
  it("keeps the original slot owner separate from the receiving drafter", () => {
    const draft = {
      slot_to_roster_id: { "1": 1, "2": 2 },
      draft_order: { original: 1, recipient: 2 },
    } as unknown as SleeperDraft;
    const slots = draftSlotOwners(draft, teams);
    const tradedPick = attributeDraftPicks([pick], teams)[0];
    expect(slots[tradedPick.draft_slot]).toBe(1);
    expect(tradedPick.roster_id).toBe(2);
  });
  it("uses draft order when slot mapping is unavailable", () => {
    expect(
      draftSlotOwners(
        {
          draft_order: { original: 2, recipient: 1 },
        } as unknown as SleeperDraft,
        teams,
      ),
    ).toEqual({ 1: 2, 2: 1 });
  });
});
