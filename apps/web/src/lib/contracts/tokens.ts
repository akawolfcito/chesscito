import { erc20Abi } from "viem";

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

/** Format priceUsd6 as a human-readable USD string (e.g. 25000 → "$0.03"). */
export function formatUsd(priceUsd6: bigint): string {
  const dollars = Number(priceUsd6) / 1_000_000;
  return `$${dollars.toFixed(2)}`;
}

export { erc20Abi };
