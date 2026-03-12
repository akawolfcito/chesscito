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
  it("returns null when wallet is disconnected", () => {
    assert.equal(
      getContextAction({ ...BASE, phase: "failure", isConnected: false }),
      null
    );
  });

  it("returns null when on wrong chain", () => {
    assert.equal(
      getContextAction({ ...BASE, phase: "failure", isCorrectChain: false }),
      null
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

  // ── Priority: scorePending > badgeClaimable ────────────
  it("prioritizes submitScore over claimBadge", () => {
    assert.equal(
      getContextAction({ ...BASE, scorePending: true, badgeClaimable: true }),
      "submitScore"
    );
  });

  // ── Priority: failure > scorePending ───────────────────
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
