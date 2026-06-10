/**
 * SaveScore off-chain — Slice 6 telemetry mapping.
 *
 * `buildScoreSaveTelemetry` is the pure mapper from a
 * `BasicScoreSaveResult` onto the (event, props) pair the spec defines
 * (docs/specs/savescore-offchain-peones.md §Telemetry):
 *
 *   saved/free          -> score_save_free
 *   saved/peones        -> score_save_paid          (spent)
 *   duplicate           -> score_save_duplicate
 *   insufficient_peones -> score_save_insufficient  (required, balance)
 *   rate_limited        -> score_save_failed        (reason, retryAfterMs)
 *   invalid / error     -> score_save_failed        (reason)
 *
 * `emitScoreSaveTelemetry` fires it through `track` exactly once per
 * response — the structural guarantee behind the "no double event /
 * never before the result is known" rules.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildScoreSaveTelemetry,
  emitScoreSaveTelemetry,
  type ScoreSaveTelemetryContext,
} from "../save-telemetry";
import type { BasicScoreSaveResult } from "../save-service";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
import { track } from "@/lib/telemetry";

const CTX: ScoreSaveTelemetryContext = {
  piece: "bishop",
  levelId: 2,
  score: 300,
  timeMs: 5000,
  saveId: "0xabc:2:300",
  source: "exercises",
};

const QUOTA = {
  wallet: "0xabc",
  freeLimit: 5,
  freeUsed: 1,
  freeRemaining: 4,
  requiresPeones: false,
  costPeones: 0,
};

const PAID_QUOTA = { ...QUOTA, freeUsed: 6, freeRemaining: 0, requiresPeones: true, costPeones: 1 };

afterEach(() => vi.clearAllMocks());

describe("buildScoreSaveTelemetry — event + base payload", () => {
  it("always carries the base context (no wallet / PII)", () => {
    const { props } = buildScoreSaveTelemetry(
      { status: "saved", mode: "free", quota: QUOTA },
      CTX,
    );
    expect(props).toMatchObject({
      piece: "bishop",
      levelId: 2,
      score: 300,
      timeMs: 5000,
      saveId: "0xabc:2:300",
      source: "exercises",
    });
    expect(props).not.toHaveProperty("wallet");
  });

  it("maps saved/free -> score_save_free", () => {
    const { event, props } = buildScoreSaveTelemetry(
      { status: "saved", mode: "free", quota: QUOTA },
      CTX,
    );
    expect(event).toBe("score_save_free");
    expect(props.mode).toBe("free");
    expect(props.spent).toBe(0);
    expect(props.freeRemaining).toBe(4);
    expect(props.requiresPeones).toBe(false);
  });

  it("maps saved/peones -> score_save_paid with spent", () => {
    const { event, props } = buildScoreSaveTelemetry(
      { status: "saved", mode: "peones", spent: 1, quota: PAID_QUOTA },
      CTX,
    );
    expect(event).toBe("score_save_paid");
    expect(props.mode).toBe("peones");
    expect(props.spent).toBe(1);
    expect(props.requiresPeones).toBe(true);
  });

  it("maps duplicate -> score_save_duplicate", () => {
    const { event, props } = buildScoreSaveTelemetry(
      { status: "duplicate", quota: QUOTA },
      CTX,
    );
    expect(event).toBe("score_save_duplicate");
    expect(props.freeRemaining).toBe(4);
  });

  it("maps insufficient_peones -> score_save_insufficient with required/balance", () => {
    const { event, props } = buildScoreSaveTelemetry(
      { status: "insufficient_peones", required: 1, balance: 0, quota: PAID_QUOTA },
      CTX,
    );
    expect(event).toBe("score_save_insufficient");
    expect(props.required).toBe(1);
    expect(props.balance).toBe(0);
    expect(props.requiresPeones).toBe(true);
  });

  it("maps rate_limited -> score_save_failed with reason + retryAfterMs", () => {
    const { event, props } = buildScoreSaveTelemetry(
      { status: "rate_limited", retryAfterMs: 60000 },
      CTX,
    );
    expect(event).toBe("score_save_failed");
    expect(props.reason).toBe("rate_limited");
    expect(props.retryAfterMs).toBe(60000);
  });

  it("maps invalid -> score_save_failed with reason", () => {
    const { event, props } = buildScoreSaveTelemetry(
      { status: "invalid", reason: "invalid_score" },
      CTX,
    );
    expect(event).toBe("score_save_failed");
    expect(props.reason).toBe("invalid");
    expect(props.detail).toBe("invalid_score");
  });

  it("maps error -> score_save_failed", () => {
    const { event, props } = buildScoreSaveTelemetry(
      { status: "error", reason: "save_failed" },
      CTX,
    );
    expect(event).toBe("score_save_failed");
    expect(props.reason).toBe("error");
    expect(props.detail).toBe("save_failed");
  });
});

describe("emitScoreSaveTelemetry — single fire per response", () => {
  it("calls track exactly once with the mapped event", () => {
    emitScoreSaveTelemetry({ status: "saved", mode: "free", quota: QUOTA }, CTX);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("score_save_free", expect.objectContaining({ source: "exercises" }));
  });

  it("never double-fires for any single result", () => {
    const results: BasicScoreSaveResult[] = [
      { status: "saved", mode: "free", quota: QUOTA },
      { status: "saved", mode: "peones", spent: 1, quota: PAID_QUOTA },
      { status: "duplicate", quota: QUOTA },
      { status: "insufficient_peones", required: 1, balance: 0, quota: PAID_QUOTA },
      { status: "rate_limited", retryAfterMs: 1000 },
      { status: "error", reason: "save_failed" },
    ];
    for (const r of results) {
      vi.clearAllMocks();
      emitScoreSaveTelemetry(r, CTX);
      expect(track).toHaveBeenCalledTimes(1);
    }
  });
});
