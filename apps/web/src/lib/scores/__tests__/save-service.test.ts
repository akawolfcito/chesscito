/**
 * SaveScore off-chain — Slice 2: pure service helpers.
 *
 * No IO, no DB, no fetch, no localStorage. Mirrors the contract in
 * docs/specs/savescore-offchain-peones.md (Contracts SDD). The lockstep
 * test used to pin SCORE_SAVE_COST_PEONES to the server-trusted
 * save_game cost; Economy V1 retired that sink, so it now pins the
 * stronger claim that no save sink exists at all.
 */

import { describe, expect, it } from "vitest";
import {
  FREE_SCORE_SAVE_LIMIT,
  computeScoreSaveQuota,
  deriveScoreSaveId,
} from "../save-service";
import { SPEND_COST_BY_TARGET } from "../../peones/spend-service";

describe("computeScoreSaveQuota", () => {
  it("freeUsed 0 → 3 remaining, no Peones required", () => {
    const q = computeScoreSaveQuota("0xABC", 0);
    expect(q.freeLimit).toBe(3);
    expect(q.freeUsed).toBe(0);
    expect(q.freeRemaining).toBe(3);
    expect(q.requiresPeones).toBe(false);
    expect(q.costPeones).toBe(0);
  });

  it("freeUsed 2 → 1 remaining, no Peones required", () => {
    const q = computeScoreSaveQuota("0xabc", 2);
    expect(q.freeRemaining).toBe(1);
    expect(q.requiresPeones).toBe(false);
    expect(q.costPeones).toBe(0);
  });

  // MiniPay Lote 2 (2026-07-08): off-chain save is ALWAYS FREE. Beyond the
  // former free threshold there is NO paywall — never requiresPeones, cost 0.
  it("freeUsed 3 → 0 remaining but still free (no paywall)", () => {
    const q = computeScoreSaveQuota("0xabc", 3);
    expect(q.freeRemaining).toBe(0);
    expect(q.requiresPeones).toBe(false);
    expect(q.costPeones).toBe(0);
  });

  it("freeUsed > 3 → still free, never charges Peones", () => {
    const q = computeScoreSaveQuota("0xabc", 9);
    expect(q.freeRemaining).toBe(0);
    expect(q.requiresPeones).toBe(false);
    expect(q.costPeones).toBe(0);
  });

  it("negative freeUsed clamps to 0", () => {
    const q = computeScoreSaveQuota("0xabc", -3);
    expect(q.freeUsed).toBe(0);
    expect(q.freeRemaining).toBe(3);
    expect(q.requiresPeones).toBe(false);
  });

  it("NaN freeUsed clamps to 0", () => {
    const q = computeScoreSaveQuota("0xabc", Number.NaN);
    expect(q.freeUsed).toBe(0);
    expect(q.freeRemaining).toBe(3);
  });

  it("fractional freeUsed is truncated", () => {
    const q = computeScoreSaveQuota("0xabc", 2.9);
    expect(q.freeUsed).toBe(2);
    expect(q.freeRemaining).toBe(1);
  });

  it("normalises wallet to lowercase", () => {
    const q = computeScoreSaveQuota("0xDeAdBeEf", 0);
    expect(q.wallet).toBe("0xdeadbeef");
  });

  it("proActive does NOT change the result (always free either way)", () => {
    const withPro = computeScoreSaveQuota("0xabc", 5, true);
    const without = computeScoreSaveQuota("0xabc", 5, false);
    expect(withPro).toEqual(without);
    expect(withPro.requiresPeones).toBe(false);
    expect(withPro.costPeones).toBe(0);
    expect(withPro.freeLimit).toBe(3);
  });
});

describe("deriveScoreSaveId", () => {
  it("formats as `${player}:${levelId}:${gameId}` lowercased", () => {
    expect(deriveScoreSaveId("0xABC", 1, "Game-7")).toBe("0xabc:1:game-7");
  });

  it("includes levelId to avoid collisions across levels of the same game", () => {
    const lvl1 = deriveScoreSaveId("0xabc", 1, "g");
    const lvl2 = deriveScoreSaveId("0xabc", 2, "g");
    expect(lvl1).not.toBe(lvl2);
    expect(lvl1).toContain(":1:");
    expect(lvl2).toContain(":2:");
  });

  it("is deterministic / idempotent for the same inputs", () => {
    const a = deriveScoreSaveId("0xAbC", 3, "Game");
    const b = deriveScoreSaveId("0xAbC", 3, "Game");
    expect(a).toBe(b);
  });

  it("does not embed a tx hash, timestamp, or randomness", () => {
    const id = deriveScoreSaveId("0xabc", 1, "g");
    // A second derivation moments later must be byte-identical — proves
    // no Date.now()/Math.random() leaked in.
    expect(id).toBe(deriveScoreSaveId("0xabc", 1, "g"));
    expect(id).toBe("0xabc:1:g");
  });
});

describe("constant lockstep", () => {
  // The old lockstep (SCORE_SAVE_COST_PEONES === SPEND_COST_BY_TARGET
  // .save_game) died with the target. Saving has been unconditionally
  // free since 2026-07-08, so the invariant worth guarding is the
  // opposite one: nothing can charge for a save, because there is no
  // save sink to charge through.
  it("save_game is no longer a spendable target", () => {
    expect(SPEND_COST_BY_TARGET).not.toHaveProperty("save_game");
  });

  it("FREE_SCORE_SAVE_LIMIT is 3", () => {
    expect(FREE_SCORE_SAVE_LIMIT).toBe(3);
  });
});
