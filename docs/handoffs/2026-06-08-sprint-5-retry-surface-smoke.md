# Sprint 5 — Retry surface handoff + smoke

**Date**: 2026-06-08 · **Owner**: John (PM) · **Branch**: `main`
**Status**: All commits merged. Smoke validation pending (manual, wallet-connected). Production HOLD until smoke green.

> Calibration: `docs/product/chesscito-sprint-5-retry-surface-calibration-2026-06-08.md`
> Sprint 4 handoff: `docs/handoffs/2026-06-08-sprint-4-peones-spend-smoke.md`

## 1. What shipped

- **`attemptSeq` real** en `useExerciseProgress` (commit B). Inicia en 1, resetea a 1 al cambiar `currentExercise.id`, expone `incrementAttemptSeq` + `resetAttemptSeq` callbacks useCallback-estables.
- **`PeonesRetryButton`** (commit C). Mirrors `PeonesHintButton` morphing-chip pattern. Sky-blue palette para diferenciar del Hint dorado-warm. Cost server-trusted `2 Peones`. Idempotency key `spend:retry:{wallet}:{piece}:{exerciseId}:{attemptSeq}`. Metadata whitelist-compliant con `surface: "result_overlay"`.
- **Retry mount + reset wire-up** (commit D). Mounted en `floatingActionSlot` durante `phase === "failure"` (mutuamente exclusivo con Hint). Reusa `resetBoard()` existente (preserva bestStars/badge/progress).
- **`useRetryGuard`** (commit D + F). Dedup callback que garantiza UNA transición por `attemptSeq` (no double-tap, no duplicate-fire, no re-render fire).
- **Hint consume `attemptSeq` real** (commit E). Eliminado el hardcoded `1`. Hint en attempt N+1 post-Retry usa fresh idempotency key → fresh debit posible.
- **`training_retry_completed` telemetry** (commit F). Fires INSIDE el dedup gate, garantiza match 1:1 con reset reales.

### Explicitly OUT of Sprint 5 (deferred)

- ❌ Undo move (cluster propio Sprint 6+ — diferente product semantic vs Retry)
- ❌ Save game surface (cluster propio)
- ❌ Daily Labyrinth Challenge (Sprint 6+ post-rotation v0.2)
- ❌ Labyrinth key spend (Sprint 6+)
- ❌ Peones packs / top-up (stablecoin cluster)
- ❌ Stablecoin direct payment (NEVER para microacciones)
- ❌ Retry visible durante ejercicio activo (descartado §6, Sprint 6+ si métrica lo justifica)
- ❌ Hosted migration apply — Sprint 5 NO requiere migration (cero schema change)

## 2. Commits Sprint 5

| SHA | Slice | Summary |
|---|---|---|
| `baf9299a` | **A + B** | Calibration doc + `attemptSeq` state passive en useExerciseProgress (+7 tests) |
| `5f9d682b` | **C** | `PeonesRetryButton` component aislado + EN/ES copy + 11 tests |
| `dc8059b4` | **D** | `useRetryGuard` helper + wire-up exercises-screen failure-phase + 5 tests |
| `a09e7492` | **E** | Hint consume `attemptSeq` real (swap hardcoded 1) + 2 tests |
| _(este commit)_ | **F** | `training_retry_completed` telemetry + 5 onApplied tests + handoff |

Total Sprint 5: **30 nuevos tests**. Full suite 3024 → 3054.

## 3. Smoke manual esperado (preview, wallet conectada)

Pre-req: wallet conectada con balance ≥ 3 Peones (Daily Tactic earn o welcome pack seed).

### Happy path Retry + Hint loop

- [ ] Ir a `/exercises` con wallet conectada
- [ ] Verificar saldo Peones ≥ 3 en HUD
- [ ] Tap pieza, intentar resolver, fallar deliberadamente (mover en exceso o salir del target)
- [ ] Verificar phase → "failure" (PhaseFlash rojo o similar)
- [ ] Ver chip `Retry · 2 Peones` en bottom-right del board zone
- [ ] Tap el chip
- [ ] Network panel: `POST /api/peones/spend` con `target: "retry", amount: 2, idempotencyKey: spend:retry:...:1`
- [ ] Response 200 con `debited: 2, newBalance: <bajo en 2>, duplicate: false`
- [ ] Visual: board vuelve a estado fresh (pieza en startPos, moves=0, sin selección, sin highlight)
- [ ] Phase = "ready"
- [ ] HUD Peones balance refleja −2
- [ ] Console (si `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY=1`): eventos `peones_spent` + `training_retry_completed`
- [ ] Tap pieza otra vez → tap Hint
- [ ] Network: `POST /api/peones/spend` con `target: "hint", idempotencyKey: spend:hint:...:2` (attemptSeq=2)
- [ ] Response: `debited: 1, duplicate: false` (fresh debit, NO duplicate)
- [ ] Hint glow aparece en cell del optimal first move
- [ ] HUD balance −1 adicional

### Idempotency + dedup guard

- [ ] Volver a fallar el mismo ejercicio
- [ ] Doble-tap rápido en Retry chip (2 taps en < 200ms)
- [ ] Network: solo UN `POST /api/peones/spend` debería materializarse (segundo tap es bloqueado por `state.kind === "loading"` o por la captura de pointer)
- [ ] Si por timing un segundo POST sí sale: response `duplicate: true` con misma `ledgerId`
- [ ] Visual: reset board UNA vez, attemptSeq avanza UNA vez (no de N a N+2)
- [ ] `training_retry_completed` evento emitido UNA vez

### Insufficient balance

- [ ] Gastar Peones hasta saldo < 2 (Hint × 3 + Coach Peones path si aplica)
- [ ] Fallar ejercicio para llegar a phase = failure
- [ ] Tap Retry chip
- [ ] Chip morpea a "Not enough Peones" durante 2.5s
- [ ] Después vuelve a "Retry · 2 Peones" (idle)
- [ ] Board NO resetea, phase sigue en failure
- [ ] HUD balance sin cambio
- [ ] Console: `peones_spend_blocked` con `reason: "insufficient_balance"`, NO `training_retry_completed`

### Technical error

- [ ] Network panel: simular error desconectando wifi un momento antes de tap Retry
- [ ] Tap Retry
- [ ] Chip morpea a "Retry unavailable" durante 2.5s
- [ ] Board NO resetea
- [ ] Console: `peones_spend_failed` con `reason: "network"` o similar, NO `training_retry_completed`

### Guest

- [ ] Desconectar wallet
- [ ] Ir a `/exercises`, fallar ejercicio
- [ ] Ver chip muted "Connect to use Peones retries" en floating slot
- [ ] Tap chip → NO network call
- [ ] Console: cero eventos Peones

### Progress / badge preservation

- [ ] Wallet con ≥1 estrella en rook-1
- [ ] Tap rook-1, llegar a phase=failure, tap Retry
- [ ] Stars en HUD pre-Retry y post-Retry: idénticas
- [ ] bestStars persistido (recargar /exercises, verificar progress bar)
- [ ] Badge claim status sin cambio (si tenías 10★, sigues con badge)

## 4. Telemetry smoke

Con `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY=1`:

- [ ] `peones_spent` con `target: "retry"` cuando debited > 0 (fresh retry)
- [ ] `peones_spend_bypassed` con `target: "retry"` cuando PRO bypass aplica (wallet PRO + dentro de quota 10/día)
- [ ] `peones_spend_blocked` cuando insufficient
- [ ] `peones_spend_failed` cuando error técnico
- [ ] `training_retry_completed` SOLO cuando el reset realmente se ejecutó (con `{ piece, exerciseId, attemptSeq, source: "result_overlay" }`)
- [ ] Cero eventos duplicados por double-tap o duplicate=true
- [ ] Cero emit de `training_retry_started` (intencionalmente NO existe; `peones_spent target=retry` cubre el inicio)

## 5. Out of scope (recordatorio)

- ❌ Undo move (cluster propio post-Sprint 5)
- ❌ Save game
- ❌ Daily Labyrinth / Labyrinth key
- ❌ Peones packs / top-up
- ❌ Stablecoin direct payment
- ❌ Retry durante ejercicio activo (solo failure phase)

## 6. Pre-promote checklist

- [x] TypeScript clean (`pnpm tsc --noEmit` sin output)
- [x] Full vitest `--max-workers=2` green (3054/3054 post-F)
- [ ] Preview smoke manual completo (§3 + §4) — pendiente
- [x] No hosted migration apply needed (cero schema change Sprint 5)
- [x] `origin/production` NO ha avanzado durante Sprint 5
- [x] No localStorage Peones / no payment rails / no spend endpoint change / no ledger change

## 7. Promote process (cuando smoke verde)

Mismo proceso fast-forward que Sprint 4:

```
git fetch origin
git checkout production
git merge --ff-only origin/main
git push origin production
git checkout main
```

Esperado: `origin/production` avanza de `63949bed` a `<HEAD-of-main>` (Sprint 5 commits B-F).

## 8. Open questions

1. ¿Failure phase tiene UI surface dedicado o solo PhaseFlash? Si solo flash, considerar dedicated overlay para próximo cluster.
2. ¿Retry rate por ejercicio (via `training_retry_completed` data) será fuente de difficulty tuning en post-MiniPay-listing era? Sprint 6+ consideration.
3. ¿Save game surface es próximo o saltamos a Daily Labyrinth? Open question §9.3 del Sprint 4 handoff sigue abierta.
