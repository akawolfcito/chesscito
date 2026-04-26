# MiniPay Transaction UX Fluidity — Design Spec

**Date**: 2026-04-26  
**Status**: Draft  
**Author**: Senior Product Engineer (Web3 UX, MiniPay)  
**Driver**: docs/reviews/tx-flows-audit-2026-04-26.md

---

## 1. Executive decision

Normalizar y fluir todos los 6 flujos transaccionales (F1–F6) bajo un estado machine compartido con copy humanizado, recuperación sin fricción, e intención clara antes de abrir MiniPay. Los componentes UI ya existen en 4 superficies; lo que falta es coherencia, timeout handlers, y entrada "pre-wallet intent". Esto cierra 7 de 11 findings del Red Team (H1-H7, M3-M9) sin schema changes ni redeploy contrato.

---

## 2. Product framing: on-chain as part of the game

**No es**: educación cripto, formularios de setup, jergas técnicas, "DeFi" como feature.

**Es**: cada transacción es una acción del juego que se siente como tal. El loop es **jugar → ganar → entender el valor → confirmar en MiniPay → ver el progreso/recompensa en el juego → volver a jugar**. El usuario ya usa MiniPay/cripto (está en el app); lo que necesita es:

- **Intención clara** (qué va a pasar y por qué antes de abrir wallet)
- **Confianza** (copy que respeta su inteligencia, sin pánico)
- **Feedback en tiempo real** (qué step está pasando, cuánto falta)
- **Recuperación digna** (si cancela, timeout, o falla: vuelve al juego sin quedar atrapado)
- **Continuidad** (si se desconecta y vuelve, el sistema entiende dónde estaba)

---

## 3. Current tx map

| # | Flujo | Pantalla | Estado actual UX | Qué está bien | Qué está mal / falta |
|---|---|---|---|---|---|
| **F1** | Mint Victory | `arena/page.tsx:813` | Bueno (3-state) | VictoryClaiming + VictoryClaimSuccess UI flow claro, timeout 120s ya existe | Back button atrapado H1; no detect-receipt-post-navigate (M5); share-link timeout no maneja tokenId-parse-fail (M11) |
| **F2** | Claim Badge | `play-hub-root.tsx:619` | Parche (overlay sin visual) | Copy en editorial.ts | Sin visual awaiting-signature; copy duplicado (error/cancelled/timeout); auto-dismiss distinto de "Later" (M3) |
| **F3** | Submit Score | `play-hub-root.tsx:672` | Parche (toast + overlay) | Concurrency guard ya existe | Sin visual awaiting-receipt; copy no trata timeout; no guard durante piece-switch reset |
| **F4** | Buy Item Shop | `play-hub-root.tsx:750` | Parche (sheet) | Approve + buy phased | Sheet dismiss durante tx (H5, M9); shop sheet persiste bajo confirm (H4); copy normalizado a error classification |
| **F5** | Buy Coach Credits | `arena/page.tsx:323` | Parche (paywall) | Verify-purchase server-side | Mismo patrón F4; timeout no documentado; copy igual a genérico |
| **F6** | Approve Token | Interno (precede F1/F4/F5) | Oculto | ERC20 pattern works | Sin visual del usuario (correcto — solo para internals) |

**Resumen**: F1 es la mejor (journey visible, states aclarados, timeout); F2-F5 importan copy + estado visual + recovery; F6 no necesita atención UX (no es player-facing).

---

## 4. Ideal player journey per flow

Cada flujo sigue este patrón ideal. Ajustes por flujo:

### F1 — Mint Victory (Arena endstate → trophy claim)

- **Pre-wallet** (1–2s visual): VictoryCelebration card muestra estatísticas (difficulty, moves, time) → botón "Claim Victory" claro con ícono de trophy.
- **Wallet open** (3–5s): MiniPay pide firma (approve token). VictoryClaiming overlay muestra step progress: "Approving…" (1/3 visual dot), hints "your tx is in the wallet, check there if you don't see a popup".
- **Post-confirm pending** (awaiting-receipt, 0–120s): Same overlay, step 2/3 "Confirming on-chain…", spinner + elapsed time. Si sale de pantalla durante esto, sessionStorage guarda phase=awaiting-receipt + hash.
- **Success** (0.5s celebration): VictoryClaimSuccess overlay full-screen, trophy animation, stats recap, "Share" button, "Play Again" CTA, "Back to Hub" quiet option.
- **Cancel** (instant): User rechaza firma en MiniPay → setClaimPhase("cancelled"), sessionStorage limpiar, volver a VictoryCelebration sin pérdida de contexto.
- **Error** (retry context): VictoryClaimError muestra copy humanizado (classifyTxError), opción "Try Again" resume la firma, no resetea el game state.
- **Timeout** (>120s sin receipt): VictoryClaiming muestra copy timeout: "This is taking longer than expected. Check your wallet or try again." Back button habilita, permite cancelar sin perder el hash para polling post-navigate.
- **Return** (post-navigate): Reload y game.status !== "end" → detectar si hash en sessionStorage con receipt on-chain → jump a VictoryClaimSuccess directamente.

### F2 — Claim Badge (PlayHub post-exercise)

- **Pre-wallet** (1–2s): BadgeEarnedPrompt overlay con ícono del piece + "Claim Badge" CTA. Si wallet no conectada → ghost button, "Connect wallet first".
- **Wallet open** (2–5s): MiniPay signature request (EIP-712 claimBadgeSigned). ResultOverlay no visible aquí (placeholder text solo).
- **Post-confirm pending** (0–90s): Transición a ResultOverlay variant="badge" con "Claiming…" state. Elapsed timer si >10s.
- **Success** (0.5s): ResultOverlay muestra badge image + copy "Claimed! This badge is now in your wallet" + stars earned + Share button + "Later" (dismiss).
- **Cancel**: Dismiss BadgeEarnedPrompt → claimingPiece=null, no toast visible.
- **Error**: ResultOverlay variant="error" + classifyTxError copy.
- **Timeout**: ResultOverlay con copy timeout, opción "Try Again".
- **Return**: Auto-dismiss en 15s si "Later" no presionado. Reinicio Board state sin badge data stale.

### F3 — Submit Score (PlayHub post-all-exercises)

- **Pre-wallet** (1–2s): BadgeEarnedPrompt (si badge unlocked) o directamente FOOTER_CTA "Submit Score". Muestra score acumulado (ej. "45 ★").
- **Wallet open** (2–5s): MiniPay signature request (submitScoreSigned).
- **Post-confirm pending** (0–90s): ResultOverlay variant="score" + "Recording…" state.
- **Success** (0.5s): ResultOverlay + "Score Recorded! Sealed on Celo — this record is yours forever." + Link a Celoscan + Share + "Continue" CTA.
- **Cancel**: Toast "Submission canceled" → board reset sin acción.
- **Error**: ResultOverlay error variant + copy.
- **Timeout**: ResultOverlay timeout copy + "Try Again".
- **Return**: Leaderboard API reads on-chain, no sessionStorage cache (authoritative).

### F4 — Buy Item Shop (PlayHub bottom sheet)

- **Pre-wallet** (1–2s): ShopSheet → item card (ej. Retry Shield, Coach 5-pack) → "Buy with USDC" button. User ve precio + CTA claro.
- **Sheet open confirm** (1–2s): PurchaseConfirmSheet muestra item name + price + network warning ("MiniPay may show 'Unknown transaction'") + "Confirm Purchase" CTA.
- **Wallet open approve** (3–5s): MiniPay approval request. PurchaseConfirmSheet muestra "Approving USDC…" state (phase=approving).
- **Wallet open buy** (2–5s después): MiniPay buyItem request. PurchaseConfirmSheet muestra "Buying…" state (phase=buying). Sheet no dismissable durante esto (H5, M9).
- **Post-confirm pending** (0–120s): Mismo sheet, "Processing on-chain…" con elapsed timer.
- **Success** (0.5s): ResultOverlay variant="shop" + "Purchase Complete! Item acquired — thank you for supporting Chesscito." + Share + "Continue".
- **Cancel** (durante approve): Phase retorna a idle, sheet cierra, no toast (usuario entiende que canceló).
- **Cancel** (durante buy después de approve): Phase retorna a idle, sheet cierra, pero user sabía que USDC fue aprobado.
- **Error**: ResultOverlay error variant + copy (ej. "Insufficient funds" si approve pasó pero buy falló).
- **Timeout**: ResultOverlay timeout copy.
- **Return**: Item acquisition leído desde on-chain (Shop.balanceOf), no sessionStorage optimistic.

### F5 — Buy Coach Credits (Arena CoachPaywall)

- **Pre-wallet** (1–2s): CoachPaywall muestra dos packs: "5 Credits ($0.05)" + "20 Credits ($0.10)". Usuario elige → "Buy Pack" CTA.
- **Sheet open confirm** (1–2s): PurchaseConfirmSheet (reutilizado F4) para Coach pack.
- **Wallet open approve + buy** (5–10s total): Same flow F4 (approve → buyItem).
- **Verify post-tx** (backend async): `/api/coach/verify-purchase` comprueba ItemPurchased event + escribe Redis coach:credits:<wallet>.
- **Success** (0.5–2s): ResultOverlay variant="shop" + "Coach Credits Added! You can now request analysis" + Share + "Continue" → cierra PayWall, muestra CoachPanel o CoachLoading si está en mid-analysis.
- **Cancel/Error/Timeout**: Same as F4.
- **Return**: Coach credits read from `/api/coach/credits`, no sessionStorage (authoritative).

---

## 5. State model

Estado machine compartido para todos los flujos (excepto F6 que es interno). Transiciones válidas:

```
idle
  ├─→ preparing       (user taps CTA, validar wallet/chain/balance antes de abrir wallet)
  ├─→ awaiting-signature (MiniPay abierto, esperando firma del usuario)
  │    ├─→ awaiting-receipt  (firma confirmada, esperando tx receipt on-chain)
  │    ├─→ cancelled         (user rechazó firma en MiniPay)
  │    └─→ error            (firma falló — network, etc.)
  ├─→ awaiting-receipt (después del approve, si flujo multi-tx como F1/F4)
  │    ├─→ success          (receipt llegó, tx confirmada)
  │    ├─→ timeout          (120s sin receipt — permitir retry)
  │    ├─→ error            (receipt con revert, insufficient funds, etc.)
  │    └─→ cancelled        (user cerró wallet mid-confirm, aunque menos probable aquí)
  ├─→ success         (receipt + write-through confirmado, mostrar celebración)
  │    └─→ idle       (user dismisses overlay, resetea state)
  ├─→ cancelled       (user rejected o dismissed sin quedar atrapado)
  │    └─→ idle
  ├─→ timeout         (awaiting-receipt > 120s, copy informativo)
  │    ├─→ awaiting-receipt  (retry)
  │    └─→ idle       (user dismisses)
  └─→ error           (fallida in any step)
       ├─→ preparing   (retry)
       └─→ idle        (dismiss)
```

**Restricciones**:
- `preparing` durará <2s (validación síncrona solamente).
- `awaiting-signature` no tiene timeout interno (MiniPay controla el timeout).
- `awaiting-receipt` tiene timeout 120s (timer en client, helper `waitForReceiptWithTimeout`).
- Una vez en `success` no hay transición atrás (es terminal; dismiss retorna a idle).
- `cancelled` y `error` son terminales a menos que user toque "Try Again" (que retorna a `preparing` o `awaiting-signature`).

---

## 6. Copy matrix

Para cada flujo × cada estado, copy específico. Reusar de `editorial.ts` cuando exista; proponer nuevo cuando falte.

| Flujo | Estado | Header | Body | CTA | Notas |
|---|---|---|---|---|---|
| **F1: Mint Victory** | preparing | — | — | — | No visible (validación <2s) |
| — | awaiting-signature | "Claiming Victory" | "Approve token to mint your NFT" | [MiniPay] | ARENA_COPY.backToHub button |
| — | awaiting-receipt | "Confirming on-chain…" | "Your tx is submitted. This usually takes 30–60 seconds." | [Progress dots + timer] | VICTORY_CLAIM_COPY.progressTimeHint |
| — | success | VICTORY_CLAIM_COPY.successTitle | VICTORY_CLAIM_COPY.successSubtitle | "Play Again" + "Share" + "Back to Hub" | VictoryClaimSuccess component |
| — | cancelled | VictoryCelebration restored | "Claim canceled. Ready to try again?" | "Claim Victory" | sessionStorage limpiar, setState(claimPhase="ready") |
| — | timeout | VictoryClaiming | RESULT_OVERLAY_COPY.error.timeout | "Try Again" + "Back to Hub" | "Check your wallet — your tx may still be pending." |
| — | error | "Claim Failed" | classifyTxError(error) | "Try Again" + "Back to Hub" | VictoryClaimError component |
| **F2: Claim Badge** | preparing | — | — | — | No visible |
| — | awaiting-signature | "Claiming Badge" | (no body; overlay mínimo) | [MiniPay] | ResultOverlay no visible aún |
| — | awaiting-receipt | "Claiming…" | "Recording your achievement on Celo." | [Spinner + elapsed time] | Transición a ResultOverlay variant="badge" |
| — | success | RESULT_OVERLAY_COPY.badge.title | RESULT_OVERLAY_COPY.badge.subtitle | "Share" + "Continue" | ResultOverlay component |
| — | cancelled | BadgeEarnedPrompt | (usuario puede reintentar o "Later") | "Claim Badge" (re-enable) | claimingPiece=null |
| — | timeout | ResultOverlay | RESULT_OVERLAY_COPY.error.timeout | "Try Again" + "Dismiss" | — |
| — | error | "Claim Failed" | classifyTxError(error) | "Try Again" + "Dismiss" | ResultOverlay variant="error" |
| **F3: Submit Score** | preparing | — | — | — | No visible |
| — | awaiting-signature | "Submitting Score" | "Approve the submission with your wallet." | [MiniPay] | FooterCTA "Submit Score" disabled |
| — | awaiting-receipt | "Recording…" | "Sealing your score on Celo." | [Spinner] | ResultOverlay badge variant (pero sin image, solo texto) |
| — | success | RESULT_OVERLAY_COPY.score.title | RESULT_OVERLAY_COPY.score.subtitle | "Share" + "Continue" | ResultOverlay component |
| — | cancelled | Board resets | "Submission canceled" (toast) | Resume play | FooterCTA re-enable |
| — | timeout | ResultOverlay | RESULT_OVERLAY_COPY.error.timeout | "Try Again" + "Dismiss" | — |
| — | error | "Submission Failed" | classifyTxError(error) | "Try Again" + "Dismiss" | ResultOverlay |
| **F4: Buy Item** | preparing | — | — | — | No visible |
| — | awaiting-signature | PURCHASE_CONFIRM_COPY.title | PURCHASE_CONFIRM_COPY.description | [MiniPay] | PurchaseConfirmSheet; item name visible; price visible |
| — | approving | "Approving USDC…" | "Signing the token approval." | [Disabled; sheet non-dismissable] | phase="approving"; button disabled |
| — | awaiting-receipt (approve) | "Approving USDC…" | "Your approval is submitted." | [Spinner] | Still phase="approving" |
| — | awaiting-signature (buy) | "Confirming Purchase…" | "Approve the item purchase." | [MiniPay] | phase="buying" |
| — | awaiting-receipt (buy) | "Processing…" | "Recording your purchase on Celo." | [Spinner + elapsed] | phase="buying" |
| — | success | RESULT_OVERLAY_COPY.shop.title | RESULT_OVERLAY_COPY.shop.subtitle | "Share" + "Continue" | ResultOverlay component |
| — | cancelled (approve) | PurchaseConfirmSheet reset | (sheet closes, no error) | ReturnToShop | phase→idle, setConfirmOpen(false) |
| — | cancelled (buy post-approve) | PurchaseConfirmSheet reset | (user knows USDC was approved) | ReturnToShop | phase→idle; note: USDC approval was signed, buyItem didn't submit |
| — | timeout | ResultOverlay | RESULT_OVERLAY_COPY.error.timeout | "Try Again" + "Dismiss" | — |
| — | error | "Purchase Failed" | classifyTxError(error) | "Try Again" + "Dismiss" | Specific: "Insufficient funds", "Network error", etc. |
| **F5: Buy Coach Credits** | all states | (same as F4, pero con Coach pack copy) | — | — | COACH_COPY.*, COACH_PACK_ITEMS naming |
| — | success | RESULT_OVERLAY_COPY.shop.title | "Coach Credits Added! Request analysis now." | "Share" + "Continue" | Post-verify from Redis |

**Notas de copy**:
- Todos los "Try Again" CTAs retornan a `preparing` (re-validate wallet + balance).
- Timeout copy: `RESULT_OVERLAY_COPY.error.timeout` = "This is taking longer than expected. Check your wallet or try again." (ya existe).
- Cancelled copy: Debe ser genérico y permitir retry sin culpar al usuario.
- Siempre usar `classifyTxError()` para errores on-chain.

---

## 7. Recovery rules

Reglas duras de recuperación para cada scenario. Sin excepciones.

### A. User cierra MiniPay durante awaiting-signature

- **Acción**: sessionStorage limpia fase temp (ej. `claimPhase="signing"` → `claimPhase="ready"`).
- **UI**: Retorna a pantalla pre-wallet (ej. VictoryCelebration).
- **Telemetría**: track("tx_cancelled", { flow: "F1", stage: "signature-rejected" }).
- **Ejemplo F1**: User ve VictoryClaiming, MiniPay abre, cierra sin firmar → VictoryClaiming sale, vuelve a VictoryCelebration.

### B. Tx queda en awaiting-receipt >120s (timeout helper ya existe)

- **Acción**: `waitForReceiptWithTimeout(hash, 120s)` lanza `TransactionTimeoutError`.
- **UI**: Mostrar estado `timeout` con copy humanizado: "This is taking longer than expected. Check your wallet — your tx may still be pending."
- **CTA**: "Try Again" (reintenta receipt poll), "Dismiss" (permite salir sin marcar como error).
- **sessionStorage**: Guardar `txHash` + `phase=timeout` para post-navigate detection.
- **Telemetría**: track("tx_timeout", { flow: "F1", elapsed_ms: 120000 }).

### C. User navega fuera durante awaiting-receipt (F1, F4, F5)

- **sessionStorage guards**: Antes de navigar, guardar `{ phase: "awaiting-receipt", txHash, flow: "F1" }` en sesión storage clave específica (ej. `chesscito:claiming-victory`).
- **Post-navigate restore**: En `arena/page.tsx` mount, si sessionStorage tiene `claiming-victory` + `game.status !== "end"` → skip restore (usuario regresó a juego nuevo). Si sessionStorage tiene `claiming-victory` + `game.status === "end"` → check receipt on-chain con `publicClient.getTransactionReceipt(hash)`, si confirm → jump a success overlay.
- **Polling timeout**: 60s polling (intentar cada 5s), luego dar up y mostrar "Still pending in your wallet, check there or refresh."
- **Telemetría**: track("tx_recovered_post_navigate", { flow, receipt_found: boolean }).

### D. Supabase write-through falla post-tx confirm on-chain

- **Scenario**: Tx confirmada en chain (receipt got), pero `/api/cache-victory` o `/api/cache-score` falló.
- **UI**: Mostrar success overlay anyway (tx es verdad en chain).
- **Background**: Retry cron (`/api/cron/sync`) hará rollup en 15 min.
- **sessionStorage optimistic**: Ya existe en F1 (optimistic-victory). No cambia.
- **Nota**: Usuario ve success; datos on-chain son source-of-truth.

### E. Sheet dismissible durante active tx (H5, M9)

- **Guard**: En `PurchaseConfirmSheet`, prop `onOpenChange` debe verificar: `canDismiss = phase === "idle" && !isWriting`.
- **Behavior**: Si user intenta tap backdrop / swipe durante `phase="approving"` o `phase="buying"`, sheet no cierra (visual feedback opcional, ej. slight vibration o opacity flicker).
- **Copy hint**: PURCHASE_CONFIRM_COPY.miniPayWarning ya advierte "MiniPay may show Unknown transaction…"
- **Telemetría**: track("sheet_dismiss_blocked", { phase, isWriting }).

### F. Piece rail switch durante awaiting-receipt (M5, H6)

- **Scenario**: User en PlayHub, submit score tx pending, user cambia de piece.
- **Guard**: En `handlePieceRailClick`, verificar si `isSubmitConfirming`. Si true, ignore click.
- **sessionStorage**: Ya se guarda `submitScoreBusy` en state machine. Disable la piece rail visualmente durante la tx.
- **Copy**: (silent recovery; no toast needed).

### G. Double-tap guard para Submit Score (H7)

- **Status**: Ya implementado en `5e354ae` (concurrency guard).
- **Keep**: `isSubmitBusy` check bloquea segundo `handleSubmitScore` call.
- **Telemetría**: ya existe.

### H. Claim back button (H1)

- **Status**: Ya parcialmente arreglado (timeout back button será habilitado). VictoryClaiming component debe recibir `claimStep` prop de arena/page.tsx.
- **Check**: Si `claimStep === "done"` o `claimPhase === "success"` o `claimPhase === "cancelled"`, back button habilitado. Si `claimStep === "signing"` o `claimStep === "confirming"`, back button habilitado (permitir salir sin bloquear — el handler revierte a `claimPhase="ready"`).
- **Fix**: Remover `disabled={claimStep !== "done"}` condicional.

---

## 8. Implementation strategy

**Premisa**: Flujos transaccionales cohesivos sin abstracción prematura. Los puntos de fricción son:
1. Copy/state fragmentado por flujo (F1 completo, F2-F5 parches).
2. Timeout handlers inconsistentes (F1 existe, F2-F5 faltan).
3. Recovery rules no documentadas.
4. Sheet dismissal guards olvidados (H5, M9).

**Enfoque**:
- **Primero** (commits 1–4): Fixes puntuales de máximo riesgo (H1, H3, H5, H7, M9). Paralelizables, bajo riesgo de regresión.
- **Segundo** (commits 5–6): Copy normalization + state alineación por flujo.
- **Tercero** (commit 7): Recovery polling post-navigate para F1/F4 (opcional en MVP).
- **Cuarto** (commit 8, diferido): `useMiniPayTransaction` hook + `TransactionStatus` component (abstracción). Require paralelo testing en testnet con feature flag.

**Razón del orden**: Los fixes puntuales cierran Red Team issues ahora (release-blocking). Copy + recovery se aprueba en este sprint sin código nuevo. Hook refactor es nice-to-have para el sprint siguiente (reduce duplicación para F2-F5 cuando se agranden).

---

## 9. First batch commits

Orden: impacto × riesgo × paralelización.

| # | Commit | Scope | Riesgo | Valor | Verificación |
|---|---|---|---|---|---|
| **1** | Back button + timeout state for VictoryClaiming | `components/arena/victory-claiming.tsx:96–103`, `app/arena/page.tsx:58–589` | Bajo | Alto — cierra H1, H3 | Manual: Win → Claim Victory → observe back button always enabled + timeout copy visible |
| **2** | Sheet dismiss guard + isWriting check | `components/play-hub/purchase-confirm-sheet.tsx:40–41` | Muy bajo | Medio — cierra H5, M9 | Manual: Open Shop → Buy Item → Approving state → try tap backdrop → sheet should not close |
| **3** | Concurrency guard for piece rail (H6) | `app/page.tsx:735–744` | Muy bajo | Bajo — M5 fix | Manual: Complete exercises → PieceCompletePrompt visible → submit score tx → try click piece rail → ignored |
| **4** | Auto-close shop sheet on confirm open | `app/page.tsx:789–793` | Muy bajo | Bajo — closes H4 | Manual: Open Shop → tap Buy → both sheets visible before fix, only confirm visible after |
| **5** | Copy matrix alignment F2–F5 error states | `lib/content/editorial.ts`, result-overlay, purchase-confirm-sheet | Bajo | Medio — UX coherence | Review: All error paths use classifyTxError(), no raw messages |
| **6** | sessionStorage timeout + recovery guards | `arena/page.tsx:74–88`, `lib/contracts/transaction-helpers.ts` (comment only) | Medio | Alto — M11 + recovery safety | E2E: Start claim → refresh mid-tx → reload should detect receipt if confirmed |

**Recomendación para primer commit** (ver Confirmación pendiente, abajo): **Commits 1–4 como batch atómico** (todas fixes puntuales de máximo impacto, <6h parallelizable). Luego commits 5–6 una vez aprobado copy.

---

## 10. Testing plan

### Unit tests (vitest, 47 existing files)
- `lib/errors.test.ts`: `classifyTxError` todas ramas (user cancel, timeout, network, insufficient funds, revert, unknown).
- `lib/contracts/transaction-helpers.test.ts`: `waitForReceiptWithTimeout` timeout branch (mock viem).
- `hooks/use-minipay.test.ts` (nuevo si commit 8): mock writeContractAsync + timeout para cada flujo.

### Integration tests (vitest + wagmi mock)
- `arena.integration.test.ts`: F1 flow (prepare → approve → awaiting-receipt → success).
- `play-hub.integration.test.ts`: F2, F3, F4 flows con state transitions.
- Timeout branch: mock 121s elapsed → assert `isTransactionTimeout()` true.

### E2E tests (Playwright, 390px viewport)
- `e2e/arena-claim-victory.spec.ts`: Win → Claim → approve → mint → success → share → back. Snapshot check VictoryClaiming progress + VictoryClaimSuccess.
- `e2e/shop-purchase.spec.ts`: Open Shop → select item → approve + buy → success.
- `e2e/recovery-post-navigate.spec.ts` (si commit 6): Start claim → navigate away → return → check receipt is detected.
- Timeout branch: mock network slow (5s latency) → assert timeout UI visible.
- Mobile smoke: MiniPay 390px viewport on all flows.

### Visual snapshots (playwright, 18 existing)
- Victory: VictoryClaiming (signing/confirming/done/cancelled/timeout) + VictoryClaimSuccess.
- ResultOverlay: badge/score/shop/error variants.
- PurchaseConfirmSheet: approving/buying/error states.
- All at 390px (MiniPay).

---

## 11. MiniPay QA checklist

Manual testing en MiniPay real (390px). Para cada flujo, reproducir todos los caminos.

### F1 — Mint Victory
- [ ] Win game (any difficulty).
- [ ] Tap "Claim Victory" → VictoryClaiming visible.
- [ ] Back button enabled throughout → tap → return to VictoryCelebration.
- [ ] Approve in MiniPay → progress dot 1/3 → step label "Approving" visible.
- [ ] After approve confirm → progress dot 2/3 → step label "Confirming" visible.
- [ ] Mint tx confirms (30–60s typical) → VictoryClaimSuccess overlay + trophy animation.
- [ ] Tap "Share" → share modal → share to WhatsApp → verify card URL resolves.
- [ ] Disconnect wallet mid-claim (if possible) → observe timeout copy after 120s.
- [ ] Close MiniPay during approve → return to VictoryCelebration.
- [ ] Reload page mid-claim (sessionStorage test) → return should detect receipt if confirmed.

### F2 — Claim Badge
- [ ] Unlock badge (reach score threshold on one piece).
- [ ] BadgeEarnedPrompt visible → "Claim Badge" button.
- [ ] Tap Claim → ResultOverlay transitions (should not show awaiting-signature visual, just spinner).
- [ ] Signature + receipt (60s total) → ResultOverlay success variant + stars.
- [ ] Dismiss or let auto-dismiss run (15s) → return to board.
- [ ] Tap "Try Again" on error → resubmit (no state leak from previous attempt).

### F3 — Submit Score
- [ ] Complete all exercises on one piece.
- [ ] Score calculated (e.g., 45 stars).
- [ ] FOOTER_CTA "Submit Score" visible.
- [ ] Tap Submit → MiniPay signature request → approve → wait receipt.
- [ ] ResultOverlay score variant + Celoscan link.
- [ ] Double-tap Submit rapidly → only one tx fires (concurrency guard).
- [ ] Reload mid-submit → leaderboard should show score if confirmed.

### F4 — Buy Item Shop
- [ ] Open Shop from PlayHub dock.
- [ ] Select item (e.g., Retry Shield if admin has enabled).
- [ ] Tap "Buy" → PurchaseConfirmSheet (item name, price, network warning).
- [ ] Tap "Confirm" → MiniPay approve → "Approving USDC…" state → buyItem → "Buying…" state.
- [ ] Try tap backdrop during Approving/Buying → sheet should not dismiss.
- [ ] Tx confirms → ResultOverlay shop variant.
- [ ] Reload mid-buy → verify item ownership read from on-chain (Shop.balanceOf), not sessionStorage.

### F5 — Buy Coach Credits
- [ ] In Arena, after victory, if no credits: tap "Ask Coach" → CoachPaywall visible.
- [ ] Select pack (5 or 20 credits).
- [ ] Same flow as F4 (approve + buy + verify).
- [ ] Post-tx, Redis should have credits (verify via `/api/coach/credits` endpoint if possible, or observe CoachPanel loads correctly).

### Error paths (all flows)
- [ ] Reject signature in MiniPay → dismissed gracefully, no error overlay.
- [ ] Network error during submit → ResultOverlay error variant + copy "Network error — check your connection and try again."
- [ ] Insufficient funds → copy "Not enough funds to complete this transaction".
- [ ] Timeout (>120s) → copy "This is taking longer than expected. Check your wallet or try again."
- [ ] Tap "Try Again" on error → re-enter preparing state, re-validate wallet + balance.

### Layout + a11y
- [ ] All overlays center on 390px viewport with safe margins.
- [ ] Spinner + progress elements use `aria-live="polite"` for screen readers.
- [ ] CTA buttons contrast sufficient (WCAG AA).
- [ ] No layout shift when toast/error message appears.

---

## 12. Acceptance criteria

Criterios booleanos para cerrar el sprint.

- [ ] Todos los 6 flujos (F1–F6) pueden cancelarse desde cualquier estado activo (awaiting-signature, awaiting-receipt) sin quedar atrapados ni perder contexto.
- [ ] Ninguna pantalla renderiza error crudo (ej. ContractFunctionExecutionError.message sin sanitizar).
- [ ] `classifyTxError()` es llamado en TODOS los error paths (F1–F5).
- [ ] Back button en VictoryClaiming está habilitado en todo momento (incluso durante signing/confirming).
- [ ] PurchaseConfirmSheet no se puede dismissir (backdrop tap / swipe) durante `phase !== "idle"`.
- [ ] Piece rail click es ignorado durante `isSubmitConfirming` (H6).
- [ ] Shop sheet cierra automáticamente cuando se abre PurchaseConfirmSheet (H4).
- [ ] Timeout 120s está configurado en TODOS los `waitForTransactionReceipt` calls (F1–F5).
- [ ] sessionStorage limpia fase temp cuando user cancela signature (F1).
- [ ] Post-navigate receipt detection funciona para F1 (sessionStorage → polling → success).
- [ ] Copy matrix en editorial.ts cubre todos los estados (preparing, awaiting-signature, awaiting-receipt, success, cancelled, timeout, error) para al menos F2–F5.
- [ ] Telemetría incluye stage labels: `stage:preparing`, `stage:awaiting-signature`, `stage:awaiting-receipt`, `stage:success`, `stage:cancelled`, `stage:timeout`, `stage:error`.
- [ ] Todos los overlays (VictoryClaiming, ResultOverlay, PurchaseConfirmSheet) responden a 390px viewport sin horizontal scroll.
- [ ] E2E tests en Playwright cobertura: F1 happy path + timeout, F2 happy path, F4 happy path + insufficient funds, error recovery.
- [ ] Visual snapshots pasan en 390px (MiniPay) y desktop (18/18 baseline).

---

## 13. Out of scope

Explícitamente **NO** se hace en este sprint:

- [ ] Schema migrations (D.2 verified_games — otro sprint).
- [ ] Smart contract upgrades o redeploys.
- [ ] Cambios al protocolo EIP-712 (ya existe).
- [ ] Rediseños visuales mayores (iconografía, colores, fuentes).
- [ ] Migración del Coach a Gemini Pro u otro provider.
- [ ] Activación de "Retry Shield Admin TX" (responsabilidad del Safe owner, no implementación app).
- [ ] Cambios al rate limiter Redis (ya migrado en session-handoff).
- [ ] Bloqueo de `/why` landing (cosmético, deprioritizado).
- [ ] Introducción de `useMiniPayTransaction` hook (commit 8 — diferido a sprint siguiente).
- [ ] Multi-token selector UI (deprioritizado).
- [ ] Prize Pool Distributor contrato (Fase 1 monetization — otro sprint).
- [ ] Arena Ranked + leaderboard (otro sprint).

---

## 14. Next batch after MVP

Orden de prioridad post-MVP (dentro del mismo tema MiniPay Transaction UX):

1. **useMiniPayTransaction hook + TransactionStatus component** (commit 8 del audit): Abstrae state machine para F2–F5. Condicionado a feature flag `NEXT_PUBLIC_USE_UNIFIED_TX_HOOK=false` durante primer sprint. Permite refactor de play-hub-root.tsx + purchase-confirm-sheet.tsx para reutilizar lógica.

2. **Recovery polling v1 para F1** (commit post-6): sessionStorage timeout + 60s polling con backoff exponencial. Detecta receipt post-navigate. Telemetría de recovery rate.

3. **Elapsed timer visual en todos los awaiting-receipt overlays** (commit post-7): Spinner + "10s / 120s" elapsed counter. Tranquiliza al usuario durante esperas largas.

4. **Coach analysis abort signal** (M4 fix): Agregar AbortController a `startCoachAnalysis` fetch. Cancelar on-flight request si user navega fuera.

5. **Prize Pool Distributor contract + epoch UI** (Fase 1 monetization): Nuevo componente leaderboard + claim sheet. Fuera del scope de MiniPay UX fluidity.

6. **Translated copy para otros idiomas** (i18n): Actualmente todo en inglés. Usar `next-intl` o similar si hay demanda de Swahili/French/etc.

---

## Confirmación pendiente

> Nota: el primer borrador de esta sección recomendaba 4 commits que YA están cerrados en sesiones previas (back button F1, sheet dismiss guard, piece rail reset, auto-close shop). Verificación contra `git log` y código actual:
>
> | Commit propuesto inicialmente | Estado real |
> |---|---|
> | Back button + cancel/timeout state F1 | ✅ ya hecho (`78b0182`) |
> | Sheet dismiss guard F4 | ✅ ya hecho (`purchase-confirm-sheet.tsx:151` + `play-hub-root.tsx:1096`) |
> | Piece rail / exercise drawer overlay reset | ✅ ya hecho (`4ad08c1` + lines 960-961) |
> | Auto-close shop sheet | ✅ ya hecho (`play-hub-root.tsx:1033-1034`) |
> | Global tx timeout helper | ✅ ya hecho (`e42159a`) |
> | Submit Score concurrency guard | ✅ ya hecho (`5e354ae`) |

### Recomendación real para el primer commit

**Copy/state normalization para F4 (Buy Item Shop) y F5 (Buy Coach Credits) — parity con el patrón que ya funcionó en F1.**

**Por qué es lo siguiente**:

1. F1 ya tiene `errorKindCopy` con cancelled/timeout/error diferenciados (commit `78b0182`). F4/F5 todavía caen al overlay error genérico — eso es el "parche" más visible que queda en la UX hoy.
2. Es el patrón que más valor agrega para los flujos donde vive el revenue (Shop + Coach). Hacer que la cancelación de una compra se sienta como "no hay drama" en lugar de "fallo técnico" es el delta más alto.
3. Reusa código que ya existe (`VICTORY_CLAIM_COPY.errorKindCopy`, `VictoryClaimError kind` prop). Patrón ya validado en visual snapshots.
4. Bajo riesgo: ~50-80 LOC, 1 commit, sin tocar contratos/APIs/contratos de telemetría.
5. Una vez normalizado F4/F5, lo demás del sprint (pre-wallet intent panels, awaiting-signature visuals, recovery polling) se construye encima de la misma base de copy/kind.

**Scope concreto del commit**:
- Extender `RESULT_OVERLAY_COPY.error` (o crear `PURCHASE_RESULT_COPY`) con `kind: error | cancelled | timeout` y copy específico por flujo de compra.
- Modificar `result-overlay.tsx` ResultOverlay variant=error para aceptar `kind` prop.
- Modificar `handleConfirmPurchase` (F4) y `handleBuyCredits` (F5) para distinguir cancelled / timeout / error en el catch (igual que ya hace `handleClaimVictory`).
- Tests para los tres kinds en cada flujo.

**Lo que NO va en este commit**:
- `useMiniPayTransaction` hook (deferred al final del sprint).
- Pre-wallet intent panels (commit posterior — depende de copy aprobado para cada flujo).
- Recovery polling F1 (commit posterior).
- Awaiting-signature visual gap (commit posterior).

### Próximo paso

Aprobación explícita del scope arriba para arrancar el commit. Si el scope se ve OK, escribo el commit (~50-80 LOC, ~30 min) y reporto. Si quieres ajustar el alcance (más, menos, otro flujo primero), dilo antes.

