# Auditoría de Observabilidad de Producto — Pre-lanzamiento MiniPay

**Fecha:** 2026-07-23 · **Fase:** 1 (auditoría, sin implementación) · **Autor:** Wolfcito 🐾 @akawolfcito

> Alcance: auditar `/stats` (Learn + Play), toda la instrumentación existente, contrastar
> con MiniPay/Celo oficial (Celopedia), y proponer un slice mínimo. **No se toca producción.**
> No se implementa nada en esta fase.

---

## 0. TL;DR

- **Modelo actual:** un único stream de eventos **client-only** (`track()` → `POST /api/telemetry`
  fire-and-forget → tabla `analytics_events(session_id, event, props)`). ~120 nombres de evento
  sin convención. **Cero dimensiones** (`surface`, `container`, `source`, `app_version`, `locale`,
  `country`). Sin retención/cohortes. Sin país. Sin confirmación server-side de pagos/rewards.
- **`/stats` es UNA sola ruta** (`app/[locale]/stats/page.tsx`) leyendo la MISMA Supabase. Learn y
  Play "se ven casi iguales" porque **son el mismo código**; el único diferenciador es el env
  `CHESSCITO_MODE` (learn|play) del deployment, que **no viaja a los datos**. No hay dos sistemas
  que unificar: hay uno solo al que le falta la dimensión `surface`.
- **Bloqueante para listing MiniPay:** el checklist oficial (§8) exige stats con **DAU/MAU,
  retención D1/D7/D30, top countries, tx por stablecoin, network fees, failed-tx rate**. Hoy
  faltan retención, país, y varias métricas on-chain están parciales.
- **El slice que propone el founder es correcto y suficiente.** No hace falta Mixpanel casero.

---

## 1. Inventario actual

### 1.1 Pipeline de telemetría (una sola vía)

| Capa | Archivo | Qué hace |
|------|---------|----------|
| Emisor client | `apps/web/src/lib/telemetry.ts` | `track(event, props)`. SSR-safe. `session_id` de `localStorage` (`chesscito:analytics-session`, 64-bit hex). Throttle 100 ev / 5min / nombre. `fetch` con `keepalive`. Silencioso ante error. Desactivado en dev salvo `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY=1`. |
| Endpoint server | `apps/web/src/app/api/telemetry/route.ts` | `POST`. Valida `session_id`≤64, `event`≤64, `props`≤4KB, aplana props a 2 niveles y coacciona a primitivos. **Siempre responde 204**, inserta con service role. Sin auth, sin rate-limit server, sin dedupe. |
| Persistencia | `supabase/migrations/20260424000000_analytics_events.sql` | `analytics_events(id, created_at, session_id, event, props jsonb)`. Índices por `created_at`, `(session_id,created_at)`, `(event,created_at)`. RLS default-deny; solo service role escribe. |
| Retención | `20260424010000_analytics_cleanup.sql` + `..._schedule_analytics_cron.sql` | `prune_analytics_events()` borra >90 días. Cron mensual. **⚠️ ventana de 90 días = techo para cohortes.** |
| Lectura `/stats` | `apps/web/src/lib/stats/public-aggregator.ts` (+ `onchain.ts`) | 14 queries en `Promise.allSettled` sobre `victories`, `welcome_pack_claims`, `analytics_events`, `coach_analyses`, `leaderboard_v`. Cada fallo → `null` (em-dash). `revalidate=3600`. |
| Vista | `apps/web/src/components/stats/stats-page.tsx` | Render server-cached; nombres via Identity Lite (sin wallet). |

### 1.2 `/stats` Learn vs Play — diferencias reales

**Ninguna a nivel de datos.** Misma ruta, mismo aggregator, misma Supabase, mismo payload.
La única bifurcación de producto vive en `apps/web/src/lib/feature-flags.ts`
(`CHESSCITO_MODE` = learn|play|full; `CHESSCITO_LITE_MODE = mode==="learn"`), que cambia UI/gating
pero **no** etiqueta los eventos. Por eso no se puede hoy responder "¿esto pasó en Learn o en Play?"
salvo por el dominio del deployment — que no queda registrado.

### 1.3 Detección de contenedor (MiniPay vs browser)

`apps/web/src/lib/minipay.ts` → `isMiniPayEnv()` = `window.ethereum?.isMiniPay === true`
(coincide con el patrón oficial de Celopedia, ver §5). **Existe pero NUNCA se adjunta a un evento.**
El container es hoy invisible en analytics.

### 1.4 Catálogo de eventos actuales (resumen; ~120 nombres)

Todos son `track()` client-side. Familias:

| Familia | Ejemplos | Nº aprox |
|---------|----------|----------|
| Arena (Play juego) | `arena_mount`, `arena_game_start`, `arena_game_end`, `arena_*_tap` | 15 |
| Hub Learn | `hub_view`, `hub_start_focus_tap`, `hub_*_chip_tap`, `hub_tour_*` | 16 |
| Hub Play | `play_hub_view`, `play_hub_arena_tap`, `play_hub_*_tap` | 8 |
| Ejercicios/Training | `exercise_complete`, `exercise_fail`, `training_exercise_started/completed`, `training_stars_earned`, `labyrinth_complete` | 12 |
| Daily / Tactics | `daily_tactic_started/completed`, `daily_streak_updated`, `play_tactics_opened/completed/failed` | 6 |
| Coach | `coach_analyze_request`, `coach_analyze_failed`, `coach_viewer_*` | 20 |
| PRO / Monetización | `pro_card_viewed`, `pro_cta_clicked`, `pro_purchase_started/confirmed/failed`, `pro_verify_retry_failed` | 12 |
| Peones (economía) | `peones_earned`, `peones_spent`, `peones_spend_failed/blocked/bypassed`, `peones_cap_reached` | 8 |
| Pagos/tx | `shop_buy_tx`, `badge_claim_tx`, `score_submit_tx`, `victory_claim_tx`, `tx_progress_*` | 10 |
| Gift/Welcome | `claim_gift_tap/signing/success/failed/rejected`, `claim_attempted` | 6 |
| Challenge / deep link | `challenge_link_opened`, `challenge_started`, `challenge_completed`, `challenge_shared`, `challenge_continue_to_lite` | 5 |
| Share | `share_tile_tap` | 1 |
| Infra/UX | `modal_open`, `dock_tap`, `splash_view`, `error_boundary_shown`, `landing_redirect`, `lite_session_started` | ~8 |

Catálogo evento-por-evento con emisor/payload/persistencia/consumidor/confiabilidad:
**pendiente de expandir en la Fase 2** (aquí se prioriza el diagnóstico). Regla observada:
`props` es libre y no tipado; ningún consumidor los valida salvo `challenge_*` (lee `props.isLite`).

### 1.5 Fuentes server-authoritative que YA existen (fuera de `analytics_events`)

La verdad de pagos/rewards **sí** vive en tablas de dominio escritas por API/RPC, solo que no
está unificada con el stream de eventos:

- `victories` (mints on-chain confirmados) · `welcome_pack_claims` · `coach_analyses`
- Ledger de Peones (`20260607…peones_ledger_init`, `…peones_v1_economy`)
- `20260701140000_pro_treasury_payment.sql` (pago PRO a treasury)
- `20260625120000_lite_season_passes.sql` (Season Pass)

→ Los eventos `pro_purchase_confirmed`, `shop_buy_tx`, `peones_earned/spent` **duplican en
client** algo que el servidor ya sabe con certeza. La conciliación es posible sin inventar tablas.

---

## 2. Matriz de gaps priorizada

### 🔴 Bloqueante para MiniPay (listing §8 + preguntas del founder)

| # | Gap | Evidencia | Impacto |
|---|-----|-----------|---------|
| B1 | **Sin dimensión `surface`** (learn/play) en los eventos | `analytics_events` no la tiene; `/stats` es una ruta única | No se responde "¿Learn o Play?" |
| B2 | **Sin `container`** (minipay/browser) | `isMiniPayEnv()` existe pero no se emite | No se responde "¿vienen de MiniPay?" |
| B3 | **Sin retención D1/D7/D30 ni cohortes** | No hay `first_seen`; poda a 90 días | §8 exige retención — requisito de listing |
| B4 | **Sin país** | No se captura geo; MiniPay no lo entrega | §8 pide "top countries" (targeting por país) |
| B5 | **Sin `app_opened` / page_view explícito** | `activeSessions` se deriva de distinct `session_id`; no hay evento raíz | El funnel de activación no tiene tope de embudo fiable |
| B6 | **Pagos/rewards solo client-confirmed** | `pro_purchase_confirmed` etc. son `track()` | Pérdida/spoof; §8 pide tx por stablecoin + revenue |

### 🟠 Alto valor

| # | Gap |
|---|-----|
| A1 | **Naming inconsistente** — `exercise_complete` vs `training_exercise_completed` vs `daily_tactic_completed` vs `play_tactics_completed` miden lo mismo con nombres distintos → funnels imposibles de agregar |
| A2 | **Duplicados hub** — `hub_view`/`play_hub_view` y `hub_*_tap`/`play_hub_*_tap` (la dimensión `surface` los colapsa) |
| A3 | **Sin `source`/`campaign`** — no hay atribución de origen (referrer/utm/deep-link) más allá de `challenge_*` |
| A4 | **Sin `app_version`** — imposible correlacionar una regresión con un deploy |
| A5 | **`props` no tipado ni versionado** — cualquier typo entra silencioso |

### 🟢 Nice-to-have

| # | Gap |
|---|-----|
| N1 | Rollup de agregados antes de la poda de 90 días (hoy "not implemented yet" en el SQL) |
| N2 | Rate-limit server-side en `/api/telemetry` (hoy solo throttle client, evadible) |
| N3 | `locale` explícito en eventos (derivable del path pero no guardado) |
| N4 | Métricas on-chain §8 completas: network fees pagados, failed-tx rate, volumen por stablecoin |

---

## 3. Marco canónico propuesto (validado)

**Sí basta un único modelo con dimensiones.** No dupliquemos dashboards. Extender el payload,
no el pipeline:

```
event: string                      // nombre canónico normalizado
session_id: string                 // ya existe (localStorage, opaco)
dims:
  surface:    "learn" | "play"     // de CHESSCITO_MODE (build-time)
  container:  "minipay" | "browser"// de isMiniPayEnv() (runtime)
  locale:     string               // del path [locale]
  country:    string               // edge geo (Vercel header), NO de MiniPay
  source:     string               // referrer/utm/deep-link, normalizado
  campaign:   string | null
  app_version:string               // del build (NEXT_PUBLIC_APP_VERSION / commit)
props: jsonb                       // específicos del evento (tipados en TS)
```

Decisión de esquema (a validar en Fase 2): añadir estas dims como **columnas** en
`analytics_events` (indexables, baratas de filtrar) en vez de enterrarlas en `props`. Migración
aditiva, backward-compatible (columnas nullable). `surface` NO puede ir solo en env: hay que
estamparlo en cada evento.

> **country:** capturar server-side en `/api/telemetry` desde el header de geo del edge
> (p.ej. `x-vercel-ip-country`), **nunca** IP completa (ver §7). MiniPay no entrega país.

---

## 4. Funnels y métricas derivadas

### Activación
`app_opened` → `hub_viewed` → `exercise_started` → `exercise_completed` → `daily_focus_completed`
- Faltan hoy: `app_opened` (B5), y unificar `exercise_started/completed` (A1).
- `hub_viewed` = colapsar `hub_view`/`play_hub_view` con `surface`.

### Monetización
`offer_viewed` → `purchase_started` → `purchase_succeeded | purchase_failed` → `paid_feature_used`
- Mapeo actual: `pro_card_viewed`→`pro_purchase_started`→`pro_purchase_confirmed`/`_failed`.
- Falta `paid_feature_used` y **confirmación server-side** de `purchase_succeeded` (B6): la fuente
  de verdad debe ser `pro_treasury_payment` / `victories` / ledger, no el evento client.

### Retención
D1 / D3 / D7 / D21, cohortes por primera visita, y por `source` / `surface` / `container`.
- Necesita `first_seen` por `session_id` (B3) y que la poda de 90 días no borre la fila de cohorte
  (rollup N1 o tabla `session_first_seen` liviana).

Todos los funnels se resuelven **con filtros sobre un solo modelo** — no requieren dashboards
separados Learn/Play.

---

## 5. Contraste con MiniPay / Celo oficial (Celopedia)

| Tema | Oficial (Celopedia) | Estado en Chesscito |
|------|---------------------|---------------------|
| Detección MiniPay | `window.ethereum.isMiniPay === true` (`minipay-guide.md` §Detection) | ✅ `isMiniPayEnv()` idéntico — pero no se emite (B2) |
| **MiniPay entrega analytics** | **No.** Debes montar tu propia stats page (Plausible/PostHog/Umami/GA4). Distingue: MiniPay NO da métricas | ✅ Confirmado: tenemos pipeline propio. No asumir analytics de MiniPay |
| Requisito de listing §8 | Stats públicas: DAU, MAU, **retención D1/D7/D30**, **top countries**, tx/stablecoin, network fees, protocol revenue, **failed-tx rate**, tx counts/día/semana/vida | ⚠️ Parcial: hay sesiones/mints/coach; faltan retención, país, fees, failed-tx |
| País | MiniPay **no** expone país; su disponibilidad ES por país → métrica útil. Capturar via edge geo | ❌ No se captura (B4) |
| Deep links | `add_cash` (`minipay.opera.com/add_cash`); lista canónica en docs.minipay.xyz | ✅ Ya usado (`minipay_add_cash_click`); atribución de deep-link de entrada no medida (A3) |
| Signing / tx | No `personal_sign`, legacy tx, fee en USDm | (fuera de scope analytics) |
| Privacidad | ToS + Privacy Policy in-app obligatorio para listing | Verificar `/privacy` y `/terms` existen (rutas presentes) |
| Copy MiniPay | "Deposit" no "Add Cash"/"Onramp"; nunca CELO en UI | Revisar labels en Fase 2 (no es analytics pero es gate de listing) |

**Conclusión de contraste:** la arquitectura actual (Supabase propio, sin SaaS) es compatible con
lo que MiniPay pide. El gap es de **cobertura de métricas**, no de plataforma.

---

## 6. Propuesta mínima para `/stats`

Mantener una sola ruta; añadir **filtros** en vez de una segunda página:

- Filtro `surface` (Learn | Play | Ambos) — resuelve la necesidad sin duplicar dashboard.
- Filtro `container` (MiniPay | Browser | Ambos).
- Bloque **Activación** (funnel §4) y **Monetización** (funnel §4) con conteos absolutos
  (sin rates a bajo volumen, como ya hace `ChallengeFunnel`).
- Bloque **Retención** D1/D7 (arrancar con D1/D7; D3/D21 después).
- Completar bloque on-chain §8 (failed-tx rate, fees) — reusa `onchain.ts`.
- Etiqueta "as of" ya existe (`generatedAt`). Mantener `revalidate=3600`.

---

## 7. Red-team (privacidad · pérdida · duplicados · idempotencia)

**Privacidad**
- ✅ Bien hoy: sin wallet/PII en `analytics_events`; `session_id` opaco; wallet se hashea a
  Identity Lite server-side y se descarta.
- ⚠️ Al añadir `country`: guardar **solo código de país** (`x-vercel-ip-country`), **nunca IP
  completa, teléfono, email**. No derivar ciudad. Confirmar en Privacy Policy antes de shippear.
- ⚠️ `source`/`campaign`: normalizar allow-list; no volcar el referrer crudo (puede traer query
  params sensibles).
- ✅ Wallet: si alguna vez se necesita en analytics, usar **hash estable** (patrón `deriveRowId`
  ya existe), nunca texto plano.

**Pérdida de eventos**
- ⚠️ Client-only + `keepalive`: una recarga, red caída, o cierre del WebView de MiniPay pierde el
  evento sin rastro (204 siempre, sin ACK). Aceptable para UX/engagement; **inaceptable para
  pagos/rewards** → B6 (confirmar desde tablas de dominio).
- ⚠️ Throttle 100/5min/nombre es client-side: se resetea en cada navegación → subcuenta posible en
  navegación intensa; y es evadible (N2).

**Duplicados**
- ⚠️ StrictMode/doble-efecto puede emitir 2× el mismo evento (mitigado en dev por gate, no en prod).
- ⚠️ `exercise_complete` vs `training_exercise_completed` vs `daily_tactic_completed` vs
  `play_tactics_completed`: **cuádruple contabilidad** del mismo hecho conceptual (A1).
- ✅ La dimensión `surface` elimina los duplicados hub/play_hub por diseño.

**Idempotencia**
- ❌ `analytics_events` no tiene clave de idempotencia; un retry de red inserta fila nueva.
  Para eventos de pago confirmados server-side, usar la **tx_hash / intent_id** como clave única
  (ya existen en las tablas de dominio) en lugar de contar eventos.

---

## 8. Plan de implementación por commits pequeños (Fase 2 — NO ejecutar aún)

1. `feat(analytics): add surface + container dims to track()` — estampar `CHESSCITO_MODE` y
   `isMiniPayEnv()` en cada evento (client). Migración aditiva de columnas nullable.
2. `feat(analytics): capture country + app_version server-side` — leer geo header en
   `/api/telemetry`; inyectar `NEXT_PUBLIC_APP_VERSION`. (Privacidad: solo país.)
3. `refactor(analytics): normalize event names` — mapa canónico + shim de compatibilidad; colapsar
   los 4 `*_completed` y hub/play_hub. Tests que fijan el catálogo.
4. `feat(analytics): app_opened + session first_seen` — evento raíz + tabla/columna `first_seen`
   para cohortes (sobrevive a la poda de 90d).
5. `feat(analytics): server-confirm payments/rewards` — reconciliar `purchase_succeeded` y
   `peones_earned/spent` contra `pro_treasury_payment` / `victories` / ledger (idempotente por
   tx_hash/intent_id).
6. `feat(stats): surface + container filters` — un dashboard, filtros.
7. `feat(stats): activation + monetization funnels` — conteos absolutos.
8. `feat(stats): retention D1/D7` — cohortes por first_seen.
9. `feat(stats): complete on-chain §8 block` — failed-tx rate, fees, volumen/stablecoin.

Cada uno con TDD (SDD→TDD→EDD), suite verde reportada en el commit, atómico.

---

## 9. Preguntas abiertas para el founder

1. ¿`country` a nivel código de país es aceptable para la Privacy Policy actual, o hay que
   actualizarla antes?
2. ¿`source`/`campaign` entran en el MVP, o basta `surface`+`container`+`app_version` para el
   listing y dejamos atribución para después?
3. Retención: ¿arrancamos D1/D7 y sumamos D3/D21 luego, o el listing exige D30 desde día 1?
4. ¿Confirmación server-side de pagos como reconciliación batch (cron) o inline en cada tx?
```
