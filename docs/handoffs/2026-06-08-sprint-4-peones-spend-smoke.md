# Sprint 4 — Peones Spend handoff + smoke

**Date**: 2026-06-08 · **Owner**: John (PM) · **Branch**: `main`
**Status**: All commits merged. Hosted apply + wallet-connected smoke pending. Production HOLD.

> Calibration: `docs/product/chesscito-sprint-4-peones-spend-compendio-tx-calibration-2026-06-08.md`
> Sprint 3 handoff: `docs/handoffs/2026-06-07-sprint-3-peones-ledger-smoke.md`

## 1. Sprint 4 — what shipped

- **Atomic spend RPC** `peones_spend` (migration `20260608000000_peones_spend_rpc.sql`). Order: idempotency → PRO bypass → balance check (when debited>0, `FOR UPDATE` lock) → append-only insert. `pro_bypass` column + balance view exclusion shipped here too.
- **`POST /api/peones/spend`** — validation pipeline + RPC wire-up. Server-trusted costs (coach 1, hint 1, retry 2, save_game 1). Metadata whitelist (6 keys, primitives only). Idempotency prefix-locked to target.
- **`submitPeonesSpend` client helper** — discriminated result union (`success | insufficient_balance | error`). Never throws, never touches localStorage, never mutates global balance.
- **Spend telemetry** (consumer-emit pattern):
  - `peones_spent` — debited>0 path
  - `peones_spend_blocked` — insufficient_balance
  - `peones_spend_failed` — technical error (network/bad_response/ledger_write_failed/...)
  - `peones_spend_bypassed` — PRO bypass applied (debited=0 + quota fields)
- **Hint surface** in piece exercises (`PeonesHintButton`). idempotencyKey `spend:hint:{wallet}:{piece}:{exerciseId}:{attemptSeq}`. attemptSeq hard-coded to 1 (retry tracking lights later). Reveal banner with generic textual hint.
- **Coach integration** — `attemptCoachSpendWithPeones` orchestrator + `useCoachAnalysis` hook insertion + `/api/coach/analyze` server-side `peonesIdempotencyKey` verification. Final order Redis → PRO → Peones → Upsell.
- **PRO bypass resolver** — `resolveProBypass(wallet, target)` reuses `isProActive` (single source of truth) + counts daily ledger rows with `pro_bypass=true` via partial index. Per-target quotas (coach 5, hint 20, retry 10, save_game unlimited).
- **Daily quota tracking** — derived from ledger. Zero parallel storage. Surface `quotaUsed/quotaLimit` in spend response for telemetry.

### Explicitly OUT of Sprint 4 (deferred)

- ❌ Retry surface (own commit, post-handoff)
- ❌ Save game surface (own commit, post-handoff)
- ❌ Labyrinth key (Sprint 5)
- ❌ Peones packs / top-up (Sprint 5+)
- ❌ Stablecoin direct payment for micro-actions (cluster separado, NEVER per calibration)
- ❌ Redis Coach credits → Peones migration (Sprint 6+, opt-in)
- ❌ Hosted migration apply (this handoff is the gate)

## 2. Commits Sprint 4

| SHA | Slice | Summary |
|---|---|---|
| `f4461207` | **B** SQL migration | pro_bypass column + balance view exclusion + peones_spend RPC + schema-sync guard test |
| `2ee98ab0` | **C** Spend endpoint | POST /api/peones/spend + spend-service helpers + 29 tests |
| `0f8fb2b4` | **D** Client helper + telemetry | submitPeonesSpend + 3 emitters (spent/blocked/failed) + 28 tests |
| `aabdc9a9` | **E** Hint surface | PeonesHintButton + EN/ES i18n + mount in exercises-screen + 10 tests + hub-clean baseline refresh |
| `e8fa2812` | **F** Coach integration | attemptCoachSpendWithPeones + hook insertion + analyze server verification + 18 tests |
| `d11e2b0a` | **G** PRO bypass + quota | resolveProBypass + endpoint integration + peones_spend_bypassed emitter + 23 tests |
| _(this commit)_ | **H** Smoke + handoff | this doc, no code |

Sprint 4 commit A was the calibration doc shipped earlier with B; see calibration doc footer.

## 3. Smoke técnico esperado (hosted Supabase)

Apply migration first:
```
cd apps/web && supabase db push
```

Then via `apps/web/scripts/peones-smoke.mjs` (extend with spend cases) or manual psql:

- [ ] `peones_spend(wallet, 1, 'hint', 'rook:r-1:1', 'spend:hint:...', sha, '{}', false)` with balance>0 → row inserted, balance decremented by 1
- [ ] Same call repeated → returns `duplicate=true`, balance NOT decremented again
- [ ] `peones_spend(..., 999, ...)` with balance<999 → raises `insufficient_balance` (P0001)
- [ ] `peones_spend(..., 1, 'coach', ..., true)` (bypass) → row inserted with `pro_bypass=true`, balance NOT decremented
- [ ] `SELECT balance FROM peones_balances WHERE wallet=...` reflects spends BUT excludes pro_bypass rows
- [ ] `POST /api/peones/spend` 200 happy path
- [ ] `POST /api/peones/spend` 409 insufficient_balance with low balance
- [ ] `POST /api/peones/spend` 200 `duplicate:true` on retry
- [ ] `POST /api/peones/spend` 200 `proBypassApplied:true` with PRO wallet
- [ ] Metadata whitelist: send `{ secret: "x", gameId: "g-1" }` → only `gameId` persists in ledger row
- [ ] Client body `applyProBypass: true` IGNORED for free user (response `proBypassApplied:false`)

## 4. Smoke UI esperado (preview, wallet conectada)

Pre-req: wallet conectada vía MiniPay o MetaMask en preview deploy.

- [ ] Earn ≥3 Peones desde Daily Tactic (`/hub`) o Training delta
- [ ] HUD chip muestra `N Peones` con sprite pawn
- [ ] Navegar a `/exercises` → seleccionar Rook
- [ ] Botón `Hint · 1 Peón` visible debajo del board
- [ ] Tap el botón → estado loading → reveal banner `Hint unlocked` + `Try moving closer to the target.`
- [ ] Refrescar `/hub` → balance bajó 1 Peón
- [ ] Gastar todos los Peones, intentar Hint con saldo=0 → sublabel `Not enough Peones` aparece; hint NO se revela
- [ ] Desconectar wallet → chip muted `Connect to use Peones hints` aparece en el lugar del botón
- [ ] El ejercicio sigue funcionando (selección de casilla + movimiento + estrella) en todos los estados

## 5. Smoke Coach esperado

Pre-req: tres wallets distintas o reseteo de Redis entre casos.

1. **Wallet con Redis Coach credits (`coach:credits:wallet` ≥ 1)**
   - [ ] Tap Ask Coach → análisis arranca
   - [ ] NO se llama `/api/peones/spend`
   - [ ] Redis credit baja en 1
   - [ ] Peones balance INTACTO

2. **Wallet PRO sin Redis credits (`coach:pro:wallet` válido, `coach:credits:wallet` = 0)**
   - [ ] Tap Ask Coach → análisis arranca
   - [ ] `/api/peones/spend` llamado con `p_apply_pro_bypass: true` (resolución server-side)
   - [ ] Row ledger nueva con `pro_bypass=true`, `amount=1`, `event_type='spend'`, `source='coach'`
   - [ ] Peones balance INTACTO (view excluye bypass row)
   - [ ] `peones_spend_bypassed` evento emitido con `quotaUsed=1, quotaLimit=5`

3. **Wallet free sin Redis credits, con Peones ≥ 1**
   - [ ] Tap Ask Coach → análisis arranca
   - [ ] `/api/peones/spend` llamado con `p_apply_pro_bypass: false`
   - [ ] Row ledger con `pro_bypass=false`, `debited=1`
   - [ ] Peones balance bajó 1
   - [ ] `peones_spent` evento emitido con `debited:1`

4. **Wallet free sin Redis credits, Peones = 0**
   - [ ] Tap Ask Coach → NO arranca análisis
   - [ ] Phase = `paywall` (UI existente)
   - [ ] `peones_spend_blocked` evento emitido con `reason: "insufficient_balance"`
   - [ ] `/api/coach/analyze` NO llamado

## 6. Telemetry smoke

Con `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY=1`:

- [ ] `peones_spent` aparece SOLO cuando `debited > 0`
- [ ] `peones_spend_bypassed` aparece cuando `proBypassApplied=true` (mutual exclusivo con spent)
- [ ] `peones_spend_blocked` aparece en 409 insufficient_balance
- [ ] `peones_spend_failed` aparece en error técnico (corta wallet provider, observa)
- [ ] NUNCA dos eventos simultáneos para el mismo spend
- [ ] `peones_spent` jamás emite con `debited: 0`

## 7. Caveats

- **Retry y Save game**: definidos en calibration §3 + RPC los soporta, pero NO hay UI surface. Commits separados post-handoff.
- **Labyrinth key**: reservado Sprint 5 (depende del Daily Labyrinth Challenge en rotation v0.1).
- **Peones packs / top-up**: Sprint 5+. Endpoint y RPC pueden quedarse igual; agregar `pack_purchase` source ya está en types (reservado desde Sprint 3).
- **Stablecoin direct payment**: cluster separado. NUNCA para microacciones (CIP-64 + signing por hint sería tóxico — calibration §2).
- **Coach credits Redis**: conviven con Peones (Opción C transición). Sprint 6+ migration con opt-in y rate fijo.
- **Production sigue en HOLD** hasta smoke completo y hosted apply verde.
- **Hosted migration NO aplicada** desde ningún commit Sprint 4. Hacer push manual con `supabase db push` desde `apps/web/`.

## 8. Checklist antes de push (autocomplete por agente al final del cluster)

- [x] TypeScript clean (`pnpm tsc --noEmit` sin output)
- [x] Full vitest `--max-workers=2` green (**2967/2967** post-G)
- [x] VR status documentado (commit E refreshed hub-clean; commits B/C/D/F/G no VR — server-only / logic-only)
- [x] No localStorage Peones (helper + chip + hint button: cero touch)
- [x] No top-up / payment rails / Shop / PRO purchase / VictoryNFT modificados
- [x] `origin/production` NO avanza (`ba416b9a` desde 2026-06-05; verificar antes de cada push)

## 9. Checklist antes de production promote

1. [ ] **Apply migration Sprint 4** en hosted Supabase
   - `cd apps/web && supabase db push` (verificar dry-run primero)
   - Confirmar `peones_ledger.pro_bypass` existe + RPC `peones_spend` registrado
2. [ ] **Smoke RPC real** (psql contra hosted, 5 casos §3)
3. [ ] **Smoke endpoint real** (curl o script, 6 casos §3)
4. [ ] **Smoke Hint** (preview wallet-connected, §4)
5. [ ] **Smoke Coach Redis path** (§5 caso 1)
6. [ ] **Smoke Coach PRO bypass** (§5 caso 2 + ledger row inspection)
7. [ ] **Smoke Coach Peones path** (§5 caso 3)
8. [ ] **Smoke Coach insufficient path** (§5 caso 4)
9. [ ] **Verificar telemetry** (Network panel + dashboard, §6)
10. [ ] **Confirmar no regresión Daily/Training earn** (Sprint 3 paths intactos)
11. [ ] **Confirmar no regresión Arena/VictoryNFT/Shop/PRO purchase** (out-of-scope intacto)
12. [ ] Solo entonces: considerar promote `main` → `production`

## Open questions

1. ¿Quién corre el hosted apply? Wolfcito o queda para la próxima sesión.
2. ¿`peones_smoke.mjs` se extiende para cubrir spend, o se crea `peones-spend-smoke.mjs` paralelo?
3. ¿Sprint 5 arranca con Retry surface o con Labyrinth key + Daily Labyrinth Challenge?
