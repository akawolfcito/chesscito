/**
 * §8 on-chain stats — pure helpers + types for the public /stats page.
 *
 * Spec: docs/specs/stats-onchain-metrics-minipay-s8.md
 *
 * These functions are deliberately Supabase-free: they take already-
 * fetched rows and produce the on-chain block of PublicStats. All the
 * tricky logic the red-team flagged (decimal normalization, unknown-
 * token skip, union partial-failure → null) lives here so it can be
 * unit-tested without a query mock. The aggregator (public-aggregator.ts)
 * owns the queries and calls these.
 */

import { ACCEPTED_TOKENS } from "@/lib/contracts/tokens";

/** Counts for one on-chain action across the three windows the page
 *  already uses. `null` = the underlying query failed / data
 *  unavailable (renders as an em-dash), consistent with PublicStats. */
export type PeriodCounts = {
  lifetime: number | null;
  last30d: number | null;
  last7d: number | null;
};

/** Per-stablecoin lifetime **Get Peones** volume in HUMAN token units
 *  (normalized by decimals). v1 scope = pack purchases ONLY. `null`
 *  per token = the pack_purchase scan failed. */
export type GetPeonesVolume = {
  usdc: number | null;
  usdt: number | null;
  cusd: number | null;
};

/** On-chain transaction counts per user-facing contract method, each
 *  mirrored into a Supabase table on successful verify. */
export type OnchainMethodTx = {
  victoryMints: PeriodCounts;
  packPurchases: PeriodCounts;
  scoreSaves: PeriodCounts;
  welcomePackClaims: PeriodCounts;
};

/** §8 on-chain block. Implemented fields derive from existing tables;
 *  roadmap fields are the literal type `null` so the view ALWAYS shows
 *  them in the "Coming next" lane and they can never carry real data. */
export type OnchainStats = {
  methodTx: OnchainMethodTx;
  /** Distinct wallets across victories ∪ pack_purchase ∪ on-chain
   *  `scores`. `null` if ANY of the three source queries failed. */
  uniqueOnchainUsersLifetime: number | null;
  /** v1: Get Peones pack-purchase volume only. */
  getPeonesVolume: GetPeonesVolume;
  /** Roadmap — needs receipt/indexer data the app does not store. */
  networkFeesPaidUsd: null;
  /** Roadmap — needs an indexer to see reverts; app records only successes. */
  failedTxRate: null;
};

const NULL_PERIOD: PeriodCounts = { lifetime: null, last30d: null, last7d: null };

export const EMPTY_ONCHAIN_STATS: OnchainStats = {
  methodTx: {
    victoryMints: NULL_PERIOD,
    packPurchases: NULL_PERIOD,
    scoreSaves: NULL_PERIOD,
    welcomePackClaims: NULL_PERIOD,
  },
  uniqueOnchainUsersLifetime: null,
  getPeonesVolume: { usdc: null, usdt: null, cusd: null },
  networkFeesPaidUsd: null,
  failedTxRate: null,
};

/** token address (lowercase) → { volumeKey, decimals } for the three
 *  accepted stablecoins. Built from ACCEPTED_TOKENS so it can never
 *  drift from the payment rail's allowlist. */
const TOKEN_BY_ADDRESS: Map<string, { key: keyof GetPeonesVolume; decimals: number }> =
  new Map(
    ACCEPTED_TOKENS.flatMap((t) => {
      const key = symbolToVolumeKey(t.symbol);
      return key ? [[t.address.toLowerCase(), { key, decimals: t.decimals }] as const] : [];
    }),
  );

function symbolToVolumeKey(symbol: string): keyof GetPeonesVolume | null {
  const s = symbol.toLowerCase();
  if (s === "usdc") return "usdc";
  if (s === "usdt") return "usdt";
  if (s === "cusd") return "cusd";
  return null;
}

export type PackPurchaseVolumeRow = {
  /** lowercased token contract address from peones_ledger metadata */
  token?: string | null;
  /** base-unit amount string from peones_ledger metadata.amountPaid */
  amountPaid?: string | null;
};

/**
 * Sum Get-Peones pack-purchase volume per stablecoin, normalized from
 * base units to human units (rounded 2 dp). Rows with an unknown token
 * or a non-integer `amountPaid` are skipped (the red-team's defensive
 * cases). Base-unit sums use BigInt to avoid precision loss on 18-dp
 * cUSD before the single divide-to-Number at the end.
 *
 * `null` input (the query failed) → all-null volume.
 */
export function normalizeGetPeonesVolume(
  rows: PackPurchaseVolumeRow[] | null,
): GetPeonesVolume {
  if (rows === null) return { usdc: null, usdt: null, cusd: null };

  const base: Record<keyof GetPeonesVolume, bigint> = { usdc: 0n, usdt: 0n, cusd: 0n };

  for (const row of rows) {
    const token = typeof row?.token === "string" ? row.token.toLowerCase() : null;
    if (!token) continue;
    const meta = TOKEN_BY_ADDRESS.get(token);
    if (!meta) continue; // unknown / legacy token — skip

    const raw = typeof row?.amountPaid === "string" ? row.amountPaid.trim() : "";
    if (!/^\d+$/.test(raw)) continue; // non-integer base-unit string — skip
    base[meta.key] += BigInt(raw);
  }

  return {
    usdc: toHuman(base.usdc, decimalsFor("usdc")),
    usdt: toHuman(base.usdt, decimalsFor("usdt")),
    cusd: toHuman(base.cusd, decimalsFor("cusd")),
  };
}

function decimalsFor(key: keyof GetPeonesVolume): number {
  for (const meta of TOKEN_BY_ADDRESS.values()) {
    if (meta.key === key) return meta.decimals;
  }
  // Sensible fallback if a token is absent from ACCEPTED_TOKENS.
  return key === "cusd" ? 18 : 6;
}

/** base-unit BigInt → human Number rounded to 2 dp. */
function toHuman(base: bigint, decimals: number): number {
  const divisor = 10n ** BigInt(decimals);
  const whole = base / divisor;
  const frac = base % divisor;
  // Two-dp fractional component without floating the whole 18-dp value.
  const cents = (frac * 100n) / divisor;
  return Number(whole) + Number(cents) / 100;
}

/**
 * Distinct-wallet union across the on-chain mirror sources. Each source
 * is either an array of wallet strings or `null` (its query failed).
 * If ANY source is `null` the union is `null` (never a misleadingly-
 * partial count). Wallets are lowercased before deduping.
 */
export function unionDistinctOrNull(sources: (string[] | null)[]): number | null {
  if (sources.some((s) => s === null)) return null;
  const set = new Set<string>();
  for (const source of sources) {
    for (const w of source as string[]) {
      if (typeof w === "string" && w.length > 0) set.add(w.toLowerCase());
    }
  }
  return set.size;
}
