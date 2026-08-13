import type { BuilderState } from "./state";

/**
 * Unsaved-work detection for the builder.
 *
 * ⚠️ The failure this exists to prevent: the builder would happily load another
 * record on top of an in-progress edit — or start a new draft, or switch bucket —
 * and the edit was simply gone, with no prompt, no undo and no trace. Nothing
 * about the screen said work was pending, so there was not even a moment where
 * the author could have noticed.
 *
 * ⚠️ The asymmetry that settles every judgement call below:
 *   - a FALSE POSITIVE (dirty when it is not) costs one needless click;
 *   - a FALSE NEGATIVE (clean when it is not) DESTROYS the edit.
 * So anything not PROVABLY cosmetic counts as an edit. Exactly two differences
 * clear that bar, and the proof is in `buildFenBlock`: it writes `walls` and
 * `enemies` into an 8×8 grid before serialising, so neither array's order can
 * reach the FEN, and toggling a wall off and back on must not raise an alarm.
 *
 * ⛔ `extraGoals` is NOT normalised. It rides into the record as `targets`, an
 * ordered array, so a reorder really does change the bytes that get written.
 */

/** What the draft looked like the last time it agreed with disk. Holds the whole
 *  state (not a hash) precisely so Discard can restore it. */
export type DraftBaseline = {
  state: BuilderState;
  /** The record fields the UI cannot draw, carried verbatim through a save. A
   *  change here is unsaved work too — it round-trips into the written record. */
  extras: Record<string, unknown>;
};

/** Deterministic JSON: object keys sorted at every depth, `undefined` dropped so
 *  an absent optional and an explicitly-undefined one compare equal (a `{...rec}`
 *  spread materialises the latter, and that is not an edit). */
function canonical(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = normalize(v);
    }
    return out;
  }
  return value;
}

/** The comparable form of a draft. Only the two provably order-free collections
 *  are sorted; everything else is compared as authored. */
function comparable(
  state: BuilderState,
  extras: Record<string, unknown>,
): string {
  const { walls, enemies, ...rest } = state;
  return canonical({
    ...rest,
    walls: [...walls].sort(),
    // Sorted by the square, with the PIECE riding along — comparing squares
    // alone would call a black rook retyped to a pawn "clean", which is the
    // exact silent rewrite that `AuthoredEnemy` was introduced to stop.
    enemies: [...enemies]
      .map((e) => `${e.square}:${e.piece}`)
      .sort(),
    extras,
  });
}

/** Does this draft differ from the last state that agreed with disk? */
export function isDirty(
  baseline: DraftBaseline,
  state: BuilderState,
  extras: Record<string, unknown>,
): boolean {
  return (
    comparable(state, extras) !==
    comparable(baseline.state, baseline.extras)
  );
}
