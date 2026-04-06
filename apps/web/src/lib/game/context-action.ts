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
