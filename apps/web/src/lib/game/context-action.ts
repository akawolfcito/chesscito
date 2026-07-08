export type ContextAction =
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
  /** When true, badge claim is still valid but nothing else changes.
   *  Score save is never a manual action anymore (MiniPay Lote 2 F1:
   *  off-chain save auto-runs), so this flag no longer gates a submitScore
   *  pin. Kept for the badge-path callers.
   *  Default false. */
  liteMode?: boolean;
};

/** Reward-area actions: CLAIM (badge) is the only reward pin. The off-chain
 *  SAVE pin was removed (MiniPay Lote 2 F1) — the off-chain save auto-runs and
 *  the on-chain proof is the only explicit save CTA. */
export type RewardAction = Extract<ContextAction, "claimBadge">;

export function getRewardActions(
  state: ContextActionState,
  options?: ContextActionOptions,
): RewardAction[] {
  void options;
  if (state.phase === "failure") return [];
  if (!state.isConnected || !state.isCorrectChain) return [];
  const actions: RewardAction[] = [];
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

  // In liteMode: badge path is the only on-chain action. connectWallet/
  // switchNetwork are preserved ONLY when a badge is pending.
  if (liteMode) {
    if (state.isConnected && state.isCorrectChain) {
      if (state.badgeClaimable) return "claimBadge";
      return null;
    }
    // Wallet-state actions only when badge is pending
    if (state.badgeClaimable) {
      if (!state.isConnected) return "connectWallet";
      if (!state.isCorrectChain) return "switchNetwork";
    }
    return null; // scorePendingOnly → null in Lite
  }

  // Full behavior (liteMode=false). The off-chain SAVE pin was removed
  // (MiniPay Lote 2 F1): a pending score never yields a manual submitScore
  // action — the off-chain save auto-runs. connectWallet/switchNetwork are
  // still surfaced for a pending score so a guest is nudged to connect (which
  // then lets the auto-save persist).
  if (state.isConnected && state.isCorrectChain) {
    if (state.badgeClaimable) return "claimBadge";
    return null;
  }

  if (state.scorePending || state.badgeClaimable) {
    if (!state.isConnected) return "connectWallet";
    if (!state.isCorrectChain) return "switchNetwork";
  }

  return null;
}
