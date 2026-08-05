import { describe, expect, it } from "vitest";
import {
  computeAccessFunnel,
  computeAccountLifecycle,
  computeActivation,
  computeDailyFocusFunnel,
  computeHabitDepth,
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
  });

  it("ignores non-funnel events", () => {
    const funnel = computeActivation([
      { event: "share_tile_tap", session_id: "a" },
    ]);
    expect(funnel.every((s) => s.sessions === 0)).toBe(true);
  });

  /** The split, asserted from the consumer side: the training funnel has four
   *  steps and Daily is not one of them. */
  it("has four steps and none of them is a Daily step", () => {
    const funnel = computeActivation([]);
    expect(funnel.map((s) => s.step)).toEqual([
      "app_opened",
      "hub_viewed",
      "exercise_started",
      "exercise_completed",
    ]);
  });

  /** A session that ONLY did the Daily used to land on `exercise_started`
   *  (because `daily_tactic_started` fed it) and then vanish at
   *  `exercise_completed`, reading as a training drop-off that never happened. */
  it("does not count a Daily-only session as a training start", () => {
    const funnel = computeActivation([
      { event: "app_opened", session_id: "d" },
      { event: "hub_view", session_id: "d" },
      { event: "daily_tactic_started", session_id: "d" },
      { event: "daily_tactic_completed", session_id: "d" },
    ]);
    const byStep = Object.fromEntries(funnel.map((s) => [s.step, s.sessions]));
    expect(byStep.exercise_started).toBe(0);
    expect(byStep.exercise_completed).toBe(0);
  });
});

describe("computeDailyFocusFunnel", () => {
  it("counts distinct sessions per Daily step", () => {
    const funnel = computeDailyFocusFunnel([
      { event: "app_opened", session_id: "a" },
      { event: "app_opened", session_id: "b" },
      { event: "hub_view", session_id: "a" },
      { event: "daily_tactic_started", session_id: "a" },
      { event: "daily_tactic_started", session_id: "a" }, // same session twice
      { event: "daily_tactic_completed", session_id: "a" },
    ]);
    const byStep = Object.fromEntries(funnel.map((s) => [s.step, s.sessions]));
    expect(byStep.app_opened).toBe(2);
    expect(byStep.hub_viewed).toBe(1);
    expect(byStep.daily_focus_started).toBe(1);
    expect(byStep.daily_focus_completed).toBe(1);
  });

  /** The mirror image of the training assertion above: a training session must
   *  never advance the Daily funnel. */
  it("ignores training events", () => {
    const funnel = computeDailyFocusFunnel([
      { event: "app_opened", session_id: "t" },
      { event: "training_exercise_started", session_id: "t" },
      { event: "exercise_complete", session_id: "t" },
    ]);
    const byStep = Object.fromEntries(funnel.map((s) => [s.step, s.sessions]));
    expect(byStep.app_opened).toBe(1);
    expect(byStep.daily_focus_started).toBe(0);
    expect(byStep.daily_focus_completed).toBe(0);
  });

  it("returns its four steps in order even with no rows", () => {
    expect(computeDailyFocusFunnel([]).map((s) => s.step)).toEqual([
      "app_opened",
      "hub_viewed",
      "daily_focus_started",
      "daily_focus_completed",
    ]);
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

describe("computeAccountLifecycle", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");
  const day = (agoDays: number) =>
    new Date(Date.parse("2026-07-25T00:00:00.000Z") - agoDays * 86_400_000)
      .toISOString();

  it("classifies active, dormant and inactive as mutually exclusive", () => {
    const accounts = [
      { account_ref: "a", first_seen: day(40) },
      { account_ref: "b", first_seen: day(40) },
      { account_ref: "c", first_seen: day(40) },
    ];
    const activity = [
      { account_ref: "a", created_at: day(2) }, // active
      { account_ref: "b", created_at: day(12) }, // dormant
      // c: silent for the whole window → inactive
    ];
    const life = computeAccountLifecycle(accounts, activity, now);
    expect(life.active7d).toBe(1);
    expect(life.dormant).toBe(1);
    expect(life.inactive).toBe(1);
    expect(life.active7d + life.dormant + life.inactive).toBe(life.known);
  });

  it("counts an account with no events at all as inactive, not missing", () => {
    const life = computeAccountLifecycle(
      [{ account_ref: "ghost", first_seen: day(45) }],
      [],
      now,
    );
    expect(life.known).toBe(1);
    expect(life.inactive).toBe(1);
  });

  it("counts today's and this week's arrivals", () => {
    const life = computeAccountLifecycle(
      [
        { account_ref: "a", first_seen: day(0) },
        { account_ref: "b", first_seen: day(3) },
        { account_ref: "c", first_seen: day(20) },
      ],
      [],
      now,
    );
    expect(life.newToday).toBe(1);
    expect(life.new7d).toBe(2); // today's arrival is also part of the week
  });

  it("counts a resurrection only after a real silence", () => {
    const accounts = [
      { account_ref: "back", first_seen: day(40) },
      { account_ref: "steady", first_seen: day(40) },
      { account_ref: "fresh", first_seen: day(2) },
    ];
    const activity = [
      // back: active now, nothing in the 8–29d band → came back from silence
      { account_ref: "back", created_at: day(1) },
      // steady: never stopped, so it is retention, not resurrection
      { account_ref: "steady", created_at: day(1) },
      { account_ref: "steady", created_at: day(15) },
      // fresh: brand new, never had a chance to go dormant
      { account_ref: "fresh", created_at: day(1) },
    ];
    const life = computeAccountLifecycle(accounts, activity, now);
    expect(life.resurrected7d).toBe(1);
  });

  it("ignores rows with no account_ref instead of counting them as one account", () => {
    const life = computeAccountLifecycle(
      [{ account_ref: null, first_seen: day(3) }],
      [{ account_ref: null, created_at: day(1) }],
      now,
    );
    expect(life.known).toBe(0);
  });
});

describe("computeHabitDepth", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");
  const day = (agoDays: number) =>
    new Date(Date.parse("2026-07-25T00:00:00.000Z") - agoDays * 86_400_000)
      .toISOString();

  it("counts DISTINCT active days, not events", () => {
    const depth = computeHabitDepth([
        { session_id: "a", created_at: day(1) },
        { session_id: "a", created_at: day(1) }, // same day
        { session_id: "a", created_at: day(2) },
      ]);
    expect(depth.cohort).toBe(1);
    expect(depth.medianActiveDays).toBe(2);
  });

  it("reports cumulative buckets: 7+ is a subset of 3+", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => ({
        session_id: "deep",
        created_at: day(i),
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        session_id: "shallow",
        created_at: day(i),
      })),
      { session_id: "once", created_at: day(0) },
    ];
    const depth = computeHabitDepth(rows);
    const at = (min: number) =>
      depth.buckets.find((b) => b.minDays === min)?.installs;
    expect(at(1)).toBe(3);
    expect(at(3)).toBe(2);
    expect(at(7)).toBe(1);
    expect(at(21)).toBe(0);
  });

  it("returns an empty shape rather than NaN when nobody was active", () => {
    const depth = computeHabitDepth([]);
    expect(depth.cohort).toBe(0);
    expect(depth.medianActiveDays).toBe(0);
    expect(depth.buckets.every((b) => b.installs === 0)).toBe(true);
  });
});

describe("computeRetention — week 3", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");
  const day = (agoDays: number) =>
    new Date(Date.parse("2026-07-25T00:00:00.000Z") - agoDays * 86_400_000)
      .toISOString();

  it("counts a window, not a single day, so a habit is not missed by one day", () => {
    // Installed 24 days ago; active on its day 18, inside the 15–21 window.
    const r = computeRetention(
      [{ session_id: "a", first_seen: day(24) }],
      [{ session_id: "a", created_at: day(6) }],
      now,
    );
    expect(r.week3).toEqual({ returned: 1, cohort: 1 });
  });

  it("excludes an install too young to have reached week 3", () => {
    const r = computeRetention(
      [{ session_id: "a", first_seen: day(10) }],
      [{ session_id: "a", created_at: day(1) }],
      now,
    );
    expect(r.week3.cohort).toBe(0);
  });

  it("does not count activity that stopped before week 3", () => {
    const r = computeRetention(
      [{ session_id: "a", first_seen: day(24) }],
      [{ session_id: "a", created_at: day(23) }], // its day 1 only
      now,
    );
    expect(r.week3).toEqual({ returned: 0, cohort: 1 });
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
