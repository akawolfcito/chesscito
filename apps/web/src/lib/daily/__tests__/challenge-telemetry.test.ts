import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  emitChallengeLinkOpened,
  emitChallengeStarted,
  emitChallengeCompleted,
  emitChallengeShared,
  emitChallengeContinueToLite,
} from "../challenge-telemetry";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

import { track } from "@/lib/telemetry";

const BASE = { challengeId: "2026-06-22", puzzleId: "dt-rook-1" };
const COMMON = { isLite: true, source: "challenge_link" };

describe("challenge-telemetry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emitChallengeLinkOpened fires track with full payload", () => {
    emitChallengeLinkOpened({ ...BASE, puzzlePiece: "rook" });
    expect(track).toHaveBeenCalledWith("challenge_link_opened", {
      ...COMMON,
      challengeId: "2026-06-22",
      puzzleId: "dt-rook-1",
      puzzlePiece: "rook",
    });
  });

  it("emitChallengeStarted fires track", () => {
    emitChallengeStarted(BASE);
    expect(track).toHaveBeenCalledWith(
      "challenge_started",
      expect.objectContaining({ ...COMMON, challengeId: "2026-06-22" }),
    );
  });

  it("emitChallengeCompleted includes movesUsed", () => {
    emitChallengeCompleted({ ...BASE, movesUsed: 2 });
    expect(track).toHaveBeenCalledWith(
      "challenge_completed",
      expect.objectContaining({ ...COMMON, movesUsed: 2 }),
    );
  });

  it("emitChallengeShared fires track", () => {
    emitChallengeShared(BASE);
    expect(track).toHaveBeenCalledWith(
      "challenge_shared",
      expect.objectContaining({ ...COMMON, challengeId: "2026-06-22" }),
    );
  });

  it("emitChallengeContinueToLite fires track without puzzleId", () => {
    emitChallengeContinueToLite({ challengeId: "2026-06-22" });
    expect(track).toHaveBeenCalledWith("challenge_continue_to_lite", {
      ...COMMON,
      challengeId: "2026-06-22",
    });
  });
});
