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
    await expect(persistAnalysis("0xabc", VALID_PAYLOAD)).resolves.toBeUndefined();
  });

  it("upserts with onConflict='wallet,game_id' and ignoreDuplicates=true", async () => {
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0xabc", VALID_PAYLOAD);
    expect(chain.from).toHaveBeenCalledWith("coach_analyses");
    expect(chain.upsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = chain.upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "wallet,game_id", ignoreDuplicates: true });
    expect(Array.isArray(rows) ? rows[0] : rows).toMatchObject({
      wallet: "0xabc",
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
    await persistAnalysis("0xabc", VALID_PAYLOAD);
    const [rows] = chain.upsert.mock.calls[0];
    const row = Array.isArray(rows) ? rows[0] : rows;
    expect(row.weakness_tags).toEqual(["hanging-piece"]);
  });

  it("throws when payload.result is not a CoachGameResult value", async () => {
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await expect(
      persistAnalysis("0xabc", { ...VALID_PAYLOAD, result: "loss" as never }),
    ).rejects.toThrowError(/CoachGameResult/);
    expect(chain.upsert).not.toHaveBeenCalled();
  });
});
