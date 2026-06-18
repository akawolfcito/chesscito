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

const supabaseMock = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseMock),
}));

import { mergeOverlay, loadMergedCatalog } from "../merged-catalog";
import { buildCatalog, type ExerciseRecord } from "../catalog";
import { posToSquare } from "@/lib/game/fen-puzzle";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { BaselineCatalog, ContentOverlayRow } from "../overlay-types";

const mockedSupabase = vi.mocked(getSupabaseServer);

const EMPTY_BOARD = "8/8/8/8/8/8/8/R7 w - - 0 1";

function baselineWith(records: ExerciseRecord[]): BaselineCatalog {
  const c = buildCatalog([], [], records);
  expect(c.errors).toEqual([]);
  return { exercises: c.exercises, labyrinths: c.labyrinths, descriptions: c.descriptions };
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
const BASE = baselineWith([
  { id: "rook-base-1", piece: "rook", fen: EMPTY_BOARD, target: "h1", mover: "a1", order: 0, explanation: "Base one" },
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

describe("loadMergedCatalog (fetch + fallback)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.from.mockReturnValue({ select: supabaseMock.select });
    mockedSupabase.mockReturnValue(supabaseMock as never);
  });
  afterEach(() => vi.clearAllMocks());

  it("falls back to baseline-only when Supabase is unconfigured", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const m = await loadMergedCatalog();
    expect(m.source).toBe("baseline-only");
    expect(m.overlayCount).toBe(0);
    expect(m.exercises.rook.length).toBeGreaterThan(0); // real baseline served
  });

  it("falls back to baseline-only when the query errors", async () => {
    supabaseMock.select.mockResolvedValue({ data: null, error: { message: "paused" } });
    const m = await loadMergedCatalog();
    expect(m.source).toBe("baseline-only");
  });

  it("falls back to baseline-only when the query throws", async () => {
    supabaseMock.select.mockRejectedValue(new Error("network"));
    const m = await loadMergedCatalog();
    expect(m.source).toBe("baseline-only");
  });

  it("merges overlay rows when the query succeeds", async () => {
    supabaseMock.select.mockResolvedValue({ data: [row({ id: "rook-ovl-live", target: "a8" })], error: null });
    const m = await loadMergedCatalog();
    expect(m.source).toBe("baseline+overlay");
    expect(m.overlayCount).toBe(1);
    expect(m.exercises.rook.some((e) => e.id === "rook-ovl-live")).toBe(true);
  });
});
