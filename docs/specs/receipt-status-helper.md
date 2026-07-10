# Spec — receipt-status-helper (1 de 2)

**Date**: 2026-07-09
**Status**: ready for /tdd
**Parent**: `receipt-status-verification.md` (partido tras su red-team)
**Blocks**: `receipt-status-learn-handlers.md`

## Problem

`waitForReceiptWithTimeout` (`lib/contracts/transaction-helpers.ts:23`) devuelve
cualquier receipt, incluido el de una tx revertida. Verificado en
`viem@2.46.3/_esm/actions/public/waitForTransactionReceipt.js`: resuelve con
`emit.resolve(receipt)` y nunca inspecciona `status`.

Ningún consumidor compensa esa laguna:

| Consumidor | Qué hace con el receipt | Si revierte |
| --- | --- | --- |
| `use-shop-sheet-state.ts:461` (approve) | lo ignora y sigue al `buyItem` | gasta gas en un `buyItem` condenado |
| `use-mint-victory.ts:517` (approve) | igual | igual |
| `use-mint-victory.ts:606` (claim) | lo castea a `{ logs }` y busca `VictoryMinted` | `logs` vacío → `tokenId: null` → `claimPhase: "success"` |

Y una asimetría que el red-team marcó como bloqueante: victory elige entre
`inp.injected.waitReceipt(hash)` (MiniPay) y el helper (web) en `:601-607`.
Arreglar solo el helper haría que **el path web falle honestamente y el path
MiniPay siga celebrando**. MiniPay es el target de distribución.

## Goal

`waitForReceiptWithTimeout` resuelve únicamente con receipts exitosos, y los tres
consumidores actuales convergen en esa garantía, incluido el path inyectado de
victory.

## Non-goals

- Badge claim y score save. Ninguno de los dos usa este helper (usan el hook
  `useWaitForTransactionReceipt`). Van en el spec 2.
- Decodificar custom errors.
- Cambiar copy, UI o baselines VR.

## Contracts (SDD)

```ts
// lib/contracts/transaction-helpers.ts
import type { Hash, PublicClient, TransactionReceipt } from "viem";

export class TransactionRevertedError extends Error {
  readonly hash: Hash;
  readonly receipt: TransactionReceipt;
}

/** Distinto de un revert: la cadena no dio veredicto. No colapsar los dos —
 *  "la cadena dijo que no" y "no pude leer la respuesta" no son el mismo hecho,
 *  ni en la copy ni en la telemetría. */
export class TransactionReceiptUnverifiableError extends Error {
  readonly hash: Hash;
  readonly receipt: TransactionReceipt;
  readonly receivedStatus: unknown;
}

/** PURA. Vale para un receipt de cualquier origen.
 *  @returns el receipt si `status === "success"`
 *  @throws TransactionRevertedError              si `status === "reverted"`
 *  @throws TransactionReceiptUnverifiableError   si el status falta o no se reconoce */
export function assertReceiptSuccess(
  hash: Hash,
  receipt: TransactionReceipt,
): TransactionReceipt;

/** Resuelve SOLO con `receipt.status === "success"`. Delega en assertReceiptSuccess.
 *  @throws TransactionTimeoutError   si no se minó dentro de timeoutMs */
export async function waitForReceiptWithTimeout(
  client: PublicClient,
  hash: Hash,
  opts?: { timeoutMs?: number; confirmations?: number },
): Promise<TransactionReceipt>;
```

> **Corrección al plan original.** El spec pedía
> `assertReceiptSuccess(client, hash)`, con una lectura extra al nodo, para no
> confiar en el receipt de MiniPay. Al implementarlo se comprobó que
> `inp.injected` de `use-mint-victory` **solo existe en tests** (`injected:` no
> aparece en ningún call site de producción): es un doble, no la wallet. Sin una
> fuente no confiable que justificarla, la lectura extra es I/O sin motivo. La
> versión pura cubre ambas ramas y las obliga a coincidir.

```ts
// lib/errors.ts
export function isTransactionReverted(error: unknown): boolean;
export function isReceiptUnverifiable(error: unknown): boolean;
```

Ambos se evalúan **antes que toda heurística de strings, incluida la de
cancelación**: un revert cuyo mensaje contenga "cancelled" o "400" no debe
reclasificarse. `TransactionRevertedError` → `"revert"`;
`TransactionReceiptUnverifiableError` → `"unknown"`, nunca `"revert"`.

`classifyTxErrorKind` mapea `TransactionRevertedError` → `"revert"`.
El kind y la copy (`RESULT_OVERLAY_COPY.error.revert`) ya existen: **cero claves
nuevas, cero i18n, cero baselines VR**.

`confirmations`: se mantiene el default de viem (1). Decidido, no es pregunta abierta.

## Behavior

1. Dado un receipt con `status: "success"`, `waitForReceiptWithTimeout` lo devuelve.
2. Dado un receipt con `status: "reverted"`, lanza `TransactionRevertedError` con
   el `hash` y el `receipt` adjuntos.
3. Dado un timeout, sigue lanzando `TransactionTimeoutError` (sin cambios).
4. `isTransactionReverted` reconoce la instancia y también un `Error` cuyo `name`
   sea `"TransactionRevertedError"` (cruce de realms, igual que hace hoy
   `isTransactionTimeout` en `:11`).
5. `classifyTxErrorKind(new TransactionRevertedError(...))` devuelve `"revert"`,
   y lo hace **antes** que las heurísticas de substring.
6. Dado el path de victory con `injected.waitReceipt`, el receipt obtenido pasa
   por `assertReceiptSuccess(claimHash, receipt)`. Si el status no es `success`,
   lanza y `claimPhase` nunca pasa a `"success"`.
7. Dado el path de victory sin `injected`, el helper ya lanza. Ambas ramas se
   comportan igual.
8. Dado un `approve` revertido (shop o victory), la promesa lanza y el flujo
   nunca alcanza el `buyItem` / `claim`.

## Edge cases

- **Status ausente o desconocido.** Fail closed, pero **no** como revert:
  `TransactionReceiptUnverifiableError` → kind `"unknown"`. Un receipt que no
  podemos leer no autoriza a decir que la cadena rechazó la tx.
- **Tx reemplazada** (speed-up desde la wallet): viem lanza. Sin cobertura previa;
  no la agregamos acá, pero queda anotada.
- Un `approve` que revierte es hoy invisible; después será un error. Es un cambio
  de comportamiento **deseado** y observable en telemetría.

## Acceptance criteria

- [ ] `waitForReceiptWithTimeout` lanza `TransactionRevertedError` con `status: "reverted"`.
- [ ] `waitForReceiptWithTimeout` devuelve el receipt con `status: "success"`.
- [ ] El timeout sigue lanzando `TransactionTimeoutError` (test de regresión).
- [ ] `assertReceiptSuccess` lanza `TransactionReceiptUnverifiableError` (y NO
      `TransactionRevertedError`) con status ausente o desconocido.
- [ ] `isTransactionReverted` reconoce instancia y duck-type por `name`.
- [ ] `classifyTxErrorKind(TransactionRevertedError)` → `"revert"`, aun cuando el
      mensaje diga "User rejected" o "HTTP 400".
- [ ] `classifyTxErrorKind(TransactionReceiptUnverifiableError)` → `"unknown"`.
- [ ] Un `Error` plano con "User rejected" sigue clasificando `"cancelled"`.
- [ ] `use-mint-victory`: receipt revertido por el path inyectado ⇒ `claimPhase`
      NO es `"success"`, `onClaimTelemetry` emite `stage: "error"`.
- [ ] `use-mint-victory`: receipt revertido por el path web ⇒ idem.
- [ ] `use-mint-victory`: receipt exitoso ⇒ comportamiento idéntico al de hoy
      (test de regresión sobre `tokenId` y `shareLinkUrl`).
- [ ] Shop: `approve` revertido ⇒ `buyItem` nunca se llama.
- [ ] Suite completa verde. Sin claves de copy nuevas.

**Todos los criterios son verificables hoy.** Los harnesses existen:
`lib/contracts/__tests__/transaction-helpers.test.ts`,
`lib/coach/__tests__/use-mint-victory.test.ts`,
`lib/shop/__tests__/use-shop-sheet-state.test.tsx`, `lib/__tests__/errors.test.ts`.

## Out of scope / future

- `deriveTxToastState` (`lib/exercises/tx-toast-state.ts:36`) tiene un branch
  `failed` alimentado por `isError`, documentado en `:18` como
  *"chain revert / RPC error"*. **Solo es RPC error.** El comentario de
  `exercises-screen.tsx:1127` afirma que "chain revert now surfaces as a sticky
  failed toast": es falso. Se corrige en el spec 2, que es quien controla ese
  input. Tercera aparición de `feedback_tests_green_against_dead_shape`.

## Open questions

Ninguna. Este spec es implementable tal cual.
