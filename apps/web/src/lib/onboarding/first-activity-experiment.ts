/**
 * Tour → first activity: assignment and eligibility.
 *
 * The hypothesis: the hub asks for decisions before the player has felt any
 * value, so a player who finishes the tour and lands on a grid of choices
 * leaves without doing anything. The variant drops them straight into the one
 * activity that needs no decisions — today's Daily Focus.
 *
 * ⚠️ This module deliberately contains NO storage of its own.
 *
 * Assignment is a pure function of the install id, so it is stable across
 * refresh, reentry and back-navigation without a second thing to keep in sync
 * — and a bug here can never strand a player in a group that outlives the
 * experiment. The "did we already do this" latch is the hub tour's OWN
 * localStorage key (`chesscito:hub-tour:learn:v2`), written by
 * `markHubTourSeen` in the same `finish()` that triggers the redirect: the
 * tour completes once per install, so the redirect fires once per install.
 * Adding a second latch would create two sources of truth for one fact.
 */

export type OnboardingVariant = "control" | "first-activity";

/** LEARN only, by decision (2026-08-05). PLAY keeps exactly its current flow;
 *  its tour does not even explain the Daily. Recorded on every event so the
 *  experiment can never be read across surfaces by accident. */
export const ONBOARDING_EXPERIMENT_SURFACE = "learn" as const;

/**
 * Rollout as a percentage of installs, 0–100.
 *
 * ⚠️ DEFAULT 0 — the experiment ships DARK. Unlike `isAttemptLaneEnabled`,
 * which defaults on because it was already proven end to end, this changes
 * what a brand-new player sees on their first session and has no production
 * evidence yet. Anything unparseable, negative, or over 100 also reads as 0:
 * a typo must not roll an experiment out to everyone.
 *
 * Setting it back to 0 is the immediate kill switch. It does NOT reassign
 * anyone who already saw the variant — their tour key is already written, so
 * they were never going to see it twice.
 */
export function onboardingFirstActivityRolloutPct(): number {
  const raw = process.env.NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT?.trim();
  if (!raw) return 0;
  const pct = Number(raw);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return 0;
  return Math.floor(pct);
}

/**
 * FNV-1a over the install id → a bucket in [0, 100).
 *
 * Deterministic and dependency-free. The point is not cryptographic quality,
 * it is that the same install always lands in the same bucket on every device
 * render, so a player cannot change group by refreshing.
 */
export function bucketForInstall(installId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < installId.length; i += 1) {
    hash ^= installId.charCodeAt(i);
    // FNV prime, via shifts to stay inside 32-bit int math.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}

/**
 * The group this install belongs to.
 *
 * Returns `null` when there is no install id at all — a WebView with storage
 * disabled, or the server. That is NOT "control": an install we cannot name is
 * one we cannot attribute or count, so it stays out of the experiment entirely
 * rather than silently padding the control arm.
 */
export function assignOnboardingVariant(
  installId: string,
  rolloutPct: number = onboardingFirstActivityRolloutPct(),
): OnboardingVariant | null {
  if (!installId) return null;
  if (rolloutPct <= 0) return "control";
  return bucketForInstall(installId) < rolloutPct ? "first-activity" : "control";
}

export type FirstActivityContext = {
  /** The install id from `getAnonymousId()`. Empty means unattributable. */
  installId: string;
  /** False for PLAY and for FULL — the experiment is LEARN-only. */
  isLearnSurface: boolean;
  /** True when the tour was re-opened from the settings replay. A replay must
   *  never hijack the hub of somebody who is already using the product. */
  isReplay: boolean;
  /** True when today's Daily is already done. Opening it would show the
   *  "come back tomorrow" state — a closed door, not a first activity. This is
   *  also what keeps an EXISTING player out: anyone with progress has either
   *  seen the tour already or finished today's Daily. */
  dailyAlreadyDone: boolean;
  rolloutPct?: number;
};

export type FirstActivityDecision =
  | { start: true; variant: "first-activity" }
  | {
      start: false;
      variant: OnboardingVariant | null;
      reason:
        | "not-learn"
        | "replay"
        /** No install id — unattributable, so out of the experiment entirely
         *  rather than padding the control arm. */
        | "unassigned"
        | "daily-already-done"
        | "control-arm";
    };

/**
 * Whether this tour completion should open the first activity.
 *
 * Order matters: the surface and replay checks come FIRST, so a PLAY player or
 * a replaying veteran is never even assigned a variant. Assigning them would
 * put installs into the experiment's denominator that were never eligible to
 * receive the treatment, which biases every rate computed from it.
 */
export function decideFirstActivity(
  ctx: FirstActivityContext,
): FirstActivityDecision {
  if (!ctx.isLearnSurface) {
    return { start: false, variant: null, reason: "not-learn" };
  }
  if (ctx.isReplay) {
    return { start: false, variant: null, reason: "replay" };
  }
  const variant = assignOnboardingVariant(ctx.installId, ctx.rolloutPct);
  if (variant === null) {
    return { start: false, variant: null, reason: "unassigned" };
  }
  if (ctx.dailyAlreadyDone) {
    // Still a real assignment — this install IS in the experiment and must be
    // reported, it just has nothing to be shown. Dropping it here would make
    // the control arm look artificially healthier.
    return { start: false, variant, reason: "daily-already-done" };
  }
  if (variant === "control") {
    return { start: false, variant, reason: "control-arm" };
  }
  return { start: true, variant };
}
