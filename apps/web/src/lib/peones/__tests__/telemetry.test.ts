/**
 * Tests for Peones client-side telemetry emitters added in Sprint 3
 * commit H (Training Economy Alpha 2026-06-07). Pure emit wrappers
 * — track() is mocked, payload shape is the only contract.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

import { track } from "@/lib/telemetry";
import {
  emitPeonesBalanceViewed,
  emitPeonesCapReached,
  emitPeonesEarned,
  emitPeonesSpendBlocked,
  emitPeonesSpendBypassed,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";

const mockTrack = vi.mocked(track);

beforeEach(() => {
  mockTrack.mockClear();
});

describe("emitPeonesEarned", () => {
  it("emits peones_earned with the canonical payload (daily-family success)", () => {
    emitPeonesEarned({
      source: "daily_tactic",
      sourceId: "dt-queen-2",
      requested: 3,
      credited: 3,
      capReached: false,
      newBalance: 12,
      dailyEarnedCapped: 3,
      dailyCap: 10,
      attestationHash: "sha256:aaa",
      duplicate: false,
    });
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("peones_earned", {
      source: "daily_tactic",
      sourceId: "dt-queen-2",
      requested: 3,
      credited: 3,
      capReached: false,
      newBalance: 12,
      dailyEarnedCapped: 3,
      dailyCap: 10,
      attestationHash: "sha256:aaa",
      duplicate: false,
    });
  });

  it("emits the same shape for exercise_completion (no cap impact)", () => {
    emitPeonesEarned({
      source: "exercise_completion",
      sourceId: "rook:rook-4",
      requested: 2,
      credited: 2,
      capReached: false,
      newBalance: 14,
      dailyEarnedCapped: 3,
      dailyCap: 10,
      attestationHash: "sha256:bbb",
      duplicate: false,
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "peones_earned",
      expect.objectContaining({
        source: "exercise_completion",
        sourceId: "rook:rook-4",
        credited: 2,
        capReached: false,
      }),
    );
  });

  it("carries the duplicate flag verbatim", () => {
    emitPeonesEarned({
      source: "daily_tactic",
      sourceId: "dt-queen-2",
      requested: 3,
      credited: 3,
      capReached: false,
      newBalance: 12,
      dailyEarnedCapped: 3,
      dailyCap: 10,
      attestationHash: "sha256:aaa",
      duplicate: true,
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "peones_earned",
      expect.objectContaining({ duplicate: true }),
    );
  });
});

describe("emitPeonesCapReached", () => {
  it("emits with the canonical payload (partial credit + cap reached)", () => {
    emitPeonesCapReached({
      source: "daily_tactic",
      sourceId: "dt-queen-2",
      requested: 3,
      credited: 2,
      dailyEarnedCapped: 10,
      dailyCap: 10,
    });
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("peones_cap_reached", {
      source: "daily_tactic",
      sourceId: "dt-queen-2",
      requested: 3,
      credited: 2,
      dailyEarnedCapped: 10,
      dailyCap: 10,
    });
  });

  it("emits with credited:0 for the fully-exhausted branch", () => {
    emitPeonesCapReached({
      source: "daily_tactic",
      sourceId: "dt-queen-2",
      requested: 3,
      credited: 0,
      dailyEarnedCapped: 10,
      dailyCap: 10,
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "peones_cap_reached",
      expect.objectContaining({ credited: 0 }),
    );
  });
});

describe("emitPeonesBalanceViewed", () => {
  it("emits with the surface label and balance snapshot", () => {
    emitPeonesBalanceViewed({
      balance: 12,
      dailyEarnedCapped: 3,
      dailyCap: 10,
      surface: "hub",
    });
    expect(mockTrack).toHaveBeenCalledWith("peones_balance_viewed", {
      balance: 12,
      dailyEarnedCapped: 3,
      dailyCap: 10,
      surface: "hub",
    });
  });

  it.each(["hub", "exercises", "coach", "arena"] as const)(
    "supports surface=%s for future cluster mounts",
    (surface) => {
      emitPeonesBalanceViewed({
        balance: 5,
        dailyEarnedCapped: 0,
        dailyCap: 10,
        surface,
      });
      expect(mockTrack).toHaveBeenCalledWith(
        "peones_balance_viewed",
        expect.objectContaining({ surface }),
      );
    },
  );
});

describe("emitPeonesSpent — Sprint 4 commit D", () => {
  it("emits peones_spent with the canonical payload", () => {
    emitPeonesSpent({
      target: "hint",
      targetId: "rook:r-1:3",
      requested: 1,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      duplicate: false,
      proBypassApplied: false,
    });
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("peones_spent", {
      target: "hint",
      targetId: "rook:r-1:3",
      requested: 1,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      duplicate: false,
      proBypassApplied: false,
    });
  });

  it("preserves duplicate flag verbatim", () => {
    emitPeonesSpent({
      target: "coach",
      targetId: "game-42",
      requested: 1,
      debited: 1,
      newBalance: 5,
      attestationHash: "sha256:def",
      duplicate: true,
      proBypassApplied: false,
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "peones_spent",
      expect.objectContaining({ duplicate: true }),
    );
  });

  it("carries proBypassApplied through (commit G will set true)", () => {
    emitPeonesSpent({
      target: "shield",
      targetId: "5",
      requested: 5,
      debited: 0,
      newBalance: 8,
      attestationHash: "sha256:ghi",
      duplicate: false,
      proBypassApplied: true,
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "peones_spent",
      expect.objectContaining({ proBypassApplied: true, debited: 0 }),
    );
  });
});

describe("emitPeonesSpendBlocked — Sprint 4 commit D", () => {
  it("emits peones_spend_blocked with reason insufficient_balance", () => {
    emitPeonesSpendBlocked({
      target: "hint",
      targetId: "rook:r-1:3",
      requested: 1,
      reason: "insufficient_balance",
    });
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("peones_spend_blocked", {
      target: "hint",
      targetId: "rook:r-1:3",
      requested: 1,
      reason: "insufficient_balance",
    });
  });
});

describe("emitPeonesSpendFailed — Sprint 4 commit D", () => {
  it("emits peones_spend_failed with a freeform reason string", () => {
    emitPeonesSpendFailed({
      target: "coach",
      targetId: "game-42",
      requested: 1,
      reason: "network",
    });
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("peones_spend_failed", {
      target: "coach",
      targetId: "game-42",
      requested: 1,
      reason: "network",
    });
  });

  it.each([
    "network",
    "bad_response",
    "ledger_write_failed",
    "ledger_unavailable",
    "rate_limited",
    "invalid_input",
  ] as const)("forwards reason=%s verbatim", (reason) => {
    emitPeonesSpendFailed({
      target: "hint",
      targetId: "rook:r-1:3",
      requested: 1,
      reason,
    });
    expect(mockTrack).toHaveBeenLastCalledWith(
      "peones_spend_failed",
      expect.objectContaining({ reason }),
    );
  });
});

describe("emitPeonesSpendBypassed — Sprint 4 commit G", () => {
  it("emits peones_spend_bypassed with the canonical payload", () => {
    emitPeonesSpendBypassed({
      target: "coach",
      targetId: "game-42",
      requested: 1,
      debited: 0,
      newBalance: 7,
      attestationHash: "sha256:bypass-1",
      quotaUsed: 3,
      quotaLimit: 5,
    });
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("peones_spend_bypassed", {
      target: "coach",
      targetId: "game-42",
      requested: 1,
      debited: 0,
      newBalance: 7,
      attestationHash: "sha256:bypass-1",
      proBypassApplied: true,
      quotaUsed: 3,
      quotaLimit: 5,
    });
  });

  it.each([
    ["coach", 5],
    ["hint", 20],
    ["shield", 0],
  ] as const)(
    "forwards target=%s with quotaLimit=%i",
    (target, quotaLimit) => {
      emitPeonesSpendBypassed({
        target,
        targetId: "id",
        requested: 1,
        debited: 0,
        newBalance: 0,
        attestationHash: "sha256:x",
        quotaUsed: 1,
        quotaLimit,
      });
      expect(mockTrack).toHaveBeenLastCalledWith(
        "peones_spend_bypassed",
        expect.objectContaining({ target, quotaLimit }),
      );
    },
  );
});
