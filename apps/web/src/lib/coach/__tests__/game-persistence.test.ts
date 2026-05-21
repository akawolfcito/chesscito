import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enforceGameCap,
  GAME_LIST_CAP,
  UUID_RE,
  EVICT_IF_UNANALYZED_LUA,
} from "../game-persistence.js";

type RedisLike = {
  llen: ReturnType<typeof vi.fn>;
  lrange: ReturnType<typeof vi.fn>;
  eval: ReturnType<typeof vi.fn>;
  // kept on the mock so atomicity-guard tests can assert they're never called
  exists: ReturnType<typeof vi.fn>;
  lrem: ReturnType<typeof vi.fn>;
};

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRedis(): RedisLike {
  return {
    llen: vi.fn(),
    lrange: vi.fn(),
    eval: vi.fn(),
    exists: vi.fn(),
    lrem: vi.fn(),
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
    expect(redis.eval).not.toHaveBeenCalled();
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

  it("uses EXISTS on the analysis key (KEYS[2]) and LREM on the list key (KEYS[1])", () => {
    expect(EVICT_IF_UNANALYZED_LUA).toMatch(/EXISTS.*KEYS\[2\]/);
    expect(EVICT_IF_UNANALYZED_LUA).toMatch(/LREM.*KEYS\[1\].*ARGV\[1\]/);
  });

  it("short-circuits with return 0 when the analysis key exists (analyzed → protected)", () => {
    expect(EVICT_IF_UNANALYZED_LUA).toMatch(/return 0/);
    expect(EVICT_IF_UNANALYZED_LUA).toMatch(/return 1/);
  });
});

describe("enforceGameCap — single-overflow eviction", () => {
  let redis: RedisLike;
  beforeEach(() => {
    redis = makeRedis();
  });

  it("evicts exactly one entry when llen = 201 and the overflow is unanalyzed", async () => {
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue(["oldest-uuid"]); // overflow window
    redis.eval.mockResolvedValue(1); // 1 = evicted

    const out = await enforceGameCap(redis as never, WALLET);

    expect(redis.lrange).toHaveBeenCalledWith(`coach:games:${WALLET}`, 200, -1);
    expect(redis.eval).toHaveBeenCalledWith(
      EVICT_IF_UNANALYZED_LUA,
      [`coach:games:${WALLET}`, `coach:analysis:${WALLET}:oldest-uuid`],
      ["oldest-uuid"],
    );
    expect(out).toEqual({ evicted: ["oldest-uuid"], softOverflow: false });
  });

  it("does NOT evict when the lone overflow entry is analyzed (soft overflow)", async () => {
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue(["analyzed-uuid"]);
    redis.eval.mockResolvedValue(0); // 0 = analyzed, protected
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
  beforeEach(() => {
    redis = makeRedis();
  });

  it("evicts the oldest-first when the entire overflow is unanalyzed", async () => {
    // lrange(cap, -1) returns the overflow window in head→tail order
    // (newest→oldest). The function must iterate the array in reverse
    // so the OLDEST gameId is evicted first.
    redis.llen.mockResolvedValue(205);
    redis.lrange.mockResolvedValue([
      "overflow-newer-1",
      "overflow-newer-2",
      "overflow-mid",
      "overflow-older-1",
      "overflow-oldest", // tail of the array = oldest entry
    ]);
    redis.eval.mockResolvedValue(1);

    const out = await enforceGameCap(redis as never, WALLET);

    expect(out.softOverflow).toBe(false);
    expect(out.evicted).toEqual([
      "overflow-oldest",
      "overflow-older-1",
      "overflow-mid",
      "overflow-newer-2",
      "overflow-newer-1",
    ]);
    expect(redis.eval).toHaveBeenCalledTimes(5);
    // First eval call targets the oldest entry.
    expect(redis.eval).toHaveBeenNthCalledWith(
      1,
      EVICT_IF_UNANALYZED_LUA,
      [`coach:games:${WALLET}`, `coach:analysis:${WALLET}:overflow-oldest`],
      ["overflow-oldest"],
    );
  });

  it("skips analyzed entries while still draining unanalyzed ones (mixed overflow)", async () => {
    // 205 entries → 5 overflow. The 2 newest in overflow are analyzed
    // (protected), the 3 oldest are unanalyzed. Helper evicts the 3
    // unanalyzed entries (oldest-first) and reports soft overflow on the
    // remaining 2 analyzed entries.
    redis.llen.mockResolvedValue(205);
    redis.lrange.mockResolvedValue([
      "analyzed-newer-1", // boundary side
      "analyzed-newer-2",
      "unanalyzed-mid",
      "unanalyzed-older",
      "unanalyzed-oldest",
    ]);
    redis.eval.mockImplementation(async (_script: string, keys: string[]) => {
      const analysisKey = keys[1];
      // Return 0 (analyzed → protected) for the two newer entries, 1 (evicted) for the rest.
      if (analysisKey.endsWith("analyzed-newer-1") || analysisKey.endsWith("analyzed-newer-2")) {
        return 0;
      }
      return 1;
    });
    const onOverflow = vi.fn();

    const out = await enforceGameCap(redis as never, WALLET, { onOverflow });

    expect(out.evicted).toEqual([
      "unanalyzed-oldest",
      "unanalyzed-older",
      "unanalyzed-mid",
    ]);
    expect(out.softOverflow).toBe(true);
    expect(redis.eval).toHaveBeenCalledTimes(5);
    expect(onOverflow).toHaveBeenCalledWith({
      wallet: WALLET,
      listLength: 205,
      analyzedInTail: 2,
    });
  });

  it("emits onOverflow exactly once when every overflow entry is analyzed", async () => {
    redis.llen.mockResolvedValue(203);
    redis.lrange.mockResolvedValue(["a1", "a2", "a3"]);
    redis.eval.mockResolvedValue(0); // all protected
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

  it("never calls redis.exists or redis.lrem directly (atomicity guard — defer 'enforceGameCap race')", async () => {
    redis.llen.mockResolvedValue(202);
    redis.lrange.mockResolvedValue(["g1", "g2"]);
    redis.eval.mockResolvedValue(1);

    await enforceGameCap(redis as never, WALLET);

    expect(redis.exists).not.toHaveBeenCalled();
    expect(redis.lrem).not.toHaveBeenCalled();
  });
});

describe("enforceGameCap — option overrides", () => {
  let redis: RedisLike;
  beforeEach(() => {
    redis = makeRedis();
  });

  it("respects a custom cap for tests / future tuning", async () => {
    redis.llen.mockResolvedValue(5);
    redis.lrange.mockResolvedValue(["tail-uuid"]);
    redis.eval.mockResolvedValue(1);

    const out = await enforceGameCap(redis as never, WALLET, { cap: 4 });

    expect(redis.lrange).toHaveBeenCalledWith(`coach:games:${WALLET}`, 4, -1);
    expect(out.evicted).toEqual(["tail-uuid"]);
  });

  it("is safe to call without onOverflow when soft overflow occurs", async () => {
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue(["only-analyzed"]);
    redis.eval.mockResolvedValue(0);

    await expect(enforceGameCap(redis as never, WALLET)).resolves.toEqual({
      evicted: [],
      softOverflow: true,
    });
  });
});
