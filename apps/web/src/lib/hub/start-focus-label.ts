import type { ContentLoopVariant } from "@/lib/hub/content-loop";

/** The three Start Focus label intents (spec lite-hub-redesign.md, Start Focus
 *  destination matrix). Each maps to a `HUB_LITE_COPY` key. */
export type StartFocusLabelKey = "startFocus" | "continue" | "practice";

/** Content-loop variant → Start Focus label intent. The button always routes to
 *  `/exercises`; only the label changes (P1-C: the label is i18n'd from this
 *  intent, never the content-loop `ctaEN`). */
const VARIANT_TO_LABEL: Record<ContentLoopVariant, StartFocusLabelKey> = {
  "daily-pending": "startFocus",
  "claim-pending": "continue",
  "daily-limit-reached": "practice",
  "daily-max-reached": "practice",
  "continue-path": "startFocus",
  "labyrinth-ready": "continue",
  "improve-stars": "continue",
  "next-piece": "continue",
  "come-back-tomorrow": "practice",
  "view-progress": "startFocus",
};

/** Resolve the Start Focus label key from the content-loop variant. `null`
 *  (pre-hydration) falls back to the safe default `startFocus` so the button
 *  never flashes a wrong/empty label. */
export function startFocusLabelKey(
  variant: ContentLoopVariant | null,
): StartFocusLabelKey {
  if (variant === null) return "startFocus";
  return VARIANT_TO_LABEL[variant];
}
