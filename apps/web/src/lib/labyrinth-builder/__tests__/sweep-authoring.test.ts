/**
 * Authoring a Star Sweep in the builder (sweeps-in-the-builder, stage 2).
 *
 * The draft keeps ONE `goal` and adds `extraGoals`, mirroring the runtime's own
 * shape: `targets` is ADDITIVE there and `targetPos` never goes away, so
 * `targets[0] === targetPos` and every pre-sweep reader stays correct. The
 * builder that emitted a separate `goals` array would have to keep the two in
 * sync, and the day they drift the record says one thing and the board another.
 *
 * ⚠️ `targets` must be UI-OWNED. The builder's read-modify-write carries every
 * field it cannot draw through `extraFields` verbatim — which is right for the
 * fields it cannot express, and catastrophic for one it now can: the loaded copy
 * would win over the edit, so removing a star would silently do nothing. That is
 * the same bug the pedagogy fields already hit once.
 */
import { describe, expect, it } from "vitest";

import {
  buildFenBlock,
  buildSaveRecord,
  emptyState,
  extraFields,
  toLabyrinthRecord,
  type BuilderState,
} from "@/lib/labyrinth-builder/state";
import { validateBuilder } from "@/lib/labyrinth-builder/validate";

/** Lone rook on a1. a1 -> a8 -> h1 is 3; the leg to a8 alone is 1. */
const draft = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...emptyState("rook", "exercise"),
  start: "a1",
  goal: "a8",
  ...over,
});

describe("toLabyrinthRecord — sweep emission", () => {
  it("emits no targets for a single-goal draft", () => {
    // A one-goal board must keep meaning exactly that: `[a8]` would read as an
    // authored sweep to anything counting `targets.length`.
    expect(toLabyrinthRecord(draft()).targets).toBeUndefined();
  });

  it("emits target FIRST, then the extra stars", () => {
    const rec = toLabyrinthRecord(draft({ extraGoals: ["h1"] }));

    expect(rec.target).toBe("a8");
    expect(rec.targets).toEqual(["a8", "h1"]);
  });

  it("keeps target === targets[0] when the goal moves", () => {
    // The invariant the whole runtime leans on. If the author re-points the main
    // goal, the sweep follows it — it is not a separate square.
    const rec = toLabyrinthRecord(draft({ goal: "h1", extraGoals: ["a8"] }));

    expect(rec.target).toBe("h1");
    expect(rec.targets![0]).toBe("h1");
  });
});

describe("extraFields — who owns what after the migration", () => {
  it("does NOT carry `targets` through: the UI owns them now", () => {
    // Carried through, the loaded stars would win over the edited ones and
    // REMOVING a star would silently do nothing.
    expect(extraFields({ id: "x", targets: ["a8", "h1"] })).not.toHaveProperty(
      "targets",
    );
  });

  it("still carries `starFloor` through: the UI cannot express it", () => {
    // The column exists and the API accepts it, but no control sets it. Dropping
    // it on every edit would silently retune a board's reward policy.
    expect(extraFields({ id: "x", starFloor: 2 })).toEqual({ starFloor: 2 });
  });
});

describe("buildSaveRecord — what Save actually posts", () => {
  // ⚠️ The one place the stars could still be lost. The page used to assemble
  // this object inline from `editExtras` + the FEN block, so a field the UI owns
  // reaches the wire only if it is listed HERE — and `targets` no longer rides
  // `editExtras`, precisely so the edit can win over the loaded copy.
  const save = (s: BuilderState, extras: Record<string, unknown> = {}) =>
    buildSaveRecord(s, extras, buildFenBlock(s));

  it("posts the stars the author painted", () => {
    expect(save(draft({ extraGoals: ["h1"] })).targets).toEqual(["a8", "h1"]);
  });

  it("posts NO targets once the author removes the last extra star", () => {
    // The un-sweep. With `targets` absent the writer replaces the record whole,
    // so the JSON stops being a sweep and the overlay column goes NULL. Left in
    // `editExtras`, the loaded copy would win and the removal would do nothing.
    const record = save(
      draft({ extraGoals: [] }),
      { targets: ["a8", "h1"], kind: "exercise" },
    );

    expect(record.targets).toBeUndefined();
  });

  it("still carries the fields the UI cannot draw", () => {
    // The other half of the same rule: what the builder cannot express must
    // survive a read-modify-write untouched.
    const record = save(draft(), { starFloor: 2, title: "Sweep the file" });

    expect(record.starFloor).toBe(2);
    expect(record.title).toBe("Sweep the file");
  });
});

describe("validateBuilder — the live verdict knows about sweeps", () => {
  it("reports the ORDER optimum, not the leg to the first star", () => {
    const res = validateBuilder(draft({ extraGoals: ["h1"] }));

    expect(res.ok).toBe(true);
    expect(res.optimalMoves).toBe(3);
  });

  it("draws NO route for a sweep", () => {
    // The generic BFS path is the route to `targets[0]` — one leg. Drawing it
    // under a multi-star board reads as "this is how the level is solved", which
    // is a different, shorter level than the one being authored.
    expect(validateBuilder(draft({ extraGoals: ["h1"] })).path).toEqual([]);
    // The control: a single-goal draft still gets its highlight.
    expect(validateBuilder(draft()).path.length).toBeGreaterThan(0);
  });

  it("refuses a collapsed sweep before Save does", () => {
    // targets[0]=h8 costs 2 from a1, and so does collecting both.
    const res = validateBuilder(draft({ goal: "h8", extraGoals: ["a8"] }));

    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/collapse/i);
  });

  it("refuses a star painted on the goal square", () => {
    const res = validateBuilder(draft({ extraGoals: ["a8"] }));

    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/repeats/i);
  });

  it("refuses a sweep on a LABYRINTH draft, in the author's own words", () => {
    const res = validateBuilder(
      draft({ kind: "labyrinth", extraGoals: ["h1"] }),
    );

    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/labyrinth/i);
  });
});
