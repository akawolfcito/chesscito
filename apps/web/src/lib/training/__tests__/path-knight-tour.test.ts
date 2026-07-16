import { describe, expect, it } from "vitest";
import { buildTrainingPath } from "@/lib/training/path";
import type { Exercise, PieceId, PieceProgress } from "@/lib/game/types";

/**
 * Knight's Tour nodes ride the labyrinth machinery (nav, unlock, completion) —
 * that is the adapter that lets a signature game reuse it without a new
 * TrainingNodeKind. But they must NOT ride its GRADER.
 *
 * A tour's stored best is coverage and its optimalMoves is the reachable
 * ceiling, so best <= optimalMoves ALWAYS — which is labyrinthStars' "3 stars"
 * band. Left alone, the drawer hands 3 stars to every tour ever opened,
 * including a 3-square dead end.
 */
const tour = (id: string, ceiling: number): Exercise => ({
  id,
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 0, rank: 0 },
  optimalMoves: ceiling,
});

const emptyByPiece = (): Record<PieceId, Exercise[]> => ({
  rook: [], bishop: [], knight: [], pawn: [], queen: [], king: [],
});

// Enough exercise stars to clear the first-labyrinth gate, so the node is live.
const progress: PieceProgress = {
  piece: "knight",
  currentId: "knight-1",
  stars: { "knight-1": 3, "knight-2": 3, "knight-3": 3 },
};

function pathWith(best: number, coverageIds?: ReadonlySet<string>) {
  const labyrinths = emptyByPiece();
  // Ceiling 23 = the 24-square placeholder level (knight-tour-1).
  labyrinths.knight = [tour("knight-tour-1", 23)];
  return buildTrainingPath({
    piece: "knight",
    progress,
    labyrinthBests: { "knight-tour-1": best },
    badgeClaimed: false,
    catalog: { exercises: emptyByPiece(), labyrinths },
    coverageIds,
  });
}

const starsOf = (best: number, coverageIds?: ReadonlySet<string>) =>
  pathWith(best, coverageIds).find((n) => n.id === "knight-tour-1")!.stars;

describe("buildTrainingPath — knight-tour grading", () => {
  const TOURS = new Set(["knight-tour-1"]);

  it("grades a full tour 3 stars", () => {
    expect(starsOf(24, TOURS)).toBe(3);
  });

  it("grades the 80% pass 1 star", () => {
    expect(starsOf(20, TOURS)).toBe(1); // 20/24 = 83%
  });

  it("grades a dead end 0 stars", () => {
    expect(starsOf(3, TOURS)).toBe(0); // 3/24 = 12%
  });

  it("without coverageIds it would hand the dead end 3 stars — the bug this prevents", () => {
    // Pinning the wrong behaviour on purpose: this is what the drawer showed
    // before the grader was routed, and it is silent (nobody reports a bug that
    // awards them the top score).
    expect(starsOf(3)).toBe(3);
  });

  it("still grades a real labyrinth by move count", () => {
    // Regression guard: routing tours must not touch the labyrinth lane.
    expect(starsOf(3, new Set())).toBe(3); // 3 moves vs optimal 23 → fast → 3 stars
  });
});
