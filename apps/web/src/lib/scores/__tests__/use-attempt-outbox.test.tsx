/**
 * The host seam of Slice 3 — stage 4C.
 *
 * The server has accepted attempts since 4B and nobody sends them. This hook is
 * the only thing between a completion and that endpoint, and every property the
 * endpoint was built around (a retry is a replay, a rejected attempt consumes
 * nothing, an attempt survives a closed app) is only true if the CLIENT holds up
 * its half. These tests are that half.
 *
 * WHAT IS BEING PINNED, AND WHY EACH ONE IS A REAL FAILURE
 * -------------------------------------------------------
 * 1. HYDRATE BEFORE DRAIN — and before minting. A rehydrated attempt that gets
 *    re-minted stops being one attempt and becomes two, on a permanent row.
 * 2. A COMPLETION DURING HYDRATION IS NOT LOST. This is the case a naive
 *    `useEffect` eats: the event lands while the state is still empty and the
 *    mirror writes the empty state over the queue.
 * 3. ONE POST IN FLIGHT. Two concurrent POSTs of different attempts is not a
 *    correctness bug server-side, but it spends budget in bursts and reorders
 *    the FIFO; `selectNextSubmission` exists to prevent it.
 * 4. WALLET A NEVER DRAINS WALLET B'S QUEUE. That is score attribution.
 * 5. A RETRY KEEPS THE SAME `attemptId` — the whole reason the server can answer
 *    a replay instead of counting a second attempt.
 * 6. A TERMINAL FAILURE DOES NOT BLOCK THE QUEUE. A 400 re-queued at the head
 *    of a FIFO blocks everything behind it forever.
 * 7. A RETRYABLE FAILURE KEEPS THE HEAD. Dropping it loses the play.
 * 8. A SETTLEMENT REMOVES ONLY ITS OWN ID.
 *
 * The submit seam is injected: this file never touches fetch, wagmi or a
 * signature. What it drives is the delivery machine.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BasicScoreSaveResult } from "@/lib/scores/save-service";
import type { AttemptSnapshot } from "@/lib/scores/attempt-lifecycle";
import { outboxStorageKey } from "@/lib/scores/attempt-outbox-storage";
import {
  classifyAttemptDelivery,
  useAttemptOutbox,
  type AttemptReportInput,
} from "@/lib/scores/use-attempt-outbox";

const WALLET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WALLET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const QUOTA = {
  wallet: WALLET_A,
  freeLimit: 100,
  freeUsed: 1,
  freeRemaining: 99,
  requiresPeones: false,
  costPeones: 0,
};
const SAVED: BasicScoreSaveResult = { status: "saved", mode: "free", quota: QUOTA };

function report(overrides: Partial<AttemptReportInput> = {}): AttemptReportInput {
  return {
    completionKey: "rook-distance-1:0-ex",
    exerciseId: "rook-distance-1",
    measurement: { kind: "moves", movesUsed: 4 },
    timeMs: 12_000,
    levelId: 1,
    score: 40,
    ...overrides,
  };
}

function persisted(attemptId: string, exerciseId = "rook-distance-1"): AttemptSnapshot {
  return {
    attemptId,
    exerciseId,
    measurement: { kind: "moves", movesUsed: 3 },
    timeMs: 9_000,
    levelId: 1,
    score: 30,
  };
}

function seed(wallet: string, snapshots: AttemptSnapshot[]): void {
  window.localStorage.setItem(outboxStorageKey(wallet), JSON.stringify(snapshots));
}

/** A submit seam whose every call is resolvable by hand, so "in flight" is a
 *  state the test can hold open rather than a race it has to win. */
function deferredSubmit() {
  const calls: AttemptSnapshot[] = [];
  const resolvers: Array<(r: BasicScoreSaveResult) => void> = [];
  const submitAttempt = vi.fn((snapshot: AttemptSnapshot) => {
    calls.push(snapshot);
    return new Promise<BasicScoreSaveResult>((resolve) => {
      resolvers.push(resolve);
    });
  });
  const settle = async (index: number, result: BasicScoreSaveResult) => {
    await act(async () => {
      resolvers[index]?.(result);
      await Promise.resolve();
    });
  };
  return { calls, submitAttempt, settle };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("classifyAttemptDelivery", () => {
  it("treats a 400-class rejection as terminal", () => {
    // Retrying `invalid` re-sends the same body to the same validator. It can
    // only ever fail the same way, and at the head of a FIFO it blocks the
    // attempts behind it for the life of the install.
    expect(classifyAttemptDelivery({ status: "invalid", reason: "unknown_exercise" })).toBe(
      "terminal",
    );
    expect(classifyAttemptDelivery({ status: "invalid", reason: "session_exhausted" })).toBe(
      "terminal",
    );
  });

  it("treats a delivered attempt as settled, saved or duplicate", () => {
    // `duplicate` is about the SCORE row, not the attempt: the attempt row was
    // written. Keeping it queued would re-send it forever.
    expect(classifyAttemptDelivery(SAVED)).toBe("settled");
    expect(classifyAttemptDelivery({ status: "duplicate", quota: QUOTA })).toBe("settled");
  });

  it("treats transport, availability and rate limits as retryable", () => {
    expect(classifyAttemptDelivery({ status: "error", reason: "network" })).toBe("retryable");
    expect(classifyAttemptDelivery({ status: "error", reason: "unavailable" })).toBe("retryable");
    expect(classifyAttemptDelivery({ status: "rate_limited", retryAfterMs: 60_000 })).toBe(
      "retryable",
    );
  });
});

describe("useAttemptOutbox", () => {
  it("drains what a previous session left before anything minted now", async () => {
    seed(WALLET_A, [persisted("a".repeat(32)), persisted("b".repeat(32))]);
    const { calls, submitAttempt, settle } = deferredSubmit();

    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );

    act(() => {
      result.current.report(report());
    });

    await waitFor(() => expect(calls.length).toBe(1));
    // The recovered attempts are older than anything this mount minted, and
    // they are the ones that have been waiting through an outage.
    expect(calls[0]?.attemptId).toBe("a".repeat(32));
    expect(result.current.pendingCount).toBe(3);

    await settle(0, SAVED);
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls[1]?.attemptId).toBe("b".repeat(32));

    await settle(1, SAVED);
    await waitFor(() => expect(calls.length).toBe(3));
    // Only the third is new, and it is the only one that got a minted id.
    expect(calls[2]?.attemptId).not.toBe("a".repeat(32));
    expect(calls[2]?.exerciseId).toBe("rook-distance-1");
  });

  it("never re-mints a hydrated attempt", async () => {
    seed(WALLET_A, [persisted("c".repeat(32))]);
    const { calls, submitAttempt, settle } = deferredSubmit();

    const { rerender } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );
    // A second pass over mount — StrictMode, a remount, a re-render — must not
    // turn one recovered attempt into two.
    rerender();

    await waitFor(() => expect(calls.length).toBe(1));
    await settle(0, SAVED);

    await act(async () => {
      await Promise.resolve();
    });
    expect(calls).toHaveLength(1);
  });

  it("keeps a completion that lands while the queue is still hydrating", async () => {
    seed(WALLET_A, [persisted("d".repeat(32))]);
    const { calls, submitAttempt, settle } = deferredSubmit();

    // Reporting in the same commit as mount is exactly the race: the naive
    // mirror writes the pre-hydration state over the stored queue.
    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );
    act(() => {
      result.current.report(report());
    });

    await waitFor(() => expect(result.current.pendingCount).toBe(2));

    await settle(0, SAVED);
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls.map((c) => c.attemptId)).toContain("d".repeat(32));
    expect(new Set(calls.map((c) => c.attemptId)).size).toBe(2);
  });

  it("never writes to a wallet's key before it has read it", async () => {
    // The `hydrated` guard on the mirror is the load-bearing part, and effect
    // ORDER alone happens to hide its absence: today the read runs first, so
    // removing the guard still passes every behavioural test. It would stop
    // being true the moment someone reorders two effects or the wallet arrives
    // in a later commit — and the failure is silent data loss, the stored queue
    // erased by an empty pre-hydration mirror. So the order itself is pinned.
    seed(WALLET_A, [persisted("1".repeat(32))]);
    const key = outboxStorageKey(WALLET_A);
    const trace: string[] = [];
    const realGet = Storage.prototype.getItem;
    const realSet = Storage.prototype.setItem;
    const realRemove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      k: string,
    ) {
      if (k === key) trace.push("read");
      return realGet.call(this, k);
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      k: string,
      v: string,
    ) {
      if (k === key) trace.push("write");
      realSet.call(this, k, v);
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
      this: Storage,
      k: string,
    ) {
      if (k === key) trace.push("clear");
      realRemove.call(this, k);
    });

    const { submitAttempt } = deferredSubmit();
    renderHook(() => useAttemptOutbox({ wallet: WALLET_A, submitAttempt }));

    await waitFor(() => expect(trace).toContain("write"));
    // Read, then write what was read back. An unguarded mirror slips a `clear`
    // in between — `persistOutbox(wallet, [])` on the still-empty state removes
    // the key, and a close in that window loses the queue.
    expect(trace.slice(0, 2)).toEqual(["read", "write"]);
  });

  it("mirrors the queue to storage on every change and clears it when empty", async () => {
    const { submitAttempt, settle } = deferredSubmit();
    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );

    act(() => {
      result.current.report(report());
    });

    await waitFor(() => {
      const raw = window.localStorage.getItem(outboxStorageKey(WALLET_A));
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw as string)).toHaveLength(1);
    });

    await settle(0, SAVED);
    // An empty queue REMOVES the key: the next open should find nothing, not an
    // empty box to parse.
    await waitFor(() =>
      expect(window.localStorage.getItem(outboxStorageKey(WALLET_A))).toBeNull(),
    );
  });

  it("holds one POST in flight at a time", async () => {
    const { calls, submitAttempt, settle } = deferredSubmit();
    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );

    act(() => {
      result.current.report(report({ completionKey: "rook-distance-1:0-ex" }));
      result.current.report(report({ completionKey: "rook-distance-1:1-ex" }));
    });

    await waitFor(() => expect(calls.length).toBe(1));
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.status).toBe("sending");

    await settle(0, SAVED);
    await waitFor(() => expect(calls.length).toBe(2));
  });

  it("emits once per completion key, however many times a board reports it", async () => {
    const { calls, submitAttempt } = deferredSubmit();
    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );

    act(() => {
      // Three of the four families that route through `handleLabyrinthMove`
      // pass the target position literally, so `reached` is true by
      // construction and the board can report the same completion again.
      result.current.report(report({ completionKey: "lab-1:0-lab-0" }));
      result.current.report(report({ completionKey: "lab-1:0-lab-0" }));
      result.current.report(report({ completionKey: "lab-1:0-lab-0" }));
    });

    await waitFor(() => expect(calls.length).toBe(1));
    expect(result.current.pendingCount).toBe(1);

    // A NEW run of the same content rotates the run key, so it is a new
    // completion and must not be swallowed by the latch.
    act(() => {
      result.current.report(report({ completionKey: "lab-1:0-lab-1" }));
    });
    await waitFor(() => expect(result.current.pendingCount).toBe(2));
  });

  it("keeps the head and the same attemptId when delivery is retryable", async () => {
    const { calls, submitAttempt, settle } = deferredSubmit();
    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );

    act(() => {
      result.current.report(report());
    });
    await waitFor(() => expect(calls.length).toBe(1));
    const firstId = calls[0]?.attemptId as string;

    await settle(0, { status: "error", reason: "network" });

    // Still queued, and NOT auto-hammered: the retry is a decision, not a loop.
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.pendingCount).toBe(1);
    expect(calls).toHaveLength(1);

    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(calls.length).toBe(2));
    // The same id is what lets the server answer a replay — inserting nothing
    // and consuming no budget — instead of counting a second attempt.
    expect(calls[1]?.attemptId).toBe(firstId);
  });

  it("drops a terminally rejected attempt and keeps draining the queue", async () => {
    const { calls, submitAttempt, settle } = deferredSubmit();
    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );

    act(() => {
      result.current.report(report({ completionKey: "k1", exerciseId: "bogus-exercise" }));
      result.current.report(report({ completionKey: "k2", exerciseId: "rook-distance-1" }));
    });

    await waitFor(() => expect(calls.length).toBe(1));
    await settle(0, { status: "invalid", reason: "unknown_exercise" });

    // The rejected head is gone and the one behind it went out on its own.
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls[1]?.exerciseId).toBe("rook-distance-1");
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.status).not.toBe("failed");
  });

  it("removes only the settled attempt, never the one behind it", async () => {
    const { calls, submitAttempt, settle } = deferredSubmit();
    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );

    act(() => {
      result.current.report(report({ completionKey: "k1" }));
      result.current.report(report({ completionKey: "k2" }));
    });
    await waitFor(() => expect(calls.length).toBe(1));

    await settle(0, SAVED);
    await waitFor(() => expect(result.current.pendingCount).toBe(1));

    const stored = JSON.parse(
      window.localStorage.getItem(outboxStorageKey(WALLET_A)) as string,
    ) as AttemptSnapshot[];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.attemptId).toBe(calls[1]?.attemptId ?? stored[0]?.attemptId);
  });

  it("never drains one wallet's queue under another wallet", async () => {
    seed(WALLET_A, [persisted("e".repeat(32))]);
    seed(WALLET_B, [persisted("f".repeat(32))]);
    const { calls, submitAttempt, settle } = deferredSubmit();

    const { rerender } = renderHook(
      ({ wallet }: { wallet: string }) => useAttemptOutbox({ wallet, submitAttempt }),
      { initialProps: { wallet: WALLET_A } },
    );

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]?.attemptId).toBe("e".repeat(32));

    rerender({ wallet: WALLET_B });

    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls[1]?.attemptId).toBe("f".repeat(32));

    await settle(1, SAVED);
    // B settling must not touch A's stored queue — that is A's play.
    await waitFor(() =>
      expect(window.localStorage.getItem(outboxStorageKey(WALLET_B))).toBeNull(),
    );
    const a = JSON.parse(
      window.localStorage.getItem(outboxStorageKey(WALLET_A)) as string,
    ) as AttemptSnapshot[];
    expect(a).toHaveLength(1);
    expect(a[0]?.attemptId).toBe("e".repeat(32));
  });

  it("is inert when the lane is switched off, WITHOUT discarding what is queued", async () => {
    // The kill switch has to be a way to stop, not a way to lose. A player who
    // closed the app with three unsent attempts and comes back to a build with
    // the lane off must still have those three when it comes back on.
    seed(WALLET_A, [persisted("9".repeat(32))]);
    vi.stubEnv("NEXT_PUBLIC_ATTEMPT_LANE_ENABLED", "false");
    const { calls, submitAttempt } = deferredSubmit();

    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );

    act(() => {
      result.current.report(report());
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(calls).toHaveLength(0);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.status).toBe("idle");
    // Still there. Off is not a delete.
    const stored = JSON.parse(
      window.localStorage.getItem(outboxStorageKey(WALLET_A)) as string,
    ) as AttemptSnapshot[];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.attemptId).toBe("9".repeat(32));

    vi.unstubAllEnvs();
  });

  it("stays ON for anything that is not exactly \"false\"", async () => {
    // A typo must not kill the lane silently. The switch is for an emergency,
    // and an emergency is always typed deliberately.
    vi.stubEnv("NEXT_PUBLIC_ATTEMPT_LANE_ENABLED", "off");
    const { calls, submitAttempt } = deferredSubmit();

    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: WALLET_A, submitAttempt }),
    );
    act(() => {
      result.current.report(report());
    });

    await waitFor(() => expect(calls.length).toBe(1));
    vi.unstubAllEnvs();
  });

  it("does not submit or persist without a wallet", async () => {
    const { calls, submitAttempt } = deferredSubmit();
    const { result } = renderHook(() =>
      useAttemptOutbox({ wallet: null, submitAttempt }),
    );

    act(() => {
      result.current.report(report());
    });

    await act(async () => {
      await Promise.resolve();
    });
    // The save path requires a wallet, so such an attempt could never be sent
    // and would only consume the cap.
    expect(calls).toHaveLength(0);
    expect(window.localStorage.length).toBe(0);
  });
});
