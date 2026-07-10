# Spec — receipt-status-verification

**Date**: 2026-07-09
**Status**: ⚠️ SPLIT — no implementar este archivo
**Scope**: LEARN only — badge claim + score save. Shop buy and victory mint are documented follow-ups.

> Su red-team (`receipt-status-verification-redteam.md`) devolvió **NEEDS
> REVISION** con 4 P0. Este documento se conserva como registro del problema y
> de la iteración. El trabajo implementable vive partido en:
>
> 1. **`receipt-status-helper.md`** — helper + clasificador + los tres consumidores
>    actuales. Sin UI. Todos sus criterios son verificables hoy. **Empezar acá.**
> 2. **`receipt-status-learn-handlers.md`** — seam testable + handlers de LEARN +
>    UX de `confirming`. Depende del anterior.

## Problem

Los dos writes on-chain de LEARN declaran éxito sobre el **hash de la transacción**,
no sobre su resultado. Una tx que se mina y revierte es indistinguible de una que
tuvo éxito.

- **Badge claim** (`exercises-screen.tsx:1581-1606`): tras `writeContractAsync`
  se dispara `hapticSuccess()`, `justClaimed[piece] = true`, el modal
  `piece-unlocked` de la siguiente pieza, y el overlay `variant: "badge"`. Nunca
  se lee un receipt. Si la tx revierte, el jugador ve la celebración y cree que
  tiene el badge.
- **Score save** (`exercises-screen.tsx:1821-1846`): sí espera el receipt vía
  `useWaitForTransactionReceipt` (`:1016`), pero consume `isSuccess`, que en
  wagmi significa **"la query resolvió"**, no `receipt.status === "success"`.
  viem devuelve el receipt de una tx revertida sin lanzar. Por lo tanto el
  effect de `:1095` corre igual y `recordSaveFor` **persiste el score** de una
  tx revertida.
- Peor: `/api/cache-score` se llama al broadcast (`:1850`), antes de cualquier
  receipt. El leaderboard combinado de Supabase lee esa tabla como la fuente
  `scores` on-chain. Un revert deja un score falso en el leaderboard.
- `sessionStorage["chesscito:optimistic-score"]` (`:1864`) tiene el mismo defecto.

El precedente correcto ya existe **server-side**: `/api/verify-pro/route.ts:60` y
`/api/verify-payment/route.ts:193` chequean `receipt.status !== "success"`.
Ninguna superficie de jugador lo hace.

Este bug precede y domina al de los custom errors: si el revert ocurre después de
firmar, no hay error que decodificar porque nadie lanza nada.

## Goal

Ningún estado de éxito (overlay, celebración, persistencia local, write-through a
Supabase, telemetría `stage: "success"`) se produce hasta que el nodo confirme
`receipt.status === "success"` para esa tx.

## Non-goals

- Shop buy (`use-shop-sheet-state.ts:466`) y victory mint (`use-mint-victory.ts:606`).
  Documentados en "Out of scope" con su hallazgo. Victory además usa
  `injected.waitReceipt`, tipado como `unknown` y casteado a `{ logs }`.
- Decodificar custom errors. Ortogonal, ver `docs/reviews/2026-07-09-custom-errors-plan-redteam.md`.
- Recuperar/reintentar automáticamente una tx revertida.
- Anti-cheat / server-verified progress.

## Contracts (SDD)

### 1. Nuevo error, hermano de `TransactionTimeoutError`

```ts
// lib/contracts/transaction-helpers.ts
import type { Hash, TransactionReceipt } from "viem";

export class TransactionRevertedError extends Error {
  readonly hash: Hash;
  readonly receipt: TransactionReceipt;

  constructor(hash: Hash, receipt: TransactionReceipt) {
    super(`Transaction reverted on-chain: ${hash}`);
    this.name = "TransactionRevertedError";
    this.hash = hash;
    this.receipt = receipt;
  }
}
```

### 2. El helper compartido se vuelve fail-closed

```ts
/** Resuelve SOLO con un receipt cuyo `status === "success"`.
 *  Lanza TransactionRevertedError si la tx se minó y revirtió.
 *  Lanza TransactionTimeoutError si no se minó dentro de timeoutMs. */
export async function waitForReceiptWithTimeout(
  client: PublicClient,
  hash: Hash,
  opts?: { timeoutMs?: number; confirmations?: number },
): Promise<TransactionReceipt>;
```

El cambio de contrato es el **postcondition**: hoy devuelve cualquier receipt;
después devuelve solo receipts exitosos. Los call sites existentes (shop approve,
victory) heredan el fail-closed sin editarlos — deseable, un `approve` revertido
no debe continuar hacia el `buyItem`.

### 3. Clasificación

```ts
// lib/errors.ts
export function isTransactionReverted(error: unknown): boolean;
```

`classifyTxErrorKind` mapea `TransactionRevertedError` → `"revert"` (kind y copy
ya existen: `RESULT_OVERLAY_COPY.error.revert`). **No** se agregan claves de copy,
por lo tanto no hay trabajo de i18n ni de baselines VR.

### 4. Fases del handler

```ts
type OnChainWritePhase = "idle" | "signing" | "confirming" | "settled";
```

`signing` = esperando a la wallet. `confirming` = hash conocido, esperando receipt.

## Behavior

1. Dado un claim de badge, cuando `writeContractAsync` resuelve con un hash,
   entonces la fase pasa a `confirming` y **no** se muestra celebración,
   **no** se setea `justClaimed`, **no** se abre `piece-unlocked`, y la telemetría
   emite `stage: "broadcast"` (no `"success"`).
2. Dado un claim en `confirming`, cuando el receipt llega con `status: "success"`,
   entonces se dispara `hapticSuccess()`, `justClaimed[piece] = true`, el modal
   `piece-unlocked` de la siguiente pieza, el overlay `variant: "badge"`, y
   telemetría `stage: "success"`.
3. Dado un claim en `confirming`, cuando el receipt llega con `status: "reverted"`,
   entonces se muestra el overlay `variant: "error"` con la copy `error.revert`,
   con `retryAction`, y telemetría `stage: "error", error_kind: "revert"`.
   Ningún estado local se muta.
4. Dado un save de score, cuando `writeContractAsync` resuelve con un hash,
   entonces la fase pasa a `confirming` y **no** se llama `/api/cache-score`,
   **no** se escribe `chesscito:optimistic-score`, **no** se llama `recordSaveFor`.
5. Dado un save en `confirming`, cuando el receipt confirma `status: "success"`,
   entonces se llama `recordSaveFor(piece, score)`, se hace el write-through a
   `/api/cache-score`, se escribe el optimistic-score, se refresca el leaderboard,
   y el overlay muestra `variant: "score"`.
6. Dado un save en `confirming`, cuando el receipt revierte, entonces overlay
   `variant: "error"` con `error.revert` y retry. **El score no se persiste en
   ningún lado**: ni local, ni Supabase, ni sessionStorage.
7. Dado cualquiera de los dos en `confirming`, cuando pasan `DEFAULT_TX_TIMEOUT_MS`
   (120s) sin receipt, entonces `TransactionTimeoutError` → kind `"timeout"` →
   copy existente ("Check your wallet or try again"). El estado no se muta: la tx
   puede confirmar más tarde.
8. Dado un handler en `confirming`, cuando el componente se desmonta, entonces
   ningún `setState` corre tras el await (guard `isMountedRef`).
9. La pieza usada al persistir es la capturada **al broadcast**, no la
   `selectedPiece` del momento del receipt. (Invariante que hoy resuelve
   `pendingSubmitRef`; con el handler imperativo lo resuelve el closure.)

## Consecuencia de diseño (no obvia)

Ni badge ni score usan `waitForReceiptWithTimeout` hoy: usan el hook
`useWaitForTransactionReceipt` (`:1005`, `:1016`). Poner el chequeo en el helper
**no los cubre**. Ambos handlers deben volverse imperativos:

```ts
const txHash = await writeWithOptionalFeeCurrency(...);
setPhase("confirming");
track("badge_claim_tx", { stage: "broadcast", piece });
await waitForReceiptWithTimeout(publicClient, txHash);   // lanza si revierte
if (!isMountedRef.current) return;
// ...todo el éxito, acá
```

Los hooks quedan solo para el spinner (`isClaimConfirming`) o se eliminan. El
effect de `:1095` (`isSubmitSuccess` → `recordSaveFor`) se borra, y con él
`pendingSubmitRef` y `doneHoldStartedForTxRef` pierden su razón de ser: hay que
verificar si el "done hold" del overlay depende de ellos antes de sacarlos.

## Edge cases

- **Doble tap** en Claim mientras `confirming`: el CTA debe estar deshabilitado.
  Hoy el guard es `isClaimConfirming` del hook; hay que reemplazarlo por la fase.
- **`publicClient` ausente**: `usePublicClient({ chainId })` puede devolver
  `undefined` en wrong-chain. Hoy shop lanza `"Missing public client"`. Definir:
  si no hay client, ¿fallamos closed (error) o degradamos a optimista? → **fail
  closed**, mostrar error. Un éxito no verificable no se muestra como éxito.
- **Tx reemplazada** (speed-up / cancel desde la wallet): viem lanza
  `TransactionNotFoundError` o resuelve con el reemplazo. Sin cobertura hoy.
- **MiniPay en background**: el WebView puede pausar timers durante los ~5s.
  El timeout de 120s absorbe esto, pero conviene medirlo en device.
- **Receipt con `status: "success"` pero sin el evento esperado**: fuera de
  alcance acá (es el bug de victory: `logs` vacío → `tokenId: null` → éxito).
- **El jugador cierra la app en `confirming`**: la tx confirma sola on-chain, el
  estado local nunca se escribe. Al volver, `useReadContracts` de badges lee la
  verdad. Para score, `recordSaveFor` nunca corre → divergencia local vs chain.
  **Pregunta abierta.**
- **Quota de sesión**: si el save consumió un slot de la sesión diaria al
  broadcast, un revert lo pierde. Verificar dónde se decrementa.

## Acceptance criteria

- [ ] `waitForReceiptWithTimeout` lanza `TransactionRevertedError` cuando el
      receipt trae `status: "reverted"`, y devuelve el receipt cuando es `"success"`.
- [ ] `classifyTxErrorKind(new TransactionRevertedError(...))` devuelve `"revert"`.
- [ ] Badge claim con receipt revertido: no setea `justClaimed`, no abre
      `piece-unlocked`, muestra overlay de error, emite `stage: "error"`.
- [ ] Badge claim con receipt exitoso: mantiene exactamente el comportamiento de hoy.
- [ ] Score save con receipt revertido: `recordSaveFor` no se llama,
      `/api/cache-score` no se llama, `chesscito:optimistic-score` no se escribe.
- [ ] Score save con receipt exitoso: los tres se llaman, en ese orden.
- [ ] Ningún `setState` tras el await si el componente se desmontó.
- [ ] El CTA de Claim/Save está deshabilitado durante `confirming`.
- [ ] Suite completa verde; sin claves de copy nuevas; sin baselines VR nuevos.
- [ ] Smoke en device (mainnet): un claim exitoso sigue celebrando, y el
      overlay de confirmación aparece durante ~5s.

## Out of scope / future

- **Shop buy** (`use-shop-sheet-state.ts:466-484`): setea `successBanner` y
  dispara `fireOnPurchaseSuccess` (que muta shields en el host) sobre el hash
  del `buyItem`, sin esperar su receipt. Hereda el fix del helper solo si se
  agrega el `await`.
- **Victory mint** (`use-mint-victory.ts:601-644`): tipa el receipt como
  `{ logs }`, nunca lee `status`. Un revert deja `logs` vacío → `tokenId: null`
  → `setClaimPhase("success")` con link a celoscan. Decisión ya tomada para
  cuando se aborde: **no confiar en `injected.waitReceipt`**, re-verificar
  `status` con `publicClient.getTransactionReceipt(hash)`.
- Reconciliación al volver a la app tras cerrar en `confirming`.

## Open questions

1. **Score divergente**: si el jugador cierra la app en `confirming` y la tx
   confirma, el score existe on-chain pero no en local ni en Supabase. ¿Se
   reconcilia al montar (leer el scoreboard) o se acepta la divergencia?
2. **Quota de sesión diaria**: ¿dónde se decrementa el slot, al broadcast o al
   éxito? Un revert no debería consumirlo.
3. **`confirmations`**: ¿esperamos 1 confirmación o `undefined` (default de viem)?
   Celo tiene finalidad rápida; 1 debería bastar.
4. ¿El overlay `confirming` es una variante nueva del `ResultOverlay` o reusamos
   el spinner existente? Toca UI → baseline VR en el mismo PR si es nuevo.
