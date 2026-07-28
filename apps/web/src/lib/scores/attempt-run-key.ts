/**
 * Run key — the rotating half of a completion's identity.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D19).
 *
 * WHAT THIS IS
 * ------------
 * D19 makes exactly-once a latch in the host assemblers, keyed on
 * `${contentId}:${runKey}`. The run key is the value React uses as the board's
 * `key` (or `resetKey`), because that is exactly what rotates when a new attempt
 * begins — nothing else has to be invented, and no parallel counter can drift
 * away from what the player sees.
 *
 * WHY IT IS A MODULE AND NOT FOUR useState CALLS
 * ----------------------------------------------
 * It WAS four `useState`s in `exercises-screen.tsx`, and round 7 of the red team
 * found the hole that arrangement hides: `resetBoard()` bumped `boardKey`,
 * `safePathResetKey` and `promotionRunResetKey` and left `labyrinthKey` — the
 * run key of Diagonal Run, Knight's Tour and N-Queens — untouched. Those three
 * boards happen to have no `resetKey`, so their only reset is the remount that
 * `labyrinthKey` drives, which probably kept the latch honest. "Probably,
 * because of how the board works internally" is the exact reasoning D19 exists
 * to retire, and its failure mode is silent: the latch stays closed, the second
 * completion emits nothing, and the wire says 200.
 *
 * As one reducer, "does this path rotate the key" is a unit test per family
 * (`__tests__/attempt-run-key.test.ts`) instead of an argument.
 */

/** Every family a host assembler can complete. */
export const ATTEMPT_FAMILIES = [
  "exercise",
  "labyrinth",
  "diagonal-run",
  "knight-tour",
  "queens",
  "safe-path",
  "promotion-run",
] as const;

export type AttemptFamily = (typeof ATTEMPT_FAMILIES)[number];

/**
 * The four counters the screen feeds to React. Names are the screen's, minus
 * the `Key`/`ResetKey` suffix that only existed to disambiguate four variables
 * in one scope.
 */
export type BoardRunKeys = {
  /** `boardKey` — the generic `Board`. */
  board: number;
  /** `labyrinthKey` — every labyrinth-mode board. */
  labyrinth: number;
  /** `safePathResetKey` — walks the king back to the start (D5). */
  safePath: number;
  /** `promotionRunResetKey` — sends the pawn back to the start. */
  promotionRun: number;
};

/**
 * The two host paths that start a next attempt.
 *
 * There is deliberately no third: a completion does NOT rotate anything (the
 * overlay stays up over the finished board), and no board event reaches here.
 */
export type RunKeyEvent =
  /** `resetBoard()` — shield, skip, retry after failure, server error, auto-reset. */
  | { type: "board_reset" }
  /** `requestTrainingContent()` — overlay Retry, auto-advance, explicit tap. */
  | { type: "content_started" };

export const initialBoardRunKeys: BoardRunKeys = {
  board: 0,
  labyrinth: 0,
  safePath: 0,
  promotionRun: 0,
};

export function boardRunKeysReducer(
  state: BoardRunKeys,
  event: RunKeyEvent,
): BoardRunKeys {
  switch (event.type) {
    case "board_reset":
      // ALL FOUR. This is the round-7 fix: `labyrinth` used to be left behind,
      // which left the latch closed for the three families keyed on it.
      // Rotating it here also matches what a reset MEANS for them — those
      // boards have no soft reset, so starting over is a remount.
      return {
        board: state.board + 1,
        labyrinth: state.labyrinth + 1,
        safePath: state.safePath + 1,
        promotionRun: state.promotionRun + 1,
      };
    case "content_started":
      // Opening content remounts the labyrinth-mode boards only; the generic
      // Board's next attempt always arrives through `resetBoard`.
      return { ...state, labyrinth: state.labyrinth + 1 };
    default:
      // Inert on purpose, like the lifecycle reducer: an unknown event must
      // never rotate a key and reopen a latch in the middle of an attempt.
      return state;
  }
}

/**
 * The rotating part of one family's React key, without the content id (the
 * completion key carries that separately).
 *
 * Each case mirrors `exercises-screen.tsx` exactly — see the board ternary
 * chain at `:3670-3746`. A family that reads a counter it does not remount on
 * would reopen its latch for someone else's reset.
 */
export function runKeyFor(family: AttemptFamily, keys: BoardRunKeys): string {
  switch (family) {
    case "exercise":
      return `${keys.board}-ex`;
    case "labyrinth":
      // `key={`${boardKey}-${labyrinthMode ? `lab-${labyrinthKey}` : "ex"}`}`
      return `${keys.board}-lab-${keys.labyrinth}`;
    case "diagonal-run":
    case "knight-tour":
    case "queens":
      return `${keys.labyrinth}`;
    case "safe-path":
      // Remounts on `labyrinthKey`, soft-resets on `resetKey` — both start a
      // new run, so both belong in the identity.
      return `${keys.labyrinth}-${keys.safePath}`;
    case "promotion-run":
      return `${keys.labyrinth}-${keys.promotionRun}`;
  }
}

/** Canonical identity of ONE logical completion (D19). */
export type CompletionKey = `${string}:${string}`;

export function completionKeyFor(
  contentId: string,
  runKey: string,
): CompletionKey {
  return `${contentId}:${runKey}`;
}
