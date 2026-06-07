/**
 * Tests for the Training exercise earn submission helper added in
 * Sprint 3 commit F (Training Economy Alpha 2026-06-07).
 *
 * Pure async helper; tests inject a mocked `fetch` to exercise
 * every server-response branch (success / duplicate / error /
 * non-2xx / bad JSON / network fault) + the defensive
 * non-positive-delta short-circuit + wallet normalisation.
 */

import { describe, expect, it, vi } from "vitest";

import {
  submitTrainingExerciseEarn,
  type TrainingExerciseRewardState,
} from "@/lib/peones/training-earn";

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const W_UPPER = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("submitTrainingExerciseEarn — success branches", () => {
  it("posts to /api/peones/earn with the canonical training payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        credited: 3,
        attestationHash: "sha256:aaa",
        ledgerId: 11,
        duplicate: false,
      }),
    );

    const result = await submitTrainingExerciseEarn({
      wallet: W,
      piece: "king",
      exerciseId: "king-6",
      bestStarsBefore: 0,
      bestStarsAfter: 3,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/peones/earn");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      wallet: W,
      amount: 3, // delta
      source: "exercise_completion",
      sourceId: "king:king-6",
      idempotencyKey: `training:${W}:king:king-6:0->3`,
    });

    expect(result).toEqual<TrainingExerciseRewardState>({
      kind: "success",
      credited: 3,
      attestationHash: "sha256:aaa",
      ledgerId: 11,
      duplicate: false,
    });
  });

  it("amount=delta when the user improves an existing star count", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ credited: 1, attestationHash: "sha256:bbb", ledgerId: 22 }),
    );

    await submitTrainingExerciseEarn({
      wallet: W,
      piece: "rook",
      exerciseId: "rook-4",
      bestStarsBefore: 1,
      bestStarsAfter: 2,
      fetchImpl,
    });

    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(body.amount).toBe(1);
    expect(body.idempotencyKey).toBe(`training:${W}:rook:rook-4:1->2`);
  });

  it("normalises an uppercase wallet before posting", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ credited: 2 }),
    );

    await submitTrainingExerciseEarn({
      wallet: W_UPPER,
      piece: "knight",
      exerciseId: "knight-3",
      bestStarsBefore: 0,
      bestStarsAfter: 2,
      fetchImpl,
    });

    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(body.wallet).toBe(W);
    expect(body.idempotencyKey).toBe(`training:${W}:knight:knight-3:0->2`);
  });

  it("flags duplicate:true on the success result when the server replays", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        credited: 2,
        attestationHash: "sha256:ccc",
        ledgerId: 7,
        duplicate: true,
      }),
    );

    const result = await submitTrainingExerciseEarn({
      wallet: W,
      piece: "rook",
      exerciseId: "rook-4",
      bestStarsBefore: 1,
      bestStarsAfter: 3,
      fetchImpl,
    });

    expect(result).toMatchObject({
      kind: "success",
      credited: 2,
      duplicate: true,
    });
  });
});

describe("submitTrainingExerciseEarn — non-positive delta short-circuit", () => {
  it.each([
    { before: 3, after: 3, label: "delta=0 (replay no improvement)" },
    { before: 2, after: 1, label: "delta<0 (worse score than best)" },
    { before: 0, after: 0, label: "delta=0 (never touched)" },
  ])("returns success-with-zero without posting when $label", async ({ before, after }) => {
    const fetchImpl = vi.fn();

    const result = await submitTrainingExerciseEarn({
      wallet: W,
      piece: "rook",
      exerciseId: "rook-1",
      bestStarsBefore: before,
      bestStarsAfter: after,
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual<TrainingExerciseRewardState>({
      kind: "success",
      credited: 0,
      attestationHash: null,
      ledgerId: null,
      duplicate: false,
    });
  });
});

describe("submitTrainingExerciseEarn — error branches", () => {
  it("returns error on a network fault", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await submitTrainingExerciseEarn({
      wallet: W,
      piece: "king",
      exerciseId: "king-6",
      bestStarsBefore: 0,
      bestStarsAfter: 3,
      fetchImpl,
    });
    expect(result).toEqual<TrainingExerciseRewardState>({ kind: "error" });
  });

  it("returns error on a non-2xx HTTP response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: "ledger_unavailable" }, 500),
    );
    const result = await submitTrainingExerciseEarn({
      wallet: W,
      piece: "king",
      exerciseId: "king-6",
      bestStarsBefore: 0,
      bestStarsAfter: 3,
      fetchImpl,
    });
    expect(result).toEqual<TrainingExerciseRewardState>({ kind: "error" });
  });

  it("returns error when the response body is malformed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );
    const result = await submitTrainingExerciseEarn({
      wallet: W,
      piece: "king",
      exerciseId: "king-6",
      bestStarsBefore: 0,
      bestStarsAfter: 3,
      fetchImpl,
    });
    expect(result).toEqual<TrainingExerciseRewardState>({ kind: "error" });
  });

  it("returns error when wallet is malformed (defensive — caller gates this)", async () => {
    const fetchImpl = vi.fn();
    const result = await submitTrainingExerciseEarn({
      wallet: "0xbad",
      piece: "rook",
      exerciseId: "rook-1",
      bestStarsBefore: 0,
      bestStarsAfter: 3,
      fetchImpl,
    });
    expect(result).toEqual<TrainingExerciseRewardState>({ kind: "error" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
