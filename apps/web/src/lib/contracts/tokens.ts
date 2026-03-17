import { erc20Abi } from "viem";

import type { ArenaDifficulty } from "@/lib/game/types";

export const ACCEPTED_TOKENS = [
  { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as const, decimals: 6 },
  { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const, decimals: 6 },
  { symbol: "cUSD", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const, decimals: 18 },
] as const;

/** Convert priceUsd6 to token amount (mirrors contract _normalizePrice). */
export function normalizePrice(priceUsd6: bigint, tokenDecimals: number): bigint {
  if (tokenDecimals >= 6) {
    return priceUsd6 * 10n ** BigInt(tokenDecimals - 6);
  }
  return priceUsd6 / 10n ** BigInt(6 - tokenDecimals);
}

/** Format priceUsd6 as a human-readable USD string (e.g. 100000 → "$0.10"). */
export function formatUsd(priceUsd6: bigint): string {
  const dollars = Number(priceUsd6) / 1_000_000;
  return `$${dollars.toFixed(2)}`;
}

export { erc20Abi };

export const DIFFICULTY_TO_CHAIN: Record<ArenaDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export const VICTORY_PRICES: Record<number, bigint> = {
  1: 5_000n,   // Easy  — $0.005
  2: 10_000n,  // Medium — $0.01
  3: 20_000n,  // Hard  — $0.02
};

