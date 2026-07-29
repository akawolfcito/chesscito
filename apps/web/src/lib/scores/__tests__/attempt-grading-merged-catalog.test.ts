/**
 * `gradeAttempt` against the catalogue the SERVER actually serves.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D12).
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM `attempt-grading.test.ts`
 * -------------------------------------------------------------
 * That suite grades against `puzzles.generated` — the compiled baseline, which
 * has always had all seven pools. The RPC will not read that module; it will
 * read `getMergedCatalog()`, and until this slice that function returned FIVE
 * pools: `safePath` and `promotionRun` were missing from `mergeOverlay`'s return
 * and optional on `BaselineCatalog`, so nothing typed, ran or failed. A grader
 * proven correct on the baseline would still have answered `unknown_exercise` to
 * every Safe Path and Promotion Run run in production.
 *
 * So the assertions here are deliberately about the SEAM, not about grading:
 *
 *  1. `MergedCatalog` satisfies `GradingCatalog` by plain assignment — no cast,
 *     no `satisfies`, no structural helper. A cast would have compiled over the
 *     original bug.
 *  2. The ids come out of `getMergedCatalog()` itself. Reading them from
 *     `puzzles.generated` and grading them against the merged catalogue would
 *     pass even if the merge dropped the pool the id came from.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An overlay that answers with zero rows.
 *
 * Deliberately NOT `getSupabaseServer: () => null`: that takes the
 * baseline-only shortcut, which returns the baseline object verbatim and never
 * calls `mergeOverlay`. Production with a `CONTENT_STAGE` floor goes through the
 * merge, and the merge is where a pool can be dropped — a suite that only
 * exercised the shortcut stayed green with `safePath` emptied out (verified by
 * mutation). Zero rows keeps the ids the shipped ones while still running the
 * real path.
 */
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => ({
    from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
  })),
}));

import { gradeAttempt, type GradingCatalog } from "../attempt-grading";
import { getLevelId } from "@/lib/contracts/scoreboard";
import type { MergedCatalog } from "@/lib/content/overlay-types";
import type { Exercise, PieceId } from "@/lib/game/types";

/**
 * The real cached entry point, with caching disabled.
 *
 * `getMergedCatalog` is bound at module load: with `CONTENT_CACHE_DISABLED=1` it
 * IS `loadMergedCatalog`, otherwise it is wrapped in `unstable_cache`. The env
 * is stubbed before the dynamic import so the binding lands on the uncached
 * path — the same seam the e2e suite uses, not a test-only fork of the loader.
 */
async function loadServedCatalog(): Promise<MergedCatalog> {
  vi.stubEnv("CONTENT_CACHE_DISABLED", "1");
  // A stage floor, so the loader takes the OVERLAY path — `mergeOverlay` runs.
  vi.stubEnv("CONTENT_STAGE", "published");
  vi.resetModules();
  const { getMergedCatalog } = await import("@/lib/content/merged-catalog");
  return getMergedCatalog();
}

/** First shipped level of a pool, with the level id its piece maps to. */
function firstLevel(pool: Record<PieceId, Exercise[]>): {
  exercise: Exercise;
  levelId: number;
} {
  for (const [piece, list] of Object.entries(pool) as [PieceId, Exercise[]][]) {
    const exercise = list[0];
    if (exercise) return { exercise, levelId: Number(getLevelId(piece)) };
  }
  throw new Error("pool has no shipped level");
}

describe("getMergedCatalog → gradeAttempt", () => {
  let served: MergedCatalog;

  beforeEach(async () => {
    served = await loadServedCatalog();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("came through the real merge, with the shipped ids", () => {
    // `baseline+overlay` is the assertion, not a detail: it says mergeOverlay
    // ran. Zero rows applied, so the ids are still the compiled ones.
    expect(served.source).toBe("baseline+overlay");
    expect(served.overlayCount).toBe(0);
  });

  it("satisfies GradingCatalog by assignment, with no cast", () => {
    // The whole point. If a pool is dropped from `MergedCatalog` again, this
    // line stops compiling — it does not start returning `unknown_exercise` in
    // production six weeks later.
    const forGrading: GradingCatalog = served;
    expect(forGrading.safePath).toBe(served.safePath);
    expect(forGrading.promotionRun).toBe(served.promotionRun);
  });

  it("grades a Safe Path level whose id came out of the served catalogue", () => {
    const { exercise, levelId } = firstLevel(served.safePath);
    // A perfect arrival: the optimum route, which `labyrinthStars` grades 3.
    expect(
      gradeAttempt(
        {
          exerciseId: exercise.id,
          levelId,
          measurement: { kind: "moves", movesUsed: exercise.optimalMoves },
        },
        served,
      ),
    ).toEqual({ ok: true, grade: "graded", starsEarned: 3 });
  });

  it("grades a Promotion Run level whose id came out of the served catalogue", () => {
    const { exercise, levelId } = firstLevel(served.promotionRun);
    // Failures, never the move count — every winning run is the same length.
    expect(
      gradeAttempt(
        { exerciseId: exercise.id, levelId, measurement: { kind: "failures", failures: 1 } },
        served,
      ),
    ).toEqual({ ok: true, grade: "graded", starsEarned: 2 });
  });

  it("rejects a move count on a Promotion Run id from the served catalogue", () => {
    const { exercise, levelId } = firstLevel(served.promotionRun);
    expect(
      gradeAttempt(
        {
          exerciseId: exercise.id,
          levelId,
          measurement: { kind: "moves", movesUsed: exercise.optimalMoves },
        },
        served,
      ),
    ).toEqual({ ok: false, reason: "measurement_kind_mismatch" });
  });

  it("finds a level in every one of the seven pools", () => {
    // The regression, stated once: a pool missing from the served catalogue
    // answers `unknown_exercise` to an honest run.
    for (const pool of [
      served.exercises,
      served.labyrinths,
      served.diagonalRun,
      served.knightTour,
      served.queens,
      served.safePath,
      served.promotionRun,
    ]) {
      const { exercise, levelId } = firstLevel(pool);
      const result = gradeAttempt(
        {
          exerciseId: exercise.id,
          levelId,
          // Deliberately the wrong kind for most buckets: the assertion is that
          // the id is FOUND, which a `measurement_kind_mismatch` proves and an
          // `unknown_exercise` disproves.
          measurement: { kind: "failures", failures: 0 },
        },
        served,
      );
      expect(result.ok === false && result.reason === "unknown_exercise").toBe(false);
    }
  });
});
