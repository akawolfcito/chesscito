/**
 * Decision: should the Coach paywall be shown to this user right now?
 *
 * Single source of truth for the gate. Server-side `/api/coach/analyze`
 * already bypasses the credit check for PRO; this helper makes the
 * client mirror that logic so we never short-circuit a paying user
 * onto the credit-purchase paywall (B1, 2026-05-07 feedback triage).
 */
export function shouldShowPaywall(input: { proActive: boolean; credits: number }): boolean {
  if (input.proActive) return false;
  return input.credits <= 0;
}
