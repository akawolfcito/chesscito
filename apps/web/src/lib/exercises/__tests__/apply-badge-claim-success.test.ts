import { describe, expect, it, vi } from "vitest";

import {
  applyBadgeClaimSuccess,
  type BadgeClaimEffects,
  type BadgeClaimPayload,
} from "../apply-badge-claim-success";

const PAYLOAD: BadgeClaimPayload = {
  piece: "rook",
  nextPiece: "bishop",
  txHash: "0xdef",
};

function makeRecorder() {
  const calls: string[] = [];
  const effects: BadgeClaimEffects = {
    haptic: vi.fn(() => void calls.push("haptic")),
    markClaimed: vi.fn(() => void calls.push("markClaimed")),
    queueNextPieceUnlock: vi.fn(() => void calls.push("queueNextPieceUnlock")),
    showOverlay: vi.fn(() => void calls.push("showOverlay")),
  };
  return { calls, effects };
}

describe("applyBadgeClaimSuccess", () => {
  it("celebrates, marks the badge owned, queues the unlock, then shows the overlay", () => {
    const { calls, effects } = makeRecorder();
    applyBadgeClaimSuccess(effects, PAYLOAD);
    expect(calls).toEqual([
      "haptic",
      "markClaimed",
      "queueNextPieceUnlock",
      "showOverlay",
    ]);
  });

  it("marks the claimed piece and queues the following one", () => {
    const { effects } = makeRecorder();
    applyBadgeClaimSuccess(effects, PAYLOAD);
    expect(effects.markClaimed).toHaveBeenCalledWith("rook");
    expect(effects.queueNextPieceUnlock).toHaveBeenCalledWith("bishop");
  });

  it("queues no unlock when the claimed piece is the last one", () => {
    const { effects } = makeRecorder();
    applyBadgeClaimSuccess(effects, { ...PAYLOAD, piece: "king", nextPiece: null });
    expect(effects.queueNextPieceUnlock).toHaveBeenCalledWith(null);
    expect(effects.markClaimed).toHaveBeenCalledWith("king");
  });

  it("passes the txHash to the overlay", () => {
    const { effects } = makeRecorder();
    applyBadgeClaimSuccess(effects, PAYLOAD);
    expect(effects.showOverlay).toHaveBeenCalledWith("0xdef");
  });
});
