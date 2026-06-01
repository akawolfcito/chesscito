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
  /** Whether the player has seen the primer variant A explicitly.
   *  Set by FailRescueModal on first render of variant A. Drives the
   *  A↔B switch: A only fires when shields are available AND the
   *  primer hasn't been shown yet. Replaces the legacy
   *  rescueSeenCount-based selector which surfaced B prematurely when
   *  the player's first failure was without shields (E18 from the
   *  red-team audit 2026-05-31). */
  rescuePrimerShown: boolean;
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
  const { shieldsCount, welcomePackClaimed, rescuePrimerShown } = input;
  const hasShields = shieldsCount >= 1;

  if (hasShields) {
    // Variant A = first time the player has shields available at a
    // rescue moment, with the "A Shield protects your streak" primer.
    // Variant B = compact recurring version, no primer.
    //
    // Key invariant fixed 2026-05-31 (E18 from red-team): the primer
    // tracking key is INDEPENDENT from any "modal seen" counter. A
    // player whose first failure landed on variant C (without shields)
    // bumps no primer state — when they later acquire shields and
    // fail again, they correctly land on A. Previous design bumped a
    // generic seenCount and silently skipped A in this exact scenario.
    return {
      variant: rescuePrimerShown ? "B" : "A",
      hasShields: true,
    };
  }

  // shieldsCount === 0
  //
  // Welcome Pack is once-per-wallet. Until claimed, every rescue
  // offers the pitch (C). Once claimed, C is gone (the free pack is
  // spent) and we surface the paid upsell (D).
  if (!welcomePackClaimed) {
    return { variant: "C", hasShields: false };
  }

  return { variant: "D", hasShields: false };
}
