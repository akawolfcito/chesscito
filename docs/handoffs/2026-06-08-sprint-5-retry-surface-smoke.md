# Sprint 5 — Retry surface handoff + smoke

**Date**: 2026-06-08 · **Owner**: John (PM) · **Branch**: `main`
**Status**: All commits merged including commit G unmount fix. Production HOLD until simplified smoke green.

> Calibration: `docs/product/chesscito-sprint-5-retry-surface-calibration-2026-06-08.md`
> Sprint 4 handoff: `docs/handoffs/2026-06-08-sprint-4-peones-spend-smoke.md`
> Economy philosophy: `docs/product/2026-06-08-peones-economy-philosophy-and-future-sinks.md`

## 0. Direction change 2026-06-08 (commit G)

Smoke uncovered a redundancy: the failure overlay ALREADY ships a free legacy Retry via `ContextualActionSlot` (`action === "retry"`), and stacking a paid `Retry · 2 Peones` chip next to it produced **two identical affordances** with zero differential value. Charging 2 Peones for an action the player can do for free fails the calibration §6 product principle.

**Resolution**: unmount the paid chip. Keep all the plumbing — component, tests, RPC support, `target: "retry"` allow-list entry, telemetry emitters — as dormant infrastructure for a future calibration where Retry adds real differential value (Streak Shield variant, Deep Hint tier, etc.).

**Net win**: the legacy free Retry is now wired through the same `useRetryGuard` the paid chip would have used, so the `attemptSeq` plumbing (commits B + E) still pays off: Hint after a free Retry now produces a fresh idempotency key and a real debit, closing the duplicate-hit gap the founder reported 2026-06-08.

## 1. What shipped (final)

- **`attemptSeq` real** en `useExerciseProgress` (commit B). Inicia en 1, resetea a 1 al cambiar `currentExercise.id`, expone `incrementAttemptSeq` + `resetAttemptSeq` callbacks useCallback-estables.
- **`useRetryGuard`** (commits D + F). Dedup callback que garantiza UNA transición por `attemptSeq`. Emits `training_retry_completed` INSIDE the gate via `onApplied`.
- **Legacy Retry wired through the guard** (commit G). The free `ContextualActionSlot.onRetry` now routes through `handleRetryApplied` → resetBoard + incrementAttemptSeq + telemetry. No new UI, no new affordance — same legacy button the player already knew.
- **Hint consume `attemptSeq` real** (commit E). Eliminado el hardcoded `1`. Hint after a free Retry uses fresh idempotency key → fresh debit posible.
- **`training_retry_completed` telemetry** (commit F). Source label is now `"contextual_action_slot"` (was `"result_overlay"` while the paid chip was mounted).
- **Dormant infrastructure** (commit C kept, G repositioned):
  - `PeonesRetryButton` component + 11 tests
  - `PEONES_RETRY_COPY` i18n (EN + ES)
  - `/api/peones/spend` accepts `target: "retry"`
  - `PRO_BYPASS_DAILY_QUOTA.retry = 10`
  - Idempotency key prefix `spend:retry:` reserved
  All wakeable when calibration approves a differential paid Retry surface (Streak Shield or other).

### Explicitly OUT of Sprint 5 (deferred)

- ❌ **Paid Retry surface** (deferred — `PeonesRetryButton` stays dormant pending differential-value calibration)
- ❌ Undo move (cluster propio Sprint 6+ — diferente product semantic vs Retry)
- ❌ Save game surface (cluster propio)
- ❌ Daily Labyrinth Challenge (Sprint 6+ post-rotation v0.2)
- ❌ Labyrinth key spend (Sprint 6+)
- ❌ Peones packs / top-up (stablecoin cluster)
- ❌ Stablecoin direct payment (NEVER para microacciones)
- ❌ Hosted migration apply — Sprint 5 NO requiere migration (cero schema change)

## 2. Commits Sprint 5

| SHA | Slice | Summary |
|---|---|---|
| `baf9299a` | **A + B** | Calibration doc + `attemptSeq` state passive en useExerciseProgress (+7 tests) |
| `5f9d682b` | **C** | `PeonesRetryButton` component aislado + EN/ES copy + 11 tests (now dormant) |
| `dc8059b4` | **D** | `useRetryGuard` helper + initial wire-up to failure-phase paid chip + 5 tests |
| `a09e7492` | **E** | Hint consume `attemptSeq` real (swap hardcoded 1) + 2 tests |
| `bc8ce5dc` | **F** | `training_retry_completed` telemetry + 5 onApplied tests + handoff (initial) |
| _(este commit)_ | **G** | Unmount paid chip + wire LEGACY free Retry through the guard + handoff revision |

Total Sprint 5: **30 nuevos tests**. Full suite 3024 → 3054. Commit G changes no test counts (only wire-up swap).

## 3. Smoke manual esperado (preview, wallet conectada)

Pre-req: wallet conectada con balance ≥ 3 Peones (Daily Tactic earn o welcome pack seed).

### Happy path — legacy Retry + Hint attemptSeq loop

- [ ] Ir a `/exercises` con wallet conectada
- [ ] Verificar saldo Peones ≥ 2 en HUD
- [ ] Tap pieza, tap Hint → Network panel: `POST /api/peones/spend target=hint, idempotencyKey: spend:hint:...:1`, response `debited: 1`
- [ ] Fallar deliberadamente
- [ ] Verificar **NO** aparece chip `Retry · 2 Peones` en bottom-right (commit G unmount)
- [ ] Verificar que SÍ aparece el icono circular `RETRY` legacy del contextual slot
- [ ] Tap el `RETRY` legacy
- [ ] Board vuelve a estado fresh, phase = "ready", HUD balance **sin cambio** (free retry)
- [ ] Console (si `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY=1`): `training_retry_completed` con `source: "contextual_action_slot"`
- [ ] Tap pieza otra vez → tap Hint
- [ ] Network: `POST /api/peones/spend target=hint, idempotencyKey: spend:hint:...:2`
- [ ] Response: `debited: 1, duplicate: false` (FRESH debit, NO duplicate del attempt 1)
- [ ] Hint glow aparece en cell del optimal first move
- [ ] HUD balance −1 adicional

### Idempotency + dedup guard

- [ ] Volver a fallar el mismo ejercicio
- [ ] Doble-tap rápido en RETRY legacy (2 taps en < 200ms)
- [ ] Visual: reset board UNA vez, attemptSeq avanza UNA vez (no de N a N+2)
- [ ] `training_retry_completed` evento emitido UNA vez (no dos)

### Progress / badge preservation

- [ ] Wallet con ≥1 estrella en rook-1
- [ ] Tap rook-1, llegar a phase=failure, tap RETRY legacy
- [ ] Stars en HUD pre-Retry y post-Retry: idénticas
- [ ] bestStars persistido (recargar /exercises, verificar progress bar)
- [ ] Badge claim status sin cambio (si tenías 10★, sigues con badge)

### Visual verification

- [ ] Failure overlay **NO** muestra dos retries — solo el icono circular legacy
- [ ] Floating slot bottom-right está **vacío** durante failure phase (lo que era el Peones chip antes ya no aparece)
- [ ] Hint chip dorado aparece normal durante phase=ready

## 4. Telemetry smoke

Con `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY=1`:

- [ ] **NO** se emite `peones_spent target=retry` durante el smoke (paid chip unmounted)
- [ ] **NO** se emite `peones_spend_blocked / failed / bypassed` con target=retry (no UI surface)
- [ ] `training_retry_completed` SOLO cuando el reset realmente se ejecutó, payload `{ piece, exerciseId, attemptSeq, source: "contextual_action_slot" }`
- [ ] Cero `training_retry_completed` duplicados por double-tap del icono RETRY legacy
- [ ] `peones_spent target=hint` SÍ emite normalmente cuando el Hint hace fresh debit en attempt N+1
- [ ] Cero emit de `training_retry_started` (intencionalmente NO existe)

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

## 7.5. Known limitation — autoReset path bypasses the guard (deferred)

Discovered durante el smoke 2026-06-08 right before promote. NOT a blocker per founder decision; recorded so a future iteration doesn't have to re-investigate.

**The flow** (newbie wallet, no rescue context):
1. Player fails exercise → `setPhase("failure")`
2. PhaseFlash overlay (TRY AGAIN + wolf) covers the bottom action row
3. After 1.5s, `autoReset.schedule(() => resetBoard(), 1500)` fires — bypasses `handleRetryApplied`
4. `attemptSeq` does NOT advance, `training_retry_completed` does NOT emit
5. Next Hint uses the SAME idempotency key as attempt 1 → `duplicate=true` from RPC → reveal works (UX fine), but `peones_spent` does NOT fire (commit M.1 gate) and the dashboard count is under-reported

**Impact**:
- UX: zero (hint still reveals, balance unchanged on duplicate)
- Economics: user effectively pays 1 Peón per exercise instead of per attempt (more generous than designed — fits the "economy is generous" memo)
- Dashboards: `training_retry_completed` under-reports the real retry rate; `peones_spent` undercounts repeat-hint intent. Acceptable while production is personal staging.

**Fix when needed** (one line):
```ts
// apps/web/src/components/exercises/exercises-screen.tsx ~line 1492
autoReset.schedule(() => handleRetryApplied(), 1500);
```

Same change applies to the FailRescueModal `onRetryAnyway` / `onUseShield` paths if/when we want them to advance attemptSeq too.

**Why deferred**: founder explicitly chose to accept the limitation 2026-06-08 ("como realmente no nos molesta podemos dejarlo ahí, y avanzar"). Bug surface is observability-only with the production-as-personal-staging context.

## 8. Open questions

1. ¿Failure phase tiene UI surface dedicado o solo PhaseFlash? Si solo flash, considerar dedicated overlay para próximo cluster.
2. ¿Retry rate por ejercicio (via `training_retry_completed` data) será fuente de difficulty tuning en post-MiniPay-listing era? Sprint 6+ consideration.
3. ¿Save game surface es próximo o saltamos a Daily Labyrinth? Open question §9.3 del Sprint 4 handoff sigue abierta.
