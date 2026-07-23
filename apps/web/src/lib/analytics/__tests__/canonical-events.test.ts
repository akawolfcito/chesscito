import { describe, expect, it } from "vitest";
import {
  ACTIVATION_FUNNEL,
  ALL_FUNNEL_ALIASES,
  canonicalEventFor,
} from "../canonical-events";

describe("canonicalEventFor", () => {
  it("maps every completion alias to exercise_completed", () => {
    for (const alias of [
      "exercise_complete",
      "training_exercise_completed",
      "play_tactics_completed",
      "exercise_completed",
    ]) {
      expect(canonicalEventFor(alias)).toBe("exercise_completed");
    }
  });

  it("maps hub view aliases and daily focus alias", () => {
    expect(canonicalEventFor("hub_view")).toBe("hub_viewed");
    expect(canonicalEventFor("play_hub_view")).toBe("hub_viewed");
    expect(canonicalEventFor("daily_tactic_completed")).toBe(
      "daily_focus_completed",
    );
  });

  it("returns null for non-funnel events (no accidental capture)", () => {
    expect(canonicalEventFor("share_tile_tap")).toBeNull();
    expect(canonicalEventFor("pro_purchase_confirmed")).toBeNull();
  });
});

describe("funnel shape", () => {
  it("has 5 ordered steps starting at app_opened", () => {
    expect(ACTIVATION_FUNNEL).toEqual([
      "app_opened",
      "hub_viewed",
      "exercise_started",
      "exercise_completed",
      "daily_focus_completed",
    ]);
  });

  it("alias list is de-duplicated", () => {
    expect(ALL_FUNNEL_ALIASES.length).toBe(new Set(ALL_FUNNEL_ALIASES).size);
  });
});
