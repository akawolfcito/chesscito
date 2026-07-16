import { describe, expect, it } from "vitest";

import { buildCatalog, type ExerciseRecord } from "@/lib/content/catalog";

/**
 * A8 — the semantic linter.
 *
 * The audit found six exercises tagged `capture` with nothing capturable on the
 * board, and one tagged `blocked-rank` whose rank held zero blockers. Nothing
 * caught them: `import-puzzles` verified the BFS (is there a path?) but never
 * the SEMANTICS (does the board stage what the tag claims?).
 *
 * The rule this encodes: the board is the truth, the metadata is a promise, and
 * the build fails when the promise is not kept. Deterministic checks are errors;
 * judgement calls are warnings, because a heuristic that blocks the build trains
 * the team to switch it off.
 *
 * Plan: docs/plans/2026-07-13-rook-curriculum-implementation-plan.md (A8, §11)
 */

/** Rook is a CURATED piece, so every fixture must carry complete pedagogy or the
 *  linter rejects it on that ground alone — which is the point of the rule, and
 *  is asserted on its own below. The board-level rules are what these fixtures
 *  are here to exercise, so the copy is present and boring. */
const base: ExerciseRecord = {
  piece: "rook",
  fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
  mover: "a1",
  target: "h1",
  order: 0,
  principle: "rank-movement",
  title: "Move along the rank",
  playerPrompt: "Reach the star without leaving the rank.",
  learningObjective: "The player recognises horizontal rook movement.",
};

/** Build one exercise and return whatever the linter said about it. Runs with the
 *  release gate ON — the same setting `pnpm import-puzzles` uses. */
function lint(rec: Partial<ExerciseRecord>) {
  const cat = buildCatalog([], [], [{ ...base, ...rec } as ExerciseRecord], {
    requirePedagogy: true,
  });
  return { errors: cat.errors, warnings: cat.warnings };
}

describe("semantic linter — errors (deterministic)", () => {
  it("rejects a `capture` tag when nothing on the board can be captured", () => {
    // The exact shape of rook-4: an empty board that promised a capture.
    const { errors } = lint({ id: "x", tags: ["capture"] });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/capture/i);
  });

  it("accepts a `capture` tag when a capturable enemy is actually there", () => {
    const { errors } = lint({
      id: "x",
      piece: "pawn",
      fen: "8/8/8/3p4/2P5/8/8/8 w - - 0 1",
      mover: "c4",
      target: "d5",
      tags: ["capture"],
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects `blocked-file` when no blocker sits on the mover's or target's file", () => {
    // rook-6's exact lie, in miniature: tagged for a line that is wide open.
    const { errors } = lint({
      id: "x",
      fen: "8/8/8/8/1N6/8/8/R7 w - - 0 1", // blocker on b4 — neither the a- nor the h-file
      target: "h1",
      tags: ["blocked-file"],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/blocked-file/);
  });

  it("accepts `blocked-file` when the mover's file really is shut", () => {
    const { errors } = lint({
      id: "x",
      fen: "8/8/8/8/N7/8/8/R7 w - - 0 1", // blocker on a4, mover on a1
      target: "a8",
      tags: ["blocked-file"],
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects `blocked-rank` when the rank holds no blocker", () => {
    const { errors } = lint({
      id: "x",
      fen: "8/8/8/8/1N6/8/8/R7 w - - 0 1",
      target: "a8",
      tags: ["blocked-rank"],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/blocked-rank/);
  });

  it("rejects `friendly-blocker` on a board with no friendly piece", () => {
    const { errors } = lint({ id: "x", tags: ["friendly-blocker"] });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/friendly-blocker/);
  });

  it("rejects a curated exercise with no pedagogy — this is what kills 'Exercise N'", () => {
    // The fallback stays in the code as a defence for uncurated pieces. For a
    // curated piece it must be unreachable, and the only way to guarantee that
    // is to refuse to compile content with nothing to say.
    const { errors } = lint({
      id: "x",
      title: undefined,
      playerPrompt: undefined,
      principle: undefined,
      learningObjective: undefined,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/missing pedagogy/);
    expect(errors[0]).toMatch(/title/);
  });

  it("treats whitespace-only copy as missing, not as curated", () => {
    const { errors } = lint({ id: "x", title: "   " });
    expect(errors[0]).toMatch(/missing pedagogy: title/);
  });

  it("leaves uncurated pieces alone", () => {
    // Pawn, queen and king still ship uncurated. The linter must not break their
    // build for a lesson nobody has written yet.
    const { errors } = lint({
      id: "x",
      piece: "pawn",
      fen: "8/8/8/8/2P5/8/8/8 w - - 0 1",
      mover: "c4",
      target: "c5",
      principle: undefined,
      title: undefined,
      playerPrompt: undefined,
      learningObjective: undefined,
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects a target that sits on top of a blocker", () => {
    // Unreachable by construction — the square can never be landed on.
    const { errors } = lint({
      id: "x",
      fen: "8/8/8/8/8/8/8/R6N w - - 0 1", // blocker ON h1, which is the target
      target: "h1",
    });
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.join(" ")).toMatch(/target/i);
  });
});

describe("A9 — the blocker art can only tell the truth the content allows", () => {
  /**
   * Practice draws each obstacle as a white knight: the player's own piece,
   * which is what teaches "you cannot jump it and you cannot take it". But
   * `obstacles` carries squares only — the piece type is dropped on the way to
   * the board — so the board cannot verify what it is drawing. The gate does it
   * instead: content that ships a non-knight blocker does not compile, which is
   * what keeps the knight art from becoming a lie about the position.
   */
  it("rejects an exercise blocker that is not a knight", () => {
    const { errors } = lint({
      id: "x",
      fen: "8/8/8/8/B7/8/8/R7 w - - 0 1", // a white BISHOP on a4 — would render as a knight
      target: "a8",
      tags: ["blocked-file"],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/must be white knights/);
    expect(errors[0]).toMatch(/bishop on a4/);
  });

  it("accepts the knight, which is what every shipped blocker already is", () => {
    const { errors } = lint({
      id: "x",
      fen: "8/8/8/8/N7/8/8/R7 w - - 0 1",
      target: "a8",
      tags: ["blocked-file"],
    });
    expect(errors).toHaveLength(0);
  });

  it("leaves the labyrinth alone — its obstacles are walls, not pieces", () => {
    // The maze never draws the piece behind the wall, so the rule has nothing to
    // protect there and must not constrain how mazes are authored.
    const cat = buildCatalog(
      [],
      [
        {
          piece: "rook",
          fen: "8/8/8/8/B7/8/8/R7 w - - 0 1",
          mover: "a1",
          target: "a8",
          order: 0,
        },
      ],
      [],
      { requirePedagogy: true },
    );
    expect(cat.errors).toEqual([]);
  });
});

describe("semantic linter — warnings (heuristic)", () => {
  it("flags an obstacle that changes nothing the player decides", () => {
    // a1 -> h1 is one slide down the rank. A blocker on d4 is on no optimal route
    // and on neither of the rook's opening rays, so it alters nothing: not the
    // move count, not the route count, not the first choice. Pure decoration.
    //
    // Note how hard such a square is to find: on an open board with a 3-move
    // route set, nearly every square sits on SOME optimal route, which is why the
    // criterion below keeps most blockers. That is the intent — it fires on
    // decoration, not on anything that quietly narrows the player's options.
    const { errors, warnings } = lint({
      id: "x",
      fen: "8/8/8/8/3N4/8/8/R7 w - - 0 1",
      target: "h1",
      tags: [],
    });
    expect(errors).toHaveLength(0); // decoration is a smell, never a build break
    expect(warnings.some((w) => /decorative/i.test(w) && /d4/.test(w))).toBe(true);
  });

  it("keeps a blocker that quietly removes an optimal route", () => {
    // The trap this criterion exists to avoid. A blocker on h8 never appears on
    // the route the player takes, so "does it change optimalMoves?" says drop it.
    // But it DOES delete one of the optimal routes (a1 -> h1 -> h8 -> a8), which
    // narrows the choice. optimalMoves alone cannot see that; the decision
    // profile can. Peeled by move count alone, rook-6 fell from 21 blockers to
    // ONE — same optimal of 3, but its optimal routes went 2 -> 7 and its first
    // move went from 8 choices to 11. The detour stopped being a decision.
    const { warnings } = lint({
      id: "x",
      fen: "7N/8/8/8/N7/8/8/R7 w - - 0 1", // a4 + h8
      target: "a8",
      tags: ["blocked-file"],
    });
    expect(warnings.some((w) => /Droppable:.*h8/.test(w))).toBe(false);
  });

  it("peels blockers off together, not one at a time", () => {
    // Three blockers stacked on the a-file. Drop any ONE and the other two still
    // shut the file, so a per-obstacle check calls every one of them essential —
    // which is exactly how rook-6 shipped 21 blockers for a 3-move detour. Only
    // a greedy peel sees that two of the three are redundant.
    const { warnings } = lint({
      id: "x",
      fen: "8/8/N7/N7/N7/8/8/R7 w - - 0 1", // a6 a5 a4
      target: "a8",
      tags: ["blocked-file"],
    });
    const decor = warnings.find((w) => /decorative/i.test(w));
    expect(decor).toBeDefined();
    expect(decor).toMatch(/2\/3 obstacles are decorative/);
  });

  it("stays quiet when every obstacle earns its place", () => {
    const { warnings } = lint({
      id: "x",
      fen: "8/8/8/8/N7/8/8/R7 w - - 0 1",
      target: "a8",
      tags: ["blocked-file"],
    });
    expect(warnings.filter((w) => /decorative/i.test(w))).toHaveLength(0);
  });
});

describe("the shipped catalog is honest", () => {
  it("passes its own linter", async () => {
    // The regression guard: the content in the repo must satisfy every rule the
    // linter enforces. If someone re-adds a tag the board does not back, this
    // fails long before a player meets the lie.
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const read = (f: string) =>
      JSON.parse(readFileSync(resolve(process.cwd(), "content", f), "utf8"));
    const cat = buildCatalog([], read("labyrinths.json"), read("exercises.json"), {
      requirePedagogy: true,
    });
    expect(cat.errors).toEqual([]);
  });
});
