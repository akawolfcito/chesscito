import { getVictoryNFTAddress, getConfiguredChainId } from "@/lib/contracts/chains";

export type VictoryEntry = {
  tokenId: bigint;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number; // unix seconds, resolved from block
};

/** Known safe start block — VictoryNFT deployed 2026-03-17, no events before this. */
export const EVENT_SCAN_START = 61_250_000n;

/** Returns the VictoryNFT address if configured, or null. Used by page to detect config errors. */
export function getVictoryAddress(): `0x${string}` | null {
  const chainId = getConfiguredChainId();
  return chainId ? getVictoryNFTAddress(chainId) : null;
}
