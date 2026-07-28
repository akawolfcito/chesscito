/**
 * Attempt measurement — the raw number a completed attempt reports.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D12/D15).
 *
 * WHY A DISCRIMINATED UNION AND NOT A PAIR OF NUMBERS
 * ---------------------------------------------------
 * The catalogue grades seven buckets with five different functions, and three of
 * them share the shape `(number, number) => number` while meaning opposite
 * things:
 *
 *   computeStars(movesUsed, optimalMoves)   lower is better   scoring.ts:9
 *   labyrinthStars(moves, optimal)          lower is better   exercises.ts:228
 *   tourStars(visited, reachable)           HIGHER is better  tour-score.ts:35
 *   promotionRunStars(failures)             failures, NOT moves
 *
 * `handleLabyrinthMove` already documents what happens when they are mixed up:
 * "Both are `number`; nothing would complain" (exercises-screen.tsx:3124-3130).
 * A wrong dispatch there does not throw — it hands out three stars to everyone.
 *
 * So the measurement names its own kind, the catalogue bucket names the grader,
 * and a mismatch between the two is a 400 rather than a plausible wrong number.
 * The client never picks the grader and never sends a star count (D12).
 */

/** The raw result of one completed attempt, tagged with what it measures. */
export type AttemptMeasurement =
  | { kind: "moves"; movesUsed: number }
  | { kind: "failures"; failures: number }
  | { kind: "coverage"; reached: number; ceiling: number };

/** Measurement kinds as they are persisted in `score_attempts.measure_kind`. */
export type AttemptMeasureKind = AttemptMeasurement["kind"];

/**
 * Why `stars_earned` is what it is. There are no sentinels: NULL means unknown,
 * 0 means a real run that earned zero (labyrinthStars above optimal+4, tourStars
 * below the 80% pass line).
 *
 *   graded   — a grader ran; starsEarned is 0..3 and is a real result
 *   starless — Knight's Tour: measured, awards no stars by product decision
 *              (content-stars.ts:9-24, D15)
 *   ungraded — a legacy bundle sent no measurement; genuinely unknown
 */
export type AttemptGradeStatus = "graded" | "starless" | "ungraded";

export type GradeFailureReason =
  | "unknown_exercise"
  | "level_mismatch"
  | "measurement_kind_mismatch"
  | "measurement_out_of_range";

export type GradeResult =
  | { ok: true; grade: "graded"; starsEarned: 0 | 1 | 2 | 3 }
  | { ok: true; grade: "starless"; starsEarned: null }
  | { ok: false; reason: GradeFailureReason };

/**
 * Upper bound for a `moves` measurement, per exercise.
 *
 * Applies ONLY to the four move-graded buckets (exercise, labyrinth,
 * diagonal-run, safe-path). The other three do not carry `movesUsed` at all,
 * and their `optimalMoves` is not a move count: for `queens` it is the queens
 * the player places, for `knightTour` the reachable ceiling
 * (catalog.ts:98-110).
 *
 * `8x` covers a player who wanders; the floor of 60 covers short-optimal
 * exercises where `8x` would be tighter than a plausible completion.
 */
export const MOVES_CEILING_FACTOR = 8;
export const MOVES_CEILING_FLOOR = 60;

export function movesCeiling(optimalMoves: number): number {
  return Math.max(MOVES_CEILING_FLOOR, MOVES_CEILING_FACTOR * optimalMoves);
}

/**
 * `promotionRunStars` saturates at 2 failures, so this bound rejects only
 * absurdity — it is not a difficulty statement.
 */
export const MAX_ATTEMPT_FAILURES = 99;

/** `Number.isSafeInteger` rejects NaN, Infinity, negatives and fractions at once
 *  — `typeof v === "number"` accepts all of them. Same predicate the score
 *  bounds use (save-authorization.ts:102-104). */
function isNonNegativeInt(v: number): boolean {
  return Number.isSafeInteger(v) && v >= 0;
}

/**
 * Parse an untrusted `measurement` field off the wire.
 *
 * SHAPE ONLY — this says "the client sent something that could be a
 * measurement", never "the measurement is plausible". Range is
 * `isMeasurementInRange`, and which kind this bucket accepts is `gradeAttempt`.
 * Three gates, three answers, because collapsing them would make a
 * `measurement_kind_mismatch` indistinguishable from a malformed body.
 *
 * `null` means "not a measurement". An ABSENT measurement is not this
 * function's business: the caller decides that an absent one is `ungraded`
 * (B15), while a present-but-broken one is a 400.
 */
export function parseAttemptMeasurement(v: unknown): AttemptMeasurement | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const raw = v as Record<string, unknown>;
  const num = (x: unknown): number | null =>
    typeof x === "number" && Number.isSafeInteger(x) ? x : null;

  switch (raw.kind) {
    case "moves": {
      const movesUsed = num(raw.movesUsed);
      return movesUsed === null ? null : { kind: "moves", movesUsed };
    }
    case "failures": {
      const failures = num(raw.failures);
      return failures === null ? null : { kind: "failures", failures };
    }
    case "coverage": {
      const reached = num(raw.reached);
      const ceiling = num(raw.ceiling);
      if (reached === null || ceiling === null) return null;
      return { kind: "coverage", reached, ceiling };
    }
    default:
      // An unknown kind is malformed, NOT a mismatch: there is no bucket it
      // could have belonged to.
      return null;
  }
}

/** Shape + range gate for a measurement, before it reaches the grader. */
export function isMeasurementInRange(
  measurement: AttemptMeasurement,
  limits: { movesCeiling?: number; coverageCeiling?: number },
): boolean {
  switch (measurement.kind) {
    case "moves": {
      const { movesUsed } = measurement;
      if (!isNonNegativeInt(movesUsed) || movesUsed < 1) return false;
      return limits.movesCeiling !== undefined && movesUsed <= limits.movesCeiling;
    }
    case "failures": {
      const { failures } = measurement;
      return isNonNegativeInt(failures) && failures <= MAX_ATTEMPT_FAILURES;
    }
    case "coverage": {
      const { reached, ceiling } = measurement;
      // The catalogue's ceiling is authoritative: a client-supplied one that
      // disagrees is rejected rather than trusted or silently replaced.
      if (limits.coverageCeiling === undefined) return false;
      if (ceiling !== limits.coverageCeiling) return false;
      if (!isNonNegativeInt(reached)) return false;
      return reached <= ceiling;
    }
  }
}
