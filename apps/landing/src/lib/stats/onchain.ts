import { bump } from "./instrument";

/**
 * §8 on-chain stats — pure helpers + types for the public /stats page.
 *
 * Spec: docs/specs/stats-onchain-metrics-minipay-s8.md
 *
 * Port of `apps/web/src/lib/stats/onchain.ts`, **unchanged in logic**. This
 * block is correct today and Phase C must not move a single number in it; the
 * only edit is inlining the three-token table (the landing has no
 * `lib/contracts`) and it is asserted against the same addresses.
 */

/** Counts for one on-chain action across the three windows the page already
 *  uses. `null` = the underlying query failed (renders as an em-dash). */
export type PeriodCounts = {
  lifetime: number | null;
  last30d: number | null;
  last7d: number | null;
};

/** Per-stablecoin lifetime **Get Peones** volume in HUMAN token units. */
export type GetPeonesVolume = {
  usdc: number | null;
  usdt: number | null;
  cusd: number | null;
};

export type OnchainMethodTx = {
  victoryMints: PeriodCounts;
  packPurchases: PeriodCounts;
  scoreSaves: PeriodCounts;
  welcomePackClaims: PeriodCounts;
};

export type OnchainStats = {
  methodTx: OnchainMethodTx;
  /** Distinct wallets across victories ∪ pack_purchase ∪ on-chain `scores`.
   *  `null` if ANY of the three source queries failed. */
  uniqueOnchainUsersLifetime: number | null;
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

/** The payment rail's stablecoin allowlist, mirrored from
 *  `apps/web/src/lib/contracts/tokens.ts`. Addresses and decimals are asserted
 *  against that file by a test: a drift here would silently mis-scale volume. */
export const ACCEPTED_TOKENS = [
  { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6 },
  { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
  { symbol: "cUSD", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 },
] as const;

function symbolToVolumeKey(symbol: string): keyof GetPeonesVolume | null {
  const s = symbol.toLowerCase();
  if (s === "usdc") return "usdc";
  if (s === "usdt") return "usdt";
  if (s === "cusd") return "cusd";
  return null;
}

const TOKEN_BY_ADDRESS: Map<string, { key: keyof GetPeonesVolume; decimals: number }> =
  new Map(
    ACCEPTED_TOKENS.flatMap((t) => {
      const key = symbolToVolumeKey(t.symbol);
      return key ? [[t.address.toLowerCase(), { key, decimals: t.decimals }] as const] : [];
    }),
  );

export type PackPurchaseVolumeRow = {
  token?: string | null;
  amountPaid?: string | null;
};

/**
 * Sum pack-purchase volume per stablecoin, normalized from base units to human
 * units (2 dp). Unknown token or non-integer `amountPaid` → skipped. BigInt
 * sums avoid precision loss on 18-dp cUSD before the single divide at the end.
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
  return key === "cusd" ? 18 : 6;
}

/** base-unit BigInt → human Number rounded to 2 dp. */
function toHuman(base: bigint, decimals: number): number {
  const divisor = 10n ** BigInt(decimals);
  const whole = base / divisor;
  const frac = base % divisor;
  const cents = (frac * 100n) / divisor;
  return Number(whole) + Number(cents) / 100;
}

/** If ANY source is `null` the union is `null` — never a misleadingly-partial
 *  count. Wallets are lowercased before deduping. */
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

// ── Query layer ────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The `to` bound for the distinct/volume row scans — inclusive, so 999 asks for
 * 1,000 rows.
 *
 * ⛔ THIS IS NOT A CHOICE. PostgREST caps every response at `db-max-rows`
 * (1,000 on Supabase) and an explicit `.range()` does NOT lift it. The value
 * here was once 9,999 with a comment claiming the range dodged the cap; the
 * constant AND its false comment were copied between two files. It travels
 * corrected. Evidence: `docs/audits/2026-08-04-public-stats-accuracy-audit.md` §9.
 *
 * ✅ These three scans are still WHOLE today, and that is luck, not design:
 * `victories` ~249 rows, `scores` ~35, `peones_ledger` filtered to
 * `source=pack_purchase` ~17. The day any passes 1,000 this block starts
 * undercounting silently.
 */
export const ONCHAIN_QUERY_MAX_ROWS = 999;

/** Minimal structural shape of the Supabase client this module needs. Kept
 *  loose (the query builder is heavily overloaded); resolution is validated at
 *  the test boundary. */
export type StatsDb = {
  from: (table: string) => {
    select: (
      cols: string,
      opts?: { count?: "exact"; head?: boolean },
    ) => StatsQuery;
  };
};
type StatsQuery = {
  eq: (col: string, val: string) => StatsQuery;
  gte: (col: string, val: string) => StatsQuery;
  range: (from: number, to: number) => StatsQuery;
} & PromiseLike<{ count?: number | null; data?: unknown[] | null; error?: unknown }>;

type Settled<T> = PromiseSettledResult<T>;
type CountRes = { count?: number | null; error?: unknown };
type RowsRes = { data?: unknown[] | null; error?: unknown };

function count(res: Settled<CountRes>): number | null {
  if (res.status !== "fulfilled" || res.value?.error) return null;
  return typeof res.value?.count === "number" ? res.value.count : null;
}

function rowsOrNull<T>(res: Settled<RowsRes>): T[] | null {
  if (res.status !== "fulfilled" || res.value?.error) return null;
  return Array.isArray(res.value?.data) ? (res.value.data as T[]) : null;
}

function pluckWallets(rows: Record<string, unknown>[] | null, key: string): string[] | null {
  if (rows === null) return null;
  return rows.map((r) => (typeof r[key] === "string" ? (r[key] as string) : "")).filter(Boolean);
}

export async function fetchOnchainStats(supabase: StatsDb): Promise<OnchainStats> {
  bump("onchainReads");
  const now = Date.now();
  const since7d = new Date(now - 7 * DAY_MS).toISOString();
  const since30d = new Date(now - 30 * DAY_MS).toISOString();
  const HEAD = { count: "exact" as const, head: true };

  const results = await Promise.allSettled([
    // 0-2 victory mints (victories.minted_at)
    supabase.from("victories").select("*", HEAD),
    supabase.from("victories").select("*", HEAD).gte("minted_at", since30d),
    supabase.from("victories").select("*", HEAD).gte("minted_at", since7d),
    // 3 victory players (union source A)
    supabase.from("victories").select("player").range(0, ONCHAIN_QUERY_MAX_ROWS),
    // 4-6 Get Peones pack purchases
    supabase.from("peones_ledger").select("*", HEAD).eq("source", "pack_purchase"),
    supabase
      .from("peones_ledger")
      .select("*", HEAD)
      .eq("source", "pack_purchase")
      .gte("created_at", since30d),
    supabase
      .from("peones_ledger")
      .select("*", HEAD)
      .eq("source", "pack_purchase")
      .gte("created_at", since7d),
    // 7 pack rows: wallet + metadata (volume + union source B)
    supabase
      .from("peones_ledger")
      .select("wallet, metadata")
      .eq("source", "pack_purchase")
      .range(0, ONCHAIN_QUERY_MAX_ROWS),
    // 8-10 on-chain score saves (public.scores.created_at)
    supabase.from("scores").select("*", HEAD),
    supabase.from("scores").select("*", HEAD).gte("created_at", since30d),
    supabase.from("scores").select("*", HEAD).gte("created_at", since7d),
    // 11 score players (union source C)
    supabase.from("scores").select("player").range(0, ONCHAIN_QUERY_MAX_ROWS),
    // 12-14 welcome pack claims
    supabase.from("welcome_pack_claims").select("*", HEAD),
    supabase.from("welcome_pack_claims").select("*", HEAD).gte("claimed_at", since30d),
    supabase.from("welcome_pack_claims").select("*", HEAD).gte("claimed_at", since7d),
  ]) as Settled<CountRes & RowsRes>[];

  const [
    vLife, v30, v7, vPlayers,
    pLife, p30, p7, pRows,
    sLife, s30, s7, sPlayers,
    wLife, w30, w7,
  ] = results;

  const packRows = rowsOrNull<{ wallet?: string; metadata?: { token?: string; amountPaid?: string } }>(
    pRows,
  );
  const volume = normalizeGetPeonesVolume(
    packRows === null
      ? null
      : packRows.map((r) => ({
          token: r.metadata?.token ?? null,
          amountPaid: r.metadata?.amountPaid ?? null,
        })),
  );

  const unionA = pluckWallets(rowsOrNull<Record<string, unknown>>(vPlayers), "player");
  const unionB = packRows === null ? null : packRows.map((r) => r.wallet ?? "").filter(Boolean);
  const unionC = pluckWallets(rowsOrNull<Record<string, unknown>>(sPlayers), "player");

  return {
    methodTx: {
      victoryMints: { lifetime: count(vLife), last30d: count(v30), last7d: count(v7) },
      packPurchases: { lifetime: count(pLife), last30d: count(p30), last7d: count(p7) },
      scoreSaves: { lifetime: count(sLife), last30d: count(s30), last7d: count(s7) },
      welcomePackClaims: { lifetime: count(wLife), last30d: count(w30), last7d: count(w7) },
    },
    uniqueOnchainUsersLifetime: unionDistinctOrNull([unionA, unionB, unionC]),
    getPeonesVolume: volume,
    networkFeesPaidUsd: null,
    failedTxRate: null,
  };
}
