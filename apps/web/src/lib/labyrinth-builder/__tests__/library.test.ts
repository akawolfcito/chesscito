/**
 * How the builder's record list PRESENTS itself: what a row is called, and what
 * order the rows come in.
 *
 * ⛔ Every record in here is synthetic. This file must never read the catalog:
 * the day someone authors one more exercise, a test that pinned real ids or
 * counts goes red for no reason (feedback_never_pin_authored_content_in_tests,
 * which this repo has already paid for three times).
 */
import { describe, it, expect } from "vitest";
import {
  recordDisplayName,
  sortLibrary,
  tierRank,
  type LibraryRecord,
} from "../library";

function rec(over: Partial<LibraryRecord> = {}): LibraryRecord {
  return { id: "probe-1", order: 0, ...over };
}

describe("recordDisplayName", () => {
  it("prefers the description — the author picks a board by what it IS", () => {
    expect(
      recordDisplayName(rec({ id: "rook-9", explanation: "Friendly blocker" })),
    ).toBe("Friendly blocker");
  });

  it("falls back to the id when there is no description", () => {
    expect(recordDisplayName(rec({ id: "rook-9" }))).toBe("rook-9");
  });

  it("treats a whitespace-only description as absent", () => {
    // Otherwise a stray space renders a row with no visible name at all.
    expect(recordDisplayName(rec({ id: "rook-9", explanation: "   " }))).toBe(
      "rook-9",
    );
  });

  it("survives a record with neither", () => {
    expect(recordDisplayName({ order: 3 })).toBe("(no id)");
  });

  it("trims — the name is laid out next to other columns", () => {
    expect(
      recordDisplayName(rec({ explanation: "  Friendly blocker  " })),
    ).toBe("Friendly blocker");
  });
});

describe("tierRank", () => {
  it("ranks easy → medium → hard", () => {
    expect(tierRank("easy")).toBeLessThan(tierRank("medium"));
    expect(tierRank("medium")).toBeLessThan(tierRank("hard"));
  });

  it("ranks an ABSENT tier as medium, which is what the catalog defaults it to", () => {
    // A record with no tier is a medium record downstream. Sorting it to one end
    // would put it in a difficulty band it does not actually belong to.
    expect(tierRank(undefined)).toBe(tierRank("medium"));
  });
});

describe("sortLibrary", () => {
  const library: LibraryRecord[] = [
    { id: "c", order: 2, tier: "easy" },
    { id: "a", order: 0, tier: "hard" },
    { id: "d", order: 3 }, // untiered → medium
    { id: "b", order: 1, tier: "easy" },
  ];

  const ids = (rs: LibraryRecord[]) => rs.map((r) => r.id);

  it("'order' keeps the real in-game sequence", () => {
    // The default, and the reason it is: this is the order the player meets
    // these boards in. Reading it off the list is how a curriculum gets judged.
    expect(ids(sortLibrary(library, "order"))).toEqual(["a", "b", "c", "d"]);
  });

  it("'tier' groups by difficulty, keeping sequence inside each band", () => {
    expect(ids(sortLibrary(library, "tier"))).toEqual(["b", "c", "d", "a"]);
  });

  it("breaks an exact tie by id, so the list never reshuffles on re-render", () => {
    const tied: LibraryRecord[] = [
      { id: "z", order: 0, tier: "easy" },
      { id: "y", order: 0, tier: "easy" },
    ];
    expect(ids(sortLibrary(tied, "order"))).toEqual(["y", "z"]);
    expect(ids(sortLibrary(tied, "tier"))).toEqual(["y", "z"]);
  });

  it("does not mutate its input", () => {
    const before = ids(library);
    sortLibrary(library, "tier");
    expect(ids(library)).toEqual(before);
  });

  it("survives records with no id", () => {
    const messy: LibraryRecord[] = [{ order: 1 }, { id: "a", order: 0 }];
    expect(() => sortLibrary(messy, "tier")).not.toThrow();
    expect(ids(sortLibrary(messy, "order"))).toEqual(["a", undefined]);
  });
});
