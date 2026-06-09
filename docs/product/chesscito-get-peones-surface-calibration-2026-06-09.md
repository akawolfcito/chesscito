# Chesscito — "Get Peones" Surface Calibration (2026-06-09)

**Author:** John (PM) · **Status:** Technical calibration, pre-code. No implementation.
**Predecessor:** Stablecoin rail A–G shipped to preview + **real smoke GREEN twice** — MiniPay (cUSD, ledgerId 101) AND web MetaMask on Celo (USDT, ledgerId 106). Handoff: `docs/handoffs/2026-06-09-stablecoin-single-tx-payment-rail-smoke.md`.

> **Reframe:** el rail es un **Stablecoin Direct Payment Rail**, NO "MiniPay-only". Funciona en cualquier wallet en Celo (MiniPay y MetaMask web). MiniPay es el caso UX prioritario; no el único.

---

## 1. Tesis

Convertir el dev smoke (`/dev/rail-smoke`) en una **surface pública real** para comprar Peones con `ERC20.transfer(treasury, amount)` directo (1 tx, sin approve). Aditivo — no reemplaza los pagos contractuales.

---

## 2. Entry points posibles + recomendación

| Entry point | Intent | Nota |
|---|---|---|
| **Peones HUD chip** (`PeonesBalanceChip`) | medio (discovery) | Siempre visible, ya muestra el balance → "tap para sumar". Wire simple. |
| **Insufficient Peones** (Hint/Retry spend falla) | **alto** (lo necesita YA) | Mejor momento de conversión, pero requiere interceptar fallos de spend. |
| Shop sheet | bajo | Mezcla con compras contractuales; menos foco. |
| MiniPay-specific CTA | — | Ya no es exclusivo; no separar por MiniPay. |

**Recomendación — primera ubicación:** **el Peones HUD chip → abre un `GetPeonesSheet`.** Es la entrada always-on más simple y discoverable (el chip ya existe y muestra el balance). **Fast-follow:** agregar el CTA "Get more Peones" en el **insufficient-Peones state** (Hint/Retry), que es el de mayor intent. Empezar por el chip; el insufficient-state en la slice E o un slice posterior.

---

## 3. Rail selection (ya NO MiniPay-only)

```txt
if chainId == Celo mainnet (42220)
   && treasury configurada (NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS)
   && hay un stablecoin soportado con balance suficiente:
     → Stablecoin Direct Payment Rail (transfer directo)
else:
     → fallback: prompt "switch to Celo", o "insufficient balance" + add-cash,
        o (futuro) Shop legacy. Si treasury unset → rail "unavailable" (fail-closed).
```

- **MiniPay:** gas como stablecoin (feeCurrency) automático.
- **MetaMask en Celo:** mismo rail; el gas se paga en **CELO nativo** (no feeCurrency) → el patrón `writeWithOptionalFeeCurrency` (inyecta feeCurrency solo si MiniPay, retry sin él) cubre ambos. El user web necesita un poco de CELO para gas.
- Flujos que requieren contrato/mint/atomicidad NO usan el rail (matriz §0).

**Matriz de producto (recordatorio):**
1. **Peones pack → rail directo** (prioridad actual). ✅
2. Founder Badge NFT → **Shop/contract legacy** (mint on-chain). ❌ no migrar.
3. VictoryNFT/Arena → contratos actuales. ❌.
4. PRO → posible wave 2 si server-side. ⏳ no tocar ahora.
5. Save game → si off-chain puede usar Peones; si NFT/on-chain requiere contrato.
6. Native CELO/ETH/AVAX → **futuro rail separado** (requiere pricing/quote + verificación distinta). MVP = stablecoins **cUSD/USDT/USDC**.

---

## 4. Token selection (no repetir el error de USDC sin balance)

- Leer balances de **cUSD/USDT/USDC** para la wallet conectada (`useReadContracts` balanceOf — mismo patrón que el Shop).
- **Auto-seleccionar** el primer token con `balance >= normalizePrice(0.50, decimals)`.
- **Orden de preferencia:** `[USDC, USDT, cUSD]` — USDC default **solo si tiene balance**; si no, cae a USDT, luego cUSD.
- **Override manual:** picker (como el dev button) por si el user quiere otro.
- **Si ninguno alcanza:** estado "insufficient stablecoin balance" + CTA add-cash (MiniPay add cash / link), NO el botón de pago.
- El **backend decide el monto** por token (server-side); el cliente solo elige cuál pagar.

---

## 5. UX flow

1. User tap **Get Peones** (desde el HUD chip).
2. Sheet: pack `$0.50 → 50 Peones` + token **auto-seleccionado** (con balance) + picker.
3. Tap **Pay 0.50 {TOKEN}** → confirma en wallet (**1 tx, sin approve**).
4. Espera receipt → POST `/api/verify-payment`.
5. Muestra **"+50 Peones acreditados"** → refetch del balance (sube).
6. Re-verificar el mismo txHash **NO** doble-acredita (idempotency `pack_purchase:{chainId}:{txHash}:{logIndex}`).
7. Errores controlados: wrong chain → switch; sin balance → insufficient; verify falla → permitir re-verify por txHash.

Copy promise-first (regla del proyecto): liderar con la recompensa ("50 Peones por $0.50"), lenguaje plano, sin jerga web3.

---

## 6. Out of scope

Native CELO/ETH/AVAX · Founder Badge · VictoryNFT · PRO · recurring billing · Labyrinths · P2P/tipping · reemplazo global del Shop.

---

## 7. Implementation slices

| Slice | Commit | Contenido |
|---|---|---|
| A | `docs(product): get-peones surface calibration` | Este doc. |
| B | `feat(payments): usePaymentRail hook for real UI` | Hook cliente: build tx (reusa `buildPeonesPackTransfer`) → write con feeCurrency-optional → wait receipt → POST verify → estado pending/confirmed/failed. Reusa el rail + el patrón writeWithOptionalFeeCurrency. |
| C | `feat(payments): GetPeonesSheet component` | Sheet con pack + pay button + estados (reusa el sheet shell del proyecto). Treasury-gated fail-closed. |
| D | `feat(payments): stablecoin balance auto-select` | Lee balances cUSD/USDT/USDC; auto-select por balance; picker override; insufficient state. |
| E | `feat(payments): wire Get Peones into the HUD chip` | El `PeonesBalanceChip` abre el sheet. (Insufficient-Peones CTA = fast-follow.) |
| F | `chore(qa): Get Peones smoke (MiniPay + MetaMask web)` | Smoke ambos paths. |
| G | `chore(product): Get Peones handoff` | Handoff. |
| H | (release) | Promote main → production. |

Orden de seguridad: B (hook) → C/D (UI) → E (wire) → F (smoke) → G/H. Todo gateado por treasury + chain; fail-closed; sin tocar contratos.

---

## 8. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Wallet en chain equivocada (no Celo) | Prompt "switch to Celo" / disable. |
| R2 | Sin balance stablecoin | Estado "insufficient" + add-cash CTA; no mostrar pay. |
| R3 | Treasury unset | Rail "unavailable" (fail-closed) — el sheet no muestra pay. |
| R4 | MetaMask sin CELO para gas | Web paga gas en CELO nativo; avisar si falta (el wallet lo rechaza). MiniPay usa feeCurrency. |
| R5 | Tx enviada pero verify no llamado (cierre de app) | Permitir re-verify por txHash (idempotente); reconciliación manual via Celoscan. |
| R6 | Balance Peones stale tras crédito | Refetch `usePeonesBalance` post-verify. |
| R7 | Replay de compra Shop | Ya cubierto: guardrail `receipt.to == token` (rechaza buyItem). |

---

## 9. Confirmación: flujos contractuales intactos

El rail es **aditivo**. NO se tocan: Shop `buyItem`/contrato, Founder Badge (mint), VictoryNFT/Arena, PRO (verify-pro), Coach/Hint/Retry spend, contratos on-chain. La surface "Get Peones" solo añade el path directo para el Peones pack; todo lo demás sigue por su flujo actual.
