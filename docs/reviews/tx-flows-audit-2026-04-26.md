# Auditoría de Flujos Transaccionales y EIP-712 (2026-04-26)

**Alcance:** Inventario, estados UI, manejo de errores y plan de hardening para todos los flujos que disparan firma o tx on-chain en Chesscito (target: MiniPay WebView, 390px).

---

## 1. Inventario completo de flujos

| # | Flujo | Pantalla origen | Contrato | Función |
|---|---|---|---|---|
| F1 | Mint Victory | `arena/page.tsx:813` (ArenaEndState) | VictoryNFT | `mintSigned()` |
| F2 | Claim Badge | PlayHub → BadgeEarnedPrompt | Badges | `claimBadgeSigned()` |
| F3 | Submit Score | PlayHub post-exercise | Scoreboard | `submitScoreSigned()` |
| F4 | Buy Item Shop | PlayHub → ShopSheet → PurchaseConfirmSheet | Shop | `buyItem(1n,1n,token)` |
| F5 | Buy Coach Credits | Arena → CoachPaywall | Shop | `buyItem(3n\|4n,1n,token)` |
| F6 | Approve Token | Interno (precede F1/F4/F5) | ERC20 | `approve()` |

### Superficies disparadoras

- **F1**: `arena/page.tsx:399` `handleClaimVictory` → `VictoryClaiming` overlay → sign + approve + mintSigned
- **F2**: `play-hub-root.tsx:619` `handleClaimBadge`
- **F3**: `play-hub-root.tsx:672` `handleSubmitScore`
- **F4**: `play-hub-root.tsx:750` `handleConfirmPurchase`
- **F5**: `arena/page.tsx:328` `handleBuyCredits` → CoachPaywall

---

## 2. Inventario de archivos por flujo

### F1 — Mint Victory

| Categoría | Archivos |
|---|---|
| UI | `components/arena/arena-end-state.tsx`, `victory-celebration.tsx`, `victory-claiming.tsx:19-143`, `victory-claim-success.tsx`, `victory-claim-error.tsx` |
| Página | `app/arena/page.tsx:58-589` |
| API | `app/api/sign-victory/route.ts:16-75` |
| ABIs | `lib/contracts/victory.ts` |
| Tokens | `lib/contracts/tokens.ts` (`VICTORY_PRICES`, `formatUsd`) |
| Server | `lib/server/demo-signing.ts:32-48` |
| Cache | `app/api/cache-victory/route.ts` |
| Telemetría | `arena/page.tsx:407,526,565,585` |

### F2 — Claim Badge

| Categoría | Archivos |
|---|---|
| UI | `components/play-hub/result-overlay.tsx:14-65` |
| Lógica | `play-hub-root.tsx:619-670` |
| API | `app/api/sign-badge/route.ts:16-63` |
| ABIs | `lib/contracts/badges.ts` |
| Lectura | `play-hub-root.tsx:410-431` (useReadContracts batched) |
| Errores | `lib/errors.ts:11-53` |

### F3 — Submit Score

| Categoría | Archivos |
|---|---|
| UI | `components/play-hub/result-overlay.tsx:14-65` |
| Lógica | `play-hub-root.tsx:672-748` |
| API | `app/api/sign-score/route.ts:16-78` |
| ABIs | `lib/contracts/scoreboard.ts` |
| Cache | `app/api/cache-score/route.ts` |

### F4 — Buy Item Shop

| Categoría | Archivos |
|---|---|
| UI | `components/play-hub/shop-sheet.tsx`, `purchase-confirm-sheet.tsx:26-149`, `result-overlay.tsx` |
| Lógica | `play-hub-root.tsx:750-849` |
| ABIs | `lib/contracts/shop.ts` |
| Lectura | `play-hub-root.tsx:350-406` |

### F5 — Coach Credits

| Categoría | Archivos |
|---|---|
| UI | `components/coach/coach-paywall.tsx`, `coach-loading.tsx` |
| Lógica | `app/arena/page.tsx:323-395` |
| Verify | `app/api/coach/verify-purchase/route.ts:22-93` |
| Estado | `lib/coach/redis-keys.ts` |

---

## 3. Estados UI por flujo

### F1 (Mint Victory)

| Estado | Trigger | Componente |
|---|---|---|
| idle | `arena/page.tsx:66` (`claimPhase="ready"`) | ArenaEndState + VictoryCelebration |
| signing | `arena/page.tsx:404` | VictoryClaiming (`claimStep="signing"`) |
| confirming | `arena/page.tsx:460` | VictoryClaiming (`claimStep="confirming"`) |
| success | `arena/page.tsx:524` | VictoryClaimSuccess |
| error | `arena/page.tsx:584` | VictoryClaimError |
| cancelled | `arena/page.tsx:566` | Vuelve a ArenaEndState |

### F2 (Claim Badge)

| Estado | Ubicación |
|---|---|
| idle | `play-hub-root.tsx:668` |
| awaiting-signature | sin visual explícito |
| awaiting-receipt | `play-hub-root.tsx:453-459` (`isClaimConfirming`) |
| success | `play-hub-root.tsx:661` (variant=`badge`) |
| error | `play-hub-root.tsx:661` (variant=`error`) |

### F3 (Submit Score)

| Estado | Ubicación |
|---|---|
| idle | `play-hub-root.tsx:677` |
| awaiting-receipt | `play-hub-root.tsx:460-466` (`isSubmitConfirming`) |
| success | `play-hub-root.tsx:700` (variant=`score`) |
| error | `play-hub-root.tsx:740` |

### F4 (Buy Item)

| Estado | Ubicación |
|---|---|
| idle | `play-hub-root.tsx:814` |
| approving | `play-hub-root.tsx:791` |
| buying | `play-hub-root.tsx:814` |
| awaiting-receipt | `play-hub-root.tsx:435-441` (`isShopConfirming`) |
| success | `play-hub-root.tsx:828` |
| error | `play-hub-root.tsx:841` |

UI label: `purchase-confirm-sheet.tsx:136-143`.

---

## 4. Errores técnicos crudos al usuario

| Ubicación | Patrón | Riesgo |
|---|---|---|
| `arena/page.tsx:562` | `err instanceof Error ? err.message` | Alto — ContractFunctionExecutionError sin sanitizar |
| `play-hub-root.tsx:658,839` | `toErrorMessage(error)` con fallback `JSON.stringify` | Medio |
| `lib/errors.ts:52` | fallback a `copy.unknown` | Bajo |
| `purchase-confirm-sheet.tsx:106` | `CHAIN_NAMES[chainId] ?? "Unknown network"` | Medio |
| `play-hub-root.tsx:114-117` | `txLink()` asume chainIds conocidos | Bajo |

`itemId`/`levelId` no se exponen al usuario en error path.

---

## 5. Cancelación del usuario (UserRejectedRequestError)

| Flujo | Detección | Acción | Estado posterior |
|---|---|---|---|
| F1 | `arena/page.tsx:563-568` regex `/user (rejected\|denied\|cancelled)/i` | `setClaimPhase("ready")` + telemetría `stage:cancelled` | Vuelve a ArenaEndState |
| F2 | `play-hub-root.tsx:654` `isUserCancellation()` | `setClaimingPiece(null)`, sin overlay | Vuelve a ContextualActionSlot |
| F3 | `play-hub-root.tsx:732` | toast `submitCanceled`, sin overlay | Sesión puede reintentar |
| F4 | `play-hub-root.tsx:837` | `setConfirmOpen(false)`, sin telemetría | Sheet cierra silencioso |
| F5 | `arena/page.tsx:391` regex similar | `setCoachPhase("idle")` | Permanece en Paywall, fallback a CoachFallback |

---

## 6. Tx pendiente sin timeout

| Archivo | Línea | Función | Timeout |
|---|---|---|---|
| `arena/page.tsx` | 358 | handleClaimVictory approve | ❌ |
| `arena/page.tsx` | 370 | handleBuyCredits buy | ❌ |
| `arena/page.tsx` | 456 | handleClaimVictory approve confirm | ❌ |
| `arena/page.tsx` | 485 | handleClaimVictory mintSigned | ❌ |
| `play-hub-root.tsx` | 809 | handleConfirmPurchase approve | ❌ |

**Patrón ausente en TODA la codebase**: ningún `waitForTransactionReceipt(..., { timeout: N })`.

Impacto: si wallet desconecta o red cae, F1 cuelga indefinidamente con back button deshabilitado (red-team H1, H3).

---

## 7. Tx confirma on-chain pero UI no refresca

### Patrones conocidos (red-team 2026-04-05)

- **H2** (`arena/page.tsx:105-109`): restore `claimPhase="claiming"` desde sessionStorage con `game.status !== "end"` → `VictoryClaiming` overlay sin propósito visible.
- **H4** (`page.tsx:789-793`): `setConfirmOpen(true)` sin `setStoreOpen(false)` → ambas sheets visibles.
- **M5** (`arena/page.tsx:74-88`): `claimPhase="success"` restaurado pero `game.status==="selecting"` → no renderiza success overlay.

### Mecanismos actuales

| Flujo | Mecanismo | Riesgo |
|---|---|---|
| F1 | sessionStorage optimistic + Supabase write-through (`arena/page.tsx:532-559`) | optimistic nunca se lee en reload — `/trophies` consume Supabase API |
| F3 | optimistic + write-through (`play-hub-root.tsx:720-730`) | leaderboard lee API, no sessionStorage |
| F4 | `useWaitForTransactionReceipt` + `setPendingShieldCredit` (`play-hub-root.tsx:435-452`) | sólo sincroniza para shields |

**Escenario peligroso**: si `/api/cache-victory` falla, tx en chain pero `/trophies` no muestra la victoria.

---

## 8. Blast radius

| Flujo | $ perdido | Progreso perdido | Shareability | Score |
|---|---|---|---|---|
| F3 Submit Score | 0 | leaderboard puede no reflejar si Supabase falla | Bajo | 5/10 |
| **F1 Mint Victory** | **fee** | NFT on-chain pero tokenId perdido si event parsing falla | **Alto (OG share 404)** | **9/10** |
| F2 Claim Badge | 0 | badge soulbound on-chain pero invisible si cache falla | Medio | 6/10 |
| Retry Shield | $0.025 | localStorage editable | n/a | 2/10 |

**Ganador**: **F1**. Combinación dinero + share + falla de extracción de tokenId (M11) lo hace el de mayor riesgo de romper confianza.

---

## 9. Hook compartido vs implementación dispersa

**No existe** `useMiniPayTransaction` ni equivalente. Cada superficie reimplementa.

### Estado fragmentado

| Flujo | Patrón | Espera |
|---|---|---|
| F1 | `useWriteContract` + 3× `publicClient.waitForTransactionReceipt` (await explícito) | bloqueante |
| F3 | `useWriteContract` + `useWaitForTransactionReceipt` hook | no-bloqueante |
| F4 | hook + `setPendingShieldCredit` optimistic | híbrido |
| F5 | `publicClient.waitForTransactionReceipt` + `/api/coach/verify-purchase` | bloqueante con verify |

### Consecuencia

No hay punto único de verdad. Error handling, timeouts, retry, loading states se duplican o difieren. Red Team H7/M8 surgen directamente de esto.

---

## 10. Mejoras pure frontend (sin tocar contrato/API)

| # | Mejora | Esfuerzo | Archivos |
|---|---|---|---|
| PF1 | Timeout default 2min en todos los `waitForTransactionReceipt` | 2h | arena/page.tsx, play-hub-root.tsx |
| PF2 | Reset `showPieceComplete` en piece rail switch | 15m | play-hub-root.tsx:735-744 |
| PF3 | Guard sheet dismiss durante active tx | 30m | purchase-confirm-sheet.tsx |
| PF4 | Unificar `classifyTxError` en todos lados | 1h | arena/page.tsx |
| PF5 | Cancel button en `VictoryClaiming` | 20m | components/arena/victory-claiming.tsx |
| PF6 | Concurrency guard en `handleSubmitScore` | 15m | play-hub-root.tsx:474 |
| PF7 | Elapsed counter en spinner loops | 45m | victory-claiming.tsx, result-overlay.tsx |
| PF8 | Alinear badge auto-dismiss con "Later" | 30m | play-hub-root.tsx:555-558 |

---

## 11. Mejoras backend / contrato

| # | Mejora | Bloquer | Notas |
|---|---|---|---|
| BB1 | Validar transcript con `chess.js` server-side | B1, B4 | `/api/sign-victory` recibe `moveHistory` |
| BB2 | `PrizePoolDistributor` contrato nuevo | B2 | epoch + merkle distribution |
| BB3 | Rate limiter Redis | B3 | ya migrado en `demo-signing.ts` ✅ |
| BB4 | Anti-replay nonce | n/a | ya implementado vía `createNonce()` ✅ |

---

## 12. Propuesta `useMiniPayTransaction` + `TransactionStatus`

### API del hook

```ts
interface TxFlowConfig {
  steps: ('approve' | 'primary' | 'verify')[];
  timeout?: number;          // default 120s/paso
  onSuccess?: (r: TransactionReceipt) => Promise<void>;
  onError?: (e: Error) => void;
  feeCurrency?: `0x${string}`;
}

interface TxFlowState {
  phase: 'idle' | 'preparing' | 'awaiting-signature'
       | 'awaiting-receipt' | 'success' | 'error' | 'cancelled' | 'timeout';
  currentStep: number;
  txHash: `0x${string}` | null;
  error: Error | null;
  elapsedMs: number;
}

function useMiniPayTransaction(config: TxFlowConfig): [TxFlowState, TxFlowHandlers];
```

### Componente

```ts
interface TransactionStatusProps {
  state: TxFlowState;
  config: TxFlowConfig;
  onRetry?: () => void;
  onCancel?: () => void;
  variant?: 'banner' | 'overlay' | 'sheet';
}
```

### Migración

| Flujo | Antes | Después |
|---|---|---|
| F1 | `useWriteContract` + 2× `waitForTransactionReceipt` | `useMiniPayTransaction({ steps: ['approve','primary'] })` |
| F3 | hook write + hook receipt manual | `useMiniPayTransaction({ steps: ['primary'] })` |
| F4 | hook + `setPendingShieldCredit` | `useMiniPayTransaction({ steps: ['approve','primary'] })` |
| F5 | manual + verify-purchase | `useMiniPayTransaction({ steps: ['approve','primary'], onSuccess: callVerifyPurchase })` |

---

## 13. Plan mínimo de commits

Orden por impacto/riesgo. Branch sugerido: `feature/minipay-tx-hardening`.

### Commit 1 — Global tx timeout (alto / bajo)
- `lib/contracts/transaction-helpers.ts` (nuevo): `waitForReceiptWithTimeout(hash, 120s)`
- Reemplazar 5 callsites en arena/page.tsx + play-hub-root.tsx
- Fixes red-team H3

### Commit 2 — Reset overlay state (bajo / muy bajo)
- `play-hub-root.tsx:596-599`: `setShowPieceComplete(false)` en switch
- Extraer `handleDismissBadgeEarned()` compartido entre timer y "Later"
- Fixes H6, M3

### Commit 3 — Guard sheet dismissal durante tx (medio / bajo)
- `purchase-confirm-sheet.tsx:40-41`: `canDismiss = !isWriting && phase === "idle"`
- Fixes H5, M9

### Commit 4 — Sanitize errors via `classifyTxError` (medio / bajo)
- `arena/page.tsx:571-582`: reemplazar regex custom
- Eliminar branches duplicadas en `RESULT_OVERLAY_COPY.error`
- Cierra Q4

### Commit 5 — Concurrency guard submit score (bajo / muy bajo)
- `play-hub-root.tsx:672`: condicionar a `isSubmitBusy`
- Fixes H7

### Commit 6 — Cancel state en VictoryClaiming (bajo / bajo)
- Nuevo `claimPhase: "cancelled"`
- Quitar `disabled={claimStep !== "done"}` en victory-claiming.tsx
- Fixes H1

### Commit 7 — Auto-close shop sheet en confirm (bajo / muy bajo)
- `play-hub-root.tsx:825`: `setStoreOpen(false)` antes de `setConfirmOpen(true)`
- Fixes H4

### Commit 8 — `useMiniPayTransaction` + `TransactionStatus` (alto / medio)
- Nuevos: `lib/hooks/useMiniPayTransaction.ts`, `components/transaction/transaction-status.tsx`
- Refactor F1 y F4 detrás de `NEXT_PUBLIC_USE_UNIFIED_TX_HOOK=false`
- Test paralelo en testnet antes de habilitar

---

## Resumen ejecutivo

1. **6 flujos**, todos reimplementan `waitForTransactionReceipt` sin timeout — fragmentación severa.
2. **F1 (Mint Victory) tiene el blast radius más alto**: dinero + NFT + share, con 3 puntos sin timeout y back button atrapado durante el claim.
3. **8 commits propuestos**: 1–7 son frontend puro (~6–8 horas, paralelizables); el 8 introduce la abstracción detrás de feature flag.
4. **Bloqueadores backend**: BB1 (transcript replay) y BB2 (PrizePoolDistributor) son la base de la Fase 1 del monetization audit.
