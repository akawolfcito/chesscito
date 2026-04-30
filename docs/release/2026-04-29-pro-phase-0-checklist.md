# Chesscito PRO — Fase 0 Release Checklist

**Date prepared**: 2026-04-29
**Last updated**: 2026-04-29 (post-on-chain registration)
**Target**: Celo Mainnet (chainId 42220)
**Owners**: deployer + admin wallet (multisig if available)

> **Important:** this checklist documents the **launch** steps for
> Chesscito PRO. Local dev defaults remain disabled — nothing in this
> doc changes runtime behavior on `pnpm dev` unless the operator
> explicitly toggles the flags listed below.

## Live status

- ✅ All 10 PRO commits in `origin/main` (`47a9fbc..ddcacde`).
- ✅ On-chain registration done — `ShopUpgradeable.setItem(6, 1_990_000, true)`
  on Celo Mainnet. tx: `0x32c1adb4ebf6a10f13843bf51333e2c09753d797eab83a97ad566cefb074162c`
  (block 65620849). `getItem(6)` confirms `(1990000, true)`.
- ⏳ Vercel: `NEXT_PUBLIC_ENABLE_COACH=true` in Production — pending.
- ⏳ Deploy ready — pending Vercel env.
- ⏳ Smoke test — pending deploy.

---

## 0. Pre-flight verification

- [ ] All Phase 0 commits merged to `main`. Reference list:
  - `feat(editorial): add PRO_COPY for Chesscito PRO Phase 0`
  - `feat(shop): register itemId 6 as Chesscito PRO monthly`
  - `feat(api): add /api/verify-pro endpoint for Chesscito PRO`
  - `feat(pro): add is-active helper`
  - `feat(coach): PRO bypasses credits in analyze`
  - `feat(api): add GET /api/pro/status`
  - `feat(pro): add ProChip + ProSheet + useProStatus`
  - `feat(play-hub): wire PRO chip + sheet + purchase flow`
- [ ] Full test suite passing locally (`pnpm test` → 496/496+).
- [ ] Typecheck clean (`pnpm exec tsc --noEmit`).
- [ ] Visual snapshots reviewed — only the PRO chip is new on `/hub`.

## 1. On-chain configuration (Celo Mainnet)

The Shop contract must publish itemId 6 before the verify-pro flow can
match any purchase. Until this transaction lands, `verify-pro` will
respond `400 "No PRO purchase found in transaction"` for every attempt
and the buy CTA will appear available but verification will fail.

- [x] **`ShopUpgradeable.setItem(6, 1_990_000, true)`** executed by the
      admin wallet on Celo Mainnet — done 2026-04-29.
  - tx: `0x32c1adb4ebf6a10f13843bf51333e2c09753d797eab83a97ad566cefb074162c`
  - block: 65620849
  - signer: `0x917497b64eeB85859edcf2e4ca64059eDfeC1923`
  - method: `pnpm admin shop set-item --item-id 6 --price-usd6 1990000 --enabled true --chain celo`
- [x] Verified by `pnpm admin shop get-item --item-id 6 --chain celo` →
      `(1990000, true)`.

## 2. Vercel environment variables

Configure on the **Production** environment (and **Preview** if
launching to preview first). All values are managed via `vercel env`
or the Vercel dashboard — do not commit real values to the repo.

- [ ] **`NEXT_PUBLIC_ENABLE_COACH=true`** — gates Coach UI surfaces.
      PRO bypasses the Coach credit ledger; without Coach enabled the
      pass has no consumer surface and PRO purchases deliver no
      perceivable value to users.
- [ ] **`COACH_LLM_API_KEY`** — confirm set; required for Coach
      analyses to actually run.
- [ ] **`UPSTASH_REDIS_REST_URL`** + **`UPSTASH_REDIS_REST_TOKEN`** —
      confirm set; PRO writes to `coach:pro:<wallet>` via the same
      Redis used by Coach credits.
- [ ] **`NEXT_PUBLIC_SHOP_ADDRESS`** — confirm matches the deployed
      Shop proxy on Celo Mainnet.

> Local dev: `.env.template` keeps `NEXT_PUBLIC_ENABLE_COACH=false`
> as the default so a fresh checkout does not accidentally surface
> Coach UI before the operator has provisioned the LLM key. Do not
> change this default.

## 3. Smoke test (post-deploy, production URL)

Run with a wallet that holds at least $2 in USDC on Celo and is
connected to chainId 42220.

- [ ] Open `/hub`. The PRO chip renders top-right with "GET PRO"
      label (gold gradient).
- [ ] Tap the chip. ProSheet opens. CTA shows "Get PRO" because the
      wallet has no active pass.
- [ ] Tap "Get PRO". Wallet prompts for USDC `approve` (only on first
      purchase per wallet). Approve.
- [ ] Wallet prompts for `Shop.buyItem(6, 1, USDC)`. Approve.
- [ ] CTA flips through "Processing…" → "Verifying…" → sheet closes.
      Chip re-renders as "PRO • 30d" (purple gradient).
- [ ] Open Coach UI (analyze surface). Run an analysis. Credit balance
      does NOT decrement (PRO bypass active).
- [ ] Reload `/hub`. Chip still shows "PRO • 30d". Status persists.
- [ ] Inspect Redis: `coach:pro:<wallet>` exists, value is a future
      ms-epoch timestamp ~30 days out. `coach:pro:processed-tx:<hash>`
      also exists.

## 4. Rollback plan

If a critical bug surfaces post-launch:

1. **Disable Coach UI**: set `NEXT_PUBLIC_ENABLE_COACH=false` in Vercel
   and redeploy. The PRO chip will still render (it consults
   `useProStatus`, not the Coach flag) but the Coach surface that PRO
   unlocks becomes unreachable. Cosmetic only — already-paid users
   keep their PRO record in Redis.
2. **Disable PRO purchases**: call
   `ShopUpgradeable.setItem(6, 1_990_000, false)` to flip `enabled`
   to `false`. New purchase attempts revert on-chain. Existing PRO
   records continue to honor their TTL until natural expiry. The chip
   itself stays visible — to hide it, ship a follow-up commit that
   gates the chip on a `NEXT_PUBLIC_ENABLE_PRO` flag.
3. **Refund**: PRO is sold for $1.99 via the Shop's standard
   stablecoin flow. Refunds are off-chain at the operator's
   discretion. Treasury holds 80% of receipts; the prize-pool wallet
   holds 20% (via the existing 80/20 split on `Shop.buyItem`).

## 5. Known limitations (Phase 0)

Documented for the on-call rotation:

- **No auto-renewal.** Users must repurchase manually after 30 days.
  No reminder banner in v1 (deferred to Fase 0.1).
- **In-memory rate limit.** `enforceRateLimit` resets on cold starts;
  same constraint as the existing Coach verifier.
- **Verify-failed UX.** If `Shop.buyItem` succeeds but the
  `/api/verify-pro` POST fails (network blip), the user sees
  "Payment confirmed but verification failed; please refresh in a
  minute." `/api/verify-pro` is idempotent on `txHash`, so a refresh
  + sheet reopen will reconcile when the user retries.
- **Game-stat trust.** PRO is an unlock toggle; the existing Coach
  flow's self-reported game stats are not affected by Phase 0. Server
  -side game session proofs are out-of-scope until Fase 1.

## 6. Telemetry (Commit 8 follow-up)

Telemetry hooks are wired as `TODO(commit-8)` comments in:
- `components/pro/pro-chip.tsx` — `pro_card_viewed`
- `components/pro/pro-sheet.tsx` — `pro_card_viewed`, `pro_cta_clicked`
- `components/play-hub/play-hub-root.tsx` — `pro_purchase_started`,
  `pro_purchase_confirmed`, `pro_purchase_failed`
- `app/api/coach/analyze/route.ts` — `coach_pro_bypass_used` (server
  side, optional `console.info` for v1)

Commit 8 will replace these TODOs with `track()` calls into the
existing `/api/telemetry` → Supabase events sink.
