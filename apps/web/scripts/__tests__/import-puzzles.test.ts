import { describe, expect, it } from "vitest";

import {
  buildCatalog,
  parseCsv,
  renderGeneratedModule,
  type LabyrinthRecord,
} from "../import-puzzles";

const HEADER = "kind,piece,fen,target,mover,tier,tags,explanation,id";

describe("parseCsv", () => {
  it("handles quoted fields containing commas and spaces", () => {
    const text =
      'kind,fen,explanation\n' +
      'labyrinth,"8/8/8/8/8/8/8/R6R w - - 0 1","Slide up, then stop."';
    const rows = parseCsv(text);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([
      "labyrinth",
      "8/8/8/8/8/8/8/R6R w - - 0 1",
      "Slide up, then stop.",
    ]);
  });

  it("supports escaped double quotes inside a quoted field", () => {
    const rows = parseCsv('a,b\n"he said ""hi""",x');
    expect(rows[1]).toEqual(['he said "hi"', "x"]);
  });

  it("drops fully blank lines", () => {
    const rows = parseCsv("a,b\n\n1,2\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("buildCatalog — CSV", () => {
  it("computes optimalMoves via BFS and assembles a rook labyrinth exercise", () => {
    const csv =
      HEADER +
      "\n" +
      'labyrinth,rook,"8/8/8/8/8/8/8/R6R w - - 0 1",a8,a1,easy,,Go up.,';
    const cat = buildCatalog(parseCsv(csv));
    expect(cat.errors).toEqual([]);
    expect(cat.labyrinths.rook).toHaveLength(1);
    const ex = cat.labyrinths.rook[0];
    expect(ex.optimalMoves).toBe(1);
    expect(ex.id.startsWith("rook-gen-")).toBe(true);
    expect(cat.descriptions[ex.id]).toBe("Go up.");
    // no leaked sort key
    expect((ex as Record<string, unknown>).__order).toBeUndefined();
  });

  it("rejects an unsolvable puzzle (boxed mover, BFS returns null)", () => {
    const csv =
      HEADER +
      "\n" +
      'exercise,rook,"8/8/8/8/8/1R6/RRR5/1R6 w - - 0 1",a8,b2,easy,,Trapped.,';
    const cat = buildCatalog(parseCsv(csv));
    expect(cat.errors.length).toBeGreaterThan(0);
    expect(cat.errors.some((e) => e.includes("unsolvable"))).toBe(true);
    expect(cat.exercises.rook).toHaveLength(0);
  });

  it("fails on duplicate ids", () => {
    const row = (id: string) =>
      `exercise,rook,"8/8/8/8/8/8/8/R7 w - - 0 1",a8,a1,easy,,Up.,${id}`;
    const csv = [HEADER, row("dup1"), row("dup1")].join("\n");
    const cat = buildCatalog(parseCsv(csv));
    expect(cat.errors.some((e) => e.includes("duplicate id"))).toBe(true);
    expect(cat.exercises.rook).toHaveLength(1);
  });

  it("reports a missing required column", () => {
    const cat = buildCatalog(parseCsv("piece,fen,target,tier\nrook,x,a8,easy"));
    expect(cat.errors.some((e) => e.includes("missing required column 'kind'")))
      .toBe(true);
  });
});

describe("buildCatalog — labyrinths.json", () => {
  it("ingests records sorted by (order, id)", () => {
    const records: LabyrinthRecord[] = [
      {
        id: "later",
        piece: "rook",
        fen: "8/8/8/8/8/8/8/R6R w - - 0 1",
        target: "a8",
        mover: "a1",
        order: 20,
      },
      {
        id: "earlier",
        piece: "rook",
        fen: "8/8/8/8/8/8/8/R6R w - - 0 1",
        target: "h8",
        mover: "h1",
        order: 10,
      },
    ];
    const cat = buildCatalog([], records);
    expect(cat.errors).toEqual([]);
    expect(cat.labyrinths.rook.map((e) => e.id)).toEqual(["earlier", "later"]);
  });

  it("warns (non-fatally) on a duplicate position and still keeps both puzzles", () => {
    const records: LabyrinthRecord[] = [
      {
        id: "dup-a",
        piece: "rook",
        fen: "8/8/8/8/8/8/8/R6R w - - 0 1",
        target: "a8",
        mover: "a1",
        order: 0,
      },
      {
        id: "dup-b",
        piece: "rook",
        fen: "8/8/8/8/8/8/8/R6R w - - 0 1",
        target: "a8",
        mover: "a1",
        order: 1,
      },
    ];
    const cat = buildCatalog([], records);
    expect(cat.errors).toEqual([]);
    expect(cat.labyrinths.rook.map((e) => e.id)).toEqual(["dup-a", "dup-b"]);
    expect(cat.warnings.some((w) => w.includes("duplicate position"))).toBe(true);
  });

  it("is reorder-invariant: array order never changes the output id sequence", () => {
    const a: LabyrinthRecord = {
      id: "lab-a",
      piece: "rook",
      fen: "8/8/8/8/8/8/8/R6R w - - 0 1",
      target: "a8",
      mover: "a1",
      order: 10,
    };
    const b: LabyrinthRecord = {
      id: "lab-b",
      piece: "rook",
      fen: "8/8/8/8/8/8/8/R6R w - - 0 1",
      target: "h8",
      mover: "h1",
      order: 20,
    };
    const forward = buildCatalog([], [a, b]).labyrinths.rook.map((e) => e.id);
    const reversed = buildCatalog([], [b, a]).labyrinths.rook.map((e) => e.id);
    expect(forward).toEqual(reversed);
    expect(forward).toEqual(["lab-a", "lab-b"]);
  });

  it("rejects a record with a bad piece", () => {
    const cat = buildCatalog([], [
      {
        // @ts-expect-error intentional bad piece for validation
        piece: "dragon",
        fen: "8/8/8/8/8/8/8/R6R w - - 0 1",
        target: "a8",
        order: 0,
      },
    ]);
    expect(cat.errors.some((e) => e.includes("bad piece"))).toBe(true);
  });
});

describe("renderGeneratedModule", () => {
  it("emits all three exports and the DO NOT EDIT banner", () => {
    const cat = buildCatalog(
      parseCsv(
        HEADER +
          "\n" +
          'labyrinth,rook,"8/8/8/8/8/8/8/R6R w - - 0 1",a8,a1,easy,,Go up.,',
      ),
    );
    const out = renderGeneratedModule(cat);
    expect(out).toContain("DO NOT EDIT");
    expect(out).toContain("GENERATED_EXERCISES");
    expect(out).toContain("GENERATED_LABYRINTHS");
    expect(out).toContain("GENERATED_EXERCISE_DESCRIPTIONS");
  });
});
