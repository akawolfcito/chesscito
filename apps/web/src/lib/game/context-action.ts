export type ContextAction =
  | "submitScore"
  | "useShield"
  | "claimBadge"
  | "retry"
  | "connectWallet"
  | "switchNetwork"
  | null;

export type ContextActionState = {
  phase: "ready" | "success" | "failure";
  shieldsAvailable: number;
  scorePending: boolean;
  badgeClaimable: boolean;
  isConnected: boolean;
  isCorrectChain: boolean;
};

/** Reward-area actions (2026-06-10): SAVE and CLAIM are distinct functions
 *  and must NOT fight for one slot (hiding the SaveScore Peones sink behind
 *  the badge claim was losing a monetization touchpoint). Returns the
 *  reward actions that apply, ordered SAVE (primary) → CLAIM (secondary),
 *  so the UI renders one or both side by side without either hiding the
 *  other. Wallet-blocked + failure states are intentionally NOT handled
 *  here — those keep a single resolutive CTA via getContextAction. */
export type RewardAction = Extract<ContextAction, "submitScore" | "claimBadge">;

export function getRewardActions(state: ContextActionState): RewardAction[] {
  if (state.phase === "failure") return [];
  if (!state.isConnected || !state.isCorrectChain) return [];
  const actions: RewardAction[] = [];
  if (state.scorePending) actions.push("submitScore"); // SAVE first (primary)
  if (state.badgeClaimable) actions.push("claimBadge");
  return actions;
}

export function getContextAction(state: ContextActionState): ContextAction {
  // Failure recovery always takes priority
  if (state.phase === "failure") {
    if (state.isConnected && state.isCorrectChain && state.shieldsAvailable > 0) return "useShield";
    return "retry";
  }

  // Badge > Score when both available (reward before record)
  if (state.isConnected && state.isCorrectChain) {
    if (state.badgeClaimable) return "claimBadge";
    if (state.scorePending) return "submitScore";
    return null;
  }

  // Wallet-state actions: show resolutive CTA when score is pending but wallet blocks
  if (state.scorePending || state.badgeClaimable) {
    if (!state.isConnected) return "connectWallet";
    if (!state.isCorrectChain) return "switchNetwork";
  }

  return null;
}
