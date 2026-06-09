# Handoff — Stablecoin Single-Tx Payment Rail (Preview Smoke, 2026-06-09)

**Status:** Implementado hasta **preview** (slices A–F). Verificado en deploy con dummy txHash. **Production NO contiene el rail todavía.** Pendiente: G (MiniPay real smoke) antes de promover.
**Calibration:** `docs/product/chesscito-stablecoin-single-tx-payment-rail-calibration-2026-06-09.md`.

---

## 1. Resumen ejecutivo

- Rail de pago stablecoin **single-tx** para MiniPay/Celo: `ERC20.transfer(treasury, amount)` — **una tx, sin approve**, solo para pagos **directos** (recibir stablecoin a la treasury).
- **Aditivo + gated:** se selecciona solo en MiniPay + Celo + pago directo. El flujo **Shop legacy** (`approve + buyItem`) queda **intacto** para no-MiniPay y flujos contractuales (PRO/Founder/Victory).
- **Primer caso:** `peones_pack_50` ($0.50 → 50 Peones, crédito server-side en `peones_ledger`).
- **Preview desplegado y probado** con dummy txHash (fail-closed + rechazo seguro confirmados).
- **Production todavía no contiene el rail** (sigue en `0d2a38be`).

---

## 2. Commits del cluster

| Slice | Hash | Commit |
|---|---|---|
| A — Calibration | `3a2dbbc0` | docs(product): stablecoin single-tx payment rail calibration |
| B — Constants/config | `ca66eccc` | feat(payments): add stablecoin rail constants and treasury config |
| C — Tx builder | `c2026d24` | feat(payments): add pure stablecoin transfer tx builder |
| D — Verify helper | `bb5d3eab` | feat(payments): add Transfer-event verification helper |
| E — Endpoint | `f7000669` | feat(api): add verify-payment endpoint for Peones pack |
| (E.1) — Fallback + guardrail | `335d91bb` | fix(payments): treasury env fallback + anti-replay guard for verify-payment |
| F — Dev smoke | `0db84d80` | feat(payments): add stablecoin rail dev smoke script |
| H — Handoff | (este) | chore(product): handoff stablecoin payment rail preview smoke |

---

## 3. Estado desplegado

- `origin/main` = **`0db84d80`**.
- **Preview URL:** `https://chesscito-ngu0y31t4-goodwolf.vercel.app` (Ready).
- `origin/production` = **`0d2a38be`** — **sin tocar** (no se promovió).
- Env vars en Vercel (Production + Preview, comparten env): `TREASURY_ADDRESS`, `CHESSCITO_TREASURY_ADDRESS`, `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` (todas = la treasury real del Shop, founder-confirmada).

---

## 4. Resultado del probe preview

```txt
pnpm --filter web rail:smoke -- --endpoint https://chesscito-ngu0y31t4-goodwolf.vercel.app
```

- POST `/api/verify-payment` con dummy txHash `0x000…000`.
- **HTTP 400 `{ ok:false, error:"receipt_not_found" }`**.
- ✅ **Treasury detectada/configurada en el deploy** (superó el gate fail-closed; no devolvió `rail_not_configured`).
- ✅ Dummy rechazado **seguro** (falla en el fetch del receipt).
- ✅ **No `ok:true`**.
- ✅ **No ledger write**.
- ✅ No tx send.

(El builder local salió `SKIPPED` en el probe porque no hay env local — está en Vercel; el builder está validado por los unit tests de slice C + un run con mock-env.)

---

## 5. Guardrails de seguridad

- **Fail-closed:** si la env de treasury falta/inválida, el endpoint devuelve `rail_not_configured` (503) **antes** de fetch/decode/Supabase/crédito. La UI gatea por `isRailTreasuryConfiguredClient()`.
- **Preview y production comparten env** → no setear la treasury hasta tener la real (ya seteada, founder-confirmada). Ver `feedback_payment_rail_fail_closed`.
- **Sin placeholder treasury** en ningún path.
- **Backend no confía en el cliente** para amount/reward/treasury/token/price — todo server-decided desde config/SKU.
- **Idempotency:** `pack_purchase:{chainId}:{txHash}:{logIndex}` (unique key del ledger). Re-submit → `duplicate:true`, sin doble crédito.
- **Overpay:** aceptado (`value >= expected`) pero acredita el pack **nominal** (sin bonus); `overpaid:true` + log en metadata. `value < expected` → rechazado.
- **`receipt.to == token` (anti-replay, OBLIGATORIO):**
  - acepta solo `transfer` **directo** al contrato ERC20 (tx.to == token);
  - **rechaza** Shop `buyItem` (ahí `receipt.to == Shop contract`) con `not_direct_transfer`;
  - **por qué:** el Shop hace `safeTransferFrom(buyer, treasury, total)` a la **misma** treasury y emite un evento `Transfer(buyer→treasury)` idéntico al del rail. Sin este guard, una compra Shop (PRO/Founder/Coach/Shield) podría re-enviarse a `/api/verify-payment` para **doble-acreditar Peones**.

---

## 6. Qué funciona hoy

- Config de treasury (getters lazy fail-closed) y stablecoins (default USDC; cUSD/USDT aceptados).
- Builder puro de `transfer` (`buildPeonesPackTransfer`).
- Verificador puro del evento `Transfer` (`verifyStablecoinTransfer`).
- Endpoint `/api/verify-payment` (verify + crédito idempotente, fail-closed).
- Dev smoke script (`rail:smoke`, dry-run + probe seguro `--endpoint`).
- Preview detecta la treasury; dummy txHash falla seguro.
- Suite: **3320/3320 green**, tsc + eslint clean.

---

## 7. Qué falta para G (MiniPay real smoke)

1. Abrir Chesscito desde **MiniPay**.
2. Ejecutar un transfer **real mínimo** de USDC a la treasury usando el rail nuevo.
3. Confirmar **una sola tx**.
4. Confirmar que **NO aparece approve**.
5. Confirmar gas/feeCurrency como espera MiniPay/Celo (stablecoin, no CELO).
6. Tomar el **txHash real**.
7. POST `/api/verify-payment`.
8. Esperar **`ok:true`**.
9. Confirmar **`peonesCredited:50`**.
10. Re-postear el mismo txHash → **`duplicate:true`**, sin doble crédito.
11. Confirmar que el **balance de Peones sube**.

> G requiere wallet real + MiniPay → lo ejecuta el founder (no puedo conectar/firmar). El rail está fail-closed hasta ese smoke; no hay UI pública aún (el endpoint existe pero ninguna surface lo llama).

---

## 8. Decisión pendiente

- **No promover production** antes del smoke real con MiniPay (G).
- Si **G verde:** promover `main → production` (FF) **y/o** wirear la UI interna si falta surface que dispare el rail.
- Si **G falla:** hotfix en preview antes de tocar production.

---

## 9. Out of scope

Founder Badge · PRO subscription · VictoryNFT/Arena · reemplazo del Shop legacy · Coach/Hint/Retry · Labyrinths · Daily Labyrinth · P2P/tipping · withdrawals · recurring billing.

---

## 10. Archivos clave

- Config: `apps/web/src/lib/payments/rail-config.ts`
- Builder: `apps/web/src/lib/payments/transfer-builder.ts`
- Verifier: `apps/web/src/lib/payments/verify-transfer.ts`
- Endpoint: `apps/web/src/app/api/verify-payment/route.ts`
- Smoke: `apps/web/scripts/rail-smoke.ts` (`pnpm --filter web rail:smoke`)
