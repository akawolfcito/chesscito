import { describe, expect, it } from "vitest";

import {
  deriveContentLoopAction,
  selectNextAvailablePiece,
  selectPrimaryPiece,
} from "@/lib/hub/content-loop";
import type { TrainingNode } from "@/lib/training/path";
import type { PieceId } from "@/lib/game/types";

/**
 * The Content Loop was born rook-only (Lite v1) and never grew out of it:
 * `use-hub-data` evaluated `LITE_PRIMARY_PIECE` forever and passed
 * `nextAvailablePiece: null` — a hardcode that made the `next-piece` variant
 * dead code. All six pieces ship now, so a player who finished the rook was
 * told to keep training it, and Start Focus dropped them back on its last
 * exercise, over and over.
 *
 * These two selectors are what the loop was missing: which piece the player is
 * actually on, and which one comes after it.
 */

const ORDER: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

function exercise(piece: PieceId, id: string, done: boolean): TrainingNode {
  return {
    id,
    kind: "exercise",
    piece,
    unlock: { type: "always" },
    status: done ? "complete" : "available",
    stars: done ? 3 : 0,
  };
}

/** A piece with every exercise at 3 stars and no labyrinths left. */
function finished(piece: PieceId): TrainingNode[] {
  return [exercise(piece, `${piece}-1`, true), exercise(piece, `${piece}-2`, true)];
}

/** A piece with work still on the table. */
function unfinished(piece: PieceId): TrainingNode[] {
  return [exercise(piece, `${piece}-1`, true), exercise(piece, `${piece}-2`, false)];
}

describe("selectPrimaryPiece", () => {
  it("is the first piece in order that still has work left", () => {
    const paths = {
      rook: finished("rook"),
      bishop: finished("bishop"),
      knight: unfinished("knight"),
      pawn: unfinished("pawn"),
    };

    expect(selectPrimaryPiece(ORDER, paths)).toBe("knight");
  });

  it("stays on the rook while the rook is unfinished", () => {
    const paths = { rook: unfinished("rook"), bishop: unfinished("bishop") };

    expect(selectPrimaryPiece(ORDER, paths)).toBe("rook");
  });

  /** A player who has finished EVERYTHING still needs a piece to evaluate, or
   *  the loop has no path at all and falls through to its dead-screen
   *  fallback. The first piece in order is the honest answer: there is nothing
   *  left to advance to. */
  it("falls back to the first piece when every piece is finished", () => {
    const paths = { rook: finished("rook"), bishop: finished("bishop") };

    expect(selectPrimaryPiece(ORDER, paths)).toBe("rook");
  });

  it("ignores a piece with no content at all", () => {
    const paths = { rook: finished("rook"), bishop: [], knight: unfinished("knight") };

    expect(selectPrimaryPiece(ORDER, paths)).toBe("knight");
  });

  /** Founder call (2026-07-12): the EXERCISES drive piece advancement. The rook
   *  ships three labyrinths, so letting a pending one hold the focus would pin
   *  the player to a piece whose badge they already claimed — the very loop this
   *  rule exists to break. Side content stays visible; it does not hold the path
   *  hostage. */
  it("does not let a pending labyrinth hold the focus on a finished piece", () => {
    const rookWithMaze: TrainingNode[] = [
      ...finished("rook"),
      {
        id: "rook-lab-2",
        kind: "labyrinth",
        piece: "rook",
        unlock: { type: "stars", min: 6 },
        status: "available",
        stars: null,
      },
    ];
    const paths = { rook: rookWithMaze, bishop: unfinished("bishop") };

    expect(selectPrimaryPiece(ORDER, paths)).toBe("bishop");
    expect(selectNextAvailablePiece(ORDER, paths, "bishop")).toBeNull();
  });
});

describe("selectNextAvailablePiece", () => {
  it("is the next piece in order with work left, after the primary", () => {
    const paths = {
      rook: finished("rook"),
      bishop: finished("bishop"),
      knight: unfinished("knight"),
      pawn: unfinished("pawn"),
    };

    expect(selectNextAvailablePiece(ORDER, paths, "knight")).toBe("pawn");
  });

  it("skips finished pieces to find one that still has content", () => {
    const paths = {
      rook: unfinished("rook"),
      bishop: finished("bishop"),
      knight: finished("knight"),
      pawn: unfinished("pawn"),
    };

    expect(selectNextAvailablePiece(ORDER, paths, "rook")).toBe("pawn");
  });

  it("is null when nothing is left after the primary — never invent a destination", () => {
    const paths = { rook: unfinished("rook"), bishop: finished("bishop") };

    expect(selectNextAvailablePiece(ORDER, paths, "rook")).toBeNull();
  });

  it("never points back at the primary piece", () => {
    const paths = { rook: unfinished("rook") };

    expect(selectNextAvailablePiece(ORDER, paths, "rook")).toBeNull();
  });
});

/**
 * The destination table shipped with `?piece=rook` baked into three variants.
 * Selecting a primary piece is useless if the CTA still walks the player back
 * to the rook — the loop must send them to the piece it just reasoned about.
 */
describe("deriveContentLoopAction — destinations follow the primary piece", () => {
  const daily = {
    streak: 1,
    lastCompletedDate: "2026-07-12",
    totalCompleted: 1,
  };
  const base = {
    daily,
    today: "2026-07-12",
    welcomePackage: { unlocked: false, claimed: true },
    nextAvailablePiece: null,
    sessionQuota: null,
  };

  it("sends continue-path to the primary piece, not the rook", () => {
    const action = deriveContentLoopAction({
      ...base,
      primaryPiece: "knight",
      primaryPath: unfinished("knight"),
    });

    expect(action.variant).toBe("continue-path");
    expect(action.destination).toBe("/exercises?piece=knight");
  });

  it("sends improve-stars to the primary piece", () => {
    const path: TrainingNode[] = [
      { ...exercise("pawn", "pawn-1", true), stars: 1 },
      { ...exercise("pawn", "pawn-2", true), stars: 2 },
    ];

    const action = deriveContentLoopAction({
      ...base,
      primaryPiece: "pawn",
      primaryPath: path,
    });

    expect(action.variant).toBe("improve-stars");
    expect(action.destination).toBe("/exercises?piece=pawn");
  });

  it("sends labyrinth-ready to the primary piece", () => {
    const path: TrainingNode[] = [
      exercise("bishop", "bishop-1", true),
      {
        id: "bishop-lab-1",
        kind: "labyrinth",
        piece: "bishop",
        unlock: { type: "stars", min: 6 },
        status: "available",
        stars: null,
      },
    ];

    const action = deriveContentLoopAction({
      ...base,
      primaryPiece: "bishop",
      primaryPath: path,
    });

    expect(action.variant).toBe("labyrinth-ready");
    expect(action.destination).toBe("/exercises?piece=bishop");
  });
});
