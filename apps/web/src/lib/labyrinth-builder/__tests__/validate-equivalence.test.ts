import { describe, expect, it } from "vitest";

import { buildCatalog } from "@/lib/content/catalog";
import type { BuilderState } from "../state";
import { toLabyrinthRecord } from "../state";
import { validateBuilder } from "../validate";

/**
 * AC-5 — ONE validator. `validateBuilder` (which gates Save) must return exactly
 * the ERRORS that `buildCatalog` (which decides for real, at save time) would
 * return for the same draft. If they can diverge, the builder lets an author
 * paint a level Save then rejects — the bug this stage closes.
 *
 * The test asserts AGREEMENT, not specific messages: it never needs to know the
 * right answer for a kind, only that the two validators give the same one. It
 * runs buildCatalog INDEPENDENTLY (not through validateBuilder) so a second
 * opinion creeping back into the validator is caught here.
 */

/** buildCatalog independently, routed to the same bucket validateBuilder uses,
 *  with the file+id label stripped so it compares to the bare live message. */
function catalogErrors(s: BuilderState): string[] {
  const rec = toLabyrinthRecord(s);
  const cat = s.kind === "exercise"
    ? buildCatalog([], [], [rec])
    : buildCatalog([], [rec], []);
  return cat.errors
    .map((e) => e.replace(/^(?:labyrinths|exercises)\.json '[^']*':\s*/, ""))
    .sort();
}

const draft = (over: Partial<BuilderState>): BuilderState => ({
  kind: "exercise",
  piece: "rook",
  start: "a1",
  goal: "a8",
  walls: [],
  enemies: [],
  order: 0,
  ...over,
});

const cases: { name: string; state: BuilderState }[] = [
  { name: "exercise — solvable", state: draft({ kind: "exercise" }) },
  { name: "labyrinth — solvable", state: draft({ kind: "labyrinth", piece: "rook", walls: ["a4", "b8"] }) },
  { name: "diagonal-run — bishop", state: draft({ kind: "diagonal-run", piece: "bishop", start: "c1", goal: "a3" }) },
  { name: "knight-tour — targetless, open", state: draft({ kind: "knight-tour", piece: "knight", start: "d4", goal: null }) },
  { name: "queens — targetless, open", state: draft({ kind: "queens", piece: "queen", start: "d4", goal: null }) },
  { name: "safe-path — king with a threat", state: draft({ kind: "safe-path", piece: "king", start: "a1", goal: "h8", enemies: [{ square: "d4", piece: "knight" }] }) },
  { name: "promotion-run — no promoteTo (must error)", state: draft({ kind: "promotion-run", piece: "pawn", start: "a2", goal: null }) },
  { name: "promotion-run — with promoteTo", state: draft({ kind: "promotion-run", piece: "pawn", start: "b2", goal: null, promoteTo: "queen", walls: ["b3", "b4", "b5"], enemies: [{ square: "c3", piece: "rook" }] }) },
];

describe("validateBuilder ≡ buildCatalog (AC-5)", () => {
  for (const c of cases) {
    it(`agrees on errors: ${c.name}`, () => {
      const live = [...validateBuilder(c.state).errors].sort();
      expect(live).toEqual(catalogErrors(c.state));
    });
  }
});
