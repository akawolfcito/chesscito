/** Routing decision for the post-game CoachPreviewCard CTA tap. Pure
 *  function so the routing rule is auditable in one place and the
 *  arena page consumer stays a thin dispatcher.
 *
 *  Spec: _bmad-output/planning-artifacts/coach-demo-redesign-discovery-2026-05-26.md §4.
 *  Pre-rewrite behavior (now removed): free users always landed on the
 *  PRO sheet even when they had unspent credits, blocking them from
 *  reaching Luz with the analyses they were already entitled to. */
export type CoachPreviewRouteAction = "ask" | "paywall";

export function routeCoachPreviewCta(input: {
  proActive: boolean;
  credits: number;
}): CoachPreviewRouteAction {
  if (input.proActive) return "ask";
  if (input.credits > 0) return "ask";
  return "paywall";
}
