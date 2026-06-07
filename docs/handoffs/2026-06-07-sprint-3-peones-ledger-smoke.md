# Sprint 3 — Peones Ledger — Smoke + Handoff

**Date:** 2026-06-07
**Range:** `856cfa77..2c807487` (10 commits)
**Status:** Code complete on `main`. Migration NOT applied to hosted Supabase. Production held until Sprint 4 retrospective.

---

## 1. Resumen Sprint 3

What landed in code (none of it is "live" until the migration is applied on hosted Supabase):

- **Ledger schema** — `peones_ledger` table append-only, `peones_balances` view, `peones_balance_with_caps` function. SQL CHECKs on `amount > 0` + wallet regex + event_type + source enum. RLS denies client writes and gates reads on `request.jwt.claims.wallet`.
- **Service helpers (pure)** — `normalizeWallet`, `computeLedgerBalance`, `applyDailyCap`, `isDailyCapSource`, 3 idempotency-key builders, `buildAttestationHash`. Zero DB / endpoint / UI coupling.
- **`GET /api/peones/balance`** — read-only, normalises wallet, calls the SQL function + the view, maps to a fixed shape. 400/429/500 contract per calibration §5.1.
- **`POST /api/peones/earn`** — append-only INSERT. Idempotent on `idempotency_key` (DB unique constraint + endpoint pre-check + 23505 race fallback). Daily cap truncation via `applyDailyCap`. Zero-credit branch never inserts.
- **Daily Tactic earn wireup** — `hub-daily-tile.tsx` + `daily-tactic-slot.tsx` POST after solve, response drives the sheet's reward block. Daily completion + streak persist regardless of earn outcome.
- **Training stars delta earn wireup** — `useExerciseProgress.completeExercise` fires earn when `delta > 0 && connected && address`. Fire-and-forget; local progress + persistence + telemetry unaffected by failure.
- **HUD chip minimal** — `PeonesBalanceChip` mounted in `hub-scaffold.tsx`. Guest hidden, success shows `N Peones`, error shows `Peones --`. Read-only.
- **Telemetry live** — `peones_earned`, `peones_cap_reached`, `peones_balance_viewed` with per-component dedup refs. `rewardPreviewPeones` marked `@deprecated`.

What did NOT change:

- No spend endpoint. No top-up. No pack purchase. No stablecoin / payment rails. Coach credits (`coach:credits:{wallet}` in Redis) untouched. PRO sub + Founder + VictoryNFT untouched. Shop unchanged.

---

## 2. Commits Sprint 3

| # | SHA | Title |
|:--:|---|---|
| 1 | `856cfa77` | docs(product): Sprint 3 Peones ledger calibration |
| 2 | `4b09f4ae` | feat(peones): add Supabase ledger schema |
| 3 | `c8ddac91` | feat(peones): add ledger service pure functions |
| 4 | `9e384a47` | docs(product): stablecoin payment rails research for MiniPay/Celo |
| 5 | `d551397c` | feat(peones): GET /api/peones/balance |
| 6 | `74b11a86` | feat(peones): POST /api/peones/earn with idempotency + cap |
| 7 | `aac38fe1` | feat(peones): wire Daily Tactic earn real |
| 8 | `ffe29480` | feat(peones): wire Training stars delta earn real |
| 9 | `4a556802` | feat(peones): HUD balance chip minimal |
| 10 | `2c807487` | feat(telemetry): peones_earned + peones_cap_reached + peones_balance_viewed live |

---

## 3. Smoke manual esperado (pre-migration on hosted Supabase)

What CAN be exercised today without applying the migration:

- **Daily Tactic completion** still works end to end. Sheet opens, board interactive, solve fires `onSolve(movesUsed)`, streak telemetry emits.
- **Daily streak** persists in `chesscito:daily-progress` localStorage. No regression.
- **Training exercise completion** still works. Stars persist in `chesscito:progress:{piece}`. All Sprint 1 `training_*` events still fire.
- **HUD chip on `/hub`** mounts without breaking layout. Connected wallets see the chip; guests see no chip.
- **Pre-migration chip state.** The chip renders `Peones --` for connected wallets because `/api/peones/balance` returns 500. This is the documented fallback; no banner, no modal.
- **Daily reward block on the sheet.** Connected user solves → sheet shows `Saving Peones…` briefly → settles on `Daily solved. Peones could not be saved right now.` because the earn endpoint returns 500. Daily completion + streak still landed.
- **No real Peones balance is visible anywhere** until the migration ships.
- **No spend, no top-up, no payment UI** anywhere.

Telemetry observable when `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY=1`:

- `daily_tactic_started`, `daily_tactic_completed` (with `peonesEarned: 0` because earn failed), `daily_streak_updated`, `training_exercise_*` events as in Sprint 2.
- **No `peones_earned`** — gated behind successful earn, which fails pre-migration.
- **No `peones_cap_reached`** — same.
- **No `peones_balance_viewed`** — chip never enters success state pre-migration.

---

## 4. Caveat pre-migration (read carefully before promote)

- The SQL migration `apps/web/supabase/migrations/20260607000000_peones_ledger_init.sql` is COMMITTED in this repo but NOT applied to any hosted Supabase environment.
- Because the table / view / function don't exist on hosted yet:
  - `GET /api/peones/balance` returns **500 `ledger_unavailable`** for every connected wallet.
  - `POST /api/peones/earn` returns **500 `ledger_unavailable`** for every attempt.
  - Daily Tactic sheet shows **`Daily solved. Peones could not be saved right now.`** on every connected solve.
  - Training earn silently swallows the rejected promise. Progress + telemetry unaffected.
  - HUD chip shows **`Peones --`** for connected wallets.
- This is **EXPECTED** and **NON-BLOCKING** for `main` deployment. Production must NOT be promoted until the migration is applied AND a real smoke is executed against the hosted environment. See §6.

---

## 5. Checklist antes de push (verified before commit I)

- [x] TypeScript noEmit: clean
- [x] Full vitest `--max-workers=2`: **2848/2848 ✅** in 89s
- [x] No localStorage Peones key written anywhere in any code path
- [x] No spend endpoint exists in this branch
- [x] No stablecoin / payment-rails code touched in this branch
- [x] Coach credits (`coach:credits:{wallet}`) untouched in Redis layer
- [x] PRO / Founder / VictoryNFT / Shop untouched
- [x] Production branch (`origin/production`) remains on its previous SHA — this push does NOT advance it

---

## 6. Checklist antes de production promote

Mandatory sequence. DO NOT skip steps:

1. Apply migration `20260607000000_peones_ledger_init.sql` on the hosted Supabase environment (staging first if it exists, then production).
2. Verify the `peones_ledger` table exists with all columns + indices + the wallet regex check.
3. Verify the `peones_balances` view returns rows for any pre-existing wallets (should return zero rows initially).
4. Verify the `peones_balance_with_caps(wallet, day_utc)` function exists and returns `(0, 0, 10)` for a fresh wallet.
5. Verify RLS policies are active and block direct client writes.
6. Smoke `GET /api/peones/balance?wallet=0x...` for an empty wallet → expect `{ balance: 0, dailyEarnedCapped: 0, dailyCap: 10, lastEventAt: null }`.
7. Smoke `POST /api/peones/earn` with `source: "daily_tactic"`, `amount: 3`, valid idempotency key → expect `200` with `credited: 3`.
8. Smoke idempotency: repeat the same POST → expect `200` with `duplicate: true`.
9. Smoke partial cap: drive the wallet to 8 earned on the day, then attempt amount 3 → expect `credited: 2, capReached: true`.
10. Smoke cap exhausted: attempt another earn → expect `credited: 0, capReached: true`, no new row.
11. Smoke Daily Tactic in MiniPay viewport connected → reward block shows `+N Peones` not the failure copy.
12. Smoke Training: complete an exercise with delta > 0 → ledger row appears.
13. Smoke HUD chip → shows the actual numeric balance, not `Peones --`.
14. Verify telemetry `peones_earned`, `peones_cap_reached`, `peones_balance_viewed` arrive at the analytics sink with the expected shape.
15. Only then consider promoting `origin/main` → `origin/production`.

---

## 7. Carry-overs Sprint 4

The Sprint 4 calibration doc will detail these; capture so they don't drop:

- **Spend endpoint** (`POST /api/peones/spend`). The endpoint contract is already declared in calibration §5.3 / TS types are reserved in commit B.
- **Compendio TX** matrix from the training engagement direction doc (Coach analysis, hints, retries, save_game, labyrinth keys).
- **Coach analysis paid with Peones** — requires the convergence decision (Coach Redis credits vs Supabase Peones).
- **PRO bypass matrix** — which surfaces flip to "no Peones spend if PRO" semantics.
- **Stablecoin pack purchase cluster** — see the MiniPay/Celo research §A in the Sprint 3 calibration doc. Pattern P1 (single-tx ERC20.transfer + feeCurrency=USDm) is the documented direction; real-device smoke covering B1-B6 is required before ship.
- **Hosted migration apply process** — codify the deploy step so future migrations don't drift the same way.
- **SIWC (Sign-In With Celo) decision** — Sprint 3 ships with "trust-but-rate-limit" (calibration §4.3 Option A). Sprint 4 reviews whether the cap diario + rate-limit are enough or whether SIWC is needed.
- **Coach credits vs Peones convergence** — product decision: do `coach:credits:{wallet}` Redis counters get migrated into the Peones ledger, or do they coexist permanently?
- **HUD chip mounts on remaining surfaces** — `/exercises`, `/coach`, `/arena`. Each one needs its own visual decision (header chip vs floating chip vs collapse-into-existing-HUD).
- **`rewardPreviewPeones` deprecation removal** — the field is marked `@deprecated` in `lib/daily/telemetry.ts`. Sprint 4 removes after confirming dashboards have migrated to `peonesEarned`.

---

## 8. Branch state

- `main` is 10 commits ahead of `origin/main` at the time of this commit; commit I will push these to `origin/main` if Wolfcito greenlights.
- `origin/production` does NOT advance with this push.
- Range to push: `856cfa77..<commit-I-sha>`.

## Cross-references

- **Calibration:** `docs/product/chesscito-sprint-3-peones-ledger-calibration-2026-06-07.md`
- **Engagement direction:** `docs/product/chesscito-training-engagement-direction-2026-06-05.md`
- **Sprint 2 closure:** `docs/handoffs/2026-06-06-sprint-2-daily-tactic-smoke.md`
- **Sprint 1 closure:** `docs/handoffs/2026-06-06-sprint-1-training-economy-alpha-smoke.md`
- **Migration SQL:** `apps/web/supabase/migrations/20260607000000_peones_ledger_init.sql`
- **Service helpers:** `apps/web/src/lib/peones/ledger-service.ts`
- **GET balance endpoint:** `apps/web/src/app/api/peones/balance/route.ts`
- **POST earn endpoint:** `apps/web/src/app/api/peones/earn/route.ts`
- **HUD chip:** `apps/web/src/components/peones/peones-balance-chip.tsx`
- **Telemetry module:** `apps/web/src/lib/peones/telemetry.ts`
