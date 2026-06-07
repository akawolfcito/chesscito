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
