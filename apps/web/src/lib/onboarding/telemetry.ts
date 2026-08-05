/**
 * Tour → first activity: the experiment's events.
 *
 * 🔒 PRIVACY — hard invariant. Nothing here carries a wallet address, an email,
 * a custom name, or any free text. Every payload is a fixed enum plus the
 * surface. `track()` already attaches the anonymous install id; this module
 * must never add a second identifier.
 *
 * Naming: the events that describe the EXPERIMENT are new, because nothing
 * existed to describe them. The events that describe the ACTIVITY are NOT —
 * the first action, the completion and the streak all keep firing from
 * `hub-daily-tile.tsx` exactly as they do for control (`daily_tactic_started`,
 * `daily_tactic_completed`). Duplicating them under onboarding names would
 * double-count Daily completions for the variant arm and make the two groups
 * incomparable in the very metric the experiment is judged on.
 */

import { track } from "@/lib/telemetry";
import {
  ONBOARDING_EXPERIMENT_SURFACE,
  type OnboardingVariant,
} from "./first-activity-experiment";

type Base = { variant: OnboardingVariant };

function payload<T extends object>(base: Base, extra?: T) {
  return {
    variant: base.variant,
    surface: ONBOARDING_EXPERIMENT_SURFACE,
    ...(extra ?? {}),
  };
}

/**
 * Fires once per install, at the moment the tour finishes and the group is
 * resolved. Emitted for BOTH arms — a control arm you cannot see is a control
 * arm you cannot compare against.
 */
export function emitOnboardingVariantAssigned(args: {
  variant: OnboardingVariant;
  outcome: "completed" | "skipped";
}): void {
  track("onboarding_variant_assigned", payload(args, { outcome: args.outcome }));
}

/** The variant asked for the activity. Precedes `ready` or `failed`; the gap
 *  between this and `ready` is the "time to first activity" the experiment
 *  exists to shorten. */
export function emitOnboardingActivityRequested(args: {
  variant: OnboardingVariant;
  activity: "daily-focus";
}): void {
  track(
    "onboarding_activity_requested",
    payload(args, { activity: args.activity }),
  );
}

/** The activity is on screen and playable. */
export function emitOnboardingActivityReady(args: {
  variant: OnboardingVariant;
  activity: "daily-focus";
}): void {
  track("onboarding_activity_ready", payload(args, { activity: args.activity }));
}

/**
 * The activity could not be presented, and the player was left on the hub.
 *
 * `reason` is a closed enum on purpose — an error message would be free text
 * from a third party and could carry anything.
 */
export function emitOnboardingActivityFailed(args: {
  variant: OnboardingVariant;
  activity: "daily-focus";
  reason: "not-ready" | "no-puzzle" | "already-done" | "unknown";
}): void {
  track(
    "onboarding_activity_failed",
    payload(args, { activity: args.activity, reason: args.reason }),
  );
}

/** The explicit fallback: the hub is what the player got instead. Emitted
 *  beside `activity_failed`, never instead of it — one says what broke, the
 *  other says what the player saw. */
export function emitOnboardingFallbackToHub(args: {
  variant: OnboardingVariant;
  reason: "not-ready" | "no-puzzle" | "already-done" | "unknown";
}): void {
  track("onboarding_fallback_to_hub", payload(args, { reason: args.reason }));
}

/**
 * The closing screen is actually on screen — reward or progress visible, with
 * somewhere to go next.
 *
 * ⚠️ NOT `daily_streak_updated`. That one is emitted from the same block as the
 * completion (`lib/daily/telemetry.ts:118`), so using it as a proxy would
 * measure the completion a second time under a different name and invent a
 * distinction that does not exist (handoff 2026-08-05, "Grupo 5").
 */
export function emitOnboardingClosureShown(args: {
  variant: OnboardingVariant;
  closure: "first-focus-day" | "streak";
}): void {
  track("onboarding_closure_shown", payload(args, { closure: args.closure }));
}

/**
 * The player is on the hub AFTER the activity — the end of the variant's path.
 *
 * Distinct from `hub_view`, which fires on arrival and would be
 * indistinguishable from the control arm's landing.
 */
export function emitOnboardingHubReached(args: {
  variant: OnboardingVariant;
  /** Whether the activity was finished before landing here. Separates "played
   *  and moved on" from "dismissed the sheet". */
  completedActivity: boolean;
}): void {
  track(
    "onboarding_hub_reached",
    payload(args, { completed_activity: args.completedActivity }),
  );
}
