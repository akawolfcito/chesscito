/**
 * Derived figures and comparison rules.
 *
 * Every failure guarded here looks like valid arithmetic, which is exactly why
 * it needs tests: nothing throws when you divide a day by a minute.
 */

import { describe, expect, it } from "vitest";

import {
  cumulativeDelta,
  eventsPerRequest,
  hoursToExhaustion,
  pointDelta,
  project,
  sizeModel,
} from "../lib/derive";

describe("size model", () => {
  it("derives bytes per row from what is stored", () => {
    // Real numbers: 63.9 MB over 99,542 rows measured at 208 B/row.
    const model = sizeModel(20_971_520 + 42_991_616, 99_542);
    expect(model?.bytes_per_row).toBeCloseTo(642.6, 0);
  });

  it("abstains on an empty table rather than divide by zero", () => {
    expect(sizeModel(0, 0)).toBeNull();
    expect(sizeModel(1_000, 0)).toBeNull();
  });
});

describe("projections are per window, never a single regime", () => {
  const model = { bytes_per_row: 208 };

  it("keeps each window labelled with the rate that produced it", () => {
    const p = project("last_1h", 1_945, 60, model);
    expect(p?.window).toBe("last_1h");
    expect(p?.rows_per_day).toBe(46_680);
  });

  it("different windows legitimately disagree — that is the point", () => {
    // Measured in one real snapshot: 31.4/min over 15m, 7.0/min over 6h.
    const short = project("last_15m", 471, 15, model)!;
    const medium = project("last_6h", 2_530, 360, model)!;
    // A 4.8x spread. Publishing either as "the" daily rate would be a fiction.
    expect(short.rows_per_day / medium.rows_per_day).toBeGreaterThan(4);
  });

  it("scales 30/45/90 days from the same rate", () => {
    const p = project("last_24h", 48_799, 1_440, model)!;
    expect(p.bytes_at_45d / p.bytes_at_30d).toBeCloseTo(1.5, 5);
    expect(p.bytes_at_90d / p.bytes_at_30d).toBeCloseTo(3, 5);
  });

  it("abstains on a zero-length window", () => {
    expect(project("bad", 100, 0, model)).toBeNull();
  });
});

describe("events per request — the tempting wrong division", () => {
  it("refuses 24h of rows against a minutes-long log sample", () => {
    // The obvious version reports ~290 events/request and looks like proof
    // that batching works. It is one window divided by a different one.
    expect(
      eventsPerRequest({
        events: 48_799,
        eventsWindowSeconds: 86_400,
        requests: 168,
        requestsWindowSeconds: 160,
      }),
    ).toBeNull();
  });

  it("computes the ratio when the windows really do match", () => {
    const r = eventsPerRequest({
      events: 200,
      eventsWindowSeconds: 160,
      requests: 10,
      requestsWindowSeconds: 165,
    });
    expect(r?.ratio).toBe(20);
  });

  it("tolerates a small mismatch and rejects a large one", () => {
    const near = eventsPerRequest({
      events: 100, eventsWindowSeconds: 100, requests: 5, requestsWindowSeconds: 120,
    });
    const far = eventsPerRequest({
      events: 100, eventsWindowSeconds: 100, requests: 5, requestsWindowSeconds: 400,
    });
    expect(near).not.toBeNull();
    expect(far).toBeNull();
  });

  it("abstains rather than divide by zero requests", () => {
    expect(
      eventsPerRequest({ events: 100, eventsWindowSeconds: 60, requests: 0, requestsWindowSeconds: 60 }),
    ).toBeNull();
  });
});

describe("cumulative deltas respect stats_reset", () => {
  const RESET_A = "2026-08-04T03:06:48+00:00";
  const RESET_B = "2026-08-04T09:00:00+00:00";

  it("subtracts when the counters share a reset", () => {
    const d = cumulativeDelta(
      { value: 100, stats_reset: RESET_A },
      { value: 180, stats_reset: RESET_A },
    );
    expect(d).toMatchObject({ comparable: true, change: 80 });
  });

  it("refuses across a reset boundary", () => {
    // The Nano→Micro resize did exactly this, and the subtraction that ignored
    // it is what made a 98K-row table report n_live_tup = 126.
    const d = cumulativeDelta(
      { value: 5_000, stats_reset: RESET_A },
      { value: 120, stats_reset: RESET_B },
    );
    expect(d.comparable).toBe(false);
    if (d.comparable) return;
    expect(d.reason).toMatch(/reset/);
  });

  it("refuses when either side has no stats_reset", () => {
    // pg_stat_database reported a null stats_reset on this very project.
    expect(
      cumulativeDelta({ value: 1, stats_reset: null }, { value: 2, stats_reset: RESET_A }).comparable,
    ).toBe(false);
  });

  it("refuses a backwards counter even when the resets match", () => {
    const d = cumulativeDelta(
      { value: 500, stats_reset: RESET_A },
      { value: 100, stats_reset: RESET_A },
    );
    expect(d.comparable).toBe(false);
  });

  it("refuses when there is no previous snapshot", () => {
    expect(cumulativeDelta(null, { value: 1, stats_reset: RESET_A }).comparable).toBe(false);
  });
});

describe("point deltas never treat not_observable as zero", () => {
  it("subtracts two measured values", () => {
    expect(pointDelta(98_527, 100_010)).toMatchObject({ comparable: true, change: 1_483 });
  });

  it("refuses when either side was not measured", () => {
    // Treating an unmeasured side as 0 would report the entire current value
    // as growth — a fabricated spike.
    expect(pointDelta(null, 100).comparable).toBe(false);
    expect(pointDelta(100, null).comparable).toBe(false);
    expect(pointDelta(undefined, 100).comparable).toBe(false);
  });

  it("reports a decrease as a real negative", () => {
    // A prune legitimately shrinks the table; that is data, not an error.
    expect(pointDelta(100_000, 90_000)).toMatchObject({ comparable: true, change: -10_000 });
  });
});

describe("exhaustion horizon", () => {
  it("computes hours remaining at a rate", () => {
    expect(hoursToExhaustion(400_000, 500_000, 1_000)).toBe(100);
  });

  it("returns null when the rate is zero — it never runs out", () => {
    expect(hoursToExhaustion(400_000, 500_000, 0)).toBeNull();
  });

  it("returns 0 when already over quota", () => {
    expect(hoursToExhaustion(600_000, 500_000, 100)).toBe(0);
  });
});
