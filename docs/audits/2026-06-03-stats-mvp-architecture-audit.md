# `/stats` MVP — Architecture Audit (read-only)

**Fecha:** 2026-06-03
**Scope:** Diseñar `/stats` MVP público alimentado SOLO con datos existentes (Supabase + Redis). Sin Dune, sin indexer, sin chain reads en runtime, sin reabrir founder-status / Labyrinth / ODIS.
**Modo:** Read-only audit. NO se tocó código.

---

## 1. Datos existentes — inventario completo

### 1.1 Tablas Supabase activas (verificadas vía grep `from("...")` en `apps/web/src`)

| Tabla | Rol | RLS | Origen de writes |
|---|---|---|---|
| `victories` | Victory NFT mints | service role | `/api/cache-victory` (client) + `/api/cron/sync` (authoritative) |
| `scores` | Game scores con tx_hash | service role | `/api/cache-score` + cron sync |
| `leaderboard_v` | Materialized view sobre scores | service role | refresh by sync cron |
| `sync_state` | Cron cursor key/value | service role | `/api/cron/sync` |
| `passport_cache` | Self Passport verification por wallet | service role | cron sync |
| `analytics_events` | Telemetría anónima (session_id + event + jsonb props) | service role; 90-day TTL via cron `prune_analytics_events` | `/api/telemetry` |
| `coach_analyses` | Coach session memory (wallet, game_id, mistakes, lessons) | service role; 1-year TTL | `/api/coach/analyze` |
| `welcome_pack_claims` | Welcome Pack 1-per-wallet ledger | service role | `/api/welcome-pack/claim` |

### 1.2 Redis (Upstash) — fuentes de runtime stats no persistidas

| Key shape | Contenido | Persistencia |
|---|---|---|
| `chesscito:game:<wallet>:<gameId>` | GameRecord blob | 90-day TTL |
| `chesscito:gameList:<wallet>` | Lista de gameIds por wallet | sin TTL (capped a 200) |
| `founder:<wallet>` | FounderStatus cache | 24h TTL |
| Coach credits keys | Saldo de Coach credits PRO/free | sin TTL |

### 1.3 APIs públicas existentes (que ya leen estos datos)

- `GET /api/leaderboard` — leaderboard top scores (público).
- `GET /api/hall-of-fame` — 10 últimos mints (público).
- `GET /api/my-victories?wallet=...` — wallet-scoped.
- `GET /api/profile/stats?address=...` — wallet-scoped aggregate.
- `GET /api/pro/status?wallet=...` — wallet-scoped.
- `GET /api/founder-status?wallet=...` — wallet-scoped (mitigado).
- `GET /api/welcome-pack/status?wallet=...` — wallet-scoped.
- `GET /api/coach/history?wallet=...` — wallet-scoped.

### 1.4 Telemetría M1 — 16 eventos `monetization.*` activos

Doc canónico: `docs/monetization/telemetry-events-m1.md`. Eventos relevantes para `/stats`:

- `monetization.save_victory_success` — funnel SUCCESS por victoria minteada (mount-once).
- `monetization.coach_paywall_convert {tier}` — conversiones de Coach paywall.
- `monetization.pro_renew_tap`, `pro_chip_tap` — engagement con PRO.
- `monetization.shop_item_view {tier}` — exposición Shop.

Sink actual: `@/lib/telemetry` `track()` — **escribe a `analytics_events` cuando session_id presente**. Confirmado vía `apps/web/src/app/api/telemetry/route.ts:58`.

---

## 2. Match contra requirements MiniPay §8 Analytics

| Métrica MiniPay | Disponible | Fuente directa | Calidad |
|---|---|---|---|
| **DAU** | ⚠️ Proxy | `analytics_events`: `count(distinct session_id) where created_at >= now() - 1d` | Sesión ≠ usuario único; un usuario en 2 devices = 2 DAU. Limitación documentable. |
| **MAU** | ⚠️ Proxy | mismo, 30d window | mismo caveat |
| **Retention D1/D7/D30** | ❌ | — | `analytics_events.session_id` no persiste cross-session (cliente regenera al limpiar storage). NO calculable sin re-arquitectura. |
| **tx/day, /week, /month** | ⚠️ Parcial | `victories.minted_at` count by bucket | Solo cuenta mints de Victory NFT, NO otras tx (shop purchases, PRO, Welcome Pack signatures). Undercount real. |
| **Total tx (lifetime)** | ⚠️ Parcial | `count(victories)` + `count(welcome_pack_claims)` | Más completo si combinás 2 ledgers. Falta Shop purchases. |
| **Unique on-chain users** | ⚠️ Parcial | `count(distinct player) from victories` | Solo wallets que minteron. Wallets que solo jugaron sin mint quedan fuera. |
| **Volume per stablecoin** | ❌ | — | Sin off-chain ledger de purchase amounts. On-chain only. |
| **Network fees paid** | ❌ | — | On-chain only. |
| **Protocol revenue per stablecoin** | ❌ | — | On-chain only. |
| **Failed-tx rate** | ❌ | — | Sin tabla de tx state; failures no se persisten. |

### Métricas adicionales que SÍ podemos surfacear (no en requirements MiniPay pero útiles)

| Métrica | Fuente | Notas |
|---|---|---|
| Welcome Packs reclamados | `count(welcome_pack_claims)` | Onboarding signal |
| Victorias por dificultad (easy/medium/hard) | `victories group by difficulty` | Game balance signal |
| Coach analyses generadas | `count(coach_analyses)` | PRO engagement (privacy: aggregate only, no row-level) |
| Top monetization event last 7d | `analytics_events where event like 'monetization.%' group by event order by count desc` | Funnel summary |
| Hall of fame snapshot | `victories order by minted_at desc limit 10` | Ya existe en `/api/hall-of-fame`; pull público a /stats |
| Leaderboard top 10 | `leaderboard_v limit 10` | Ya existe |

---

## 3. Qué se puede entregar AHORA (MVP scope)

### 3.1 Métricas headline (publicables, defensibles)

1. **Total Victories minted** (lifetime) — `victories` count.
2. **Victories last 7 / 30 days** — `victories where minted_at >= now() - Nd`.
3. **Unique wallets that minted** (lifetime) — `count distinct player from victories`.
4. **Victories by difficulty** — easy / medium / hard breakdown.
5. **Welcome Packs claimed** (lifetime + last 7d).
6. **Approx. active sessions last 7d** — `count distinct session_id from analytics_events`. **Labelar "approx."** + caveat session ≠ user.
7. **Approx. active sessions last 30d** — idem 30d.
8. **Coach analyses generated** (lifetime + last 7d) — aggregate count only.

### 3.2 Secciones complementarias (reusan endpoints existentes)

9. **Top 10 leaderboard** — reuse `/api/leaderboard`.
10. **Hall of Fame (10 últimos mints)** — reuse `/api/hall-of-fame`.

### 3.3 Coming soon (transparent placeholders)

- Retention D1/D7/D30 — "On-chain rebuild needed"
- Volume per stablecoin — "Requires indexer / Dune sink (future)"
- Network fees paid — same
- Protocol revenue per stablecoin — same
- Failed-tx rate — "Requires tx-state ledger (future)"

Estos NO mienten ni inflan números; declaran honestamente la deuda.

---

## 4. Qué queda fuera del MVP

- **Cualquier write nuevo**: el MVP es read-only sobre datos existentes. NO instrumenta nueva telemetría, NO toca purchase flows, NO modifica schema.
- **Dune / Blockscout / indexer / subgraph**: vetado por directiva user.
- **founder-status / Labyrinth / ODIS / wagmi**: vetados.
- **Retention real D1/D7/D30**: requiere wallet-identity continuity en `analytics_events`, cluster propio.
- **Failed-tx rate**: requiere persistir tx state, cluster propio.
- **Real-time o websocket**: MVP es snapshot cacheado (Next.js `revalidate`), no live.
- **Auth/admin views**: ningún panel privado; solo lo que sea publicable.
- **Per-wallet lookup** desde `/stats`: ya existe en `/api/profile/stats`; no duplicar.

---

## 5. Privacidad / publicabilidad

| Dato | Publicable? | Por qué |
|---|---|---|
| `victories.player` (wallet) en agregado | ✅ count distinct OK | On-chain ya es público |
| `victories.player` row-level (lista de wallets) | ❌ NO listar | Aunque on-chain, exponerlo desde nuestra UI es enumeración facilitada |
| Hall of Fame con wallet truncada (`0x1234…abcd`) | ✅ | Patrón actual ya en uso |
| Leaderboard con wallet truncada | ✅ | Idem |
| `analytics_events.session_id` | ❌ NO exponer rows | Opaco pero exponerlo facilita rastreo; solo agregados |
| `analytics_events.props` | ❌ | Puede contener contexts |
| `welcome_pack_claims.signature` / `message` | ❌ | Signature PII-adjacent |
| `coach_analyses.summary_text` | ❌ NEVER | Contenido de partidas; RLS-protected por diseño |
| `coach_analyses` count agregado | ✅ | Solo número total |
| `passport_cache.is_verified` agregado | ✅ count | Identity signal; row-level no |

**Regla:** todo lo que se publique es **agregado numérico** o **datos ya públicos on-chain**. Cero lookup por wallet desde `/stats`.

---

## 6. Arquitectura propuesta

### 6.1 Opciones evaluadas

| Opción | Pros | Cons | Veredicto |
|---|---|---|---|
| **A. Server Component page + queries directas** | 0 nueva API route; Next.js cache `revalidate` automático; SEO; minimal surface | Locale duplication (`/en/stats` + `/es/stats`); cada query lee Supabase en build/revalidate | ✅ Recomendada para MVP |
| B. Nueva `/api/stats/public` + client fetch | API testeable en aislamiento; consumible por dashboards futuros | Hop extra; sin SEO; más superficie | ❌ Overkill para MVP |
| C. Server Component + Redis cache layer + materialized view | Performance máximo | Complejidad: refresh cron, view DDL, observability nueva | ❌ Premature optimization |

### 6.2 Arquitectura Opción A — detalle

```
apps/web/src/app/[locale]/stats/page.tsx        ← Server Component, default revalidate 3600s
apps/web/src/lib/stats/public-aggregator.ts     ← getPublicStats(): Promise<PublicStats>
apps/web/src/lib/stats/public-aggregator.test.ts ← Vitest unit, mocked supabase
apps/web/src/components/stats/stats-page.tsx    ← View layer (presentational)
apps/web/src/components/stats/stat-card.tsx     ← Tarjeta reutilizable (number + label + sublabel)
```

**Reuso de componentes existentes:**

- **Layout estático**: mirar `apps/web/src/app/[locale]/about/page.tsx`, `/privacy`, `/terms`, `/support` — patrón shared. Probable `<StaticPageShell>` o similar — reusar.
- **Stat card visual**: existe `account-vitrine-hero` pattern (cream-amber panel) per memory `vitrine-hero-band`. Reusar tokens: `.candy-tray-pill`, `.hub-hud-pill`, o el panel-frame del Account vitrine.
- **Number formatting**: probable existe helper en `apps/web/src/lib/format/` — verificar antes de duplicar.
- **Truncated wallet**: helper ya existe en `display-name.ts` o `format-address.ts` — verificar.

### 6.3 Cache strategy

- Page-level: Next.js Server Component default `revalidate = 3600` (1h).
- Sin Redis intermedio. Si Supabase tira lento, agregamos cache layer en commit aparte.
- Cada query envuelta en try/catch con default `0` o `null` — un query roto no rompe la página.

### 6.4 Link surfaces

- **Landing footer** (`landing-page.tsx:922-946`) — agregar 5° link `/stats` junto a privacy/terms/support/about.
- **Layout footer global** (si existe) — verificar; sino el landing es suficiente para MVP.
- **About page** — opcional, agregar línea con link a `/stats`.
- **Sitemap.ts** — agregar `/stats` (verificar formato actual).
- **Submission docs** (`docs/submission/...`) — referenciar `/stats` como pública endpoint.

### 6.5 Acceso público vs semi-público

**Público sin auth.** Razones:
1. MiniPay submission §8 exige acceso público al dashboard analytics.
2. Los datos son agregados sobre eventos ya públicos (mints on-chain) + telemetría anónima.
3. Una página gated por wallet es fricción innecesaria para reviewers de Celo/MiniPay.

Sin rate limit propio en el MVP (Next.js cache absorbe el load). Si vemos abuse, agregamos `enforceReadRateLimit` en commit aparte.

---

## 7. Patch plan por commits (estimado ~half-day)

| # | Commit | Scope | Tests |
|---|---|---|---|
| 1 | `feat(stats): add public stats aggregator` | `lib/stats/public-aggregator.ts` con `getPublicStats()` — agrupa todas las queries Supabase + caveats. Cada query en try/catch. | Vitest unit: 6-8 cases (happy path, missing supabase client, error per query, aggregate shape) |
| 2 | `feat(stats): add /stats public page route` | `app/[locale]/stats/page.tsx` Server Component + `components/stats/stats-page.tsx` + `stat-card.tsx`. Reusa `<StaticPageShell>`. `revalidate = 3600`. | RTL: 3-4 cases (renders defaults, renders with mock data, error fallback "—") |
| 3 | `feat(stats): link /stats from landing footer + sitemap` | Edit `landing-page.tsx` footer + `sitemap.ts` + `/about` line. | Snapshot footer + sitemap entry |
| 4 | `docs(stats): document /stats data sources + limitations` | `docs/product/stats-mvp-2026-06-XX.md` — sources, caveats, "coming soon" rationale, refresh rate, privacy posture. | — (docs only) |
| 5 | `docs(submission): reference /stats in MiniPay packet` | Update relevant submission doc to point at `https://www.chesscito.com/stats`. | — (docs only) |
| 6 (opcional) | `test(stats): VR baseline 390px mobile` | Playwright snapshot `/stats` mobile. | 1 visual baseline |

**Promote**: bundle todos a `production` al cierre del cluster.

**Rollback**: borrar route + footer link en 1 revert si surface algo problemático.

---

## 8. Riesgos de privacidad o precisión

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | DAU/MAU vía session_id sub-cuenta (no atribuye cross-device); mejor caso es proxy | Media | Labelar "approx." en UI + tooltip + caveat en docs |
| R2 | analytics_events 90-day TTL → cumulative counts sobre eventos antiguos no es posible | Media | Solo exponer "last Nd" para event-based; los counts cumulative van sobre `victories` (sin TTL) y `welcome_pack_claims` (sin TTL) |
| R3 | `victories` solo registra mints, no juegos jugados → undercount de actividad real | Media | Documentar como "mints" no "juegos"; complementar con session counts del telemetry |
| R4 | Si un query crashea, página entera 500 | Media | Try/catch por query, default a `—` en UI |
| R5 | Materialized view `leaderboard_v` refresh schedule no documentado → puede mostrar data stale | Baja | Verificar cron `cron/sync` antes de exponer; documentar refresh rate |
| R6 | Un crawler agresivo hace burst sobre `/stats` y satura Supabase free tier | Baja | Next.js `revalidate = 3600` absorbe; sin rate-limit en MVP, agregar si vemos abuse |
| R7 | "Coming soon" metrics decepcionan al reviewer MiniPay | Baja-Media | Texto honesto explicando deuda + commitment timeline (no fechas exactas, solo "Q3 with indexer") |
| R8 | Wallet enumeration accidental si Hall of Fame muestra full addresses | Baja | Solo truncar `0x1234…abcd`, ya patrón en uso |
| R9 | Exposure de stat que revele user con baja actividad (e.g. "1 victory minted today") con timestamp puede facilitar correlación a wallet | Muy baja | Bucketizar a "hoy" / "esta semana" sin timestamps puntuales |
| R10 | Anti-PRO signal si "Coach analyses" muestra número bajo (PR contraproducente) | Baja | Decisión producto: mostrar o no. Mi recomendación: SÍ — transparencia > PR; un número bajo invita a probar |

---

## 9. Cuándo abrir el cluster real

**Triggers para empezar implementación (no antes):**

- User aprueba el patch plan + ordering.
- Confirmamos que `/about`, `/terms`, `/privacy`, `/support` comparten layout (1 file read).
- Confirmamos formato de `sitemap.ts` (1 file read).

**Stand-by hasta que digas "implementemos" o "ajustá el plan en X".**

---

## 10. Resumen ejecutivo

- **Datos suficientes para MVP defendible**: 6-8 métricas reales + 2 reuses (leaderboard / hall of fame) + 5 "coming soon" honestos.
- **Arquitectura**: Server Component con queries directas Supabase + Next.js revalidate 1h. 0 nuevas API routes.
- **Privacidad**: solo agregados; cero lookup por wallet; solo datos ya on-chain.
- **MiniPay match**: ~3-5 de 9 métricas requeridas directas; el resto = transparent placeholders.
- **Patch plan**: 4-6 commits, ~half-day total.
- **Trabajo NO incluido**: indexer, Dune, retention real, failed-tx rate, founder-status, Labyrinth, ODIS, performance profunda, wagmi/RainbowKit — todos respetados.

Decisión: aprobar / ajustar / rechazar el patch plan §7.
