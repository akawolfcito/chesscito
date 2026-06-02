# Chesscito — Inventario Técnico de Monetización (M1)

**Fecha:** 2026-06-01
**Autor:** Clausita (dirigido por Wolfcito)
**Propósito:** Separar exactamente qué existe hoy en el repo, qué está apagado por flag, qué se entrega solo con UI/copy, qué necesita backend, qué requiere contrato nuevo, qué se posterga, y qué riesgos / deuda técnica tenemos.
**Fuente:** `docs/monetization/2026-06-01-strategic-audit.md` (sección 9 A/B/C/D/E + sección 2 + sección 10).

---

## A. Lo ya implementado (puede comercializarse hoy)

### A1. Coach / Luz
- **Endpoint análisis:** `apps/web/src/app/api/coach/analyze/route.ts`
- **Modelo LLM:** OpenAI `gpt-4o-mini` (override `COACH_LLM_MODEL`)
- **Costo estimado:** ~$0.001 por análisis (400-600 in / 1500 out tokens)
- **Free-tier:** 3 créditos iniciales (seed atómico Lua, `coach/credits/route.ts:23-30`)
- **Packs:**
  - Pack 5: itemId `3`, $0.05 USD6 — **configurado en mainnet**
  - Pack 20: itemId `4`, $0.10 USD6 — **configurado en mainnet**
- **Storage:** Redis `coach:credits:{wallet}` (hot) + Supabase `coach_analyses` para PRO (TTL 1 año)
- **Idempotencia:** `coach:processed-tx:{txHash}` con TTL 90 días
- **PRO bypass:** salta credit check (`coach/analyze/route.ts:118-123`)
- **Componente paywall:** `apps/web/src/components/coach/coach-paywall.tsx` (existe pero **no se invoca consistentemente** desde Arena endgame)
- **Timeout:** 45s
- **Telemetría existente:** 6 eventos (`analyze.request`, `analyze.idempotent_hit`, `analyze.failed`, `viewer.viewed`, `ask_coach.tap`, `mint_receipt.write`)

### A2. PRO
- **Item ID:** `6n` en `apps/web/src/lib/contracts/shop-catalog.ts`
- **Precio:** $1.99 USD (1_990_000 USD6)
- **Duración:** 30 días, renovación manual (no auto-renew on-chain)
- **Tokens aceptados:** USDC / USDT / cUSD
- **Source of truth:** Redis `coach:pro:{wallet}` con TTL = `expiresAt - now`
- **Cache cliente:** `localStorage["chesscito:pro-active:{wallet}"]` (hook `useIsProActive`)
- **Verify endpoint:** `apps/web/src/app/api/verify-pro/route.ts` (idempotente vía `coach:pro:processed-tx:{txHash}`, TTL 90 días)
- **Surfaces con PRO gating (12 archivos):** `arena/page.tsx`, `coach/[gameId]/coach-game-client.tsx`, `coach/history/page.tsx`, `coach/analyze/route.ts`, `arena-hud.tsx`, `coach-preview-card.tsx`, `victory-celebration.tsx`, `coach-panel.tsx`, `game-actions-bar.tsx`, `exercises-screen.tsx`, `hub/training-pass-band.tsx`, `kingdom/kingdom-anchor.tsx`
- **Activación on-chain:** **PENDIENTE** — requiere `setItem(6, 1_990_000, true)` en mainnet para que la compra esté disponible.

### A3. Shop catálogo completo
| itemId | Nombre | Precio | Pago | Visibilidad | Estado on-chain |
|---|---|---|---|---|---|
| 1 | Founder Badge | $0.10 | Stablecoin | Visible | Requiere `setItem(1,…)` admin |
| 2 | Retry Shield (3 usos) | $0.025 | Stablecoin | Visible | Requiere `setItem(2,…)` admin |
| 3 | Coach Pack 5 | $0.05 | Stablecoin | Visible | **Configurado** |
| 4 | Coach Pack 20 | $0.10 | Stablecoin | Visible | **Configurado** |
| 5 | Founder Badge (CELO) | $1.00 nominal | CELO | Oculto (no MiniPay web) | Conditional |
| 6 | PRO | $1.99 | Stablecoin | Visible (lead tile) | Requiere `setItem(6,…)` admin |

### A4. Victory NFT (Mint your Victory)
- **Contrato:** `VictoryNFTUpgradeable` (deployed mainnet)
- **Proxy mainnet:** `0x0eE22F830a99e7a67079018670711C0F94Abeeb0`
- **Precios:** Easy $0.005 / Medium $0.01 / Hard $0.02 (USD6)
- **Fee split:** **80% treasury / 20% prize pool** (hardcoded en contrato)
- **Endpoint signing:** `apps/web/src/app/api/sign-victory/route.ts`
- **Validación:** replay del SAN transcript + checkmate check
- **Nonce + deadline:** 8 bytes random + 10 min TTL
- **Rate limit:** 3/min por address (Upstash sliding window)

### A5. Retry Shield (storage v2)
- **Migración v2:** `apps/web/src/lib/game/shield-storage.ts` — 4 keys, cap MAX=30, telemetría cross-tab
- **Compra:** itemId `2`, $0.025, 3 usos
- **Estado:** buen estado técnico, pero **no se vende en momentos de fricción real** (post-loss).

### A6. Founder Badge
- **itemId:** `1`, $0.10
- **Implementación:** spend fungible que emite `ItemPurchased` event
- **Hook:** `useFounderStatus()` deriva estado leyendo logs
- **NO es soulbound NFT.** No mintea token. **No tiene perks definidos.**

### A7. Account inventory
- **Componente:** `apps/web/src/components/sheets/profile-sheet.tsx`
- **Rows implementadas:** Coach credits, Shields, Founder, PRO status — todas con destino
- **Memory:** `project_account_inventory_rows` (every shop SKU tiene row)

### A8. Editorial / copy
- **Single source of truth:** `apps/web/src/lib/content/editorial.ts`
- **Constants:** GLOSSARY, CTA_LABELS, PIECE_LABELS, ARENA_COPY, VICTORY_MINT_COPY, VICTORY_PAGE_COPY, DIFFICULTY_LABELS, CHAIN_NAMES, PURCHASE_FIELD_LABELS, + 18 otras
- **Reglas anti-AI:** em/en-dash bloqueados por test de regresión (`project_anti_ai_prose_ceiling`).

### A9. Otros sistemas comerciales
- **CTA token system** (`globals.css :root`) — 5 familias canónicas
- **HUD chip family** (`.candy-tray-pill + .hub-hud-pill + ...`) — reutilizable
- **Dock-sheet system** — reutilizable
- **Theme system foundation** — dormido, `useThemeAsset(key, variant?)` (`project_theme_system_foundation`)
- **Telemetría base Coach:** 6 eventos vivos en `apps/web/src/lib/analytics/analyze-telemetry.ts`

---

## B. Lo oculto por flags

| Flag | Default | Propósito |
|---|---|---|
| `NEXT_PUBLIC_ENABLE_COACH` | ON | Apaga Coach UI completa (kill switch) |
| `NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS` | OFF | Refactor de hooks Coach |
| `NEXT_PUBLIC_QA_MODE` | OFF | Bypass de niveles para QA |
| Founder CELO sibling (`itemId=5`) | Oculto en non-MiniPay web | SKU CELO duplicado |
| Theme system | Dormido | Variantes visuales PRO listas para drop de assets |

**Riesgo:** flags acumulan ruido. Cada flag tiene **costo de testing** + **branches de código**. Audit pendiente: ¿cuáles podemos eliminar tras M1?

---

## C. Lo que requiere SOLO UI / copy (días, no semanas)

Estas tareas no tocan backend ni contrato. Son la palanca de M1 con mayor ROI.

| # | Cambio | Archivos | Esfuerzo |
|---|---|---|---|
| C1 | Reorder CTAs en endgame loss/resign → Coach primero, Play Again segundo | `arena-end-state.tsx` | S |
| C2 | Coach paywall preview con primer mistake visible (no fallback básico) | `coach-paywall.tsx` | S |
| C3 | Hide prize pool balance en `ArenaSelectScaffold` | `arena/page.tsx`, `use-prize-pool.ts` UI consumers | XS |
| C4 | PRO chip mostrar días restantes + CTA renew prominente si < 7 días | `profile-sheet.tsx`, `pro-sheet.tsx`, hub HUD | S |
| C5 | Reorder Shop tiles por valor (Coach 20 → PRO → Coach 5 → Shield → Welcome → Founder) | `shop-sheet.tsx` | XS |
| C6 | Esconder Founder Badge si no tiene perks (o renombrar a Welcome Pack en UI) | `shop-sheet.tsx`, `editorial.ts` | XS |
| C7 | Copy purge: eliminar `miniPayWarning` legacy, rename `viewOnCeloscan` → `receiptOnCeloscan` | `editorial.ts` | XS |
| C8 | Inventory Coach row → tap a coach history (no Shop) | `profile-sheet.tsx` | XS |
| C9 | Endgame win: Save Victory primary, Coach review secondary, Play Again tertiary | `arena-end-state.tsx` | XS |
| C10 | Save Victory success: añadir "¿Por qué ganaste?" tile, eliminar cross-sell PRO | `victory-claim-success.tsx` | XS |
| C11 | Hub HUD: chip contextual "Tu coach analizó 0 / 3 partidas" en lugar de PRO estático | `hub-scaffold-client.tsx`, `mission-briefing.tsx` | M |
| C12 | Copy PRO: de "unlock more" a "Entrena con Luz todos los días" / "6 centavos al día" | `editorial.ts` PRO_COPY block | XS |
| C13 | Coach paywall invocado consistentemente desde Arena endgame con 0 créditos free | `arena-end-state.tsx` + `arena/page.tsx` | M |

**Tamaños:** XS < 1h, S = 1-3h, M = 3-8h.

---

## D. Lo que requiere backend (semanas)

| # | Cambio | Razón | Esfuerzo |
|---|---|---|---|
| D1 | **Consolidar lógica de compra PRO** (drop `exercises-screen.tsx` legacy path) | Deuda técnica P1 — dos rutas postean a `/api/verify-pro` | M |
| D2 | **Reconciliador de tx pagada que falla en `/api/verify-pro`** | Usuario paga, no recibe PRO si network falla post-tx | L |
| D3 | **Cache de análisis Coach por `(gameId, locale)`** en Redis TTL 30 días | Evita re-cobrar LLM por reanálisis o cambio de locale | M |
| D4 | **`analytics_events` table en Supabase** + writer en routes (TODO en `coach/analyze/route.ts:172`) | Telemetría sin destino persistente actual | M |
| D5 | **Welcome Pack como server-side bundle** (compra Founder $0.10 → grant 10 credits + 3 shields) | Alternativa sin contrato nuevo | M |
| D6 | **First-month 50% off promo logic** (compra en primeras 72h) | Conversión inicial | M |
| D7 | **Rate limit `/api/verify-pro` por wallet** (no solo origin + IP) | Anti-abuso dirigido | S |
| D8 | **Cron de seed coach credits on first arena win** | Activación post-primera-victoria | S |
| D9 | **Telemetry endpoint robusto** (paywall_view / dismiss / convert + pro_chip / shield correlación) | Funnel medible | M |
| D10 | **Validación servidor-side de `forceLocale`** (evitar reanálisis pagado por cambio de idioma) | Vector de abuso | S |

**Tamaños:** S = 1-3 días, M = 3-8 días, L = 8-15 días.

---

## E. Lo que requiere contrato nuevo (postergable a M5/M6)

| # | Cambio | Razón |
|---|---|---|
| E1 | **Welcome Pack itemId=7** (alternativa al server-side bundle) | Si bundle server-side se complica |
| E2 | **VictoryNFT v2 con server-side game session attestation** | Para distribuir premios reales sin self-reported stats |
| E3 | **Prize pool con método de distribución on-chain** | Para cumplir promesa de prize pool |
| E4 | **Soulbound Founder Badge** | Si se decide darle perks reales no-transferibles |
| E5 | **Sponsored tournament contract** | Para tournaments pagados por brand |
| E6 | **Founder Badge con scarcity** (max supply on-chain) | Si se quiere darle valor coleccionable real |

**Estado:** ninguno aprobado para M1. Cada uno requiere audit + deploy + verification.

---

## F. Lo postergado explícitamente

**Cluster M6 (post-M1, post-M5):**
- VictoryNFT v2 con attestation server-side
- Prize pool distribution (ledger Supabase + admin distribution UI + cron + contract method)
- Sponsored tournament infra
- Soulbound Founder Badge (si se le da perks reales)

**Parking lot (no roadmap activo):**
- Torneos pagados
- Sponsors / B2B colegios
- Whitelabel mini-app
- Rankings avanzados / ELO
- Sistema de referidos
- Season pass

Ver `docs/product/chesscito-monetization-parking-lot-2026-06-01.md`.

---

## G. Riesgos técnicos

### G1. Riesgos de PRO
- **Lógica duplicada de compra** (P1): `useShopSheetState` + `exercises-screen.tsx` legacy. Cualquier cambio toca ambos. **Acción M1:** colapsar (item D1).
- **Sin reconciliador post-tx**: si tx on-chain pasa pero `/api/verify-pro` falla, usuario pagó y no tiene PRO. No hay retry automático ni reconciliation cron. **Acción M2:** D2.
- **Sin rate-limit por wallet** en `/api/verify-pro` (solo origin + IP). Bajo riesgo en prod, alto en abuso dirigido.
- **Sin test de integración** del flow completo (compra on-chain → verify → estado activo). Solo tests unitarios.
- **`setItem(6, ...)` mainnet pendiente** — PRO no se puede comprar hasta esto.

### G2. Riesgos de Coach
- **Sin caché por `(gameId, locale)`** → mismo gameId reanalizado paga el LLM dos veces.
- **`forceLocale` puede gatillar reanálisis costoso** al cambiar idioma → vector de fraude/abuso.
- **Coach paywall no se invoca consistentemente** desde Arena endgame para free users con 0 créditos. El gancho más caliente está apagado.
- **Sin preview real** del análisis premium antes del paywall (solo BasicCoachResponse fallback).
- **PRO bypass salta credit check completo** (`analyze/route.ts:118-123`) — correcto, pero requiere validar que `useIsProActive` no devuelva false positives en cold-load.

### G3. Riesgos de Victory NFT
- **`timeMs` self-reported** (server firma sin re-derivar). Aceptable a $0.02/mint, no escala a v2 con premios reales.
- **Rate limit 3/min por address** en mainnet — bajo riesgo si los precios suben.
- **ARPU bajísimo** ($0.005–$0.02). No es palanca de revenue real.
- **Origen enforcement** depende de `NEXT_PUBLIC_APP_URL` + `VERCEL_*_URL`. Cambios de domain rompen `/api/sign-*` sin telemetría (memory `project_domain_migration_origin_check`).
- **OG perf** (`/api/og/match` TTFB warm ~2.5s) — bottleneck no resuelto (`project_satori_og_perf_constraints`).

### G4. Riesgos de Prize Pool
- **NO HAY DISTRIBUCIÓN** implementada. Acumula USDC en el contrato, no se reparte.
- No hay payout code, ni countdown UI, ni ledger Supabase, ni método de contrato para retirar/distribuir.
- **Promesa pendiente con el usuario** si la balance se sigue mostrando.

### G5. Riesgos de Shop
- **Founder Badge sin perks** (P2): SKU activo pero vacío.
- **Sin Welcome Pack** definido aunque la UI deja espacio.
- **Activación admin de itemIds** en mainnet pendiente: `setItem(1,…)`, `setItem(2,…)`, `setItem(6,…)`.

### G6. Riesgos transversales
- **MiniPay tightly coupled**: cambios de domain rompen origin allowlist silenciosamente (memory `project_domain_migration_origin_check`).
- **VR baselines pueden romperse** con cambios de UI comercial — política `feedback_vr_baseline_discipline` aplica.
- **Anti-AI prose ceiling** activo: em/en-dash bloqueados en CI (`project_anti_ai_prose_ceiling`).

---

## H. Deuda técnica crítica (P0/P1)

### P0 (bloqueante para M1)
1. **Lógica duplicada de compra PRO** (D1) — bloquea cualquier cambio confiable de flow.
2. **Coach paywall no se invoca en endgame** (C13) — el gancho clave está apagado.
3. **Prize pool visible sin distribución** (C3) — deuda con usuario activa.
4. **`setItem(6, ...)` mainnet pendiente** — PRO inactivo.

### P1 (debe resolverse en M2-M3)
5. **Sin reconciliador post-tx PRO** (D2).
6. **Sin cache `(gameId, locale)` Coach** (D3).
7. **Sin `analytics_events` table** (D4).
8. **Founder Badge sin perks ni rediseño** (C6 o E1).
9. **Sin rate-limit por wallet** en `/api/verify-pro` (D7).
10. **`forceLocale` reanálisis libre** (D10).

### P2 (puede esperar a M4-M6)
11. VictoryNFT v2 con attestation (E2).
12. Prize pool distribution (E3 + D distribución cron).
13. Soulbound Founder Badge (E4).
14. Sponsored tournament infra (E5).
15. Coach analysis cost monitoring dashboard.
16. Auditoría de flags acumulados.

---

## I. Métricas / KPIs propuestos (M1 → M4)

| KPI | Definición | Target T+30d |
|---|---|---|
| `coach_paywall_view` rate | views / endgame_views (free users) | ≥ 60% |
| `coach_paywall_convert` rate | purchases / paywall_views | ≥ 5% |
| `pro_purchase` count | unique wallets / mes | baseline tracking |
| `victory_mint` count | mints / wins | baseline tracking |
| Coach cost / DAU | $LLM total / DAU | < $0.005 |
| PRO renewal D30 | renews / expirations | ≥ 25% (industry baseline) |
| Shield purchase after mercy | purchases / mercy_shield_granted | ≥ 8% |

Sin estos números, todo lo demás es opinión.

---

## J. Resumen ejecutivo del inventario

- **Estado del stack:** ~70% construido, ~20% activado. No falta producto, falta funnel.
- **Lo activable hoy con copy/UI:** C1–C13 (13 cambios, ningún contrato nuevo).
- **Lo activable con backend:** D1–D10 (10 cambios, sin contrato).
- **Lo postergado a contrato:** E1–E6 (NO en M1).
- **Deuda crítica P0:** 4 ítems (logic duplicate PRO, paywall apagado, prize pool roto, `setItem(6)` mainnet pending).
- **Decisión:** ejecutar Cluster M1 (UI/copy + paywall wire) en una sesión enfocada. ROI: el funnel pasa de "existe" a "vende" sin tocar contratos.

---

## Referencias

- Audit base: `docs/monetization/2026-06-01-strategic-audit.md`
- Dirección: `docs/product/chesscito-monetization-direction-2026-06-01.md`
- Funnel: `docs/product/chesscito-monetization-funnel-map-2026-06-01.md`
- Parking lot: `docs/product/chesscito-monetization-parking-lot-2026-06-01.md`
- Copy rules: `docs/product/chesscito-commercial-copy-rules-2026-06-01.md`
- Memorias técnicas: `project_arena_play_timer_fragility`, `project_mint_hook_gameid_scoping`, `project_domain_migration_origin_check`, `project_satori_og_perf_constraints`.
