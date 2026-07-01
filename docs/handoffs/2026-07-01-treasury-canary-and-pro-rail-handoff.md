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
5. **Phase 1 of the consolidation, PRO piece — done.** Chesscito PRO can now
   be bought via the no-approve treasury rail (same mechanism as Season
   Pass / Get Peones), in parallel with the existing Shop.buyItem path.
   Backend only — UI still wired to the old path. See below.

## Current state — safe to leave as-is

- Everything is committed and pushed to `main`. Nothing half-broken. The old
  approve+`buyItem` PRO path (Shop itemId 6) still works unchanged — the new
  rail is additive, not a replacement yet.
- Full test suite: 4597/4597 passing, tsc clean, as of the last commit
  (`652d2965`).
- The new `pro_subscriptions` + `consume_pro_treasury_payment` migration
  (`apps/web/supabase/migrations/20260701140000_pro_treasury_payment.sql`)
  is committed but **not yet applied to hosted Supabase** — it applies via
  the normal deploy/CI flow per [[feedback_supabase_workflow]], not manually.
- Local Supabase is stopped. Docker is running (was started this session to
  validate the migration; leave running or stop it, either is fine).

## Next task — Phase 1, Task 4: wire the PRO purchase UI

**Not started.** This is the next concrete piece of Phase 1
(`docs/product/chesscito-monetization-consolidation-audit-2026-07-01.md`,
"Decision: two phases" section).

What needs to happen:

1. Find the `<ProSheet>` component (per `shop-catalog.ts`'s comment, it's
   "the hero discoverability surface" at `/hub`) and the `PRO_ITEM_ID`
   branch inside `useShopSheetState` (parallel to the `SHIELD_ITEM_ID`
   branch — grep both for context).
2. Switch that flow from approve + `Shop.buyItem` + `POST /api/verify-pro`
   to the same `usePaymentRail`-style single-tx flow already used by
   `GetPeonesSheet` / `SeasonPassSheet`, with `sku: "chesscito_pro_30"`.
   The backend piece for this (`/api/verify-payment` PRO branch) is done
   and tested — this task is UI-only.
3. Keep the Shop `buyItem` PRO path (itemId 6) working in parallel — do not
   remove it in this task. Both paths already compose correctly (shared
   Redis extend logic, see `lib/coach/pro-extend.ts`).
4. Per project convention for UI changes: start the dev server and
   exercise the real purchase flow in a browser (or MiniPay) before calling
   this done — don't just rely on the test suite for a user-facing flow
   change.
5. Once this ships and is proven (mirroring today's real-purchase
   verification pattern for the canary/Season Pass), the natural follow-ups
   are: retire the Shop-TX Coach-pack path (itemId 3/4, no new backend
   needed, Peones already covers it), and build the Shield Peones-spend
   backend (doesn't exist yet — see the audit doc's grant-mechanism risk
   map) before retiring Shield's Shop-TX path. Founder stays parked.

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
