/**
 * CTA slot presentation — Sprint 1, spec docs/specs/2026-08-07-daily-cta-content-loop.md
 *
 * The ChallengeCard's primary CTA used to fabricate its own `tomorrow` state from
 * `focusPassport.todayDone`, while `content-loop.ts` kept deriving the real
 * next-best-action that nobody rendered. This module is the single translator
 * from a Content Loop variant to how the slot PRESENTS itself.
 *
 * Two natures, not one object in two health states:
 *   - `action` is a <button>. It navigates.
 *   - `status`  is a legend. It informs, and must NOT wear the button skin —
 *     a desaturated button-shaped slab reads as "broken", not as "nothing to do".
 *
 * Pure module: no React, no IO, no localStorage. Callers hydrate and pass in.
 */

import type { ContentLoopAction, ContentLoopVariant } from "@/lib/hub/content-loop";

/**
 * next-intl keys under CHALLENGE_CARD_COPY.
 *
 * ⛔ The `ctaEN`/`ctaES` strings carried by `ContentLoopAction` are deliberately
 * NOT used: they travel outside next-intl, so the whole-bundle translation
 * parity guard cannot see them. Copy lives in the bundle or it is not copy.
 */
export type CtaLabelKey =
  | "ctaStartToday"
  | "ctaClaimGift"
  | "ctaKeepTraining"
  | "ctaTryLabyrinth"
  | "ctaBeatScore"
  | "ctaNewPiece"
  | "ctaViewProgress"
  | "ctaTomorrow";

/**
 * The three destination-less variants do NOT say the same thing:
 * `come-back-tomorrow` means the player finished everything, while the two quota
 * variants mean they hit the session wall with content still left. Naming the
 * Daily at someone who just hit the training quota answers the wrong question.
 */
export type CtaNoteKey = "noteDailyReturns" | "noteTrainingResumes";

/** How the slot renders. Discriminated so a `status` can never carry a
 *  destination and an `action` can never be noteless by accident. */
export type CtaSlotPresentation =
  | {
      kind: "action";
      variant: ContentLoopVariant;
      destination: string;
      labelKey: CtaLabelKey;
      noteKey: null;
    }
  | {
      kind: "status";
      variant: ContentLoopVariant;
      destination: null;
      labelKey: CtaLabelKey;
      noteKey: CtaNoteKey;
    };

/**
 * ⚠️ TEMPORARY DEBT — Sprint 1, 2026-08-07.
 *
 * The Content Loop owns the VARIANT. It does not yet own the DESTINATION for
 * `daily-pending`: `ACTIONS["daily-pending"].destination` is `/exercises?slot=daily`,
 * and that query param had the whole daily quota switched off until 2026-08-05.
 * This sprint fixes the terminal state; it does not move the most-travelled path
 * in the product.
 *
 * The Hub adapter keeps `startFocusExerciseDestination(primaryPiece)` for these
 * variants only. Deleting this constant is the work, not a detail — it requires
 * verifying that `?slot=daily` does not reopen the quota bypass.
 * See docs/handoffs/2026-08-05-daily-quota-slot-bypass-handoff.md
 */
export const LEGACY_DESTINATION_VARIANTS = ["daily-pending"] as const;

export type LegacyDestinationVariant = (typeof LEGACY_DESTINATION_VARIANTS)[number];

/** True when the Hub adapter must override `action.destination` with the
 *  historical route instead of following the Content Loop. */
export function usesLegacyDestination(variant: ContentLoopVariant): boolean {
  return (LEGACY_DESTINATION_VARIANTS as readonly string[]).includes(variant);
}

/**
 * The single variant → presentation translator. Total over all 10 variants,
 * with no `default` branch: a new variant must fail to compile rather than
 * silently fall into a catch-all that renders the wrong nature.
 */
export function toCtaSlotPresentation(action: ContentLoopAction): CtaSlotPresentation {
  const { variant, destination } = action;

  /** Narrows the union and proves the destination exists. A variant mapped to
   *  `action` whose destination is missing would render a button that navigates
   *  nowhere — the exact defect this module removes — so it degrades to status
   *  instead of trusting the table. */
  const asAction = (labelKey: CtaLabelKey): CtaSlotPresentation =>
    destination === null
      ? { kind: "status", variant, destination: null, labelKey: "ctaTomorrow", noteKey: "noteDailyReturns" }
      : { kind: "action", variant, destination, labelKey, noteKey: null };

  const asStatus = (noteKey: CtaNoteKey): CtaSlotPresentation => ({
    kind: "status",
    variant,
    destination: null,
    labelKey: "ctaTomorrow",
    noteKey,
  });

  switch (variant) {
    case "daily-pending":
      return asAction("ctaStartToday");
    case "claim-pending":
      return asAction("ctaClaimGift");
    case "continue-path":
      return asAction("ctaKeepTraining");
    case "labyrinth-ready":
      return asAction("ctaTryLabyrinth");
    case "improve-stars":
      return asAction("ctaBeatScore");
    case "next-piece":
      return asAction("ctaNewPiece");
    case "view-progress":
      return asAction("ctaViewProgress");

    // The player hit the SESSION QUOTA, not the Daily — they already did that
    // today. Naming the Daily here answers a question they did not ask.
    case "daily-limit-reached":
    case "daily-max-reached":
      return asStatus("noteTrainingResumes");

    // Nothing actionable left. The only honest thing to say is when it returns.
    case "come-back-tomorrow":
      return asStatus("noteDailyReturns");
  }

  /* AC-8 — exhaustiveness is a COMPILER guarantee, not an intention.
   * Adding a variant to `ContentLoopVariant` without a case above leaves it
   * un-narrowed here, `never` stops accepting it, and `tsc` fails. Relying on
   * the absence of a `default` alone would not do that. */
  const exhaustive: never = variant;
  return exhaustive;
}
