# Real-chain verification runbook — PRO rail + Shield Peones fallback

- **Date:** 2026-07-02
- **Type:** Manual operator runbook (not a spec) — requires a real MiniPay
  wallet with a small amount of USDT on Celo Mainnet. No agent/sandbox can
  execute this (no funded wallet reachable in the coding environment).
- **Why now:** two features shipped and tested locally/in CI but never
  exercised against a real wallet: the PRO no-approve rail (PRs #159-161) and
  the Shield Peones fallback (PR #164). Everything else on the payment rail
  (Get Peones canary, Season Pass) is already proven live — see
  `docs/ops/get-peones-treasury-canary-operational-checklist-2026-06-30.md`
  for the exact evidence pattern this runbook follows.

## 0. Preconditions

- [ ] Confirm `production` branch is caught up to `main`
      (`git log origin/production..origin/main` should be empty). If not,
      follow `docs/release/release-process.md` before testing — otherwise
      you're testing stale code.
- [ ] MiniPay wallet has at least $0.10-$0.50 in USDT on Celo Mainnet
      (USDT is the only token live-accepted end-to-end today).
- [ ] Open `chesscito.com` inside the actual MiniPay app (not a desktop
      browser — the rail depends on the injected MiniPay provider).

## 1. PRO rail — real purchase (pick ONE of the 3 surfaces, any is equivalent)

**Trigger is the floating "PRO" chip** (`components/pro/pro-chip.tsx`, top-right
in `/hub`, also present in `/exercises` and `/profile`) — NOT the Shop's own
PRO tile. The Shop tile (itemId 6, approve+`buyItem`) is a separate legacy
path kept alive in parallel by design; tapping it would test the *old* rail,
not the one that needs verification.

All three chip-triggered surfaces share `useProSheetState()` → `useProRail()`,
so one real pass covers the shared code path.

Confirmed from code (no new deploy/config needed):
- `useProRail` reuses `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` /
  `CHESSCITO_TREASURY_ADDRESS`, the same vars already live in Production
  since Season Pass + legacy Get Peones were repointed to `ChesscitoTreasury`
  (2026-07-01). No new env var to add.
- Same treasury contract (`0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`),
  already deployed, verified, and custody-tested. No contract deploy needed.
- Same `/api/verify-payment` endpoint Season Pass already uses in Production.
- SKU `chesscito_pro_30` ($1.99/30d) already declared in `rail-config.ts`.

1. [ ] Open `/hub`, tap the floating **PRO chip** (not the Shop tile) to open `<ProSheet>`.
2. [ ] Select USDT, confirm the price shown ($1.99/30d).
3. [ ] Complete the real signed transfer in MiniPay.
4. [ ] Record: tx hash, before/after USDT balance in the wallet, before/after
       PRO status in-app (`/api/verify-payment` should flip `isProActive`).
5. [ ] Confirm no double-charge: reload `/hub`, verify PRO state persists
       without re-prompting payment.
6. [ ] Spot check `/exercises` and `/profile` show PRO as active too (same
       entitlement, no separate purchase needed).

**Pass criteria:** exactly one on-chain transfer of $1.99 USDT to
`ChesscitoTreasury` (`0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`), PRO active
in-app immediately after, persists across reload and across all 3 surfaces.

## 2. Shield Peones fallback — real rescue at 0 shields

This path does NOT need on-chain funds by itself (Peones is an off-chain
ledger) — but it's the other half of "not yet exercised for real" from the
handoff, and the critical `attemptSeq` bug fix (PR #164) has zero test
coverage on the actual mounted component. Do this pass regardless of wallet
funding.

**Fixed 2026-07-02, before this pass was even possible:** the rescue modal's
variant D (0 shields, welcome pack already claimed) had its primary CTA
wired to `onGetShields`, which deep-linked to the Shop — but Shield's Shop-TX
SKU was retired in PR #164, so that button opened an empty Shop with no
shield item. The Peones-fallback code (`attemptShieldSpendWithPeones`) was
fully implemented and unit-tested but **unreachable from the real UI** at a
genuine 0-shield balance. Fixed by rewiring variant D's primary CTA to
`onUseShield` (same handler as A/B; the 409 it gets back at 0 balance is what
triggers the existing fallback branch) and updating the copy: button now
reads "Use Peones" with a "2 Peones" cost pill (was "Get Shields"). See
`editorial.ts`/`messages/es.ts` `RESCUE_MODAL_COPY`, `fail-rescue-modal.tsx`,
`use-fail-rescue.ts`. 4560/4560 tests passing, tsc clean. This is now
actually reachable through the steps below.

1. [ ] Get your Peones balance to at least 2 (spend down or use existing
       balance; a real Get Peones purchase also works if you want to chain
       it with step 1's wallet).
2. [ ] In `/exercises`, deplete shields to 0 (fail exercises until no
       shields remain, or check current balance in HUD).
3. [ ] Fail an exercise attempt with 0 shields and the welcome pack already
       claimed — the rescue modal's primary button should read **"Use
       Peones"** with a **"2 Peones"** pill (not "Get Shields").
4. [ ] Confirm the rescue happens (board resets, streak preserved) and
       Peones balance decrements by exactly 2.
5. [ ] **Idempotency check (this is what the Critical bug was about):**
       trigger a second rescue on a *different* exercise attempt right
       after. Confirm it charges 2 Peones again — NOT a free rescue. This
       is the exact scenario the `attemptSeq` fix targeted (same/reset
       identity silently degrading into a free rescue).
6. [ ] Retry the same failed attempt twice quickly (double-tap simulation).
       Confirm only one charge happens (guarded against double-spend).

**Pass criteria:** every real rescue at 0 shields charges exactly 2 Peones,
no free rescues, no double-charges, across at least 2 consecutive rescues.

## 3. Evidence to record (mirrors the canary checklist format)

For each of the two flows above, capture:
- Before/after balance (USDT for PRO, Peones for Shield).
- Screenshot or tx hash where applicable.
- Any error surfaced in-app (should be none on the happy path).

## Evidence — 2026-07-02 (PRO rail)

**First real end-to-end PRO purchase — MiniPay, 2026-07-02.** Operator
completed a real `chesscito_pro_30` purchase ($1.99 → 30d PRO) through the
actual product UI in MiniPay (PRO chip → `<ProSheet>` → `useProRail` →
`/api/verify-payment`), against the same `ChesscitoTreasury`
(`0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`) used by the Get Peones canary
and Season Pass.

- On-chain: confirmed the transfer landed at the expected treasury address,
  USDT, operator-confirmed amount $1.99 exact (matches `chesscito_pro_30`'s
  `priceUsd6: 1_990_000n`, no discrepancy).
- Product-side: PRO activated in-app immediately after verification and
  persisted across a reload (`isProActive` correctly read back), confirming
  `/api/verify-payment` → entitlement write → subsequent read are consistent.
- No new env var, no new contract deploy was needed, as predicted from
  code inspection (`rail-config.ts` reuses the Season Pass treasury config;
  same `/api/verify-payment` endpoint).

**Still open on PRO rail:** cross-surface persistence check (`/exercises`
and `/profile` both showing PRO active from this same purchase, no
re-purchase prompt) — step 6 in section 1 above, not yet explicitly
confirmed by the operator.

Section 1 (PRO rail) is otherwise **closed**. Section 2 (Shield Peones
fallback rescue) remains open.

Append results to this file under a new "Evidence — <date>" section, same
convention as `get-peones-treasury-canary-operational-checklist-2026-06-30.md`.

## Out of scope for this pass

- Coach (1 Peón/analysis) — same off-chain Peones mechanism as Shield,
  already shipped longer ago, not flagged as unverified in the latest
  handoff. Worth a quick manual spot-check but not blocking.
- VR baselines (`hub-shop-sheet-open` and 3 others) — environmental
  sandbox limitation, needs a real dev machine/CI run, unrelated to
  wallet funding. Separate task.
