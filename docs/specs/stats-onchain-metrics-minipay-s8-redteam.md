# Red Team Review — stats-onchain-metrics-minipay-s8

**Date**: 2026-06-12
**Reviewer mindset**: hostile QA + senior engineer

## Findings

### P0 — Must address before implementation

- **[scores-table-unknown] The `scoreSaves` method is unimplementable until Open Question #1 is answered.** The spec asserts an on-chain `scores` table with `created_at` (behavior #1, contract comment) but never verifies it exists. The migrations show `score_saves_init` (off-chain) and `leaderboard_combined_view` (a union). If the on-chain scores rows live only inside a view, or lack a per-row timestamp/tx_hash, `scoreSaves` PeriodCounts cannot be computed as specified. **Why blocking:** a named field in the contract with no resolvable data source ships as permanently-null and silently misrepresents "we track score saves." Resolve the table FIRST (read the migration), or drop `scoreSaves` from the v1 contract.

- **[volume-semantics-misleading] "Stablecoin volume" sourced from pack_purchase ONLY undercounts total on-chain stablecoin flow, but the label implies totality.** Victory mints and Shop purchases also move stablecoins; if those aren't summed (Open Question #3 unresolved), a reviewer reading "Stablecoin volume: $X" gets a number that is really "Get-Peones volume only." **Why blocking:** MiniPay uses volume for promotion decisions; a label that overstates coverage is worse than disclosing scope. Either sum all stablecoin-moving methods or rename the metric to "Get Peones volume" explicitly.

### P1 — Should address

- **[zero-vs-null-empty-set] The empty-DB edge case (0 vs null) is under-specified for distinct/union counts.** A successful query returning `[]` must yield `0`, but the existing `extractDistinctCount` returns `set.size` (0) on `[]` and `null` only on failure — good for counts, but the NEW union logic (uniqueOnchainUsers across 3 sources) needs an explicit rule: if ONE of the three source queries fails, is the union `null` (can't trust it) or the partial union (misleadingly low)? Spec behavior #4 assumes all three succeed. **Risk if ignored:** a partial union silently undercounts unique users with no signal. Recommend: union is `null` if ANY of its three sources failed.

- **[amountPaid-encoding] The spec assumes `metadata.amountPaid` is a base-unit string but never pins the encoding.** verify-payment writes `amountPaid = verdict.amount.toString()` (base units). If any historical row stored a normalized/decimal value, summing mixes units. **Risk if ignored:** volume silently wrong for legacy rows. Recommend: the test fixture must assert base-unit string parsing, and the impl should guard non-integer strings (skip, per edge case) — already listed, but tie it to a test.

- **[bigint-display-path] Spec says "sum in base-unit BigInt then divide to Number" for cUSD safety but the contract type is `number`.** The division point (18-dp cUSD → human Number) loses precision if done naively. **Risk if ignored:** display rounding inconsistency. Low stakes (display only) but pin the rounding (e.g. 2 dp) in the spec so tests are deterministic.

- **[period-window-mismatch-vs-§8] §8 literally asks day/week/month/lifetime; spec ships lifetime/30d/7d.** Defensible (noted in out-of-scope) but a reviewer checking the literal list will see "month" and "week" missing. **Risk if ignored:** form reviewer dings the mismatch. Recommend: in the page caption, map our windows to their ask ("7d ≈ week, 30d ≈ month") so it reads as covered, not missing.

### P2 — Nice to clarify

- **[unique-users-cost] The union distinct-count fetches up to 3 × 9_999 wallet rows into JS each page build (hourly).** Fine now; note the ceiling like the existing code does so it's not a silent truncation later.
- **[badge-method-omitted] Open Question #2 (badge claims as a 5th method) — if there's no mirror table, say so in the page so "4 methods" isn't read as "we don't do badges."**
- **[failed-tx-telemetry-honesty] Open Question #4 — if showing client-reported failure rate, the "not on-chain" caveat must be visually adjacent, not a footnote, or it reads as the on-chain number MiniPay asked for.**
- **[generatedAt-staleness] The page already stamps `generatedAt`; ensure the new §8 block shares the same timestamp so one stale lane can't look fresh.**

## Categories audited

### Contract gaps
- Types are complete and avoid `any`. `null` semantics are explicit and consistent with the existing file. Roadmap fields typed as literal `null` (good — uninhabitable by real data). **Gap:** `scoreSaves` data source unverified (P0).

### Behavioral ambiguity
- Behavior #4 (union) doesn't define partial-failure result (P1). Behavior #2 volume doesn't define multi-source scope (P0 volume-semantics). Otherwise each behavior has a clear trigger.

### Hidden assumptions
- Assumes an on-chain `scores` table with timestamps (P0). Assumes `metadata.amountPaid` base-unit encoding across all historical rows (P1). Assumes pack_purchase is the only stablecoin source worth counting (P0 volume).

### Backward compatibility
- Additive only: one new `onchain` field on `PublicStats`, new `EMPTY_PUBLIC_STATS.onchain`. No existing field changes. Existing stats tests should pass unchanged IF the new field is added to any object literals they assert on — check the stats-page tests for exhaustive-shape assertions.

### Security & data
- No new PII; no wallet required; reads aggregate counts. Stablecoin volume + wallet-union are aggregates, not per-user exposure. Unique-users is a count, not a wallet list. Good. Confirm the §8 block doesn't render any raw wallet (the existing leaderboard already truncates).

### Test coverage gaps
- All acceptance criteria are testable. Add explicit tests for: union partial-failure → null (P1), unknown-token skip, 6dp vs 18dp normalization, amountPaid non-numeric skip, empty-set → 0 not null. Page-level: roadmap fields never render a number.

### Operational readiness
- Inherits the page's `Promise.allSettled` isolation + hourly cache + em-dash fallback. No rollback risk (additive, read-only). No new env, no migration. Logging: match the existing silent-null pattern, but consider a single `log.warn` when the whole onchain block fails so a prod outage is visible.

## Verdict

**Initial: NEEDS REVISION (light). Final: READY for /tdd** — all three P0s resolved in-spec on 2026-06-12 (see spec "Resolved" section):

1. **scores table** — RESOLVED by reading `20260610000000_leaderboard_combined_view.sql`: `public.scores` has `player`, `tx_hash UNIQUE`, `created_at`. `scoreSaves` stays, sourced from it.
2. **volume scope** — RESOLVED: v1 scoped + relabeled "Get Peones volume" (pack_purchase only); type renamed `GetPeonesVolume`.
3. **union partial-failure** — RESOLVED: `uniqueOnchainUsersLifetime` is `null` if any of its 3 sources fail (behavior #4 updated).

P1/P2 items (zero-vs-null on empty set, amountPaid base-unit encoding, BigInt→2dp display, window→§8 caption mapping, badge-method note, failed-tx honesty caption) are folded into the spec's edge cases / acceptance criteria and should each map to a test in `/tdd`. The architecture (derive from existing tables, roadmap-disclose the rest) is sound and low-risk. **Proceed to /tdd.**
