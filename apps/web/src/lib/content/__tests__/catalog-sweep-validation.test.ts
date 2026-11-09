import { describe, expect, it } from "vitest";
import { buildCatalog, type LabyrinthRecord } from "@/lib/content/catalog";

/**
 * Star Sweep authoring rules, enforced in the ONE validator both the JSON import
 * and the builder's write route go through (`buildCatalog`). The builder is about
 * to start writing `targets` (sweeps-in-the-builder spec §2.1), and a second copy
 * of these rules living in the route would drift from this one within a release.
 *
 * Four of these cases do not merely produce a bad level — they produce one nobody
 * can debug:
 *
 *  - a sweep in the LABYRINTH bucket is dropped silently today, because the
 *    labyrinth runtime is not sweep-aware: it ends the level on the first star and
 *    then grades the run against a sweep-sized optimum. Three stars for half a
 *    level, in silence.
 *  - the pawn and the 5-target cap THROW out of `computeSweepOptimal`. An uncaught
 *    throw in the write route is a 500, and a 500 carries Supabase's own message
 *    to the builder, never the reason — so the author sees a crash, not a rule.
 *  - a bishop star on the opposite colour is not "hard", it is unreachable, and
 *    "unreachable" sends the author hunting for a blocker that does not exist.
 *  - a sweep whose first leg costs as much as the whole sweep has COLLAPSED back
 *    into a one-goal board: the extra stars are decoration and the experiment
 *    measures a level that is not the one that shipped.
 */

const PEDAGOGY = {
  principle: "Sweep the file",
  title: "Test sweep",
  playerPrompt: "Collect every star",
  learningObjective: "Plan the cheapest order",
};

/** Lone white rook on a1. Empty board: every leg is measured by the BFS alone. */
const rookSweep = (over: Partial<LabyrinthRecord> = {}): LabyrinthRecord => ({
  id: "sweep-test",
  piece: "rook",
  fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
  mover: "a1",
  target: "a8",
  targets: ["a8", "h1"],
  order: 0,
  ...PEDAGOGY,
  ...over,
});

describe("buildCatalog — Star Sweep validation", () => {
  it("accepts a well-formed sweep and stores the ORDER optimum", () => {
    // a1 -> a8 -> h1 (or the mirror) is 3; the single leg to a8 is 1.
    const cat = buildCatalog([], [], [rookSweep()]);

    expect(cat.errors).toEqual([]);
    expect(cat.exercises.rook).toHaveLength(1);
    expect(cat.exercises.rook[0].optimalMoves).toBe(3);
    expect(cat.exercises.rook[0].targets).toHaveLength(2);
  });

  it("ACCEPTS a sweep in the labyrinth bucket, since the runtime learned them", () => {
    // Until 2026-08-12 this was a 400: the maze handler ended the level on the
    // first star and graded that half-run against the full sweep optimum.
    const cat = buildCatalog([], [rookSweep({ kind: "labyrinth" })], []);

    expect(cat.errors).toEqual([]);
    expect(cat.labyrinths.rook).toHaveLength(1);
    expect(cat.labyrinths.rook[0].optimalMoves).toBe(3);
    expect(cat.labyrinths.rook[0].targets).toHaveLength(2);
  });

  it("still rejects `targets` on a signature game, naming its own solver", () => {
    // ⛔ Each of the five answers its own question: a tour has no destination,
    //    Promotion Run grades failures, Safe Path's route needs the attack map.
    //    A generic-BFS sweep optimum there is a confident number about another
    //    game.
    const cat = buildCatalog(
      [],
      [rookSweep({ kind: "diagonal-run", piece: "bishop", fen: "8/8/8/8/8/8/8/2B5 w - - 0 1", mover: "c1", target: "e3", targets: ["e3", "g5"] })],
      [],
    );

    expect(cat.errors).toHaveLength(1);
    expect(cat.errors[0]).toMatch(/diagonal-run/);
    expect(cat.errors[0]).toMatch(/own solver|different game/i);
  });

  it("reports the pawn as a RULE, never as a throw", () => {
    // `computeSweepOptimal` throws for the pawn (it never retreats, so its legs
    // are not independent). Through the write route an uncaught throw is a 500,
    // and a 500 never carries the reason to the builder.
    const build = () =>
      buildCatalog(
        [],
        [],
        [
          rookSweep({
            piece: "pawn",
            fen: "8/8/8/8/8/8/P7/8 w - - 0 1",
            mover: "a2",
            target: "a4",
            targets: ["a4", "a6"],
          }),
        ],
      );

    expect(build).not.toThrow();
    const cat = build();
    expect(cat.errors).toHaveLength(1);
    expect(cat.errors[0]).toMatch(/pawn/i);
    expect(cat.exercises.pawn).toHaveLength(0);
  });

  it("reports more than five targets as a RULE, never as a throw", () => {
    const build = () =>
      buildCatalog(
        [],
        [],
        [
          rookSweep({
            targets: ["a8", "h1", "h8", "d4", "e5", "b2"],
          }),
        ],
      );

    expect(build).not.toThrow();
    const cat = build();
    expect(cat.errors).toHaveLength(1);
    expect(cat.errors[0]).toMatch(/5|five/);
    expect(cat.exercises.rook).toHaveLength(0);
  });

  it("tells a bishop author the star is the wrong COLOUR, not 'unreachable'", () => {
    // c1 is dark; e3 is dark; d3 is light. A bishop never leaves its colour, so
    // d3 is not hard to reach — it does not exist for this piece. Saying
    // "unreachable" sends the author hunting for a blocker that is not there.
    const cat = buildCatalog(
      [],
      [],
      [
        rookSweep({
          piece: "bishop",
          fen: "8/8/8/8/8/8/8/2B5 w - - 0 1",
          mover: "c1",
          target: "e3",
          targets: ["e3", "d3"],
        }),
      ],
    );

    expect(cat.errors).toHaveLength(1);
    expect(cat.errors[0]).toMatch(/colour|color/i);
    expect(cat.errors[0]).toMatch(/d3/);
    expect(cat.exercises.bishop).toHaveLength(0);
  });

  it("rejects a sweep that COLLAPSED into a one-goal board", () => {
    // targets a8 + h8 from a1: the sweep optimum is 2 (a1-a8-h8), and the single
    // leg to targets[0]=h8 is also 2 (a1-h1-h8). The extra star costs the player
    // nothing, so the board is a one-goal level wearing two stars.
    const cat = buildCatalog(
      [],
      [],
      [rookSweep({ target: "h8", targets: ["h8", "a8"] })],
    );

    expect(cat.errors).toHaveLength(1);
    expect(cat.errors[0]).toMatch(/collapse|cheaper|one[- ]goal/i);
    expect(cat.exercises.rook).toHaveLength(0);
  });

  it("keeps the cheap-first-leg rule OFF single-goal exercises", () => {
    // A plain exercise has one target and no sweep optimum to compare against.
    const cat = buildCatalog(
      [],
      [],
      [rookSweep({ targets: undefined, target: "a8" })],
    );

    expect(cat.errors).toEqual([]);
    expect(cat.exercises.rook[0].optimalMoves).toBe(1);
  });
});
