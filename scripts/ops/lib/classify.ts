/**
 * Health classification.
 *
 * ── The rule that shapes everything here ──────────────────────────────────
 *
 * A monitor that reports GREEN without having looked at the most expensive axis
 * is worse than no monitor: it converts ignorance into reassurance. So an axis
 * that could not be measured never contributes a passing verdict. It downgrades
 * the overall state to a PARTIAL one and names itself in the report.
 *
 * The inverse also holds, and matters more: **a red that WAS observed stays
 * red**, however many other axes are missing. Absence never softens a fact.
 *
 * ── What may enter a comparison ───────────────────────────────────────────
 *
 * Nothing that is `not_observable` reaches a number. Every threshold below
 * takes a value that was actually measured, or it abstains. There is no
 * "assume zero", because zero is a measurement.
 */

export type HealthLevel = "green" | "yellow" | "red";

/** A single evaluated rule. */
export type Signal = {
  axis: string;
  level: HealthLevel;
  detail: string;
};

export type Classification = {
  level: HealthLevel;
  /** True when at least one CRITICAL axis could not be measured. */
  partial: boolean;
  /** Rendered as "GREEN (partial)" etc. */
  label: string;
  /** Rules that fired at yellow or red, most severe first. */
  triggers: Signal[];
  /** Critical axes with no measurement behind them. */
  unmeasured_critical: string[];
  /** Non-critical gaps, reported but not affecting the level. */
  unmeasured_other: string[];
};

/**
 * Axes whose absence forces a partial verdict.
 *
 * Vercel CPU and the Upstash quota are here because they are the two ways this
 * project can run out of money or capacity without any error appearing
 * anywhere. Not knowing them is exactly the state a launch monitor exists to
 * make visible.
 */
export const CRITICAL_AXES = ["vercel_cpu", "upstash_quota", "supabase"] as const;
export type CriticalAxis = (typeof CRITICAL_AXES)[number];

export const THRESHOLDS = {
  eventsPerSession: { yellow: 35, red: 75 },
  /** Sustained ingest: two consecutive hourly buckets above this. */
  eventsPerHour: { yellow: 6_500, sustainedBuckets: 2 },
  /** One session generating this many events in 24 h is a runaway client. */
  sessionEventsP95: { red: 200 },
  vercelCpuPercent: { yellow: 80, red: 95 },
  upstashPercent: { yellow: 70, red: 90 },
  /** Upstash red also requires exhaustion within this horizon. */
  upstashExhaustionHours: 48,
  analytics90dBytes: { yellow: 4 * 1024 ** 3, red: 6 * 1024 ** 3 },
  /** ≥N distinct routes with an HTML gateway body = a generalized 522. */
  gatewayErrorRoutes: 3,
  /** `select now()` slower than this reads as a database in distress. */
  supabaseLatencyMs: 5_000,
} as const;

const RANK: Record<HealthLevel, number> = { green: 0, yellow: 1, red: 2 };

export function worst(levels: HealthLevel[]): HealthLevel {
  return levels.reduce<HealthLevel>(
    (acc, level) => (RANK[level] > RANK[acc] ? level : acc),
    "green",
  );
}

/**
 * Nearest-rank percentile over already-collected counts. Used for the
 * "few sessions, hundreds of events" rule, which needs a distribution rather
 * than a mean — a single runaway client is invisible in an average.
 */
export function percentile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] ?? null;
}

/**
 * Are two consecutive hourly buckets above the threshold?
 *
 * "More than 6.500 events/h for 2 hours" cannot be answered by a peak: a single
 * spike is not a sustained load. Buckets arrive newest-first.
 */
export function hasSustainedIngest(
  buckets: Array<{ events: number }>,
  threshold: number,
  required: number,
): boolean {
  let run = 0;
  for (const bucket of buckets) {
    run = bucket.events > threshold ? run + 1 : 0;
    if (run >= required) return true;
  }
  return false;
}

export type ClassifyInput = {
  supabase:
    | {
        observed: true;
        latency_ms: number;
        events_per_hour: Array<{ events: number }>;
        /** Most recent complete day. */
        events_per_session: number | null;
        session_event_counts: number[];
        /** Physical bytes projected at 90 days, per rate window. */
        projection_90d_bytes: number | null;
      }
    | { observed: false };
  vercel: {
    cpu_percent: number | null;
    gateway_error_routes: number;
    /** False when no log window could be read at all. */
    logs_observed: boolean;
  };
  upstash: {
    percent_used: number | null;
    hours_to_exhaustion: number | null;
  };
};

export function classify(input: ClassifyInput): Classification {
  const triggers: Signal[] = [];
  const unmeasuredCritical: string[] = [];
  const unmeasuredOther: string[] = [];

  // ── Supabase ────────────────────────────────────────────────────────────
  if (!input.supabase.observed) {
    // The database not answering is not a gap in coverage, it is the loudest
    // red the monitor can report. It is NOT downgraded to "partial".
    triggers.push({
      axis: "supabase",
      level: "red",
      detail: "database did not answer select now()",
    });
  } else {
    const s = input.supabase;

    if (s.latency_ms > THRESHOLDS.supabaseLatencyMs) {
      triggers.push({
        axis: "supabase",
        level: "red",
        detail: `select now() took ${s.latency_ms} ms (>${THRESHOLDS.supabaseLatencyMs})`,
      });
    }

    if (s.events_per_session !== null) {
      if (s.events_per_session > THRESHOLDS.eventsPerSession.red) {
        triggers.push({
          axis: "telemetry_volume",
          level: "red",
          detail: `${s.events_per_session} events/session (>${THRESHOLDS.eventsPerSession.red})`,
        });
      } else if (s.events_per_session > THRESHOLDS.eventsPerSession.yellow) {
        triggers.push({
          axis: "telemetry_volume",
          level: "yellow",
          detail: `${s.events_per_session} events/session (>${THRESHOLDS.eventsPerSession.yellow})`,
        });
      }
    } else {
      unmeasuredOther.push("events per session (no complete day yet)");
    }

    const p95 = percentile(s.session_event_counts, 0.95);
    if (p95 !== null && p95 >= THRESHOLDS.sessionEventsP95.red) {
      triggers.push({
        axis: "telemetry_volume",
        level: "red",
        detail: `p95 session emits ${p95} events (>=${THRESHOLDS.sessionEventsP95.red})`,
      });
    }

    if (
      hasSustainedIngest(
        s.events_per_hour,
        THRESHOLDS.eventsPerHour.yellow,
        THRESHOLDS.eventsPerHour.sustainedBuckets,
      )
    ) {
      triggers.push({
        axis: "ingest_rate",
        level: "yellow",
        detail:
          `${THRESHOLDS.eventsPerHour.sustainedBuckets} consecutive hours above ` +
          `${THRESHOLDS.eventsPerHour.yellow} events/h`,
      });
    }

    if (s.projection_90d_bytes !== null) {
      const gb = (b: number) => (b / 1024 ** 3).toFixed(1);
      if (s.projection_90d_bytes > THRESHOLDS.analytics90dBytes.red) {
        triggers.push({
          axis: "analytics_growth",
          level: "red",
          detail: `90-day projection ${gb(s.projection_90d_bytes)} GB (>6 GB)`,
        });
      } else if (s.projection_90d_bytes > THRESHOLDS.analytics90dBytes.yellow) {
        triggers.push({
          axis: "analytics_growth",
          level: "yellow",
          detail: `90-day projection ${gb(s.projection_90d_bytes)} GB (>4 GB)`,
        });
      }
    } else {
      unmeasuredOther.push("90-day size projection (not enough rate history)");
    }
  }

  // ── Vercel ──────────────────────────────────────────────────────────────
  if (input.vercel.cpu_percent === null) {
    unmeasuredCritical.push("vercel_cpu");
  } else if (input.vercel.cpu_percent >= THRESHOLDS.vercelCpuPercent.red) {
    triggers.push({
      axis: "vercel_cpu",
      level: "red",
      detail: `Active CPU at ${input.vercel.cpu_percent}% (>=95%)`,
    });
  } else if (input.vercel.cpu_percent >= THRESHOLDS.vercelCpuPercent.yellow) {
    triggers.push({
      axis: "vercel_cpu",
      level: "yellow",
      detail: `Active CPU at ${input.vercel.cpu_percent}% (>=80%)`,
    });
  }

  if (!input.vercel.logs_observed) {
    unmeasuredOther.push("5XX by route (no log window)");
  } else if (input.vercel.gateway_error_routes >= THRESHOLDS.gatewayErrorRoutes) {
    triggers.push({
      axis: "gateway_522",
      level: "red",
      detail: `${input.vercel.gateway_error_routes} routes returning an HTML gateway error`,
    });
  }

  // ── Upstash ─────────────────────────────────────────────────────────────
  if (input.upstash.percent_used === null) {
    unmeasuredCritical.push("upstash_quota");
  } else {
    const pct = input.upstash.percent_used;
    const hours = input.upstash.hours_to_exhaustion;
    // Red demands BOTH: high usage and a short runway. 90% on the 29th of the
    // month with the counter about to roll over is not an incident.
    if (
      pct >= THRESHOLDS.upstashPercent.red &&
      hours !== null &&
      hours < THRESHOLDS.upstashExhaustionHours
    ) {
      triggers.push({
        axis: "upstash_quota",
        level: "red",
        detail: `${pct}% used, exhaustion in ~${Math.round(hours)} h`,
      });
    } else if (pct >= THRESHOLDS.upstashPercent.yellow) {
      triggers.push({
        axis: "upstash_quota",
        level: "yellow",
        detail: `${pct}% of the command quota used`,
      });
    }
  }

  const level = worst(triggers.map((t) => t.level));
  const partial = unmeasuredCritical.length > 0;
  const upper = level.toUpperCase();

  return {
    level,
    partial,
    // A red is never softened by a gap, but it still says what was not seen.
    label: partial ? `${upper} (partial)` : upper,
    triggers: [...triggers].sort((a, b) => RANK[b.level] - RANK[a.level]),
    unmeasured_critical: unmeasuredCritical,
    unmeasured_other: unmeasuredOther,
  };
}

/**
 * 0 green · 1 yellow · 2 red. Exit code 3 is reserved for the monitor itself
 * failing, and is never produced here: "I could not measure" is a partial
 * verdict, not a crash.
 */
export function exitCodeFor(classification: Classification): 0 | 1 | 2 {
  return classification.level === "red" ? 2 : classification.level === "yellow" ? 1 : 0;
}
