import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enforceGameCap,
  GAME_LIST_CAP,
  UUID_RE,
  EVICT_IF_UNANALYZED_LUA,
  getGameRecord,
} from "../game-persistence.js";

type PipelineLike = {
  eval: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
};

type RedisLike = {
  llen: ReturnType<typeof vi.fn>;
  lrange: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;
  // kept on the mock so atomicity-guard tests can assert they're never called
  exists: ReturnType<typeof vi.fn>;
  lrem: ReturnType<typeof vi.fn>;
  // kept on the mock so per-entry `eval` round-trip regression test can assert
  // the helper never falls back to N independent eval calls (defer #18 closure)
  eval: ReturnType<typeof vi.fn>;
};

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makePipeline(execResult: number[] | Error = []): PipelineLike {
  const p = {} as PipelineLike;
  p.eval = vi.fn(() => p);
  p.exec =
    execResult instanceof Error
      ? vi.fn().mockRejectedValue(execResult)
      : vi.fn().mockResolvedValue(execResult);
  return p;
}

function makeRedis(pipeline?: PipelineLike): RedisLike {
  const pipelineInstance = pipeline ?? makePipeline();
  return {
    llen: vi.fn(),
    lrange: vi.fn(),
    pipeline: vi.fn(() => pipelineInstance),
    exists: vi.fn(),
    lrem: vi.fn(),
    eval: vi.fn(),
  };
}

describe("enforceGameCap — cap policy", () => {
  it("exports GAME_LIST_CAP = 200 (raised from legacy 100)", () => {
    expect(GAME_LIST_CAP).toBe(200);
  });
});

describe("UUID_RE — canonical gameId shape guard", () => {
  it("matches lowercase RFC4122 v4 UUID", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("matches uppercase RFC4122 v4 UUID (case-insensitive)", () => {
    expect(UUID_RE.test("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects non-UUID strings (corrupt entries, legacy ids, injection)", () => {
    expect(UUID_RE.test("")).toBe(false);
    expect(UUID_RE.test("not-a-uuid")).toBe(false);
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-44665544000")).toBe(false);
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-4466554400000")).toBe(false);
    expect(UUID_RE.test("550e8400e29b41d4a716446655440000")).toBe(false);
    expect(UUID_RE.test("__proto__")).toBe(false);
  });
});

describe("enforceGameCap — no-op branches", () => {
  let redis: RedisLike;
  beforeEach(() => {
    redis = makeRedis();
  });

  it("no-op when llen <= cap (boundary 200)", async () => {
    redis.llen.mockResolvedValue(200);
    const out = await enforceGameCap(redis as never, WALLET);
    expect(out).toEqual({ evicted: [], softOverflow: false });
    expect(redis.lrange).not.toHaveBeenCalled();
    expect(redis.pipeline).not.toHaveBeenCalled();
  });

  it("no-op when llen is well under the cap (150)", async () => {
    redis.llen.mockResolvedValue(150);
    const out = await enforceGameCap(redis as never, WALLET);
    expect(out.evicted).toEqual([]);
    expect(out.softOverflow).toBe(false);
    expect(redis.lrange).not.toHaveBeenCalled();
  });

  it("operates on the wallet-scoped game list key", async () => {
    redis.llen.mockResolvedValue(50);
    await enforceGameCap(redis as never, WALLET);
    expect(redis.llen).toHaveBeenCalledWith(`coach:games:${WALLET}`);
  });
});

describe("EVICT_IF_UNANALYZED_LUA — canonical script", () => {
  it("exports a non-empty Lua string", () => {
    expect(typeof EVICT_IF_UNANALYZED_LUA).toBe("string");
    expect(EVICT_IF_UNANALYZED_LUA.trim().length).toBeGreaterThan(0);
  });

  it("uses EXISTS on the analysis keys (KEYS[2..4]) and LREM on the list key (KEYS[1])", () => {
    // Per-locale migration (2026-05-24): KEYS[2] = legacy, KEYS[3] = EN, KEYS[4] = ES.
    // EXISTS with multiple keys returns the count — `> 0` means at least one
    // analysis record survives across locales, so the entry is protected.
    expect(EVICT_IF_UNANALYZED_LUA).toMatch(/EXISTS.*KEYS\[2\].*KEYS\[3\].*KEYS\[4\]/);
    expect(EVICT_IF_UNANALYZED_LUA).toMatch(/LREM.*KEYS\[1\].*ARGV\[1\]/);
  });

  it("short-circuits with return 0 when any analysis key exists (analyzed → protected)", () => {
    expect(EVICT_IF_UNANALYZED_LUA).toMatch(/return 0/);
    expect(EVICT_IF_UNANALYZED_LUA).toMatch(/return 1/);
  });
});

describe("enforceGameCap — single-overflow eviction", () => {
  let redis: RedisLike;
  let pipeline: PipelineLike;
  beforeEach(() => {
    pipeline = makePipeline();
    redis = makeRedis(pipeline);
  });

  it("evicts exactly one entry when llen = 201 and the overflow is unanalyzed", async () => {
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue(["oldest-uuid"]); // overflow window
    pipeline.exec.mockResolvedValue([1]); // 1 = evicted

    const out = await enforceGameCap(redis as never, WALLET);

    expect(redis.lrange).toHaveBeenCalledWith(`coach:games:${WALLET}`, 200, -1);
    expect(redis.pipeline).toHaveBeenCalledTimes(1);
    expect(pipeline.eval).toHaveBeenCalledWith(
      EVICT_IF_UNANALYZED_LUA,
      [
        `coach:games:${WALLET}`,
        `coach:analysis:${WALLET}:oldest-uuid`,
        `coach:analysis:${WALLET}:oldest-uuid:en`,
        `coach:analysis:${WALLET}:oldest-uuid:es`,
      ],
      ["oldest-uuid"],
    );
    expect(pipeline.exec).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ evicted: ["oldest-uuid"], softOverflow: false });
  });

  it("does NOT evict when the lone overflow entry is analyzed (soft overflow)", async () => {
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue(["analyzed-uuid"]);
    pipeline.exec.mockResolvedValue([0]); // 0 = analyzed, protected
    const onOverflow = vi.fn();

    const out = await enforceGameCap(redis as never, WALLET, { onOverflow });

    expect(out).toEqual({ evicted: [], softOverflow: true });
    expect(onOverflow).toHaveBeenCalledTimes(1);
    expect(onOverflow).toHaveBeenCalledWith({
      wallet: WALLET,
      listLength: 201,
      analyzedInTail: 1,
    });
  });
});

describe("enforceGameCap — multi-overflow eviction (oldest-first)", () => {
  let redis: RedisLike;
  let pipeline: PipelineLike;
  beforeEach(() => {
    pipeline = makePipeline();
    redis = makeRedis(pipeline);
  });

  it("queues evictions oldest-first when the entire overflow is unanalyzed", async () => {
    // lrange(cap, -1) returns the overflow window in head→tail order
    // (newest→oldest). The function must queue eval calls in reverse
    // (oldest first) so pipeline.exec results map to eviction order.
    redis.llen.mockResolvedValue(205);
    redis.lrange.mockResolvedValue([
      "overflow-newer-1",
      "overflow-newer-2",
      "overflow-mid",
      "overflow-older-1",
      "overflow-oldest", // tail of the array = oldest entry
    ]);
    pipeline.exec.mockResolvedValue([1, 1, 1, 1, 1]);

    const out = await enforceGameCap(redis as never, WALLET);

    expect(out.softOverflow).toBe(false);
    expect(out.evicted).toEqual([
      "overflow-oldest",
      "overflow-older-1",
      "overflow-mid",
      "overflow-newer-2",
      "overflow-newer-1",
    ]);
    // Single pipeline round-trip, regardless of N.
    expect(redis.pipeline).toHaveBeenCalledTimes(1);
    expect(pipeline.exec).toHaveBeenCalledTimes(1);
    expect(pipeline.eval).toHaveBeenCalledTimes(5);
    // First eval queued targets the oldest entry.
    expect(pipeline.eval).toHaveBeenNthCalledWith(
      1,
      EVICT_IF_UNANALYZED_LUA,
      [
        `coach:games:${WALLET}`,
        `coach:analysis:${WALLET}:overflow-oldest`,
        `coach:analysis:${WALLET}:overflow-oldest:en`,
        `coach:analysis:${WALLET}:overflow-oldest:es`,
      ],
      ["overflow-oldest"],
    );
  });

  it("skips analyzed entries while still draining unanalyzed ones (mixed overflow)", async () => {
    // 205 entries → 5 overflow. The 2 newest in overflow are analyzed
    // (protected), the 3 oldest are unanalyzed. Helper queues 5 evals in
    // oldest-first order; exec result preserves that order:
    //   [unanalyzed-oldest, unanalyzed-older, unanalyzed-mid,
    //    analyzed-newer-2, analyzed-newer-1] → [1, 1, 1, 0, 0]
    redis.llen.mockResolvedValue(205);
    redis.lrange.mockResolvedValue([
      "analyzed-newer-1", // boundary side
      "analyzed-newer-2",
      "unanalyzed-mid",
      "unanalyzed-older",
      "unanalyzed-oldest",
    ]);
    pipeline.exec.mockResolvedValue([1, 1, 1, 0, 0]);
    const onOverflow = vi.fn();

    const out = await enforceGameCap(redis as never, WALLET, { onOverflow });

    expect(out.evicted).toEqual([
      "unanalyzed-oldest",
      "unanalyzed-older",
      "unanalyzed-mid",
    ]);
    expect(out.softOverflow).toBe(true);
    expect(pipeline.eval).toHaveBeenCalledTimes(5);
    expect(pipeline.exec).toHaveBeenCalledTimes(1);
    expect(onOverflow).toHaveBeenCalledWith({
      wallet: WALLET,
      listLength: 205,
      analyzedInTail: 2,
    });
  });

  it("emits onOverflow exactly once when every overflow entry is analyzed", async () => {
    redis.llen.mockResolvedValue(203);
    redis.lrange.mockResolvedValue(["a1", "a2", "a3"]);
    pipeline.exec.mockResolvedValue([0, 0, 0]); // all protected
    const onOverflow = vi.fn();

    const out = await enforceGameCap(redis as never, WALLET, { onOverflow });

    expect(out.evicted).toEqual([]);
    expect(out.softOverflow).toBe(true);
    expect(onOverflow).toHaveBeenCalledTimes(1);
    expect(onOverflow).toHaveBeenCalledWith({
      wallet: WALLET,
      listLength: 203,
      analyzedInTail: 3,
    });
  });

  it("never calls redis.exists / redis.lrem / redis.eval directly (atomicity + RTT guard)", async () => {
    redis.llen.mockResolvedValue(202);
    redis.lrange.mockResolvedValue(["g1", "g2"]);
    pipeline.exec.mockResolvedValue([1, 1]);

    await enforceGameCap(redis as never, WALLET);

    // Race B closure preserved — per-entry Lua only fires via pipeline.
    expect(redis.exists).not.toHaveBeenCalled();
    expect(redis.lrem).not.toHaveBeenCalled();
    // Defer #18 closure — no fallback to N independent eval round-trips.
    expect(redis.eval).not.toHaveBeenCalled();
  });
});

describe("enforceGameCap — pipeline behaviour (defer #18)", () => {
  let redis: RedisLike;
  let pipeline: PipelineLike;
  beforeEach(() => {
    pipeline = makePipeline();
    redis = makeRedis(pipeline);
  });

  it("uses a single pipeline.exec for N evictions (1 RTT, not N)", async () => {
    redis.llen.mockResolvedValue(210);
    redis.lrange.mockResolvedValue(["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g10"]);
    pipeline.exec.mockResolvedValue([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);

    await enforceGameCap(redis as never, WALLET);

    expect(redis.pipeline).toHaveBeenCalledTimes(1);
    expect(pipeline.exec).toHaveBeenCalledTimes(1);
    expect(pipeline.eval).toHaveBeenCalledTimes(10);
  });

  it("does not invoke pipeline when the overflow window contains no usable ids", async () => {
    // Defensive: if lrange returns falsy-only entries (Redis-level
    // corruption, defer #9 territory), no evals are queued and softOverflow
    // stays FALSE. Null entries can't be evicted by gameId, so they're
    // clamped out of `overflowCount` upfront — they don't pollute the
    // analyzed-blocked telemetry signal. Closes defer #9 (2026-05-30).
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue([null as unknown as string]);
    const onOverflow = vi.fn();

    const out = await enforceGameCap(redis as never, WALLET, { onOverflow });

    expect(pipeline.eval).not.toHaveBeenCalled();
    expect(pipeline.exec).not.toHaveBeenCalled();
    expect(out.evicted).toEqual([]);
    expect(out.softOverflow).toBe(false);
    expect(onOverflow).not.toHaveBeenCalled();
  });

  it("treats null entries as unevictable but lets valid neighbors evict (softOverflow stays false)", async () => {
    // Mixed-null tail: 3 entries (llen-cap = 3) but the middle slot is a
    // null hole. The 2 valid neighbors are unanalyzed and should evict;
    // the null slot is clamped out of `overflowCount` so the post-loop
    // check doesn't fire a false softOverflow. Closes defer #9 (2026-05-30).
    redis.llen.mockResolvedValue(203);
    redis.lrange.mockResolvedValue([
      "valid-newer",
      null as unknown as string,
      "valid-older",
    ]);
    pipeline.exec.mockResolvedValue([1, 1]); // both valid candidates evicted
    const onOverflow = vi.fn();

    const out = await enforceGameCap(redis as never, WALLET, { onOverflow });

    // Eviction order is oldest-first per `for (let i = tail.length - 1; ...)`.
    expect(out.evicted).toEqual(["valid-older", "valid-newer"]);
    expect(out.softOverflow).toBe(false);
    expect(onOverflow).not.toHaveBeenCalled();
  });
});

describe("enforceGameCap — option overrides", () => {
  let redis: RedisLike;
  let pipeline: PipelineLike;
  beforeEach(() => {
    pipeline = makePipeline();
    redis = makeRedis(pipeline);
  });

  it("respects a custom cap for tests / future tuning", async () => {
    redis.llen.mockResolvedValue(5);
    redis.lrange.mockResolvedValue(["tail-uuid"]);
    pipeline.exec.mockResolvedValue([1]);

    const out = await enforceGameCap(redis as never, WALLET, { cap: 4 });

    expect(redis.lrange).toHaveBeenCalledWith(`coach:games:${WALLET}`, 4, -1);
    expect(out.evicted).toEqual(["tail-uuid"]);
  });

  it("is safe to call without onOverflow when soft overflow occurs", async () => {
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue(["only-analyzed"]);
    pipeline.exec.mockResolvedValue([0]);

    await expect(enforceGameCap(redis as never, WALLET)).resolves.toEqual({
      evicted: [],
      softOverflow: true,
    });
  });
});

describe("getGameRecord", () => {
  const GAME_ID = "6b3890dd-635d-40dd-aa85-8fe016a5e8aa";

  /** Mock factory that routes reads by key prefix so we can stub the
   *  game record + analysis cache keys independently. As of 2026-06-05
   *  `getGameRecord` reads both — the analysis merge inlines a
   *  matching `coach:analysis:…` record into the returned record. */
  function makeKeyAwareRedis(values: {
    game?: unknown;
    analysisEn?: unknown;
    analysisEs?: unknown;
    analysisLegacy?: unknown;
  }) {
    const get = vi.fn(async (key: string) => {
      if (key.startsWith("coach:game:")) return values.game ?? null;
      if (key.endsWith(":en")) return values.analysisEn ?? null;
      if (key.endsWith(":es")) return values.analysisEs ?? null;
      if (key.startsWith("coach:analysis:"))
        return values.analysisLegacy ?? null;
      return null;
    });
    return { get };
  }

  it("reads the wallet-scoped key and returns the record (no analysis cached)", async () => {
    const record = { gameId: GAME_ID, result: "win" } as never;
    const redis = makeKeyAwareRedis({ game: record });

    const out = await getGameRecord(redis as never, WALLET, GAME_ID);

    expect(out).toBe(record);
    expect(redis.get).toHaveBeenCalledWith(`coach:game:${WALLET}:${GAME_ID}`);
  });

  it("inlines a cached EN analysis into the returned record", async () => {
    const record = { gameId: GAME_ID, result: "win" } as never;
    const analysis = {
      gameId: GAME_ID,
      provider: "server",
      analysisVersion: "v1",
      createdAt: 1700000000,
      response: { kind: "full", summary: "ok", mistakes: [], lessons: [], praise: [] },
    };
    const redis = makeKeyAwareRedis({ game: record, analysisEn: analysis });

    const out = await getGameRecord(redis as never, WALLET, GAME_ID, { locale: "en" });

    expect(out).not.toBeNull();
    expect(out!.analysis).toMatchObject({ provider: "server", locale: "en" });
  });

  it("falls back to the other locale when the requested one is missing", async () => {
    const record = { gameId: GAME_ID, result: "win" } as never;
    const esAnalysis = {
      gameId: GAME_ID,
      provider: "server",
      analysisVersion: "v1",
      createdAt: 1700000000,
      response: { kind: "quick", summary: "ok", tips: [] },
      locale: "es",
    };
    const redis = makeKeyAwareRedis({ game: record, analysisEs: esAnalysis });

    const out = await getGameRecord(redis as never, WALLET, GAME_ID, { locale: "en" });

    expect(out!.analysis?.locale).toBe("es");
  });

  it("returns null when redis has no entry", async () => {
    const redis = makeKeyAwareRedis({ game: null });
    await expect(getGameRecord(redis as never, WALLET, GAME_ID)).resolves.toBeNull();
  });

  it("lowercases the wallet so checksum-cased callers hit the canonical key", async () => {
    const redis = makeKeyAwareRedis({ game: null });
    const checksumed = "0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD";

    await getGameRecord(redis as never, checksumed, GAME_ID);

    expect(redis.get).toHaveBeenCalledWith(`coach:game:${checksumed.toLowerCase()}:${GAME_ID}`);
  });

  it("propagates redis errors so callers can decide how to surface them", async () => {
    const redis = { get: vi.fn().mockRejectedValue(new Error("conn refused")) };

    await expect(getGameRecord(redis as never, WALLET, GAME_ID)).rejects.toThrow("conn refused");
  });
});
