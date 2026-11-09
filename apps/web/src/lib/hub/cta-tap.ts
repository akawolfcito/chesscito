/**
 * What a CTA tap resolves to — Sprint 1, docs/specs/2026-08-07-daily-cta-content-loop.md
 *
 * Two decisions live here, and they are decisions, not rendering:
 *   1. WHERE the tap goes (including the `daily-pending` compatibility exception)
 *   2. WHICH analytics event it emits
 *
 * They sit in a pure module so the hub container cannot grow a second copy of
 * the rules, and so both can be asserted without mounting the hub.
 *
 * ⚠️ `track()` takes an untyped `event: string`, so the compiler cannot keep
 * `hub_start_focus_tap` off the wrong variant. That guarantee is behavioural —
 * see cta-tap.test.ts.
 */

import type { ContentLoopVariant } from "@/lib/hub/content-loop";
import { usesLegacyDestination } from "@/lib/hub/cta-slot";

/** Reserved for the real start. Its historical series must stay comparable:
 *  a "Claim your gift" tap counted here makes every before/after reading of
 *  this event apples-to-oranges, silently. */
const START_FOCUS_EVENT = "hub_start_focus_tap";

/** Every other actionable variant. Carries the destination because "which CTA
 *  did they tap" is only half the question; "where did it take them" is the
 *  other half, and the label alone does not answer it. */
const CONTENT_LOOP_EVENT = "hub_content_loop_cta_tap";

export type CtaTapInput = {
  variant: ContentLoopVariant;
  /** The destination the Content Loop resolved for this variant. */
  destination: string;
  /** The historical route, used only for `LEGACY_DESTINATION_VARIANTS`. */
  legacyDestination: string;
};

export type CtaTapResolution = {
  /** Where to navigate. */
  target: string;
  event: typeof START_FOCUS_EVENT | typeof CONTENT_LOOP_EVENT;
  props: Record<string, unknown>;
};

export function resolveCtaTap({
  variant,
  destination,
  legacyDestination,
}: CtaTapInput): CtaTapResolution {
  if (usesLegacyDestination(variant)) {
    // ⚠️ COMPATIBILITY EXCEPTION — Sprint 1, 2026-08-07.
    // The Content Loop owns the VARIANT, not this destination: its action points
    // at `/exercises?slot=daily`, and that query param had the whole daily quota
    // switched off until 2026-08-05. This sprint fixes the terminal state; it
    // does not move the most-travelled path in the product.
    // Deleting LEGACY_DESTINATION_VARIANTS is the work, not a detail.
    return {
      target: legacyDestination,
      event: START_FOCUS_EVENT,
      props: { variant },
    };
  }

  // The reported destination is the one actually navigated to. Reporting the
  // offered one would describe a journey nobody took.
  return {
    target: destination,
    event: CONTENT_LOOP_EVENT,
    props: { variant, destination },
  };
}
