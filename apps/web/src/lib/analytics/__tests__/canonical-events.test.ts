import { describe, expect, it } from "vitest";
import {
  ALL_DAILY_FOCUS_ALIASES,
  ALL_FUNNEL_ALIASES,
  canonicalEventFor,
  DAILY_FOCUS_EVENTS,
  DAILY_FOCUS_FUNNEL,
  dailyFocusStepFor,
  TRAINING_ACTIVATION_FUNNEL,
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

describe("training activation funnel", () => {
  it("has 4 ordered steps and ENDS at exercise_completed", () => {
    expect(TRAINING_ACTIVATION_FUNNEL).toEqual([
      "app_opened",
      "hub_viewed",
      "exercise_started",
      "exercise_completed",
    ]);
  });

  /** The whole point of the split: a Daily completion is NOT a later stage of
   *  Training. Terminar el Daily no emite ninguna completación de ejercicio
   *  (los caminos de código son disjuntos), así que un quinto paso afirmaba un
   *  subconjunto que no existe. */
  it("does not contain daily_focus_completed", () => {
    expect(TRAINING_ACTIVATION_FUNNEL).not.toContain("daily_focus_completed");
  });

  it("alias list is de-duplicated", () => {
    expect(ALL_FUNNEL_ALIASES.length).toBe(new Set(ALL_FUNNEL_ALIASES).size);
  });

  /** `daily_tactic_started` used to feed `exercise_started`, which put every
   *  Daily starter inside the Training funnel at step 3 and then dropped them
   *  at step 4 — depressing Training completion with people who never trained.
   *  The two funnels have to be disjoint at their START too, not only at the
   *  end. */
  it("no longer counts a Daily start as a training start", () => {
    expect(canonicalEventFor("daily_tactic_started")).toBeNull();
    expect(ALL_FUNNEL_ALIASES).not.toContain("daily_tactic_started");
  });

  it("still counts the two real training starts", () => {
    expect(canonicalEventFor("training_exercise_started")).toBe(
      "exercise_started",
    );
    expect(canonicalEventFor("play_tactics_opened")).toBe("exercise_started");
  });
});

describe("daily focus funnel (sibling, not a continuation)", () => {
  it("has 4 ordered steps of its own", () => {
    expect(DAILY_FOCUS_FUNNEL).toEqual([
      "app_opened",
      "hub_viewed",
      "daily_focus_started",
      "daily_focus_completed",
    ]);
  });

  it("shares the first two steps with Training, by the SAME aliases", () => {
    expect(DAILY_FOCUS_EVENTS.app_opened).toEqual(["app_opened"]);
    expect(DAILY_FOCUS_EVENTS.hub_viewed).toEqual([
      "hub_viewed",
      "hub_view",
      "play_hub_view",
    ]);
  });

  it("maps the real Daily emitters", () => {
    expect(dailyFocusStepFor("daily_tactic_started")).toBe(
      "daily_focus_started",
    );
    expect(dailyFocusStepFor("daily_tactic_completed")).toBe(
      "daily_focus_completed",
    );
    expect(dailyFocusStepFor("app_opened")).toBe("app_opened");
    expect(dailyFocusStepFor("hub_view")).toBe("hub_viewed");
  });

  /** A training completion must never advance the Daily funnel — that is the
   *  mirror image of the defect being fixed. */
  it("ignores training events", () => {
    expect(dailyFocusStepFor("exercise_complete")).toBeNull();
    expect(dailyFocusStepFor("training_exercise_started")).toBeNull();
    expect(dailyFocusStepFor("play_tactics_completed")).toBeNull();
  });

  it("alias list is de-duplicated", () => {
    expect(ALL_DAILY_FOCUS_ALIASES.length).toBe(
      new Set(ALL_DAILY_FOCUS_ALIASES).size,
    );
  });

  /** `daily_focus_completed` is a READ name that nothing emits (handoff
   *  2026-08-05). It stays in the alias list so a future emitter is picked up
   *  without a migration, but the funnel must be fed by the real one today. */
  it("keeps the never-emitted canonical name beside the real emitter", () => {
    expect(DAILY_FOCUS_EVENTS.daily_focus_completed).toContain(
      "daily_tactic_completed",
    );
    expect(DAILY_FOCUS_EVENTS.daily_focus_completed).toContain(
      "daily_focus_completed",
    );
  });
});
