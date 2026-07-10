# Red Team Review — receipt-status-verification

**Date**: 2026-07-09
**Reviewer mindset**: hostile QA + senior engineer

La premisa del spec se verificó contra el código, no se asumió:
`viem@2.46.3/_esm/actions/public/waitForTransactionReceipt.js` resuelve con el
receipt (`emit.resolve(receipt)`, líneas 79/106/131/188) y **nunca inspecciona
`status`**. Por lo tanto `useWaitForTransactionReceipt().isSuccess` es `true`
para una tx revertida. El bug es real.

Lo que sigue es lo que el spec **no** resuelve.

## Findings

### P0 — Must address before implementation

- **[testabilidad] Los acceptance criteria no son falsables hoy.** El spec pide
  aseverar el comportamiento de los handlers de `<ExercisesScreen>`, un componente
  de ~2.900 líneas **sin harness de test** — hecho ya registrado como deuda
  abierta (`MEMORY.md`: "Extract a testable seam for ExercisesScreen"). Sin
  extraer los dos handlers a un hook (`useOnChainWrite` / `useBadgeClaim` /
  `useScoreSave`), no hay TDD posible: se implementa contra `tsc` y buena fe.
  — **Por qué bloquea:** es exactamente cómo se shipeó el bug de `badge-sheet`
  con la suite en verde (`feedback_tests_green_against_dead_shape`). El spec pide
  9 criterios y no puede probar 7. El costo del seam no está estimado en el spec.

- **[scope leak] Cambiar `waitForReceiptWithTimeout` toca dos call sites que el
  spec declara fuera de alcance**, en el mismo PR: shop approve
  (`use-shop-sheet-state.ts:461`) y victory (`use-mint-victory.ts:606`). El spec
  lo llama "deseable" y no define ni un test para ellos.
  — **Por qué bloquea:** "fuera de alcance" y "hereda el cambio de contrato" son
  incompatibles. O entran con cobertura, o el helper recibe el chequeo detrás de
  un parámetro y los call sites migran uno por uno.

- **[incoherencia] En victory, solo UNA de las dos ramas quedaría verificada.**
  `use-mint-victory.ts:601-607` elige entre `injected.waitReceipt(hash)` (MiniPay)
  y `waitForReceiptWithTimeout(...)` (web). Si el chequeo vive en el helper, el
  path web empieza a lanzar en reverts y **el path MiniPay sigue celebrando**.
  El mismo botón, dos verdades, y MiniPay es el target de distribución.
  — **Por qué bloquea:** produce una inconsistencia peor que el bug actual,
  porque ahora es no determinista según el entorno.

- **[borrado con efectos colaterales] El effect de `:1094-1114` hace TRES cosas**,
  no una: (1) `recordSaveFor`, (2) el latch `doneHoldStartedForTxRef`, (3) el
  done-hold de 1500ms (`setTxDoneAt` + timer, con un comentario explícito sobre
  por qué `txDoneAt` no está en las deps). El spec dice "se borra" y relega el
  done-hold a "hay que verificar".
  — **Por qué bloquea:** borrarlo elimina silenciosamente la ventana de UI de
  éxito. Eso es un cambio visual sin baseline VR y sin criterio de aceptación.

### P1 — Should address

- **[UX] Un solo timeout para dos propósitos distintos.** El spec reusa
  `DEFAULT_TX_TIMEOUT_MS = 120_000` como límite de la fase `confirming`. Hoy el
  jugador espera 0s; con esto puede mirar un spinner **dos minutos** antes de ver
  nada. En un WebView de MiniPay que puede pausar timers al ir a background, ese
  peor caso no es teórico.
  — Riesgo: cambiar una mentira rápida por una verdad insoportable. Hace falta un
  umbral de UI (~15-20s) que degrade a "sigue confirmando, revisá más tarde" sin
  cancelar la espera real.

- **[telemetría] Redefinir `stage: "success"` rompe el funnel histórico en
  silencio.** Hoy significa "broadcast"; pasaría a significar "minada y exitosa".
  La tasa de éxito de `badge_claim_tx` va a **caer** y va a leerse como una
  regresión introducida por este PR.
  — Riesgo: nadie va a poder comparar antes/después. Sumado a que el fix del
  `"400"` (#197) ya re-bucketeó `error_kind`, son dos discontinuidades seguidas.

- **[copy] Este spec hace visible el revert por primera vez, con la peor copy
  disponible.** `error.revert` dice "Transaction failed. This action may not be
  available right now." La causa real más probable de un claim revertido es
  `BadgeAlreadyClaimed`, que **tiene copy dedicada** ("You already own this
  badge!") y que no se va a mostrar porque el decoder está diferido.
  — Riesgo: shipear la verificación sin el decoder convierte un falso éxito en un
  error genérico y desconcertante. Argumenta por hacer los dos juntos, o por
  aceptar conscientemente el intermedio.

- **[fire-and-forget] Mover `/api/cache-score` después del receipt agranda su
  ventana de fallo silencioso.** Ya tiene `.catch(() => {})` (`:1860`). Con el
  chequeo, la tx está confirmada on-chain y Supabase puede quedarse sin el score,
  sin ninguna señal. El leaderboard combinado lee esa tabla.
  — Riesgo: cambiamos "score falso en el leaderboard" por "score real ausente".
  Ambos son divergencia; el spec no elige explícitamente.

- **[guard] `isClaimConfirming` tiene consumidores no enumerados.** El spec dice
  "reemplazar por la fase" sin listar quién lo lee. Enumerar antes de tocar.

### P2 — Nice to clarify

- **[divergencia] Open question 1 es asimétrica y el spec no lo nota.** Si el
  jugador cierra la app en `confirming`: el badge **se auto-cura** (los
  `useReadContracts` de badges leen la cadena al montar), el score **no**
  (`recordSaveFor` escribe localStorage y nadie reconcilia). Son dos problemas
  distintos disfrazados de uno.

- **[contrato] `confirmations`** queda como pregunta abierta pero afecta la
  latencia percibida directamente. Decidir (1, el default de viem) y borrar la
  pregunta. Celo no tiene reorgs relevantes a esta escala.

- **[fail-closed] "Si no hay `publicClient`, error"** es la decisión correcta,
  pero hay que confirmar que `usePublicClient({ chainId })` no devuelve
  `undefined` en el path normal de MiniPay antes de convertir un flujo que
  funciona en uno que falla.

- **[naming]** `TransactionRevertedError` junto a `TransactionTimeoutError`:
  consistente. Sin objeción.

## Categories audited

### Contract gaps
`TransactionRevertedError` expone `receipt`, lo cual es correcto (permite leer
`gasUsed`, `logs`). No hay `any`. Falta: el tipo de la fase
(`OnChainWritePhase`) se declara pero el spec nunca dice **dónde vive** — si es
estado local de `<ExercisesScreen>` (2.900 líneas, sin harness) o del hook
extraído. Es la misma herida del P0 de testabilidad.

### Behavioral ambiguity
Behavior 7 dice "el estado no se muta: la tx puede confirmar más tarde", pero no
define qué ve el jugador si efectivamente confirma después. ¿Se entera alguna vez?

Behavior 9 traslada la invariante piece-switch del `pendingSubmitRef` al closure.
Correcto **solo si** el handler no re-lee `selectedPiece` tras el await. No está
escrito como restricción.

### Hidden assumptions
- Que `publicClient` existe y apunta a la chain correcta.
- Que MiniPay no mata el WebView durante los ~5s.
- Que la wallet devuelve un hash de una tx que efectivamente se broadcasteó.

### Backward compatibility
El cambio de postcondición de `waitForReceiptWithTimeout` es **breaking para sus
consumidores actuales**, y todos están fuera del alcance declarado. Ver P0.

### Security & data
Ninguna superficie nueva. Nota: este spec **no** es anti-cheat. Verificar el
receipt confirma que la cadena aceptó la tx, no que el score fuera legítimo:
`/api/sign-badge` sigue firmando cualquier `levelId` sin mirar estrellas
(`route.ts:23`). No confundir los dos en el PR ni en el handoff.

### Test coverage gaps
7 de 9 criterios apuntan a comportamiento dentro de `<ExercisesScreen>`. Sin
harness, no son verificables. Los 2 restantes (el helper y el clasificador) sí lo
son hoy, y son los únicos que este spec puede probar tal como está escrito.

### Operational readiness
No hay plan de rollback. El cambio es puramente client-side y va por deploy, así
que el rollback es un revert + redeploy. Aceptable, pero conviene declararlo,
porque el blast radius incluye shop y victory vía el helper compartido.

## Verdict

**NEEDS REVISION** — 4 P0.

Para pasar a `/tdd`, el spec debe:

1. Absorber el costo del **seam testable** (extraer los handlers a un hook), o
   bajar los acceptance criteria a lo que realmente se puede probar y decirlo.
2. Decidir el alcance del helper: o entra con shop + victory y sus tests, o el
   chequeo va detrás de un parámetro y se migra call site por call site.
3. Resolver la **asimetría de victory** (`injected.waitReceipt` vs helper) antes
   de tocar el helper, aunque victory quede fuera del PR.
4. Tratar el effect de `:1094` como tres responsabilidades y decir qué pasa con
   el done-hold, con criterio de aceptación y baseline VR si cambia.

Recomendación de ruta: **partir el spec en dos**. `receipt-status-helper`
(helper + clasificador + tests, verificable hoy, sin tocar UI) y
`receipt-status-learn-handlers` (seam + handlers + UX de `confirming`), que
depende del primero.
