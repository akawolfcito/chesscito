/**
 * Tests for the Daily Tactic earn submission helper added in
 * Sprint 3 commit E (Training Economy Alpha 2026-06-07).
 *
 * Pure async helper; tests inject a mocked `fetch` to exercise
 * every server-response branch (success / partial cap / cap
 * exhausted / duplicate / error / non-2xx / bad JSON / network
 * fault) without renderHook overhead.
 */

import { describe, expect, it, vi } from "vitest";

import {
  DAILY_TACTIC_EARN_AMOUNT,
  submitDailyTacticEarn,
  type DailyTacticRewardState,
} from "@/lib/daily/peones-earn";
import type { DailyTacticData } from "@/lib/daily/daily-puzzles";

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const W_UPPER = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
const DAY = "2026-06-07";

const PUZZLE: DailyTacticData = {
  id: "dt-queen-2",
  name: "Queen — file ride",
  piece: "queen",
  difficulty: "easy",
  exercise: {
    id: "dt-queen-2",
    startPos: { file: 0, rank: 0 },
    targetPos: { file: 0, rank: 7 },
    optimalMoves: 1,
  },
  hint: "Slide up the a-file.",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("submitDailyTacticEarn — success branches", () => {
  it("posts to /api/peones/earn with the canonical payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        wallet: W,
        credited: 3,
        capReached: false,
        attestationHash: "sha256:aaa",
        ledgerId: 1,
        duplicate: false,
      }),
    );

    const result = await submitDailyTacticEarn({
      wallet: W,
      dayUtc: DAY,
      puzzle: PUZZLE,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/peones/earn");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      wallet: W,
      amount: DAILY_TACTIC_EARN_AMOUNT,
      source: "daily_tactic",
      sourceId: "dt-queen-2",
      idempotencyKey: `daily_tactic:${W}:${DAY}:dt-queen-2`,
    });

    expect(result).toEqual<DailyTacticRewardState>({
      kind: "success",
      credited: 3,
      capReached: false,
      attestationHash: "sha256:aaa",
      ledgerId: 1,
      duplicate: false,
    });
  });

  it("normalises an uppercase wallet before posting", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ credited: 3, capReached: false }),
    );

    await submitDailyTacticEarn({
      wallet: W_UPPER,
      dayUtc: DAY,
      puzzle: PUZZLE,
      fetchImpl,
    });

    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(body.wallet).toBe(W);
    expect(body.idempotencyKey).toBe(
      `daily_tactic:${W}:${DAY}:dt-queen-2`,
    );
  });

  it("returns success with credited & capReached for a partial-cap response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        credited: 2,
        capReached: true,
        attestationHash: "sha256:bbb",
        ledgerId: 22,
      }),
    );
    const result = await submitDailyTacticEarn({
      wallet: W,
      dayUtc: DAY,
      puzzle: PUZZLE,
      fetchImpl,
    });
    expect(result).toMatchObject({
      kind: "success",
      credited: 2,
      capReached: true,
    });
  });

  it("returns cap_exhausted when credited:0 (cap was already met)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        credited: 0,
        capReached: true,
        attestationHash: null,
        ledgerId: null,
      }),
    );
    const result = await submitDailyTacticEarn({
      wallet: W,
      dayUtc: DAY,
      puzzle: PUZZLE,
      fetchImpl,
    });
    expect(result).toEqual<DailyTacticRewardState>({ kind: "cap_exhausted" });
  });

  it("flags duplicate:true on the success result when the server replays", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        credited: 3,
        capReached: false,
        attestationHash: "sha256:ccc",
        ledgerId: 7,
        duplicate: true,
      }),
    );
    const result = await submitDailyTacticEarn({
      wallet: W,
      dayUtc: DAY,
      puzzle: PUZZLE,
      fetchImpl,
    });
    expect(result).toMatchObject({
      kind: "success",
      credited: 3,
      duplicate: true,
    });
  });
});

describe("submitDailyTacticEarn — error branches", () => {
  it("returns error on a network fault", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await submitDailyTacticEarn({
      wallet: W,
      dayUtc: DAY,
      puzzle: PUZZLE,
      fetchImpl,
    });
    expect(result).toEqual<DailyTacticRewardState>({ kind: "error" });
  });

  it("returns error on a non-2xx HTTP response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: "ledger_unavailable" }, 500),
    );
    const result = await submitDailyTacticEarn({
      wallet: W,
      dayUtc: DAY,
      puzzle: PUZZLE,
      fetchImpl,
    });
    expect(result).toEqual<DailyTacticRewardState>({ kind: "error" });
  });

  it("returns error when the response body is malformed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );
    const result = await submitDailyTacticEarn({
      wallet: W,
      dayUtc: DAY,
      puzzle: PUZZLE,
      fetchImpl,
    });
    expect(result).toEqual<DailyTacticRewardState>({ kind: "error" });
  });

  it("returns error when wallet is malformed (defensive — mount gates this)", async () => {
    const fetchImpl = vi.fn();
    const result = await submitDailyTacticEarn({
      wallet: "0xbad",
      dayUtc: DAY,
      puzzle: PUZZLE,
      fetchImpl,
    });
    expect(result).toEqual<DailyTacticRewardState>({ kind: "error" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
