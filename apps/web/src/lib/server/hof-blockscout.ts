import { Redis } from "@upstash/redis";
import { decodeEventLog } from "viem";

import { victoryAbi } from "@/lib/contracts/victory";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VICTORY_NFT = process.env.NEXT_PUBLIC_VICTORY_NFT_ADDRESS ?? "";
const BLOCKSCOUT_API = "https://celo.blockscout.com/api";
/** VictoryNFT deployed 2026-03-17 — no events before this block. */
const FROM_BLOCK = 61_250_000;
const FETCH_TIMEOUT_MS = 5_000;
const CACHE_TTL_S = 60;

const CACHE_KEYS = {
  all: "hof:v2:all",
  player: (addr: string) => `hof:v2:player:${addr.toLowerCase()}`,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VictoryRow = {
  tokenId: string;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  timestamp: number;
};

type BlockscoutLog = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  timeStamp: string;
  transactionHash: string;
  logIndex: string;
};

type BlockscoutResponse = {
  status: string;
  message: string;
  result: BlockscoutLog[];
};

// ---------------------------------------------------------------------------
// Blockscout fetch + decode
// ---------------------------------------------------------------------------

function decodeVictoryLog(log: BlockscoutLog): VictoryRow | null {
  try {
    const decoded = decodeEventLog({
      abi: victoryAbi,
      data: log.data as `0x${string}`,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
    });

    if (decoded.eventName !== "VictoryMinted") return null;

    const args = decoded.args as {
      player: string;
      tokenId: bigint;
      difficulty: number;
      totalMoves: number;
      timeMs: number;
    };

    return {
      tokenId: args.tokenId.toString(),
      player: args.player,
      difficulty: args.difficulty,
      totalMoves: args.totalMoves,
      timeMs: args.timeMs,
      timestamp: Number(log.timeStamp),
    };
  } catch {
    return null;
  }
}

export async function fetchAllVictories(): Promise<VictoryRow[]> {
  if (!VICTORY_NFT) return [];

  const url = new URL(BLOCKSCOUT_API);
  url.searchParams.set("module", "logs");
  url.searchParams.set("action", "getLogs");
  url.searchParams.set("address", VICTORY_NFT);
  url.searchParams.set("fromBlock", String(FROM_BLOCK));
  url.searchParams.set("toBlock", "latest");

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as BlockscoutResponse;

  if (json.status !== "1" || !Array.isArray(json.result)) return [];

  const rows: VictoryRow[] = [];
  for (const log of json.result) {
    const row = decodeVictoryLog(log);
    if (row) rows.push(row);
  }

  // Sort by timestamp descending (most recent first)
  rows.sort((a, b) => b.timestamp - a.timestamp);

  return rows;
}

// ---------------------------------------------------------------------------
// Redis-cached reads
// ---------------------------------------------------------------------------

function makeRedis(): Redis {
  return Redis.fromEnv();
}

async function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const redis = makeRedis();
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;

    const fresh = await fetcher();
    // Fire-and-forget cache write
    redis.set(key, JSON.stringify(fresh), { ex: CACHE_TTL_S }).catch(() => {});
    return fresh;
  } catch {
    // Redis down — fetch directly
    return fetcher();
  }
}

export async function getHallOfFame(): Promise<VictoryRow[]> {
  return cachedGet(CACHE_KEYS.all, async () => {
    const all = await fetchAllVictories();
    return all.slice(0, 10);
  });
}

export async function getPlayerVictories(
  player: string,
): Promise<VictoryRow[]> {
  return cachedGet(CACHE_KEYS.player(player), async () => {
    const all = await fetchAllVictories();
    return all.filter(
      (v) => v.player.toLowerCase() === player.toLowerCase(),
    );
  });
}
