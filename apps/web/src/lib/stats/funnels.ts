import {
  ACCESS_FAILURE_EVENT,
  ACCESS_FUNNEL,
  accessStepFor,
  DAILY_FOCUS_FUNNEL,
  dailyFocusStepFor,
  TRAINING_ACTIVATION_FUNNEL,
  canonicalEventFor,
  type AccessStep,
  type CanonicalEvent,
  type DailyFocusStep,
} from "@/lib/analytics/canonical-events";

/**
 * Pure derivations for the /stats activation, top-countries, and retention
 * blocks. All operate over already-fetched, already-filtered rows so they are
 * trivially testable and carry no DB coupling.
 *
 * Counts are DISTINCT sessions (anonymous installs) per step — a proper funnel
 * denominator-free absolute, matching the "conteos absolutos, sin rates"
 * decision for funnels. Retention returns returned + cohort counts so the view
 * can show "X of Y" and derive a rate without the aggregator asserting one.
 */

export type ActivationStep = { step: CanonicalEvent; sessions: number };
export type ActivationFunnel = ActivationStep[];

/**
 * TRAINING activation — four steps, ending at `exercise_completed`.
 *
 * It used to carry a fifth step, `daily_focus_completed`, which asserted that
 * Daily completions were a subset of training completions. They are not: the
 * two come from disjoint emitters, so the step described a population that
 * overlaps rather than nests. Daily now has `computeDailyFocusFunnel` beside
 * this one — see the header of `canonical-events.ts`.
 *
 * ⚠️ Known limit, PRE-EXISTING and deliberately untouched here: steps are
 * counted INDEPENDENTLY, so this array is not guaranteed monotone (production
 * once shipped `app_opened 37 < hub_viewed 41`). Nesting the steps is a
 * separate change that moves live numbers; the `stats_activation_funnel` RPC
 * already implements the nested shape for whoever wires it up.
 */
export function computeActivation(
  rows: Array<{ event?: string | null; session_id?: string | null }>,
): ActivationFunnel {
  const byStep = new Map<CanonicalEvent, Set<string>>();
  for (const step of TRAINING_ACTIVATION_FUNNEL) byStep.set(step, new Set());
  for (const row of rows) {
    const event = typeof row.event === "string" ? row.event : null;
    const sid = typeof row.session_id === "string" ? row.session_id : null;
    if (!event || !sid) continue;
    const canonical = canonicalEventFor(event);
    // `canonicalEventFor` still resolves `daily_focus_completed`, which is a
    // valid canonical name but NOT a training step. Admitting it here would
    // reintroduce the fifth rung through the back door.
    if (canonical && byStep.has(canonical)) byStep.get(canonical)!.add(sid);
  }
  return TRAINING_ACTIVATION_FUNNEL.map((step) => ({
    step,
    sessions: byStep.get(step)!.size,
  }));
}

export type DailyFocusStepCount = { step: DailyFocusStep; sessions: number };
export type DailyFocusFunnel = DailyFocusStepCount[];

/**
 * The Daily's own path to value — a SIBLING of `computeActivation`, never a
 * continuation of it. Both branch off the same `app_opened → hub_viewed`, and
 * a session can appear in both, one, or neither.
 *
 * Same independent-count caveat as the training funnel above.
 */
export function computeDailyFocusFunnel(
  rows: Array<{ event?: string | null; session_id?: string | null }>,
): DailyFocusFunnel {
  const byStep = new Map<DailyFocusStep, Set<string>>();
  for (const step of DAILY_FOCUS_FUNNEL) byStep.set(step, new Set());
  for (const row of rows) {
    const event = typeof row.event === "string" ? row.event : null;
    const sid = typeof row.session_id === "string" ? row.session_id : null;
    if (!event || !sid) continue;
    const step = dailyFocusStepFor(event);
    if (step) byStep.get(step)!.add(sid);
  }
  return DAILY_FOCUS_FUNNEL.map((step) => ({
    step,
    sessions: byStep.get(step)!.size,
  }));
}

export type AccessStepCount = { step: AccessStep; sessions: number };
export type AccessFunnel = {
  steps: AccessStepCount[];
  /** Distinct gate sessions that hit at least one login error. Sits BESIDE the
   *  funnel: a session can fail and then succeed, so this is friction, not
   *  loss, and is never subtracted from any step. */
  failedSessions: number;
};

/**
 * Door-to-value funnel, scoped to the sessions that actually saw the door.
 *
 * The cohort is every session that fired `web_access_gate_viewed`; each later
 * step counts only sessions INSIDE that cohort. Without the scoping the funnel
 * is meaningless: MiniPay never mounts the gate, so its sessions would land on
 * `first_exercise_completed` without ever appearing at `gate_viewed` and the
 * last step would exceed the first.
 *
 * Scoping also makes the sequence monotonic by construction, so a drop between
 * two steps is always a real drop and never a mix artifact.
 */
export function computeAccessFunnel(
  rows: Array<{ event?: string | null; session_id?: string | null }>,
): AccessFunnel {
  const byStep = new Map<AccessStep, Set<string>>();
  for (const step of ACCESS_FUNNEL) byStep.set(step, new Set());
  const failed = new Set<string>();

  // Pass 1 — who entered the funnel at all.
  const gateSessions = new Set<string>();
  for (const row of rows) {
    if (row.event !== "web_access_gate_viewed") continue;
    const sid = typeof row.session_id === "string" ? row.session_id : null;
    if (sid) gateSessions.add(sid);
  }

  // Pass 2 — everything else, admitted only for sessions in the cohort.
  for (const row of rows) {
    const event = typeof row.event === "string" ? row.event : null;
    const sid = typeof row.session_id === "string" ? row.session_id : null;
    if (!event || !sid || !gateSessions.has(sid)) continue;
    if (event === ACCESS_FAILURE_EVENT) {
      failed.add(sid);
      continue;
    }
    const step = accessStepFor(event);
    if (step) byStep.get(step)!.add(sid);
  }

  return {
    steps: ACCESS_FUNNEL.map((step) => ({
      step,
      sessions: byStep.get(step)!.size,
    })),
    failedSessions: failed.size,
  };
}

export type CountryCount = { country: string; sessions: number };

export function computeTopCountries(
  rows: Array<{ country?: string | null; session_id?: string | null }>,
  limit = 8,
): CountryCount[] {
  const byCountry = new Map<string, Set<string>>();
  for (const row of rows) {
    const country = typeof row.country === "string" ? row.country : null;
    const sid = typeof row.session_id === "string" ? row.session_id : null;
    if (!country || !sid) continue; // null country excluded from the ranking
    if (!byCountry.has(country)) byCountry.set(country, new Set());
    byCountry.get(country)!.add(sid);
  }
  return Array.from(byCountry.entries())
    .map(([country, sessions]) => ({ country, sessions: sessions.size }))
    .sort((a, b) => b.sessions - a.sessions || a.country.localeCompare(b.country))
    .slice(0, limit);
}

export type RetentionBucket = { returned: number; cohort: number };
export type Retention = {
  d1: RetentionBucket;
  d7: RetentionBucket;
  /** Deliberately a WINDOW, not a single day like d1/d7 — see computeRetention. */
  week3: RetentionBucket;
};

function dayKey(ts: string): string {
  return ts.slice(0, 10);
}

/** Whole UTC days between two ISO timestamps' calendar days. */
function ageInDays(ts: string, todayKey: string): number {
  return Math.round(
    (Date.parse(`${todayKey}T00:00:00.000Z`) -
      Date.parse(`${dayKey(ts)}T00:00:00.000Z`)) /
      86_400_000,
  );
}

function todayKeyOf(now: Date): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/* ── Account lifecycle ──────────────────────────────────────────────────────
   The install-level numbers answer "how many browsers", which is not the
   question anyone asks. These answer "how many people", using the keyed
   pseudonym derived at ingest (lib/analytics/account-ref.ts).

   "Inactive" is not an event — it is the ABSENCE of one — so it can only be
   counted against a denominator that outlives the event window. That
   denominator is `account_first_seen`; without it the number does not exist. */

/**
 * The three head counts are EXACT — they come from `count: "exact"`, which
 * PostgREST answers in a header without transferring a row, so they are immune
 * to the 1,000-row transport ceiling.
 *
 * The four activity fields are `number | null` because they are NOT: they need
 * both the account list and the event scan in memory, and either one arriving
 * capped makes the whole partition a guess. `null` is "we could not measure
 * this", and it is emphatically not zero — publishing `inactive: 962` off a
 * capped read is exactly the defect this shape exists to prevent.
 */
export type AccountLifecycle = {
  /** Accounts known to exist at all. The denominator for everything below. */
  known: number;
  newToday: number;
  new7d: number;
  /** Any event in the last 7 days. `null` when the reads were capped. */
  active7d: number | null;
  /** Last event 8–29 days ago. `null` when the reads were capped. */
  dormant: number | null;
  /** No event in the whole 30-day window. `null` when the reads were capped. */
  inactive: number | null;
  /** Active in the last 7 days after a silent 8–29 day stretch — the number
   *  that says whether streaks and reminders actually pull anyone back. */
  resurrected7d: number | null;
};

/** The COMPLETE shape — what `computeAccountLifecycle` returns. It only runs on
 *  the path where both reads came back whole, so its four activity fields are
 *  narrowed back to plain numbers and the partition identity
 *  `active7d + dormant + inactive === known` is checkable without null guards. */
export type MeasuredAccountLifecycle = AccountLifecycle & {
  active7d: number;
  dormant: number;
  inactive: number;
  resurrected7d: number;
};

/** The activity half, unmeasured. Spread over the exact head counts when either
 *  underlying read came back capped. */
export const UNMEASURED_ACCOUNT_ACTIVITY = {
  active7d: null,
  dormant: null,
  inactive: null,
  resurrected7d: null,
} as const;

export const EMPTY_ACCOUNT_LIFECYCLE: AccountLifecycle = {
  known: 0,
  newToday: 0,
  new7d: 0,
  active7d: 0,
  dormant: 0,
  inactive: 0,
  resurrected7d: 0,
};

/**
 * `active7d + dormant + inactive === known` by construction: the three are a
 * partition of every known account, so the block can never describe more or
 * fewer people than exist. `resurrected7d` is a subset of `active7d` and is
 * NOT part of the partition.
 *
 * Limit worth knowing: `inactive` means "no event in the last 30 days", which
 * is the widest window the event table's read covers. Someone gone for a year
 * and someone gone for 31 days land in the same bucket.
 */
export function computeAccountLifecycle(
  accounts: Array<{ account_ref?: string | null; first_seen?: string | null }>,
  activity: Array<{ account_ref?: string | null; created_at?: string | null }>,
  now: Date = new Date(),
): MeasuredAccountLifecycle {
  const todayKey = todayKeyOf(now);

  /** account → the smallest age (in days) of any of its events. */
  const lastSeenAge = new Map<string, number>();
  /** account → had at least one event in the 8–29 day band. */
  const activeInGap = new Set<string>();
  for (const row of activity) {
    const ref =
      typeof row.account_ref === "string" && row.account_ref
        ? row.account_ref
        : null;
    const ts = typeof row.created_at === "string" ? row.created_at : null;
    if (!ref || !ts) continue;
    const age = ageInDays(ts, todayKey);
    const prev = lastSeenAge.get(ref);
    if (prev === undefined || age < prev) lastSeenAge.set(ref, age);
    if (age >= 8 && age <= 29) activeInGap.add(ref);
  }

  // Local all-number accumulator: the exported shape allows `null` on the four
  // activity fields, and `+=` cannot run against that union. This function is
  // only ever called on the COMPLETE path, so every field here is a number.
  const out = {
    known: 0,
    newToday: 0,
    new7d: 0,
    active7d: 0,
    dormant: 0,
    inactive: 0,
    resurrected7d: 0,
  };
  for (const row of accounts) {
    const ref =
      typeof row.account_ref === "string" && row.account_ref
        ? row.account_ref
        : null;
    const fs = typeof row.first_seen === "string" ? row.first_seen : null;
    if (!ref || !fs) continue;

    out.known += 1;
    const bornAge = ageInDays(fs, todayKey);
    if (bornAge === 0) out.newToday += 1;
    if (bornAge <= 7) out.new7d += 1;

    const age = lastSeenAge.get(ref);
    if (age !== undefined && age <= 7) {
      out.active7d += 1;
      // Back after a silence: nothing in the 8–29 band, and old enough that
      // the silence was real rather than "did not exist yet".
      if (!activeInGap.has(ref) && bornAge >= 8) out.resurrected7d += 1;
    } else if (age !== undefined && age <= 29) {
      out.dormant += 1;
    } else {
      out.inactive += 1;
    }
  }
  return out;
}

/* ── Habit depth ────────────────────────────────────────────────────────────
   The 21-day habit is the product's promise, and no single retention rate
   measures it: D1 and D7 are two snapshots, and someone can pass both while
   showing up twice. Counting DISTINCT active days per install answers the
   actual question — how often does a person come back. */

export type HabitBucket = { minDays: number; installs: number };
export type HabitDepth = {
  /** Cumulative: the 7+ bucket is a subset of the 3+ bucket. */
  buckets: HabitBucket[];
  /** Installs with any activity in the window — the buckets' denominator. */
  cohort: number;
  /** Median active days among that cohort. 0 when nobody was active. */
  medianActiveDays: number;
};

/** Cut points, ending at the 21 the product promises. */
export const HABIT_THRESHOLDS: readonly number[] = [1, 3, 7, 14, 21];

/** Takes NO `now`: the window is whatever the caller already sliced when it
 *  fetched `activity`. Accepting a date here would imply it re-windows the
 *  rows, which it does not. */
export function computeHabitDepth(
  activity: Array<{ session_id?: string | null; created_at?: string | null }>,
): HabitDepth {
  const daysBySession = new Map<string, Set<string>>();
  for (const row of activity) {
    const sid = typeof row.session_id === "string" ? row.session_id : null;
    const ts = typeof row.created_at === "string" ? row.created_at : null;
    if (!sid || !ts) continue;
    if (!daysBySession.has(sid)) daysBySession.set(sid, new Set());
    daysBySession.get(sid)!.add(dayKey(ts));
  }

  const counts = Array.from(daysBySession.values(), (days) => days.size).sort(
    (a, b) => a - b,
  );

  const median = counts.length
    ? counts.length % 2 === 1
      ? counts[(counts.length - 1) / 2]!
      : Math.round(
          (counts[counts.length / 2 - 1]! + counts[counts.length / 2]!) / 2,
        )
    : 0;

  return {
    buckets: HABIT_THRESHOLDS.map((minDays) => ({
      minDays,
      installs: counts.filter((c) => c >= minDays).length,
    })),
    cohort: counts.length,
    medianActiveDays: median,
  };
}

function addDays(dayKeyStr: string, days: number): string {
  const d = new Date(`${dayKeyStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Rolling retention. A cohort for offset N is every install whose first_seen
 * day is old enough to have had a day-N chance to return AND recent enough to
 * be meaningful:
 *   - D1 cohort:     first_seen in [today-8,  today-1]
 *   - D7 cohort:     first_seen in [today-14, today-7]
 *   - week-3 cohort: first_seen in [today-28, today-21]
 *
 * D1 and D7 are EXACT-DAY: retained means an event on first_seen_day + N.
 *
 * `week3` deliberately breaks that pattern and asks for any event in days
 * 15–21 after install. Exact-day-21 would answer "did they happen to open the
 * app on that specific Tuesday", which at this volume reads as ~0 and says
 * nothing about habit. A window answers the question the product actually
 * asks: three weeks in, are they still here. The field is named `week3`
 * rather than `d21` so the different shape is visible at every call site.
 *
 * Returns absolute returned/cohort counts (the view derives the %).
 */
export function computeRetention(
  firstSeen: Array<{ session_id?: string | null; first_seen?: string | null }>,
  activity: Array<{ session_id?: string | null; created_at?: string | null }>,
  now: Date = new Date(),
): Retention {
  const activeDays = new Map<string, Set<string>>();
  for (const row of activity) {
    const sid = typeof row.session_id === "string" ? row.session_id : null;
    const ts = typeof row.created_at === "string" ? row.created_at : null;
    if (!sid || !ts) continue;
    if (!activeDays.has(sid)) activeDays.set(sid, new Set());
    activeDays.get(sid)!.add(dayKey(ts));
  }

  const todayKey = todayKeyOf(now);

  const bucket = (offset: number, minAgo: number, maxAgo: number): RetentionBucket => {
    let cohort = 0;
    let returned = 0;
    for (const row of firstSeen) {
      const sid = typeof row.session_id === "string" ? row.session_id : null;
      const fs = typeof row.first_seen === "string" ? row.first_seen : null;
      if (!sid || !fs) continue;
      const fsKey = dayKey(fs);
      const ageDays = ageInDays(fs, todayKey);
      if (ageDays < minAgo || ageDays > maxAgo) continue;
      cohort += 1;
      if (activeDays.get(sid)?.has(addDays(fsKey, offset))) returned += 1;
    }
    return { returned, cohort };
  };

  /** Same cohort rule as `bucket`, but retention is ANY event in the
   *  [fromOffset, toOffset] day range after install rather than one exact day. */
  const windowBucket = (
    fromOffset: number,
    toOffset: number,
    minAgo: number,
    maxAgo: number,
  ): RetentionBucket => {
    let cohort = 0;
    let returned = 0;
    for (const row of firstSeen) {
      const sid = typeof row.session_id === "string" ? row.session_id : null;
      const fs = typeof row.first_seen === "string" ? row.first_seen : null;
      if (!sid || !fs) continue;
      const fsKey = dayKey(fs);
      const ageDays = ageInDays(fs, todayKey);
      if (ageDays < minAgo || ageDays > maxAgo) continue;
      cohort += 1;
      const days = activeDays.get(sid);
      if (!days) continue;
      for (let offset = fromOffset; offset <= toOffset; offset += 1) {
        if (days.has(addDays(fsKey, offset))) {
          returned += 1;
          break;
        }
      }
    }
    return { returned, cohort };
  };

  return {
    d1: bucket(1, 1, 8),
    d7: bucket(7, 7, 14),
    week3: windowBucket(15, 21, 21, 28),
  };
}
