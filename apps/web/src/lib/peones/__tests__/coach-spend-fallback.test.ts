/**
 * Sprint 4 commit F — Coach Peones fallback tests.
 *
 * Pure orchestration tests: the submit helper is injected so no
 * fetch/network is touched. Contracts:
 *   - paid: returns canonical idempotency key, emits peones_spent
 *           only when debited>0
 *   - duplicate paid: returns kind:"paid" without re-emitting
 *   - insufficient: returns kind:"insufficient", emits blocked
 *   - error: returns kind:"error", emits failed
 *   - idempotency key format: spend:coach:<wallet>:<gameId> (wallet
 *     lowercased)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/peones/telemetry", () => ({
  emitPeonesSpent: vi.fn(),
  emitPeonesSpendBlocked: vi.fn(),
  emitPeonesSpendFailed: vi.fn(),
}));

import {
  attemptCoachSpendWithPeones,
  buildCoachIdempotencyKey,
} from "@/lib/peones/coach-spend-fallback";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";
import type { PeonesSpendResult } from "@/lib/peones/spend-client";

const mockedSpent = vi.mocked(emitPeonesSpent);
const mockedBlocked = vi.mocked(emitPeonesSpendBlocked);
const mockedFailed = vi.mocked(emitPeonesSpendFailed);

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const G = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  mockedSpent.mockReset();
  mockedBlocked.mockReset();
  mockedFailed.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildCoachIdempotencyKey", () => {
  it("uses the spend:coach:<wallet>:<gameId> format", () => {
    expect(buildCoachIdempotencyKey(W, G)).toBe(`spend:coach:${W}:${G}`);
  });

  it("lowercases the wallet defensively", () => {
    const upper = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    expect(buildCoachIdempotencyKey(upper, G)).toBe(`spend:coach:${W}:${G}`);
  });
});

describe("attemptCoachSpendWithPeones — paid path", () => {
  it("returns kind:'paid' with the canonical idempotency key", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "coach",
      targetId: G,
      requested: 1,
      debited: 1,
      newBalance: 4,
      attestationHash: "sha256:abc",
      ledgerId: 99,
      duplicate: false,
      proBypassApplied: false,
    } satisfies PeonesSpendResult);

    const result = await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      submitImpl,
    });

    expect(result).toEqual({
      kind: "paid",
      peonesIdempotencyKey: `spend:coach:${W}:${G}`,
      debited: 1,
      duplicate: false,
      proBypassApplied: false,
      newBalance: 4,
      attestationHash: "sha256:abc",
    });
    expect(submitImpl).toHaveBeenCalledWith({
      wallet: W,
      amount: 1,
      target: "coach",
      targetId: G,
      idempotencyKey: `spend:coach:${W}:${G}`,
      metadata: { gameId: G, surface: "coach" },
    });
  });

  it("emits peones_spent only when debited > 0", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "coach",
      targetId: G,
      requested: 1,
      debited: 1,
      newBalance: 4,
      attestationHash: "sha256:abc",
      ledgerId: 99,
      duplicate: false,
      proBypassApplied: false,
    } satisfies PeonesSpendResult);

    await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      submitImpl,
    });

    expect(mockedSpent).toHaveBeenCalledTimes(1);
    expect(mockedSpent).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "coach",
        targetId: G,
        debited: 1,
      }),
    );
  });

  it("duplicate success (debited=0): kind:'paid' WITHOUT re-emitting peones_spent", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "coach",
      targetId: G,
      requested: 1,
      debited: 0,
      newBalance: 4,
      attestationHash: "sha256:abc",
      ledgerId: 99,
      duplicate: true,
      proBypassApplied: false,
    } satisfies PeonesSpendResult);

    const result = await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      submitImpl,
    });

    expect(result.kind).toBe("paid");
    if (result.kind === "paid") {
      expect(result.duplicate).toBe(true);
    }
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });
});

describe("attemptCoachSpendWithPeones — failure paths", () => {
  it("insufficient_balance: returns kind:'insufficient' + emits blocked", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "insufficient_balance",
    } satisfies PeonesSpendResult);

    const result = await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      submitImpl,
    });

    expect(result).toEqual({ kind: "insufficient" });
    expect(mockedBlocked).toHaveBeenCalledTimes(1);
    expect(mockedBlocked).toHaveBeenCalledWith({
      target: "coach",
      targetId: G,
      requested: 1,
      reason: "insufficient_balance",
    });
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });

  it("technical error: returns kind:'error' + emits failed with reason", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "error",
      error: "network",
    } satisfies PeonesSpendResult);

    const result = await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      submitImpl,
    });

    expect(result).toEqual({ kind: "error", reason: "network" });
    expect(mockedFailed).toHaveBeenCalledTimes(1);
    expect(mockedFailed).toHaveBeenCalledWith({
      target: "coach",
      targetId: G,
      requested: 1,
      reason: "network",
    });
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
  });
});
