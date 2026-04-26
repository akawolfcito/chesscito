# Session handoff — 2026-04-26

## State at close

- Branch: `main`, all commits pushed (`1a21938..c4d8348`).
- Production: deployed and verified end-to-end. Smoke OK on all sign-* + leaderboard + telemetry + coach/credits.
- Visual snapshots: 18/18 green (minipay + desktop), 60s run.
- Tests: 47 files / 418 cases green. Typecheck clean (apps/web). Lint warnings unchanged from baseline.

## What landed today

Tx hardening:
- `e42159a` global `waitForReceiptWithTimeout` (120s default) + friendly timeout copy.
- `78b0182` cancelled / timeout claim phases with safe exit + sessionStorage cleanup.
- `5e354ae` synchronous concurrency guard for `handleSubmitScore`.
- `4ad08c1` exercise drawer no longer leaves end-of-piece overlays stuck.

Monetization Fase 0:
- `bddfb51` Retry Shield (itemId 2) wired end-to-end. Awaiting admin tx `ShopUpgradeable.setItem(2, 25000, true)`.
- `5f84380` `COACH_PACK_ITEMS` extracted into `lib/contracts/shop-catalog.ts` with tests.
- `38b8882` tertiary Coach hint on `PieceCompletePrompt` (only when nextPiece exists).

Telemetry:
- `061fb89` `shop_buy_tx` + `coach_buy_tx` events with start / success / cancelled / error stages.

Backend security (B1 + B4 closed):
- `c4d8348` server-side chess.js transcript validation in `/api/sign-victory`. Replays SAN, asserts checkmate by playerColor, derives totalMoves server-side.

Docs:
- `54655e5` reviews backfill (monetization audit, red team, UX).
- `1437b41` plans backfill (og-fix, secondary-screen, ux-critical).
- `22ee208` specs backfill.
- `1a21938` `docs/reviews/tx-flows-audit-2026-04-26.md`.

## Credentials rotated today (security)

- Upstash Redis URL + token: new database, new full-access token (after first attempt restricted EVALSHA → fixed via Reset Credentials).
- Supabase service role key: rotated, new value live in Vercel.
- Passport API key (Human Passport / passport.xyz): rotated, new value live.

Smoke confirms all three are operational in production.

## Pending operational items (user-side)

- Delete the old Upstash Redis database if account access is recoverable.
- Run admin tx `ShopUpgradeable.setItem(2, 25000, true)` from the Safe to activate Retry Shield purchases.
- Consider renaming env `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY` if migrated to `sb_secret_*` format (cosmetic).
- If a leak exposure window (date range) becomes known, request SQL audit queries for `analytics_events`, `victories`, `scores`.

## Deferred (explicitly not opened)

- D.2 — Supabase `verified_games` forensic trail (requires schema migration).
- `useMiniPayTransaction` shared hook + `TransactionStatus` component (commit 8 of audit plan).

## Next session

Sprint: **MiniPay Transaction UX Fluidity**.

Goal: make every on-chain action feel like part of the game loop, not a dApp glued on top. Two layers — minimum technical (timeouts already shipped, missing: copy/state normalization for purchases, recovery rules) and experience (intent before wallet, status during, success that closes the moment, safe cancel).

First deliverable: `docs/superpowers/specs/2026-04-26-minipay-transaction-ux-fluidity.md`. Spec only — no implementation until first batch is confirmed.
