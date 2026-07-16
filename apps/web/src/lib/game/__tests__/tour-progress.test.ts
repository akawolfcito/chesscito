import { describe, expect, it, beforeEach } from "vitest";
import {
  recordTourBest,
  getLabyrinthBest,
  recordLabyrinthBest,
} from "@/lib/game/labyrinth-progress";

/**
 * The tour's ledger write. It shares the labyrinth best-map (one key per piece)
 * but INVERTS the improvement test: a labyrinth best is the fewest moves, a
 * tour best is the most squares covered.
 *
 * This is the concrete bug the whole coverage lane exists to avoid — see the
 * last test.
 */
describe("recordTourBest", () => {
  beforeEach(() => localStorage.clear());

  it("records the first run", () => {
    expect(recordTourBest("knight", "knight-tour-1", 12)).toBe(true);
    expect(getLabyrinthBest("knight", "knight-tour-1")).toBe(12);
  });

  it("keeps the LARGER coverage", () => {
    recordTourBest("knight", "knight-tour-1", 12);
    expect(recordTourBest("knight", "knight-tour-1", 20)).toBe(true);
    expect(getLabyrinthBest("knight", "knight-tour-1")).toBe(20);
  });

  it("refuses to let a worse run overwrite a better one", () => {
    recordTourBest("knight", "knight-tour-1", 20);
    expect(recordTourBest("knight", "knight-tour-1", 3)).toBe(false);
    expect(getLabyrinthBest("knight", "knight-tour-1")).toBe(20);
  });

  it("ignores an empty run", () => {
    expect(recordTourBest("knight", "knight-tour-1", 0)).toBe(false);
  });

  it("is the exact inverse of recordLabyrinthBest, which would lose the good run", () => {
    // Same numbers, same order, opposite verdicts. Route a tour through the
    // labyrinth writer and the 3-square dead end lands as a "new best",
    // destroying the 20-square run the player actually earned.
    recordTourBest("knight", "tour", 20);
    recordLabyrinthBest("knight", "lab", 20);
    recordTourBest("knight", "tour", 3);
    recordLabyrinthBest("knight", "lab", 3);
    expect(getLabyrinthBest("knight", "tour")).toBe(20);
    expect(getLabyrinthBest("knight", "lab")).toBe(3);
  });
});
