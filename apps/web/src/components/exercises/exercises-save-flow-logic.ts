import type { ContextAction } from "@/lib/game/context-action";
import type { WelcomePackTileState } from "@/components/exercises/welcome-pack-tile";

/**
 * True when the post-3-stars "Connect to save" prompt should fire.
 * Suppressed in Lite: score-save is local-only and needs no wallet gate.
 */
export function shouldFireStarsConnectPrompt(opts: {
  isConnected: boolean;
  liteMode: boolean;
  stars: number;
}): boolean {
  return !opts.isConnected && !opts.liteMode && opts.stars === 3;
}

/**
 * True when the local-save "Saved" toast should fire after exercise completion.
 * Guard: labyrinth completions have their own overlay and must not receive it.
 * This function is called inside autoReset.schedule(..., 1500) in both the
 * normal-advance path and the badge-earned path — never synchronously on
 * completeExercise() (spec P0-2).
 */
export function shouldFireLocalSavedToast(opts: {
  labyrinthMode: boolean;
}): boolean {
  return !opts.labyrinthMode;
}

/**
 * True when the Welcome Pack inline CTA should occupy the contextual slot.
 * Lite-only, idle slot (contextAction===null), after client hydration, and
 * while pack is not yet claimed. Badge actions exclude themselves via
 * contextAction (getContextAction returns "claimBadge" when badgeClaimable).
 */
export function shouldShowWPCtaInSlot(opts: {
  liteMode: boolean;
  contextAction: ContextAction | null;
  wpMounted: boolean;
  wpState: WelcomePackTileState;
}): boolean {
  return (
    opts.liteMode &&
    opts.contextAction === null &&
    opts.wpMounted &&
    opts.wpState !== "claimed"
  );
}
