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
      session_events_p95_24h: 73,
      session_population_24h: 2411,
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

describe("unreachable is red; unconfigured is a gap", () => {
  it("a database that did not answer is RED", () => {
    const c = classify({
      ...healthy(),
      supabase: { observed: false, reason: "unreachable" },
    });
    expect(c.level).toBe("red");
    expect(c.triggers[0]?.detail).toMatch(/did not answer/);
  });

  it("ABSENT CREDENTIALS are a gap, not a red", () => {
    // Caught by running from a clean checkout: a fresh clone carries no
    // credentials and was reporting RED about a database that is perfectly
    // healthy. "Never asked" and "asked and got nothing" are different facts,
    // and only the second one says anything about production.
    const c = classify({
      ...healthy(),
      supabase: { observed: false, reason: "not_configured" },
    });
    expect(c.level).not.toBe("red");
    expect(c.partial).toBe(true);
    expect(c.unmeasured_critical).toContain("supabase");
    expect(c.triggers.filter((t) => t.axis === "supabase")).toHaveLength(0);
  });

  it("a clean checkout with nothing configured is GREEN (partial), exit 0", () => {
    const c = classify({
      supabase: { observed: false, reason: "not_configured" },
      vercel: { cpu_percent: null, gateway_error_routes: 0, logs_observed: false },
      upstash: { percent_used: null, hours_to_exhaustion: null },
    });
    expect(c.label).toBe("GREEN (partial)");
    expect(exitCodeFor(c)).toBe(0);
    expect(c.unmeasured_critical).toHaveLength(3);
  });
});

describe("an observed red survives every gap", () => {
  it("stays RED when other axes are unmeasured", () => {
    const c = classify({
      supabase: { observed: false, reason: "unreachable" },
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

  it("a runaway POPULATION is red even when the average looks fine", () => {
    // The rule is "many sessions generating hundreds of events", which a mean
    // hides. It takes a population p95 to see it — not one loud session.
    const base = healthy();
    const c = classify({
      ...base,
      supabase: {
        ...(base.supabase as { observed: true }),
        events_per_session: 20,
        session_events_p95_24h: 250,
        session_population_24h: 2000,
      },
    });
    expect(c.level).toBe("red");
    expect(c.triggers.some((t) => t.detail.includes("p95"))).toBe(true);
  });

  it("the RED threshold is exactly 200, and 199 does not fire", () => {
    const base = healthy();
    const at = (p95: number) =>
      classify({
        ...base,
        supabase: { ...(base.supabase as { observed: true }), session_events_p95_24h: p95 },
      });

    expect(at(199).triggers.some((t) => t.detail.includes("p95"))).toBe(false);
    expect(at(199).level).toBe("green");
    expect(at(200).triggers.some((t) => t.detail.includes("p95"))).toBe(true);
    expect(at(200).level).toBe("red");
    expect(THRESHOLDS.sessionEventsP95.red).toBe(200);
  });

  it("the real measurement (p95 73 over 2,411 sessions) is GREEN", () => {
    // Audit 2026-08-04: the population p95 was 73 while the top-20 figure the
    // classifier used to read was 182 — which is the real p99, not a p95.
    const c = classify(healthy());
    expect(c.level).toBe("green");
    expect(c.triggers.some((t) => t.detail.includes("p95"))).toBe(false);
  });

  it("reports the population size alongside the percentile when it fires", () => {
    // A p95 without its n is not readable.
    const base = healthy();
    const c = classify({
      ...base,
      supabase: {
        ...(base.supabase as { observed: true }),
        session_events_p95_24h: 240,
        session_population_24h: 1846,
      },
    });
    const trigger = c.triggers.find((t) => t.detail.includes("p95"));
    expect(trigger?.detail).toContain("1846");
    expect(trigger?.detail).toContain("24h");
  });

  it("an unmeasured p95 is neither green nor red — it is unmeasured", () => {
    const base = healthy();
    const c = classify({
      ...base,
      supabase: { ...(base.supabase as { observed: true }), session_events_p95_24h: null },
    });
    expect(c.triggers.some((t) => t.detail.includes("p95"))).toBe(false);
    expect(c.unmeasured_other.join(" ")).toMatch(/p95 events per session/);
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
