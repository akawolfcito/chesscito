# Spec — Observabilidad Lote 1 (dimensiones + app_opened + retención D1/D7 + /stats)

**Fecha:** 2026-07-23 · **Base:** `docs/audits/2026-07-23-product-observability-audit.md` (aprobado)
**Regla dura:** analytics NUNCA hace fallar el negocio. Migración **aditiva y backward-compatible**.
**Stop:** no aplicar migraciones a producción en esta fase.

---

## 1. Semántica de sesión (resuelta por diagnóstico)

| Concepto | Fuente | Vida | Uso |
|----------|--------|------|-----|
| `session_id` (**= anonymous_id**) | `localStorage` `chesscito:analytics-session` (ya existe) | Persistente, nunca rota | Retención/cohortes (D1/D7/D30), unique users |
| `visit_id` (**nuevo**) | `sessionStorage` `chesscito:visit-id` | Por pestaña/visita | `app_opened` once-per-visit, funnels por visita |

**No se renombra `session_id`** (evita migración grande). Se documenta que su semántica es
anonymous_id y se **añade** `visit_id` como columna nullable.

---

## 2. Contrato de datos (SDD — tipos primero)

### 2.1 Migración aditiva `20260723xxxxxx_analytics_dimensions.sql`
Columnas nullable en `analytics_events` (todas backward-compatible; filas viejas quedan `null`):

```
surface      text        -- 'learn' | 'play'  (CHECK opcional, ver red-team cardinalidad)
container    text        -- 'minipay' | 'browser'
locale       text        -- 'en' | 'es' | ...  (del path)
country      text        -- ISO-3166-1 alpha-2, MAYÚS, 2 chars, o null
source       text        -- allow-list canónica (ver 2.3)
campaign     text        -- sanitizado, allow-list de params, o null
app_version  text        -- NEXT_PUBLIC_BUILD_SHA (7 chars) o 'dev'
visit_id     text        -- id de visita (sessionStorage), o null
```
Índices nuevos (solo los que el MVP consulta): `(surface, created_at desc)`,
`(container, created_at desc)`, `(country, created_at desc)`, `(event, created_at desc)` ya existe.

### 2.2 Tabla de cohortes `session_first_seen` (sobrevive a la poda de 90 días)
```
session_first_seen (
  session_id   text primary key,
  first_seen   timestamptz not null default now(),   -- día 0 de la cohorte
  first_surface   text,        -- surface de la primera visita
  first_container text,
  first_country   text,
  first_source    text
)
```
Diseñada para D1/D7/**D30** sin otra migración (la fila NO se poda). Upsert idempotente:
`insert ... on conflict (session_id) do nothing` → solo la primera visita fija la cohorte.

### 2.3 Allow-lists (server-side, en `/api/telemetry`)
- `surface`: `{learn, play}` — otro valor → `null`.
- `container`: `{minipay, browser}`.
- `country`: regex `^[A-Z]{2}$` — cualquier otra cosa → `null`.
- `source` canónica (pequeña): `{direct, minipay_discovery, challenge_link, share_whatsapp,
  share_generic, qr, unknown}`. Fuera de lista → `unknown`.
- `campaign`: solo si `source` la permite; `[a-z0-9_-]{1,32}` sanitizado; si no → `null`.
- `app_version`: `[a-z0-9]{1,12}`.

### 2.4 Payload cliente extendido (`track()`)
`track(event, props)` agrega automáticamente `session_id`, `visit_id`, `surface`, `container`,
`locale`, `app_version`, `source`, `campaign`. `country` se resuelve **server-side** (nunca cliente).

---

## 3. Enriquecimiento (de dónde sale cada dimensión)

| Dim | Origen | Capa |
|-----|--------|------|
| `surface` | `CHESSCITO_MODE` (`lib/feature-flags.ts`) → learn/play | build/client |
| `container` | `isMiniPayEnv()` (`lib/minipay.ts`) | client (runtime) |
| `locale` | primer segmento del path (`useParams`/`usePathname`) | client |
| `app_version` | `NEXT_PUBLIC_BUILD_SHA` | build/client |
| `source`/`campaign` | URL params en el **primer** load → persistidos en `localStorage` (allow-list) | client |
| `country` | header `x-vercel-ip-country` en `/api/telemetry` | **server** |
| `visit_id` | `sessionStorage` (crea si falta) | client |

---

## 4. Evento raíz `app_opened`

- Se emite **exactamente una vez por visita**: guard en `sessionStorage`
  (`chesscito:app-opened-fired`). Si ya está, no re-emite (cubre navegación, StrictMode, remount).
- **No depende de wallet** ni de conexión.
- Punto de montaje: componente cliente en `layout.tsx` (persiste; NO en `template.tsx`).
- En el mismo tick, upsert de `session_first_seen` (vía `/api/telemetry` o endpoint dedicado).

---

## 5. Normalización mínima (con shim backward-compatible)

Solo 4 canónicos. **No se tocan los ~120.** Shim: los alias siguen emitiéndose Y se emite el
canónico (o el canónico reemplaza y se mantiene el alias como no-op documentado — decisión en impl).

| Canónico | Alias existentes que lo alimentan |
|----------|-----------------------------------|
| `hub_viewed` | `hub_view`, `play_hub_view` |
| `exercise_started` | `exercise` starts, `training_exercise_started`, `daily_tactic_started`, `play_tactics_opened` |
| `exercise_completed` | `exercise_complete`, `training_exercise_completed`, `play_tactics_completed` |
| `daily_focus_completed` | `daily_tactic_completed` (Daily Focus) |

Mapa canónico en `lib/analytics/canonical-events.ts` (nuevo), testeado.

---

## 6. `/stats` (una sola página, con filtros)

Añadir al aggregator + vista existentes (sin ruta nueva):
- Filtros `surface` (Learn|Play|Ambos) y `container` (MiniPay|Browser|Ambos) — client-side sobre
  datos pre-agregados por dimensión, o querystring que re-agrega server-side (decisión en impl;
  preferir server para no exponer filas crudas).
- **App opens** (conteo de `app_opened`, por día).
- **Activación** (funnel `app_opened → hub_viewed → exercise_started → exercise_completed →
  daily_focus_completed`), conteos absolutos (sin rates, como `ChallengeFunnel`).
- **Top countries** (conteo por `country`, top N, excluye `null`).
- **Retención D1/D7** (cohortes desde `session_first_seen`).
- **as-of** (`generatedAt`, ya existe).

---

## 7. Red-team

### Privacidad
- ✅ `country` solo ISO alpha-2 (regex `^[A-Z]{2}$`); jamás IP/ciudad/región/postal/lat/long.
- ✅ IP nunca se persiste; se lee el header ya resuelto por el edge y se descarta.
- ✅ `source`/`campaign` por allow-list — nunca referrer/URL cruda ni query params arbitrarios.
- ✅ `session_id`/`visit_id` opacos, sin wallet/PII.
- ⚠️ **Gate de producción:** Privacy Policy EN/ES actualizada ANTES de activar captura de `country`.

### Duplicados / idempotencia
- `app_opened`: guard `sessionStorage` → once-per-visit aun con StrictMode/remount/navegación.
- `session_first_seen`: `on conflict do nothing` → la cohorte no se re-fija en visitas posteriores.
- Normalización: el shim NO debe hacer doble-conteo del canónico (test que lo fija).

### Definición de sesión
- `session_id` = persistente (anonymous). `visit_id` = por pestaña. Documentado en código y spec.
- Cerrar/reabrir la pestaña → nuevo `visit_id`, mismo `session_id` → nuevo `app_opened`, misma
  cohorte. Correcto.

### Cardinalidad
- Dimensiones de **baja cardinalidad** (surface 2, container 2, country ~O(100), source ~7,
  app_version O(deploys), locale O(pocos)). Seguras para indexar y agrupar.
- `campaign`/`source` fuera de allow-list colapsan a `unknown` → evita explosión de cardinalidad.
- `visit_id` es alta cardinalidad pero **no se indexa** (no se agrupa por él en el MVP).

---

## 8. Plan por commits atómicos

1. `feat(analytics): session semantics + visit_id (sessionStorage)` — helpers + tests. Sin schema.
2. `feat(db): additive analytics dimension columns (migration)` — solo SQL + tipos. Nullable.
3. `feat(db): session_first_seen cohort table (migration)` — SQL + upsert helper + tests.
4. `feat(analytics): enrich track() with dims + server-side country` — client dims + `/api/telemetry`
   allow-lists + header. Tests de sanitización/allow-list.
5. `feat(analytics): app_opened once-per-visit + first_seen upsert` — mount en layout + guard. Tests.
6. `feat(analytics): canonical event map + shim` — `hub_viewed`/`exercise_*`/`daily_focus_completed`.
7. `feat(stats): surface/container filters + app opens + activation` — aggregator + vista.
8. `feat(stats): top countries + retention D1/D7` — cohortes desde `session_first_seen`.
9. `docs(privacy): EN/ES analytics disclosure` — identificador anónimo, país aprox. de IP, no IP
   completa, finalidad agregada producto/seguridad, retención (90d eventos / cohortes persistentes).

Cada commit: TDD, suite verde reportada, atómico.

## 9. Verificación (antes de prod)
- Ensayar migraciones 2/3 contra réplica local (Supabase local), no prod.
- Tests focalizados por commit + suite completa + `pnpm exec tsc --noEmit`.
- Verificación visual de `/stats` (filtros, funnel, top countries, retención, as-of).
- **STOP antes de aplicar migraciones a producción.**

## 10. Fuera de alcance (confirmado)
Reconciliación de pagos/rewards · métricas on-chain completas · D3/D21 · renombrar catálogo ·
SaaS · warehouse · ciudad/geo precisa · página Learn/Play separada · cron reconciliador.
