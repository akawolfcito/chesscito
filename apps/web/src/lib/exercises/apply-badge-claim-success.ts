/**
 * The effect sequence a CONFIRMED badge claim is allowed to run.
 *
 * The claim handler used to fire all of this the moment `writeContractAsync`
 * returned a hash. A tx that mined and reverted produced the full celebration
 * and left `justClaimed` true for a badge the player does not own.
 *
 * Nothing in here may be called before `receipt.status === "success"`.
 */

export type BadgeClaimPayload = {
  piece: string;
  /** The piece unlocked by this claim, or null when the claimed piece is last. */
  nextPiece: string | null;
  txHash: string;
};

export type BadgeClaimEffects = {
  haptic: () => void;
  markClaimed: (piece: string) => void;
  queueNextPieceUnlock: (next: string | null) => void;
  showOverlay: (txHash: string) => void;
};

export function applyBadgeClaimSuccess(
  effects: BadgeClaimEffects,
  payload: BadgeClaimPayload,
): void {
  effects.haptic();
  effects.markClaimed(payload.piece);
  effects.queueNextPieceUnlock(payload.nextPiece);
  effects.showOverlay(payload.txHash);
}
