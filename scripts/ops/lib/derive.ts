/**
 * Derived figures — and the rules about which comparisons are legitimate.
 *
 * Every function here can return `null`, and `null` means "this comparison is
 * not valid", not "zero". The renderer prints such a result as not observable
 * rather than as a number. That is the whole point: the failures this file
 * guards against all look like perfectly good arithmetic.
 */

/** Bytes per stored row, measured rather than assumed. */
export type SizeModel = { bytes_per_row: number };

export type Projection = {
  /** Which window produced the rate. Always shown next to the number. */
  window: string;
  rows_per_day: number;
  bytes_at_30d: number;
  bytes_at_45d: number;
  bytes_at_90d: number;
};

/**
 * Project physical size from ONE window's rate.
 *
 * Deliberately plural at the call site: a single projection would have to pick
 * a window and call it "the" rate, and the windows disagree by design. Measured
 * on this project in one snapshot: 31.4 events/min over 15 min, 7.0 over 6 h,
 * 33.9 over 24 h — a 4.8x spread. Presenting one of those as the regime is how
 * a capacity plan ends up built on the quietest hour of the night.
 */
export function project(
  window: string,
  events: number,
  minutes: number,
  model: SizeModel,
): Projection | null {
  if (minutes <= 0 || events < 0) return null;
  const rowsPerDay = (events / minutes) * 60 * 24;
  const perDayBytes = rowsPerDay * model.bytes_per_row;
  return {
    window,
    rows_per_day: Math.round(rowsPerDay),
    bytes_at_30d: Math.round(perDayBytes * 30),
    bytes_at_45d: Math.round(perDayBytes * 45),
    bytes_at_90d: Math.round(perDayBytes * 90),
  };
}

/** Bytes per row from what is actually stored. Null when the table is empty. */
export function sizeModel(totalBytes: number, rowCount: number): SizeModel | null {
  if (rowCount <= 0 || totalBytes <= 0) return null;
  return { bytes_per_row: totalBytes / rowCount };
}

export type EventsPerRequest = {
  events: number;
  requests: number;
  ratio: number;
  window_seconds: number;
};

/**
 * Events per telemetry request — the number that proves batching works.
 *
 * ⚠️ This is the single most tempting wrong calculation in the whole monitor.
 * The obvious version divides 24 h of analytics rows by the ~160 s log sample
 * and reports "290 events per request", which is not a batching ratio at all:
 * it is one window divided by a different one. Two windows may only be divided
 * when they cover the SAME span, so this refuses unless they are within
 * `tolerance` of each other.
 *
 * Returns null when the windows are incomparable. The renderer says so instead
 * of printing a ratio that would look like triumphant evidence.
 */
export function eventsPerRequest(input: {
  events: number;
  eventsWindowSeconds: number;
  requests: number;
  requestsWindowSeconds: number;
  /** Allowed relative difference between the two spans. */
  tolerance?: number;
}): EventsPerRequest | null {
  const { events, eventsWindowSeconds, requests, requestsWindowSeconds } = input;
  const tolerance = input.tolerance ?? 0.25;

  if (requests <= 0 || eventsWindowSeconds <= 0 || requestsWindowSeconds <= 0) return null;

  const longer = Math.max(eventsWindowSeconds, requestsWindowSeconds);
  const shorter = Math.min(eventsWindowSeconds, requestsWindowSeconds);
  if ((longer - shorter) / longer > tolerance) return null;

  return {
    events,
    requests,
    ratio: Math.round((events / requests) * 10) / 10,
    window_seconds: Math.round((eventsWindowSeconds + requestsWindowSeconds) / 2),
  };
}

export type Delta<T> =
  | { comparable: true; previous: T; current: T; change: number }
  | { comparable: false; reason: string };

/**
 * Difference between two cumulative counters.
 *
 * Refuses when the counters were zeroed between snapshots. A Nano→Micro resize
 * did exactly that here, and the subtraction that ignores it is what made a
 * 98 K-row table report `n_live_tup = 126`. A negative delta is the same
 * signal arriving too late to be useful.
 */
export function cumulativeDelta(
  previous: { value: number; stats_reset: string | null } | null,
  current: { value: number; stats_reset: string | null } | null,
): Delta<number> {
  if (!previous || !current) return { comparable: false, reason: "no previous snapshot" };
  if (previous.stats_reset === null || current.stats_reset === null) {
    return { comparable: false, reason: "stats_reset unknown on one side" };
  }
  if (previous.stats_reset !== current.stats_reset) {
    return { comparable: false, reason: "counters were reset between snapshots" };
  }
  const change = current.value - previous.value;
  if (change < 0) {
    // Same stats_reset and yet it went backwards: trust the data, not the math.
    return { comparable: false, reason: "counter went backwards despite matching stats_reset" };
  }
  return { comparable: true, previous: previous.value, current: current.value, change };
}

/**
 * Difference between two point-in-time values (row counts, key counts).
 *
 * These have no `stats_reset`, so the only guard is that both were actually
 * measured. A `not_observable` side yields an incomparable result rather than
 * being treated as zero — subtracting from an unmeasured value invents change.
 */
export function pointDelta(
  previous: number | null | undefined,
  current: number | null | undefined,
): Delta<number> {
  if (previous === null || previous === undefined) {
    return { comparable: false, reason: "not measured in the previous snapshot" };
  }
  if (current === null || current === undefined) {
    return { comparable: false, reason: "not measured in this snapshot" };
  }
  return { comparable: true, previous, current, change: current - previous };
}

/** Hours until a quota is exhausted at a given rate. Null when it never is. */
export function hoursToExhaustion(
  used: number,
  quota: number,
  perHour: number,
): number | null {
  if (perHour <= 0) return null;
  const remaining = quota - used;
  if (remaining <= 0) return 0;
  return remaining / perHour;
}
