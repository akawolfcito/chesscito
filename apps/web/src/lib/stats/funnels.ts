import {
  ACTIVATION_FUNNEL,
  canonicalEventFor,
  type CanonicalEvent,
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

export function computeActivation(
  rows: Array<{ event?: string | null; session_id?: string | null }>,
): ActivationFunnel {
  const byStep = new Map<CanonicalEvent, Set<string>>();
  for (const step of ACTIVATION_FUNNEL) byStep.set(step, new Set());
  for (const row of rows) {
    const event = typeof row.event === "string" ? row.event : null;
    const sid = typeof row.session_id === "string" ? row.session_id : null;
    if (!event || !sid) continue;
    const canonical = canonicalEventFor(event);
    if (canonical) byStep.get(canonical)!.add(sid);
  }
  return ACTIVATION_FUNNEL.map((step) => ({
    step,
    sessions: byStep.get(step)!.size,
  }));
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
export type Retention = { d1: RetentionBucket; d7: RetentionBucket };

function dayKey(ts: string): string {
  return ts.slice(0, 10);
}

function addDays(dayKeyStr: string, days: number): string {
  const d = new Date(`${dayKeyStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Rolling D1/D7 retention. A cohort for offset N is every install whose
 * first_seen day is old enough to have had a day-N chance to return AND recent
 * enough to be meaningful:
 *   - D1 cohort: first_seen in [today-8, today-1]
 *   - D7 cohort: first_seen in [today-14, today-7]
 * An install is "retained at N" if it produced ANY event on
 * first_seen_day + N (exact calendar day, UTC). Returns absolute
 * returned/cohort counts per offset (the view derives the %).
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

  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);

  const bucket = (offset: number, minAgo: number, maxAgo: number): RetentionBucket => {
    let cohort = 0;
    let returned = 0;
    for (const row of firstSeen) {
      const sid = typeof row.session_id === "string" ? row.session_id : null;
      const fs = typeof row.first_seen === "string" ? row.first_seen : null;
      if (!sid || !fs) continue;
      const fsKey = dayKey(fs);
      const ageDays = Math.round(
        (Date.parse(`${todayKey}T00:00:00.000Z`) -
          Date.parse(`${fsKey}T00:00:00.000Z`)) /
          86_400_000,
      );
      if (ageDays < minAgo || ageDays > maxAgo) continue;
      cohort += 1;
      if (activeDays.get(sid)?.has(addDays(fsKey, offset))) returned += 1;
    }
    return { returned, cohort };
  };

  return {
    d1: bucket(1, 1, 8),
    d7: bucket(7, 7, 14),
  };
}
