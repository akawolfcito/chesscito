/**
 * "Does this draft have unsaved work in it?"
 *
 * ⚠️ The asymmetry that decides every judgement call in here:
 *   - a FALSE POSITIVE (says dirty when it is not) costs the author one needless
 *     confirmation click;
 *   - a FALSE NEGATIVE (says clean when it is not) silently DESTROYS the edit,
 *     which is the exact bug this whole feature exists to fix.
 * So where it is not provable that a difference is cosmetic, it counts as dirty.
 *
 * Two differences ARE provably cosmetic, and only two: `walls` and `enemies`
 * order. `buildFenBlock` writes both into an 8×8 grid before serialising, so the
 * FEN — and therefore the saved record — cannot see the order. Toggling a wall
 * off and back on moves it to the end of the array and must not raise an alarm.
 *
 * `extraGoals` is deliberately NOT normalised: it rides into `targets` as an
 * ordered array, so a reorder genuinely changes the bytes that get written.
 */
import { describe, it, expect } from "vitest";
import { emptyState, type BuilderState } from "../state";
import { isDirty, type DraftBaseline } from "../dirty";

function baselineOf(
  state: BuilderState,
  extras: Record<string, unknown> = {},
): DraftBaseline {
  return { state, extras };
}

/** A loaded record, mid-edit: enough fields set that each test can move one. */
function loaded(): BuilderState {
  return {
    ...emptyState("rook", "exercise"),
    id: "rook-9",
    start: "a1",
    goal: "h8",
    walls: ["c3", "d4"],
    order: 5,
    tier: "medium",
    explanation: "Move your Rook straight to h8",
    principle: "rank-movement",
  };
}

describe("isDirty", () => {
  it("is clean against its own baseline", () => {
    const s = loaded();
    expect(isDirty(baselineOf(s), s, {})).toBe(false);
  });

  it("is clean when the baseline is a structurally equal COPY", () => {
    // The page snapshots the state object it just built; a later render passes a
    // new object with the same content. Identity must not be the test.
    const s = loaded();
    expect(isDirty(baselineOf(loaded()), s, {})).toBe(false);
  });

  describe("what counts as an edit", () => {
    const cases: [string, (s: BuilderState) => BuilderState][] = [
      ["a painted wall", (s) => ({ ...s, walls: [...s.walls, "e5"] })],
      ["a moved start", (s) => ({ ...s, start: "a2" })],
      ["a moved goal", (s) => ({ ...s, goal: "h7" })],
      ["a sweep star", (s) => ({ ...s, extraGoals: ["b2"] })],
      ["a REORDERED sweep (targets is an ordered array)", (s) => ({
        ...s,
        extraGoals: ["b2", "c2"],
      })],
      ["a different piece", (s) => ({ ...s, piece: "bishop" })],
      ["a different order", (s) => ({ ...s, order: 6 })],
      ["a different id", (s) => ({ ...s, id: "rook-10" })],
      ["a different tier", (s) => ({ ...s, tier: "hard" })],
      ["new tags", (s) => ({ ...s, tags: ["straight-line"] })],
      ["an edited description", (s) => ({ ...s, explanation: "something else" })],
      ["an edited principle", (s) => ({ ...s, principle: "file-movement" })],
      ["an edited learning objective", (s) => ({
        ...s,
        learningObjective: "The rook travels any distance along one rank.",
      })],
      ["a promotion target", (s) => ({ ...s, promoteTo: "queen" as const })],
      ["an added enemy", (s) => ({
        ...s,
        enemies: [{ square: "b2", piece: "knight" as const }],
      })],
    ];

    for (const [what, mutate] of cases) {
      it(`counts ${what}`, () => {
        const s = loaded();
        expect(isDirty(baselineOf(s), mutate(s), {})).toBe(true);
      });
    }

    it("counts a retyped enemy on the SAME square", () => {
      // The bug that once turned a black rook into a pawn silently. Comparing
      // only squares would call this clean.
      const s: BuilderState = {
        ...loaded(),
        enemies: [{ square: "b2", piece: "rook" }],
      };
      const retyped: BuilderState = {
        ...s,
        enemies: [{ square: "b2", piece: "pawn" }],
      };
      expect(isDirty(baselineOf(s), retyped, {})).toBe(true);
    });

    it("counts a change to a field the UI cannot even draw", () => {
      // `extras` carries title, playerPrompt, starFloor, kind… Load → edit →
      // save round-trips them, so a change there is unsaved work too.
      const s = loaded();
      expect(
        isDirty(baselineOf(s, { title: "Old" }), s, { title: "New" }),
      ).toBe(true);
    });
  });

  describe("what does NOT count", () => {
    it("ignores wall ORDER — the FEN is written from a grid", () => {
      const s = loaded();
      expect(isDirty(baselineOf(s), { ...s, walls: ["d4", "c3"] }, {})).toBe(false);
    });

    it("survives a wall toggled off and back on", () => {
      const s = loaded();
      const off: BuilderState = { ...s, walls: s.walls.filter((w) => w !== "c3") };
      const backOn: BuilderState = { ...off, walls: [...off.walls, "c3"] };
      expect(isDirty(baselineOf(s), off, {})).toBe(true);
      expect(isDirty(baselineOf(s), backOn, {})).toBe(false);
    });

    it("ignores enemy ORDER, but not enemy CONTENT", () => {
      const s: BuilderState = {
        ...loaded(),
        enemies: [
          { square: "b2", piece: "knight" },
          { square: "c7", piece: "rook" },
        ],
      };
      const reordered: BuilderState = {
        ...s,
        enemies: [
          { square: "c7", piece: "rook" },
          { square: "b2", piece: "knight" },
        ],
      };
      expect(isDirty(baselineOf(s), reordered, {})).toBe(false);
    });

    it("ignores the KEY ORDER of extras", () => {
      const s = loaded();
      expect(
        isDirty(baselineOf(s, { title: "T", kind: "labyrinth" }), s, {
          kind: "labyrinth",
          title: "T",
        }),
      ).toBe(false);
    });

    it("treats an absent optional and an undefined one as the same", () => {
      // `{...rec}` spreads can materialise `tags: undefined`. That is not an edit.
      const s = loaded();
      expect(isDirty(baselineOf(s), { ...s, tags: undefined }, {})).toBe(false);
    });
  });
});
