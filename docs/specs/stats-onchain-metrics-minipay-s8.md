# Spec — stats-onchain-metrics-minipay-s8

**Date**: 2026-06-12
**Status**: ready (red-team P0s resolved 2026-06-12 — see "Resolved" below)

## Resolved (post red-team)

- **P0 scores table** — `public.scores` (migration `20260610000000`) IS the on-chain source: columns `player`, `score`, `tx_hash UNIQUE NOT NULL`, `created_at timestamptz`. `scoreSaves` stays in v1, sourced from `public.scores` (NOT off-chain `score_saves`), counted by `created_at`, unique by `player`.
- **P0 volume semantics** — v1 volume is scoped to **Get Peones pack purchases only** (`peones_ledger` source='pack_purchase'). Renamed everywhere to "Get Peones volume" so the label never overstates coverage. Shop/Victory stablecoin flow is a future widening (Open Question #3 → deferred).
- **P1 union partial-failure** — `uniqueOnchainUsersLifetime` is `null` if ANY of its three source queries (victories / pack_purchase / scores) fails. Never a misleadingly-partial union.
- **Window mapping** — page captions map our windows to §8's wording: "7d ≈ this week, 30d ≈ this month, lifetime = all-time".

## Problem

MiniPay Stage-2 §8 ("Analytics & Operational Visibility") is the single remaining blocker to returning the readiness form (`docs/submission/2026-06-11-minipay-readiness-review.md`). It requires a public `/stats` page surfacing usage AND on-chain metrics. The page exists (`apps/web/src/app/[locale]/stats/page.tsx` + `components/stats/stats-page.tsx` + `lib/stats/public-aggregator.ts`) but only shows victories, sessions, welcome packs, leaderboard, and difficulty split. The on-chain breakdown MiniPay reviews for promotion/featuring is absent.

The existing aggregator's design rule is deliberate: **read only Supabase tables the app already populates — NO chain reads, NO indexer, NO new schema.** Most §8 on-chain metrics are recoverable under that rule because the app mirrors every verified on-chain action into Supabase (`victories`, `peones_ledger` pack_purchase rows with `metadata.token`/`metadata.amountPaid`, on-chain `scores`, `welcome_pack_claims`). Two metrics are NOT recoverable without a chain indexer (network fees, failed-tx rate) and must be disclosed as roadmap rather than faked.

## Goal

Extend `/stats` so it reports per-method on-chain transaction counts, unique on-chain users, and Get Peones stablecoin volume — all derived from existing Supabase tables — and transparently labels the metrics that need future infra (network fees, failed-tx rate, retention, top countries) as "coming", so the page honestly satisfies MiniPay §8.

## Non-goals

- **No chain indexer / Dune / Goldsky / Blockscout reads.** Keeps the aggregator's existing no-chain-reads contract.
- **No new Supabase schema or migration.** Derive from existing tables only.
- **Network fees paid** and **failed-tx rate** — NOT implemented (need receipt/indexer data the app doesn't store). Disclosed as roadmap.
- **Retention D1/D7/D30** and **top countries** — NOT implemented (need a web-analytics layer: PostHog/Plausible). Disclosed as roadmap.
- No wallet connection, no auth — page stays public/read-only.
- No change to the hourly `revalidate = 3600` caching model.

## Contracts (SDD)

Extends `PublicStats` in `apps/web/src/lib/stats/public-aggregator.ts`. New types:

```ts
/** Counts for one on-chain action across the three windows the page
 *  already uses. `null` = query failed / data unavailable (renders as
 *  an em-dash), consistent with every other field in PublicStats. */
export type PeriodCounts = {
  lifetime: number | null;
  last30d: number | null;
  last7d: number | null;
};

/** Per-stablecoin lifetime **Get Peones** volume in HUMAN token units
 *  (normalized by decimals: USDC/USDT 6dp, cUSD 18dp). v1 scope =
 *  pack purchases ONLY. `null` = the pack_purchase scan failed. Sums
 *  `metadata.amountPaid` (base-unit string) over peones_ledger rows
 *  where source='pack_purchase', grouped by metadata.token → symbol.
 *  Sum in base-unit BigInt, divide to a Number, round to 2 dp for
 *  display determinism. The page MUST label this "Get Peones volume",
 *  not "stablecoin volume", to avoid overstating coverage. */
export type GetPeonesVolume = {
  usdc: number | null;
  usdt: number | null;
  cusd: number | null;
};

/** On-chain transaction counts per user-facing contract method.
 *  Each is mirrored into a Supabase table on successful verify:
 *   - victoryMints      → `victories` (minted_at)
 *   - packPurchases     → `peones_ledger` where source='pack_purchase' (created_at)
 *   - scoreSaves        → on-chain `scores` table (created_at)  [NOT off-chain score_saves]
 *   - welcomePackClaims → `welcome_pack_claims` (claimed_at)
 */
export type OnchainMethodTx = {
  victoryMints: PeriodCounts;
  packPurchases: PeriodCounts;
  scoreSaves: PeriodCounts;
  welcomePackClaims: PeriodCounts;
};

/** §8 on-chain block. Implemented fields derive from existing tables.
 *  Roadmap fields are the literal type `null` (never a number) so the
 *  view ALWAYS renders them in the "coming next" lane — they cannot be
 *  accidentally populated. */
export type OnchainStats = {
  methodTx: OnchainMethodTx;
  /** Distinct wallets across victories ∪ pack_purchase ∪ on-chain
   *  `scores`. `null` if ANY of the three source queries failed (never
   *  a misleadingly-partial union). */
  uniqueOnchainUsersLifetime: number | null;
  /** v1: Get Peones pack-purchase volume only. */
  getPeonesVolume: GetPeonesVolume;
  /** Roadmap — needs receipt/indexer data the app does not store. */
  networkFeesPaidUsd: null;
  /** Roadmap — needs an indexer to see reverts; app records only successes. */
  failedTxRate: null;
};
```

`PublicStats` gains one field:

```ts
export type PublicStats = {
  // …all existing fields unchanged…
  onchain: OnchainStats;
};
```

`EMPTY_PUBLIC_STATS.onchain` is the all-`null` shape (every `PeriodCounts` field null, volume all null, roadmap fields null).

## Behavior

1. Given the aggregator runs, when all queries succeed, then `onchain.methodTx.{victoryMints,packPurchases,scoreSaves,welcomePackClaims}` each report `{lifetime,last30d,last7d}` counts from their mirror table.
2. Given pack_purchase ledger rows exist, when the aggregator sums `metadata.amountPaid` grouped by `metadata.token`, then `onchain.getPeonesVolume.{usdc,usdt,cusd}` reports lifetime Get-Peones volume in human units (base-unit BigInt sum ÷ decimals, rounded 2 dp).
3. Given a token address in `metadata.token` that maps to no known accepted stablecoin, when summing volume, then that row is skipped (not added to any bucket) — defensive against legacy/unknown tokens.
4. Given victories, pack_purchase, and on-chain `scores` rows, when computing `uniqueOnchainUsersLifetime`, then it is the size of the union of distinct lowercased wallets across all three sources — UNLESS any of the three source queries failed, in which case it is `null`.
5. Given any single underlying query fails (rejected or `.error`), when the aggregator assembles the result, then ONLY that metric is `null` — every other metric still resolves (preserves the existing `Promise.allSettled` isolation contract).
6. Given the result is rendered, when the page shows the §8 block, then `networkFeesPaidUsd` and `failedTxRate` always appear under a "Coming next" lane with an explanatory caption (needs indexer), never as a number.
7. Given the page renders, when retention and top-countries are shown, then they also appear under "Coming next" with a caption (needs web analytics) — no wallet, no PII collected.
8. Given a metric is `null`, when the view renders it, then it shows the existing em-dash placeholder (no "0", which would misrepresent a failed query as real data).

## Edge cases

- **Empty database** (fresh deploy): all counts `0` (not null) where the query succeeds with an empty set; volume `0`; unique users `0`. Distinguish 0 (real empty) from null (query failed).
- **Row cap**: distinct/volume scans must use the existing `DISTINCT_QUERY_MAX_ROWS` range bound (9_999) to dodge PostgREST's silent 1000-row default. If pack_purchase or scores volume approaches the cap, counts/volume silently undercount — log/comment the ceiling like the existing code does.
- **`metadata.amountPaid` missing or non-numeric** on a pack_purchase row: skip that row's volume contribution (don't NaN the whole bucket); still count it as a tx.
- **Mixed-case token addresses** in metadata: compare lowercased against the accepted-stablecoin address map.
- **cUSD 18-decimal vs USDC/USDT 6-decimal**: normalize per token before summing; do NOT sum raw base units across tokens.
- **On-chain `scores` table name/columns**: implementer MUST verify the exact on-chain scores table (vs off-chain `score_saves`) before wiring — §8 wants on-chain tx only. If only a combined view exists, filter to on-chain rows. (Open question below.)
- **Partial-failure render**: if the whole `onchain` block's queries fail, the §8 section renders all em-dashes + "data temporarily unavailable", never a 500.
- **Number precision**: cUSD volume in human units can exceed `Number.MAX_SAFE_INTEGER` only at >9e15 cUSD — not a real risk at this scale; sum in base-unit BigInt then divide to a Number for display to be safe.

## Acceptance criteria

- [ ] `PublicStats` has an `onchain: OnchainStats` field; `EMPTY_PUBLIC_STATS.onchain` is the all-null shape.
- [ ] `getPublicStats()` populates `methodTx` for all four methods with lifetime/30d/7d counts from the correct mirror tables.
- [ ] `getPeonesVolume` sums pack_purchase `amountPaid` per token, normalized by decimals, with unknown tokens skipped.
- [ ] `uniqueOnchainUsersLifetime` is the distinct-wallet union across victories + pack_purchase + on-chain scores.
- [ ] A failure in any one onchain query nulls only that metric; the rest (and the non-onchain stats) still resolve.
- [ ] `networkFeesPaidUsd` and `failedTxRate` are typed `null` and render only in the "Coming next" lane.
- [ ] The `/stats` page renders a §8 on-chain section: per-method tx table, unique users, Get Peones volume, plus a "Coming next" lane (network fees, failed-tx, retention, countries) with captions.
- [ ] Page requires no wallet and returns 200 with all-em-dash on total query failure (no 500).
- [ ] Unit tests cover: happy path, empty DB (0 vs null), single-query failure isolation, unknown-token skip, decimal normalization (6dp vs 18dp), amountPaid-missing skip.
- [ ] `pnpm tsc --noEmit` clean; existing stats tests still green.

## Out of scope / future

- **Network fees paid** + **failed-tx rate**: require a chain indexer (receipt `gasUsed × effectiveGasPrice`; revert detection). Roadmap.
- **Retention D1/D7/D30** + **top countries**: require a web-analytics layer (PostHog/Plausible/Umami). Roadmap.
- Per-day/week/month time-series for on-chain tx beyond the existing 30d activity chart — the §8 wording lists day/week/month/lifetime; we ship lifetime/30d/7d (a superset of "lifetime" + recent windows) and defer finer buckets.
- A Dune dashboard alternative to the in-app page.

## Open questions (resolved)

1. ~~On-chain scores table~~ **RESOLVED**: `public.scores` (`20260610000000`) — `player`, `tx_hash UNIQUE`, `created_at`. Use it for `scoreSaves`.
2. **Badge claims as a 5th method** — DEFERRED from v1. No confirmed mainnet badge-claim mirror table; ship 4 methods and have the page note badges aren't counted yet (so "4 methods" doesn't read as "no badges"). Revisit when a badge mirror table is confirmed.
3. ~~Volume scope~~ **RESOLVED**: v1 = Get Peones pack purchases only, labeled "Get Peones volume". Widening to Shop/Victory is future.
4. **Failed-tx rate via telemetry** — KEEP fully in "Coming next" for v1. The honest on-chain number needs an indexer; an "approximate client-reported" rate risks being misread as the on-chain figure MiniPay asked for. Do not ship a half-number.
