import { describe, expect, it, vi } from "vitest";

import {
  applyScoreSaveSuccess,
  type ScoreSaveEffects,
  type ScoreSavePayload,
} from "../apply-score-save-success";

const PAYLOAD: ScoreSavePayload = {
  piece: "rook",
  score: 2400,
  timeMs: 18_000,
  levelId: 1,
  player: "0x1111111111111111111111111111111111111111",
  txHash: "0xabc",
};

/** Records the effect names in call order. The ORDER is the contract here:
 *  asserting only the final state would pass against a sequencer that wrote
 *  the remote cache before the local truth. */
function makeRecorder() {
  const calls: string[] = [];
  const effects: ScoreSaveEffects = {
    recordSaveFor: vi.fn(() => void calls.push("recordSaveFor")),
    writeOptimisticScore: vi.fn(() => void calls.push("writeOptimisticScore")),
    cacheScore: vi.fn(() => void calls.push("cacheScore")),
    refreshLeaderboard: vi.fn(() => void calls.push("refreshLeaderboard")),
    showOverlay: vi.fn(() => void calls.push("showOverlay")),
    startDoneHold: vi.fn(() => void calls.push("startDoneHold")),
  };
  return { calls, effects };
}

describe("applyScoreSaveSuccess", () => {
  it("runs local truth, then the optimistic hint, then the remote write-through, then UI", () => {
    const { calls, effects } = makeRecorder();
    applyScoreSaveSuccess(effects, PAYLOAD);
    expect(calls).toEqual([
      "recordSaveFor",
      "writeOptimisticScore",
      "cacheScore",
      "refreshLeaderboard",
      "showOverlay",
      "startDoneHold",
    ]);
  });

  it("persists under the piece captured at broadcast, not a later selection", () => {
    const { effects } = makeRecorder();
    applyScoreSaveSuccess(effects, { ...PAYLOAD, piece: "bishop" });
    expect(effects.recordSaveFor).toHaveBeenCalledWith("bishop", 2400, "0xabc");
  });

  it("hands /api/cache-score the receipt-backed txHash", () => {
    const { effects } = makeRecorder();
    applyScoreSaveSuccess(effects, PAYLOAD);
    expect(effects.cacheScore).toHaveBeenCalledWith({
      player: PAYLOAD.player,
      levelId: PAYLOAD.levelId,
      score: PAYLOAD.score,
      timeMs: PAYLOAD.timeMs,
      txHash: PAYLOAD.txHash,
    });
  });

  it("keys the done-hold on the txHash so each save gets its own window", () => {
    const { effects } = makeRecorder();
    applyScoreSaveSuccess(effects, PAYLOAD);
    expect(effects.startDoneHold).toHaveBeenCalledWith("0xabc");
  });
});
