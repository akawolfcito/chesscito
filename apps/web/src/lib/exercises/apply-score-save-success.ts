/**
 * The effect sequence that a CONFIRMED on-chain score save is allowed to run.
 *
 * Extracted from `<ExercisesScreen>` so the ORDER is assertable. Previously
 * these effects were spread across a broadcast-time handler and a
 * `useWaitForTransactionReceipt().isSuccess` effect — and `isSuccess` means
 * "the query resolved", not "the tx succeeded". A reverted save therefore
 * persisted locally and wrote through to the Supabase leaderboard.
 *
 * Nothing in here may be called before `receipt.status === "success"`.
 */

export type ScoreSavePayload = {
  /** Captured at broadcast, not read at receipt time: the player may have
   *  switched the piece selector while the tx was in flight. */
  piece: string;
  score: number;
  timeMs: number;
  levelId: number;
  player: string;
  txHash: string;
};

export type CacheScorePayload = {
  player: string;
  levelId: number;
  score: number;
  timeMs: number;
  txHash: string;
};

export type OptimisticScore = {
  player: string;
  score: number;
  levelId: number;
  ts: number;
};

export type ScoreSaveEffects = {
  recordSaveFor: (piece: string, score: number, txHash: string) => void;
  writeOptimisticScore: (entry: OptimisticScore) => void;
  /** Fire-and-forget POST to /api/cache-score. Its silent-failure handling is
   *  a known, deferred gap — but it must not run before the receipt. */
  cacheScore: (payload: CacheScorePayload) => void;
  refreshLeaderboard: () => void;
  showOverlay: (txHash: string) => void;
  startDoneHold: (txHash: string) => void;
};

/** Local truth, then the optimistic hint, then the remote write-through, then
 *  the UI. The order is the contract: the leaderboard must never learn about a
 *  score this device has not yet committed to. */
export function applyScoreSaveSuccess(
  effects: ScoreSaveEffects,
  payload: ScoreSavePayload,
): void {
  const { piece, score, timeMs, levelId, player, txHash } = payload;

  effects.recordSaveFor(piece, score, txHash);
  effects.writeOptimisticScore({
    player: player.toLowerCase(),
    score,
    levelId,
    ts: Date.now(),
  });
  effects.cacheScore({ player, levelId, score, timeMs, txHash });
  effects.refreshLeaderboard();
  effects.showOverlay(txHash);
  effects.startDoneHold(txHash);
}
