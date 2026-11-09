import { describe, it, expect } from "vitest";

import { getContextAction, getRewardActions } from "../context-action.js";
import type { ContextActionState } from "../context-action.js";

const BASE: ContextActionState = {
  phase: "ready",
  shieldsAvailable: 0,
  scorePending: false,
  badgeClaimable: false,
  isConnected: true,
  isCorrectChain: true,
};

describe("getRewardActions — CLAIM is the only reward pin (SAVE removed, Lote 2 F1)", () => {
  it("scorePending only → [] (off-chain save auto-runs, no SAVE pin)", () => {
    expect(getRewardActions({ ...BASE, scorePending: true })).toEqual([]);
  });

  it("badgeClaimable only → [claimBadge]", () => {
    expect(getRewardActions({ ...BASE, badgeClaimable: true })).toEqual([
      "claimBadge",
    ]);
  });

  it("both scorePending + badge → [claimBadge] (no SAVE pin)", () => {
    expect(
      getRewardActions({ ...BASE, scorePending: true, badgeClaimable: true }),
    ).toEqual(["claimBadge"]);
  });

  it("neither → []", () => {
    expect(getRewardActions(BASE)).toEqual([]);
  });

  it("returns [] in the failure phase (failure has its own single CTA)", () => {
    expect(
      getRewardActions({ ...BASE, phase: "failure", scorePending: true, badgeClaimable: true }),
    ).toEqual([]);
  });

  it("returns [] when wallet-blocked (single connect/switch CTA path owns it)", () => {
    expect(
      getRewardActions({ ...BASE, isConnected: false, scorePending: true, badgeClaimable: true }),
    ).toEqual([]);
    expect(
      getRewardActions({ ...BASE, isCorrectChain: false, scorePending: true }),
    ).toEqual([]);
  });
});

// ── liteMode tests ────────────────────────────────────────────────────────

describe("getRewardActions — liteMode=true", () => {
  it("never returns submitScore when liteMode=true (scorePendingOnly)", () => {
    expect(getRewardActions({ ...BASE, scorePending: true }, { liteMode: true })).toEqual([]);
  });

  it("never returns submitScore when liteMode=true (both scorePending + badge)", () => {
    expect(
      getRewardActions({ ...BASE, scorePending: true, badgeClaimable: true }, { liteMode: true }),
    ).toEqual(["claimBadge"]);
  });

  it("still returns claimBadge when liteMode=true and badge claimable", () => {
    expect(getRewardActions({ ...BASE, badgeClaimable: true }, { liteMode: true })).toEqual([
      "claimBadge",
    ]);
  });

  it("returns [] when liteMode=true and nothing pending", () => {
    expect(getRewardActions(BASE, { liteMode: true })).toEqual([]);
  });

  it("Full (liteMode=false) also has no SAVE pin for a pending score → []", () => {
    expect(getRewardActions({ ...BASE, scorePending: true }, { liteMode: false })).toEqual([]);
  });
});

describe("getContextAction — liteMode=true", () => {
  it("returns null when scorePendingOnly + disconnected (no connectWallet for score in Lite)", () => {
    expect(
      getContextAction({ ...BASE, isConnected: false, scorePending: true }, { liteMode: true }),
    ).toEqual(null);
  });

  it("returns null when scorePendingOnly + connected (no submitScore in Lite)", () => {
    expect(
      getContextAction({ ...BASE, scorePending: true }, { liteMode: true }),
    ).toEqual(null);
  });

  it("returns connectWallet when badgeClaimable + disconnected (badge needs wallet)", () => {
    expect(
      getContextAction({ ...BASE, isConnected: false, badgeClaimable: true }, { liteMode: true }),
    ).toEqual("connectWallet");
  });

  it("returns switchNetwork when badgeClaimable + wrongChain (badge needs chain)", () => {
    expect(
      getContextAction(
        { ...BASE, isConnected: true, isCorrectChain: false, badgeClaimable: true },
        { liteMode: true },
      ),
    ).toEqual("switchNetwork");
  });

  it("returns claimBadge when badgeClaimable + connected + correctChain", () => {
    expect(
      getContextAction({ ...BASE, badgeClaimable: true }, { liteMode: true }),
    ).toEqual("claimBadge");
  });

  it("badge path wins over score when both pending in Lite", () => {
    expect(
      getContextAction({ ...BASE, scorePending: true, badgeClaimable: true }, { liteMode: true }),
    ).toEqual("claimBadge");
  });

  it("returns null when badgeClaimable + scorePendingNew but disconnected AND only score pending (no badge)", () => {
    expect(
      getContextAction(
        { ...BASE, isConnected: false, scorePending: true, badgeClaimable: false },
        { liteMode: true },
      ),
    ).toEqual(null);
  });

  it("failure phase: retry/useShield unchanged in liteMode", () => {
    expect(
      getContextAction({ ...BASE, phase: "failure", shieldsAvailable: 2 }, { liteMode: true }),
    ).toEqual("useShield");
    expect(
      getContextAction({ ...BASE, phase: "failure", shieldsAvailable: 0 }, { liteMode: true }),
    ).toEqual("retry");
  });

  it("Full (liteMode=false) — a pending score yields null when connected (no SAVE pin)", () => {
    expect(
      getContextAction({ ...BASE, scorePending: true }, { liteMode: false }),
    ).toEqual(null);
  });

  it("Full behavior unchanged — connectWallet for score when disconnected", () => {
    expect(
      getContextAction({ ...BASE, isConnected: false, scorePending: true }, { liteMode: false }),
    ).toEqual("connectWallet");
  });
});

// ── Original tests ────────────────────────────────────────────────────────

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
  it("returns null for a pending score when connected (SAVE pin removed, save auto-runs)", () => {
    expect(getContextAction({ ...BASE, scorePending: true })).toEqual(null);
  });

  it("returns claimBadge when badge is claimable", () => {
    expect(getContextAction({ ...BASE, badgeClaimable: true })).toEqual("claimBadge");
  });

  // ── claimBadge still wins the connected path ───────────
  it("returns claimBadge when both a score is pending and a badge is claimable", () => {
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
