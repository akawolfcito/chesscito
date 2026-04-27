import { erc20Abi } from "viem";

import type { ArenaDifficulty } from "@/lib/game/types";

export const ACCEPTED_TOKENS = [
  { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as const, decimals: 6 },
  { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const, decimals: 6 },
  { symbol: "cUSD", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const, decimals: 18 },
] as const;

/** Native CELO token (also exposed as ERC-20 at this address). Used as
 *  an alternate payment route for the web (non-MiniPay) shop flow.
 *  MiniPay never offers CELO — its product spec is stablecoin-only.
 *  Because the Shop contract normalizes priceUsd6 by token decimals
 *  and assumes 1 token = 1 USD, the dedicated CELO route uses a
 *  separately-priced helper itemId so the contract still charges a
 *  whole CELO instead of a 90 % discount. See lib/contracts/shop-catalog
 *  and FOUNDER_BADGE_CELO_ITEM_ID. */
export const CELO_TOKEN = {
  symbol: "CELO" as const,
  address: "0x471EcE3750Da237f93B8E339c536989b8978a438" as const,
  decimals: 18,
} as const;

/** Lowercased CELO address for case-insensitive comparisons (event
 *  decoding, allowlist checks). */
export const CELO_ADDRESS_LOWER = CELO_TOKEN.address.toLowerCase();

/** Lowercased stablecoin allowlist for backend defense-in-depth checks
 *  (e.g. the coach verify-purchase endpoint refuses to grant credits
 *  unless the payment token is one of these). */
export const STABLECOIN_ADDRESSES_LOWER: readonly string[] = ACCEPTED_TOKENS.map(
  (t) => t.address.toLowerCase(),
);

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

