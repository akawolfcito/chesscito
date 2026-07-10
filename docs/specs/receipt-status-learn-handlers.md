# Spec — receipt-status-learn-handlers (2 de 2)

**Date**: 2026-07-09
**Status**: draft — bloqueado por `receipt-status-helper.md`
**Parent**: `receipt-status-verification.md` (partido tras su red-team)

## Problem

Los dos writes on-chain de LEARN declaran éxito sobre el hash, no sobre el
resultado.

- **Badge claim** (`exercises-screen.tsx:1581-1606`): tras `writeContractAsync`
  corre `hapticSuccess()`, `justClaimed[piece] = true`, el modal `piece-unlocked`
  y el overlay `variant: "badge"`. Nunca lee un receipt.
- **Score save** (`:1821-1846`): espera el receipt con
  `useWaitForTransactionReceipt` (`:1016`) pero consume `isSuccess`, que en wagmi
  significa "la query resolvió", no `status === "success"`. El effect de `:1094`
  corre igual y `recordSaveFor` persiste el score de una tx revertida.
- `/api/cache-score` se llama al broadcast (`:1850`). El leaderboard combinado de
  Supabase lee esa tabla como fuente `scores` on-chain.
- `chesscito:optimistic-score` (`:1864`), lo mismo.
- `deriveTxToastState` recibe `isError` (`:1133`), que es error de query, no
  revert. Su branch `failed` **nunca dispara** en un revert, contra lo que
  afirman los comentarios de `:1127` y `tx-toast-state.ts:18`.

## Goal

Ningún efecto de éxito (celebración, persistencia local, write-through a Supabase,
telemetría `stage: "success"`, toast de éxito) ocurre antes de que el nodo
confirme `receipt.status === "success"`.

## Non-goals

- Shop buy y victory mint (spec 1 los deja consistentes a nivel helper; el
  `buyItem` de shop sigue sin esperar receipt y **queda como follow-up explícito**).
- Decodificar custom errors.
- Anti-cheat. Verificar el receipt confirma que la cadena aceptó la tx, no que el
  score sea legítimo: `/api/sign-badge:23` sigue firmando cualquier `levelId`.
  **No mezclar los dos en el PR ni en el handoff.**

## Pre-requisito: el seam testable (P0 del red-team)

`<ExercisesScreen>` tiene ~2.900 líneas y **no tiene harness**. Sin extraerlo, 7
de 9 criterios no son falsables y se implementa contra `tsc` y buena fe, que es
como se shipeó el bug de `badge-sheet` con la suite en verde.

**Tarea 0, no negociable:** extraer los dos handlers a hooks con harness propio.

```ts
// lib/exercises/use-onchain-write.ts
export type OnChainWritePhase = "idle" | "signing" | "confirming" | "settled";

export type OnChainWriteResult =
  | { status: "success"; txHash: `0x${string}` }
  | { status: "reverted"; txHash: `0x${string}`; error: TransactionRevertedError }
  | { status: "timeout"; txHash: `0x${string}` }
  | { status: "cancelled" }
  | { status: "failed"; error: unknown };

export function useOnChainWrite(): {
  phase: OnChainWritePhase;
  /** Firma, broadcastea, y espera el receipt. Nunca resuelve "success"
   *  sin `receipt.status === "success"`. */
  run: (req: WriteRequest) => Promise<OnChainWriteResult>;
};
```

El hook devuelve un resultado **discriminado**, no lanza: el call site decide qué
celebrar. Los efectos de éxito viven en un solo `if (result.status === "success")`.

## Contracts (SDD)

Consume del spec 1: `waitForReceiptWithTimeout`, `TransactionRevertedError`,
`isTransactionReverted`, y el mapeo a kind `"revert"`.

```ts
// lib/exercises/tx-toast-state.ts — corrección del input mentiroso
export type TxToastInputs = {
  isWriting: boolean;
  isConfirming: boolean;
  /** `true` SOLO si la tx se minó y revirtió, o el envío falló.
   *  Antes recibía `useWaitForTransactionReceipt().isError`, que es un
   *  error de query y nunca refleja un revert. */
  hasFailed: boolean;
  txHash: string | null;
  doneAt: number | null;
};
```

## Behavior

1. Broadcast (badge o score): la fase pasa a `confirming`, la telemetría emite
   `stage: "broadcast"`, y **ningún** efecto de éxito corre.
2. Badge + receipt `success`: `hapticSuccess()`, `justClaimed[piece] = true`,
   modal `piece-unlocked` de la siguiente pieza, overlay `variant: "badge"`,
   telemetría `stage: "success"`.
3. Badge + receipt `reverted`: overlay `variant: "error"` con `error.revert` y
   `retryAction`; telemetría `stage: "error", error_kind: "revert"`. Cero mutación
   de estado local.
4. Score + receipt `success`, en este orden: `recordSaveFor(piece, score, txHash)`
   → `chesscito:optimistic-score` → `/api/cache-score` → refresh del leaderboard
   → overlay `variant: "score"` → done-hold.
5. Score + receipt `reverted`: overlay de error. El score **no** se persiste en
   localStorage, ni en sessionStorage, ni en Supabase.
6. Timeout (120s sin minar): kind `"timeout"`, copy existente. El estado no se
   muta; la tx puede confirmar después.
7. La pieza usada al persistir es la capturada al broadcast, no `selectedPiece` al
   momento del receipt. El handler **no debe re-leer `selectedPiece` tras el await**.
   (Hoy lo resuelve `pendingSubmitRef`; con el hook lo resuelve el closure.)
8. Desmontaje durante `confirming`: ningún `setState` corre tras el await.
9. Los CTA de Claim y Save están deshabilitados durante `confirming`.

## Las tres responsabilidades del effect de `:1094` (P0 del red-team)

No es un borrado. El effect hace tres cosas y cada una necesita destino:

| Responsabilidad | Hoy | Después |
| --- | --- | --- |
| `recordSaveFor(pending.piece, ...)` | effect on `isSubmitSuccess` | dentro de `if (result.status === "success")` |
| Latch `doneHoldStartedForTxRef` | evita re-disparo del effect | innecesario: el handler corre una vez |
| Done-hold 1500ms (`setTxDoneAt`) | efecto visual del toast | **se preserva**, disparado en el mismo branch |

Consumidores enumerados (el red-team pedía la lista):
`isClaimConfirming` → `:1044` `isClaimBusy`, `:2453` y `:2486` (`isBusy` de los CTA).
`isSubmitConfirming` → `:1045` `isSubmitBusy`, `:1132` `txToast`, `:2326` `isSavingOnChain`.
`txDoneAt` → `:1135` `txToast.doneAt`.

Ninguno se elimina: todos pasan a leer `phase === "confirming"`.

## Edge cases

- **Doble tap** en Claim durante `confirming`: cubierto por (9); test explícito.
- **`publicClient` ausente** (wrong chain): fail closed, overlay de error. Verificar
  antes que `usePublicClient({ chainId })` no sea `undefined` en el path normal de
  MiniPay, o convertimos un flujo que funciona en uno que falla.
- **UX del peor caso** (P1 del red-team): el jugador pasa de 0s de espera a hasta
  120s de spinner, en un WebView que puede pausar timers al ir a background.
  → **umbral de UI a los 20s**: el overlay degrada a "sigue confirmando, revisá
  más tarde" y ofrece cerrar, **sin cancelar** la espera real de 120s.
- **App cerrada durante `confirming`** — divergencia asimétrica: el badge se
  auto-cura (los `useReadContracts` de badges leen la cadena al montar); el score
  **no** (`recordSaveFor` escribe localStorage y nadie reconcilia). Ver preguntas.
- **`/api/cache-score` falla** tras un receipt exitoso: hoy es fire-and-forget con
  `.catch(() => {})` (`:1860`). Cambiamos "score falso en el leaderboard" por
  "score real ausente". Elegir explícitamente: reintento con backoff, o aceptar y
  dejar que el cron `/api/cron/sync` reconcilie.

## Acceptance criteria

- [ ] Los handlers viven en hooks con harness propio; los criterios de abajo se
      prueban contra ellos, no contra `<ExercisesScreen>`.
- [ ] Badge + revert: `justClaimed` sin mutar, `piece-unlocked` no se abre,
      overlay de error, `stage: "error"`.
- [ ] Badge + success: comportamiento idéntico al actual (regresión).
- [ ] Score + revert: `recordSaveFor` no se llama, `/api/cache-score` no se llama,
      `chesscito:optimistic-score` no se escribe.
- [ ] Score + success: los tres corren, en el orden de (4).
- [ ] `deriveTxToastState` con `hasFailed: true` produce el toast `failed`
      (y existe un test que lo alcanza vía un revert, no vía un error de query).
- [ ] Sin `setState` tras desmontaje.
- [ ] CTA deshabilitado durante `confirming`.
- [ ] El done-hold de 1500ms sigue ocurriendo tras un save exitoso.
- [ ] Baseline VR para el estado `confirming` si la UI cambia.
- [ ] Smoke en device (mainnet): un claim exitoso celebra igual, con ~5s de
      confirmación visible.

## Out of scope / future

- **Shop `buyItem`** (`use-shop-sheet-state.ts:466-484`): setea `successBanner` y
  dispara `fireOnPurchaseSuccess` (que muta shields en el host) sobre el hash, sin
  esperar su receipt. Mismo bug, superficie de dinero. Follow-up inmediato.
- Reconciliación del score al volver a la app.

## Open questions

1. **Score divergente**: ¿reconciliamos leyendo el Scoreboard al montar, o
   aceptamos la divergencia y confiamos en el cron?
2. **`/api/cache-score` fallido tras receipt exitoso**: ¿reintento o cron?
3. ¿El estado `confirming` es una variante nueva del `ResultOverlay` o reusa el
   toast existente? Decide si hace falta baseline VR.

## Nota de telemetría (P1 del red-team)

Cambiar `stage: "success"` de "broadcast" a "minada y exitosa" redefine el funnel.
La tasa de éxito de `badge_claim_tx` **va a caer** y se va a leer como una
regresión de este PR. Sumado al re-bucketeo de `error_kind` del PR #197, son dos
discontinuidades seguidas. Anotarlo en el handoff.
