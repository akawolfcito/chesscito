/**
 * Attempt grading — the server's answer to "how many stars was that run worth?"
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D12/D15).
 *
 * THE CLIENT NEVER SENDS STARS (D12)
 * ----------------------------------
 * It sends a raw measurement and the id of the level it played. Everything that
 * turns those into a star count lives here, on the server side of the wire, so a
 * tampered bundle cannot promote itself to three stars and a wrong wiring in the
 * screen cannot quietly regrade a game.
 *
 * WHY A TABLE AND NOT A SWITCH IN THE CALLER
 * ------------------------------------------
 * There are seven buckets and five graders, and `optimalMoves` means a different
 * thing in four of them (`catalog.ts:98-128`): a move optimum for the arrival
 * games, the queens the PLAYER places for N-Queens, the reachable ceiling minus
 * one for the tour. Three graders share the shape `(number, number) => number`
 * with opposite meanings, so a mis-dispatch type-checks, runs, and lies — which
 * is exactly what `handleLabyrinthMove` documents at `:3124-3130`.
 *
 * So each bucket declares, in one place: the pool it lives in, the ONE
 * measurement kind it accepts, and the canonical grader it calls. No formula is
 * written in this module — every star comes from the module that owns it
 * (`scoring.ts`, `exercises.ts`, `tour-score.ts`, `promotion-run.ts`). A grader
 * change lands here for free; a grader COPY here would be a second source of
 * truth for the scoreboard.
 */

import type { BuiltCatalog } from "@/lib/content/catalog";
import { getLevelId } from "@/lib/contracts/scoreboard";
import { labyrinthStars } from "@/lib/game/exercises";
import { promotionRunStars } from "@/lib/game/promotion-run";
import { computeStars } from "@/lib/game/scoring";
import { tourStars } from "@/lib/game/tour-score";
import type { Exercise, PieceId } from "@/lib/game/types";

import {
  isMeasurementInRange,
  movesCeiling,
  type AttemptMeasurement,
  type GradeResult,
} from "./attempt-measurement";
import type { AttemptFamily } from "./attempt-run-key";

/**
 * What the grader needs from a catalogue: the seven pools, and nothing else.
 *
 * Derived from `BuiltCatalog` rather than restated, so a bucket that is added
 * there and forgotten here is a type error at the call site. A full
 * `BuiltCatalog` satisfies it structurally — `errors`, `warnings` and
 * `descriptions` are authoring concerns and have no business in grading.
 */
export type GradingCatalog = Pick<
  BuiltCatalog,
  | "exercises"
  | "labyrinths"
  | "diagonalRun"
  | "knightTour"
  | "queens"
  | "safePath"
  | "promotionRun"
>;

export type GradingPoolKey = keyof GradingCatalog;

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

/** Stars a graded attempt can be worth. 0 is a real, earned outcome. */
export type StarCount = 0 | 1 | 2 | 3;

/**
 * The coverage ceiling a level is graded against — the catalogue's
 * `optimalMoves` plus the piece the level starts with.
 *
 * The `+ 1` is not a fudge, it is the two boards' own arithmetic. Both count the
 * starting piece in what they report: `KnightTourBoard` seeds `visited` with
 * START and reports `reachableSquares(...).length` as the ceiling
 * (`knight-tour-board.tsx:71,139`); `QueensBoard` seeds `queens` with START and
 * reports `maxQueens(...)` (`queens-board.tsx:95,114,164`). The catalogue stores
 * that same size MINUS the starting piece (`catalog.ts:239` for the tour,
 * `catalog.ts:257` for the queens), because `optimalMoves` there answers "how
 * much is left for the player".
 *
 * Get this off by one and every honest full run lands at 90% coverage, which
 * `tourStars` grades 2 instead of 3 — a scoreboard that is wrong by a star and
 * never says so.
 */
export function coverageCeilingFor(exercise: Exercise): number {
  return exercise.optimalMoves + 1;
}

/**
 * One bucket's grading contract. A discriminated union on the accepted
 * measurement kind, so a grader can only be wired to the numbers it understands:
 * the `failures` grader cannot be handed a move count, and the coverage grader
 * cannot be handed a single scalar, without a type error here.
 */
type BucketGrading =
  | {
      measureKind: "moves";
      starless?: false;
      stars: (movesUsed: number, exercise: Exercise) => number;
    }
  | { measureKind: "failures"; starless?: false; stars: (failures: number) => number }
  | {
      measureKind: "coverage";
      starless?: false;
      stars: (reached: number, ceiling: number) => number;
    }
  /** Measured and recorded, awards no stars — an explicit product exclusion. */
  | { measureKind: "coverage"; starless: true };

export type AttemptBucket = BucketGrading & {
  family: AttemptFamily;
  poolKey: GradingPoolKey;
};

/**
 * The seven buckets, in the order the spec's inventory table lists them.
 *
 * Keyed by family so the record is exhaustive by construction: a new
 * `AttemptFamily` does not compile until it declares how it is graded, and
 * "how it is graded" is the one thing about a new game that must never default.
 */
export const ATTEMPT_BUCKETS: Record<AttemptFamily, AttemptBucket> = {
  exercise: {
    family: "exercise",
    poolKey: "exercises",
    measureKind: "moves",
    stars: (movesUsed, exercise) => computeStars(movesUsed, exercise.optimalMoves),
  },
  labyrinth: {
    family: "labyrinth",
    poolKey: "labyrinths",
    measureKind: "moves",
    stars: (movesUsed, exercise) => labyrinthStars(movesUsed, exercise.optimalMoves),
  },
  "diagonal-run": {
    family: "diagonal-run",
    poolKey: "diagonalRun",
    measureKind: "moves",
    stars: (movesUsed, exercise) => labyrinthStars(movesUsed, exercise.optimalMoves),
  },
  "safe-path": {
    family: "safe-path",
    poolKey: "safePath",
    measureKind: "moves",
    // Graded by ARRIVAL, so a move count — but the optimum behind it comes from
    // `safePathOptimalMoves`, the only solver that reads the attack map.
    stars: (movesUsed, exercise) => labyrinthStars(movesUsed, exercise.optimalMoves),
  },
  "promotion-run": {
    family: "promotion-run",
    poolKey: "promotionRun",
    // FAILURES, not moves. Every winning run from rank r is exactly `7 - r`
    // moves long, so a move count here would grade three stars for everyone
    // forever (`promotion-run.ts:52-61`). "The route's length was never the
    // difficulty. Not dying on the way is."
    measureKind: "failures",
    stars: (failures) => promotionRunStars(failures),
  },
  queens: {
    family: "queens",
    poolKey: "queens",
    measureKind: "coverage",
    stars: (reached, ceiling) => tourStars(reached, ceiling),
  },
  "knight-tour": {
    family: "knight-tour",
    poolKey: "knightTour",
    measureKind: "coverage",
    // D15: the tour is measured and its best is recorded, and it awards no
    // stars — the same product decision `resolveCoverageStars` encodes for the
    // screen (`content-stars.ts:9-24`), stated here for the wire.
    starless: true,
  },
};

const BUCKET_LIST: AttemptBucket[] = Object.values(ATTEMPT_BUCKETS);

export type CatalogedExercise = {
  bucket: AttemptBucket;
  piece: PieceId;
  exercise: Exercise;
};

/**
 * Find a level by id across the seven pools.
 *
 * Membership, not shape: ids are neither patterned nor sequential (a rook level
 * is `rook-distance-1`, not `rook-3`), so nothing about an id can be parsed —
 * it either is in the catalogue the server built or it is not.
 *
 * `buildCatalog` rejects duplicate ids globally (`catalog.ts:419`), so a hit is
 * unambiguous and the first match is the only match.
 */
export function findCatalogedExercise(
  catalog: GradingCatalog,
  exerciseId: string,
): CatalogedExercise | null {
  for (const bucket of BUCKET_LIST) {
    const pool = catalog[bucket.poolKey];
    for (const piece of PIECES) {
      const exercise = pool[piece]?.find((e) => e.id === exerciseId);
      if (exercise) return { bucket, piece, exercise };
    }
  }
  return null;
}

/** The bounds a measurement of this bucket's kind is accepted within. */
function limitsFor(
  bucket: AttemptBucket,
  exercise: Exercise,
): { movesCeiling?: number; coverageCeiling?: number } {
  switch (bucket.measureKind) {
    case "moves":
      return { movesCeiling: movesCeiling(exercise.optimalMoves) };
    case "coverage":
      return { coverageCeiling: coverageCeilingFor(exercise) };
    case "failures":
      // Bounded by the kind alone (0..99): there is nothing per-level to read.
      return {};
  }
}

/**
 * Narrow a grader's output to the star scale.
 *
 * Every grader in the table is total on its bucket's in-range domain and returns
 * 0..3 there — asserted by sweeping each domain in
 * `__tests__/attempt-grading.test.ts`. So this throws rather than substituting a
 * number: a grader that leaves the scale has broken its own contract, and the
 * honest outcome is a failed request, not a plausible star count written to a
 * permanent row.
 */
function asStarCount(stars: number, family: AttemptFamily): StarCount {
  if (stars === 0 || stars === 1 || stars === 2 || stars === 3) return stars;
  throw new Error(`grader for '${family}' returned ${stars}, outside the 0..3 star scale`);
}

/** Apply the bucket's grader to a measurement already checked for kind + range. */
function starsFor(
  bucket: Exclude<AttemptBucket, { starless: true }>,
  exercise: Exercise,
  measurement: AttemptMeasurement,
): number {
  switch (bucket.measureKind) {
    case "moves":
      // The kind was checked against the bucket before we got here; these
      // guards keep that fact visible to the type system rather than asserted.
      if (measurement.kind !== "moves") break;
      return bucket.stars(measurement.movesUsed, exercise);
    case "failures":
      if (measurement.kind !== "failures") break;
      return bucket.stars(measurement.failures);
    case "coverage":
      if (measurement.kind !== "coverage") break;
      return bucket.stars(measurement.reached, coverageCeilingFor(exercise));
  }
  throw new Error(
    `'${bucket.family}' grades ${bucket.measureKind}, got ${measurement.kind} — ` +
      `the kind gate should have rejected this`,
  );
}

export type GradeAttemptInput = {
  exerciseId: string;
  levelId: number;
  measurement: AttemptMeasurement;
};

/**
 * Grade one completed attempt against the server-built catalogue.
 *
 * The order of the gates is the order of what each one can speak about:
 * an unknown id makes every later question meaningless, the level is the row's
 * own key, and the range bounds cannot be read before the bucket's kind is
 * known. Every rejection is a 400 with a reason — never a fallback grade.
 */
export function gradeAttempt(
  input: GradeAttemptInput,
  catalog: GradingCatalog,
): GradeResult {
  const found = findCatalogedExercise(catalog, input.exerciseId);
  if (!found) return { ok: false, reason: "unknown_exercise" };

  const { bucket, piece, exercise } = found;

  // The catalogue's piece owns the level id; the client's is checked against it,
  // never trusted, and the row persists the catalogue's.
  if (Number(getLevelId(piece)) !== input.levelId) {
    return { ok: false, reason: "level_mismatch" };
  }

  // A promotion-run id carrying a move count is a 400, not a graded guess.
  if (input.measurement.kind !== bucket.measureKind) {
    return { ok: false, reason: "measurement_kind_mismatch" };
  }

  if (!isMeasurementInRange(input.measurement, limitsFor(bucket, exercise))) {
    return { ok: false, reason: "measurement_out_of_range" };
  }

  // Measured, recorded, and worth no stars — `null` rather than `0`, because 0
  // is a real result here and "awards none" is not one (D13/D15).
  if (bucket.starless) return { ok: true, grade: "starless", starsEarned: null };

  return {
    ok: true,
    grade: "graded",
    starsEarned: asStarCount(starsFor(bucket, exercise, input.measurement), bucket.family),
  };
}
