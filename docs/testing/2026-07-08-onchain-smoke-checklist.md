# On-chain smoke checklist — LEARN + PLAY (2026-07-08)

**Dónde:** `preview.chesscito.com` desde MiniPay (alias = último `main`, incluye PR #183).
No uses prod: el canary de Get Peones está **off en Production**, el ítem 4 no sería testeable.

**Ojo — plata real:** preview y prod comparten env de payment rail → **Celo Mainnet 42220**.
Las txs cuestan de verdad. Presupuesto total del checklist: ~$0.60 + gas.

**Cómo registrar:** cada tx exitosa deja hash. Anótalo o abre Celoscan.
Para cada ítem: ✅ / ❌ + hash o screenshot del error.

---

## 🔴 Prioridad 1 — el fix de PR #183

### 1. LEARN · CTA dorado "Save proof" (Save today's training proof)
Esto es lo único que valida el fix. Todo lo demás es cobertura.

1. Wallet conectada, chain Celo, ≥1 estrella en una misión.
2. Completa un ejercicio y **espera** a que el auto-save off-chain termine (antes desaparecía acá).
3. Abre el mission sheet desde la peek card.
4. **El CTA dorado debe seguir visible.**
5. Tócalo → firma → tx `submitScoreSigned` en Scoreboard `0x1681aAA1…`.
6. Vuelve a abrir el sheet: **ahora sí debe desaparecer** (ya hay proof on-chain).

Falla esperada si el fix no sirvió: paso 4 no muestra nada.
Contrato: Scoreboard `0x1681aAA1…` · gas-only, sin costo en tokens.

---

## Prioridad 2 — las 4 txs restantes

### 2. LEARN · Claim Badge
- Llega al umbral de estrellas (`BADGE_THRESHOLD`) → aparece el badge sheet.
- Claim → firma → `claimBadgeSigned`, Badges `0xf92759E5…`. Gas-only.

### 3. ~~LEARN · Shop → comprar Streak Shield~~ — NO APLICA
Ítem inválido. `5c8e0f5d` retiró la compra de Shield del Shop (itemId 2) a propósito: los
Shields vienen del Season Pass, del welcome-pack o de 2 Peones por rescate. No hay nada
que smokear. Ver `docs/audits/2026-07-09-onchain-smoke-root-causes.md`.

### 4. LEARN · Get Peones (pack 50)
- Get Peones → pack $0.50 → `ERC20.transfer(treasury)`, **1 sola tx**.
- Token auto-seleccionado USDC → USDT → cUSD.
- **Verifica:** los 50 Peones acreditan y el sheet queda por encima de la Chesito Card (z-index, `1fdf58cb`).

### 5. PLAY · Save Victory (permit)
- Juega Arena, gana (checkmate) → `VictoryCelebration` full-screen → Save.
- Easy $0.01 / Med $0.02 / Hard $0.03. VictoryNFT `0x0eE22F83…`.
- **Lo crítico:** en Celoscan, "Input Data" debe decir **`mintSignedWithPermit`** (selector `b31e32cc`) y ser **UNA sola tx**.
  Si ves `mintSigned` + un `approve` separado → el permit no está activo, es un bug.
- Si te sobra tiempo: repetir desde un end-state de derrota/tablas (misma tx, UI inline distinta).

---

## Notas de interpretación

- **El SAVE verde de LEARN no es on-chain.** Es `/api/scores/save` off-chain, gratis desde Lote 2,
  no aparece en Celoscan. Si lo ves y no hay tx, es correcto.
- **`Retry save` (neutro)** solo aparece si el auto-save off-chain falla. No lo busques en happy path.
- **PLAY no tiene save-score al leaderboard.** El leaderboard se ocultó en Lote 1 (B5). Su única tx es la #5.
- Shields: el cap de 3 es de display/uso, no de crédito. Si compras con 3 activos, el excedente se buferea.
  Es el caveat aceptado, no un bug.

---

## Resultado

| # | Ítem | ✅/❌ | Hash / nota |
|---|------|------|-------------|
| 1 | LEARN Save proof (dorado) | | |
| 2 | LEARN Claim Badge | | |
| 3 | LEARN Shop Shield | | |
| 4 | LEARN Get Peones | | |
| 5 | PLAY Save Victory (permit) | | |

Si el #1 falla, para y avísame: Lote 2.5 se construiría sobre un fix roto.
