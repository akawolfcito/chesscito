import { describe, it, expect } from "vitest";
import { aggregateRows } from "../history-digest.js";
import type { CoachAnalysisRow } from "../types.js";

function row(overrides: Partial<CoachAnalysisRow> = {}): CoachAnalysisRow {
  return {
    wallet: "0xabc",
    game_id: "00000000-0000-0000-0000-000000000001",
    created_at: "2026-05-06T00:00:00.000Z",
    expires_at: "2027-05-06T00:00:00.000Z",
    kind: "full",
    difficulty: "medium",
    result: "lose",
    total_moves: 30,
    summary_text: "summary",
    mistakes: [],
    lessons: [],
    praise: [],
    weakness_tags: [],
    ...overrides,
  };
}

describe("aggregateRows", () => {
  it("returns null on empty input", () => {
    expect(aggregateRows([])).toBeNull();
  });

  it("counts gamesPlayed and result buckets across rows", () => {
    const digest = aggregateRows([
      row({ result: "win" }),
      row({ result: "win" }),
      row({ result: "lose" }),
      row({ result: "draw" }),
      row({ result: "resigned" }),
    ]);
    expect(digest).not.toBeNull();
    expect(digest!.gamesPlayed).toBe(5);
    expect(digest!.recentResults).toEqual({ win: 2, lose: 1, draw: 1, resigned: 1 });
  });

  it("flattens and counts weakness_tags across rows", () => {
    const digest = aggregateRows([
      row({ weakness_tags: ["hanging-piece", "missed-tactic"] }),
      row({ weakness_tags: ["hanging-piece"] }),
      row({ weakness_tags: ["weak-king-safety"] }),
    ]);
    expect(digest!.topWeaknessTags).toEqual([
      { tag: "hanging-piece", count: 2 },
      { tag: "missed-tactic", count: 1 },
      { tag: "weak-king-safety", count: 1 },
    ]);
  });

  it("breaks ties alphabetically ascending", () => {
    const digest = aggregateRows([
      row({ weakness_tags: ["weak-pawn-structure"] }),
      row({ weakness_tags: ["hanging-piece"] }),
      row({ weakness_tags: ["missed-tactic"] }),
    ]);
    expect(digest!.topWeaknessTags.map((t) => t.tag)).toEqual([
      "hanging-piece",
      "missed-tactic",
      "weak-pawn-structure",
    ]);
  });

  it("returns at most 3 tags, descending by count", () => {
    const digest = aggregateRows([
      row({ weakness_tags: ["hanging-piece", "missed-tactic", "weak-king-safety", "weak-pawn-structure"] }),
      row({ weakness_tags: ["missed-tactic"] }),
      row({ weakness_tags: ["weak-king-safety"] }),
      row({ weakness_tags: ["weak-king-safety"] }),
    ]);
    expect(digest!.topWeaknessTags).toEqual([
      { tag: "weak-king-safety", count: 3 },
      { tag: "missed-tactic", count: 2 },
      { tag: "hanging-piece", count: 1 },
    ]);
  });

  it("returns digest with empty topWeaknessTags when all rows have no tags", () => {
    const digest = aggregateRows([
      row({ weakness_tags: [] }),
      row({ weakness_tags: [] }),
    ]);
    expect(digest).not.toBeNull();
    expect(digest!.gamesPlayed).toBe(2);
    expect(digest!.topWeaknessTags).toEqual([]);
  });
});
