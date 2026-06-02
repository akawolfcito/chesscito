# Chesscito — Auditoría Estratégica y Técnica de Monetización

**Fecha:** 2026-06-01
**Autor:** Clausita (audit dirigido por Wolfcito)
**Alcance:** PRO, Coach/Luz, Shop, Victory NFT, modelo comercial, UI/copy, plan por commits.
**Tono:** Directo, crítico, accionable. Sin humo, sin claims médicos, sin NFTs-como-especulación.

---

## TL;DR — qué está realmente en pie

1. **Hay producto, no hay funnel.** Las piezas comerciales existen (PRO + 5 SKUs en Shop + VictoryNFT + Coach con créditos) pero los puntos de entrada no comunican valor antes del paywall.
2. **PRO no es lo que dice la memoria.** Es un **pase mensual ($1.99 / 30 días)**, no lifetime, y **NO está separado del Shop** — es `itemId=6` del mismo contrato `ShopUpgradeable`. Hay deuda técnica: dos rutas de compra paralelas (hook nuevo + `exercises-screen.tsx` legacy) que postean a `/api/verify-pro` cada una.
3. **Coach es el producto más sano del catálogo.** Tiene paywall implementado, free-tier (3 créditos), créditos en Redis, telemetría, fallback básico, paquetes a $0.05/$0.10 ya configurados en mainnet. **Pero no se vende** — el upsell no aparece donde el usuario tiene fricción real.
4. **VictoryNFT es retención disfrazada de revenue.** A $0.005–$0.02 por mint, el ARPU es despreciable; el prize pool **acumula pero no distribuye** (no hay payout code, no hay countdown UI). Vale para narrativa y compartir, no para sostener ingresos.
5. **Riesgo regulatorio / posicionamiento:** los actuales copies ya están bien (no se mencionan claims médicos), pero **el prize pool sin distribución es un compromiso pendiente** con el usuario. O se distribuye, o se renombra a "treasury" sin promesa.

---

## 1. Chesscito PRO — estado real

| Campo | Valor real | Fuente |
|---|---|---|
| `PRO_ITEM_ID` | `6n` | `apps/web/src/lib/contracts/shop-catalog.ts:46` |
| Precio | $1.99 USD (1_990_000 USD6) | `shop-catalog.ts:47` |
| Duración | **30 días** (renovación manual) | `shop-catalog.ts:48` |
| Tipo | Pase mensual, no lifetime, no auto-renew | `pro-sheet.tsx:95` ("Renew" CTA) |
| Tokens aceptados | USDC / USDT / cUSD | `verify-pro/route.ts:113` |
| Source of truth | Redis `coach:pro:{wallet}` con TTL = `expiresAt - now` | `redis-keys.ts:29` |
| Cache cliente | `localStorage["chesscito:pro-active:{wallet}"]` | `use-is-pro-active.ts:8,51` |
| Idempotencia | `coach:pro:processed-tx:{txHash}`, TTL 90 días | `verify-pro/route.ts:19` |
| Bypass admin | Solo `scripts/grant-pro.ts` (dev/QA), no allowlist | — |

**Deuda técnica crítica (P1):**
- **Lógica duplicada de compra**: `useShopSheetState` (`use-shop-sheet-state.ts:429-617`) y `exercises-screen.tsx` (~L350) postean independientemente a `/api/verify-pro`. Cualquier cambio en el flow debe tocar ambos.
- **Sin rate-limit en `/api/verify-pro` por wallet** (solo origin + IP). Bajo riesgo en producción, alto en abuso dirigido.
- **Sin test de integración** del flow completo (compra on-chain → verify → estado activo). Tests unitarios sí.
- **Fallo silencioso post-tx**: si la tx on-chain pasa pero `/api/verify-pro` falla por red, el usuario pagó y no tiene PRO hasta retry. No hay reconciliador automático.

**Superficies donde PRO gating se aplica (12 archivos):**
`arena/page.tsx`, `coach/[gameId]/coach-game-client.tsx`, `coach/history/page.tsx`, `coach/analyze/route.ts`, `arena-hud.tsx`, `coach-preview-card.tsx`, `victory-celebration.tsx`, `coach-panel.tsx`, `game-actions-bar.tsx`, `exercises-screen.tsx`, `hub/training-pass-band.tsx`, `kingdom/kingdom-anchor.tsx`.

**Veredicto:** PRO funciona pero está mal posicionado. El precio ($1.99 / 30 días = $0.066/día) está bien para mercado MiniPay, pero **no hay comunicación de valor antes del paywall**: el usuario ve "Renew" sin saber qué pierde si no renueva.

---

## 2. Coach / Luz — estado real

| Campo | Valor real | Fuente |
|---|---|---|
| Free-tier | 3 créditos iniciales (seed atómico Lua) | `coach/credits/route.ts:23-30` |
| Pack 5 | itemId `3`, $0.05 (50_000 USD6) | `coach/verify-purchase/route.ts:20` |
| Pack 20 | itemId `4`, $0.10 (100_000 USD6) | `coach/verify-purchase/route.ts:21` |
| Storage créditos | Redis `coach:credits:{wallet}` | — |
| Provider LLM | OpenAI `gpt-4o-mini` (override vía `COACH_LLM_MODEL`) | `coach/analyze/route.ts:22` |
| Costo aprox | ~$0.001 / análisis (400-600 in / 1500 out) | gpt-4o-mini pricing |
| Timeout | 45s | `coach/analyze/route.ts:25` |
| Caché de análisis | **NO** (mismo juego → nuevo LLM call) | — |
| PRO bypass | Sí, salta credit check completo | `coach/analyze/route.ts:118-123` |
| Persistencia | Redis (hot) + Supabase `coach_analyses` (solo PRO, TTL 1 año) | `coach/analyze/route.ts:294-317` |
| Feature flag | `NEXT_PUBLIC_ENABLE_COACH` (default true) | `arena/page.tsx:70` |
| Telemetría | 6 eventos (request, idempotent hit, failed, viewer_viewed, ask_coach_tap, mint_receipt_write) | `analyze-telemetry.ts` |

**Margen real por compra:**
- 5-pack ($0.05) → ~5 análisis × $0.001 = $0.005 costo → ~90% margen bruto
- 20-pack ($0.10) → ~20 × $0.001 = $0.02 costo → ~80% margen bruto

**Lo que está oculto / sub-explotado:**
- Coach paywall component (`coach-paywall.tsx`) ya existe pero **no se invoca desde Arena endgame** consistentemente para usuarios libres con 0 créditos.
- No hay **preview** del análisis premium antes del paywall (solo el "BasicCoachResponse" fallback).
- `forceLocale` puede gatillar reanálisis costoso al cambiar idioma → riesgo de fraude/abuso.
- Sin caché por `gameId` → mismo gameId reanalizado paga el LLM dos veces.

**Veredicto:** Coach es **el motor de revenue más prometedor**. Margen alto, valor demostrable (análisis post-partida), barrera psicológica baja ($0.05 entry), gancho recurrente. Solo falta poner el upsell donde duele.

---

## 3. Shop — estado real

Catálogo completo (`shop-catalog.ts`):

| itemId | Nombre | Precio USD6 | Pago | Visibilidad | Estado on-chain |
|---|---|---|---|---|---|
| 1 | Founder Badge | $0.10 | Stablecoin | Visible | Requiere `setItem(1,…)` admin |
| 2 | Retry Shield (3 usos) | $0.025 | Stablecoin | Visible | Requiere `setItem(2,…)` admin |
| 3 | Coach Pack 5 | $0.05 | Stablecoin | Visible | **Configurado** |
| 4 | Coach Pack 20 | $0.10 | Stablecoin | Visible | **Configurado** |
| 5 | Founder Badge (CELO) | $1.00 nominal | CELO | Oculto (web non-MiniPay) | Conditional |
| 6 | PRO | $1.99 | Stablecoin | Visible (lead tile) | Requiere `setItem(6,…)` admin |

**Hallazgos clave:**
- **Founder Badge NO es soulbound NFT.** Es un spend fungible que emite `ItemPurchased` event. No mintea token. `useFounderStatus()` lo deriva leyendo logs. **Perks actuales: 0.** Es un coleccionable sin utilidad funcional.
- **Retry Shield** tiene migración v2 ya implementada (`shield-storage.ts` con 4 keys, cap MAX=30, telemetría cross-tab). Buen estado técnico, sin upsell en momentos de pérdida.
- **Coach packs (3, 4)** están deployados y verificados — listos para comercializar.
- **PRO** requiere todavía `setItem(6, 1_990_000, true)` admin en mainnet para activar la compra.
- **No hay Welcome Pack / Starter Pack** definido aunque la UI deja espacio.

**Env vars dependientes:**
`NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_SHOP_ADDRESS`, `NEXT_PUBLIC_USDC_ADDRESS`, `NEXT_PUBLIC_BADGES_ADDRESS`, `SHOP_DEPLOY_BLOCK_CELO` (server-only, evita unbounded `eth_getLogs`).

---

## 4. Victory NFT — estado real

| Campo | Valor real | Fuente |
|---|---|---|
| Precio Easy | $0.005 (5_000 USD6) | `tokens.ts:58-62` |
| Precio Medium | $0.01 (10_000 USD6) | — |
| Precio Hard | $0.02 (20_000 USD6) | — |
| Fee split | **80% treasury / 20% prize pool** | `VictoryNFTUpgradeable.sol:184-189` |
| Proxy mainnet | `0x0eE22F830a99e7a67079018670711C0F94Abeeb0` | — |
| Validación server | Replay del SAN transcript + checkmate check | `sign-victory/route.ts:53-70` |
| timeMs | **Self-reported** (server firma sin re-derivar) | `sign-victory/route.ts` |
| Nonce + deadline | 8 bytes random + 10 min TTL | `sign-victory/route.ts:154` |
| Rate limit mint | 3/min por address (Upstash sliding window) | `demo-signing.ts:9-37` |
| Distribución prize pool | **NO IMPLEMENTADA** (solo acumula USDC) | `use-prize-pool.ts` |

**Limitaciones reales:**
- **ARPU bajísimo**: $0.005–$0.02 × N mints — para que esto mueva la aguja, se necesitan decenas de miles de victorias/mes.
- **Prize pool es promesa sin payout.** No hay distribución, no hay countdown, no hay ledger Supabase, no hay método de contrato para retirar ni distribuir. La balance se ve en `ArenaSelectScaffold` (cosmético).
- **Self-reported stats** son aceptables a $0.02/mint pero **no escalan** a un v2 con premios reales sin server-side game session verification.

**OG perf**: `/api/og/match` TTFB warm ~2.5s (verificado en memoria 2026-05-31). IG/TikTok strip OG — Save es el bridge real. Share grid solo monetiza vía mints subsecuentes (no directo).

**Veredicto:** Victory NFT es **producto de retención y narrativa, no de revenue**. Sirve para: (a) confirmar al usuario que su victoria existe, (b) compartir, (c) tracking de progreso. Promover como speculative collectible es humo. Promover como **certificado permanente con costo simbólico** es honesto.

---

## 5. Modelo actual — fortalezas, debilidades, veredicto

### Lo que entrega valor real
- **Coach análisis** — output útil (mistakes, lessons, motifs), márgen alto, recurrente.
- **PRO** — unlimited coach + history persistente = propuesta clara para power users.
- **Retry Shield** — utility mecánico real durante partidas duras.
- **Arena vs AI** — gameplay loop sólido (js-chess-engine, 3 dificultades).

### Lo que es simbólico (no sostiene revenue)
- **Founder Badge** — actualmente sin perks. Sin scarcity. Sin recompensa funcional. Solo evento on-chain.
- **Victory NFT** a precios actuales — buen para hábito y orgullo, malo para topline.
- **Prize Pool sin distribución** — compromiso latente con el usuario que no se está cumpliendo.

### Bueno para adquisición/retención, no para revenue
- Free-tier coach (3 créditos) — gancho perfecto para activación.
- Share modal + OG cards — viral loop posible, conversión directa no.
- Training Journal / history — retención sin upsell explícito.

### Bueno para revenue, infra-utilizado hoy
- **Coach packs** — barrera psicológica de $0.05 es ideal para MiniPay. **No se vende donde duele.**
- **PRO 30-day** — el modelo correcto, pero el value-prop nunca se comunica antes del precio.

### Conclusión cruda
El stack monetario está **70% construido y 20% activado**. No falta producto, falta **funnel** — momentos de upsell donde el usuario tiene fricción y la oferta resuelve esa fricción.

---

## 6. Arquitectura comercial propuesta — 4 capas

### Capa 1: FREE (adquisición + hábito)
- Arena Easy ilimitado.
- 3 créditos Coach iniciales (ya existe).
- 5 minutos de exercise tutorials por sesión (no existe; soft-gate ya tiene el espacio en HUD).
- Retry Shield gratis tras racha de 3 derrotas seguidas (no existe; copy de "amparo").
- **Objetivo:** retención D1/D7. **No monetiza.**

### Capa 2: PEONES / Créditos internos (micro-conversión)
- Coach packs 5/20 ($0.05/$0.10) — **ya existen**.
- Retry Shield pack ($0.025) — **ya existe**.
- Founder Badge ($0.10) — **rediseñar como "Welcome Pack"** con valor (ej: 10 créditos coach + 3 shields + skin perfil).
- **Nueva propuesta**: Pack mixto "Starter" ($0.15) = 10 coach credits + 3 shields + perfil cosmético. SKU nuevo (`itemId=7`) — postergable a v2 si requiere contrato.
- **Objetivo:** ARPPU bajo, frecuencia alta. Margen 80%+.

### Capa 3: PRO ($1.99 / 30 días) — recurrente
- Unlimited coach + history persistente + variantes visuales (theme system ya dormido en repo).
- **Nueva promesa concreta** (no humo): "Tu coach personal de ajedrez, 6 centavos al día."
- Promoción: primer mes con 50% off si compras antes del día 3 (`first-pro-offer`).
- **Objetivo:** ARPU sostenido. LTV alto.

### Capa 4: SUPPORTERS / SPONSORS / B2B (futuro)
- **Sponsored tournaments**: brand patrocina prize pool real distribuido (requiere contract v2).
- **Educación / institucional**: paquete de licencias para profesores de ajedrez en LatAm (ya hay tracción Celo + MiniPay en LatAm).
- **Whitelabel mini-app**: clubes de ajedrez con vanity domain.
- **Donaciones / tip jar**: USDC directo al treasury — copy honesto, sin gamification falsa.
- **NO** prometer hasta tener producto. Investigación, no comunicación.

---

## 7. Cambios concretos UI/copy por superficie

### A. Hub (`hub-scaffold-client.tsx`)
- **Reemplazar PRO chip estático** por banner contextual: "Tu coach analizó 0 / 3 partidas gratuitas" → tap → coach history.
- **Mastery tiles**: añadir overlay sutil "Unlock with Coach review" sobre tiles incompletos.
- Copy clave: editorial.ts → `HUB_COACH_TEASER` ("Aprende del que ya jugaste").

### B. Arena setup (`arena/page.tsx` ArenaSelectScaffold)
- Eliminar "Prize pool loading" placeholder hasta que haya distribución real.
- Espacio bajo difficulty selector: chip "PRO: coach ilimitado" solo si user libre y `coachCredits === 0`.
- Copy: "Practica gratis. Aprende con Coach." (sin promesas de premio).

### C. Arena HUD durante partida (`arena-hud.tsx`)
- Si racha de derrotas ≥ 2 + free user: ofrecer **1 shield gratis** al inicio del próximo intento (no cobrar, registrar evento `mercy_shield_granted`).
- No molestar con upsell durante la partida activa.

### D. Endgame overlay (`arena-end-state.tsx`)
- **Win**: orden fijo de CTAs → Save Victory ($0.005-$0.02) → Coach Review (preview gratis si tiene crédito, paywall si no) → Play Again.
- **Loss/Resign**: **Coach Review primero**, no Play Again. Copy: "Vamos a ver qué pasó." → si free + 0 créditos → paywall con preview real (no fallback básico).
- **Draw**: Coach review opcional + Play Again.

### E. Result overlay / Score Saved (`victory-claim-success.tsx`)
- Añadir tile "¿Por qué ganaste?" → Coach review del mismo gameId (consume crédito o paywall).
- Mantener share, eliminar cross-sell ruidoso de PRO en post-mint (momento de celebración).

### F. Shop sheet (`shop-sheet.tsx`)
- **Rediseñar Founder Badge** como "Welcome Pack" con bundle visible (10 coach credits + 3 shields + perfil) — requiere lógica server de "first purchase grant" (ver Plan §8).
- **Reorden por valor**: Coach 20 → PRO → Coach 5 → Shields → Welcome → (Founder oculto si no hay perks).
- Tile "Más próximamente" que ya existe → reemplazar por "Sponsor a player" (donación) cuando esté listo.

### G. Account sheet (`profile-sheet.tsx`)
- Inventory row Coach credits → tap → coach history (no shop). Si 0 créditos → CTA "Get more reviews".
- PRO row con fecha exacta de expiración + botón renew prominente si < 7 días.

### H. Training Journal (`coach-history.tsx`)
- "Analyze" chip en unanalyzed games → si free + 0 créditos: **mostrar preview parcial del análisis** (primer mistake con título borroso), no solo "Get full analysis".
- Eventos: `journal_paywall_view` ya está; añadir `journal_paywall_dismiss` y `journal_paywall_convert`.

### I. Promote screen (`share-modal.tsx`)
- Después de share exitoso: una sola línea "¿Quieres que Coach analice tu próxima?" → CTA contextual.
- No cobrar nada en este momento. Maximizar share completion rate.

### J. Score Saved screen (post-mint)
- Mantener celebración limpia.
- Una sola secondary action: "Review this game" → coach viewer.
- NO añadir banner PRO aquí.

---

## 8. Plan por commits — sin tocar contratos primero

### Cluster M1 — Funnel mínimo viable (sin contrato nuevo)
**Objetivo:** activar el funnel con lo que ya está deployed.

1. `feat(coach): seed 3 free credits on first arena win` — gating de oferta, no de pago. Ya existe seed; añadir trigger en first-win.
2. `fix(shop): collapse PRO purchase flow into useShopSheetState (drop exercises-screen.tsx legacy path)` — elimina deuda técnica de dup logic.
3. `feat(arena): show coach paywall in endgame overlay when free user has 0 credits` — ya hay paywall component, solo falta el wire.
4. `feat(endgame): swap CTA order on loss/draw → Coach first, Play Again second` — copy + reorder.
5. `feat(arena-hud): grant mercy shield after 2 consecutive losses` — telemetry-gated, free.
6. `style(shop): reorder tiles by revenue priority (Coach 20 → PRO → Coach 5 → Shield → Founder)`.
7. `chore(prize-pool): hide prize pool balance until distribution exists` — quita la promesa rota.

### Cluster M2 — Telemetría y conversión
**Objetivo:** medir, no asumir.

8. `feat(telemetry): add coach_paywall_view / dismiss / convert events`.
9. `feat(telemetry): add pro_chip_tap / pro_sheet_view / pro_purchase_start events`.
10. `feat(telemetry): track shield_granted_mercy + shield_purchased correlation`.
11. `chore(analytics): write analytics_events to Supabase (TODO en coach/analyze/route.ts:172)` — backend.
12. `docs(monetization): KPI definitions + funnel conversion targets`.

### Cluster M3 — Copy y promesa
**Objetivo:** decir lo que entregas, no más.

13. `feat(editorial): replace PRO copy from generic "unlock more" to "tu coach personal, 6 centavos al día"`.
14. `feat(editorial): rename "Mint Victory" → "Save Victory" donde no esté ya` — alineación con domain language.
15. `feat(editorial): purge "prize pool" copy hasta tener distribución` — honestidad.
16. `feat(coach-paywall): añadir preview real (1 mistake con título visible)` — UI only, no contrato.

### Cluster M4 — PRO renew + retention
17. `feat(pro): mostrar contador de días restantes + CTA renew si < 7 días`.
18. `feat(pro): "first month 50% off" promo si compra en primeras 72h (env-flag)` — server logic.
19. `feat(coach): cache análisis por (gameId, locale) en Redis con TTL 30 días` — reduce costo LLM en reanálisis.

### Cluster M5 — Welcome Pack (requiere contrato o server logic)
20. `feat(shop): Welcome Pack como bundle server-side (compra Founder $0.10 + grant 10 credits + 3 shields)` — sin contrato nuevo, solo server side-effect en `/api/founder-status` o webhook.
21. `feat(shop): si server-side bundle se complica → propone nuevo `itemId=7` Welcome Pack al admin (deferido a v2)`.

### Cluster M6 — POSTERGADO (requiere contrato)
- VictoryNFT v2 con server-side game session verification.
- Prize pool distribution mechanism (ledger Supabase + admin distribution UI + contract method).
- Sponsored tournament infrastructure.
- Soulbound Founder Badge si se decide darle perks reales y no-transferibles.

---

## 9. Lente A/B/C/D/E

### A. Lo que ya está implementado (puede comercializarse hoy)
- Coach paywall component + créditos pack 5 y 20 (mainnet OK).
- PRO purchase flow (pendiente `setItem(6, 1_990_000, true)` admin en mainnet).
- VictoryNFT minting flow (deployed mainnet).
- Shop sheet + Account inventory rows.
- Telemetría base coach (6 eventos).
- Founder/Shield purchase paths.
- Editorial.ts como single source of truth de copy.
- Dock-sheet system reutilizable.

### B. Lo que está oculto por flag
- `NEXT_PUBLIC_ENABLE_COACH` — coach UI completa (default ON, cliente puede apagarlo).
- `NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS` — refactor hook coach (default OFF).
- Founder CELO sibling (itemId=5) — oculto en non-MiniPay web.
- Theme system foundation (project_theme_system_foundation) — dormido, listo para variantes PRO visuales.
- `NEXT_PUBLIC_QA_MODE` — bypass de niveles para QA.

### C. Lo que requiere solo copy/UI (días, no semanas)
- Reorder CTAs en endgame overlay.
- Hide prize pool balance hasta tener distribución.
- Renombrar Founder a Welcome Pack (UI only si server-side grant es server logic).
- Coach paywall preview con primer mistake visible.
- PRO chip → días restantes + renew prominente.
- Mercy shield after 2 losses (sin pago).

### D. Lo que requiere backend (semanas)
- Server-side reconciler de PRO tx fallidas.
- Coach analysis cache por (gameId, locale).
- analytics_events table en Supabase con writer en routes.
- Welcome Pack como server-side bundle (grants tras Founder purchase).
- First-month 50% off promo logic.
- Distribución prize pool — ledger + payout UI + cron de distribución.

### E. Lo que requiere contrato nuevo (postergable)
- VictoryNFT v2 con server-side game session attestation.
- Welcome Pack como `itemId=7` (alternativa al server-side bundle).
- Prize pool con método de distribución on-chain.
- Soulbound Founder Badge si se decide darle perks reales.
- Sponsored tournament smart contract.
- Founder Badge con scarcity (max supply on-chain).

---

## 10. Riesgos / no-vender-humo

- **Prize pool sin distribución** es la mayor deuda con el usuario actual. O se distribuye antes de Q3, o se renombra a "treasury" y se explica honestamente que cubre costos operativos.
- **VictoryNFT como speculative collectible** no debe comunicarse. Es certificado permanente, low-cost, simbólico — ese es el frame correcto.
- **No prometer "ganar dinero jugando"** — el modelo es aprender ajedrez con acompañamiento + colección de victorias propias.
- **Claims médicos / cognitivos** (memoria, demencia, atención): prohibidos sin evidencia clínica. Hablar de **práctica, hábito, progreso, paciencia, autonomía** — no de salud cerebral.
- **Tono Celo / MiniPay**: micropagos como acceso, no como inversión. El stablecoin es plomería, no producto.

---

## 11. KPIs propuestos para medir M1–M4

| KPI | Definición | Target T+30d |
|---|---|---|
| `coach_paywall_view` rate | views / endgame_views (free users) | ≥ 60% |
| `coach_paywall_convert` rate | purchases / paywall_views | ≥ 5% |
| `pro_purchase` count | unique wallets / mes | tracking baseline |
| `victory_mint` count | mints / wins | tracking baseline |
| Coach analysis cost / user | $LLM / DAU | < $0.005 |
| PRO renewal rate (D30) | renews / expirations | ≥ 25% (industry baseline) |
| Shield purchase after grant | purchases / mercy_shield_granted | ≥ 8% |

Sin estos números, todo lo demás es opinión.

---

**Próximo paso recomendado:** ejecutar Cluster M1 (commits 1-7) en una sesión enfocada. Costo: 1-2 días. ROI: el funnel pasa de "existe" a "vende".
