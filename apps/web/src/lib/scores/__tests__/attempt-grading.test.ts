/**
 * `gradeAttempt` — the seven-bucket inventory, executable.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D12/D15).
 *
 * WHY THIS TEST IS A TABLE AND WHY IT RUNS ON THE REAL CATALOGUE
 * -------------------------------------------------------------
 * The grader inventory in the spec is a table of seven rows, and every column of
 * it is a claim that can rot silently: which grader a bucket uses, which
 * measurement kind it accepts, whether it can honestly return 0. Three of the
 * five graders share the shape `(number, number) => number` while meaning
 * opposite things, so a wrong wiring does not throw — it hands out stars.
 *
 * So each row is asserted, not described:
 *
 *  - `expectedStars` calls the CANONICAL pure grader itself, never a formula
 *    re-typed here. If `gradeAttempt` ever grows its own arithmetic, the two
 *    disagree.
 *  - The star range and "can it return 0" are swept over the whole in-range
 *    domain of a real level, so `0`-vs-`1` floors are measured, not believed.
 *  - The ids come from the shipped catalogue (`puzzles.generated`), never from
 *    hand-written fixtures: ids are neither patterned nor sequential, and a
 *    fixture that invents one proves nothing about the levels that ship.
 *  - The table must cover `ATTEMPT_FAMILIES` entirely, so a new family cannot
 *    reach the wire ungraded.
 */

import { describe, expect, it } from "vitest";

import {
  GENERATED_DIAGONAL_RUN,
  GENERATED_EXERCISES,
  GENERATED_KNIGHT_TOUR,
  GENERATED_LABYRINTHS,
  GENERATED_PROMOTION_RUN,
  GENERATED_QUEENS,
  GENERATED_SAFE_PATH,
} from "@/lib/game/generated/puzzles.generated";
import type { Exercise, PieceId } from "@/lib/game/types";
import { getLevelId } from "@/lib/contracts/scoreboard";
import { gradeExerciseRun, gradeLabyrinthRun } from "@/lib/game/scoring";
// The raw scale, still canonical for the two buckets that can never carry
// `targets` (the validator refuses a sweep outside exercises and labyrinths).
import { labyrinthStars } from "@/lib/game/exercises";
import { tourStars } from "@/lib/game/tour-score";
import { promotionRunStars } from "@/lib/game/promotion-run";
import { reachableSquares } from "@/lib/game/knight-tour";
import { maxQueens } from "@/lib/game/queens";

import {
  coverageCeilingFor,
  gradeAttempt,
  type GradingCatalog,
} from "../attempt-grading";
import {
  MAX_ATTEMPT_FAILURES,
  movesCeiling,
  type AttemptMeasureKind,
  type AttemptMeasurement,
} from "../attempt-measurement";
import { ATTEMPT_FAMILIES, type AttemptFamily } from "../attempt-run-key";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

/** The shipped catalogue, in the shape the grader reads. */
const CATALOG: GradingCatalog = {
  exercises: GENERATED_EXERCISES,
  labyrinths: GENERATED_LABYRINTHS,
  diagonalRun: GENERATED_DIAGONAL_RUN,
  knightTour: GENERATED_KNIGHT_TOUR,
  queens: GENERATED_QUEENS,
  safePath: GENERATED_SAFE_PATH,
  promotionRun: GENERATED_PROMOTION_RUN,
};

type PoolKey = keyof GradingCatalog;

type BucketCase = {
  family: AttemptFamily;
  poolKey: PoolKey;
  measureKind: AttemptMeasureKind;
  starless: boolean;
  /** The spec's Range column, as [min, max] over the whole in-range domain. */
  starRange: [number, number];
  /** Every measurement the range gate accepts, for one level. */
  sweep: (e: Exercise) => AttemptMeasurement[];
  /** The canonical grader, called directly. Never a formula rewritten here. */
  expectedStars: (e: Exercise, m: AttemptMeasurement) => number;
  /** A measurement of the WRONG kind for this bucket. */
  wrongKind: AttemptMeasurement;
  /** A measurement of the right kind, outside the accepted range. */
  outOfRange: (e: Exercise) => AttemptMeasurement;
};

const movesSweep = (e: Exercise): AttemptMeasurement[] => {
  const ceiling = movesCeiling(e.optimalMoves);
  const out: AttemptMeasurement[] = [];
  for (let movesUsed = 1; movesUsed <= ceiling; movesUsed++) {
    out.push({ kind: "moves", movesUsed });
  }
  return out;
};

const movesOf = (m: AttemptMeasurement): number => {
  if (m.kind !== "moves") throw new Error(`expected a moves measurement, got ${m.kind}`);
  return m.movesUsed;
};

const coverageSweep = (e: Exercise): AttemptMeasurement[] => {
  const ceiling = coverageCeilingFor(e);
  const out: AttemptMeasurement[] = [];
  for (let reached = 0; reached <= ceiling; reached++) {
    out.push({ kind: "coverage", reached, ceiling });
  }
  return out;
};

const CASES: BucketCase[] = [
  {
    family: "exercise",
    poolKey: "exercises",
    measureKind: "moves",
    starless: false,
    starRange: [1, 3],
    sweep: movesSweep,
    // ⚠️ `gradeExerciseRun`, not `computeStars`. Since Star Sweep the exercise
    // family has TWO scales — the legacy one for single-goal boards and relative
    // bands (0★ reachable) for sweeps — plus the per-board `starFloor` policy.
    // Naming `computeStars` here would re-type one branch of the dispatch and
    // silently stop testing the other, which is exactly what this file's header
    // forbids: call the canonical grader, never a formula rewritten here.
    //
    // `starRange` stays [1, 3] because it is swept over `firstLevelOf`, which is
    // `rook-1` — deliberately left unconverted as the experiment's control. If
    // that ever becomes a floorless sweep this assertion fails loudly, and it
    // should: it would mean the first board a player meets can score zero.
    expectedStars: (e, m) => gradeExerciseRun(movesOf(m), e),
    wrongKind: { kind: "failures", failures: 0 },
    outOfRange: (e) => ({ kind: "moves", movesUsed: movesCeiling(e.optimalMoves) + 1 }),
  },
  {
    family: "labyrinth",
    poolKey: "labyrinths",
    measureKind: "moves",
    starless: false,
    starRange: [0, 3],
    sweep: movesSweep,
    // `gradeLabyrinthRun`, not `labyrinthStars`: a maze can be a Star Sweep now,
    // and those grade on relative bands. This row named the raw scale, so the
    // day the first rook maze was converted the oracle and the grader disagreed
    // by a star — which is exactly what this file exists to catch.
    expectedStars: (e, m) => gradeLabyrinthRun(movesOf(m), e),
    wrongKind: { kind: "failures", failures: 0 },
    outOfRange: (e) => ({ kind: "moves", movesUsed: movesCeiling(e.optimalMoves) + 1 }),
  },
  {
    family: "diagonal-run",
    poolKey: "diagonalRun",
    measureKind: "moves",
    starless: false,
    starRange: [0, 3],
    sweep: movesSweep,
    expectedStars: (e, m) => labyrinthStars(movesOf(m), e.optimalMoves),
    wrongKind: { kind: "coverage", reached: 1, ceiling: 2 },
    outOfRange: () => ({ kind: "moves", movesUsed: 0 }),
  },
  {
    family: "safe-path",
    poolKey: "safePath",
    measureKind: "moves",
    starless: false,
    starRange: [0, 3],
    sweep: movesSweep,
    expectedStars: (e, m) => labyrinthStars(movesOf(m), e.optimalMoves),
    wrongKind: { kind: "failures", failures: 1 },
    outOfRange: (e) => ({ kind: "moves", movesUsed: movesCeiling(e.optimalMoves) + 1 }),
  },
  {
    family: "promotion-run",
    poolKey: "promotionRun",
    measureKind: "failures",
    starless: false,
    // Floors at 1 on purpose: a player who dies five times and still promotes
    // did what the level asked (promotion-run.ts:70-72).
    starRange: [1, 3],
    sweep: () => {
      const out: AttemptMeasurement[] = [];
      for (let failures = 0; failures <= MAX_ATTEMPT_FAILURES; failures++) {
        out.push({ kind: "failures", failures });
      }
      return out;
    },
    expectedStars: (_e, m) => {
      if (m.kind !== "failures") throw new Error(`expected failures, got ${m.kind}`);
      return promotionRunStars(m.failures);
    },
    // The whole reason the union exists: a move count here would be graded
    // 3 stars for everyone, forever.
    wrongKind: { kind: "moves", movesUsed: 5 },
    outOfRange: () => ({ kind: "failures", failures: MAX_ATTEMPT_FAILURES + 1 }),
  },
  {
    family: "queens",
    poolKey: "queens",
    measureKind: "coverage",
    starless: false,
    starRange: [0, 3],
    sweep: coverageSweep,
    expectedStars: (e, m) => {
      if (m.kind !== "coverage") throw new Error(`expected coverage, got ${m.kind}`);
      return tourStars(m.reached, coverageCeilingFor(e));
    },
    wrongKind: { kind: "moves", movesUsed: 4 },
    outOfRange: (e) => ({
      kind: "coverage",
      reached: coverageCeilingFor(e) + 1,
      ceiling: coverageCeilingFor(e),
    }),
  },
  {
    family: "knight-tour",
    poolKey: "knightTour",
    measureKind: "coverage",
    // Product exclusion (D15), not a coverage hole: the tour is measured and
    // recorded, and awards no stars (content-stars.ts:9-24).
    starless: true,
    starRange: [0, 0],
    sweep: coverageSweep,
    expectedStars: () => 0,
    wrongKind: { kind: "moves", movesUsed: 4 },
    outOfRange: (e) => ({
      kind: "coverage",
      reached: 0,
      // A ceiling that disagrees with the catalogue's is rejected, not trusted.
      ceiling: coverageCeilingFor(e) + 1,
    }),
  },
];

type Level = { exercise: Exercise; piece: PieceId; levelId: number };

/** Every shipped level in a bucket, with the level id its piece maps to. */
function levelsOf(poolKey: PoolKey): Level[] {
  const pool = CATALOG[poolKey];
  return PIECES.flatMap((piece) =>
    (pool[piece] ?? []).map((exercise) => ({
      exercise,
      piece,
      levelId: Number(getLevelId(piece)),
    })),
  );
}

/** The representative level a full-domain sweep runs on. */
function firstLevelOf(poolKey: PoolKey): Level {
  const [level] = levelsOf(poolKey);
  if (!level) throw new Error(`no shipped level in bucket '${poolKey}'`);
  return level;
}

describe("the bucket inventory covers every family", () => {
  it("declares exactly the families a host assembler can complete", () => {
    expect(CASES.map((c) => c.family).sort()).toEqual([...ATTEMPT_FAMILIES].sort());
  });

  it("declares each bucket once", () => {
    expect(new Set(CASES.map((c) => c.poolKey)).size).toBe(CASES.length);
  });
});

describe.each(CASES)("gradeAttempt — $family", (bucket) => {
  it("has shipped levels to grade", () => {
    // A bucket that empties out would make every assertion below vacuous.
    expect(levelsOf(bucket.poolKey).length).toBeGreaterThan(0);
  });

  it("grades every shipped level with the canonical grader", () => {
    for (const { exercise, levelId } of levelsOf(bucket.poolKey)) {
      const domain = bucket.sweep(exercise);
      // Best and worst in-range run per level; the full sweep runs below on one.
      for (const measurement of [domain[0]!, domain[domain.length - 1]!]) {
        const result = gradeAttempt(
          { exerciseId: exercise.id, levelId, measurement },
          CATALOG,
        );
        if (bucket.starless) {
          expect(result).toEqual({ ok: true, grade: "starless", starsEarned: null });
          continue;
        }
        expect(result).toEqual({
          ok: true,
          grade: "graded",
          starsEarned: bucket.expectedStars(exercise, measurement),
        });
      }
    }
  });

  it("stays inside the declared star range across the whole in-range domain", () => {
    const { exercise, levelId } = firstLevelOf(bucket.poolKey);
    const seen = new Set<number>();
    for (const measurement of bucket.sweep(exercise)) {
      const result = gradeAttempt(
        { exerciseId: exercise.id, levelId, measurement },
        CATALOG,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      if (bucket.starless) {
        expect(result.grade).toBe("starless");
        expect(result.starsEarned).toBeNull();
        continue;
      }
      expect(result.grade).toBe("graded");
      expect(result.starsEarned).toBe(bucket.expectedStars(exercise, measurement));
      seen.add(result.starsEarned as number);
    }
    if (bucket.starless) return;
    const [min, max] = bucket.starRange;
    expect(Math.min(...seen)).toBe(min);
    expect(Math.max(...seen)).toBe(max);
  });

  it("rejects a measurement of the wrong kind rather than grading it", () => {
    const { exercise, levelId } = firstLevelOf(bucket.poolKey);
    expect(
      gradeAttempt(
        { exerciseId: exercise.id, levelId, measurement: bucket.wrongKind },
        CATALOG,
      ),
    ).toEqual({ ok: false, reason: "measurement_kind_mismatch" });
  });

  it("rejects a measurement outside the accepted range", () => {
    const { exercise, levelId } = firstLevelOf(bucket.poolKey);
    expect(
      gradeAttempt(
        { exerciseId: exercise.id, levelId, measurement: bucket.outOfRange(exercise) },
        CATALOG,
      ),
    ).toEqual({ ok: false, reason: "measurement_out_of_range" });
  });

  it("rejects a level id that is not the one the catalogue's piece maps to", () => {
    const { exercise, levelId } = firstLevelOf(bucket.poolKey);
    const wrongLevelId = levelId === 1 ? 2 : 1;
    expect(
      gradeAttempt(
        { exerciseId: exercise.id, levelId: wrongLevelId, measurement: bucket.sweep(exercise)[0]! },
        CATALOG,
      ),
    ).toEqual({ ok: false, reason: "level_mismatch" });
  });
});

describe("gradeAttempt — membership", () => {
  it("rejects an id the catalogue does not carry", () => {
    // Membership, not shape: ids are neither patterned nor sequential, so a
    // plausible-looking id is exactly the kind that must not grade.
    expect(
      gradeAttempt(
        {
          exerciseId: "rook-3",
          levelId: 1,
          measurement: { kind: "moves", movesUsed: 3 },
        },
        CATALOG,
      ),
    ).toEqual({ ok: false, reason: "unknown_exercise" });
  });

  it("checks membership before anything else", () => {
    // An unknown id with a hopeless measurement is still `unknown_exercise`:
    // nothing downstream may speak about a level that does not exist.
    expect(
      gradeAttempt(
        {
          exerciseId: "not-a-real-id",
          levelId: 999,
          measurement: { kind: "failures", failures: -7 },
        },
        CATALOG,
      ),
    ).toEqual({ ok: false, reason: "unknown_exercise" });
  });
});

describe("coverageCeilingFor", () => {
  /**
   * Asserted against the BOARDS' own arithmetic, not against the catalogue
   * field it is derived from — comparing it to `optimalMoves + 1` would only
   * restate the implementation. `KnightTourBoard` reports
   * `reachableSquares(START, WALLS).length` (`:71,:139`) and `QueensBoard`
   * reports `maxQueens([START], BLOCKS)` (`:114,:164`); those two calls are the
   * ceilings that actually arrive on the wire.
   */
  it("equals what KnightTourBoard reports, on every shipped tour", () => {
    for (const { exercise } of levelsOf("knightTour")) {
      const reported = reachableSquares(exercise.startPos, exercise.obstacles ?? []).length;
      expect(coverageCeilingFor(exercise)).toBe(reported);
    }
  });

  it("equals what QueensBoard reports, on every shipped queens level", () => {
    for (const { exercise } of levelsOf("queens")) {
      const reported = maxQueens([exercise.startPos], exercise.obstacles ?? []);
      expect(coverageCeilingFor(exercise)).toBe(reported);
    }
  });

  it("grades a full run as a full run", () => {
    // The off-by-one this guards is silent: a ceiling one too high grades every
    // perfect run at 90% coverage, which tourStars calls 2 stars, forever.
    const { exercise, levelId } = firstLevelOf("queens");
    const ceiling = maxQueens([exercise.startPos], exercise.obstacles ?? []);
    expect(
      gradeAttempt(
        {
          exerciseId: exercise.id,
          levelId,
          measurement: { kind: "coverage", reached: ceiling, ceiling },
        },
        CATALOG,
      ),
    ).toEqual({ ok: true, grade: "graded", starsEarned: 3 });
  });
});
