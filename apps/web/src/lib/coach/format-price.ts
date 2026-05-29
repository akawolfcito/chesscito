import { DIFFICULTY_TO_CHAIN, VICTORY_PRICES, formatUsd } from "@/lib/contracts/tokens";

/**
 * Format the Save Victory price for a difficulty label, with 3-decimal
 * precision for sub-cent values (Easy = $0.005). Returns `null` when
 * the difficulty is unknown so callers can hide the price ribbon
 * cleanly instead of rendering `"$NaN"` or a stale value.
 *
 * The arena end-state popup uses `formatUsd` directly (2 decimals),
 * which rounds Easy to `"$0.01"` — that is a known pre-existing
 * cosmetic inconsistency tracked separately. This helper is the
 * source of truth for the coach viewer, which the spec mandates show
 * the exact tier price.
 */
export function formatVictoryPriceForDifficulty(difficulty: string): string | null {
  const chainKey = DIFFICULTY_TO_CHAIN[difficulty as keyof typeof DIFFICULTY_TO_CHAIN];
  if (chainKey == null) return null;
  const priceUsd6 = VICTORY_PRICES[chainKey];
  if (priceUsd6 == null) return null;
  // Easy ($0.005) needs 3 decimals; Medium ($0.01) and Hard ($0.02)
  // read fine with 2. The arena popup's `formatUsd` truncates Easy
  // to "$0.01" — we render the literal tier price here to match the
  // spec's §3.1 "Save Victory · $0.005" label exactly.
  const dollars = Number(priceUsd6) / 1_000_000;
  return dollars < 0.01 ? `$${dollars.toFixed(3)}` : formatUsd(priceUsd6);
}
