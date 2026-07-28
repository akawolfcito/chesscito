/**
 * Attempt lifecycle — the decisive tests for Slice 3.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D11/D20).
 *
 * These run against the pure reducer, NOT against `exercises-screen.tsx`, by
 * design: the screen is ~4200 lines wired to wagmi, Supabase and the catalogue,
 * and nothing in this repo mounts it. Rounds 1-6 of the red team established
 * that a test which only exercises `postScoreSave` passes on the broken
 * lifecycle, so the invariant lives here where it can actually fail.
 */

import { describe, expect, it } from "vitest";

import {
  attemptLifecycleReducer,
  initialAttemptLifecycleState,
  isAttemptIdShape,
  OUTBOX_MAX,
  selectNextSubmission,
  type AttemptEvent,
  type AttemptLifecycleState,
} from "../attempt-lifecycle";

/** Deterministic mint so assertions can name the ids they expect. */
function sequentialMint() {
  let n = 0;
  return () => {
    n += 1;
    return String(n).padStart(32, "0");
  };
}

function completed(
  overrides: Partial<{ exerciseId: string; movesUsed: number; score: number }> = {},
): AttemptEvent {
  return {
    type: "completed",
    snapshot: {
      exerciseId: overrides.exerciseId ?? "rook-distance-1",
      measurement: { kind: "moves", movesUsed: overrides.movesUsed ?? 4 },
      timeMs: 12_000,
      levelId: 1,
      score: overrides.score ?? 300,
    },
  };
}

function reduce(
  events: AttemptEvent[],
  mint = sequentialMint(),
  from: AttemptLifecycleState = initialAttemptLifecycleState,
): AttemptLifecycleState {
  return events.reduce((s, e) => attemptLifecycleReducer(s, e, mint), from);
}

describe("attemptLifecycleReducer — completion mints and enqueues", () => {
  it("enqueues one snapshot carrying a minted attemptId", () => {
    const state = reduce([completed()]);

    expect(state.outbox).toHaveLength(1);
    expect(state.outbox[0].attemptId).toBe("0".repeat(31) + "1");
    expect(state.outbox[0].exerciseId).toBe("rook-distance-1");
    expect(state.outbox[0].measurement).toEqual({ kind: "moves", movesUsed: 4 });
    expect(state.inFlight).toBeNull();
  });

  it("mints a 32-lowercase-hex id by default", () => {
    const state = attemptLifecycleReducer(initialAttemptLifecycleState, completed());
    expect(isAttemptIdShape(state.outbox[0].attemptId)).toBe(true);
  });

  it("mints a DIFFERENT id for a second completion", () => {
    const state = reduce([completed(), completed({ exerciseId: "rook-no-diagonal-1" })]);

    expect(state.outbox).toHaveLength(2);
    expect(state.outbox[0].attemptId).not.toBe(state.outbox[1].attemptId);
  });

  it("mints on a completion whose cumulative score did not change", () => {
    // The ceiling player, and every carril-2 completion: `score` is identical
    // because carril-2 stars never reach `pieceStars` (exercises-screen.tsx:3168).
    const state = reduce([completed({ score: 300 }), completed({ score: 300 })]);

    expect(state.outbox).toHaveLength(2);
    expect(state.outbox[0].attemptId).not.toBe(state.outbox[1].attemptId);
  });
});

describe("selectNextSubmission — one POST at a time, FIFO", () => {
  it("returns null on an empty outbox", () => {
    expect(selectNextSubmission(initialAttemptLifecycleState)).toBeNull();
  });

  it("returns the oldest queued snapshot", () => {
    const state = reduce([completed({ exerciseId: "a" }), completed({ exerciseId: "b" })]);
    expect(selectNextSubmission(state)?.exerciseId).toBe("a");
  });

  it("returns null while a submission is in flight", () => {
    const mint = sequentialMint();
    const state = reduce([completed(), completed()], mint);
    const first = state.outbox[0].attemptId;
    const busy = attemptLifecycleReducer(
      state,
      { type: "submission_started", attemptId: first },
      mint,
    );

    expect(busy.inFlight).toBe(first);
    expect(selectNextSubmission(busy)).toBeNull();
  });
});

describe("at-least-once — an attempt survives until the server confirms IT", () => {
  it("settling A removes only A, never B", () => {
    const mint = sequentialMint();
    let state = reduce([completed({ exerciseId: "a" }), completed({ exerciseId: "b" })], mint);
    const a = state.outbox[0].attemptId;
    const b = state.outbox[1].attemptId;

    state = attemptLifecycleReducer(state, { type: "submission_started", attemptId: a }, mint);
    state = attemptLifecycleReducer(state, { type: "submission_settled", attemptId: a }, mint);

    expect(state.outbox.map((s) => s.attemptId)).toEqual([b]);
    expect(state.inFlight).toBeNull();
    expect(selectNextSubmission(state)?.exerciseId).toBe("b");
  });

  it("a failed submission KEEPS its snapshot and frees the lane", () => {
    const mint = sequentialMint();
    let state = reduce([completed()], mint);
    const a = state.outbox[0].attemptId;

    state = attemptLifecycleReducer(state, { type: "submission_started", attemptId: a }, mint);
    state = attemptLifecycleReducer(state, { type: "submission_failed", attemptId: a }, mint);

    expect(state.outbox).toHaveLength(1);
    expect(state.inFlight).toBeNull();
    // The retry re-sends the SAME id, which the server answers as a replay —
    // so a retry can never become a second attempt.
    expect(selectNextSubmission(state)?.attemptId).toBe(a);
  });

  it("settling an id that is not queued changes nothing", () => {
    const state = reduce([completed()]);
    const after = attemptLifecycleReducer(state, {
      type: "submission_settled",
      attemptId: "f".repeat(32),
    });

    expect(after.outbox).toHaveLength(1);
  });

  it("has NO event that clears an unsent attempt (D20, structural)", () => {
    // resetBoard() is called from ~20 sites, several on timers right after a
    // completion. The mechanism is that the reducer cannot hear about any of
    // them: an unknown event must be inert, and no reset/exercise-change member
    // exists in AttemptEvent.
    const state = reduce([completed()]);
    const after = attemptLifecycleReducer(state, {
      type: "attempt_started",
    } as unknown as AttemptEvent);

    expect(after.outbox).toHaveLength(1);
    expect(after.outbox[0].attemptId).toBe(state.outbox[0].attemptId);
  });

  it("caps the outbox at OUTBOX_MAX, dropping the OLDEST", () => {
    const mint = sequentialMint();
    const events = Array.from({ length: OUTBOX_MAX + 3 }, (_, i) =>
      completed({ exerciseId: `ex-${i}` }),
    );
    const state = reduce(events, mint);

    expect(state.outbox).toHaveLength(OUTBOX_MAX);
    expect(state.outbox[0].exerciseId).toBe("ex-3");
    expect(state.outbox.at(-1)?.exerciseId).toBe(`ex-${OUTBOX_MAX + 2}`);
  });
});
