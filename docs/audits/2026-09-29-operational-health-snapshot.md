# Chesscito — operational health snapshot

Date: 2026-09-29 (UTC; local health command reported 2026-09-28 20:58 Bogotá)
Scope: read-only diagnosis; no production changes, deployment, cron changes, telemetry changes, SQL writes, Redis writes, or workflow reruns.

## Executive status

**DEGRADED**

Supabase control-query latency exceeded the 5 s health threshold (5.889 s). The stats refresh workflow reached its production endpoint and received HTTP 503 in two recent scheduled runs. The last successful run is from 2026-09-28 13:48:51 UTC; `/stats` still returns HTTP 200 with that snapshot, approximately 12 hours old at the health capture. The evidence points to the application refresh path, likely its Supabase/RPC work under high database latency, but does not identify a specific RPC. Redis failure remains possible because the route also maps Redis unavailability/errors to 503.

## OPS HEALTH

| Área | Estado | Evidencia | Acción |
| --- | --- | --- | --- |
| Estado general | ERROR | `RED (partial)`; one measured critical axis: Supabase `select now()` 5.889 s (>5 s). | Investigar latencia de DB antes de tocar retención/telemetría. |
| Supabase | ERROR | PostgreSQL 17.6 responde; base 332 MB; `analytics_events` 450,722 filas, ventana desde 2026-06-03, heap 123 MB + índices 140 MB; conexiones 1 active / 14 idle. No se observaron eventos en las ventanas 15m/1h/6h/24h. | Obtener logs y duración por RPC; no repetir mantenimiento por ahora. |
| Planner / vacuum | OK | El checkpoint posterior a VACUUM/ANALYZE indica 450,722 live, 0 dead, `n_mod_since_analyze=0`, vacuum_count 1, analyze_count 2. | Sin acción; esto no prueba que las RPC estén más rápidas. |
| Vercel | WARNING | Ambos dominios responden 200: `play.chesscito.com` 1,182 ms y `learn.chesscito.com` 1,121 ms. Production READY en SHA `58b579827930`; muestras 50 requests/proyecto, sin 5XX. Invocaciones periodo: 163,773 + 102,771 = 266,544. | Consultar quota/CPU en consola; la API no expone límites. |
| Upstash / Redis | WARNING | 48,280 claves; PING mediana 70 ms, p95 408 ms, primera 408 ms. | Obtener Commands/Bandwidth desde consola; no observable por falta de credenciales de Management API. |
| Dominios / endpoints | OK | `play.chesscito.com` y `learn.chesscito.com`: HTTP 200. `/stats`: HTTP 200 en 1.668 s. | Ninguna inmediata. |
| Errores 5XX | OK (muestra limitada) | Ninguno en las muestras recientes de logs de Vercel; esto no invalida el 503 específico del cron. | Revisar logs de función del route de stats. |
| Latencias | ERROR | Supabase `select now()` 5,889 ms; páginas play/learn ~1.1–1.2 s; PING Redis p95 408 ms. | Priorizar latencia Supabase. |
| Capacidad | UNKNOWN | Base 332 MB y analytics 262 MB. Usage/cuota Vercel y comandos/bandwidth Upstash no observables por APIs disponibles. | Consultar las consolas de Vercel y Upstash. |
| Warning/cambio | WARNING | Desde snapshot anterior: analytics +48,886 filas / +38 MB; Upstash +25,850 keys. 0 eventos nuevos en las ventanas cortas observadas. WAL counters no comparables. | Vigilar, sin inferir causa ni extrapolar régimen. |

La poda mensual está **activa**, con cron `0 3 1 * *`, GMT y cinco ejecuciones registradas. El run exitoso más reciente conocido fue el 1-sep-2026; la auditoría read-only del 28-sep contó 12,680 filas elegibles para el cutoff de 90 días. Es consistente con ejecución mensual (no continua): entre fechas de poda puede haber filas con más de 90 días. La próxima ejecución calculada es 1-oct-2026 03:00 UTC. “Activo” no significa que el límite sea exactamente 90 días en todo momento.

### Comando y salida completa — `pnpm ops:health`

Exit code: 1 (el script retorna error por el umbral Supabase; la captura terminó).

```text

> chesscito@0.1.0 ops:health /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito
> pnpm -C apps/web exec tsx ../../scripts/ops/launch-health-snapshot.ts

────────────────────────────────────────────────────────────────────────
CHESSCITO — LAUNCH HEALTH        2026-09-29T01:58:09.939Z
                                 2026-09-28 20:58:09 (Bogotá)
TARGET: PRODUCTION
ESTADO: 🔴 RED (partial)  ⚠️ 2 critical axis/axes not measured
────────────────────────────────────────────────────────────────────────

SUPABASE  ⚠️ SHARED DATABASE  [observable · compartida entre production y preview]
  ⚠️ Esta base NO se separa por target: production y preview escriben en la MISMA.
     Filas, ritmo y proyecciones de abajo son la SUMA de los dos entornos y no
     son atribuibles a uno solo.
  now() responde en 5889 ms · PostgreSQL 17.6
  base 332 MB · analytics 123 MB heap + 140 MB índices
  filas 450,722 · ventana retenida desde 2026-06-03
  ritmo instantáneo por ventana (sin extrapolar a un régimen):
     last_15m         0 ev ·     0 ses · 0.0 ev/min
     last_1h          0 ev ·     0 ses · 0.0 ev/min
     last_6h          0 ev ·     0 ses · 0.0 ev/min
     last_24h         0 ev ·     0 ses · 0.0 ev/min
  pico observado: 2026-08-04 → 62,249 ev / 2,612 ses
  proyección física (una por ventana — difieren por diseño):
     last_15m         0 filas/día → 30d 0 B · 45d 0 B · 90d 0 B
     last_1h          0 filas/día → 30d 0 B · 45d 0 B · 90d 0 B
     last_6h          0 filas/día → 30d 0 B · 45d 0 B · 90d 0 B
     last_24h         0 filas/día → 30d 0 B · 45d 0 B · 90d 0 B
     peak_day    62,249 filas/día → 30d 1.1 GB · 45d 1.6 GB · 90d 3.2 GB
  distribución de eventos por sesión: NO OBSERVABLE
  cron poda: prune_analytics_events_monthly · 0 3 1 * * · activo · 5 corridas registradas
  autovacuum: n_live 450,722 · n_dead 0
  conexiones: 1 activas / 14 idle
  top eventos 24h:
  guardado de score 24h: sin eventos de fallo ni de aplazado

VERCEL  [parcial]
  play · play.chesscito.com
     dominio    play.chesscito.com · HTTP 200 ✓ · 1182 ms
     deployment chesscito-8ur5s995o-goodwolf.vercel.app
     target     production ✓ · ref production ✓
     commit     58b579827930 · READY · hace 5523 min
     muestra de logs: 50 requests (de 100 filas crudas) en 1486s
     5XX por ruta: ninguno
     /api/telemetry: 0 req · 0 err
  learn · learn.chesscito.com
     dominio    learn.chesscito.com · HTTP 200 ✓ · 1121 ms
     deployment lite-chesscito-5diynjg2i-goodwolf.vercel.app
     target     production ✓ · ref production ✓
     commit     58b579827930 · READY · hace 5522 min
     muestra de logs: 50 requests (de 100 filas crudas) en 4359s
     5XX por ruta: ninguno
     /api/telemetry: 0 req · 0 err
  consumo (Observability) · ventana 2026-09-04T07:00:00.000Z → 2026-09-29T01:57:48.968Z
     ciclo de facturación desde 2026-09-04T07:00:00.000Z
     chesscito: 163,773 invocaciones
     lite-chesscito: 102,771 invocaciones
     TOTAL in-scope: 266,544 invocaciones
     fuera de alcance (NO sumado): chesscito-landing, denlabs-site, denscope-xr, furinkazan, munayfund, signalforge, universal-rate, x402-bruma — 40,208 invocaciones
     ⚠️ es consumo POR PROYECTO, no separado por environment: production y preview comparten nombre de proyecto
     Active CPU per project: NOT OBSERVABLE — the API's per-project attribution is non-deterministic (3 identical calls returned 1, 3 and 2 rows with values moving ~25%)
     % de cuota y días hasta agotamiento: NO OBSERVABLE — ninguna API expone lo incluido en el plan

UPSTASH  [parcial]
  claves (DBSIZE): 48,280
  latencia PING: mediana 70 ms · p95 408 ms · primera 408 ms (TLS)
     muestras: 408, 210, 69, 70, 70 ms
  comandos y cuota: NO OBSERVABLE — Management API credentials not configured
     copiar de: Upstash Console → your database → Usage → Commands (period) and Bandwidth

INDICADORES QUE DISPARARON EL ESTADO
  🔴 supabase: select now() took 5889 ms (>5000)

CAMBIOS DESDE EL SNAPSHOT ANTERIOR
  ventana entre snapshots: 21587 min
  filas analytics: 401,836 → 450,722 (+48,886)
  tamaño analytics: 224 MB → 262 MB
  claves Upstash: 22,430 → 48,280 (+25,850)
  WAL records: not comparable (counters were reset between snapshots)

CAPACIDAD RESTANTE
  base 332 MB · analytics 262 MB

ACCIONES RECOMENDADAS  (ninguna ejecutada)
  [red] supabase: select now() took 5889 ms (>5000)
  definir UPSTASH_EMAIL + UPSTASH_API_KEY para desbloquear la cuota

DATOS NO OBSERVABLES
  · Fluid Active CPU (per-project attribution is non-deterministic) — el consumo se mide; lo INCLUIDO en el plan no lo expone ninguna API (/v1/billing/charges → 404 costs_not_found)
      copiar de: Vercel → Usage → Fluid Active CPU / Function Invocations
  · Active CPU as a % of the plan quota (no allowance is exposed by any API) — el consumo se mide; lo INCLUIDO en el plan no lo expone ninguna API (/v1/billing/charges → 404 costs_not_found)
      copiar de: Vercel → Usage → Fluid Active CPU / Function Invocations
  · days until CPU exhaustion (depends on the two above) — el consumo se mide; lo INCLUIDO en el plan no lo expone ninguna API (/v1/billing/charges → 404 costs_not_found)
      copiar de: Vercel → Usage → Fluid Active CPU / Function Invocations
  · commands used this period — Management API credentials not configured
      copiar de: Upstash Console → your database → Usage → Commands (period) and Bandwidth
  · percentage of the 500K quota — Management API credentials not configured
      copiar de: Upstash Console → your database → Usage → Commands (period) and Bandwidth
  · bandwidth — Management API credentials not configured
      copiar de: Upstash Console → your database → Usage → Commands (period) and Bandwidth
  · projection to quota exhaustion (1h / 6h / 24h) — Management API credentials not configured
      copiar de: Upstash Console → your database → Usage → Commands (period) and Bandwidth
  · commands per hour/day (no time series in the REST API) — Management API credentials not configured
      copiar de: Upstash Console → your database → Usage → Commands (period) and Bandwidth
  · eventos por request de telemetría (ratio de batching) — la muestra de logs dura ~90 s y la ventana más corta de la base es 15 min; dividir ventanas de distinto span no es un ratio
      copiar de: computable con VERCEL_TOKEN: invocations de /api/telemetry sobre un período real, contra las filas de analytics_events del MISMO período

CREDENCIALES  SUPABASE_URL=sí  SUPABASE_DB_PASSWORD=sí  UPSTASH_REDIS_REST_URL=sí  UPSTASH_REDIS_REST_TOKEN=sí  UPSTASH_EMAIL=no  UPSTASH_API_KEY=no  VERCEL_TOKEN=sí  LOG_SALT=sí
Snapshot tomado en 26899 ms
```

## OPS NO TOKEN

Script usage documents both `--window` and `--target`; no flags were invented.

| Área | Estado | Evidencia | Acción |
| --- | --- | --- | --- |
| Balance reads USDC/USDT/cUSD | WARNING | 305/308 deduplicated attempts (99%) read successfully but under purchase price; three attempts had all reads absent (1%). | Interpret as historically observed `pro_purchase_failed` events, not live wallet balances. |
| RPC reads | OK | 0% classified RPC failure in 308 attempts. | None. |
| Payable users blocked | OK | 0 attempts classified `success:payable` while blocked. | None. |
| Wallets affected | WARNING | 248 wallet tags in aggregate; output does not expose identifiers. | No live token holdings/wallet list were queried. |
| Dedup window | WARNING | 1 suspicious merge with differing reads at both 1 s and 5 s. Five-second variant yielded same 308 attempts and 671 rows. | Keep 1 s as the primary measurement; investigate merged event only if this gate becomes a decision input. |

### Complete output — `pnpm ops:no-token`

```text

> chesscito@0.1.0 ops:no-token /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito
> pnpm -C apps/web exec tsx ../../scripts/ops/no-token-observation.ts

PRO no-token — observation window
dedup rule: same wallet + same event within 1s = ONE attempt

progress: 308 / 200 attempts   (671 raw rows, 248 wallets)
           ✅ threshold reached — bring the evidence to the founder

| outcome                      | raw | attempts | wallets |    % |
|------------------------------|----:|---------:|--------:|-----:|
| read fine, under price       | 667 |      305 |     246 |   99 |
| all reads absent             |   4 |        3 |       3 |    1 |

TOP READ COMBINATIONS
| read_usdc            | read_usdt            | read_cusd            | attempts |
|----------------------|----------------------|----------------------|---------:|
| success:zero         | success:under_price  | success:zero         |      151 |
| success:zero         | success:dust         | success:zero         |       80 |
| success:zero         | success:zero         | success:zero         |       25 |
| success:zero         | success:under_price  | success:dust         |       22 |
| success:zero         | success:dust         | success:dust         |       17 |
| success:zero         | success:under_price  | success:under_price  |        4 |
| absent               | absent               | absent               |        3 |
| success:dust         | success:dust         | success:zero         |        2 |

READINGS
WHAT THE NO-TOKEN GATE IS SEEING       read fine, under price
ABSENT DOMINATES?                      no (1%)
RPC FAILURE DOMINATES?                 no (0%)
REAL LOW BALANCE DOMINATES?            YES (99%)
ANY PAYABLE USER BLOCKED?              no

⚠️  1 attempt(s) merged rows with DIFFERENT reads — the 1s window may be too wide. Re-run with --window 1.

⛔ This tool reports. It does not recommend, and it changes nothing.
```

### Complete output — `pnpm ops:no-token --window 5 --target 200`

```text

> chesscito@0.1.0 ops:no-token /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito
> pnpm -C apps/web exec tsx ../../scripts/ops/no-token-observation.ts "--window" "5" "--target" "200"

PRO no-token — observation window
dedup rule: same wallet + same event within 5s = ONE attempt

progress: 308 / 200 attempts   (671 raw rows, 248 wallets)
           ✅ threshold reached — bring the evidence to the founder

| outcome                      | raw | attempts | wallets |    % |
|------------------------------|----:|---------:|--------:|-----:|
| read fine, under price       | 667 |      305 |     246 |   99 |
| all reads absent             |   4 |        3 |       3 |    1 |

TOP READ COMBINATIONS
| read_usdc            | read_usdt            | read_cusd            | attempts |
|----------------------|----------------------|----------------------|---------:|
| success:zero         | success:under_price  | success:zero         |      151 |
| success:zero         | success:dust         | success:zero         |       80 |
| success:zero         | success:zero         | success:zero         |        25 |
| success:zero         | success:under_price  | success:dust         |        22 |
| success:zero         | success:dust         | success:dust         |        17 |
| success:zero         | success:under_price  | success:under_price  |         4 |
| absent               | absent               | absent               |         3 |
| success:dust         | success:dust         | success:zero         |         2 |

READINGS
WHAT THE NO-TOKEN GATE IS SEEING       read fine, under price
ABSENT DOMINATES?                      no (1%)
RPC FAILURE DOMINATES?                 no (0%)
REAL LOW BALANCE DOMINATES?            YES (99%)
ANY PAYABLE USER BLOCKED?              no

⚠️  1 attempt(s) merged rows with DIFFERENT reads — the 5s window may be too wide. Re-run with --window 1.

⛔ This tool reports. It does not recommend, and it changes nothing.
```

## STATS CRON

- **Workflow file:** `.github/workflows/cron-stats-snapshot-refresh.yml`; name `Cron — public stats snapshot refresh`.
- **Schedule:** `17 */6 * * *` (every six hours at minute 17); also has `workflow_dispatch`; concurrency group prevents overlap and does not cancel an active run.
- **Request:** `POST ${STATS_REFRESH_URL%/}/api/internal/stats/refresh`; `Authorization: Bearer ${STATS_REFRESH_SECRET}`. Missing either secret exits 1. `curl --fail --silent --show-error --max-time 120`; workflow timeout is 3 minutes. No retry. No response body logging (`--silent`; on non-2xx, curl reports only status). Success means curl received 2xx.
- **Run `36381410742`:** scheduled, SHA `58b57982793068ff7ee5d903f69ebe6d871e6b71`; request reached endpoint; HTTP 503 at 2026-09-28 05:19:43Z, around 9 s after step start.
- **Latest run `36496901044`:** scheduled, same SHA; HTTP 503 at 2026-09-28 23:14:24Z, around 8.4 s after step start.
- **Most recent successful run:** `36431299502`, scheduled at 2026-09-28 13:48:51Z, completed 13:49:04Z.
- **Direct reproduction:** not run. Local environment had neither `STATS_REFRESH_URL` nor `STATS_REFRESH_SECRET`; no GitHub rerun was performed. The route's POST normally replaces the Redis snapshot and establishes a 15-minute cooldown, so credentials would be required to run that authorized normal refresh.
- **Endpoint implementation:** `apps/landing/src/app/api/internal/stats/refresh/route.ts`. Requires exact Bearer secret match; returns 401 if auth missing/invalid, 503 if Redis unconfigured, 409 while another refresh owns the lock, 429 during cooldown, 503 for incomplete snapshot, phase timeout, or refresh error; otherwise 200 with `refreshedAt`.
- **RPC calls:** current cron deliberately requires `stats_activation_funnel`, `stats_access_funnel`, `stats_retention`, `stats_account_lifecycle`, `stats_activity_trend`; they run in parallel with 8 s individual timeout, 30 s total RPC phase. `stats_install_counts`, `stats_top_countries`, and `stats_habit_depth` are in the full aggregator schema but are excluded from this emergency refresh. On-chain and census/breakdown are intentionally marked unavailable for this snapshot.
- **Snapshot publish behavior:** build off-key; only publish a complete snapshot with all required RPCs successful. Redis Lua publish also verifies lock ownership. Any failure preserves previous snapshot.
- **Redis snapshot:** a valid snapshot exists (inferred from `/stats` displaying its `refreshedAt`); refreshed at 2026-09-28 13:48 UTC. Redis payload size was not directly queried. Public `/stats` GET: HTTP 200, 1.668 s, 139,328-byte HTML; serves the snapshot normally, currently stale by about 12 h.
- **Vercel function logs:** bounded production queries for `stats/refresh` and 5XX returned no log entries in the CLI, so there is no captured RPC name/phase. No run was triggered.

## DB / RPC STATUS

Individual RPC duration/status is **UNKNOWN** because the Action step does not capture the response body and the Vercel CLI query returned no function log rows. The 503 and ~8–9 s timing implicate the application refresh path, but do not prove which subdependency failed.

| RPC | Estado | Duración | Riesgo |
| --- | --- | --- | --- |
| `stats_activation_funnel` | UNKNOWN (required; collective refresh failed) | UNKNOWN; 8 s per-RPC cap | High: time-window aggregation reads `analytics_events`; DB control query already exceeded 5 s. |
| `stats_access_funnel` | UNKNOWN (required; collective refresh failed) | UNKNOWN; 8 s per-RPC cap | High: same raw events table and bounded time windows. |
| `stats_retention` | UNKNOWN (required; collective refresh failed) | UNKNOWN; 8 s per-RPC cap | High: cohort/return aggregation over first-seen data and events; aggregations can be expensive. |
| `stats_account_lifecycle` | UNKNOWN (required; collective refresh failed) | UNKNOWN; 8 s per-RPC cap | High: lifecycle/cohort aggregation over account first-seen and recent events. |
| `stats_activity_trend` | UNKNOWN (required; collective refresh failed) | UNKNOWN; 8 s per-RPC cap | High: dense 30-day activity trend aggregation. |
| `stats_install_counts` | Not called by emergency refresh | N/A | Not a direct cause of this refresh. |
| `stats_top_countries` | Not called by emergency refresh | N/A | Not a direct cause of this refresh. |
| `stats_habit_depth` | Not called by emergency refresh | N/A | Not a direct cause of this refresh. |

All five active functions work over rolling/calendar activity up to 30 days in the current SQL definitions. `analytics_events` has `idx_analytics_events_created_at`, `idx_analytics_events_event`, and dimension indexes including `(surface, created_at)`, `(container, created_at)`, `(country, created_at)`. The September 28 VACUUM/ANALYZE should improve planner estimates and remove dead-tuple overhead; `n_mod_since_analyze=0` supports current stats freshness. It does not guarantee better RPC latency. No costly EXPLAIN ANALYZE or SQL change was run. Planner benefit cannot be measured here because no RPC timing/plan output was available.

## CHESSCITO CURRENT STATE

- Git branch `fix/phase-1-supabase-io-containment` and `origin/main` / `origin/production` point to SHA `58b57982793068ff7ee5d903f69ebe6d871e6b71`, commit date 2026-09-16 23:05:42 -05:00. Production Vercel deployments for both projects are READY at that SHA.
- The workspace had 60 pre-existing modified/untracked paths at inspection. In particular, a local untracked migration `20260929000000_bounded_analytics_events_retention.sql` exists; it is not part of deployed SHA. Read-only query of `supabase_migrations.schema_migrations` returned zero versions >= `20260929000000`; bounded migration is **not applied in production**.
- Monthly pruning cron remains active: `prune_analytics_events_monthly`, `0 3 1 * *`, with five recorded runs; latest known success was 2026-09-01 03:00 UTC. A 2026-09-28 read-only count found 12,680 rows eligible under the 90-day cutoff; the next monthly run is 2026-10-01 03:00 UTC. The tracked function deletes rows older than 90 days, but monthly cadence allows older rows to accumulate between runs. The local untracked bounded migration proposes a different job but production has no corresponding migration record.
- Telemetry traffic in Vercel's health samples: `/api/telemetry` 0 requests in each 50-request sample; Supabase short windows also show 0 events. The client code has a `NEXT_PUBLIC_TELEMETRY_ENABLED` kill switch that defaults ON unless explicit `0`/`false`. Production's effective env value was not observable, so “telemetry OFF” remains **UNKNOWN**, not confirmed by code alone.
- Retired emitters: `arena_select_view` is absent as a runtime emitter in the deployed SHA (the source only contains a removal comment). However, deployed SHA `58b57982` still contains runtime emitters `arena_mount` and `arena_fresh_reset_fired`. Their removal is present only in the dirty local `arena/page.tsx` and is not deployed; therefore the claim that all retired emitters remain absent in production is **ERROR**.
- Token/payment observation: no-token event history contains no payable user blocked and no RPC failures. This is not a live token-balance/RPC sweep and provides no present-chain balance guarantee.
- Critical domains are HTTP 200; stats is HTTP 200. Recent `/stats` refresh is stale but available.

## ROOT CAUSE

**LIKELY ROOT CAUSE** — stats refresh application path failing, most likely Supabase/RPC latency or timeout. Evidence: GitHub secrets were present; workflow reached endpoint; endpoint returned 503 within roughly 8–9 seconds; Supabase `select now()` took 5.889 s. Not confirmed: route can also report 503 for Redis or a generic refresh failure, and exact response body/RPC metrics were not captured.

## NEXT ACTION

1. Read the Vercel invocation/runtime logs for the two failed timestamps and recover the response reason plus `stats_rpcs` phase and per-RPC timings.
2. Once observability is available, measure the five required RPCs independently with bounded, read-only execution; compare to the 8 s per-RPC and 30 s phase budgets. Avoid `EXPLAIN ANALYZE` until the DB latency is stable.
3. Confirm Redis snapshot payload metadata/size and the effective production `NEXT_PUBLIC_TELEMETRY_ENABLED` value through credential-safe read-only surfaces.

## Additional read-only checks

- `pnpm ops:no-token --window 5 --target 200` is supported by the script; it reproduced the same counts as 1 s but retained the single differing-read merge warning.
- `supabase migration list --linked` returned 401 Unauthorized; it was not retried. A guarded `pnpm ops:query` SELECT against production migration history returned 0 rows for versions >= `20260929000000`.
- The endpoint POST was not called; local `STATS_REFRESH_URL` and `STATS_REFRESH_SECRET` were absent. No GitHub rerun, deployment, transaction, DELETE, VACUUM, ANALYZE, migration, cron edit, telemetry change, or Redis write was performed.
