/**
 * Shield Peones spend fallback tests.
 *
 * Mirrors coach-spend-fallback.test.ts. Key difference under test:
 * the idempotency key is built from `attemptSeq` (a number), not a
 * gameId (a UUID string) — same-attempt retries collapse onto one
 * ledger row, a fresh attempt (advanced attemptSeq) gets a fresh row.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/peones/telemetry", () => ({
  emitPeonesSpent: vi.fn(),
  emitPeonesSpendBlocked: vi.fn(),
  emitPeonesSpendBypassed: vi.fn(),
  emitPeonesSpendFailed: vi.fn(),
}));

import {
  attemptShieldSpendWithPeones,
  buildShieldIdempotencyKey,
} from "@/lib/peones/shield-spend-fallback";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendBypassed,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";
import type { PeonesSpendResult } from "@/lib/peones/spend-client";

const mockedSpent = vi.mocked(emitPeonesSpent);
const mockedBlocked = vi.mocked(emitPeonesSpendBlocked);
const mockedBypassed = vi.mocked(emitPeonesSpendBypassed);
const mockedFailed = vi.mocked(emitPeonesSpendFailed);

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const SEQ = 7;

beforeEach(() => {
  mockedSpent.mockReset();
  mockedBlocked.mockReset();
  mockedBypassed.mockReset();
  mockedFailed.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildShieldIdempotencyKey", () => {
  it("uses the spend:shield:<wallet>:<attemptSeq> format", () => {
    expect(buildShieldIdempotencyKey(W, SEQ)).toBe(`spend:shield:${W}:${SEQ}`);
  });

  it("lowercases the wallet defensively", () => {
    const upper = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    expect(buildShieldIdempotencyKey(upper, SEQ)).toBe(`spend:shield:${W}:${SEQ}`);
  });

  it("same attemptSeq always yields the same key (collapses retries onto one row)", () => {
    expect(buildShieldIdempotencyKey(W, SEQ)).toBe(buildShieldIdempotencyKey(W, SEQ));
  });

  it("a different attemptSeq yields a different key (fresh attempt, fresh row)", () => {
    expect(buildShieldIdempotencyKey(W, SEQ)).not.toBe(buildShieldIdempotencyKey(W, SEQ + 1));
  });
});

describe("attemptShieldSpendWithPeones — paid path", () => {
  it("returns kind:'paid' with the canonical idempotency key", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "shield",
      targetId: String(SEQ),
      requested: 2,
      debited: 2,
      newBalance: 10,
      attestationHash: "sha256:abc",
      ledgerId: 55,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const result = await attemptShieldSpendWithPeones({
      wallet: W,
      attemptSeq: SEQ,
      submitImpl,
    });

    expect(result).toEqual({
      kind: "paid",
      peonesIdempotencyKey: `spend:shield:${W}:${SEQ}`,
      debited: 2,
      duplicate: false,
      proBypassApplied: false,
      newBalance: 10,
      attestationHash: "sha256:abc",
    });
    expect(submitImpl).toHaveBeenCalledWith({
      wallet: W,
      amount: 2,
      target: "shield",
      targetId: String(SEQ),
      idempotencyKey: `spend:shield:${W}:${SEQ}`,
      metadata: { attemptSeq: SEQ, surface: "shield" },
    });
    expect(mockedSpent).toHaveBeenCalledTimes(1);
  });

  it("duplicate (debited=0, duplicate=true): paid result WITHOUT re-emitting peones_spent", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "shield",
      targetId: String(SEQ),
      requested: 2,
      debited: 0,
      newBalance: 10,
      attestationHash: "sha256:abc",
      ledgerId: 55,
      duplicate: true,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const result = await attemptShieldSpendWithPeones({
      wallet: W,
      attemptSeq: SEQ,
      submitImpl,
    });

    expect(result.kind).toBe("paid");
    if (result.kind === "paid") expect(result.duplicate).toBe(true);
    expect(mockedSpent).not.toHaveBeenCalled();
  });
});

describe("attemptShieldSpendWithPeones — failure paths", () => {
  it("insufficient_balance: returns kind:'insufficient' + emits blocked", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "insufficient_balance",
    } satisfies PeonesSpendResult);

    const result = await attemptShieldSpendWithPeones({
      wallet: W,
      attemptSeq: SEQ,
      submitImpl,
    });

    expect(result).toEqual({ kind: "insufficient" });
    expect(mockedBlocked).toHaveBeenCalledWith({
      target: "shield",
      targetId: String(SEQ),
      requested: 2,
      reason: "insufficient_balance",
    });
  });

  it("technical error: returns kind:'error' + emits failed with reason", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "error",
      error: "network",
    } satisfies PeonesSpendResult);

    const result = await attemptShieldSpendWithPeones({
      wallet: W,
      attemptSeq: SEQ,
      submitImpl,
    });

    expect(result).toEqual({ kind: "error", reason: "network" });
    expect(mockedFailed).toHaveBeenCalledWith({
      target: "shield",
      targetId: String(SEQ),
      requested: 2,
      reason: "network",
    });
  });
});
