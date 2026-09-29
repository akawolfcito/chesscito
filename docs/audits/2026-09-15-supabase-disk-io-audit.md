# Auditoría de Disk IO — Supabase producción

Fecha: 2026-09-15
Alcance: auditoría estática del repositorio e historial Git. No se modificó código ni se ejecutaron consultas contra producción.

## A–F: conclusión

### A. ¿Cuál es el candidato principal al consumo de Disk IO?

`analytics_events`, por la combinación de alto volumen de escrituras de telemetría y agregaciones de `/stats` sobre ventanas de 30 días. El riesgo mayor es la ruta `/stats` de `apps/web`: ejecuta muchas lecturas directas y su `unstable_cache` se crea dentro del render, patrón documentado en el propio repo como causante histórico de regeneración por visita.

### B. ¿Es `/stats` todavía un responsable probable?

Sí, especialmente si la ruta activa es la de `apps/web`, no la de `apps/landing`. La versión landing tiene snapshot cacheado correctamente a 15 min y coalescing por proceso; la web conserva el agregador antiguo de ~20+ lecturas por regeneración.

### C. ¿Hay alguna regresión reciente?

No veo una regresión reciente que aumente IO. El commit más reciente, `42fe926b` (14 Sep), reduce una llamada `stats_install_counts` por regeneración en landing: 4 → 3. La regresión crítica del cache de `/stats` parece antigua y permanece en `apps/web`, no introducida recientemente.

### D. ¿Hay queries ejecutándose mucho más de lo necesario?

- `apps/web /stats`: fan-out grande de queries sobre `analytics_events`, `victories`, `session_first_seen`, `account_first_seen` y vistas de leaderboard.
- Sus ocho RPCs de landing hacen ocho escaneos/agregaciones separados sobre la misma ventana de 30 días en cada cache miss.
- Telemetría hace una escritura por batch, pero luego hasta una escritura por sesión y por cuenta dentro del batch; está mejor que antes, pero sigue siendo la fuente más probable de volumen sostenido.
- Duels hacen polling cada 1.2 s mientras esperan rival y cada 3 s durante una partida; esas rutas leen Supabase con `no-store`.

### E. ¿Hay sequential scans o temp IO preocupantes?

Hay evidencia histórica de temp IO en `/stats`:

- `stats_top_countries`: spill documentado de ~2.2–3.3 MB.
- `stats_habit_depth`: spill documentado de ~3.5 MB.
- Ambas RPC ajustan `work_mem` local a 8 MB para evitarlo; hay que confirmar que la migración está aplicada y que el crecimiento actual no volvió a superar ese margen.
- Las agregaciones restantes pueden hacer `Seq Scan` de forma legítima si la ventana de 30 días ya representa una fracción grande de `analytics_events`; los índices no eliminan el coste de `COUNT(DISTINCT ...)`, `GROUP BY` y deduplicación.

### F. ¿Qué tres cosas deberíamos medir inmediatamente en producción?

1. `pg_stat_statements`: `shared_blks_read`, `temp_blks_read/written`, `calls` y `total_exec_time`, agrupado por query.
2. `pg_stat_user_tables`: `seq_scan`, `seq_tup_read`, `idx_scan`, tuplas vivas/muertas de `analytics_events`, cohortes y tablas de juego.
3. Volumen y cadencia: filas de `analytics_events` por 15 min/24 h, cron jobs/runs y tasa de tráfico a `/stats`, `/api/telemetry` y rutas de duel.

## Hallazgos priorizados

| Query/feature | Frecuencia | IO estimado | Evidencia | Riesgo | Acción sugerida |
|---|---:|---:|---|---|---|
| 🔴 `apps/web` `/stats` agregador antiguo | Por visita/cache miss | Alto | ~20+ queries; varias lecturas de 30d y hasta 10k filas; cache creada en render | Alto | Confirmar si este deployment/ruta recibe tráfico y buscar su huella en `pg_stat_statements` |
| 🔴 `analytics_events` ingestión `/api/telemetry` | Por batch de 20 o 5 s | Alto sostenido | Inserta eventos + upserts de cohortes; tabla base de todos los stats | Alto | Medir inserts/15 min, tamaño, dead tuples, WAL y top statements |
| 🟠 Ocho RPCs `stats_*` de landing | Cada miss, por combinación de filtros e instancia | Medio/alto | Cada una analiza 30d; varias deduplican/agregan | Alto si hay misses o invalidaciones | Medir calls/IO de cada RPC y cache-hit ratio de la plataforma |
| 🟠 `stats_retention` | Cada miss `/stats` | Medio | `DISTINCT(session_id, day)` + cohortes + lateral `EXISTS` | Medio/alto | Revisar plan y temp blocks reales |
| 🟠 `stats_account_lifecycle` | Cada miss `/stats` | Medio | Lee denominador completo `account_first_seen` y agrega eventos 30d por cuenta | Crece con cuentas | Medir seq scans, cardinalidades y plan |
| 🟠 `stats_activity_trend` | Cada miss `/stats` | Medio | Lee eventos 30d y hace lookup sin filtro temporal sobre `session_first_seen` | Crece con cohortes históricas | Medir lecturas de `session_first_seen` |
| 🟡 `stats_top_countries`, `stats_habit_depth` | Cada miss `/stats` | Medio | Spills históricos explícitamente documentados | Depende de crecimiento | Confirmar temp IO actual |
| 🟡 Duels polling | 1.2–3 s por duelo activo | Bajo por query, multiplicable | `use-duel.ts`; rutas usan lecturas frescas de Supabase | Tráfico dependiente de uso | Correlacionar calls a `duels` con sesiones activas |
| 🟡 Cron purge de Coach | Diario, máximo 10 × 5,000 filas | Variable, concentrado | Delete por `expires_at`, index dedicado | Pico a las 03:00 UTC | Verificar runs y filas borradas; correlacionar con alerta |
| 🟢 Sync cron | Cada 15 min | No parece IO DB relevante | Opera sincronización blockchain/Redis | Bajo | Confirmar desde logs, no parece candidato primario |
| 🟢 Cambio `42fe926b` | Cada refresh landing | Reduce IO | Reutiliza el resultado principal de installs | Bajo | No revertir: va en la dirección correcta |

## `/stats`: trazabilidad de RPCs

Fuente: `apps/web/supabase/migrations/20260805000000_stats_aggregation_rpcs.sql`.

| RPC | Tablas / operación | Índices relevantes | Riesgo de scan |
|---|---|---|---|
| `stats_install_counts` | `analytics_events`, 30d; cuatro `COUNT`, tres `DISTINCT session_id` | `created_at`, `session_id, created_at`, dimensiones+fecha | Alto: lee toda la ventana filtrada |
| `stats_activation_funnel` | `analytics_events`; agrupa por `session_id`, `bool_or(event)` | `created_at`, `event, created_at`, dimensiones+fecha | Medio/alto: `GROUP BY session_id` |
| `stats_access_funnel` | Igual, agrupado por sesión | Igual | Medio/alto |
| `stats_top_countries` | `analytics_events`; `GROUP BY country`, `COUNT DISTINCT`, `ORDER BY sessions DESC`, `LIMIT 8` | `country, created_at`; dimensiones+fecha | Medio; spill histórico bajo filtros |
| `stats_retention` | `analytics_events` + `session_first_seen`; actividad distinta por día, cohortes y lateral `EXISTS` | eventos por fecha/sesión; `session_first_seen(first_seen)` | Alto: dedupe + join lógico repetido |
| `stats_account_lifecycle` | `account_first_seen` completo + `analytics_events` 30d agrupado por cuenta | `account_ref, created_at`; `account_first_seen(first_seen)` | Medio/alto; denominador crece sin límite |
| `stats_habit_depth` | `analytics_events`; días distintos por sesión, percentil | eventos por fecha/sesión | Alto; spill histórico |
| `stats_activity_trend` | eventos distintos por sesión/día + `session_first_seen` sin fecha | eventos por fecha/sesión; cohortes por PK | Medio; lookup histórico de cohortes |

Las ocho RPCs reciben los mismos filtros opcionales `surface`/`container`. Hay índices `(surface, created_at DESC)`, `(container, created_at DESC)`, `(country, created_at DESC)`, `(account_ref, created_at DESC)`, además de índices por fecha, evento y sesión. Aun así, no existe un índice que elimine los `COUNT DISTINCT`, agrupaciones y ordenamientos; tampoco conviene inferir que falta uno sin el plan real.

La landing cachea un refresh saludable como diez RPCs: ocho principales y dos `stats_install_counts` adicionales para el breakdown, tras el cambio reciente. La web antigua no usa esas RPCs: usa muchas lecturas PostgREST directas, incluyendo rangos de hasta 10,000 filas de `analytics_events`.

## Inventario de accesos

- Escrituras de alto volumen: `/api/telemetry` → `analytics_events`, `session_first_seen`, `account_first_seen`.
- Escrituras transaccionales por jugador: scores/sesiones de score, `peones_ledger`, payment intents, welcome packs, season pass/focus ledger, duels, coach analyses, inbox, content overlay.
- Lecturas frecuentes por request: balances, season pass, inbox, leaderboard, perfiles, coach history, duels.
- Polling identificado:
  - Duel: 1.2 s esperando rival; 3 s jugando; pausa a 30 s en pestaña oculta.
  - Coach job: 3 s hasta 60 s, principalmente Redis, no Supabase.
  - No hallé polling periódico de `/stats`.
- Cron:
  - GitHub Actions `/api/cron/sync`: cada 15 min; no parece ruta Supabase pesada.
  - GitHub Actions `/api/cron/coach-purge`: diario 03:00 UTC; delete indexado por `expires_at`.
  - `pg_cron prune_analytics_events_monthly`: primer día de mes, 03:00 UTC; delete potencialmente pesado sobre filas >90d.

## SQL diagnóstico: ejecutar ahora

Estas consultas son de lectura. Si `pg_stat_statements` da error de permisos o no está habilitado, conservar el error como evidencia y usar las de tablas/índices.

### 1. Principal: lecturas físicas de disco por statement

```sql
select
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  shared_blks_read,
  shared_blks_hit,
  temp_blks_read,
  temp_blks_written,
  rows,
  left(query, 1000) as query
from pg_stat_statements
order by shared_blks_read desc
limit 30;
```

### 2. Tiempo total acumulado

```sql
select
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  shared_blks_read,
  temp_blks_read,
  temp_blks_written,
  left(query, 1000) as query
from pg_stat_statements
order by total_exec_time desc
limit 30;
```

### 3. Statements más llamados: detecta polling y fan-out

```sql
select
  calls,
  round(mean_exec_time::numeric, 2) as mean_ms,
  shared_blks_read,
  temp_blks_written,
  left(query, 1000) as query
from pg_stat_statements
order by calls desc
limit 40;
```

### 4. Temp IO: sorts, hashes y agregaciones que derraman al disco

```sql
select
  calls,
  temp_blks_read,
  temp_blks_written,
  round(total_exec_time::numeric, 2) as total_ms,
  left(query, 1000) as query
from pg_stat_statements
where temp_blks_read > 0 or temp_blks_written > 0
order by (temp_blks_read + temp_blks_written) desc
limit 30;
```

### 5. Huella de stats y analytics

```sql
select
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  shared_blks_read,
  temp_blks_read,
  temp_blks_written,
  left(query, 1200) as query
from pg_stat_statements
where query ilike '%stats_%'
   or query ilike '%analytics_events%'
   or query ilike '%session_first_seen%'
   or query ilike '%account_first_seen%'
order by shared_blks_read desc
limit 50;
```

### 6. Lecturas secuenciales, de índice, bloat indicativo y mantenimiento

```sql
select
  relname as table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
order by seq_tup_read desc
limit 30;
```

### 7. Tamaño de tablas e índices

```sql
select
  c.relname as relation,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_relation_size(c.oid)) as table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) as indexes_size,
  s.n_live_tup,
  s.n_dead_tup
from pg_class c
left join pg_stat_user_tables s on s.relid = c.oid
where c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc
limit 30;
```

### 8. Índices nunca o apenas usados

Diagnóstico; no es instrucción de borrado.

```sql
select
  t.relname as table_name,
  i.relname as index_name,
  s.idx_scan,
  pg_size_pretty(pg_relation_size(i.oid)) as index_size,
  pg_get_indexdef(i.oid) as index_definition
from pg_stat_user_indexes s
join pg_class t on t.oid = s.relid
join pg_class i on i.oid = s.indexrelid
order by s.idx_scan asc, pg_relation_size(i.oid) desc
limit 50;
```

### 9. Índices existentes sobre analytics y cohortes

```sql
select
  t.relname as table_name,
  i.relname as index_name,
  s.idx_scan,
  pg_get_indexdef(i.oid) as index_definition
from pg_stat_user_indexes s
join pg_class t on t.oid = s.relid
join pg_class i on i.oid = s.indexrelid
where t.relname in (
  'analytics_events',
  'session_first_seen',
  'account_first_seen',
  'coach_analyses'
)
order by t.relname, s.idx_scan desc;
```

### 10. Cron real y últimas ejecuciones

```sql
select jobid, jobname, schedule, command, active
from cron.job
order by jobid;

select
  jobid,
  runid,
  status,
  start_time,
  end_time,
  return_message
from cron.job_run_details
order by start_time desc
limit 50;
```

### 11. Volumen reciente de telemetría

```sql
select
  date_trunc('hour', created_at) as hour_utc,
  count(*) as events,
  count(distinct session_id) as sessions,
  count(distinct account_ref) filter (where account_ref is not null) as accounts
from public.analytics_events
where created_at >= now() - interval '48 hours'
group by 1
order by 1 desc;
```

## Precaución operativa

No ejecutar todavía `EXPLAIN (ANALYZE, BUFFERS)` sobre las RPCs: durante un incidente volvería a ejecutar precisamente las agregaciones sospechosas. Primero capturar los contadores anteriores; con esos resultados se puede decidir qué plan concreto inspeccionar sin añadir carga.
