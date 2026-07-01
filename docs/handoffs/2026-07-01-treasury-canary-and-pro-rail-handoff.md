# 2026-07-01 — Treasury canary closure + monetization Phase 1 handoff

## What happened this session (in order)

1. **Get Peones Treasury canary — closed out.** Rollback exercise + final
   env/config review both done live (real Preview deploy, real withdrawal,
   real MiniPay purchase). PR #159 merged to `main`
   (`ff2b81fb`). Still disabled-by-default in Production.
2. **Legacy Get Peones + Season Pass → repointed to `ChesscitoTreasury`.**
   Done in Preview and Production, in both Vercel projects (`play` and
   `lite` are separate projects). Along the way, found and fixed a real gap:
   the `production` git branch was 24 commits behind `main` and a dashboard
   "Redeploy" was silently landing in Preview, not Production. Fixed via the
   documented `production` fast-forward process.
3. **MiniPay `eth_signTypedData_v4` confirmed working** on a real device
   (`/dev/permit-probe`). Unblocks a future permit-based Victory NFT mint
   (no separate approve tx) — token support (USDT/USDC/cUSD all implement
   EIP-2612) was already confirmed on-chain.
4. **Full monetization audit** — see
   `docs/product/chesscito-monetization-consolidation-audit-2026-07-01.md`.
   Key finding: a `docs/product/chesscito-training-economy-alpha-decisions-2026-06-05.md`
   plan already decided "TX only for on-chain persistence, everything
   consumable via Peones" — it was only half-shipped (Coach analysis got the
   Peones-spend path, the old Shop-TX credit-pack path was never retired).
5. **Phase 1 of the consolidation, PRO piece — backend done.** Chesscito PRO
   can now be bought via the no-approve treasury rail (same mechanism as
   Season Pass / Get Peones), in parallel with the existing Shop.buyItem
   path. Backend only at the time this doc was first written.
6. **Task 4 (UI wiring) — `/hub`'s `<ProSheet>` → rail, PR #160
   (`69e51bfe`).** See the Task 4 section below for full detail, including
   a scope correction (a third PRO purchase path was found) and a real
   React batching bug caught by TDD.
7. **Follow-up same day: third PRO path unified too, PR #161
   (`ca042fb7`).** `<ExercisesScreen>` had its own separate, fully
   duplicated `<ProSheet>` implementation (still on approve+`buyItem`) —
   unified onto the same `useProSheetState()` hook. `executeProPurchase`
   deleted (zero remaining callers). All three PRO surfaces now share one
   code path, on the rail.
8. **PRO treasury migration applied to hosted Supabase**, confirmed via
   `supabase migration list --linked` (`20260701140000` shows in both
   Local and Remote columns).

## Current state — everything committed, pushed, merged

- Canary + treasury repointing (items 1–4): `main` (`652d2965`).
- Task 4, `/hub` PRO → rail (item 6): `main` (`69e51bfe`, PR #160).
- Third-path unification (item 7): `main` (`ca042fb7`, PR #161).
- The old approve+`buyItem` PRO path (Shop itemId 6, `useShopSheetState`)
  still works unchanged, by design — the rail is additive there, not a
  replacement (per the original Phase 1 scope: keep it working in
  parallel).
- Full test suite: 4609/4609 passing, tsc + eslint clean (was 4597/4597
  before this session's PRO work; net -8 after the third-path unification
  deleted `purchase.test.ts` along with the dead code it tested).
- The `pro_subscriptions` + `consume_pro_treasury_payment` migration
  (`apps/web/supabase/migrations/20260701140000_pro_treasury_payment.sql`)
  is now **live on hosted Supabase** — pushed manually via
  `supabase db push --linked` (there is no CI automation for this, see
  the corrected [[feedback_supabase_workflow]] memory).
- Local Supabase is stopped. Docker is running (was started this session
  to validate the migration; leave running or stop it, either is fine).
- **Not verified:** the actual on-chain leg of the rail (direct transfer
  vs. approve+buyItem, `/api/verify-payment` on the wire) — no funded
  wallet reachable in the coding sandbox this session. Needs a real
  MiniPay/wallet pass before this is "proven" the way the canary/Season
  Pass were.

## Phase 1, Task 4: wire the PRO purchase UI — DONE + merged (PR #160, `69e51bfe`)

Implemented via SDD → TDD → EDD in the same session this doc was written.

**Scope correction found during implementation:** there were actually
*three* PRO purchase paths, not two. `<ProSheet>` at `/hub`
(`useProSheetState`) went on the new rail here. `useShopSheetState`'s
`PRO_ITEM_ID` branch (the `/exercises` Shop sheet, itemId 6, approve +
`buyItem`) stayed untouched, as planned. `<ExercisesScreen>` **also**
had its own separate `<ProSheet>` instance with a local
`handleProPurchase()` calling `executeProPurchase` — out of scope for
this slice, but unified in a same-day follow-up (PR #161, `ca042fb7`):
`<ExercisesScreen>` now uses `useProSheetState()` too, and
`lib/pro/purchase.ts`/`executeProPurchase` is deleted (zero remaining
callers). All three PRO surfaces are on the no-approve rail now.

**New files:**
- `lib/payments/transfer-builder.ts` — added `buildProPackTransfer`
  (mirrors `buildSeasonPassTransfer`).
- `lib/pro/use-pro-rail.ts` — `useProRail`, mirrors `useSeasonPassRail`
  exactly (same phase machine/retry backoff), posts to
  `/api/verify-payment` (already shipped, unchanged).
- `lib/pro/pro-rail-error.ts` — pure `classifyProRailError` mapping rail
  errors to `<ProSheet>`'s *existing* `PRO_COPY.errors.*` strings (no new
  i18n keys).

**Changed:** `lib/pro/use-pro-sheet-state.ts` rewritten to use
`useStablecoinTokenSelection` + `useProRail` instead of the Shop
approve+`buyItem` flow. `ProSheetProps`/`<ProSheet>` itself: **zero
changes** — external contract identical, so `/arena` and
`/profile`'s `useProSheetState()` consumers are unaffected.

**Non-obvious bug found + fixed during TDD:** a manual "retry
verification" that fails with the *same* error reason/txHash as the
original failure can get silently swallowed by React 18's batching —
the effect meant to fire on error-transition never re-runs because its
dependency array looks unchanged between commits. Fixed with an
explicit `attemptToken` counter bumped on every `pay()`/`verifyAgain()`
call, included in the effect's deps. Caught by the "retry still
failing" test, not by inspection.

**Verified:** 4617/4617 tests green, `tsc --noEmit` clean. Browser pass
(Playwright, dev server, Full mode) confirmed `<ProSheet>` renders
correctly at `/hub` and `/exercises`, wallet-connect gate unregressed,
close/reopen has no state leak, zero console errors. **Not verified:**
the actual on-chain leg (direct transfer vs. approve+buyItem,
`/api/verify-payment` vs `/api/verify-pro` on the wire) — no funded
wallet reachable in the coding sandbox. Needs a real MiniPay/wallet
pass before this is "proven" the way the canary/Season Pass were.

**Session closed here 2026-07-01.** `supabase db push --linked` for the
PRO migration is done (confirmed live, see above). Still open for next
session:
1. **Real on-chain verification** of the rail (no funded wallet in this
   session's sandbox) — a real MiniPay/wallet purchase pass, mirroring
   how the canary/Season Pass were proven.
2. **Refresh 4 stale VR baselines** (`hub-clean`, `hub-daily-tactic-open`,
   `hub-shop-sheet-open`, `about-page` — confirmed pre-existing on
   `main`, unrelated to this session's work, found while running the
   required VR pass before pushing).
3. **Phase 1 continuation** (this is "Phase 1" the user means by
   "continuemos"): retire the Shop-TX Coach-pack path (itemId 3/4, no new
   backend needed, Peones already covers it), build the Shield
   Peones-spend backend (doesn't exist yet), then retire Shield's Shop-TX
   path. Founder stays parked (deprioritized per the audit).

## Open decisions, not yet made (not blocking Task 4)

- Whether to eventually retire the canary's separate code path
  (`get-peones-canary*.ts`) now that legacy Get Peones targets the same
  `ChesscitoTreasury` contract — noted in the unification plan, not decided.
- Whether/when to build the gift-able Season Pass idea (buy with your own
  wallet, assign to another wallet later via a claim step) — backlog only.
- Whether to pursue the Victory NFT `mintSignedWithPermit` upgrade (step 3
  of the unification plan) — technically unblocked (permit confirmed on
  MiniPay + on-chain), not started, needs its own spec + red-team review
  before touching the deployed proxy.
- Phase 2 (Peones as central currency, "off-chain twin" for a PRO purchase)
  — explicitly deferred until Phase 1 is fully done across PRO, Shield, and
  Coach packs.

## Key docs to re-read when resuming

- `docs/product/chesscito-monetization-consolidation-audit-2026-07-01.md` —
  the full catalog, grant-mechanism risk map, and the two-phase decision.
- `docs/product/chesscito-treasury-unification-plan-2026-07-01.md` — Shop
  and Victory NFT steps, permit feasibility findings.
- `docs/ops/get-peones-treasury-canary-operational-checklist-2026-06-30.md`
  — canary evidence trail (closed).
- `docs/product/chesscito-training-economy-alpha-decisions-2026-06-05.md` —
  the original Sprint 4 "Compendio TX" decisions this work is completing.

## Gotchas learned this session (also saved to memory)

- `vercel env add/rm` treats a variable as one record spanning
  environments — always target a single environment + branch explicitly,
  verify with `vercel env ls` before/after ([[feedback_vercel_env_scope_atomic]]).
- This project's Production deploys track the `production` git branch, not
  `main` — a dashboard "Redeploy" on a `main`-branch deployment silently
  redeploys to Preview ([[feedback_vercel_production_branch]]). Always
  follow the documented [[release-process]] (fast-forward `production` to
  `main`, push) rather than ad hoc redeploys.
- `vercel env pull` / `env ls` show "Sensitive"-flagged vars as blank even
  when they hold real, working values — verify via real endpoint behavior,
  never trust the CLI dump for "is this configured."
- MiniPay supports `eth_signTypedData_v4`, not just `personal_sign`
  ([[minipay-supports-typed-data-signing]]).
