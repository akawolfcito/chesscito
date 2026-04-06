import { ethers } from "ethers";
import { decodeEventLog } from "viem";
import { scoreboardAbi } from "@/lib/contracts/scoreboard";
import { victoryAbi } from "@/lib/contracts/victory";
import { checkPassportScores } from "@/lib/server/passport";
import {
  upsertScoreAuthoritative,
  upsertVictoryAuthoritative,
  upsertPassportCache,
  fetchLeaderboardFromDb,
  getSyncState,
  setSyncState,
} from "@/lib/supabase/queries";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RPC_URL = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const SCOREBOARD_ADDRESS = process.env.NEXT_PUBLIC_SCOREBOARD_ADDRESS ?? "";
const VICTORY_NFT_ADDRESS = process.env.NEXT_PUBLIC_VICTORY_NFT_ADDRESS ?? "";

const DEFAULT_FROM_BLOCK = 61_113_664; // scoreboard deploy block
const CHUNK_SIZE = 50_000;

const SCORE_SUBMITTED_TOPIC = ethers.id(
  "ScoreSubmitted(address,uint256,uint256,uint256,uint256,uint256)"
);
const VICTORY_MINTED_TOPIC = ethers.id(
  "VictoryMinted(address,uint256,uint8,uint16,uint32,address,uint256)"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EthersFilter = {
  address: string;
  topics: string[];
  fromBlock: number;
  toBlock: number;
};

async function getLogsPaginated(
  provider: ethers.JsonRpcProvider,
  filter: Omit<EthersFilter, "fromBlock" | "toBlock"> & {
    fromBlock: number;
    toBlock: number;
  }
): Promise<ethers.Log[]> {
  const logs: ethers.Log[] = [];
  let from = filter.fromBlock;

  while (from <= filter.toBlock) {
    const to = Math.min(from + CHUNK_SIZE - 1, filter.toBlock);
    const chunk = await provider.getLogs({ ...filter, fromBlock: from, toBlock: to });
    logs.push(...chunk);
    from = to + 1;
  }

  return logs;
}

// ---------------------------------------------------------------------------
// Score sync
// ---------------------------------------------------------------------------

async function syncScores(
  provider: ethers.JsonRpcProvider,
  fromBlock: number,
  toBlock: number
): Promise<number> {
  if (!SCOREBOARD_ADDRESS) return 0;

  const logs = await getLogsPaginated(provider, {
    address: SCOREBOARD_ADDRESS,
    topics: [SCORE_SUBMITTED_TOPIC],
    fromBlock,
    toBlock,
  });

  let count = 0;
  for (const log of logs) {
    try {
      const topic1 = log.topics[1];
      const topic2 = log.topics[2];
      if (!topic1 || !topic2) continue;

      const player = ethers.getAddress("0x" + topic1.slice(26));
      const levelId = Number(ethers.toBigInt(topic2));
      const score = Number(ethers.toBigInt(log.data.slice(0, 66)));
      const timeMs =
        log.data.length >= 130
          ? Number(ethers.toBigInt("0x" + log.data.slice(66, 130)))
          : 0;

      await upsertScoreAuthoritative({
        player,
        level_id: levelId,
        score,
        time_ms: timeMs,
        tx_hash: log.transactionHash,
      });

      count++;
    } catch (err) {
      console.error("[syncScores] failed to process log:", err);
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Victory sync
// ---------------------------------------------------------------------------

async function syncVictories(
  provider: ethers.JsonRpcProvider,
  fromBlock: number,
  toBlock: number
): Promise<number> {
  if (!VICTORY_NFT_ADDRESS) return 0;

  const logs = await getLogsPaginated(provider, {
    address: VICTORY_NFT_ADDRESS,
    topics: [VICTORY_MINTED_TOPIC],
    fromBlock,
    toBlock,
  });

  let count = 0;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: victoryAbi,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });

      const args = decoded.args as Record<string, unknown>;

      const block = await provider.getBlock(log.blockNumber);
      const mintedAt = block?.timestamp
        ? new Date(Number(block.timestamp) * 1000).toISOString()
        : new Date().toISOString();

      await upsertVictoryAuthoritative({
        token_id: Number(args["tokenId"] ?? args["token_id"] ?? 0),
        player: String(args["player"] ?? args["to"] ?? ""),
        difficulty: Number(args["difficulty"] ?? 0),
        total_moves: Number(args["totalMoves"] ?? args["total_moves"] ?? 0),
        time_ms: Number(args["timeMs"] ?? args["time_ms"] ?? 0),
        tx_hash: log.transactionHash,
        minted_at: mintedAt,
      });

      count++;
    } catch (err) {
      console.error("[syncVictories] failed to process log:", err);
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Passport sync
// ---------------------------------------------------------------------------

async function syncPassport(): Promise<number> {
  const leaderboard = await fetchLeaderboardFromDb();
  const top10 = leaderboard.slice(0, 10).map((row) => row.player);

  if (top10.length === 0) return 0;

  const results = await checkPassportScores(top10);

  const entries = Array.from(results.entries()).map(([address, isVerified]) => ({
    player: address,
    is_verified: isVerified,
  }));

  await upsertPassportCache(entries);

  return entries.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export type SyncResult = {
  fromBlock: number;
  toBlock: number;
  scoresUpserted: number;
  victoriesUpserted: number;
  passportChecked: number;
};

export async function runSync(): Promise<SyncResult> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const [currentBlock, lastSyncedRaw] = await Promise.all([
    provider.getBlockNumber(),
    getSyncState("last_synced_block"),
  ]);

  const fromBlock = lastSyncedRaw
    ? Number(lastSyncedRaw) + 1
    : DEFAULT_FROM_BLOCK;
  const toBlock = currentBlock;

  if (fromBlock > toBlock) {
    return {
      fromBlock,
      toBlock,
      scoresUpserted: 0,
      victoriesUpserted: 0,
      passportChecked: 0,
    };
  }

  const [scoresUpserted, victoriesUpserted] = await Promise.all([
    syncScores(provider, fromBlock, toBlock),
    syncVictories(provider, fromBlock, toBlock),
  ]);

  const passportChecked = await syncPassport();

  await setSyncState("last_synced_block", String(toBlock));

  return { fromBlock, toBlock, scoresUpserted, victoriesUpserted, passportChecked };
}
