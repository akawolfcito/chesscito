import { describe, expect, it } from "vitest";
import {
  computeAccessFunnel,
  computeActivation,
  computeRetention,
  computeTopCountries,
} from "../funnels";
import { parseStatsFilters, statsFiltersToQuery } from "../filters";

describe("computeAccessFunnel", () => {
  const at = (step: ReturnType<typeof computeAccessFunnel>, name: string) =>
    step.steps.find((s) => s.step === name)?.sessions;

  it("scopes every step to sessions that entered through the gate", () => {
    // Session `m` never saw the gate (MiniPay bypasses it) yet completes an
    // exercise. Counting it would make the last step exceed the first and turn
    // the funnel into nonsense.
    const funnel = computeAccessFunnel([
      { event: "web_access_gate_viewed", session_id: "a" },
      { event: "web_login_started", session_id: "a" },
      { event: "web_login_succeeded", session_id: "a" },
      { event: "web_wallet_ready", session_id: "a" },
      { event: "exercise_completed", session_id: "a" },
      { event: "exercise_completed", session_id: "m" }, // no gate → excluded
    ]);
    expect(at(funnel, "gate_viewed")).toBe(1);
    expect(at(funnel, "first_exercise_completed")).toBe(1);
  });

  it("never lets a later step exceed an earlier one", () => {
    const funnel = computeAccessFunnel([
      { event: "web_access_gate_viewed", session_id: "a" },
      { event: "web_access_gate_viewed", session_id: "b" },
      { event: "web_login_started", session_id: "a" },
      // b bails at the door: sees the gate, never taps ENTER
    ]);
    expect(at(funnel, "gate_viewed")).toBe(2);
    expect(at(funnel, "login_started")).toBe(1);
    expect(at(funnel, "login_succeeded")).toBe(0);
  });

  it("folds exercise-completion aliases into the terminal step", () => {
    const funnel = computeAccessFunnel([
      { event: "web_access_gate_viewed", session_id: "a" },
      { event: "training_exercise_completed", session_id: "a" }, // alias
      { event: "play_tactics_completed", session_id: "a" }, // same session, alias
    ]);
    expect(at(funnel, "first_exercise_completed")).toBe(1);
  });

  it("reports login failures beside the funnel, not inside it", () => {
    const funnel = computeAccessFunnel([
      { event: "web_access_gate_viewed", session_id: "a" },
      { event: "web_login_started", session_id: "a" },
      { event: "web_login_failed", session_id: "a" },
      { event: "web_login_succeeded", session_id: "a" }, // failed, then got in
      { event: "web_login_failed", session_id: "a" }, // same session, counted once
    ]);
    expect(funnel.failedSessions).toBe(1);
    expect(at(funnel, "login_succeeded")).toBe(1);
  });

  it("returns a zeroed funnel when no session ever saw the gate", () => {
    const funnel = computeAccessFunnel([
      { event: "exercise_completed", session_id: "m" },
    ]);
    expect(funnel.steps.every((s) => s.sessions === 0)).toBe(true);
    expect(funnel.failedSessions).toBe(0);
  });
});

describe("computeActivation", () => {
  it("counts distinct sessions per canonical step (aliases folded in)", () => {
    const funnel = computeActivation([
      { event: "app_opened", session_id: "a" },
      { event: "app_opened", session_id: "b" },
      { event: "hub_view", session_id: "a" }, // alias → hub_viewed
      { event: "play_hub_view", session_id: "b" }, // alias → hub_viewed
      { event: "exercise_complete", session_id: "a" }, // alias
      { event: "training_exercise_completed", session_id: "a" }, // same session, alias
    ]);
    const byStep = Object.fromEntries(funnel.map((s) => [s.step, s.sessions]));
    expect(byStep.app_opened).toBe(2);
    expect(byStep.hub_viewed).toBe(2);
    expect(byStep.exercise_completed).toBe(1); // session a counted once
    expect(byStep.daily_focus_completed).toBe(0);
  });

  it("ignores non-funnel events", () => {
    const funnel = computeActivation([
      { event: "share_tile_tap", session_id: "a" },
    ]);
    expect(funnel.every((s) => s.sessions === 0)).toBe(true);
  });
});

describe("computeTopCountries", () => {
  it("ranks distinct sessions per country, excludes null", () => {
    const top = computeTopCountries([
      { country: "BR", session_id: "a" },
      { country: "BR", session_id: "b" },
      { country: "BR", session_id: "a" }, // dup session
      { country: "US", session_id: "c" },
      { country: null, session_id: "d" }, // excluded
    ]);
    expect(top[0]).toEqual({ country: "BR", sessions: 2 });
    expect(top[1]).toEqual({ country: "US", sessions: 1 });
    expect(top.find((c) => c.country === null as never)).toBeUndefined();
  });
});

describe("computeRetention", () => {
  const now = new Date("2026-07-23T12:00:00.000Z");
  it("counts D1 returns on the exact next calendar day", () => {
    // cohort install first seen 2 days ago (age 2, within [1,8])
    const firstSeen = [{ session_id: "a", first_seen: "2026-07-21T09:00:00Z" }];
    const activity = [
      { session_id: "a", created_at: "2026-07-21T09:00:00Z" }, // day 0
      { session_id: "a", created_at: "2026-07-22T08:00:00Z" }, // day +1 → retained
    ];
    const r = computeRetention(firstSeen, activity, now);
    expect(r.d1).toEqual({ returned: 1, cohort: 1 });
  });

  it("does not count an install too young for the offset", () => {
    // first seen today (age 0) → not eligible for D1 cohort yet
    const firstSeen = [{ session_id: "a", first_seen: "2026-07-23T09:00:00Z" }];
    const r = computeRetention(firstSeen, [], now);
    expect(r.d1.cohort).toBe(0);
  });

  it("D7 cohort requires 7+ days elapsed", () => {
    const firstSeen = [
      { session_id: "a", first_seen: "2026-07-15T09:00:00Z" }, // age 8 → in [7,14]
    ];
    const activity = [
      { session_id: "a", created_at: "2026-07-22T09:00:00Z" }, // day +7 → retained
    ];
    const r = computeRetention(firstSeen, activity, now);
    expect(r.d7).toEqual({ returned: 1, cohort: 1 });
  });
});

describe("parseStatsFilters", () => {
  it("allow-lists values with `all` fallback", () => {
    expect(parseStatsFilters({ surface: "learn", container: "minipay" })).toEqual({
      surface: "learn",
      container: "minipay",
    });
    expect(parseStatsFilters({ surface: "hacker", container: "" })).toEqual({
      surface: "all",
      container: "all",
    });
    expect(parseStatsFilters({})).toEqual({ surface: "all", container: "all" });
  });

  it("serializes non-default filters, omits all", () => {
    expect(statsFiltersToQuery({ surface: "learn", container: "all" })).toBe(
      "?surface=learn",
    );
    expect(statsFiltersToQuery({ surface: "all", container: "all" })).toBe("");
  });
});
