import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ethers } from "ethers";

const mocks = vi.hoisted(() => ({
  getLogs: vi.fn(), getBlock: vi.fn(), getBlockNumber: vi.fn(), getSyncState: vi.fn(),
  setSyncState: vi.fn(), upsertScoreAuthoritative: vi.fn(), upsertVictoryAuthoritative: vi.fn(),
  upsertPassportCache: vi.fn(), fetchLeaderboardFromDb: vi.fn(), checkPassportScores: vi.fn(),
}));
vi.mock("ethers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ethers")>();
  return { ...actual, ethers: { ...actual.ethers, JsonRpcProvider: vi.fn(function () {
    return { getLogs: mocks.getLogs, getBlock: mocks.getBlock, getBlockNumber: mocks.getBlockNumber };
  }) } };
});
vi.mock("@/lib/supabase/queries", () => ({
  ...mocks,
}));
vi.mock("@/lib/server/passport", () => ({ checkPassportScores: mocks.checkPassportScores }));

const filter = { address: "score-fixture", topics: ["topic-fixture"], fromBlock: 100, toBlock: 100_102 };
type Range = { fromBlock: number; toBlock: number };
let successful: Range[];

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SCOREBOARD_ADDRESS", "score-fixture");
  vi.stubEnv("NEXT_PUBLIC_VICTORY_NFT_ADDRESS", "victory-fixture");
  successful = [];
  mocks.getBlockNumber.mockResolvedValue(61_213_666);
  mocks.getSyncState.mockResolvedValue(null);
  mocks.fetchLeaderboardFromDb.mockResolvedValue([]);
  mocks.getBlock.mockResolvedValue({ timestamp: 1_700_000_000 });
});

afterEach(() => vi.unstubAllEnvs());

function succeedsBelow(limit: number, error: unknown) {
  mocks.getLogs.mockImplementation(async (range: Range) => {
    if (range.toBlock - range.fromBlock + 1 > limit) throw error;
    successful.push(range);
    // One distinguishable fixture log per successful request verifies no retry duplicates.
    return [{ blockNumber: range.fromBlock } as ethers.Log];
  });
}
function expectExactCoverage(from: number, to: number) {
  let next = from;
  for (const range of successful) {
    expect(range.fromBlock).toBe(next);
    expect(range.toBlock).toBeGreaterThanOrEqual(range.fromBlock);
    next = range.toBlock + 1;
  }
  expect(next).toBe(to + 1);
}

async function paginate(input = filter) {
  const { getLogsPaginated } = await import("../sync-blockchain");
  return getLogsPaginated({ getLogs: mocks.getLogs }, input);
}

describe("adaptive eth_getLogs pagination", () => {
  it("starts at the maximum and covers the final partial range exactly once", async () => {
    succeedsBelow(50_000, new Error("unexpected"));
    const logs = await paginate();
    expect(successful.map(({ fromBlock, toBlock }) => [fromBlock, toBlock])).toEqual([
      [100, 50_099], [50_100, 100_099], [100_100, 100_102],
    ]);
    expectExactCoverage(filter.fromBlock, filter.toBlock);
    expect(logs.map(log => log.blockNumber)).toEqual(successful.map(r => r.fromBlock));
  });
  it("halves a nested -32062 rejection and retries the same starting block", async () => {
    succeedsBelow(25_000, { code: "UNKNOWN_ERROR", info: { error: { code: -32062 } } });
    const logs = await paginate();
    expect(mocks.getLogs.mock.calls.slice(0, 2).map(([r]) => [r.fromBlock, r.toBlock])).toEqual([
      [100, 50_099], [100, 25_099],
    ]);
    expectExactCoverage(filter.fromBlock, filter.toBlock);
    expect(logs).toHaveLength(successful.length);
  });
  it("reduces repeatedly and keeps the successful smaller range for subsequent chunks", async () => {
    succeedsBelow(6_250, { error: { code: -32062 } });
    await paginate();
    expect(mocks.getLogs.mock.calls.slice(0, 4).map(([r]) => [r.fromBlock, r.toBlock])).toEqual([
      [100, 50_099], [100, 25_099], [100, 12_599], [100, 6_349],
    ]);
    expectExactCoverage(filter.fromBlock, filter.toBlock);
  });
  it.each([
    new Error("Block range is too large"),
    { cause: new Error("block range exceeds provider limit") },
    { error: { message: "eth_getLogs is limited to 10 blocks" } },
  ])("recognizes equivalent message errors", async error => {
    succeedsBelow(2, error);
    await paginate({ ...filter, fromBlock: 10, toBlock: 16 });
    expectExactCoverage(10, 16);
  });
  it("reduces a partial tail based on its attempted size, without skipping it", async () => {
    succeedsBelow(1, { code: -32062 });
    await paginate({ ...filter, fromBlock: 20, toBlock: 22 });
    expect(mocks.getLogs.mock.calls.slice(0, 2).map(([r]) => [r.fromBlock, r.toBlock])).toEqual([
      [20, 22], [20, 20],
    ]);
    expectExactCoverage(20, 22);
  });
  it("terminates and propagates the original error if one block is rejected", async () => {
    const error = { code: -32062 };
    succeedsBelow(0, error);
    await expect(paginate({ ...filter, fromBlock: 7, toBlock: 8 })).rejects.toBe(error);
    expect(mocks.getLogs).toHaveBeenCalledTimes(2);
    expect(successful).toEqual([]);
  });
  it.each([new Error("network disconnected"), { code: -32005, message: "rate limit exceeded" }])(
    "propagates unrelated failures without reducing or advancing", async error => {
      mocks.getLogs.mockRejectedValue(error);
      await expect(paginate()).rejects.toBe(error);
      expect(mocks.getLogs).toHaveBeenCalledTimes(1);
    },
  );
  it("makes no request for an empty interval", async () => {
    expect(await paginate({ ...filter, fromBlock: 20, toBlock: 19 })).toEqual([]);
    expect(mocks.getLogs).not.toHaveBeenCalled();
  });
});

describe("runSync cursor", () => {
  it("both score and victory scans adapt, then commit the complete run cursor", async () => {
    mocks.getLogs.mockImplementation(async (range: Range) => {
      if (range.toBlock - range.fromBlock + 1 > 500) throw { code: -32062 };
      return [];
    });
    const { runSync } = await import("../sync-blockchain");
    const result = await runSync();
    expect(result.fromBlock).toBe(61_113_664);
    for (const address of ["score-fixture", "victory-fixture"]) {
      const ranges = mocks.getLogs.mock.calls.map(([r]) => r).filter(r => r.address === address);
      expect(ranges[0].fromBlock).toBe(61_113_664);
      expect(ranges[1].fromBlock).toBe(61_113_664);
      successful = ranges.filter(r => r.toBlock - r.fromBlock + 1 <= 500);
      expectExactCoverage(result.fromBlock, result.toBlock);
    }
    expect(mocks.setSyncState).toHaveBeenCalledExactlyOnceWith("last_synced_block", String(result.toBlock));
  });
  it.each(["score-fixture", "victory-fixture"])("does not advance cursor when %s scan fails", async address => {
    const error = new Error("RPC unavailable");
    mocks.getSyncState.mockResolvedValue("61200000");
    mocks.getLogs.mockImplementation(async r => {
      if (r.address === address) throw error;
      return [];
    });
    const { runSync } = await import("../sync-blockchain");
    await expect(runSync()).rejects.toBe(error);
    expect(mocks.getLogs.mock.calls.every(([r]) => r.fromBlock >= 61_200_001)).toBe(true);
    expect(mocks.setSyncState).not.toHaveBeenCalled();
  });
  it("does not commit partially scanned blocks when a later chunk fails", async () => {
    const error = new Error("RPC unavailable");
    mocks.getLogs.mockImplementation(async r => {
      if (r.address === "score-fixture" && r.fromBlock > 61_113_664) throw error;
      if (r.toBlock - r.fromBlock + 1 > 500) throw { code: -32062 };
      return [];
    });
    const { runSync } = await import("../sync-blockchain");
    await expect(runSync()).rejects.toBe(error);
    expect(mocks.getLogs.mock.calls.some(([r]) => r.fromBlock === 61_114_164)).toBe(true);
    expect(mocks.setSyncState).not.toHaveBeenCalled();
  });
  it("does not advance cursor when the later passport stage fails", async () => {
    mocks.getLogs.mockResolvedValue([]);
    mocks.getBlockNumber.mockResolvedValue(61_114_000);
    const error = new Error("database unavailable");
    mocks.fetchLeaderboardFromDb.mockRejectedValue(error);
    const { runSync } = await import("../sync-blockchain");
    await expect(runSync()).rejects.toBe(error);
    expect(mocks.setSyncState).not.toHaveBeenCalled();
  });
});


describe("bounded batch reconciliation", () => {
  it("caps backlog and resumes without gaps or overlaps until the captured head", async () => {
    mocks.getLogs.mockResolvedValue([]);
    const { runSync, MAX_BLOCKS_PER_SYNC } = await import("../sync-blockchain");
    const start = 61_113_664;
    const head = start + MAX_BLOCKS_PER_SYNC * 2 + 29;
    mocks.getBlockNumber.mockResolvedValue(head);
    let cursor: string | null = null;
    mocks.getSyncState.mockImplementation(async () => cursor);
    mocks.setSyncState.mockImplementation(async (_key, value) => { cursor = value; });
    const batches = [];
    for (let index = 0; index < 3; index++) {
      const batch = await runSync();
      batches.push(batch);
      expect(batch.toBlock).toBe(Math.min(head, batch.fromBlock + MAX_BLOCKS_PER_SYNC - 1));
      expect(cursor).toBe(String(batch.toBlock));
      const calls = mocks.getLogs.mock.calls.slice(index * 2, index * 2 + 2);
      expect(calls.map(([r]) => [r.fromBlock, r.toBlock])).toEqual([
        [batch.fromBlock, batch.toBlock], [batch.fromBlock, batch.toBlock],
      ]);
      expect(mocks.fetchLeaderboardFromDb).toHaveBeenCalledTimes(index === 2 ? 1 : 0);
    }
    expect(batches[0].fromBlock).toBe(start);
    expect(batches[1].fromBlock).toBe(batches[0].toBlock + 1);
    expect(batches[2].fromBlock).toBe(batches[1].toBlock + 1);
    expect(batches[2].toBlock).toBe(head);
    expect(batches[2].toBlock - batches[2].fromBlock + 1).toBe(30);
    expect(mocks.upsertScoreAuthoritative).not.toHaveBeenCalled();
    expect(mocks.upsertVictoryAuthoritative).not.toHaveBeenCalled();
    expect(mocks.checkPassportScores).not.toHaveBeenCalled();
    expect(mocks.setSyncState).toHaveBeenCalledTimes(3);
  });
  it("no-new-block run only reads the cursor; no scans, passport or writes", async () => {
    mocks.getSyncState.mockResolvedValue("61213666");
    const { runSync } = await import("../sync-blockchain");
    expect(await runSync()).toEqual({ fromBlock: 61_213_667, toBlock: 61_213_666,
      scoresUpserted: 0, victoriesUpserted: 0, passportChecked: 0 });
    expect(mocks.getSyncState).toHaveBeenCalledExactlyOnceWith("last_synced_block");
    for (const fn of [mocks.getLogs, mocks.fetchLeaderboardFromDb, mocks.checkPassportScores,
      mocks.upsertScoreAuthoritative, mocks.upsertVictoryAuthoritative, mocks.upsertPassportCache, mocks.setSyncState]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
  it("runs passport once at the head and updates only its returned entries", async () => {
    mocks.getBlockNumber.mockResolvedValue(61_113_700);
    mocks.getLogs.mockResolvedValue([]);
    mocks.fetchLeaderboardFromDb.mockResolvedValue([{ player: "fixture-player" }]);
    mocks.checkPassportScores.mockResolvedValue(new Map([["fixture-player", true]]));
    const { runSync } = await import("../sync-blockchain");
    expect((await runSync()).passportChecked).toBe(1);
    expect(mocks.upsertPassportCache).toHaveBeenCalledExactlyOnceWith([
      { player: "fixture-player", is_verified: true },
    ]);
    expect(mocks.setSyncState).toHaveBeenCalledTimes(1);
  });
  it("authoritative score write failure does not advance the batch cursor", async () => {
    const { ethers } = await import("ethers");
    const error = new Error("fixture DB failure");
    mocks.upsertScoreAuthoritative.mockRejectedValue(error);
    mocks.getLogs.mockImplementation(async r => r.address === "score-fixture" ? [{
      topics: ["topic", ethers.zeroPadValue("0x1234", 32), ethers.toBeHex(1, 32)],
      data: ethers.toBeHex(100, 32), transactionHash: "fixture-tx",
    }] : []);
    const { runSync } = await import("../sync-blockchain");
    await expect(runSync()).rejects.toBe(error);
    expect(mocks.upsertScoreAuthoritative).toHaveBeenCalledTimes(1);
    expect(mocks.setSyncState).not.toHaveBeenCalled();
    expect(mocks.fetchLeaderboardFromDb).not.toHaveBeenCalled();
  });
});


describe("event-scoped writes", () => {
  it.each([false, true])("only found score/victory events write rows; DB failure=%s", async fail => {
    const { ethers } = await import("ethers");
    const player = ethers.getAddress("0x" + "12".repeat(20));
    const scoreLog = {
      topics: ["topic", ethers.zeroPadValue(player, 32), ethers.toBeHex(1, 32)],
      data: ethers.toBeHex(100, 32), transactionHash: "fixture-score",
    };
    const iface = new ethers.Interface([
      "event VictoryMinted(address indexed player,uint256 indexed tokenId,uint8 difficulty,uint16 totalMoves,uint32 timeMs,address indexed token,uint256 totalAmount)",
    ]);
    const event = iface.encodeEventLog(iface.getEvent("VictoryMinted")!, [player, 1, 1, 3, 500, ethers.ZeroAddress, 0]);
    mocks.getLogs.mockImplementation(async r => r.address === "score-fixture" ? [scoreLog] : [{
      ...event, blockNumber: r.fromBlock, transactionHash: "fixture-victory",
    }]);
    const error = new Error("fixture victory write failure");
    if (fail) mocks.upsertVictoryAuthoritative.mockRejectedValue(error);
    const { runSync } = await import("../sync-blockchain");
    if (fail) await expect(runSync()).rejects.toBe(error);
    else {
      const result = await runSync();
      expect(result.scoresUpserted).toBe(1);
      expect(result.victoriesUpserted).toBe(1);
    }
    expect(mocks.upsertScoreAuthoritative).toHaveBeenCalledTimes(1);
    expect(mocks.upsertVictoryAuthoritative).toHaveBeenCalledTimes(1);
    expect(mocks.setSyncState).toHaveBeenCalledTimes(fail ? 0 : 1);
    expect(mocks.fetchLeaderboardFromDb).not.toHaveBeenCalled();
  });
});


describe("batch failure gates", () => {
  it("cursor read failure does not scan or write", async () => {
    const error = new Error("fixture cursor read failure");
    mocks.getSyncState.mockRejectedValue(error);
    const { runSync } = await import("../sync-blockchain");
    await expect(runSync()).rejects.toBe(error);
    expect(mocks.getLogs).not.toHaveBeenCalled();
    expect(mocks.setSyncState).not.toHaveBeenCalled();
  });
  it("passport cache write failure at the head does not commit the cursor", async () => {
    mocks.getBlockNumber.mockResolvedValue(61_113_700);
    mocks.getLogs.mockResolvedValue([]);
    mocks.fetchLeaderboardFromDb.mockResolvedValue([{ player: "fixture-player" }]);
    mocks.checkPassportScores.mockResolvedValue(new Map([["fixture-player", true]]));
    const error = new Error("fixture passport write failure");
    mocks.upsertPassportCache.mockRejectedValue(error);
    const { runSync } = await import("../sync-blockchain");
    await expect(runSync()).rejects.toBe(error);
    expect(mocks.setSyncState).not.toHaveBeenCalled();
  });
});
