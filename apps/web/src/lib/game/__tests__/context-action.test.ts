import { describe, it } from "node:test";
import assert from "node:assert/strict";

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
    assert.equal(
      getContextAction({ ...BASE, isConnected: false }),
      null
    );
  });

  it("returns null when wrong chain and nothing pending", () => {
    assert.equal(
      getContextAction({ ...BASE, isCorrectChain: false }),
      null
    );
  });

  // ── Wallet-state actions ───────────────────────────────
  it("returns connectWallet when disconnected with score pending", () => {
    assert.equal(
      getContextAction({ ...BASE, isConnected: false, scorePending: true }),
      "connectWallet"
    );
  });

  it("returns switchNetwork when wrong chain with score pending", () => {
    assert.equal(
      getContextAction({ ...BASE, isConnected: true, isCorrectChain: false, scorePending: true }),
      "switchNetwork"
    );
  });

  it("returns connectWallet when disconnected with badge claimable", () => {
    assert.equal(
      getContextAction({ ...BASE, isConnected: false, badgeClaimable: true }),
      "connectWallet"
    );
  });

  // ── Normal gameplay ────────────────────────────────────
  it("returns null during normal gameplay (ready phase)", () => {
    assert.equal(getContextAction(BASE), null);
  });

  it("returns null during success phase (auto-advance)", () => {
    assert.equal(
      getContextAction({ ...BASE, phase: "success" }),
      null
    );
  });

  // ── Failure states ─────────────────────────────────────
  it("returns useShield on failure with shields available", () => {
    assert.equal(
      getContextAction({ ...BASE, phase: "failure", shieldsAvailable: 3 }),
      "useShield"
    );
  });

  it("returns retry on failure with no shields", () => {
    assert.equal(
      getContextAction({ ...BASE, phase: "failure", shieldsAvailable: 0 }),
      "retry"
    );
  });

  it("returns null on failure when disconnected", () => {
    assert.equal(
      getContextAction({ ...BASE, phase: "failure", isConnected: false }),
      null
    );
  });

  // ── Progression states ─────────────────────────────────
  it("returns submitScore when score is pending", () => {
    assert.equal(
      getContextAction({ ...BASE, scorePending: true }),
      "submitScore"
    );
  });

  it("returns claimBadge when badge is claimable", () => {
    assert.equal(
      getContextAction({ ...BASE, badgeClaimable: true }),
      "claimBadge"
    );
  });

  // ── Priority: claimBadge > submitScore ─────────────────
  it("prioritizes claimBadge over submitScore", () => {
    assert.equal(
      getContextAction({ ...BASE, scorePending: true, badgeClaimable: true }),
      "claimBadge"
    );
  });

  // ── Priority: failure > everything ─────────────────────
  it("prioritizes useShield over scorePending on failure", () => {
    assert.equal(
      getContextAction({
        ...BASE,
        phase: "failure",
        shieldsAvailable: 2,
        scorePending: true,
      }),
      "useShield"
    );
  });

  it("prioritizes retry over badgeClaimable on failure without shields", () => {
    assert.equal(
      getContextAction({
        ...BASE,
        phase: "failure",
        shieldsAvailable: 0,
        badgeClaimable: true,
      }),
      "retry"
    );
  });
});
