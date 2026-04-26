# Chesscito — Monetization & Anti-Abuse Audit (2026-04-23)

**Rol**: Principal product + smart-contract engineer.
**Alcance**: auditoría exclusivamente contra el código del repo (contratos + `apps/web`).
**Premisa**: cada tx debe ser *entry*, *protection*, *validation*, *reward* o *prestige* — no cosmético.

---

## 1 · Inventario real del código

### 1.1 Contratos desplegados en Celo Mainnet

| Contrato | Proxy | Admin path | Notas |
|---|---|---|---|
| `VictoryNFTUpgradeable` | `0x0eE22F83…` | `Ownable` + `Pausable` | ERC-721, EIP-712, split 80/20 hardcoded |
| `ShopUpgradeable` | `0x24846C77…` | `Ownable` + `Pausable` | Off-chain entitlements vía `ItemPurchased` |
| `ScoreboardUpgradeable` | `0x1681aAA1…` | `Ownable` + `Pausable` | EIP-712, daily cap + cooldown |
| `BadgesUpgradeable` | `0xf92759E5…` | `Ownable` + `Pausable` | ERC-1155 soulbound |

### 1.2 Métodos ya disponibles para cobrar

| Método | Contrato | Función jugable | ¿Expuesto en UI? |
|---|---|---|---|
| `mintSigned(difficulty,totalMoves,timeMs,token,nonce,deadline,sig)` | VictoryNFT | Victory mint (micro-fee) | ✅ `apps/web/src/app/arena/page.tsx:448` |
| `buyItem(itemId, quantity, token)` | Shop | Compra multi-cantidad | ✅ PlayHub (itemId=1) + Coach (itemId=3,4) |
| `submitScoreSigned(...)` | Scoreboard | Submit de score firmado | ✅ PlayHub (tras completar ejercicio) |
| `claimBadgeSigned(levelId,nonce,deadline,sig)` | Badges | Claim de logro | ✅ PlayHub |
| `setPrice(difficulty, priceUsd6)` | VictoryNFT | Ajustar pricing (onlyOwner) | ❌ Admin only |
| `setItem(itemId, priceUsd6, enabled)` / `setItems([])` | Shop | Configurar items (onlyOwner) | ❌ Admin only |
| `pause() / unpause()` | todos | Kill switch | ❌ Admin only |

### 1.3 Eventos ya emitidos (indexables)

- `VictoryMinted(player, tokenId, difficulty, totalMoves, timeMs, token, totalAmount)`
- `ItemPurchased(buyer, itemId, quantity, unitPriceUsd6, totalTokenAmount, token, treasury)`
- `ScoreSubmitted(player, levelId, score, timeMs, nonce, deadline)`
- `BadgeClaimed(player, levelId, tokenId, nonce, deadline)`

> Todos los flujos de revenue actuales son *event-sourced*. Ya existe pipeline de indexado en Supabase (`/api/cache-victory`, `/api/cache-score`) más cron externo (GH Actions).

### 1.4 Pricing: dónde vive y qué tan configurable es

| Dato | Lugar | Tipo | Cambio sin redeploy |
|---|---|---|---|
| Victory prices USD6 | `VictoryNFT.priceUsd6[difficulty]` (on-chain) | storage mapping | ✅ `setPrice` |
| Victory prices (UI mirror) | `apps/web/src/lib/contracts/tokens.ts:33` `VICTORY_PRICES` | hardcoded `Record<number, bigint>` | ❌ requiere deploy web |
| Shop item prices | `Shop.items[itemId]` (on-chain) | storage mapping | ✅ `setItem` |
| Coach pack pricing | `apps/web/src/app/arena/page.tsx:308` `COACH_PACK_ITEMS` | hardcoded en arena page | ❌ requiere deploy web |
| 80/20 split | `VictoryNFT._splitPayment` hardcoded | constantes en Solidity | ❌ requiere **upgrade** |
| Accepted tokens | `VictoryNFT.acceptedTokens` + `Shop.acceptedTokens` | on-chain | ✅ `setAcceptedToken` |
| Mint cooldown | `VictoryNFT.mintCooldown` (default 30s) | on-chain | ✅ `setMintCooldown` |
| Daily submission cap | `Scoreboard.maxSubmissionsPerDay` | on-chain | ✅ `setMaxSubmissionsPerDay` |
| Submit cooldown | `Scoreboard.submitCooldown` | on-chain | ✅ `setSubmitCooldown` |

### 1.5 Flujos on-chain ya listos **pero no expuestos** en UI

1. **Retry Shield (`itemId=2`, $0.025)** — contrato lo soporta, catálogo `SHOP_ITEMS` en `apps/web/src/app/page.tsx:55` lo comenta explícitamente: *"Shield disabled — no gameplay penalty justifies the cost yet"*. Dry powder listo.
2. **`buyItem` con `quantity > 1`** — contrato soporta lotes (hasta `maxQuantityPerTx`); UI actual siempre pasa `1n`.
3. **`setAcceptedToken`** para nuevos stablecoins (USDGLO, etc.) — abierto por governance.
4. **Scoreboard.submitScoreSigned** está integrado solo para PlayHub ejercicios; Arena no submitea scores (sería la base de un Ranked).
5. **Pausa granular** (`pause()`) por contrato — kill switch inmediato para freezes de emergencia.

### 1.6 Datos que produce hoy una sesión de Arena

Fuente: `apps/web/src/lib/game/use-chess-game.ts`.

| Campo | Origen | ¿Verificable? |
|---|---|---|
| `fen` (final) | `chess.js` client-side | ✅ determinístico a partir de moveHistory |
| `moveHistory: string[]` (SAN) | `gameRef.current.history()` | ✅ **replayable end-to-end con `chess.js`** |
| `moveCount` | client counter | ⚠️ derivable de moveHistory, pero hoy se envía por separado |
| `elapsedMs` | `Date.now() − gameStartRef` | ❌ auto-reportado puro |
| `difficulty` | selector UI | ⚠️ afecta IA; no está en el transcript |
| `playerColor` | selector UI | ✅ derivable de FEN initial vs moveHistory |
| AI move determinism | `js-chess-engine` sin seed expuesto | ❌ **la librería no acepta seed** — no hay reproducibilidad perfecta |

Persistencia: `apps/web/src/lib/game/arena-persistence.ts` — localStorage 24h, incluye FEN + moveHistory + moveCount + elapsedMs + difficulty + playerColor.

> **Clave**: `moveHistory` SAN + FEN inicial + playerColor son suficientes para un *canonical transcript* que `chess.js` puede replay-verificar deterministamente, y derivar `totalMoves` sin confiar en el cliente. `elapsedMs` es el único campo genuinamente no-verificable.

### 1.7 Qué envía hoy el cliente al firmar una victoria

`apps/web/src/app/api/sign-victory/route.ts` recibe: `player`, `difficulty`, `totalMoves`, `timeMs`. **No recibe `moveHistory`**. Firma todo lo que el cliente mande mientras pase `parseInteger` + rate-limit por IP/wallet (`enforceRateLimit`, bucket in-memory — se resetea en cold start de Vercel). Riesgo explícito ya documentado en MEMORY.

### 1.8 UI: puntos exactos donde ya hay tx

Funnel Arena (`apps/web/src/app/arena/page.tsx`):
1. Selector dificultad+color → `startGame()` — **sin tx**
2. Partida → moves — **sin tx**
3. Victory/defeat overlay — `ArenaEndState` (linea 813)
4. Victoria → `VictoryCelebration` con CTA mint — `handleClaimVictory` (linea 384): sign → approve → mintSigned
5. Post-mint → `VictoryClaimSuccess` + share card + AskCoach CTA
6. AskCoach sin créditos → `CoachPaywall` → `handleBuyCredits` (linea 313): approve → buyItem → verify-purchase

Funnel PlayHub (`apps/web/src/app/page.tsx`):
1. Exercise completion → score → sign-score → `submitScoreSigned`
2. Level threshold → claim badge → sign-badge → `claimBadgeSigned`
3. Shop bottom-sheet → `PurchaseConfirmSheet` → `buyItem`

### 1.9 Telemetría actual

- **Write-through** a Supabase tras mint (`/api/cache-victory`) y tras score (`/api/cache-score`).
- Tablas Supabase + RLS habilitado (2026-04-19).
- Cron GH Actions 15 min → `/api/cron/sync` (backup al write-through).
- Optimistic localStorage `chesscito:optimistic-victory` para fast-render en `/trophies`.
- **NO existe**: analytics de funnel (vistas → clicks → tx success/cancel), no hay tracking de abandono por paso, no hay cohortes, no hay MRR/ARPU, no hay conversion rate wallet-connected vs no.

### 1.10 Coach — hooks de cobro ya existentes

Coach ya tiene loop tx-first completo (detrás de `NEXT_PUBLIC_ENABLE_COACH`):
- `CoachPaywall` con packs de 5 ($0.05) y 20 ($0.10)
- `handleBuyCredits` (arena/page.tsx:313) — approve → buyItem → verify-purchase on-chain receipt check → Redis `coach:credits:<wallet>`
- `/api/coach/verify-purchase` verifica `ItemPurchased` event topic (`ITEM_PURCHASED_TOPIC`) + previene doble crédito con `coach:processed-tx:<hash>` TTL 90d
- `/api/coach/analyze`, `/api/coach/credits`, `/api/coach/history`, `/api/coach/job`
- `CoachFallback` (quick review) se usa como gancho free → upsell al paywall

---

## 2 · Gaps críticos

### 2.1 Blockers críticos (bloquean revenue serio)

| # | Gap | Archivo / contrato | Impacto |
|---|---|---|---|
| B1 | **Sign-victory firma sin validar transcript** | `apps/web/src/app/api/sign-victory/route.ts` | Cualquiera que conozca el endpoint puede mintear sin jugar |
| B2 | **No hay distribución del prize pool** | `VictoryNFTUpgradeable` — `prizePool` es un EOA, no hay `distribute()` | El 20% acumula pero no mueve la aguja de engagement |
| B3 | **Rate limiter en memoria** | `lib/server/demo-signing` (bucket in-memory) | Cold start = reset = sybil trivial |
| B4 | **elapsedMs no verificable** | `use-chess-game.ts:333` | Scores de tiempo completamente confiables → no hay Ranked creíble |

### 2.2 Importantes (degradan UX de cualquier modelo)

| # | Gap | Archivo | Impacto |
|---|---|---|---|
| I1 | Prices web hardcoded desincronizados de contrato | `tokens.ts:33` | Requiere deploy para cambiar pricing |
| I2 | Shop no tiene página dedicada (solo sheet) | `shop-sheet.tsx` | No hay surface para catálogo creciente |
| I3 | `COACH_PACK_ITEMS` embebido en arena page | `arena/page.tsx:308` | Acopla packs al arena flow |
| I4 | No hay canonical game-session record | N/A | Imposible replay/audit post-hoc |
| I5 | No hay analytics de funnel | N/A | Imposible medir conversion/abandono |
| I6 | Arena no submittea a Scoreboard | N/A | No hay input a Ranked |

### 2.3 Diferibles

- Multi-token explícitamente seleccionable (hoy auto-selecciona por balance).
- Bundles cross-product (ej. "Founder Pack" con Badge + 5 Coach + 1 Shield).
- On-chain pool ledger por temporada (épocas).

---

## 3 · Tres modelos comparados

Todos los modelos usan el catálogo on-chain + la función `buyItem` + el flujo mint existente. Lo que cambia es qué tx se añaden y qué validación server-side se agrega.

| Criterio | **A · Conservador** | **B · Balanceado** | **C · Agresivo** |
|---|---|---|---|
| Loop de usuario | Activar Retry Shield + activar Coach público. Sin tocar Arena Ranked ni prize pool. | A + Ranked submit con session-proof + Prize Pool v1 por epoch. | B + Entry Fee Ranked + Tournament mode + Mint tier "Validated Win". |
| tx nuevas | Shield `buyItem(2,1)`, Coach `buyItem(3\|4,1)` (ya existe). | + `submitScoreSigned` tras Arena win validada + claim epoch `distribute()`. | + `enterRanked()` con fee + `mintSignedValidated()`. |
| Contratos afectados | Ninguno — **zero redeploy**, solo `setItem(2, 25000, true)`. | Nuevo `PrizePoolDistributor` (contrato nuevo, recibe ERC20 del EOA actual o reemplaza el address). | Upgrade VictoryNFT (add `entryFee` + `validated` bit) y/o Ranked contract. |
| Cambios UI | Reactivar item 2 en `SHOP_ITEMS` + hook `useShield` en PlayHub capture exercise; flip `ENABLE_COACH=true`. | + submit-to-ranked flow post-Arena + claim sheet con state por wallet + leaderboard ranked. | + pre-match fee modal, tournament bracket view, tier-filter en trophies. |
| Riesgos de fraude | Bajos — cosmético/utilitario; Shield solo gasta crédito. | Medios — requiere B1 (transcript verify) para no regalar dinero. | Altos — entry fees invitan sybil; necesita B3 + KYC-lite (Divvi, Passport on-web). |
| Esfuerzo | **1-2 días** (admin tx + flip flag + 1 hook useShield). | **1-2 semanas** (contrato distributor + server proof + UI epoch). | **3-4 semanas** (upgrade + auditoría + nueva UX). |
| Redeploy | No. `setItem` + env flag. | Sí, pero contrato **nuevo** (no upgrade de los existentes). | Sí, upgrade de Victory + nuevo Ranked. |
| Revenue unlock | +Retry Shield ~$0.025/partida perdida + Coach ~$0.05–0.10/uso. | + pool real (hoy se descarta UX). | + ticket economy (mayor ARPU, pero concentrada en top tier). |

---

## 4 · Recomendación única

**Ir por modelo B, empezando por un subset del A que desbloquea el B.**

Razón: A solo (Shield + Coach) es dinero de bolsillo sin loop competitivo — no genera retención. C requiere infra anti-sybil que hoy no existe (rate limit in-memory, sin Passport on-chain-verificable en MiniPay). B es el único que convierte el **prize pool acumulado** (que ya existe pero es invisible para el usuario) en un producto.

**Piezas no negociables:**
1. **Canonical session proof server-side** (desbloquea B2 y B4 simultáneamente).
2. **Prize Pool Distributor contrato nuevo** — sin tocar Victory existente.
3. **Off-chain eligibility + on-chain claim** con EIP-712 (mismo patrón que ya usan Victory/Scoreboard/Badges).

---

## 5 · Plan de implementación secuencial

### Fase 0 · Revenue now (2-5 días)

Objetivo: dinero entrando **esta semana** con zero redeploy de contratos existentes y con flujos ya construidos.

1. **Activar Retry Shield** (`itemId=2`, $0.025).
   - Admin tx: `ShopUpgradeable.setItem(2, 25000, true)` desde el Safe admin (ver `owner()` on-chain).
   - Web: descomentar en `apps/web/src/app/page.tsx:55` `SHOP_ITEMS`, añadir item con copy de `SHOP_ITEM_COPY.retryShield`.
   - Hook nuevo `useShield.ts`: lee/escribe `localStorage["chesscito:shields"]` (3 usos/compra), consume antes de bloquear la captura fallida en ejercicios; estado leído en `context-action.ts`.
   - Copy a `editorial.ts`: confirmación + estado "2 shields restantes".
   - **Ningún tema de seguridad nuevo**: Shield es localStorage — si el usuario lo edita se estafa a sí mismo.

2. **Publicar Coach público.**
   - Flip `NEXT_PUBLIC_ENABLE_COACH=true` en Vercel prod.
   - Mover `COACH_PACK_ITEMS` de `arena/page.tsx:308` a `lib/contracts/tokens.ts` (con las otras constantes de pricing).
   - Añadir entry point al Coach desde PlayHub también (hoy es arena-only) — mismo modal `CoachPaywall`.

3. **Telemetría mínima**.
   - Tabla `analytics_events` en Supabase: `event_name`, `wallet`, `session_id`, `props_json`, `ts`.
   - Instrumentar 4 eventos: `tx_initiated`, `tx_approved`, `tx_confirmed`, `tx_canceled` con `source` (`victory`|`shop_founder`|`shop_shield`|`coach_5`|`coach_20`). Hook compartido `useTxTracking.ts`.
   - Dashboard inicial: % abandono approve → buyItem por producto.

**Salida Fase 0**: ARPU incremental + data para priorizar Fase 1.

---

### Fase 1 · Revenue defensible (2-3 semanas)

Objetivo: Arena Ranked con prize pool real y proof anti-abuse.

#### 1.1 · Session Proof v1 (B1 + B4 mitigation)

`/api/sign-victory` nueva forma:

```
POST { player, difficulty, playerColor, initialFen, moveHistory: string[] }

Server:
  1. new Chess(initialFen); for (san of moveHistory) chess.move(san)  // falla si SAN ilegal
  2. assert chess.isCheckmate() && chess.turn() === opponentColor
  3. totalMoves = moveHistory.length (derivado, NO confiado)
  4. transcriptHash = keccak256(abi.encode(player, difficulty, initialFen, moveHistory.join("|")))
  5. save (player, transcriptHash, moveHistory, difficulty, createdAt) en Supabase `verified_games`
  6. sign VictoryMint con (player, difficulty, totalMoves_derived, timeMs_clientReported, nonce, deadline)
```

- `timeMs` sigue siendo auto-reportado pero ya no entra en el score criterio (ver 1.2). Se mantiene como *display-only* en el NFT.
- `transcriptHash` no necesita ir on-chain en v1; vive en Supabase y se expone vía `/api/game/<txHash>` para auditoría.
- Clamp server-side: `moveHistory.length ≤ 300` (partida normal <200), rechazar "moves ilegales" devuelve 400.

**Anti-sybil complementario**: migrar rate limiter de in-memory a **Upstash Redis** (ya usado por coach-credits) usando llave `signvictory:wallet:<addr>` + `signvictory:ip:<ip>` con window 1h.

#### 1.2 · PrizePoolDistributor contrato nuevo

No tocar VictoryNFT (su `prizePool` sigue apuntando al mismo address, pero ahora ese address es el contrato distributor).

```solidity
contract PrizePoolDistributor {
  // Epoch = 7 días UTC. Cada epoch mantiene su propio ledger.
  struct Epoch { uint64 start; uint128 pool; bool claimable; }
  mapping(uint256 => mapping(address => Epoch)) public pools; // epochId → token → Epoch
  mapping(address => mapping(uint256 => bool)) public claimed; // player → epochId → claimed

  // Admin sube merkle root con winners + amounts tras cierre de epoch
  function setEpochMerkleRoot(uint256 epochId, address token, bytes32 root, uint128 total) external onlyOwner;

  // Player claim off-chain authorized + on-chain proof
  function claim(uint256 epochId, address token, uint256 amount, bytes32[] calldata proof) external;
}
```

- **Eligibilidad** (off-chain, reglas en servidor):
  - Al menos 1 Victory `validated` en la epoch.
  - Score = suma de `getEpochScore(player)` = Σ(difficulty_weight × 1/moveCount_bounded).
  - Weights: easy=1, medium=3, hard=10.
- **Distribución v1**: top-20 por score, split 40/25/15/10/5/2.5×5.
- **Merkle root** publicado off-chain al cierre de epoch; root inmutable en contrato.
- **Claim**: EIP-712 firmado por el *mismo signer* + proof; duración 90 días.

#### 1.3 · UI Ranked

- Arena ya emite tx; añadir `/ranked` con:
  - Current epoch pool (lee balance ERC20 del distributor).
  - Live leaderboard (score derivado en Supabase).
  - CTA "Claim prize" si wallet está en el drop.
- `VictoryClaimSuccess` añade chip "Ranked score +X".

#### 1.4 · Anti-sybil mínimo

- Min balance 0.0001 CELO (gas) para participar.
- Min 3 verified games en epoch para aparecer en leaderboard.
- Cooldown entre victorias validadas: 60s (ya existe `mintCooldown=30s`, subir a 60s on-chain).
- Blacklist de wallets reportadas por >50% illegal-SAN rate (metric server-side).

---

### Fase 2 · Revenue scalable (diferido — no empezar sin Fase 1 en prod)

- Entry Fee para Ranked (C model): requiere tx pre-match + UI de "Pay to play".
- Tournament mode (brackets, 16 players, 1 ganador se lleva 60%).
- NFT tier "Validated Win" (upgrade Victory para exponer bit `validated`).
- Suscripción Coach Pro ($1/mes on-chain con Superfluid o Sablier).

---

## 6 · Resumen ejecutivo

**Revenue now (Fase 0)**: Shield + Coach público + telemetría. Zero redeploy, 2-5 días, ARPU incremental.

**Revenue defensible (Fase 1)**: Session proof + PrizePoolDistributor + Ranked UI. Un contrato nuevo + reescribir `/api/sign-victory`. 2-3 semanas.

**No empezar Fase 2** hasta que Fase 1 esté ≥2 semanas en prod con métricas: conversion rate >5% en wallet-connected y <1% illegal-SAN rate.

El código actual **ya soporta** todo lo de Fase 0 hoy mismo y **el 70%** de lo que necesita Fase 1 (Shop quantity, EIP-712 infra, Supabase pipeline, event indexing). Lo único genuinamente nuevo es el distributor contract y el replay-verifier en el sign-victory endpoint.
