# Chesscito — Stablecoin Single-Tx Payment Rail Calibration (2026-06-09)

**Author:** John (PM) · **Status:** Technical calibration, pre-code. No implementation.
**Context:** Rotation Engine + guest fallback cerrado y promovido a prod (`0d2a38be`). Ahora: reducir fricción de pagos en MiniPay.

> Este doc diseña el rail. NO toca código. Aterrizado en el flujo de pagos actual (Shop contract + event verification).

---

## 1. Tesis

Para **MiniPay/Celo**, cuando Chesscito solo necesita **recibir** un pago stablecoin (sin lógica on-chain de item), preferimos **una sola transacción**:

```
ERC20.transfer(treasury, amount)
```

Esto evita el `approve + buyItem(transferFrom)` actual (2 tx). NO reemplaza todos los pagos — es un rail **aditivo**, seleccionado solo para casos directos y seguros. Todo lo demás mantiene el flujo Shop existente.

**Cómo paga hoy el Shop (a reemplazar solo en casos directos):** `use-shop-sheet-state.ts` → `approve(shopAddress, amount)` (si allowance insuficiente) → `shop.buyItem(itemId, 1, token)` (transferFrom interno). El contrato emite `ItemPurchased(buyer, itemId, qty, unitPriceUsd6, totalTokenAmount, token, treasury)`. Verificación: server decodifica ese evento.

---

## 2. Casos de uso candidatos (REORDENADOS por viabilidad técnica)

| # | Caso | ¿Direct-transfer viable? | Por qué |
|---|---|---|---|
| **1** | **Pack de Peones** | ✅ **IDEAL — primer candidato** | Peones = ledger server-side (Supabase). Transfer → verificar → acreditar `peones_ledger`. Source `pack_purchase` YA reservado. Cero lógica on-chain. |
| 2 | **PRO subscription** | ⚠️ Viable pero diferir | PRO se otorga **server-side** (Redis TTL vía `/api/verify-pro`). Transfer → verificar → grant funciona. PERO es recurring-adjacent (out of scope §7) y toca el funnel de conversión. Wave 2. |
| ~~3~~ | ~~Founder Badge~~ | ❌ **NO migra en este cluster** | Founder Badge es un **NFT minteado por el contrato Shop** (itemId 1). Un transfer directo NO lo mintea. Movería el mint a server-signed mint o flujo aparte → cambio grande. Mantener flujo Shop. |
| 4 | Theme/cosmetic pack futuro | ✅ (cuando exista) | Si es desbloqueo server-side, mismo patrón que Peones pack. No existe aún. |
| 5 | Otros items futuros | caso por caso | Solo si son "recibir pago + crédito server-side". |

**Conclusión §2:** el cluster arranca y se enfoca en **Peones pack** (único candidato limpio + de alto valor). PRO queda como posible wave 2. Founder Badge se queda en el Shop contract.

**Explícitamente fuera (no migrar aquí):**
- **VictoryNFT / Arena:** mint on-chain, requiere contrato. No tocar.
- **Coach / Hint / Retry — Peones spend:** spend interno, no es un pago stablecoin. No tocar.
- **Peones ledger interno:** solo lo tocamos como **consumidor** (acreditar Peones cuando una compra de pack se verifica), no su lógica de spend/cap.

---

## 3. Detección de contexto + rail selection

Señales (todas ya existen en el código):
- **MiniPay:** `isMiniPayEnv()` (`lib/minipay.ts`) → `window.ethereum.isMiniPay`. Hook `useMiniPay()`.
- **Celo chain:** `getConfiguredChainId()` + `chainId === 42220` (mainnet).
- **Stablecoin disponible:** balance del token elegido (lectura ERC20 `balanceOf`, ya se hace en el Shop).
- **feeCurrency:** `getMiniPayFeeCurrency(chainId)` (ya existe).

```txt
if isMiniPay && chainId == 42220 && useCase == direct_stablecoin_payment (Peones pack):
    → single-tx transfer rail
else:
    → flujo Shop existente (approve + buyItem)  // sin cambios
```

El rail nuevo es una RAMA, no un reemplazo. Si cualquier señal falta → flujo normal.

---

## 4. Flujo técnico propuesto

### Frontend
1. Detectar MiniPay + Celo (§3).
2. Token: **default USDC** (6 dec), aceptar cUSD/USDT (el usuario paga con lo que tenga). Construir `amount = normalizePrice(priceUsd6, tokenDecimals)` (helper ya existe en `tokens.ts`).
3. Construir `transfer(treasury, amount)` con `writeContract({ address: token, abi: erc20Abi, functionName: "transfer", args: [TREASURY, amount] })`.
4. Enviar vía el patrón `writeWithOptionalFeeCurrency` existente (inyecta `feeCurrency` para MiniPay; retry sin feeCurrency como fallback).
5. Esperar txHash → POST a `/api/verify-payment` con `{ chainId, txHash, token, item, wallet }`.
6. Estado claro: **pending / confirmed / failed** (reusar `TxProgressSteps` / `deriveTxToastState`).

### Backend (`/api/verify-payment`, nuevo)
1. Fetch receipt en Celo mainnet.
2. Decodificar el evento **`Transfer(from, to, value)`** del token (ERC20 estándar).
3. Validar (defense-in-depth, espejo de `/api/verify-pro`):
   - `chainId` correcto;
   - `token` ∈ `STABLECOIN_ADDRESSES_LOWER` (allowlist ya existe);
   - `to == TREASURY` (allowlist server-side);
   - `from == wallet` (lowercase);
   - `value == expected` (= `normalizePrice(itemPriceUsd6, decimals)`); política de overpay en §5;
   - tx/log no usado antes.
4. Acreditar la compra:
   - **Peones pack** → insertar en `peones_ledger` (source `pack_purchase`).
5. **Idempotency:** clave = `pack_purchase:${chainId}:${txHash}:${logIndex}` (encaja con el `idempotency_key UNIQUE` ya existente del ledger).

### Verificación = server, NO indexer
Reusar el patrón vigente (`verify-pro` / `credit-shield`): frontend postea el txHash, server decodifica el evento del receipt. Sin indexer, sin polling pesado en cliente.

---

## 5. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **Trust shift:** el contrato ya no enforce el precio; el backend debe verificar el monto exacto. | Backend rechaza si `value < expected`. Política overpay: aceptar y acreditar el item nominal (no reembolsar el excedente) **o** rechazar. *Decisión §7.* |
| R2 | **Treasury hardcodeada mal** → fondos al address equivocado. | `TREASURY` como constante/env (`NEXT_PUBLIC_TREASURY_ADDRESS`) + **allowlist server-side**. Revisar en deploy. Hoy el treasury lo emite el contrato; el rail directo lo necesita explícito. |
| R3 | **Transfer con token/monto equivocado** (sin guardrails de contrato) → usuario pierde fondos sin crédito. | El frontend construye la tx exacta; el backend solo acredita transfers que matchean. Documentar reconciliación. |
| R4 | **Transfer sin verificar** (usuario envía pero no postea, o el POST falla) → fondos en treasury sin crédito. | El usuario puede re-postear el txHash (idempotente). Endpoint acepta re-submit. Reconciliación manual vía Celoscan si hace falta. |
| R5 | **Replay / doble crédito.** | Idempotency `(chainId, txHash, logIndex)` + `idempotency_key UNIQUE` del ledger. |
| R6 | **feeCurrency falla en MiniPay.** | Patrón retry-sin-feeCurrency ya existe; en MiniPay el gas DEBE ser stablecoin (no CELO). |
| R7 | **Romper flujos existentes.** | Rail aditivo + gated por (MiniPay + Celo + Peones pack). Shop/PRO/Founder/Victory intactos. |
| R8 | **Gas token == payment token (Q6).** | El `Transfer` a treasury es **exactamente `amount`**; el gas se cobra **aparte** (fee abstraction de Celo). NO ajustar el monto del transfer; solo asegurar balance ≥ amount + gas. |

---

## 6. Smoke plan (MiniPay real)

- Enviar monto pequeño de stablecoin (USDC) a treasury desde MiniPay.
- Confirmar **una sola tx** (NO aparece approve).
- Confirmar que el gas se cobra como stablecoin (feeCurrency) como espera MiniPay.
- Confirmar el evento **Transfer** (to=treasury, value=amount).
- Confirmar verificación backend → Peones acreditados (`peones_ledger`, balance sube).
- Confirmar **idempotency** (re-postear el mismo txHash no duplica).
- Confirmar **fallback**: fuera de MiniPay, el Peones pack (o cualquier item) usa el flujo Shop normal.

---

## 7. Out of scope

VictoryNFT/Arena · P2P · Labyrinths · Daily Labyrinth · Peones spend interno · Coach · Complex Shop · Recurring billing · Withdrawals · Revenue sharing · cambios al Rotation Engine · cambios a ejercicios.

---

## 8. Plan de commits propuesto

| Slice | Commit | Contenido |
|---|---|---|
| A | `docs(product): stablecoin single-tx payment rail calibration` | Este doc. |
| B | `feat(contracts): stablecoin transfer rail constants + treasury config` | `TREASURY_ADDRESS` (env), default token, allowlist server-side. Reusa tokens/chains existentes. |
| C | `feat(payments): pure direct-transfer tx builder` | Helper puro: `(token, treasury, priceUsd6) → {to, data, value:0}` vía `encodeFunctionData(erc20.transfer)`. Sin UI. |
| D | `feat(payments): Transfer-event verification helper` | Puro: decodifica `Transfer`, valida chain/token/to/from/value, devuelve `{ok, amount, logIndex}`. |
| E | `feat(api): verify-payment endpoint` | `/api/verify-payment` → verifica + acredita Peones pack, idempotente `(chainId,txHash,logIndex)`. |
| F | `feat(payments): dev smoke surface / script` | Surface interna o script para disparar un transfer + verify (sin MiniPay). |
| G | `chore(qa): MiniPay real smoke` | Smoke §6 con MiniPay real. |
| H | `chore(product): payment rail handoff` | Handoff. |

Orden de seguridad: B→C→D (puros) antes de E (endpoint) antes de F/G (smoke). Rail behind selección de contexto; nada del Shop/PRO/Founder/Victory se toca.

---

## 9. Nota futura sobre Labyrinths (NO implementar ahora)

Cuando retomemos Labyrinths:
- **No asumir tab separada.** Evaluar una **senda integrada**: Exercises Easy → Exercises Medium → multi-target challenges → move-limit challenges → Labyrinths Easy → Labyrinths Hard/Daily.
- **Obstáculos visuales:** casillas bloqueadas / muros / tiles oscuros con candadito pequeño — NO piezas con candado (evita que el usuario crea que es una pieza para mover/capturar). Cf. epic LC-5.

---

## 10. Preguntas bloqueantes (necesitan decisión founder antes del slice B)

1. **Treasury address** para el rail directo (hoy lo emite el contrato; necesitamos el recipient explícito para construir + verificar). **BLOQUEANTE.**
2. **Primer candidato = Peones pack** (recomendado; Founder Badge NO es fit por el mint on-chain). ¿Confirmas scope = Peones pack primero?
3. **Stablecoin default:** USDC (recomendado, 6 dec, ya cableado) vs cUSD (Celo-native, común en MiniPay). Aceptamos los 3 igual.
4. **Política de overpay** (R1): si `value > expected` → ¿aceptar y acreditar nominal, o rechazar? (Recomiendo aceptar + acreditar nominal + log.)
5. **¿Existe ya un Peones pack SKU/precio definido?** Hoy `pack_purchase` está reservado en el ledger pero no hay precio/cantidad de Peones por pack. Necesitamos definir packs (ej: $0.50 → N Peones).
