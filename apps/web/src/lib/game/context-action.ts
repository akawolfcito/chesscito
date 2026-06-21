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

export type ContextActionOptions = {
  /** When true, score save actions are suppressed (submitScore, and
   *  connectWallet/switchNetwork triggered solely by a pending score).
   *  Badge claim path (claimBadge, connectWallet for badge, switchNetwork
   *  for badge) is preserved — badge claim is valid in Lite.
   *  Default false → Full behavior unchanged. */
  liteMode?: boolean;
};

/** Reward-area actions (2026-06-10): SAVE and CLAIM are distinct functions
 *  and must NOT fight for one slot. In liteMode, submitScore is suppressed;
 *  claimBadge remains valid. */
export type RewardAction = Extract<ContextAction, "submitScore" | "claimBadge">;

export function getRewardActions(
  state: ContextActionState,
  options?: ContextActionOptions,
): RewardAction[] {
  if (state.phase === "failure") return [];
  if (!state.isConnected || !state.isCorrectChain) return [];
  const actions: RewardAction[] = [];
  if (state.scorePending && !options?.liteMode) actions.push("submitScore");
  if (state.badgeClaimable) actions.push("claimBadge");
  return actions;
}

export function getContextAction(
  state: ContextActionState,
  options?: ContextActionOptions,
): ContextAction {
  const liteMode = options?.liteMode ?? false;

  // Failure recovery always takes priority — unchanged in liteMode
  if (state.phase === "failure") {
    if (state.isConnected && state.isCorrectChain && state.shieldsAvailable > 0) return "useShield";
    return "retry";
  }

  // In liteMode: badge path is the only on-chain action.
  // Score save (submitScore / connectWallet for score / switchNetwork for score)
  // is suppressed. connectWallet/switchNetwork are preserved ONLY when badge is pending.
  if (liteMode) {
    if (state.isConnected && state.isCorrectChain) {
      if (state.badgeClaimable) return "claimBadge";
      return null; // submitScore suppressed
    }
    // Wallet-state actions only when badge is pending
    if (state.badgeClaimable) {
      if (!state.isConnected) return "connectWallet";
      if (!state.isCorrectChain) return "switchNetwork";
    }
    return null; // scorePendingOnly → null in Lite
  }

  // Full behavior (liteMode=false)
  if (state.isConnected && state.isCorrectChain) {
    if (state.badgeClaimable) return "claimBadge";
    if (state.scorePending) return "submitScore";
    return null;
  }

  if (state.scorePending || state.badgeClaimable) {
    if (!state.isConnected) return "connectWallet";
    if (!state.isCorrectChain) return "switchNetwork";
  }

  return null;
}
