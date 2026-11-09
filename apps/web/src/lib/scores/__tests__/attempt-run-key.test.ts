/**
 * Run key — DEBT-1 of Slice 3.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D19 +
 * "Blocking implementation debt").
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * D19 puts exactly-once in a latch keyed on `${contentId}:${runKey}`, and says
 * the run key is "the value React already uses as the board's key ... which
 * rotates precisely when a new attempt begins". Round 7 found that was true for
 * three of the four counters: `resetBoard()` rotated `boardKey`,
 * `safePathResetKey` and `promotionRunResetKey` but NOT `labyrinthKey`, the run
 * key of Diagonal Run, Knight's Tour and N-Queens. The latch would have stayed
 * closed on their second attempt — a silent under-count with a 200 on the wire.
 *
 * The counters therefore stop being four independent `useState`s in a 4200-line
 * component and become this reducer, so "does the key rotate on the path that
 * starts the next attempt" is a question with an answer instead of an argument
 * about board internals — which is the thing D19 exists to stop relying on.
 */

import { describe, expect, it } from "vitest";

import {
  ATTEMPT_FAMILIES,
  boardRunKeysReducer,
  completionKeyFor,
  initialBoardRunKeys,
  runKeyFor,
  type AttemptFamily,
  type BoardRunKeys,
  type RunKeyEvent,
} from "../attempt-run-key";

function apply(state: BoardRunKeys, ...events: RunKeyEvent[]): BoardRunKeys {
  return events.reduce(boardRunKeysReducer, state);
}

/**
 * The path that starts the next attempt, per family. This table IS the DEBT-1
 * requirement ("assert the key rotates on the path that starts its next
 * attempt"); every family in `ATTEMPT_FAMILIES` must appear in it.
 *
 * - `board_reset` is `resetBoard()` — the rescue paths: shield, skip, retry
 *   after a failure, server error, auto-reset.
 * - `content_started` is `requestTrainingContent()` — the Retry button on the
 *   labyrinth completion overlay routes here (exercises-screen.tsx:3989-3996),
 *   as does auto-advance into the next challenge.
 */
const NEXT_ATTEMPT_PATHS: Record<AttemptFamily, RunKeyEvent["type"][]> = {
  exercise: ["board_reset"],
  labyrinth: ["board_reset", "content_started"],
  "diagonal-run": ["board_reset", "content_started"],
  "knight-tour": ["board_reset", "content_started"],
  queens: ["board_reset", "content_started"],
  "safe-path": ["board_reset", "content_started"],
  "promotion-run": ["board_reset", "content_started"],
};

describe("run key — rotation per family (DEBT-1)", () => {
  it("covers every family the assemblers can complete", () => {
    expect(Object.keys(NEXT_ATTEMPT_PATHS).sort()).toEqual(
      [...ATTEMPT_FAMILIES].sort(),
    );
  });

  for (const family of ATTEMPT_FAMILIES) {
    for (const path of NEXT_ATTEMPT_PATHS[family]) {
      it(`${family}: ${path} rotates its run key`, () => {
        const before = runKeyFor(family, initialBoardRunKeys);
        const after = runKeyFor(
          family,
          boardRunKeysReducer(initialBoardRunKeys, { type: path }),
        );
        expect(after).not.toBe(before);
      });
    }
  }

  it("board_reset rotates ALL four counters — this is the round-7 fix", () => {
    const next = boardRunKeysReducer(initialBoardRunKeys, { type: "board_reset" });
    expect(next).toEqual({
      board: 1,
      labyrinth: 1,
      safePath: 1,
      promotionRun: 1,
    });
  });

  it("never comes BACK to a run key it already left", () => {
    // Staying on the same key is correct — it means no new attempt started for
    // that family. Returning to an old one is not: the latch would treat a
    // fresh completion as a replay of the earlier attempt and drop it.
    let state = initialBoardRunKeys;
    const retired = new Map<AttemptFamily, Set<string>>(
      ATTEMPT_FAMILIES.map((f) => [f, new Set<string>()]),
    );
    const current = new Map<AttemptFamily, string>(
      ATTEMPT_FAMILIES.map((f) => [f, runKeyFor(f, state)]),
    );
    const script: RunKeyEvent[] = [
      { type: "board_reset" },
      { type: "content_started" },
      { type: "board_reset" },
      { type: "board_reset" },
      { type: "content_started" },
    ];
    for (const event of script) {
      state = boardRunKeysReducer(state, event);
      for (const family of ATTEMPT_FAMILIES) {
        const key = runKeyFor(family, state);
        if (key === current.get(family)) continue;
        expect(retired.get(family)!.has(key)).toBe(false);
        retired.get(family)!.add(current.get(family)!);
        current.set(family, key);
      }
    }
  });

  it("is inert for an event it does not know", () => {
    const state = apply(initialBoardRunKeys, { type: "board_reset" });
    // The reducer governs remounts; an unknown event must not rotate a key and
    // silently reopen a latch mid-attempt.
    const next = boardRunKeysReducer(state, {
      type: "not_a_real_event",
    } as unknown as RunKeyEvent);
    expect(next).toEqual(state);
  });
});

describe("completion key", () => {
  it("separates two attempts at the SAME content", () => {
    const first = completionKeyFor(
      "dr-bishop-1",
      runKeyFor("diagonal-run", initialBoardRunKeys),
    );
    const second = completionKeyFor(
      "dr-bishop-1",
      runKeyFor(
        "diagonal-run",
        apply(initialBoardRunKeys, { type: "content_started" }),
      ),
    );
    expect(second).not.toBe(first);
  });

  it("is stable for one attempt reported twice — the latch case", () => {
    const state = apply(initialBoardRunKeys, { type: "content_started" });
    const key = runKeyFor("queens", state);
    expect(completionKeyFor("q-queen-1", key)).toBe(
      completionKeyFor("q-queen-1", runKeyFor("queens", state)),
    );
  });

  it("separates two different contents on the same run counters", () => {
    const key = runKeyFor("knight-tour", initialBoardRunKeys);
    expect(completionKeyFor("kt-knight-1", key)).not.toBe(
      completionKeyFor("kt-knight-2", key),
    );
  });
});

describe("run key — mirrors what React uses as the board key", () => {
  it("safe-path and promotion-run also rotate on their own resetKey", () => {
    // Their boards take a `resetKey` prop instead of remounting, so a bump of
    // that counter alone still starts a new attempt.
    const state: BoardRunKeys = {
      board: 3,
      labyrinth: 2,
      safePath: 4,
      promotionRun: 1,
    };
    const bumpedSafePath: BoardRunKeys = { ...state, safePath: 5 };
    const bumpedPromotion: BoardRunKeys = { ...state, promotionRun: 2 };

    expect(runKeyFor("safe-path", bumpedSafePath)).not.toBe(
      runKeyFor("safe-path", state),
    );
    expect(runKeyFor("promotion-run", bumpedPromotion)).not.toBe(
      runKeyFor("promotion-run", state),
    );
  });

  it("does not couple families that share no counter", () => {
    const state: BoardRunKeys = {
      board: 1,
      labyrinth: 1,
      safePath: 1,
      promotionRun: 1,
    };
    // A Safe Path reset must not look like a new Knight's Tour run.
    const bumped: BoardRunKeys = { ...state, safePath: 2 };
    expect(runKeyFor("knight-tour", bumped)).toBe(runKeyFor("knight-tour", state));
  });
});
