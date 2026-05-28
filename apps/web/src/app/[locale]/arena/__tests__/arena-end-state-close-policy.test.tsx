/**
 * Unit tests for the evaluateXClose state machine (T10).
 *
 * Imports directly from the dedicated pure-logic module (end-state-close-policy.ts)
 * rather than from page.tsx, which avoids pulling in the full React component
 * tree and all its module-level side-effects (lottie canvas, wagmi, etc.).
 */

import { describe, expect, it } from "vitest";
import { evaluateXClose } from "../end-state-close-policy";

describe("evaluateXClose state machine", () => {
  const wallet = "0x1111111111111111111111111111111111111111" as const;
  const gameId = "550e8400-e29b-41d4-a716-446655440000";

  it("persisted + wallet + gameId → push /coach/[gameId]", () => {
    expect(evaluateXClose({
      persistState: "persisted",
      claimPhase: "ready",
      walletAddress: wallet,
      gameId,
    })).toEqual({
      type: "push",
      href: `/coach/${gameId}?wallet=${wallet}`,
    });
  });

  it("guest (no wallet) → push /arena?fresh=1", () => {
    expect(evaluateXClose({
      persistState: "idle",
      claimPhase: "ready",
      walletAddress: undefined,
      gameId: undefined,
    })).toEqual({ type: "push", href: "/arena?fresh=1" });
  });

  it("persisting → set-pending (no push)", () => {
    expect(evaluateXClose({
      persistState: "persisting",
      claimPhase: "ready",
      walletAddress: wallet,
      gameId,
    })).toEqual({ type: "set-pending" });
  });

  it("failed → push /arena?fresh=1", () => {
    expect(evaluateXClose({
      persistState: "failed",
      claimPhase: "ready",
      walletAddress: wallet,
      gameId: undefined,
    })).toEqual({ type: "push", href: "/arena?fresh=1" });
  });

  it("dismissed → push /arena?fresh=1", () => {
    expect(evaluateXClose({
      persistState: "dismissed",
      claimPhase: "ready",
      walletAddress: wallet,
      gameId,
    })).toEqual({ type: "push", href: "/arena?fresh=1" });
  });

  it("claiming → noop (X locked)", () => {
    expect(evaluateXClose({
      persistState: "persisted",
      claimPhase: "claiming",
      walletAddress: wallet,
      gameId,
    })).toEqual({ type: "noop" });
  });

  it("idle (e.g., guest on win) + wallet → push /arena?fresh=1 fallback", () => {
    expect(evaluateXClose({
      persistState: "idle",
      claimPhase: "ready",
      walletAddress: wallet,
      gameId,
    })).toEqual({ type: "push", href: "/arena?fresh=1" });
  });

  it("persisted + wallet + NO gameId → push /arena?fresh=1 fallback", () => {
    expect(evaluateXClose({
      persistState: "persisted",
      claimPhase: "ready",
      walletAddress: wallet,
      gameId: undefined,
    })).toEqual({ type: "push", href: "/arena?fresh=1" });
  });
});
