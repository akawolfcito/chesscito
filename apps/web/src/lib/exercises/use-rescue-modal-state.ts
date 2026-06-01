/**
 * useRescueModalState — pure deterministic state-machine selector for
 * the fail-rescue modal that mounts after PhaseFlash failure.
 *
 * Spec: _bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-
 * pack-2026-05-31.md §3.3 (modal state matrix).
 *
 * INTENTIONALLY NOT a React hook: this is a pure function exported via
 * a `use*` name to mirror the codebase convention for selectors that
 * consumers wrap in their own React state. Keeping it dependency-free
 * means commit 10 can unit-test every state transition without React
 * Testing Library or wagmi mocks.
 *
 * Inputs map to:
 *   - shieldsCount        — from useShieldsCount()
 *   - welcomePackClaimed  — from useWelcomePackClaim().state === 'claimed'
 *   - rescueSeenCount     — from localStorage 'chesscito:rescue_seen'
 *
 * The output discriminator (`variant`) drives the body copy + primary
 * CTA the FailRescueModal renders. `null` means "no modal" (used by
 * commit 8 to suppress mount during success or pre-1800ms phase).
 */

export type RescueModalVariant =
  /** A — with-shields, first encounter. Primer included. */
  | "A"
  /** B — with-shields, recurring. Compact, no primer. */
  | "B"
  /** C — without-shields, pre-claim. Pitch Welcome Pack. */
  | "C"
  /** D — without-shields, post-claim or 3+ ignores. Paid SKU upsell. */
  | "D";

export type RescueModalStateInput = {
  shieldsCount: number;
  welcomePackClaimed: boolean;
  /** Times the user dismissed the modal without using a shield, kept
   *  in localStorage. After 3 dismissals on the without-shields branch
   *  we stop pitching the Welcome Pack (the user has seen it) and
   *  graduate to the paid upsell. */
  rescueSeenCount: number;
};

export type RescueModalState = {
  variant: RescueModalVariant;
  /** Convenience: whether the user has shields to spend. The modal
   *  uses this to decide whether the primary CTA is "Use Shield"
   *  (true) or a deep link (false). Equivalent to `variant === 'A'`
   *  or `variant === 'B'` but exposed as a flag so consumers don't
   *  have to discriminate on letters. */
  hasShields: boolean;
};

/** Selector. Pure, deterministic, dependency-free. Same inputs always
 *  produce the same output. Side-effect-free → no useEffect needed
 *  inside callers; just memoize the call result with useMemo. */
export function selectRescueModalState(
  input: RescueModalStateInput,
): RescueModalState {
  const { shieldsCount, welcomePackClaimed, rescueSeenCount } = input;
  const hasShields = shieldsCount >= 1;

  if (hasShields) {
    // First-time rescue with shields → variant A with the primer line.
    // We use rescueSeenCount === 0 (not "first time with shields") so
    // a user who saw the without-shields variant first STILL gets the
    // primer the first time they have shields available — they've never
    // seen the shield mechanic explained at the rescue moment.
    return {
      variant: rescueSeenCount === 0 ? "A" : "B",
      hasShields: true,
    };
  }

  // shieldsCount === 0
  //
  // The Welcome Pack is once-per-wallet. Until the player claims it,
  // every rescue should offer the pitch — graduating to the paid SKU
  // (variant D) before claim would trap the player on the upsell
  // even though the free pack is still available.
  //
  // Earlier iteration used `rescueSeenCount >= 3` as a nag-fatigue
  // graduation gate, but that fired after just 3 failures (seenCount
  // bumps every modal mount, not every dismissal) and made variant
  // C unreachable in practice. Reverted 2026-05-31 per user
  // feedback: "me sale COMPRAR ESCUDOS y no reclamar SHIELDS".
  // rescueSeenCount is still consumed for A vs B (primer
  // suppression), just not for C/D anymore.
  if (!welcomePackClaimed) {
    return { variant: "C", hasShields: false };
  }

  // welcomePackClaimed === true → pack is gone, surface the paid
  // upsell so the player can restock.
  return { variant: "D", hasShields: false };
}
