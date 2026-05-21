import { describe, it, expect, vi, beforeEach } from "vitest";
import { enforceGameCap, GAME_LIST_CAP } from "../game-persistence.js";

type RedisLike = {
  llen: ReturnType<typeof vi.fn>;
  lrange: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  lrem: ReturnType<typeof vi.fn>;
};

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRedis(): RedisLike {
  return {
    llen: vi.fn(),
    lrange: vi.fn(),
    exists: vi.fn(),
    lrem: vi.fn(),
  };
}

describe("enforceGameCap — cap policy", () => {
  it("exports GAME_LIST_CAP = 200 (raised from legacy 100)", () => {
    expect(GAME_LIST_CAP).toBe(200);
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
    expect(redis.lrem).not.toHaveBeenCalled();
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

describe("enforceGameCap — single-overflow eviction", () => {
  let redis: RedisLike;
  beforeEach(() => {
    redis = makeRedis();
  });

  it("evicts exactly one entry when llen = 201 and the overflow is unanalyzed", async () => {
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue(["oldest-uuid"]); // overflow window
    redis.exists.mockResolvedValue(0);
    redis.lrem.mockResolvedValue(1);

    const out = await enforceGameCap(redis as never, WALLET);

    expect(redis.lrange).toHaveBeenCalledWith(`coach:games:${WALLET}`, 200, -1);
    expect(redis.exists).toHaveBeenCalledWith(`coach:analysis:${WALLET}:oldest-uuid`);
    expect(redis.lrem).toHaveBeenCalledWith(`coach:games:${WALLET}`, 1, "oldest-uuid");
    expect(out).toEqual({ evicted: ["oldest-uuid"], softOverflow: false });
  });

  it("does NOT evict when the lone overflow entry is analyzed (soft overflow)", async () => {
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue(["analyzed-uuid"]);
    redis.exists.mockResolvedValue(1); // analyzed
    const onOverflow = vi.fn();

    const out = await enforceGameCap(redis as never, WALLET, { onOverflow });

    expect(redis.lrem).not.toHaveBeenCalled();
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
    redis.exists.mockResolvedValue(0);
    redis.lrem.mockResolvedValue(1);

    const out = await enforceGameCap(redis as never, WALLET);

    expect(out.softOverflow).toBe(false);
    expect(out.evicted).toEqual([
      "overflow-oldest",
      "overflow-older-1",
      "overflow-mid",
      "overflow-newer-2",
      "overflow-newer-1",
    ]);
    expect(redis.lrem).toHaveBeenCalledTimes(5);
    // First eviction must target the oldest entry.
    expect(redis.lrem).toHaveBeenNthCalledWith(1, `coach:games:${WALLET}`, 1, "overflow-oldest");
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
    redis.exists.mockImplementation((key: string) => {
      // Return 1 (analyzed) for the two newer entries, 0 for the rest.
      if (key.endsWith("analyzed-newer-1") || key.endsWith("analyzed-newer-2")) {
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });
    redis.lrem.mockResolvedValue(1);
    const onOverflow = vi.fn();

    const out = await enforceGameCap(redis as never, WALLET, { onOverflow });

    expect(out.evicted).toEqual([
      "unanalyzed-oldest",
      "unanalyzed-older",
      "unanalyzed-mid",
    ]);
    expect(out.softOverflow).toBe(true);
    expect(redis.lrem).toHaveBeenCalledTimes(3);
    expect(onOverflow).toHaveBeenCalledWith({
      wallet: WALLET,
      listLength: 205,
      analyzedInTail: 2,
    });
  });

  it("emits onOverflow exactly once when every overflow entry is analyzed", async () => {
    redis.llen.mockResolvedValue(203);
    redis.lrange.mockResolvedValue(["a1", "a2", "a3"]);
    redis.exists.mockResolvedValue(1);
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
    redis.exists.mockResolvedValue(0);
    redis.lrem.mockResolvedValue(1);

    const out = await enforceGameCap(redis as never, WALLET, { cap: 4 });

    expect(redis.lrange).toHaveBeenCalledWith(`coach:games:${WALLET}`, 4, -1);
    expect(out.evicted).toEqual(["tail-uuid"]);
  });

  it("is safe to call without onOverflow when soft overflow occurs", async () => {
    redis.llen.mockResolvedValue(201);
    redis.lrange.mockResolvedValue(["only-analyzed"]);
    redis.exists.mockResolvedValue(1);

    await expect(enforceGameCap(redis as never, WALLET)).resolves.toEqual({
      evicted: [],
      softOverflow: true,
    });
  });
});
