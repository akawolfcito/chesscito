# Chesscito — Mapa de monetización (2026-04-30)

Snapshot del estado actual de cada vector de ingreso, qué superficie del app lo expone, qué contrato/endpoint lo respalda y qué falta para activarlo.

---

## 1. Vectores activos en producción

### A. Shop on-chain (`ShopUpgradeable`)
Pagos en USDC/USDT/cUSD (stablecoins) o CELO nativo. Contrato proxy en Celo Mainnet `0x24846C77…`. Cada SKU es un `itemId` configurable on-chain por admin (`setItem(id, priceUsd6, enabled)`).

| SKU | itemId | Precio | Qué entrega | Superficie |
|---|---|---|---|---|
| **Founder Badge** | 1 | $0.10 | NFT soulbound de reconocimiento | `/play-hub` shop card |
| **Founder Badge (CELO)** | 5 | ~1 CELO | Misma badge, ruta web (no MiniPay) | Botón "Buy with CELO" |
| **Retry Shield** | 2 | $0.025 | 3 usos en localStorage, evita streak penalty | `/play-hub` shop card |
| **Coach Pack 5** | 3 | $0.05 | 5 créditos de análisis IA | Coach paywall (oculto behind flag) |
| **Coach Pack 20** | 4 | $0.10 | 20 créditos de análisis IA | Coach paywall (oculto behind flag) |
| **Chesscito PRO** | 6 | $1.99 / 30d | Coach ilimitado (bypass credit ledger) | `/play-hub` PRO card |

**Split de fee Shop**: hoy va 100% al treasury (no hay split como en VictoryNFT).

### B. Victory NFT (`VictoryNFTUpgradeable`)
Mint opcional al ganar en `/arena`. Contrato proxy Mainnet `0x0eE22F83…`.

| Dificultad | Precio | priceUsd6 |
|---|---|---|
| Easy | $0.005 | 5_000 |
| Medium | $0.01 | 10_000 |
| Hard | $0.02 | 20_000 |

**Split hardcodeado**: **80% treasury / 20% prize pool**. El prize pool ya acumula on-chain pero **la distribución (v2) no está implementada** — el contrato no tiene aún método de payout. UI muestra "Distribution v2 coming" en `/arena`.

### C. Coach (paywall + PRO bypass)
- Free tier: créditos gratuitos (cantidad pequeña al onboarding).
- Paid: Coach Packs (one-shot) o PRO (suscripción mensual = unlimited).
- Endpoint `/api/coach/verify-purchase` lee evento `ItemPurchased`, suma créditos en Redis (`coach:credits:<addr>`).
- PRO: `/api/verify-pro` valida compra, escribe `coach:pro:<wallet>` con TTL 30d.
- **UI oculta tras `NEXT_PUBLIC_ENABLE_COACH`** — no monetiza públicamente todavía.

---

## 2. Stack de pagos soportado

- **Stablecoins** (allowlisted): USDC `0xceBA…`, USDT `0x4806…`, cUSD `0x765D…`.
- **CELO nativo**: ruta separada con itemId helper (5) porque el contrato normaliza priceUsd6 asumiendo 1 token = 1 USD.
- **Chains**: Celo Mainnet (42220) ✅ live, Celo Sepolia (11142220) ✅ test.
- **Wallets**: MiniPay (target principal), wallet web (fallback secundario).

---

## 3. Superficies del app — qué monetiza cada una

| Ruta | Función | Monetización |
|---|---|---|
| `/` → `/play-hub` | Hub principal (mission, shop, PRO, badges) | **Founder Badge, Retry Shield, PRO subscription** |
| `/arena` | Free play vs IA (3 dificultades) | **Victory NFT mint** post-victoria |
| `/levels`, `/play` | Tutoriales pre-ajedrecísticos por pieza | Indirecto: drives engagement → shop |
| `/trophies` | Hall of Fame, achievements, my victories | Retención (no monetiza directo) |
| `/leaderboard` | Top scores on-chain | Retención + revalidate=60s |
| `/victory/[id]` | Página pública de un Victory NFT | SEO + viral share (no monetiza directo) |
| `/why`, `/about`, `/support`, `/privacy`, `/terms` | Marketing + legal | Soft-conversion |
| `/hub`, `/result` | Flujos post-game | Up-sell (mint + shop) |
| `/api/cron/sync` | Sync Supabase ← chain | Habilita lectura barata (~5ms) |

---

## 4. Cómo monetizamos hoy — funnel real

1. **Acquisition** → MiniPay miniapp (Celo) + landing `/why` (ES) + pitch video v3.9.
2. **Activation** → tutorial gratis (rook → bishop → knight → pawn → queen → king); badge soulbound al completar cada pieza (gratis, claim on-chain).
3. **First conversion** ($0.025 – $0.10):
   - **Retry Shield** durante exercises difíciles (impulse buy en momento de fricción).
   - **Founder Badge** como acto de soporte (status, no power).
4. **Engagement → micro-mint** ($0.005 – $0.02):
   - **Victory NFT** al ganar en Arena. Precio escala con dificultad (gold standard de logro).
5. **Retention → suscripción** ($1.99/mes):
   - **Chesscito PRO** = Coach ilimitado. Phase 0 sólo Coach; perks roadmap (torneos, achievements premium, descuentos VictoryNFT).
6. **Viral** → share de Victory NFT con OG image (`/api/og`); referidos (Invite — actualmente en About + Victory share, no en dock).

---

## 5. Estado de cada SKU — listo / falta

| SKU | Contrato configurado | UI live | Vercel/Backend | Notas |
|---|---|---|---|---|
| Founder Badge (USD) | ✅ Mainnet | ✅ | ✅ | Comprable hoy |
| Founder Badge (CELO) | ⚠️ Falta `setItem(5)` + `setAcceptedToken(CELO)` | ✅ Hidden until configured | ✅ | Botón aparece sólo si configured |
| Retry Shield | ✅ Mainnet | ✅ | ✅ | Comprable hoy |
| Coach Pack 5/20 | ✅ Mainnet | ⚠️ Hidden behind flag | ✅ | UI no expuesta públicamente |
| Coach PRO ($1.99/30d) | ✅ Mainnet (tx `0x32c1adb4…`) | ✅ Code shipped | ⚠️ **Vercel env vars + smoke pendiente** | **7-day measurement freeze en curso** |
| Victory NFT (3 tiers) | ✅ Mainnet | ✅ | ✅ | Comprable hoy |
| Prize Pool distribution (v2) | ❌ Método no existe | UI muestra "coming" | ❌ | **Roadmap futuro** |

---

## 6. Oportunidades de monetización que NO estamos cobrando hoy

Cosas que el código soporta (o casi) pero no estamos exprimiendo:

1. **Coach paywall público** — el flujo está implementado, sólo falta quitar el flag `NEXT_PUBLIC_ENABLE_COACH`. Bloqueador: validar UX y métricas Phase 0.
2. **Prize pool v2** — 20% de cada Victory mint ya se acumula on-chain. Falta diseñar mecánica de payout (top weekly winners, raffle, etc.) + método del contrato.
3. **Multi-piece Founder Badges** — hoy solo hay 1 itemId Founder. Podríamos lanzar series limitadas estacionales (Halloween, Q1, etc.).
4. **Achievements premium** — `lib/achievements/*` ya genera 7 badges derivados gratis. Podrían existir tiers premium (ej. "Speedrun Master" sólo para PRO).
5. **VictoryNFT discount para PRO** — copy ya menciona "Discounted VictoryNFT mints (coming soon)". Falta lógica EIP-712 que reconozca PRO al firmar.
6. **Tournament priority** — listado en PRO_COPY.perksRoadmap. Sin implementación.
7. **Skins / temas de tablero** — no existe SKU. Sería pure cosmetic.
8. **Hint / undo packs** en Arena — no existe SKU.
9. **Booster boards** (XP multiplicador por X horas) — no existe SKU.
10. **Sponsored squares / brand integrations** en el board — modelo B2B, no implementado.

---

## 7. Métricas / qué NO sabemos hoy

- No hay dashboard de revenue por SKU. Telemetría on-chain existe (`/api/telemetry` + Vercel funnel events para PRO), pero no hay vista agregada.
- Conversion rate del funnel: tutorial → first purchase → second purchase → PRO — sin instrumentar.
- ARPU, LTV, churn — sin medir.
- 7-day freeze de PRO Phase 0 (en curso) es la primera medición real de conversión a sub.

---

## TL;DR — modelo de negocio actual

**Free-to-play educativo + micro-purchases on-chain en stablecoins + suscripción mensual.**

- **Floor** ($0.005 – $0.10): Victory NFT mints + Retry Shield + Coach Packs.
- **Mid** ($0.10 – $1.00): Founder Badges, segundas compras de shields/packs.
- **Sub** ($1.99/mes): Chesscito PRO — único SaaS recurrente, en Phase 0.
- **B2C Web3-native**: pagos sin Stripe/Apple, 100% on-chain, MiniPay como rail.
- **Treasury split**: Shop → 100% treasury. VictoryNFT → 80/20 treasury/pool.
