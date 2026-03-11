import { ethers } from "ethers";
import { checkPassportScores } from "./passport";

export type LeaderboardRow = {
  rank: number;
  player: string;
  score: number;
  isVerified?: boolean;
};

const RPC_URL = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const DEPLOY_BLOCK = 61_113_664;

const SCORE_SUBMITTED_TOPIC = ethers.id(
  "ScoreSubmitted(address,uint256,uint256,uint256,uint256,uint256)"
);

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const address = process.env.NEXT_PUBLIC_SCOREBOARD_ADDRESS ?? "";
  if (!address) return [];

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const currentBlock = await provider.getBlockNumber();

  const logs = await provider.getLogs({
    address,
    topics: [SCORE_SUBMITTED_TOPIC],
    fromBlock: DEPLOY_BLOCK,
    toBlock: currentBlock,
  });

  const best = new Map<string, number>();
  for (const log of logs) {
    if (!log.topics[1]) continue;
    const player = ethers.getAddress("0x" + log.topics[1].slice(26));
    // data: score (32 bytes) | timeMs | nonce | deadline
    const score = Number(ethers.toBigInt(log.data.slice(0, 66)));
    const prev = best.get(player) ?? 0;
    if (score > prev) best.set(player, score);
  }

  const sorted = Array.from(best.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const fullAddresses = sorted.map(([addr]) => addr);
  const verifiedMap = await checkPassportScores(fullAddresses);

  return sorted.map(([addr, score], i) => ({
    rank: i + 1,
    player: addr.slice(0, 6) + "..." + addr.slice(-4),
    score,
    isVerified: verifiedMap.get(addr) ?? false,
  }));
}
