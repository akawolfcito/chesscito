# Chesscito — Sprint 5 Calibration: Retry surface

**Owner**: John (PM) · **Stakeholders**: Wolfcito (founder), eng
**Date**: 2026-06-08 · **Status**: Calibration — no code, awaiting founder sign-off on §11

> Calibration §7 founder principle (Sprint 4): "PRO suaviza y expande la experiencia." Retry is the second consumer surface where Peones meet the player; it must reinforce that loop without breaking the badge/stars contract.

## 1. Tesis Sprint 5

Retry cierra el loop de ejercicios:

```
earn Peones (Daily / Training delta)
  → spend Hint (1 Peón) en attempt N
  → retry attempt (2 Peones) → attempt N+1
  → spend Hint de nuevo (idempotency key fresh por nuevo attemptSeq)
```

**Objetivos**:
- Implementar `attemptSeq` real (hoy hard-coded a 1).
- Permitir reintento pagado con Peones, sin tocar badge/stars.
- Eliminar duplicate hits falsos del Hint cuando el usuario quiere fresh hint en mismo ejercicio.

## 2. Estado actual (post-Sprint 4)

- ✅ `target: "retry"` ya en `PEONES_SPEND_TARGETS` + spend endpoint allow-list.
- ✅ Server-side cost: `retry = 2 Peones` (calibration Sprint 4 §5).
- ✅ Server-side PRO bypass: cuota `retry = 10/día` (commit G `PRO_BYPASS_DAILY_QUOTA.retry`).
- ✅ Idempotency key format reservado: `spend:retry:{wallet}:{piece}:{exerciseId}:{attemptSeq}`.
- 🟡 `attemptSeq` hard-coded a 1 en `PeonesHintButton`. Causa: duplicate hits inevitables (founder report 2026-06-08).
- 🟡 Sin UI surface para Retry. Sin reset mechanic. Sin attemptSeq state en `useExerciseProgress`.
- ❌ Daily Labyrinth, Labyrinth key, Save game: out-of-scope Sprint 5.

## 3. Product behavior

- Usuario falla ejercicio (timer expira / movimientos > umbral) o quiere reintentar voluntariamente.
- Tap `Retry · 2 Peones` → `submitPeonesSpend({ target: "retry", amount: 2, ... })`.
- **Success path**:
  - `attemptSeq++` en el parent state.
  - Reset: piece position → startPos; movesCount → 0; selectedPosition → null; timer → 0; isRejecting → false.
  - **Preserva**: bestStars histórico, stars totales del piece, badge claim status, training earn state.
  - Hint del siguiente attempt usa `attemptSeq` actualizado → fresh idempotency key → spend real (no duplicate hit).
- **Duplicate path** (mismo attemptSeq, rapid double-tap): RPC retorna `duplicate=true`. Reset NO se ejecuta porque ya se ejecutó la primera vez (el state ya está reseteado o el attemptSeq ya avanzó). Cliente trata como success silencioso.
- **Insufficient**: NO reset, chip morpea a "Not enough Peones" 2.5s (mismo patrón Hint).
- **Error técnico**: NO reset, chip morpea a "Retry unavailable" 2.5s.
- **Guest**: NO llama spend; chip muestra "Connect to use Peones retries".

## 4. attemptSeq contract

| Evento | attemptSeq antes | attemptSeq después |
|---|---|---|
| Exercise mount | — | 1 |
| Hint spend success | N | N (no cambia) |
| Retry spend success | N | N + 1 |
| Exercise complete (3★ / move next) | — | — (irrelevante, exercise se desmonta) |
| Piece change / navigation away | — | reset a 1 al re-montar |

**Retry usa el attempt actual que cierra**, no el siguiente:
- Player en attempt N quiere retry.
- Idempotency key: `spend:retry:{wallet}:{piece}:{exerciseId}:N` (paga por cerrar attempt N).
- Tras success → `attemptSeq = N + 1`.
- Siguiente Hint: `spend:hint:{wallet}:{piece}:{exerciseId}:N+1` (fresh attempt, fresh debit posible).

**Por qué no "next attempt"**: un retry no comprado no genera key. El attempt N existe desde el mount; el spend lo "consume". Si usáramos N+1, las keys quedarían huérfanas si el player nunca retrievea de nuevo.

**State ownership**: `useExerciseProgress` ya maneja exercise progress per-piece. Agregar `attemptSeq` ahí mantiene el invariante "una fuente para state de ejercicio". `useExerciseProgress.attemptSeq` resetea al cambiar `currentExercise.id` (efecto similar a `peonesHintSquare` clear).

## 5. Stars / progress / badge rules

- **Retry no resta stars** — training earn ya es delta-based (`bestStarsAfter - bestStarsBefore`). Repetir con bestStars menor no descuenta.
- **Retry no farma Peones** — solo delta positivo de bestStars genera earn. Reintentar y empatar = 0 Peones earned.
- **Badge threshold (10★) intacto** — preserve. Retry NO toca badge claim.
- **localStorage progress preserved** — `useExerciseProgress` ya persiste; retry NO escribe.
- **Edge case**: si player retry-ea después de 3★ perfecto, no hay incentivo económico. Aceptado — retry es affordance UX, no path de farming.

## 6. UI placement — decisión recomendada

**Postura**: **Result overlay primary, NO durante ejercicio**.

Razones:
- Mid-exercise retry es rare; player usualmente quiere fresh hint, no reset completo.
- Result overlay (`result-overlay.tsx`) ya existe para failure / partial completion → reutilizamos surface.
- Cero conflicto con floating Hint chip (Sprint 4 commit L bottom-right).
- Reduce accidental taps que quemen 2 Peones sin querer.
- Tap target en result overlay es spacious vs cramped en board zone.

**Layout en result overlay** (failure state o partial completion):
- Botón nuevo `Retry · 2 Peones` (estilo mismo chip morphing que Hint para consistencia).
- Co-existe con "Next exercise" / "Choose piece" CTAs existentes.
- Compact pill, color azul-cool (diferente a Hint dorado-warm) para evitar confusion.

**Descartado**: Retry visible durante ejercicio (Opción A del spec). Lo dejo como follow-up Sprint 6+ si métrica muestra que players abandonan mid-attempt y querían retry.

## 7. Cost + PRO

- Free user: `Retry = 2 Peones` (server-trusted, no client override).
- PRO active + dentro de cuota (10/día): bypass aplicado server-side por `resolveProBypass` (commit G).
- PRO row ledger: `pro_bypass=true`, balance untouched, telemetry `peones_spend_bypassed`.
- PRO quota exhausted: fallback a debit normal de 2 Peones.

**Zero server work nuevo** — commit G ya hizo el wire-up generic para todos los targets.

## 8. Telemetry

Reutilizar emitters existentes (commit D + G):
- `peones_spent` (debited > 0 + !duplicate)
- `peones_spend_bypassed` (PRO bypass aplicado)
- `peones_spend_blocked` (insufficient)
- `peones_spend_failed` (error técnico)

**Nuevo opcional**: `training_retry_completed` con props `{ piece, exerciseId, attemptSeq, source: "result_overlay" }`. Útil para medir retry-rate por ejercicio (¿cuáles son más reintentados? = candidatos para tuning de difficulty). **Recomiendo agregarlo en commit F** del plan.

NO agregar `training_retry_started` — redundante con el `peones_spent target=retry` event que ya captura el inicio.

## 9. Plan de commits Sprint 5

| Slice | Scope | Acceptance |
|---|---|---|
| **A** | Calibration doc (este archivo) | Founder approves §11 |
| **B** | `attemptSeq` state en `useExerciseProgress` — passive (counter expuesto, reset on exercise change, no incremento aún) | Hook devuelve `{ ..., attemptSeq, incrementAttemptSeq }`, tests para reset on exerciseId change |
| **C** | `PeonesRetryButton` component (mismo patrón chip morphing que Hint, copy EN+ES, no wire-up al state aún) | Component renderea estados idle/loading/insufficient/error/guest; 6-8 tests |
| **D** | Wire retry → `submitPeonesSpend` + reset behavior + `incrementAttemptSeq` callback | Tap exitoso resetea board state, attemptSeq avanza, telemetry fires |
| **E** | `PeonesHintButton` consume `attemptSeq` real (no más hard-coded 1) | Hint idempotency key incorpora attemptSeq real; same-attempt duplicate aún funciona; cross-attempt fresh debit |
| **F** | Tests + smoke (script `peones-retry-smoke.mjs`) + handoff + opcional `training_retry_completed` | Full suite green, hosted apply ya no necesaria (cero schema change), handoff doc shipped |

**Estimación**: 6 commits, ~1 día. Cero migration nueva, cero endpoint nuevo, cero schema change.

## 10. Out of scope

- ❌ Daily Labyrinth Challenge (Sprint 6+ post-rotation v0.2)
- ❌ Labyrinth key spend (Sprint 6+)
- ❌ Save game surface (post-Sprint 5)
- ❌ Peones packs / top-up (Sprint 6+ stablecoin cluster)
- ❌ Stablecoin direct payment (cluster separado, NEVER para microactions)
- ❌ Coach flow modificaciones (intact)
- ❌ Badge / stars / progress redesign
- ❌ New exercise content
- ❌ Retry visible durante ejercicio (descartado §6, posible Sprint 6+ si métrica lo justifica)

## 11. Preguntas bloqueantes

1. **¿Retry aparece durante ejercicio o solo en result overlay?**
   **PM recomienda**: **solo en result overlay** (failure / partial). Reduce accidental taps, libera board zone, surface ya existe. Mid-exercise retry queda como follow-up con datos.

2. **¿Retry spend usa attemptSeq actual o next attempt?**
   **PM recomienda**: **attemptSeq actual** (paga por cerrar attempt N). Tras success → incrementa a N+1. Keys nunca quedan huérfanas; semántica clara "pago para cerrar este intento".

3. **¿Retry resetea moves/position solamente o también timer?**
   **PM recomienda**: **reset completo del attempt** — piece position, movesCount, selectedPosition, isRejecting, timer (si existe). Preserva bestStars, total stars, badge claim. Reset es "fresh start", no "partial undo".

4. **¿PRO bypass para retry se activa en Sprint 5 o queda activo por endpoint genérico?**
   **PM recomienda**: **YA está activo** por endpoint genérico (commit G). Zero server work; retry hereda el flow standard. `quotaUsed/quotaLimit` viajan en el response, el consumer puede emitir `peones_spend_bypassed` con el patrón establecido.

5. **¿`training_retry_completed` telemetry event vale la pena?**
   **PM recomienda**: **sí, en commit F**. Permite medir retry-rate por ejercicio para tuning de difficulty (¿cuáles ejercicios son los más reintentados?). Cero costo, mucho insight.
