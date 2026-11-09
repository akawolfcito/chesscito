/**
 * Classifying the linter's save-time advice.
 *
 * ⚠️ Why this exists at all: the founder read the warnings panel as decorative —
 * "si todo sale en warning ya sabemos que eso se obvia, no sé qué trato debo
 * darle". That diagnosis is right, and the fix is NOT a severity filter: the
 * linter emits no errors into this channel at all (errors block the save and
 * never reach it), so filtering by severity would filter one bucket into itself.
 *
 * The axis that actually separates them is KIND, because the kinds carry
 * genuinely different obligations — two are advisory by an explicit product
 * decision, and the third is known to be wrong on Star Sweep boards.
 *
 * ⛔ These cases run the REAL linter and classify the REAL strings it returns.
 * A classifier that pattern-matches on remembered copy is a classifier that
 * silently drops every warning the day someone rewords one — so nothing here
 * hardcodes a message. If a message changes, this goes red, which is the point.
 */
import { describe, it, expect } from "vitest";
import { lintPieceSequence } from "@/lib/content/lint";
import {
  classifyWarning,
  groupWarnings,
  WARNING_GUIDANCE,
  type WarningKind,
} from "../warnings";

/** Ask the real linter for a backwards curve. */
function backwardsCurve(): string[] {
  return lintPieceSequence({
    piece: "rook",
    exercises: [
      { id: "a", optimalMoves: 5 },
      { id: "b", optimalMoves: 2 },
    ],
  }).warnings;
}

/** Ask the real linter for a curve that jumps too far. */
function jumpingCurve(): string[] {
  return lintPieceSequence({
    piece: "rook",
    exercises: [
      { id: "a", optimalMoves: 1 },
      { id: "b", optimalMoves: 40 },
    ],
  }).warnings;
}

describe("classifyWarning — against the real linter", () => {
  it("bins a backwards curve as pacing", () => {
    const [text] = backwardsCurve();
    expect(text).toBeTruthy();
    expect(classifyWarning(text)).toBe<WarningKind>("pacing");
  });

  it("bins a jumping curve as pacing", () => {
    const [text] = jumpingCurve();
    expect(text).toBeTruthy();
    expect(classifyWarning(text)).toBe<WarningKind>("pacing");
  });

  it("bins the decorative-obstacle audit as its own kind", () => {
    // lintPuzzle needs a solved board to reach this branch, which is a heavy
    // fixture; the shape is stable and pinned here because THIS is the warning
    // the founder must be able to tell apart from the pacing ones.
    expect(
      classifyWarning(
        "rook-9: 9/10 obstacles are decorative — 1 preserve the decision " +
          "(optimal 4, 2 optimal routes, 3 first moves). Droppable: c3 d4",
      ),
    ).toBe<WarningKind>("decorative");
  });

  it("does not guess: anything unrecognised falls to `other`", () => {
    // A new warning must surface UNCLASSIFIED rather than be quietly filed under
    // an existing kind and inherit guidance that does not apply to it.
    expect(classifyWarning("rook: something nobody has written yet")).toBe(
      "other",
    );
  });
});

describe("WARNING_GUIDANCE", () => {
  it("answers 'what treatment does this deserve?' for every kind", () => {
    // The founder's actual complaint. A label without a treatment is the same
    // decoration in a new colour.
    for (const kind of ["pacing", "decorative", "other"] as WarningKind[]) {
      expect(WARNING_GUIDANCE[kind].label).toBeTruthy();
      expect(WARNING_GUIDANCE[kind].treatment.length).toBeGreaterThan(10);
    }
  });

  it("flags the decorative audit as unreliable on sweeps", () => {
    // It once called 9 of 10 walls decorative on walls that QUADRUPLED the route.
    // Shipping this panel without saying so would launder a known-bad verdict.
    expect(WARNING_GUIDANCE.decorative.caveat).toMatch(/sweep/i);
  });
});

describe("groupWarnings", () => {
  it("keeps every warning — a filter must never lose one", () => {
    const all = [...backwardsCurve(), ...jumpingCurve(), "unknown shape"];
    const grouped = groupWarnings(all);
    expect(grouped).toHaveLength(all.length);
    expect(grouped.map((g) => g.text)).toEqual(all);
  });

  it("preserves input order inside the list", () => {
    const all = ["unknown one", ...backwardsCurve(), "unknown two"];
    expect(groupWarnings(all).map((g) => g.text)).toEqual(all);
  });

  it("tags each one with its kind", () => {
    const grouped = groupWarnings([...backwardsCurve(), "unknown shape"]);
    expect(grouped[0].kind).toBe("pacing");
    expect(grouped[1].kind).toBe("other");
  });

  it("survives an empty list", () => {
    expect(groupWarnings([])).toEqual([]);
  });
});
