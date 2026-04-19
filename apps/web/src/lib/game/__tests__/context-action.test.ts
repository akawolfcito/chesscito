import { describe, it, expect } from "vitest";

import { getContextAction } from "../context-action.js";
import type { ContextActionState } from "../context-action.js";

const BASE: ContextActionState = {
  phase: "ready",
  shieldsAvailable: 0,
  scorePending: false,
  badgeClaimable: false,
  isConnected: true,
  isCorrectChain: true,
};

describe("getContextAction", () => {
  // ── Wallet guards ──────────────────────────────────────
  it("returns null when disconnected and nothing pending", () => {
    expect(getContextAction({ ...BASE, isConnected: false })).toEqual(null);
  });

  it("returns null when wrong chain and nothing pending", () => {
    expect(getContextAction({ ...BASE, isCorrectChain: false })).toEqual(null);
  });

  // ── Wallet-state actions ───────────────────────────────
  it("returns connectWallet when disconnected with score pending", () => {
    expect(getContextAction({ ...BASE, isConnected: false, scorePending: true })).toEqual("connectWallet");
  });

  it("returns switchNetwork when wrong chain with score pending", () => {
    expect(getContextAction({ ...BASE, isConnected: true, isCorrectChain: false, scorePending: true })).toEqual("switchNetwork");
  });

  it("returns connectWallet when disconnected with badge claimable", () => {
    expect(getContextAction({ ...BASE, isConnected: false, badgeClaimable: true })).toEqual("connectWallet");
  });

  // ── Normal gameplay ────────────────────────────────────
  it("returns null during normal gameplay (ready phase)", () => {
    expect(getContextAction(BASE)).toEqual(null);
  });

  it("returns null during success phase (auto-advance)", () => {
    expect(getContextAction({ ...BASE, phase: "success" })).toEqual(null);
  });

  // ── Failure states ─────────────────────────────────────
  it("returns useShield on failure with shields available", () => {
    expect(getContextAction({ ...BASE, phase: "failure", shieldsAvailable: 3 })).toEqual("useShield");
  });

  it("returns retry on failure with no shields", () => {
    expect(getContextAction({ ...BASE, phase: "failure", shieldsAvailable: 0 })).toEqual("retry");
  });

  it("returns retry on failure when disconnected", () => {
    expect(getContextAction({ ...BASE, phase: "failure", isConnected: false })).toEqual("retry");
  });

  // ── Progression states ─────────────────────────────────
  it("returns submitScore when score is pending", () => {
    expect(getContextAction({ ...BASE, scorePending: true })).toEqual("submitScore");
  });

  it("returns claimBadge when badge is claimable", () => {
    expect(getContextAction({ ...BASE, badgeClaimable: true })).toEqual("claimBadge");
  });

  // ── Priority: claimBadge > submitScore ─────────────────
  it("prioritizes claimBadge over submitScore", () => {
    expect(getContextAction({ ...BASE, scorePending: true, badgeClaimable: true })).toEqual("claimBadge");
  });

  // ── Priority: failure > everything ─────────────────────
  it("prioritizes useShield over scorePending on failure", () => {
    expect(getContextAction({
        ...BASE,
        phase: "failure",
        shieldsAvailable: 2,
        scorePending: true,
      })).toEqual("useShield");
  });

  it("prioritizes retry over badgeClaimable on failure without shields", () => {
    expect(getContextAction({
        ...BASE,
        phase: "failure",
        shieldsAvailable: 0,
        badgeClaimable: true,
      })).toEqual("retry");
  });
});
