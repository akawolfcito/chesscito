/**
 * Tests for the pure ledger service helpers added in Sprint 3
 * commit B (Training Economy Alpha 2026-06-07).
 *
 * All assertions are deterministic — no DB, no network, no time
 * dependence. Sprint 3 commit C (GET balance) and commit D (POST
 * earn) will integration-test the endpoint layer on top of these
 * helpers; this file pins the math + format contracts the
 * endpoints assume.
 */

import { describe, expect, it } from "vitest";

import {
  applyDailyCap,
  buildDailyStreakBonusIdempotencyKey,
  buildDailyTacticIdempotencyKey,
  buildExerciseMilestoneIdempotencyKey,
  exerciseMilestoneTier,
  EXERCISE_MILESTONE_SIZE,
  computeLedgerBalance,
  isDailyCapSource,
  normalizeWallet,
  type BalanceContributingEntry,
} from "@/lib/peones/ledger-service";
import { buildAttestationHash } from "@/lib/peones/ledger-service-server";

const W_LOWER = "0xabcdef0123456789abcdef0123456789abcdef01";
const W_UPPER = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
const W_MIXED = "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01";

describe("normalizeWallet", () => {
  it("returns a lowercase address unchanged", () => {
    expect(normalizeWallet(W_LOWER)).toBe(W_LOWER);
  });

  it("lowercases an uppercase address", () => {
    expect(normalizeWallet(W_UPPER)).toBe(W_LOWER);
  });

  it("lowercases a mixed-case address", () => {
    expect(normalizeWallet(W_MIXED)).toBe(W_LOWER);
  });

  it("throws invalid_wallet on a non-hex character", () => {
    expect(() => normalizeWallet("0xzzzz" + "0".repeat(36))).toThrow(
      "invalid_wallet",
    );
  });

  it("throws invalid_wallet when the prefix is missing", () => {
    expect(() => normalizeWallet("ab".repeat(20))).toThrow("invalid_wallet");
  });

  it("throws invalid_wallet when too short", () => {
    expect(() => normalizeWallet("0xabc")).toThrow("invalid_wallet");
  });

  it("throws invalid_wallet when too long", () => {
    expect(() => normalizeWallet(W_LOWER + "00")).toThrow("invalid_wallet");
  });

  it("throws invalid_wallet on non-string input", () => {
    // @ts-expect-error — intentional bad type to probe the guard
    expect(() => normalizeWallet(undefined)).toThrow("invalid_wallet");
  });
});

describe("computeLedgerBalance", () => {
  it("returns 0 for an empty ledger", () => {
    expect(computeLedgerBalance([])).toBe(0);
  });

  it("sums earn rows", () => {
    const entries: BalanceContributingEntry[] = [
      { event_type: "earn", amount: 3 },
      { event_type: "earn", amount: 5 },
    ];
    expect(computeLedgerBalance(entries)).toBe(8);
  });

  it("subtracts spend rows", () => {
    const entries: BalanceContributingEntry[] = [
      { event_type: "earn", amount: 10 },
      { event_type: "spend", amount: 4 },
    ];
    expect(computeLedgerBalance(entries)).toBe(6);
  });

  it("treats adjustment as positive contribution", () => {
    const entries: BalanceContributingEntry[] = [
      { event_type: "adjustment", amount: 7 },
    ];
    expect(computeLedgerBalance(entries)).toBe(7);
  });

  it("treats rollback as negative contribution", () => {
    const entries: BalanceContributingEntry[] = [
      { event_type: "earn", amount: 10 },
      { event_type: "rollback", amount: 3 },
    ];
    expect(computeLedgerBalance(entries)).toBe(7);
  });

  it("can produce a negative balance (defensive against bad migrations)", () => {
    const entries: BalanceContributingEntry[] = [
      { event_type: "spend", amount: 5 },
    ];
    expect(computeLedgerBalance(entries)).toBe(-5);
  });

  // ── PRO bypass ────────────────────────────────────────────────
  //
  // A PRO-bypassed spend is recorded for audit + quota tracking with
  // debited=0. `peones_balances`, `peones_spend` and (since migration
  // 20260721030000) `peones_balance_with_caps` all exclude it. This
  // helper is the TS twin of that rule; subtracting it here is the
  // same divergence, just in a different language.
  it("does NOT subtract a spend row flagged pro_bypass", () => {
    const entries: BalanceContributingEntry[] = [
      { event_type: "earn", amount: 10 },
      { event_type: "spend", amount: 5, pro_bypass: true },
    ];
    expect(computeLedgerBalance(entries)).toBe(10);
  });

  it("matches the migration's regression scenario: earn 10, spend 2, bypass 5 → 8", () => {
    const entries: BalanceContributingEntry[] = [
      { event_type: "earn", amount: 10 },
      { event_type: "spend", amount: 2, pro_bypass: false },
      { event_type: "spend", amount: 5, pro_bypass: true },
    ];
    // The shown balance and the spendable balance are the same number.
    // Before the fix this returned 3 while the spend RPC would still
    // let the wallet spend 8.
    expect(computeLedgerBalance(entries)).toBe(8);
  });

  it("treats an absent or null pro_bypass as a normal debit", () => {
    expect(
      computeLedgerBalance([
        { event_type: "earn", amount: 10 },
        { event_type: "spend", amount: 4 },
      ]),
    ).toBe(6);
    expect(
      computeLedgerBalance([
        { event_type: "earn", amount: 10 },
        { event_type: "spend", amount: 4, pro_bypass: null },
      ]),
    ).toBe(6);
  });

  it("never lets a bypassed spend push the balance negative", () => {
    const entries: BalanceContributingEntry[] = [
      { event_type: "spend", amount: 9, pro_bypass: true },
    ];
    expect(computeLedgerBalance(entries)).toBe(0);
  });
});

describe("exerciseMilestoneTier", () => {
  it("groups exercises in fives", () => {
    expect(EXERCISE_MILESTONE_SIZE).toBe(5);
  });

  it("pays nothing for the first four exercises", () => {
    for (const n of [0, 1, 2, 3, 4]) {
      expect(exerciseMilestoneTier(n)).toBe(0);
    }
  });

  it("reaches tier 1 exactly at the 5th", () => {
    expect(exerciseMilestoneTier(5)).toBe(1);
  });

  it("holds tier 1 through the 9th, then reaches tier 2 at the 10th", () => {
    expect(exerciseMilestoneTier(6)).toBe(1);
    expect(exerciseMilestoneTier(9)).toBe(1);
    expect(exerciseMilestoneTier(10)).toBe(2);
  });

  it("keeps stepping one tier per five thereafter", () => {
    expect(exerciseMilestoneTier(15)).toBe(3);
    expect(exerciseMilestoneTier(20)).toBe(4);
    expect(exerciseMilestoneTier(137)).toBe(27);
  });

  it("floors garbage input to tier 0 instead of throwing", () => {
    expect(exerciseMilestoneTier(-3)).toBe(0);
    expect(exerciseMilestoneTier(Number.NaN)).toBe(0);
    expect(exerciseMilestoneTier(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("applyDailyCap", () => {
  it("credits the full requested amount when there is headroom", () => {
    expect(
      applyDailyCap({
        requestedAmount: 3,
        dailyEarnedCapped: 0,
        dailyCap: 10,
      }),
    ).toEqual({
      creditedAmount: 3,
      capReached: false,
      remainingBefore: 10,
      remainingAfter: 7,
    });
  });

  it("partially truncates when the request would breach the cap", () => {
    expect(
      applyDailyCap({
        requestedAmount: 3,
        dailyEarnedCapped: 8,
        dailyCap: 10,
      }),
    ).toEqual({
      creditedAmount: 2,
      capReached: true,
      remainingBefore: 2,
      remainingAfter: 0,
    });
  });

  it("credits 0 once the cap is exactly reached", () => {
    expect(
      applyDailyCap({
        requestedAmount: 3,
        dailyEarnedCapped: 10,
        dailyCap: 10,
      }),
    ).toEqual({
      creditedAmount: 0,
      capReached: true,
      remainingBefore: 0,
      remainingAfter: 0,
    });
  });

  it("credits 0 when already past the cap (defensive — shouldn't happen but stays safe)", () => {
    expect(
      applyDailyCap({
        requestedAmount: 5,
        dailyEarnedCapped: 12,
        dailyCap: 10,
      }),
    ).toEqual({
      creditedAmount: 0,
      capReached: true,
      remainingBefore: 0,
      remainingAfter: 0,
    });
  });

  it("capReached becomes true when the credit lands EXACTLY at the cap", () => {
    expect(
      applyDailyCap({
        requestedAmount: 2,
        dailyEarnedCapped: 8,
        dailyCap: 10,
      }),
    ).toMatchObject({ creditedAmount: 2, capReached: true });
  });

  it("capReached stays false when the credit fits with headroom to spare", () => {
    expect(
      applyDailyCap({
        requestedAmount: 1,
        dailyEarnedCapped: 5,
        dailyCap: 10,
      }),
    ).toMatchObject({ creditedAmount: 1, capReached: false });
  });

  it("throws invalid_cap_input on negative requested amount", () => {
    expect(() =>
      applyDailyCap({
        requestedAmount: -1,
        dailyEarnedCapped: 0,
        dailyCap: 10,
      }),
    ).toThrow("invalid_cap_input");
  });

  it("throws invalid_cap_input on NaN inputs", () => {
    expect(() =>
      applyDailyCap({
        requestedAmount: Number.NaN,
        dailyEarnedCapped: 0,
        dailyCap: 10,
      }),
    ).toThrow("invalid_cap_input");
  });
});

describe("isDailyCapSource", () => {
  it("returns true for the capped earn sources (incl. exercise_completion)", () => {
    expect(isDailyCapSource("daily_tactic")).toBe(true);
    expect(isDailyCapSource("daily_streak_bonus")).toBe(true);
    expect(isDailyCapSource("daily_lab")).toBe(true);
    // Economy recalibration 2026-06-10: training earn joins the cap.
    expect(isDailyCapSource("exercise_completion")).toBe(true);
  });

  it("returns false for non-capped earn sources", () => {
    expect(isDailyCapSource("senda_milestone")).toBe(false);
    expect(isDailyCapSource("pack_purchase")).toBe(false);
    expect(isDailyCapSource("admin_grant")).toBe(false);
  });

  it("returns false for spend sources", () => {
    expect(isDailyCapSource("coach")).toBe(false);
    expect(isDailyCapSource("hint")).toBe(false);
    expect(isDailyCapSource("retry")).toBe(false);
    expect(isDailyCapSource("save_game")).toBe(false);
    expect(isDailyCapSource("labyrinth_key")).toBe(false);
  });
});

describe("idempotency key builders", () => {
  it("buildDailyTacticIdempotencyKey produces the documented format", () => {
    expect(
      buildDailyTacticIdempotencyKey(W_LOWER, "2026-06-07", "dt-queen-2"),
    ).toBe(`daily_tactic:${W_LOWER}:2026-06-07:dt-queen-2`);
  });

  it("buildDailyTacticIdempotencyKey normalises the wallet (mixed → lowercase)", () => {
    const a = buildDailyTacticIdempotencyKey(W_LOWER, "2026-06-07", "dt-queen-2");
    const b = buildDailyTacticIdempotencyKey(W_UPPER, "2026-06-07", "dt-queen-2");
    const c = buildDailyTacticIdempotencyKey(W_MIXED, "2026-06-07", "dt-queen-2");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("buildDailyStreakBonusIdempotencyKey produces the documented format", () => {
    expect(
      buildDailyStreakBonusIdempotencyKey(W_LOWER, "2026-06-07", 7),
    ).toBe(`daily_streak_bonus:${W_LOWER}:2026-06-07:7`);
  });

  it("buildExerciseMilestoneIdempotencyKey produces the documented format", () => {
    expect(buildExerciseMilestoneIdempotencyKey(W_LOWER, 3)).toBe(
      `exercise_milestone:${W_LOWER}:3`,
    );
  });

  it("the milestone key is keyed on the TIER, not the exercise", () => {
    // This is what makes the reward safe without a counter table: two
    // different exercises that both land on the 10th completion produce
    // the same key, so the global unique index pays the tier once.
    expect(buildExerciseMilestoneIdempotencyKey(W_LOWER, 2)).toBe(
      buildExerciseMilestoneIdempotencyKey(W_UPPER, 2),
    );
  });

  it("idempotency keys are pure functions — same input, same output", () => {
    const a = buildExerciseMilestoneIdempotencyKey(W_LOWER, 4);
    const b = buildExerciseMilestoneIdempotencyKey(W_LOWER, 4);
    expect(a).toBe(b);
  });

  it("idempotency keys reject malformed wallets via normalizeWallet", () => {
    expect(() =>
      buildDailyTacticIdempotencyKey("0xbad", "2026-06-07", "dt-queen-2"),
    ).toThrow("invalid_wallet");
  });
});

describe("buildAttestationHash", () => {
  const BASE_PAYLOAD = {
    wallet: W_LOWER,
    event_type: "earn" as const,
    amount: 3,
    source: "daily_tactic" as const,
    source_id: "dt-queen-2",
    day_utc: "2026-06-07",
    idempotency_key: `daily_tactic:${W_LOWER}:2026-06-07:dt-queen-2`,
  };

  it("returns a sha256-prefixed hex string", () => {
    const hash = buildAttestationHash(BASE_PAYLOAD);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("is deterministic — same payload yields the same hash 100 calls in a row", () => {
    const target = buildAttestationHash(BASE_PAYLOAD);
    for (let i = 0; i < 100; i++) {
      expect(buildAttestationHash(BASE_PAYLOAD)).toBe(target);
    }
  });

  it("does NOT depend on wallet casing (normalises before hashing)", () => {
    const lower = buildAttestationHash(BASE_PAYLOAD);
    const upper = buildAttestationHash({ ...BASE_PAYLOAD, wallet: W_UPPER });
    const mixed = buildAttestationHash({ ...BASE_PAYLOAD, wallet: W_MIXED });
    expect(upper).toBe(lower);
    expect(mixed).toBe(lower);
  });

  it("changes when the amount changes", () => {
    const a = buildAttestationHash(BASE_PAYLOAD);
    const b = buildAttestationHash({ ...BASE_PAYLOAD, amount: 4 });
    expect(a).not.toBe(b);
  });

  it("changes when the source changes", () => {
    const a = buildAttestationHash(BASE_PAYLOAD);
    const b = buildAttestationHash({
      ...BASE_PAYLOAD,
      source: "exercise_completion",
    });
    expect(a).not.toBe(b);
  });

  it("changes when the idempotency_key changes", () => {
    const a = buildAttestationHash(BASE_PAYLOAD);
    const b = buildAttestationHash({
      ...BASE_PAYLOAD,
      idempotency_key: `daily_tactic:${W_LOWER}:2026-06-08:dt-queen-2`,
    });
    expect(a).not.toBe(b);
  });

  it("changes when day_utc changes", () => {
    const a = buildAttestationHash(BASE_PAYLOAD);
    const b = buildAttestationHash({ ...BASE_PAYLOAD, day_utc: "2026-06-08" });
    expect(a).not.toBe(b);
  });

  it("treats null and empty-string source_id as equivalent (canonical join)", () => {
    const withNull = buildAttestationHash({ ...BASE_PAYLOAD, source_id: null });
    const withEmpty = buildAttestationHash({ ...BASE_PAYLOAD, source_id: "" });
    expect(withNull).toBe(withEmpty);
  });

  it("changes when source_id changes from null to a value", () => {
    const withNull = buildAttestationHash({ ...BASE_PAYLOAD, source_id: null });
    const withId = buildAttestationHash({
      ...BASE_PAYLOAD,
      source_id: "dt-queen-2",
    });
    expect(withNull).not.toBe(withId);
  });
});
