import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs so the helper never touches the real filesystem and we can
// assert exactly when (and whether) it writes.
const fsMocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:fs", () => ({ ...fsMocks, default: fsMocks }));

import { writeBaselineRecord } from "../baseline-write";
import type { LabyrinthRecord } from "@/lib/labyrinth-builder/store";

/** Rook is a CURATED piece (lib/content/lint.ts), so a rook exercise without
 *  pedagogy no longer validates — the same gate that makes "Exercise N"
 *  unreachable. Carrying the copy here also proves the four fields survive the
 *  builder's write path, not just the CLI import. */
const VALID_EXERCISE: LabyrinthRecord = {
  piece: "rook",
  fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
  target: "h1",
  mover: "a1",
  tier: "easy",
  tags: ["straight-line"],
  order: 2,
  id: "rook-ex",
  principle: "rank-movement",
  title: "Move along the rank",
  playerPrompt: "Reach the star without leaving the rank.",
  learningObjective: "The player recognises horizontal rook movement.",
};

// Boxed rook with no path from b2 to a8 — unsolvable.
const UNSOLVABLE: LabyrinthRecord = {
  piece: "rook",
  fen: "8/8/8/8/8/1R6/RRR5/1R6 w - - 0 1",
  target: "a8",
  mover: "b2",
  order: 1,
  id: "rook-boxed",
};

describe("writeBaselineRecord", () => {
  beforeEach(() => {
    fsMocks.readFileSync.mockReset();
    fsMocks.writeFileSync.mockReset();
    fsMocks.existsSync.mockReset();
    fsMocks.mkdirSync.mockReset();
    fsMocks.existsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates + writes a solvable exercise (json + generated module) and returns the id", () => {
    const result = writeBaselineRecord("exercise", { ...VALID_EXERCISE });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe("rook-ex");
    const written = fsMocks.writeFileSync.mock.calls.map((c) => String(c[0]));
    expect(written.some((p) => p.endsWith("content/exercises.json"))).toBe(true);
    expect(
      written.some((p) => p.endsWith("src/lib/game/generated/puzzles.generated.ts")),
    ).toBe(true);
    expect(written.some((p) => p.endsWith("content/labyrinths.json"))).toBe(false);
  });

  it("rejects an unsolvable record with errors and never writes", () => {
    const result = writeBaselineRecord("labyrinth", { ...UNSOLVABLE });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("unsolvable"))).toBe(true);
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled();
  });

  it("auto-assigns a content-addressed id when none is supplied", () => {
    const { id: _omit, ...noId } = VALID_EXERCISE;
    const result = writeBaselineRecord("exercise", noId as LabyrinthRecord);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toMatch(/^rook-gen-/);
  });
});
