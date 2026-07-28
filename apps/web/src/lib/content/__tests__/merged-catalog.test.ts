/**
 * mergeOverlay — db-backed-content Phase 2a (pure merge logic).
 *
 * Baseline ⊕ overlay deltas: append-new, replace-edit (overlay fields + order
 * win), remove-disabled, descriptions merged, sorted (order,id). Each overlay
 * row is re-BFS-verified by reusing buildCatalog — a row that is unsolvable or
 * whose stored optimal_moves disagrees with the recomputed value is DROPPED
 * (the DB value is never blindly trusted). No consumer touched this slice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  in: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseMock),
}));

import {
  mergeOverlay,
  loadMergedCatalog,
  getBaseline,
  duplicateExerciseIds,
  CATALOG_POOL_KEYS,
} from "../merged-catalog";
import { buildCatalog, type ExerciseRecord } from "../catalog";
import { posToSquare } from "@/lib/game/fen-puzzle";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { BaselineCatalog, ContentOverlayRow } from "../overlay-types";

const mockedSupabase = vi.mocked(getSupabaseServer);

const EMPTY_BOARD = "8/8/8/8/8/8/8/R7 w - - 0 1";

/**
 * A baseline from records, carrying ALL SEVEN pools.
 *
 * It used to return three and lean on the optional fields, which is precisely
 * how `safePath` and `promotionRun` went missing from the served catalogue
 * without a single test noticing: a fixture that may omit a pool cannot detect
 * a merge that drops one. `buildCatalog` already returns the seven, so the
 * fixture states them.
 */
function baselineWith(records: ExerciseRecord[]): BaselineCatalog {
  const c = buildCatalog([], [], records);
  expect(c.errors).toEqual([]);
  return {
    exercises: c.exercises,
    labyrinths: c.labyrinths,
    diagonalRun: c.diagonalRun,
    knightTour: c.knightTour,
    queens: c.queens,
    safePath: c.safePath,
    promotionRun: c.promotionRun,
    descriptions: c.descriptions,
  };
}

function row(over: Partial<ContentOverlayRow> = {}): ContentOverlayRow {
  return {
    id: "rook-ovl",
    kind: "exercise",
    piece: "rook",
    fen: EMPTY_BOARD,
    target: "a8",
    mover: "a1",
    tier: "easy",
    tags: null,
    explanation: null,
    order: 5,
    disabled: false,
    optimal_moves: 1, // a1 → a8 (or h1) is one rook move
    updated_at: "2026-06-17T00:00:00Z",
    stage: "published",
    ...over,
  };
}

// One baseline rook exercise: a1 → h1, order 0, with a description.
// Rook is a curated piece, so BASELINE content must carry its pedagogy (the gate
// that makes "Exercise N" unreachable). Overlay rows are exempt — the Supabase
// table has no columns for it yet — which is exactly what `row()` below models.
const BASE = baselineWith([
  {
    id: "rook-base-1", piece: "rook", fen: EMPTY_BOARD, target: "h1", mover: "a1",
    order: 0, explanation: "Base one",
    principle: "rank-movement",
    title: "Move along the rank",
    playerPrompt: "Reach the star without leaving the rank.",
    learningObjective: "The player recognises horizontal rook movement.",
  },
]);

describe("mergeOverlay", () => {
  it("returns the baseline unchanged for an empty overlay", () => {
    const m = mergeOverlay(BASE, []);
    expect(m.exercises.rook.map((e) => e.id)).toEqual(["rook-base-1"]);
    expect(m.overlayCount).toBe(0);
    expect(m.source).toBe("baseline+overlay");
  });

  it("appends a new overlay puzzle (sorted by order,id)", () => {
    const m = mergeOverlay(BASE, [row({ id: "rook-new", target: "a8", order: 5 })]);
    expect(m.exercises.rook.map((e) => e.id)).toEqual(["rook-base-1", "rook-new"]);
    expect(m.overlayCount).toBe(1);
  });

  it("replaces a baseline puzzle of the same id (overlay fields win)", () => {
    const m = mergeOverlay(BASE, [row({ id: "rook-base-1", target: "a8", order: 0 })]);
    const hit = m.exercises.rook.filter((e) => e.id === "rook-base-1");
    expect(hit).toHaveLength(1);
    expect(posToSquare(hit[0].targetPos)).toBe("a8"); // overlay target, not baseline h1
    expect(m.exercises.rook).toHaveLength(1);
  });

  it("removes a disabled overlay row from the pool and its description", () => {
    const m = mergeOverlay(BASE, [row({ id: "rook-base-1", disabled: true })]);
    expect(m.exercises.rook.find((e) => e.id === "rook-base-1")).toBeUndefined();
    expect(m.descriptions["rook-base-1"]).toBeUndefined();
  });

  it("merges an overlay explanation into descriptions", () => {
    const m = mergeOverlay(BASE, [row({ id: "rook-new", target: "a8", explanation: "Climb the a-file" })]);
    expect(m.descriptions["rook-new"]).toBe("Climb the a-file");
  });

  it("drops an unsolvable/malformed overlay row", () => {
    const m = mergeOverlay(BASE, [row({ id: "rook-bad", target: "z9" })]);
    expect(m.exercises.rook.map((e) => e.id)).toEqual(["rook-base-1"]);
    expect(m.overlayCount).toBe(0);
  });

  it("drops a row whose stored optimal_moves disagrees with BFS", () => {
    const m = mergeOverlay(BASE, [row({ id: "rook-liar", target: "a8", optimal_moves: 9 })]);
    expect(m.exercises.rook.find((e) => e.id === "rook-liar")).toBeUndefined();
    expect(m.overlayCount).toBe(0);
  });
});

/**
 * The seven pools, and the id rule that lets a grader trust them.
 *
 * `gradeAttempt` finds a level by scanning the pools and grading with the first
 * hit, so two pools claiming one id is not a tidiness problem — it is a move
 * count handed to a coverage grader, silently. `buildCatalog` enforces
 * uniqueness within one build; the overlay is the only path that can break it,
 * because its rows are built one at a time and never see the other pools.
 */
describe("mergeOverlay — the seven pools", () => {
  const BASELINE = getBaseline();

  it("ships a non-empty pool for every catalogue bucket", () => {
    // Otherwise every assertion about a bucket below is vacuous — and the
    // missing-pool bug this suite exists for looked exactly like an empty one.
    for (const poolKey of CATALOG_POOL_KEYS) {
      const total = Object.values(BASELINE[poolKey]).flat().length;
      expect(total, `pool '${poolKey}' is empty`).toBeGreaterThan(0);
    }
  });

  it("passes every baseline-only pool through the merge", () => {
    const m = mergeOverlay(BASELINE, []);
    for (const poolKey of [
      "diagonalRun",
      "knightTour",
      "queens",
      "safePath",
      "promotionRun",
    ] as const) {
      expect(m[poolKey], `pool '${poolKey}' did not survive the merge`).toBe(
        BASELINE[poolKey],
      );
    }
  });

  it("gives the shipped catalogue exactly one owner per id", () => {
    expect(duplicateExerciseIds(BASELINE)).toEqual([]);
  });

  it("drops an overlay row whose id is owned by another pool", () => {
    // A real safe-path id: the bucket the served catalogue could not grade at
    // all until this slice, and the one an overlay row could shadow.
    const [piece, safePathLevel] = Object.entries(BASELINE.safePath).flatMap(
      ([p, list]) => list.map((e) => [p, e] as const),
    )[0]!;
    // Otherwise valid — the same row shape the "appends" case applies happily.
    const m = mergeOverlay(BASELINE, [row({ id: safePathLevel.id, target: "a8" })]);

    expect(m.exercises.rook.some((e) => e.id === safePathLevel.id)).toBe(false);
    expect(
      m.safePath[piece as keyof typeof m.safePath].some((e) => e.id === safePathLevel.id),
    ).toBe(true);
    expect(m.overlayCount).toBe(0);
    expect(duplicateExerciseIds(m)).toEqual([]);
  });

  it("drops a second overlay row that collides with the first", () => {
    // The owner index is maintained AS rows are applied, so two overlay rows in
    // different buckets cannot claim one id either.
    const m = mergeOverlay(BASE, [
      row({ id: "rook-twice", kind: "exercise", target: "a8" }),
      row({ id: "rook-twice", kind: "labyrinth", target: "a8" }),
    ]);
    expect(m.exercises.rook.some((e) => e.id === "rook-twice")).toBe(true);
    expect(m.labyrinths.rook.some((e) => e.id === "rook-twice")).toBe(false);
    expect(m.overlayCount).toBe(1);
    expect(duplicateExerciseIds(m)).toEqual([]);
  });

  it("frees an id when its row is disabled", () => {
    // A soft-delete removes the level, so the id stops being claimed — a later
    // row may legitimately take it.
    const m = mergeOverlay(BASE, [
      row({ id: "rook-base-1", disabled: true }),
      row({ id: "rook-base-1", kind: "labyrinth", target: "a8" }),
    ]);
    expect(m.exercises.rook.some((e) => e.id === "rook-base-1")).toBe(false);
    expect(m.labyrinths.rook.some((e) => e.id === "rook-base-1")).toBe(true);
    expect(duplicateExerciseIds(m)).toEqual([]);
  });
});

describe("loadMergedCatalog (stage-aware fetch + fallback)", () => {
  const originalStage = process.env.CONTENT_STAGE;
  beforeEach(() => {
    vi.clearAllMocks();
    // Chain: from(...).select("*").in("stage", visibleStages(floor))
    supabaseMock.from.mockReturnValue({ select: supabaseMock.select });
    supabaseMock.select.mockReturnValue({ in: supabaseMock.in });
    mockedSupabase.mockReturnValue(supabaseMock as never);
    process.env.CONTENT_STAGE = "draft"; // dev floor: sees all stages
  });
  afterEach(() => {
    vi.clearAllMocks();
    if (originalStage === undefined) delete process.env.CONTENT_STAGE;
    else process.env.CONTENT_STAGE = originalStage;
  });

  it("serves baseline-only with ZERO DB hits when CONTENT_STAGE is unset (kill-switch)", async () => {
    delete process.env.CONTENT_STAGE;
    const m = await loadMergedCatalog();
    expect(m.source).toBe("baseline-only");
    expect(m.overlayCount).toBe(0);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("filters the query to the env's visible stages (published floor → published only)", async () => {
    process.env.CONTENT_STAGE = "published";
    supabaseMock.in.mockResolvedValue({ data: [], error: null });
    await loadMergedCatalog();
    expect(supabaseMock.in).toHaveBeenCalledWith("stage", ["published"]);
  });

  it("a draft row is invisible to prod (published floor resolves it away)", async () => {
    process.env.CONTENT_STAGE = "published";
    // The query itself would exclude drafts, but assert resolution is safe even
    // if a draft leaked into the result set.
    supabaseMock.in.mockResolvedValue({
      data: [row({ id: "rook-draft", target: "a8", stage: "draft" })],
      error: null,
    });
    const m = await loadMergedCatalog();
    expect(m.exercises.rook.some((e) => e.id === "rook-draft")).toBe(false);
  });

  it("falls back to baseline-only when Supabase is unconfigured", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const m = await loadMergedCatalog();
    expect(m.source).toBe("baseline-only");
    expect(m.overlayCount).toBe(0);
    expect(m.exercises.rook.length).toBeGreaterThan(0); // real baseline served
  });

  it("falls back to baseline-only when the query errors", async () => {
    supabaseMock.in.mockResolvedValue({ data: null, error: { message: "paused" } });
    const m = await loadMergedCatalog();
    expect(m.source).toBe("baseline-only");
  });

  it("falls back to baseline-only when the query throws", async () => {
    supabaseMock.in.mockRejectedValue(new Error("network"));
    const m = await loadMergedCatalog();
    expect(m.source).toBe("baseline-only");
  });

  it("merges visible overlay rows when the query succeeds", async () => {
    supabaseMock.in.mockResolvedValue({
      data: [row({ id: "rook-ovl-live", target: "a8", stage: "published" })],
      error: null,
    });
    const m = await loadMergedCatalog();
    expect(m.source).toBe("baseline+overlay");
    expect(m.overlayCount).toBe(1);
    expect(m.exercises.rook.some((e) => e.id === "rook-ovl-live")).toBe(true);
  });
});
