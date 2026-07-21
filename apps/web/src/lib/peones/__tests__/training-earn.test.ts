/**
 * Tests for the training earn helper under Economy V1 (2026-07-21):
 * +1 Peón per MILESTONE of five newly completed exercises, never per
 * exercise.
 *
 * Pure async helper; tests inject a mocked `fetch` to exercise every
 * server-response branch (success / duplicate / error / non-2xx / bad
 * JSON / network fault) plus the milestone arithmetic and wallet
 * normalisation. The "did it call the network at all" assertions carry
 * the policy: a non-crossing completion must never reach the endpoint.
 */

import { describe, expect, it, vi } from "vitest";

import { PEONES_DAILY_CAP } from "@/lib/peones/types";
import {
  submitExerciseMilestoneEarn,
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

describe("submitExerciseMilestoneEarn — crossing a milestone", () => {
  it("posts the canonical milestone payload on the 5th exercise", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        credited: 1,
        attestationHash: "sha256:aaa",
        ledgerId: 11,
        duplicate: false,
      }),
    );

    const result = await submitExerciseMilestoneEarn({
      wallet: W,
      completedBefore: 4,
      completedAfter: 5,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/peones/earn");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      wallet: W,
      amount: 1,
      source: "exercise_completion",
      sourceId: "milestone:1",
      idempotencyKey: `exercise_milestone:${W}:1`,
    });

    expect(result).toMatchObject({
      kind: "success",
      credited: 1,
      tier: 1,
      attestationHash: "sha256:aaa",
      ledgerId: 11,
      duplicate: false,
    });
  });

  it("pays again at the 10th, under a NEW tier key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ credited: 1 }));

    const result = await submitExerciseMilestoneEarn({
      wallet: W,
      completedBefore: 9,
      completedAfter: 10,
      fetchImpl,
    });

    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(body.idempotencyKey).toBe(`exercise_milestone:${W}:2`);
    expect(body.sourceId).toBe("milestone:2");
    expect(body.amount).toBe(1);
    expect(result).toMatchObject({ kind: "success", tier: 2 });
  });

  it.each([15, 20, 25, 100])(
    "keeps paying one Peón per group of five (at %i)",
    async (after) => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ credited: 1 }));
      await submitExerciseMilestoneEarn({
        wallet: W,
        completedBefore: after - 1,
        completedAfter: after,
        fetchImpl,
      });
      const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
      expect(body.idempotencyKey).toBe(
        `exercise_milestone:${W}:${after / 5}`,
      );
      expect(body.amount).toBe(1);
    },
  );

  it("normalises an uppercase wallet before posting", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ credited: 1 }));

    await submitExerciseMilestoneEarn({
      wallet: W_UPPER,
      completedBefore: 4,
      completedAfter: 5,
      fetchImpl,
    });

    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(body.wallet).toBe(W);
    expect(body.idempotencyKey).toBe(`exercise_milestone:${W}:1`);
  });

  it("reports duplicate:true when the server replays the same tier", async () => {
    // What a re-crossed milestone looks like end to end: the client
    // still posts (it cannot know the tier was claimed on another
    // device), the tier-keyed unique index collapses it, and no second
    // Peón exists.
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ credited: 1, ledgerId: 7, duplicate: true }),
    );

    const result = await submitExerciseMilestoneEarn({
      wallet: W,
      completedBefore: 4,
      completedAfter: 5,
      fetchImpl,
    });

    expect(result).toMatchObject({ kind: "success", duplicate: true, tier: 1 });
  });
});

describe("submitExerciseMilestoneEarn — no milestone, no network call", () => {
  it.each([
    { before: 0, after: 1, label: "the 1st exercise ever" },
    { before: 1, after: 2, label: "the 2nd" },
    { before: 2, after: 3, label: "the 3rd" },
    { before: 3, after: 4, label: "the 4th" },
    { before: 5, after: 6, label: "the 6th (tier 1 already paid)" },
    { before: 8, after: 9, label: "the 9th" },
  ])("does not post for $label", async ({ before, after }) => {
    const fetchImpl = vi.fn();

    const result = await submitExerciseMilestoneEarn({
      wallet: W,
      completedBefore: before,
      completedAfter: after,
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual<TrainingExerciseRewardState>({
      kind: "success",
      credited: 0,
      newBalance: 0,
      dailyEarnedCapped: 0,
      dailyCap: PEONES_DAILY_CAP,
      attestationHash: null,
      ledgerId: null,
      duplicate: false,
      tier: Math.floor(before / 5),
    });
  });

  it("does not pay for a repetition — the unique count never moves", async () => {
    // A replayed exercise (and a star improvement on one already
    // completed) leaves `completedAfter === completedBefore`. Even
    // sitting exactly ON a milestone, that must not pay again.
    const fetchImpl = vi.fn();

    for (const count of [5, 10, 25]) {
      const result = await submitExerciseMilestoneEarn({
        wallet: W,
        completedBefore: count,
        completedAfter: count,
        fetchImpl,
      });
      expect(result).toMatchObject({ kind: "success", credited: 0 });
    }

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not pay when progress somehow goes backwards", async () => {
    const fetchImpl = vi.fn();
    const result = await submitExerciseMilestoneEarn({
      wallet: W,
      completedBefore: 12,
      completedAfter: 7,
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: "success", credited: 0 });
  });
});

describe("submitExerciseMilestoneEarn — error branches", () => {
  const crossing = { completedBefore: 4, completedAfter: 5 } as const;

  it("returns error on a network fault", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await submitExerciseMilestoneEarn({
      wallet: W,
      ...crossing,
      fetchImpl,
    });
    expect(result).toEqual<TrainingExerciseRewardState>({ kind: "error" });
  });

  it("returns error on a non-2xx HTTP response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "ledger_unavailable" }, 500));
    const result = await submitExerciseMilestoneEarn({
      wallet: W,
      ...crossing,
      fetchImpl,
    });
    expect(result).toEqual<TrainingExerciseRewardState>({ kind: "error" });
  });

  it("returns error when the response body is malformed JSON", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("not-json", { status: 200 }));
    const result = await submitExerciseMilestoneEarn({
      wallet: W,
      ...crossing,
      fetchImpl,
    });
    expect(result).toEqual<TrainingExerciseRewardState>({ kind: "error" });
  });

  it("returns error when wallet is malformed (defensive — caller gates this)", async () => {
    const fetchImpl = vi.fn();
    const result = await submitExerciseMilestoneEarn({
      wallet: "0xbad",
      ...crossing,
      fetchImpl,
    });
    expect(result).toEqual<TrainingExerciseRewardState>({ kind: "error" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
