/**
 * Kill switch for the Focus Days ledger.
 *
 * Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED 2026-07-27).
 *
 * Precedence: Redis override → env default → safe default in code (off).
 *
 * The env var alone is NOT a hot kill switch: Vercel snapshots environment
 * variables into the deployment, so changing one takes a redeploy. It is the
 * declarative deployment default. The Redis key is what turns the feature off
 * while it is misbehaving.
 *
 * Off means all of it: no ledger read, no write, no backfill, and never a
 * return of "Day N of 21".
 */

export const FOCUS_DAYS_GATE_REDIS_KEY = "focus-days-ledger:enabled";

export type FocusDaysGate = {
  enabled: boolean;
  /** Which level decided, so the log line says why and not just what. */
  source: "redis" | "env" | "default";
  /** Present only when the override existed but was not parseable. The caller
   *  logs this: a corrupt kill switch is an operational fault, and falling back
   *  silently is how it stays corrupt for a week. */
  invalidOverride?: string;
};

/**
 * Pure resolution. `override` is `null`/`undefined` both when the key is absent
 * and when the Redis read failed — an outage is "no override", never "off",
 * because a cache blip must not silently retire a shipped feature.
 */
export function resolveFocusDaysGate(
  override: string | null | undefined,
  envValue: string | undefined,
): FocusDaysGate {
  if (override !== null && override !== undefined) {
    const normalized = override.trim();
    if (normalized === "true") return { enabled: true, source: "redis" };
    if (normalized === "false") return { enabled: false, source: "redis" };
    return { enabled: false, source: "default", invalidOverride: override };
  }

  // Literal "true" only. `True`, `1` and `yes` leave it off, matching every
  // other flag in the project (see isStreakNudgeEnabled).
  if (envValue === "true") return { enabled: true, source: "env" };

  return { enabled: false, source: "default" };
}
