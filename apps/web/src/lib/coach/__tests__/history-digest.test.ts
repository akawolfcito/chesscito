import { describe, it, expect, vi, beforeEach } from "vitest";
import { aggregateRows, aggregateHistory } from "../history-digest.js";
import type { CoachAnalysisRow } from "../types.js";

vi.mock("../../supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { getSupabaseServer } from "../../supabase/server.js";

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

function buildSelectChain(result: { data: CoachAnalysisRow[] | null; error: { message: string } | null }) {
  // Chainable: from(...).select(...).eq(...).order(...).limit(N) → result
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, select, eq, order, limit };
}

describe("aggregateHistory (Supabase wrapper)", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
  });

  it("returns null when getSupabaseServer returns null (missing env)", async () => {
    vi.mocked(getSupabaseServer).mockReturnValue(null);
    expect(await aggregateHistory("0xabc")).toBeNull();
  });

  it("returns null when SELECT errors (fail-soft per §6.5)", async () => {
    const chain = buildSelectChain({ data: null, error: { message: "boom" } });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    expect(await aggregateHistory("0xabc")).toBeNull();
  });

  it("issues SELECT with eq(wallet), order(created_at desc), limit(20)", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await aggregateHistory("0xabc");
    expect(chain.from).toHaveBeenCalledWith("coach_analyses");
    expect(chain.eq).toHaveBeenCalledWith("wallet", "0xabc");
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  it("forwards rows to aggregateRows and returns the digest", async () => {
    const rows: CoachAnalysisRow[] = [
      row({ result: "win", weakness_tags: ["hanging-piece"] }),
      row({ result: "lose", weakness_tags: ["hanging-piece"] }),
    ];
    const chain = buildSelectChain({ data: rows, error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const digest = await aggregateHistory("0xabc");
    expect(digest!.gamesPlayed).toBe(2);
    expect(digest!.topWeaknessTags).toEqual([{ tag: "hanging-piece", count: 2 }]);
  });
});
