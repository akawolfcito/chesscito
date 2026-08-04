/**
 * Classification rules.
 *
 * Two properties dominate this file, and they pull in opposite directions:
 *   · an axis nobody measured must never produce a GREEN verdict;
 *   · a RED that was measured stays red no matter how much else is missing.
 */

import { describe, expect, it } from "vitest";

import {
  THRESHOLDS,
  classify,
  exitCodeFor,
  hasSustainedIngest,
  percentile,
  worst,
  type ClassifyInput,
} from "../lib/classify";

/** Everything healthy AND fully measured. */
function healthy(): ClassifyInput {
  return {
    supabase: {
      observed: true,
      latency_ms: 240,
      events_per_hour: [{ events: 100 }, { events: 120 }],
      events_per_session: 24,
      session_event_counts: [10, 20, 30],
      projection_90d_bytes: 2.7 * 1024 ** 3,
    },
    vercel: { cpu_percent: 12, gateway_error_routes: 0, logs_observed: true },
    upstash: { percent_used: 28, hours_to_exhaustion: 900 },
  };
}

describe("fully measured and healthy", () => {
  it("is green, not partial", () => {
    const c = classify(healthy());
    expect(c.level).toBe("green");
    expect(c.partial).toBe(false);
    expect(c.label).toBe("GREEN");
    expect(exitCodeFor(c)).toBe(0);
  });
});

describe("an unmeasured critical axis forbids a full green", () => {
  it("marks GREEN (partial) when Vercel CPU is unknown", () => {
    const c = classify({ ...healthy(), vercel: { cpu_percent: null, gateway_error_routes: 0, logs_observed: true } });

    // The verdict is still green — nothing observed is wrong — but it must not
    // read as reassurance about an axis nobody looked at.
    expect(c.level).toBe("green");
    expect(c.partial).toBe(true);
    expect(c.label).toBe("GREEN (partial)");
    expect(c.unmeasured_critical).toContain("vercel_cpu");
  });

  it("marks partial when the Upstash quota is unknown", () => {
    const c = classify({ ...healthy(), upstash: { percent_used: null, hours_to_exhaustion: null } });
    expect(c.partial).toBe(true);
    expect(c.unmeasured_critical).toContain("upstash_quota");
  });

  it("names every unmeasured critical axis at once", () => {
    const c = classify({
      ...healthy(),
      vercel: { cpu_percent: null, gateway_error_routes: 0, logs_observed: true },
      upstash: { percent_used: null, hours_to_exhaustion: null },
    });
    expect(c.unmeasured_critical).toEqual(["vercel_cpu", "upstash_quota"]);
  });

  it("keeps the exit code tied to the LEVEL, not to completeness", () => {
    // Partial green is still green: a gap is not a warning about the system.
    const c = classify({ ...healthy(), upstash: { percent_used: null, hours_to_exhaustion: null } });
    expect(exitCodeFor(c)).toBe(0);
  });
});

describe("an observed red survives every gap", () => {
  it("stays RED when other axes are unmeasured", () => {
    const c = classify({
      supabase: { observed: false },
      vercel: { cpu_percent: null, gateway_error_routes: 0, logs_observed: false },
      upstash: { percent_used: null, hours_to_exhaustion: null },
    });

    expect(c.level).toBe("red");
    expect(c.label).toBe("RED (partial)");
    expect(exitCodeFor(c)).toBe(2);
    expect(c.triggers[0]?.detail).toMatch(/select now/);
  });

  it("a yellow elsewhere never downgrades an observed red", () => {
    const c = classify({
      ...healthy(),
      supabase: { ...healthy().supabase, observed: true, latency_ms: 9_000 } as ClassifyInput["supabase"],
      upstash: { percent_used: 75, hours_to_exhaustion: 500 },
    });
    expect(c.level).toBe("red");
  });
});

describe("Supabase rules", () => {
  it("a slow select now() is red", () => {
    const base = healthy();
    const c = classify({
      ...base,
      supabase: { ...(base.supabase as { observed: true }), latency_ms: THRESHOLDS.supabaseLatencyMs + 1 },
    });
    expect(c.level).toBe("red");
  });

  it("events/session above 35 is yellow and above 75 is red", () => {
    const base = healthy();
    const yellow = classify({
      ...base,
      supabase: { ...(base.supabase as { observed: true }), events_per_session: 40 },
    });
    const red = classify({
      ...base,
      supabase: { ...(base.supabase as { observed: true }), events_per_session: 80 },
    });
    expect(yellow.level).toBe("yellow");
    expect(red.level).toBe("red");
  });

  it("24 events/session — the real measurement — stays green", () => {
    expect(classify(healthy()).level).toBe("green");
  });

  it("a runaway session is red even when the average looks fine", () => {
    // Few sessions generating hundreds of events: invisible in a mean.
    const base = healthy();
    const c = classify({
      ...base,
      supabase: {
        ...(base.supabase as { observed: true }),
        events_per_session: 20,
        session_event_counts: [5, 8, 12, 250],
      },
    });
    expect(c.level).toBe("red");
    expect(c.triggers.some((t) => t.detail.includes("p95"))).toBe(true);
  });

  it("a 90-day projection between 4 and 6 GB is yellow, above 6 GB red", () => {
    const base = healthy();
    const yellow = classify({
      ...base,
      supabase: { ...(base.supabase as { observed: true }), projection_90d_bytes: 5 * 1024 ** 3 },
    });
    const red = classify({
      ...base,
      supabase: { ...(base.supabase as { observed: true }), projection_90d_bytes: 7 * 1024 ** 3 },
    });
    expect(yellow.level).toBe("yellow");
    expect(red.level).toBe("red");
  });

  it("an absent projection is a gap, not a zero", () => {
    const base = healthy();
    const c = classify({
      ...base,
      supabase: { ...(base.supabase as { observed: true }), projection_90d_bytes: null },
    });
    expect(c.level).toBe("green");
    expect(c.unmeasured_other.join(" ")).toMatch(/projection/);
  });
});

describe("sustained ingest, not a spike", () => {
  it("needs two CONSECUTIVE hours above the threshold", () => {
    const over = THRESHOLDS.eventsPerHour.yellow + 1;
    expect(hasSustainedIngest([{ events: over }, { events: 10 }, { events: over }], THRESHOLDS.eventsPerHour.yellow, 2)).toBe(false);
    expect(hasSustainedIngest([{ events: over }, { events: over }], THRESHOLDS.eventsPerHour.yellow, 2)).toBe(true);
  });

  it("a single spike does not turn the report yellow", () => {
    const base = healthy();
    const c = classify({
      ...base,
      supabase: {
        ...(base.supabase as { observed: true }),
        events_per_hour: [{ events: 9_000 }, { events: 100 }, { events: 120 }],
      },
    });
    expect(c.level).toBe("green");
  });
});

describe("Upstash red needs BOTH pressure and a short runway", () => {
  it("90% with months of runway is only yellow", () => {
    // The counter rolls over monthly; high usage late in the period is normal.
    const c = classify({ ...healthy(), upstash: { percent_used: 92, hours_to_exhaustion: 400 } });
    expect(c.level).toBe("yellow");
  });

  it("90% with under 48 h of runway is red", () => {
    const c = classify({ ...healthy(), upstash: { percent_used: 92, hours_to_exhaustion: 12 } });
    expect(c.level).toBe("red");
  });

  it("70% is yellow", () => {
    expect(classify({ ...healthy(), upstash: { percent_used: 71, hours_to_exhaustion: 900 } }).level).toBe("yellow");
  });
});

describe("generalized 522", () => {
  it("three or more routes with an HTML gateway body is red", () => {
    const c = classify({ ...healthy(), vercel: { cpu_percent: 10, gateway_error_routes: 3, logs_observed: true } });
    expect(c.level).toBe("red");
  });

  it("one affected route is not a generalized outage", () => {
    const c = classify({ ...healthy(), vercel: { cpu_percent: 10, gateway_error_routes: 1, logs_observed: true } });
    expect(c.level).toBe("green");
  });

  it("without a log window the rule abstains rather than passing", () => {
    const c = classify({ ...healthy(), vercel: { cpu_percent: 10, gateway_error_routes: 0, logs_observed: false } });
    expect(c.unmeasured_other.join(" ")).toMatch(/5XX by route/);
  });
});

describe("helpers", () => {
  it("worst() picks the most severe level", () => {
    expect(worst(["green", "yellow", "red"])).toBe("red");
    expect(worst(["green", "yellow"])).toBe("yellow");
    expect(worst([])).toBe("green");
  });

  it("percentile uses nearest rank and abstains on an empty set", () => {
    expect(percentile([10, 20, 30, 40], 0.95)).toBe(40);
    expect(percentile([], 0.5)).toBeNull();
  });

  it("triggers are ordered most severe first", () => {
    const base = healthy();
    const c = classify({
      ...base,
      supabase: { ...(base.supabase as { observed: true }), events_per_session: 80 },
      upstash: { percent_used: 75, hours_to_exhaustion: 900 },
    });
    expect(c.triggers[0]?.level).toBe("red");
  });
});
