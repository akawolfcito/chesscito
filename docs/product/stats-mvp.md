# `/stats` MVP — Data Sources, Caveats, and Privacy Posture

**Fecha:** 2026-06-03
**Estado:** Live en preview, pendiente promote a production.
**Route:** `app/[locale]/stats/page.tsx` (Server Component, `revalidate = 3600`).
**Aggregator:** `apps/web/src/lib/stats/public-aggregator.ts`.
**Audit base:** `docs/audits/2026-06-03-stats-mvp-architecture-audit.md`.

This doc is the **single source of truth** for what `/stats` shows, where each number comes from, what it does NOT show, and why each "coming soon" is deferred. It exists so a reviewer can independently verify that no metric overpromises.

---

## 1. Architecture (1 sentence)

A Server Component runs `getPublicStats()` at most once per hour per region, which fans out 12 independent Supabase queries plus the existing leaderboard helper via `Promise.allSettled`; any single query failure renders an em-dash placeholder for that field instead of blanking the page.

---

## 2. Metric inventory + sources

### 2.1 Primary headline cards (hero row)

| Card | Source | Method | Notes |
|---|---|---|---|
| Total Victories Minted | Supabase `victories` | `count: "exact", head: true` | One row per on-chain mint (`/api/sign-victory` callback + cron sync). Lifetime, no TTL. |
| Approx. Active Sessions (7d) | Supabase `analytics_events` | `select("session_id").gte("created_at", 7d).range(0, 9999)` then in-app distinct | Counts unique `session_id` strings (client-side opaque ID). NOT wallet-tied — a single user across two devices appears as two sessions. |
| Victories (30d) | Supabase `victories` | `count: "exact", head: true, gte("minted_at", 30d)` | Same row source as Total; sliding 30-day window. |

### 2.2 Activity windows (secondary grid)

| Card | Source | Method |
|---|---|---|
| Victories (7d) | `victories` | `count: "exact", head: true, gte("minted_at", 7d)` |
| Unique Minter Wallets | `victories` | `select("player").range(0, 9999)` then in-app distinct (lowercased) |
| Approx. Sessions (30d) | `analytics_events` | distinct `session_id` over 30 days |
| Welcome Packs Claimed | `welcome_pack_claims` | `count: "exact", head: true` lifetime |
| Welcome Packs (7d) | `welcome_pack_claims` | `count: "exact", head: true, gte("claimed_at", 7d)` |

### 2.3 Victories by difficulty

`victories.difficulty` is an `int` column where `1 = Easy`, `2 = Medium`, `3 = Hard`. Aggregator tallies in JS; unmapped values (legacy or future bands) are silently dropped so the sum always equals `totalVictories`.

### 2.4 Hall of Fame

`victories.order("minted_at", desc).limit(10)`. Multi-column select (token_id, player, difficulty, minted_at, etc.). Wallet rendered truncated as `0xAAAA…BBBB`.

### 2.5 Top 10 Leaderboard

`fetchLeaderboardFromDb()` (existing helper). Prefers RPC `get_leaderboard`, falls back to `leaderboard_v` view. **Source is `scores`, NOT `victories`** — players ranked by accumulated game score. Microcopy under the heading disambiguates so readers don't cross-count against the Unique Minter Wallets card.

---

## 3. Refresh cadence

- Server Component `revalidate = 3600` (1 hour).
- Vercel Functions cache the rendered HTML per region; first hit after expiry triggers re-aggregation.
- `generatedAt` ISO timestamp is rendered at the top of the page so a stale CDN snapshot is identifiable.

---

## 4. Caveats (rendered on-page, plus what's only here)

### 4.1 Active sessions ≠ users

`analytics_events.session_id` is an opaque client-generated ID, regenerated when localStorage is cleared. A single human across two devices = two sessions. Methodology footer says this explicitly.

### 4.2 Welcome Packs ledger started post-launch

Sublabel "Claims tracked after launch" signals that low/zero values reflect when `welcome_pack_claims` started persisting, not absence of users in the broader population.

### 4.3 Unique Minter Wallets ≠ unique platform users

Card tracks the `victories.player` distinct lifetime. A user who played but never minted does not appear. Sublabel "Wallets with Victory mints" makes this explicit.

### 4.4 Leaderboard source differs from Victories source

Leaderboard reads `leaderboard_v` (derived from `scores`); Victories card reads `victories`. The two populations can diverge legitimately — a player can score without minting, and a wallet can mint without ranking in the top 10 score-wise.

---

## 5. Metrics NOT shown (and why)

| MiniPay §8 metric | Why not yet | Path to surface |
|---|---|---|
| Retention D1 / D7 / D30 | `analytics_events.session_id` does not persist cross-session (cleared with browser storage); cannot tie events to a stable user identity | Requires server-side identity continuity (a wallet-tied event stream) — outside the M1/M2 scope |
| Volume per stablecoin | Not tracked off-chain; no per-purchase amount ledger in Supabase | Subgraph or Dune sink (future cluster) |
| Network fees paid | On-chain only | Same |
| Protocol revenue per stablecoin | On-chain only | Same |
| Failed-tx rate | No tx-state ledger — purchase failures are not persisted server-side | Requires C1 Redis write-through (see §7) or a tx-state table |

The methodology footer on the page lists these four omissions verbatim so a reviewer cannot accuse the page of overpromising.

---

## 6. Privacy posture

- **Aggregates only.** No per-wallet lookup is exposed from `/stats`. The wallet-scoped surfaces (`/api/profile/stats`, `/api/founder-status`) require a `wallet` query param and exist independently.
- **Truncated wallets only.** Hall of Fame and Leaderboard render `0xAAAA…BBBB` (6 + 4 hex chars). Full addresses appear in the React Server Components serialization payload as `key` props (only for HoF, where `key={row.tx_hash}` is a public on-chain identifier — not a wallet leak). No wallet enumeration is facilitated by the page.
- **No row-level access** to `analytics_events`, `coach_analyses`, or `welcome_pack_claims`. Only aggregate counts.
- **No content** of Coach analyses, signatures, or analytics props is rendered.
- **No auth gating.** Public page; data sources are aggregated over already-public on-chain events plus anonymous telemetry.

---

## 7. Future evolutions (NOT in MVP)

These are documented to set expectations, not opened as clusters yet.

### 7.1 C1 Redis write-through for founder-status

Audit: `docs/audits/2026-06-03-founder-status-timeout-audit.md` §9. Independent of `/stats` but unblocks accurate Welcome Pack / Founder counters if those grow.

### 7.2 Real DAU / MAU

Requires a wallet-tied event stream (server-side ledger of authenticated sessions). Cluster scope: ~1 week for the schema + write path + retention query.

### 7.3 Stablecoin volume + protocol revenue

Requires either a subgraph indexer or a per-purchase amount ledger. The user has vetoed Dune / paid indexers for now. Path of least resistance: extend the existing Shop purchase write to persist the USD6 amount alongside `victories` / `welcome_pack_claims`.

### 7.4 Tx-state failure ledger

A `tx_attempts` table with `(wallet, attempted_at, status, error_code)` rows would enable a failed-tx-rate metric. Out of MVP scope; the Shop / Coach Credits purchase flows would need write-side changes.

---

## 8. Triggers to revisit

- **`victories` table > 10,000 rows**: the `.range(0, 9999)` ceiling on the distinct queries (player, difficulty) becomes the bottleneck. Solution: switch to a server-side `count(distinct ...)` RPC or batched scan.
- **`analytics_events` > 10,000 rows in a 30-day window**: same ceiling on distinct session_id. Add pagination loop or move the count to a materialized aggregate refreshed daily.
- **Reviewer complains about "Approx." labels**: the only way to drop them is a real wallet-bound identity event stream (see §7.2).
- **Welcome Packs Claimed stays at 0 for > 30 days post-launch**: investigate whether the write path on `/api/welcome-pack/claim` is firing in production. Could be an env or instrumentation issue.

---

## 9. Verification commands

Re-audit the aggregator surface against current code:

```sh
# All Supabase tables the aggregator touches:
rg -n 'from\("(victories|welcome_pack_claims|analytics_events|coach_analyses)"\)' apps/web/src/lib/stats

# Unit tests:
pnpm --filter web test public-aggregator
pnpm --filter web test stats-page

# Type-check + lint:
pnpm --filter web type-check
pnpm --filter web lint
```

If any source moves to a new table or column, update §2 + §5 + §6 in this doc.

---

## 10. Change history

| Date | Change |
|---|---|
| 2026-06-03 | Initial MVP shipped — aggregator + page route + 4 disambiguation sublabels |
| 2026-06-03 | Dashboard polish — full-width shell, soft cream scrim, platform-level copy, "What this shows" + "Platform signals" + "Tracked today / Coming next" sections |
| 2026-06-03 | Activity charts — 30-day SVG sparklines (sessions + mints) + horizontal difficulty mix bars, zero new dependencies |
| 2026-06-03 | Cluster closed as honest MVP. §8 coverage marked partial in the MiniPay submission packet; closing the full §8 gap (real DAU/MAU, retention cohorts, stablecoin volume, fees, revenue, failed-tx rate, top countries) deferred to a dedicated analytics cluster (~2-4 weeks). No further polish until a real instrumentation/indexing path is opened. |
