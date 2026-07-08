/**
 * Pure derivation of the LEARN "Save proof" (on-chain Leaderboard Proof)
 * CTA visibility.
 *
 * Extracted from `exercises-screen.tsx` because the inline gate
 * (`scorePendingNew && scoreboardAddress != null`) shared its pending
 * flag with MiniPay Lote 2 B2's silent off-chain auto-save: the auto-save
 * reached score parity and closed `scorePendingNew`, hiding the golden
 * CTA within the latency of one POST. The on-chain proof is a separate
 * value action and must not be gated on off-chain persistence state.
 *
 * The discriminator is `lastSavedTxHash`: the off-chain save persists an
 * EMPTY hash (there is no receipt), while `submitScoreSigned` persists
 * the real one. Empty hash ⇒ saved, but not proven.
 *
 * Known caveat (accepted 2026-07-08): save state is per-device
 * localStorage, so a fresh device re-arms the CTA even when the score is
 * already on the Scoreboard. Re-proving costs gas but is otherwise
 * harmless; cross-device reconciliation (`leaderboard_full_v.has_onchain`)
 * is out of scope here.
 */

export type SaveProofInputs = {
  /** Wallet preconditions, folded upstream: address + isConnected +
   *  isCorrectChain + levelId > 0. */
  canSaveScore: boolean;
  /** A Scoreboard address resolves for the active chain. Fail-closed:
   *  without it the CTA would broadcast nowhere. */
  hasScoreboard: boolean;
  /** Stars earned for the active piece. */
  totalStars: number;
  /** Current local score for the active piece. */
  localScore: number;
  /** Last score persisted for this piece (off-chain OR on-chain). */
  lastSavedScore: number;
  /** Receipt hash of the last persisted save. Empty string for off-chain
   *  saves, null when this device has never saved. */
  lastSavedTxHash: string | null;
};

/** True when the current score is already covered by a confirmed on-chain
 *  receipt. A stale proof (player has since improved) does not count. */
export function hasOnchainProof(inputs: SaveProofInputs): boolean {
  const hasReceipt =
    inputs.lastSavedTxHash !== null && inputs.lastSavedTxHash !== "";
  return hasReceipt && inputs.lastSavedScore >= inputs.localScore;
}

/** True when the golden "Save proof" CTA should be offered. */
export function canSaveOnChain(inputs: SaveProofInputs): boolean {
  if (!inputs.canSaveScore || !inputs.hasScoreboard) return false;
  if (inputs.totalStars < 1 || inputs.localScore <= 0) return false;
  return !hasOnchainProof(inputs);
}
