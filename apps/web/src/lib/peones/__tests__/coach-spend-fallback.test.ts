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
  emitPeonesSpendBypassed: vi.fn(),
  emitPeonesSpendFailed: vi.fn(),
}));

import {
  attemptCoachSpendWithPeones,
  buildCoachIdempotencyKey,
  COACH_ANALYSIS_PEONES_COST,
} from "@/lib/peones/coach-spend-fallback";
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

/** These tests replace the whole spend via `submitImpl`, so the signer is never
 *  reached. It THROWS rather than resolving: a test that somehow does reach it
 *  should fail loudly instead of quietly pretending a signature happened. */
const neverSigns = async (): Promise<string> => {
  throw new Error("signer must not be reached in these tests");
};
const G = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  mockedSpent.mockReset();
  mockedBlocked.mockReset();
  mockedBypassed.mockReset();
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
      requested: COACH_ANALYSIS_PEONES_COST,
      debited: COACH_ANALYSIS_PEONES_COST,
      newBalance: 4,
      attestationHash: "sha256:abc",
      ledgerId: 99,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const result = await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      signMessage: neverSigns,
      submitImpl,
    });

    expect(result).toEqual({
      kind: "paid",
      peonesIdempotencyKey: `spend:coach:${W}:${G}`,
      debited: COACH_ANALYSIS_PEONES_COST,
      duplicate: false,
      proBypassApplied: false,
      newBalance: 4,
      attestationHash: "sha256:abc",
    });
    expect(submitImpl).toHaveBeenCalledWith({
      wallet: W,
      amount: COACH_ANALYSIS_PEONES_COST,
      target: "coach",
      targetId: G,
      idempotencyKey: `spend:coach:${W}:${G}`,
      // Threaded straight through: the fallback does not get to decide whether
      // the spend can authorize itself.
      signMessage: neverSigns,
      metadata: { gameId: G, surface: "coach" },
    });
  });

  it("emits peones_spent only when debited > 0", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "coach",
      targetId: G,
      requested: COACH_ANALYSIS_PEONES_COST,
      debited: COACH_ANALYSIS_PEONES_COST,
      newBalance: 4,
      attestationHash: "sha256:abc",
      ledgerId: 99,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      signMessage: neverSigns,
      submitImpl,
    });

    expect(mockedSpent).toHaveBeenCalledTimes(1);
    expect(mockedSpent).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "coach",
        targetId: G,
        debited: COACH_ANALYSIS_PEONES_COST,
      }),
    );
  });

  it("duplicate idempotent (debited > 0 + duplicate=true): paid result but NO peones_spent emit", async () => {
    // Sprint 4 commit M.1 — RPC returns the ORIGINAL row's debited
    // amount (positive) on idempotent retry. Client must skip the
    // emit to keep dashboard rule "spent === real Peones left wallet".
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "coach",
      targetId: G,
      requested: COACH_ANALYSIS_PEONES_COST,
      debited: COACH_ANALYSIS_PEONES_COST,
      newBalance: 0,
      attestationHash: "sha256:original",
      ledgerId: 99,
      duplicate: true,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const result = await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      signMessage: neverSigns,
      submitImpl,
    });

    expect(result.kind).toBe("paid");
    if (result.kind === "paid") {
      expect(result.duplicate).toBe(true);
    }
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBypassed).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });

  it("duplicate success (debited=0): kind:'paid' WITHOUT re-emitting peones_spent", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "coach",
      targetId: G,
      requested: COACH_ANALYSIS_PEONES_COST,
      debited: 0,
      newBalance: 4,
      attestationHash: "sha256:abc",
      ledgerId: 99,
      duplicate: true,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const result = await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      signMessage: neverSigns,
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
      signMessage: neverSigns,
      submitImpl,
    });

    expect(result).toEqual({ kind: "insufficient" });
    expect(mockedBlocked).toHaveBeenCalledTimes(1);
    expect(mockedBlocked).toHaveBeenCalledWith({
      target: "coach",
      targetId: G,
      requested: COACH_ANALYSIS_PEONES_COST,
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
      signMessage: neverSigns,
      submitImpl,
    });

    expect(result).toEqual({ kind: "error", reason: "network" });
    expect(mockedFailed).toHaveBeenCalledTimes(1);
    expect(mockedFailed).toHaveBeenCalledWith({
      target: "coach",
      targetId: G,
      requested: COACH_ANALYSIS_PEONES_COST,
      reason: "network",
    });
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
  });
});

describe("attemptCoachSpendWithPeones — PRO bypass (Sprint 4 commit G)", () => {
  it("proBypassApplied=true + quota fields: emits peones_spend_bypassed, NOT peones_spent", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "coach",
      targetId: G,
      requested: COACH_ANALYSIS_PEONES_COST,
      debited: 0,
      newBalance: 4,
      attestationHash: "sha256:bypass-1",
      ledgerId: 101,
      duplicate: false,
      proBypassApplied: true,
      quotaUsed: 3,
      quotaLimit: 5,
    } satisfies PeonesSpendResult);

    const result = await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      signMessage: neverSigns,
      submitImpl,
    });

    expect(result.kind).toBe("paid");
    if (result.kind === "paid") {
      expect(result.debited).toBe(0);
      expect(result.proBypassApplied).toBe(true);
    }
    expect(mockedBypassed).toHaveBeenCalledTimes(1);
    expect(mockedBypassed).toHaveBeenCalledWith({
      target: "coach",
      targetId: G,
      requested: COACH_ANALYSIS_PEONES_COST,
      debited: 0,
      newBalance: 4,
      attestationHash: "sha256:bypass-1",
      quotaUsed: 3,
      quotaLimit: 5,
    });
    expect(mockedSpent).not.toHaveBeenCalled();
  });

  it("proBypassApplied=true but quota fields missing: falls back to spent emit gate (defensive)", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "coach",
      targetId: G,
      requested: COACH_ANALYSIS_PEONES_COST,
      debited: 0,
      newBalance: 4,
      attestationHash: "sha256:bypass-1",
      ledgerId: 101,
      duplicate: false,
      proBypassApplied: true,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    await attemptCoachSpendWithPeones({
      wallet: W,
      gameId: G,
      signMessage: neverSigns,
      submitImpl,
    });

    // Neither event fires — spent gated on debited>0, bypassed gated
    // on quota fields. Safe silence is preferable to emitting an
    // event with null props.
    expect(mockedBypassed).not.toHaveBeenCalled();
    expect(mockedSpent).not.toHaveBeenCalled();
  });
});
