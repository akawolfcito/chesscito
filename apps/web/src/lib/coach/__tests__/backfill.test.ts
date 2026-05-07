import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildBackfillRow, backfillRedisToSupabase } from "../backfill.js";
import type {
  CoachAnalysisRecord,
  GameRecord,
  CoachResponse,
  BasicCoachResponse,
} from "../types.js";

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const VALID_GAME_ID = "11111111-2222-3333-4444-555555555555";

const FULL_RESPONSE: CoachResponse = {
  kind: "full",
  summary: "You lost a tight middlegame.",
  mistakes: [
    { moveNumber: 12, played: "Nf3", better: "Nd2", explanation: "Black hung the bishop on g7." },
  ],
  lessons: ["Watch for hanging pieces."],
  praise: ["Solid opening."],
};

function analysis(overrides: Partial<CoachAnalysisRecord> = {}): CoachAnalysisRecord {
  return {
    gameId: VALID_GAME_ID,
    provider: "server",
    analysisVersion: "1.0.0",
    createdAt: 1714780800000, // 2024-05-04T00:00:00.000Z (deterministic)
    response: FULL_RESPONSE,
    ...overrides,
  };
}

function game(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    gameId: VALID_GAME_ID,
    moves: ["e4", "e5", "Nf3"],
    result: "lose",
    difficulty: "medium",
    totalMoves: 30,
    elapsedMs: 100_000,
    timestamp: 1714780800000,
    ...overrides,
  };
}

describe("buildBackfillRow", () => {
  it("returns null when analysis is missing", () => {
    expect(buildBackfillRow(VALID_WALLET, VALID_GAME_ID, null, game())).toBeNull();
  });

  it("returns null when game is missing", () => {
    expect(buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis(), null)).toBeNull();
  });

  it("returns null when analysis.response.kind is not 'full' (BasicCoachResponse not stored in v1)", () => {
    const quickResponse: BasicCoachResponse = { kind: "quick", summary: "Try X.", tips: ["foo"] };
    expect(
      buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis({ response: quickResponse }), game()),
    ).toBeNull();
  });

  it("returns a fully-shaped CoachAnalysisRow on the happy path", () => {
    const row = buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis(), game());
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      wallet: VALID_WALLET,
      game_id: VALID_GAME_ID,
      kind: "full",
      difficulty: "medium",
      result: "lose",
      total_moves: 30,
      summary_text: "You lost a tight middlegame.",
    });
    expect(row!.weakness_tags).toEqual(["hanging-piece"]); // matches "hung the bishop"
  });

  it("sets expires_at to createdAt + 365 days (red-team P1-6)", () => {
    const row = buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis(), game());
    expect(row!.created_at).toBe(new Date(1714780800000).toISOString());
    const expectedExpiry = new Date(1714780800000 + 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(row!.expires_at).toBe(expectedExpiry);
  });

  it("returns row with weakness_tags=[] when no rule matches (P1-7 fail-soft path is exercised by extractWeaknessTagsSafe's own tests)", () => {
    const row = buildBackfillRow(
      VALID_WALLET,
      VALID_GAME_ID,
      analysis({
        response: {
          kind: "full",
          summary: "Routine game.",
          mistakes: [{ moveNumber: 18, played: "Nf3", better: "Nd2", explanation: "Routine inaccuracy." }],
          lessons: [],
          praise: [],
        },
      }),
      game({ totalMoves: 20, result: "win" }),
    );
    expect(row!.weakness_tags).toEqual([]);
  });
});

vi.mock("../../supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  lrange: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

import { getSupabaseServer } from "../../supabase/server.js";

function buildSupabaseChains(opts: {
  count?: number | null;
  countError?: { message: string } | null;
  upsertError?: { message: string } | null;
} = {}) {
  const { count = 0, countError = null, upsertError = null } = opts;
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });
  const eqAfterSelect = vi.fn().mockResolvedValue({ count, error: countError });
  const select = vi.fn().mockReturnValue({ eq: eqAfterSelect });
  const from = vi.fn().mockImplementation(() => ({ select, upsert }));
  return { from, select, eqAfterSelect, upsert };
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("backfillRedisToSupabase — happy paths", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
    redisMock.set.mockReset();
    redisMock.get.mockReset();
    redisMock.del.mockReset();
    redisMock.lrange.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    vi.stubEnv("LOG_SALT", "test-salt-do-not-ship");
  });

  it("returns { copied: 0, waited: false } when getSupabaseServer is null", async () => {
    vi.mocked(getSupabaseServer).mockReturnValue(null);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: false });
  });

  it("acquires lock, sees count>0, exits without listing ids", async () => {
    redisMock.set.mockResolvedValue("OK");
    const chain = buildSupabaseChains({ count: 5 });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: false });
    expect(redisMock.lrange).not.toHaveBeenCalled();
    expect(chain.upsert).not.toHaveBeenCalled();
  });

  it("acquires lock, count=0, no ids in list — returns without upsert", async () => {
    redisMock.set.mockResolvedValue("OK");
    redisMock.lrange.mockResolvedValue([]);
    const chain = buildSupabaseChains({ count: 0 });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: false });
    expect(chain.upsert).not.toHaveBeenCalled();
  });

  it("acquires lock, count=0, 2 valid ids — upserts 2 rows + emits coach_backfill_completed", async () => {
    redisMock.set.mockResolvedValue("OK");
    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.get.mockImplementation((key: string) => {
      if (key.startsWith("coach:analysis:")) {
        return Promise.resolve({
          gameId: key.split(":").pop(),
          provider: "server",
          analysisVersion: "1.0.0",
          createdAt: 1714780800000,
          response: { kind: "full", summary: "x", mistakes: [], lessons: [], praise: [] },
        });
      }
      if (key.startsWith("coach:game:")) {
        return Promise.resolve({
          gameId: key.split(":").pop(),
          moves: ["e4"],
          result: "win",
          difficulty: "easy",
          totalMoves: 20,
          elapsedMs: 50_000,
          timestamp: 1714780800000,
        });
      }
      return Promise.resolve(null);
    });
    const chain = buildSupabaseChains({ count: 0 });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 2, waited: false });
    expect(chain.upsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = chain.upsert.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(opts).toEqual({ onConflict: "wallet,game_id", ignoreDuplicates: true });
    expect(mockLogger.info).toHaveBeenCalledWith(
      "coach_backfill_completed",
      expect.objectContaining({ copied: 2, waited: false }),
    );
  });

  it("skips ids whose analysis is missing or kind!=full", async () => {
    redisMock.set.mockResolvedValue("OK");
    redisMock.lrange.mockResolvedValue(["g1", "g2", "g3"]);
    redisMock.get.mockImplementation((key: string) => {
      if (key === `coach:analysis:${VALID_WALLET}:g1`) return Promise.resolve(null);
      if (key === `coach:analysis:${VALID_WALLET}:g2`) {
        return Promise.resolve({
          gameId: "g2",
          provider: "server",
          analysisVersion: "1.0.0",
          createdAt: 1714780800000,
          response: { kind: "quick", summary: "x", tips: [] },
        });
      }
      if (key === `coach:analysis:${VALID_WALLET}:g3`) {
        return Promise.resolve({
          gameId: "g3",
          provider: "server",
          analysisVersion: "1.0.0",
          createdAt: 1714780800000,
          response: { kind: "full", summary: "x", mistakes: [], lessons: [], praise: [] },
        });
      }
      if (key.startsWith("coach:game:")) {
        return Promise.resolve({
          gameId: key.split(":").pop(),
          moves: [],
          result: "win",
          difficulty: "easy",
          totalMoves: 20,
          elapsedMs: 0,
          timestamp: 1714780800000,
        });
      }
      return Promise.resolve(null);
    });
    const chain = buildSupabaseChains({ count: 0 });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out.copied).toBe(1);
    const [rows] = chain.upsert.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].game_id).toBe("g3");
  });
});

describe("backfillRedisToSupabase — race conditions", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
    redisMock.set.mockReset();
    redisMock.get.mockReset();
    mockLogger.warn.mockReset();
    vi.stubEnv("LOG_SALT", "test-salt-do-not-ship");
  });

  it("polls and returns waited=true when lock holder finishes within 3s", async () => {
    redisMock.set.mockResolvedValue(null);
    redisMock.get.mockResolvedValueOnce(null); // first poll: holder gone
    vi.mocked(getSupabaseServer).mockReturnValue({} as never);

    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: true });
    expect(mockLogger.warn).not.toHaveBeenCalledWith("coach_backfill_lock_timeout", expect.anything());
  });

  it("emits coach_backfill_lock_timeout when holder still working after 3s", async () => {
    redisMock.set.mockResolvedValue(null);
    redisMock.get.mockResolvedValue("locked");
    vi.mocked(getSupabaseServer).mockReturnValue({} as never);

    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: true });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "coach_backfill_lock_timeout",
      expect.objectContaining({ wallet_hash: expect.any(String) }),
    );
  });
});
