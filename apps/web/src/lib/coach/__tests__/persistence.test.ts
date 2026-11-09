import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistAnalysis } from "../persistence.js";
import type { CoachResponse } from "../types.js";

vi.mock("../../supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { getSupabaseServer } from "../../supabase/server.js";

function buildUpsertChain() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  // SELECT count chain for soft-cap (Task 4): from(...).select("*", { count, head }).eq(...)
  const eqAfterSelect = vi.fn().mockResolvedValue({ count: 0, error: null });
  const select = vi.fn().mockReturnValue({ eq: eqAfterSelect });
  // .delete().eq(wallet).not("game_id", "in", subselect) chain — only used in Task 4.
  const not = vi.fn().mockResolvedValue({ error: null });
  const eqAfterDelete = vi.fn().mockReturnValue({ not });
  const del = vi.fn().mockReturnValue({ eq: eqAfterDelete });
  const from = vi.fn().mockImplementation(() => ({ upsert, select, delete: del }));
  return { from, upsert, select, eqAfterSelect, del, eqAfterDelete, not };
}

const VALID_PAYLOAD = {
  gameId: "11111111-1111-1111-1111-111111111111",
  difficulty: "medium" as const,
  result: "lose" as const,
  totalMoves: 30,
  response: {
    kind: "full" as const,
    summary: "You lost a tight middlegame.",
    mistakes: [
      { moveNumber: 12, played: "Nf3", better: "Nd2", explanation: "Black hung the bishop on g7." },
    ],
    lessons: ["Watch for hanging pieces."],
    praise: ["Solid opening."],
  } satisfies CoachResponse,
};

describe("persistAnalysis", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
  });

  it("returns early without writing when getSupabaseServer is null", async () => {
    vi.mocked(getSupabaseServer).mockReturnValue(null);
    await expect(persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD)).resolves.toEqual({});
  });

  it("upserts with onConflict='wallet,game_id' and ignoreDuplicates=true", async () => {
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD);
    expect(chain.from).toHaveBeenCalledWith("coach_analyses");
    expect(chain.upsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = chain.upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "wallet,game_id", ignoreDuplicates: true });
    expect(Array.isArray(rows) ? rows[0] : rows).toMatchObject({
      wallet: "0x1234567890abcdef1234567890abcdef12345678",
      game_id: VALID_PAYLOAD.gameId,
      kind: "full",
      difficulty: "medium",
      result: "lose",
      total_moves: 30,
      summary_text: "You lost a tight middlegame.",
    });
  });

  it("computes weakness_tags via extractWeaknessTags before insert", async () => {
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD);
    const [rows] = chain.upsert.mock.calls[0];
    const row = Array.isArray(rows) ? rows[0] : rows;
    expect(row.weakness_tags).toEqual(["hanging-piece"]);
  });

  it("throws when payload.result is not a CoachGameResult value", async () => {
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await expect(
      persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", { ...VALID_PAYLOAD, result: "loss" as never }),
    ).rejects.toThrowError(/CoachGameResult/);
    expect(chain.upsert).not.toHaveBeenCalled();
  });
});

describe("persistAnalysis — soft cap (200 rows)", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
  });

  it("does not fire delete when count <= 200", async () => {
    const chain = buildUpsertChain();
    chain.eqAfterSelect.mockResolvedValue({ count: 150, error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD);
    expect(chain.del).not.toHaveBeenCalled();
  });

  it("fires bounded delete when count > 200", async () => {
    const chain = buildUpsertChain();
    chain.eqAfterSelect.mockResolvedValue({ count: 250, error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD);
    expect(chain.del).toHaveBeenCalledTimes(1);
    expect(chain.eqAfterDelete).toHaveBeenCalledWith("wallet", "0x1234567890abcdef1234567890abcdef12345678");
    expect(chain.not).toHaveBeenCalledTimes(1);
    const [col, op, _subq] = chain.not.mock.calls[0];
    expect(col).toBe("game_id");
    expect(op).toBe("in");
  });

  it("does not fire delete when count query errors (fail-soft)", async () => {
    const chain = buildUpsertChain();
    chain.eqAfterSelect.mockResolvedValue({ count: null, error: { message: "boom" } });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD);
    expect(chain.del).not.toHaveBeenCalled();
  });

  it("does not fire delete when count is exactly 200 (boundary)", async () => {
    const chain = buildUpsertChain();
    chain.eqAfterSelect.mockResolvedValue({ count: 200, error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD);
    expect(chain.del).not.toHaveBeenCalled();
  });

  it("fires delete when count is 201 (boundary)", async () => {
    const chain = buildUpsertChain();
    chain.eqAfterSelect.mockResolvedValue({ count: 201, error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD);
    expect(chain.del).toHaveBeenCalledTimes(1);
  });

  it("subquery contains 'select game_id', 'order by created_at desc', and 'limit 200'", async () => {
    const chain = buildUpsertChain();
    chain.eqAfterSelect.mockResolvedValue({ count: 250, error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD);
    const [, , subquery] = chain.not.mock.calls[0];
    expect(subquery).toContain("select game_id");
    expect(subquery).toContain("order by created_at desc");
    expect(subquery).toContain("limit 200");
  });
});

describe("persistAnalysis — tag extraction error surfacing", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
  });

  it("returns { tagError: undefined } and inserts row with weakness_tags=[] when no rule matches the explanation", async () => {
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const result = await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", {
      ...VALID_PAYLOAD,
      response: {
        kind: "full",
        summary: "Routine.",
        mistakes: [{ moveNumber: 18, played: "Nf3", better: "Nd2", explanation: "Routine inaccuracy." }],
        lessons: [],
        praise: [],
      },
    });
    expect(result).toEqual({}); // tagError absent on happy path
    const [rows] = chain.upsert.mock.calls[0];
    const row = Array.isArray(rows) ? rows[0] : rows;
    expect(row.weakness_tags).toEqual([]);
  });
});
