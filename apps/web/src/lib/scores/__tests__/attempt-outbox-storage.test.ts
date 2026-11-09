/**
 * Persisted outbox — DEBT-2 of Slice 3.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D20 +
 * "Blocking implementation debt").
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * D20 says a completed attempt survives until the SERVER confirms it. In memory
 * that holds for the life of the page — and on MiniPay the normal way to leave
 * is to close the app. This repo already had to persist the score session for
 * exactly that reason (87e35e35, device-verified).
 *
 * The exposure concentrates where it hurts: a snapshot only sits in the outbox
 * while a POST is pending or failing, i.e. when the network is bad, which is
 * when the app gets closed.
 *
 * The queue is namespaced BY WALLET. An attempt is credited to whoever is
 * connected when it drains, so a device that switches accounts must not hand
 * wallet A's attempts to wallet B — that is score attribution, not a cache.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  attemptLifecycleReducer,
  initialAttemptLifecycleState,
  OUTBOX_MAX,
  selectNextSubmission,
  type AttemptSnapshot,
} from "../attempt-lifecycle";
import {
  clearPersistedOutbox,
  outboxStorageKey,
  persistOutbox,
  readPersistedOutbox,
} from "../attempt-outbox-storage";

const WALLET = "0xAbC0000000000000000000000000000000000001";
const OTHER_WALLET = "0xdef0000000000000000000000000000000000002";

function snapshot(overrides: Partial<AttemptSnapshot> = {}): AttemptSnapshot {
  return {
    attemptId: "a".repeat(32),
    exerciseId: "rook-distance-1",
    measurement: { kind: "moves", movesUsed: 4 },
    timeMs: 12_000,
    levelId: 1,
    score: 300,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("storage key", () => {
  it("is versioned and namespaced by wallet, case-insensitively", () => {
    expect(outboxStorageKey(WALLET)).toBe(
      `chesscito:attempt-outbox:v1:${WALLET.toLowerCase()}`,
    );
    expect(outboxStorageKey(WALLET.toLowerCase())).toBe(outboxStorageKey(WALLET));
  });

  it("gives two wallets two queues", () => {
    persistOutbox(WALLET, [snapshot({ attemptId: "a".repeat(32) })]);
    persistOutbox(OTHER_WALLET, [snapshot({ attemptId: "b".repeat(32) })]);

    expect(readPersistedOutbox(WALLET)[0].attemptId).toBe("a".repeat(32));
    expect(readPersistedOutbox(OTHER_WALLET)[0].attemptId).toBe("b".repeat(32));
  });
});

describe("round trip", () => {
  it("returns what it stored, in order", () => {
    const queued = [
      snapshot({ attemptId: "a".repeat(32) }),
      snapshot({ attemptId: "b".repeat(32), measurement: { kind: "failures", failures: 2 } }),
      snapshot({
        attemptId: "c".repeat(32),
        measurement: { kind: "coverage", reached: 40, ceiling: 64 },
      }),
    ];
    persistOutbox(WALLET, queued);

    expect(readPersistedOutbox(WALLET)).toEqual(queued);
  });

  it("reads an empty queue as empty, not as an error", () => {
    expect(readPersistedOutbox(WALLET)).toEqual([]);
  });

  it("removes the key when the queue drains, instead of leaving `[]` behind", () => {
    persistOutbox(WALLET, [snapshot()]);
    persistOutbox(WALLET, []);

    expect(localStorage.getItem(outboxStorageKey(WALLET))).toBeNull();
  });

  it("clears one wallet without touching the other", () => {
    persistOutbox(WALLET, [snapshot()]);
    persistOutbox(OTHER_WALLET, [snapshot({ attemptId: "b".repeat(32) })]);
    clearPersistedOutbox(WALLET);

    expect(readPersistedOutbox(WALLET)).toEqual([]);
    expect(readPersistedOutbox(OTHER_WALLET)).toHaveLength(1);
  });

  it("keeps the same cap the in-memory queue uses", () => {
    const many = Array.from({ length: OUTBOX_MAX + 5 }, (_, i) =>
      snapshot({ attemptId: String(i).padStart(32, "f") }),
    );
    persistOutbox(WALLET, many);

    const read = readPersistedOutbox(WALLET);
    expect(read).toHaveLength(OUTBOX_MAX);
    // The OLDEST is dropped, same rule as the reducer.
    expect(read[read.length - 1].attemptId).toBe(many[many.length - 1].attemptId);
  });

  it("does not persist without a wallet — such an attempt can never be sent", () => {
    persistOutbox(null, [snapshot()]);

    expect(localStorage.length).toBe(0);
    expect(readPersistedOutbox(null)).toEqual([]);
  });
});

describe("corrupt storage is discarded in silence", () => {
  const corrupt: Array<[string, string]> = [
    ["not JSON", "}{"],
    ["JSON that is not an array", JSON.stringify({ outbox: [] })],
    ["a string where a snapshot goes", JSON.stringify(["nope"])],
    ["null in the array", JSON.stringify([null])],
    [
      "an attemptId of the wrong shape",
      JSON.stringify([{ ...snapshot(), attemptId: "TOO-SHORT" }]),
    ],
    [
      "an unknown measurement kind",
      JSON.stringify([{ ...snapshot(), measurement: { kind: "vibes", n: 1 } }]),
    ],
    [
      "a measurement missing its number",
      JSON.stringify([{ ...snapshot(), measurement: { kind: "moves" } }]),
    ],
    ["a timeMs that is not finite", JSON.stringify([{ ...snapshot(), timeMs: null }])],
    ["a missing exerciseId", JSON.stringify([{ ...snapshot(), exerciseId: undefined }])],
    ["a levelId that is a string", JSON.stringify([{ ...snapshot(), levelId: "1" }])],
  ];

  for (const [label, raw] of corrupt) {
    it(`drops ${label} and deletes the key`, () => {
      localStorage.setItem(outboxStorageKey(WALLET), raw);

      expect(readPersistedOutbox(WALLET)).toEqual([]);
      expect(localStorage.getItem(outboxStorageKey(WALLET))).toBeNull();
    });
  }

  it("keeps the valid snapshots when only one entry is rotten", () => {
    // A queue is not a credential: delivering three of four beats delivering
    // none. The version in the key is what handles a real shape change.
    const good = snapshot({ attemptId: "a".repeat(32) });
    localStorage.setItem(
      outboxStorageKey(WALLET),
      JSON.stringify([good, { ...snapshot(), attemptId: "nope" }]),
    );

    expect(readPersistedOutbox(WALLET)).toEqual([good]);
  });
});

describe("a reload still delivers the unsent attempt exactly once (D20)", () => {
  it("survives the close and drains on the next open", () => {
    // Session 1: one completion, one POST that fails, then the app is closed.
    const mint = () => "a".repeat(32);
    let state = attemptLifecycleReducer(
      initialAttemptLifecycleState,
      {
        type: "completed",
        snapshot: {
          exerciseId: "rook-distance-1",
          measurement: { kind: "moves", movesUsed: 4 },
          timeMs: 12_000,
          levelId: 1,
          score: 300,
        },
      },
      mint,
    );
    state = attemptLifecycleReducer(state, {
      type: "submission_started",
      attemptId: "a".repeat(32),
    });
    state = attemptLifecycleReducer(state, {
      type: "submission_failed",
      attemptId: "a".repeat(32),
    });
    persistOutbox(WALLET, state.outbox);

    // Session 2: fresh state, hydrated from storage before anything is minted.
    let next = attemptLifecycleReducer(initialAttemptLifecycleState, {
      type: "hydrated",
      snapshots: readPersistedOutbox(WALLET),
    });

    const pending = selectNextSubmission(next);
    expect(pending?.attemptId).toBe("a".repeat(32));
    // Same id → the server answers it as a replay, so a survived attempt can
    // never become a second one even if session 1's POST did land.
    expect(pending?.exerciseId).toBe("rook-distance-1");

    next = attemptLifecycleReducer(next, {
      type: "submission_settled",
      attemptId: "a".repeat(32),
    });
    persistOutbox(WALLET, next.outbox);

    expect(selectNextSubmission(next)).toBeNull();
    expect(readPersistedOutbox(WALLET)).toEqual([]);
  });

  it("hydrating twice does not queue the same attempt twice", () => {
    const stored = [snapshot({ attemptId: "a".repeat(32) })];
    let state = attemptLifecycleReducer(initialAttemptLifecycleState, {
      type: "hydrated",
      snapshots: stored,
    });
    state = attemptLifecycleReducer(state, { type: "hydrated", snapshots: stored });

    expect(state.outbox).toHaveLength(1);
  });

  it("puts hydrated attempts BEFORE anything minted in this session", () => {
    let state = attemptLifecycleReducer(
      initialAttemptLifecycleState,
      {
        type: "completed",
        snapshot: {
          exerciseId: "rook-no-diagonal-1",
          measurement: { kind: "moves", movesUsed: 6 },
          timeMs: 9_000,
          levelId: 1,
          score: 400,
        },
      },
      () => "b".repeat(32),
    );
    state = attemptLifecycleReducer(state, {
      type: "hydrated",
      snapshots: [snapshot({ attemptId: "a".repeat(32) })],
    });

    // The older attempt is the one that has been waiting through an outage.
    expect(state.outbox.map((s) => s.attemptId)).toEqual([
      "a".repeat(32),
      "b".repeat(32),
    ]);
  });

  it("does not resurrect an attempt that is already in flight", () => {
    let state = attemptLifecycleReducer(
      initialAttemptLifecycleState,
      {
        type: "completed",
        snapshot: {
          exerciseId: "rook-distance-1",
          measurement: { kind: "moves", movesUsed: 4 },
          timeMs: 12_000,
          levelId: 1,
          score: 300,
        },
      },
      () => "a".repeat(32),
    );
    state = attemptLifecycleReducer(state, {
      type: "submission_started",
      attemptId: "a".repeat(32),
    });
    state = attemptLifecycleReducer(state, {
      type: "hydrated",
      snapshots: [snapshot({ attemptId: "a".repeat(32) })],
    });

    expect(state.outbox).toHaveLength(1);
    expect(state.inFlight).toBe("a".repeat(32));
  });

  it("caps the queue after hydration", () => {
    const stored = Array.from({ length: OUTBOX_MAX }, (_, i) =>
      snapshot({ attemptId: String(i).padStart(32, "e") }),
    );
    let state = attemptLifecycleReducer(
      initialAttemptLifecycleState,
      {
        type: "completed",
        snapshot: {
          exerciseId: "rook-distance-1",
          measurement: { kind: "moves", movesUsed: 4 },
          timeMs: 12_000,
          levelId: 1,
          score: 300,
        },
      },
      () => "f".repeat(32),
    );
    state = attemptLifecycleReducer(state, { type: "hydrated", snapshots: stored });

    expect(state.outbox).toHaveLength(OUTBOX_MAX);
    // The session's own completion is the newest, so it is the one kept.
    expect(state.outbox[state.outbox.length - 1].attemptId).toBe("f".repeat(32));
  });
});

describe("storage failures degrade comfort, never correctness", () => {
  it("survives a write that throws (quota / private mode)", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      expect(() => persistOutbox(WALLET, [snapshot()])).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it("survives a read that throws", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("SecurityError");
    };
    try {
      expect(readPersistedOutbox(WALLET)).toEqual([]);
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
