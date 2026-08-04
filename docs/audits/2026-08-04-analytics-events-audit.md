# Auditoría read-only — `analytics_events` (61 MB) + revalidación de D2.1

**Fecha:** 2026-08-04 · **Contexto:** Supabase recuperada tras Nano → Micro.
**Nada implementado.** Sin DELETE, VACUUM, REINDEX, DROP INDEX, migraciones ni
`pg_stat_reset`.

> ## ⚠️ ACTUALIZADO CON DATOS REALES — leer §0 primero
>
> Las tres consultas se ejecutaron. **Dos conclusiones mías quedaron refutadas** y
> apareció un hallazgo que cambia la prioridad de todo el plan. El diagnóstico vigente
> está en **§0**; el resto del documento queda como registro, con las partes corregidas
> marcadas.

---

## 0. DIAGNÓSTICO FINAL (con datos reales, 2026-08-04)

### 0.1 Lo que estaba bien

| Predicción | Real | |
|---|---|---|
| ~100 K filas | **98.527** | ✅ |
| ~190 B/fila | **208 B** | ✅ |
| 98.527 × 208 B = 19,5 MB | heap **20 MB** | ✅ exacto |
| Índices son aritmética, no bloat | 41 MB / 8 = 5,1 MB c/u = **55 B por entrada** | ✅ |

**El misterio del tamaño está cerrado y no hay nada que reparar ahí.** 98.527 filas × 208 B
explican el heap al 100 %. Los 41 MB de índices son 8 estructuras × 55 B por entrada: el
costo de tener ocho índices, no bloat. `n_live_tup` "95–126" era estadística reseteada por
el cambio Nano → Micro, como estaba diagnosticado.

### 0.2 ❌ CORRECCIÓN: el cron **sí** existe, **sí** está activo y **sí** ejecutó

Escribí que podía no estar agendado ("no hay job y nadie se enteró"). **Es falso, y los
datos lo prueban al minuto:**

```
última corrida agendada (0 3 1 * *) : 2026-08-01 03:00:00 UTC
corte que aplica (now - 90 días)    : 2026-05-03 03:00:00 UTC
fila más antigua viva               : 2026-05-03 03:04:55 UTC
                                       ↑ 4 min 55 s DESPUÉS del corte
```

Una tabla que empieza exactamente 5 minutos después del corte teórico no es coincidencia:
es el `DELETE` habiendo borrado todo lo anterior. **La poda del 1.º de agosto corrió y
funcionó correctamente.** `active = true`, `jobid = 1`.

Respuestas directas:

| Pregunta | Respuesta |
|---|---|
| 3. ¿El cron existe? | **Sí** — `prune_analytics_events_monthly`, jobid 1 |
| 4. ¿Está activo? | **Sí** — `active = true` |
| 5. ¿Ha ejecutado correctamente? | **Sí** — evidencia forense arriba (±5 min del corte exacto) |
| 6. ¿Hay errores de cron? | **Sin verificar** — la consulta falló por un error mío, ver §0.3 |
| 7. ¿La retención está operativa? | **Sí, hoy funciona.** Pero fue dimensionada para un régimen que ya no existe — §0.4 |

### 0.3 Mi consulta de `job_run_details` estaba mal escrita

`ERROR: column "jobname" does not exist` — es un error mío, no del sistema:
`cron.job_run_details` sólo tiene `jobid`. La correcta:

```sql
select d.jobid, d.status, d.start_time, d.end_time, d.return_message
from cron.job_run_details d
where d.jobid = 1
order by d.start_time desc
limit 12;
```

Sigue pendiente y es lo único que falta para cerrar la pregunta 6. Nota: pg_cron sólo
retiene historial reciente, así que puede no haber filas de agosto.

### 0.4 🔴 HALLAZGO NUEVO: 102× de brecha entre eventos emitidos y filas guardadas

Es el dato más importante de toda la auditoría.

```
filas reales      : 98.527 en 93,01 días  →     1.059 filas/día
eventos emitidos  : 54 K invocations /12 h →   108.000 eventos/día
                                              ─────────────
BRECHA                                              102×
```

Un solo día al ritmo observado (108 K) supera **toda la tabla** (98,5 K de 93 días). Es
aritméticamente imposible que esos eventos hayan aterrizado.

**Sólo hay dos explicaciones, y ambas obligan a actuar:**

**(a) Las escrituras venían fallando en silencio.** La ruta traga todo por diseño:

```ts
} catch {
  /* swallow — telemetry must never fail user-visible flows */
}
```

Con el 522 esto es seguro para la ventana del incidente. Si venía de antes, se quemaron
invocations de Vercel produciendo cero datos, y nadie podía enterarse.

**(b) El tráfico se multiplicó ~100× hace muy poco** y el promedio de 93 días lo diluye.

**No puedo distinguirlas sin un histograma diario** (§4). Pero la consecuencia es la misma
y es la que manda:

### 0.5 La retención de 90 días fue dimensionada para un camino de escritura roto

**Fase 1 arregló el camino de escritura.** Batching + bulk insert + menos carga = las
escrituras que antes fallaban ahora aterrizan. Si el volumen real de eventos es 108 K/día:

| Régimen | Filas/día | 90 días | Heap + índices |
|---|---|---|---|
| **Observado hasta hoy** | 1.059 | 95 K | **61 MB** ← estable |
| **Si el 100 % aterriza** | 108.000 | **9,7 M** | **~6 GB** |
| Sólo 30 días, si el 100 % aterriza | 108.000 | 3,2 M | ~2 GB |

El disco de una instancia Micro son 8 GB. **Una ventana de 90 días a volumen real se lo
come.**

> La conclusión operativa cambia de raíz. No hay que "arreglar el cron": hay que
> **redimensionar la retención antes de que el volumen real la alcance**, y hay que saber
> en qué régimen estamos. La tabla estuvo cómoda en 20 MB porque la mayoría de las
> escrituras no llegaba.

### 0.6 Riesgo inmediato: el `DELETE` mensual a volumen real

A 108 K filas/día, la poda del **1.º de septiembre** borraría **~3,2 millones de filas en
una sola transacción**: WAL enorme, lock prolongado y una deuda de autovacuum que en Micro
duele. Hoy borra ~32 K y pasa desapercibido.

**Ese es el problema a atacar primero** — antes que el rollup, antes que los índices, y
sin borrar nada a mano.

### 0.7 Decisiones sobre tus cinco opciones

| Opción | Veredicto |
|---|---|
| Activar el cron existente | **NO corresponde** — ya está activo y probado |
| Repararlo | **NO corresponde** — funciona correctamente |
| **Cambiar mensual → diario** | **SÍ — es el primer cambio.** Único que ataca §0.6, reversible, sin pérdida de datos |
| **Mantener 90 días temporalmente** | **SÍ** — no acortar hasta tener rollup (§5.3) y saber el régimen (§4) |
| **Diseñar primero el rollup** | **SÍ** — requisito para cualquier recorte de ventana |

---

## 1. Por qué 61 MB con "~126 filas"

**No hay 126 filas.** Ese número es una estimación reseteada, y toda la evidencia que
diste apunta al mismo origen.

### La aritmética descarta la lectura literal

| Hipótesis | Bytes por fila | Veredicto |
|---|---|---|
| 19 MB heap / 126 filas | **~158 KB** | **imposible**: `props` está capado a 4 KB y la fila son ~15 columnas de texto cortas |
| 19 MB heap / ~100 K filas | **~190 bytes** | exactamente lo esperable para esta fila |

### Los cuatro contadores se resetearon JUNTOS

`n_live_tup`, `n_dead_tup`, `last_autovacuum`, `last_autoanalyze` e `idx_scan` viven todos
en `pg_stat_all_tables` / `pg_stat_user_indexes`. Que aparezcan **simultáneamente** en
95–126 / 0 / null / null / 0 no describe una tabla vacía: describe **contadores puestos a
cero hace minutos**. El cambio de plan Nano → Micro reprovisiona el compute, y las
estadísticas acumuladas no sobreviven.

Leído así, todo encaja sin contradicción:

- `n_live_tup` 95–126 = filas insertadas **desde el resize** (minutos de telemetría a
  ritmo post-Fase-1);
- `n_dead_tup` 0 = ningún DELETE desde el resize;
- `last_autovacuum` null = autovacuum no corrió **desde el resize**;
- `idx_scan` 0 = ninguna lectura **desde el resize**.

Con la lectura contraria ("la tabla tiene 126 filas") habría que explicar cómo 126 filas
ocupan 19 MB de heap y 41 MB de índices. No hay explicación.

### Los 41 MB de índices son aritmética, no bloat

Ocho índices, todos con `created_at desc` como segunda columna. Cada entrada pesa ~40–50 B
(clave + TID de 6 B + puntero). Para ~100 K filas:

```
100.000 filas × ~45 B × 8 índices ≈ 36 MB   (+ overhead de página ≈ 41 MB)
```

Que los índices pesen **más del doble** que el heap no es anomalía: la fila son ~190 B y
las ocho entradas de índice suman ~360 B. **Es el costo de tener ocho índices, no bloat.**
`n_dead_tup = 0` además no da evidencia de bloat de heap — aunque tampoco la descarta,
porque el contador se reseteó.

### Causa raíz del tamaño

**Volumen histórico de escritura, no diseño de fila.** Antes de Fase 1 la telemetría hacía
1 request = 1 fila: ~54 K filas/12 h sólo en CHESSCITO. 19 MB de heap ≈ 100 K filas ≈
**un día** de ese ritmo. Post-Fase-1 el ritmo cayó ~94 %.

### ⚠️ Sobre `idx_scan = 0`

**No concluyo que ningún índice sea inútil a partir de eso.** El contador se reseteó con
el cambio de plan; mide "escaneos desde hace minutos", no "escaneos históricos". La
evidencia que uso en §6 es **el código de los lectores**, no `idx_scan`.

---

## 2. Conteo exacto y rango temporal — **NO OBSERVABLE por mis herramientas**

No tengo `psql` (el host directo es IPv6-only; el pooler requiere credenciales que no voy
a pedir para esto) y no hay endpoint que exponga un `COUNT(*)` crudo. Las tres consultas
seguras — sólo lectura, sin `pg_stat_reset` — son:

```sql
-- 1. Conteo exacto y ventana real
select count(*)                    as filas,
       min(created_at)             as mas_antigua,
       max(created_at)             as mas_reciente,
       now() - min(created_at)     as antiguedad
from analytics_events;

-- 2. Tamaño medio real de fila (confirma o refuta los ~190 B)
select pg_size_pretty(pg_relation_size('analytics_events'))            as heap,
       pg_size_pretty(pg_indexes_size('analytics_events'))             as indices,
       pg_relation_size('analytics_events') / nullif(count(*),0)       as bytes_por_fila
from analytics_events;

-- 3. ¿El cron de retención existe y está corriendo?
select jobid, jobname, schedule, active from cron.job;
select jobid, status, start_time, end_time
from cron.job_run_details
where jobname = 'prune_analytics_events_monthly'
order by start_time desc limit 12;
```

La consulta 3 es la que más importa: decide si §5 es "activar" o "ya está".

---

## 3. Inventario de eventos

**258 call sites de `track()`.** Los que dominan el volumen no son los más numerosos en
código, sino los que disparan **por render o por visita**:

| Clase | Ejemplos | Frecuencia |
|---|---|---|
| **Por visita** | `app_opened` | 1/visita (guard en sessionStorage) |
| **Por montaje de pantalla** | `hub_view`, `play_hub_view`, `arena_select_view`, `splash_view`, `hub_tour_view` | **1 por cada entrada a la pantalla** — dominante |
| **Por impresión de componente** | `monetization.pro_chip_view`, `pro_sheet_view`, `shop_item_view` (**uno por ítem**), `coach_history_unanalyzed_view` | alto; `shop_item_view` multiplica por catálogo |
| **Por paso de flujo** | `tx_progress_view`, `tx_progress_step`, `tx_progress_step_duration` | varios por transacción |
| **Por acción** | `share_tile_tap` (14 sitios), `shop_buy_tx` (10), `badge_claim_tx` (9), `modal_open` (9) | bajo por usuario |

La estimación original (~25–45 eventos por visita) se sostiene: el peso está en
`*_view` y en `tx_progress_*`, no en los taps.

**Dato que cambia el pronóstico:** con Fase 1 el número de **filas** no bajó — bajaron los
requests. Cada evento sigue siendo una fila. Para reducir filas hay que tocar qué se emite
(fuera del alcance de esta auditoría).

---

## 4. Inventario de índices y consumidores

### Los ocho

| # | Índice | Migración | Fecha |
|---|---|---|---|
| 1 | `analytics_events_pkey (id)` | `20260424000000_analytics_events` | 2026-04-24 |
| 2 | `idx_analytics_events_created_at (created_at desc)` | idem | 2026-04-24 |
| 3 | `idx_analytics_events_session (session_id, created_at desc)` | idem | 2026-04-24 |
| 4 | `idx_analytics_events_event (event, created_at desc)` | idem | 2026-04-24 |
| 5 | `idx_analytics_events_surface (surface, created_at desc)` | `20260723040000_analytics_dimensions` | 2026-07-23 |
| 6 | `idx_analytics_events_container (container, created_at desc)` | idem | 2026-07-23 |
| 7 | `idx_analytics_events_country (country, created_at desc)` | idem | 2026-07-23 |
| 8 | `idx_analytics_events_account_ref (account_ref, created_at desc)` | `20260725000000_account_level_identity` | 2026-07-25 |

### Todos los lectores

| Consumidor | Archivo | Filtra por |
|---|---|---|
| Stats públicas — sesiones activas 7 d / 30 d | `lib/stats/public-aggregator.ts:511,523` | `created_at` |
| Stats públicas — challenge events | `:614` | `event IN (…)`, `created_at` |
| Stats públicas — funnel / retención | `:641` | `created_at` *(selecciona `country` y `account_ref`, **no filtra** por ellos)* |
| Stats públicas — accesos | `:687` | `event IN (…)`, `created_at` |
| Admin — Lite stats | `api/admin/lite-stats/route.ts:119` | `event IN (…)`, `created_at` |
| Escritor | `api/telemetry/route.ts:277` | — (INSERT) |
| Cron de poda | `prune_analytics_events()` | `created_at` |

**Sin dashboards externos, sin exports, sin RPC de lectura, sin otros crons.**

### La evidencia central

Barrido de **todos** los filtros aplicados a la tabla en el código:

| Columna | Nº de filtros (`.eq/.in/.gte/.lt/…`) |
|---|---|
| `created_at` | **7** |
| `event` | **3** |
| `session_id` | **0** |
| `surface` | **0** |
| `container` | **0** |
| `country` | **0** |
| `account_ref` | **0** |

**Cinco de los ocho índices no tienen ni una consulta que filtre por su columna líder.**
Esto sale del código, no de `idx_scan`.

---

## 5. Retención recomendada

**Ya existe y está escrita** — `20260424010000_analytics_cleanup.sql`:

```sql
create or replace function prune_analytics_events() ...
  delete from analytics_events where created_at < now() - interval '90 days';
```

agendada como `prune_analytics_events_monthly` (`0 3 1 * *`) en
`20260424050843_schedule_analytics_cron.sql`.

> ❌ **CORREGIDO (§0.2):** acá especulé que el job podía no estar agendado, porque la
> migración se auto-omite si falta `pg_cron`. **Los datos lo refutan:** el job existe
> (`jobid 1`), está `active`, y la fila más antigua cae 5 minutos después del corte
> teórico del 1.º de agosto — o sea, corrió y funcionó. La guarda de la migración es
> correcta y no se disparó.

### Ajustes recomendados (a decidir, no implementados)

1. **Frecuencia mensual → diaria. AHORA ES EL PUNTO 1 POR MÉRITO PROPIO** (§0.6): a
   volumen real, la poda de septiembre borraría ~3,2 M de filas en una transacción.
   Diaria borra un día por corrida.
2. **Ventana de 90 días → 30–45.** Ningún lector mira más allá de **30 días**
   (`since30d` es el horizonte máximo en `public-aggregator`). Los 90 conservan 60 que
   nadie consulta. **Bloqueado por el punto 3.**
3. **Rollup antes de expirar.** La propia migración lo advierte (*"anything useful about
   pre-90d user behavior should be rolled up … (not implemented yet)"*). Sin rollup,
   acortar la ventana **pierde historia de forma irreversible**.
4. **Nunca `VACUUM FULL`** para recuperar espacio: toma `ACCESS EXCLUSIVE` y bloquea las
   escrituras de telemetría. Con poda diaria, el autovacuum normal alcanza.

---

## 5bis. PLAN MÍNIMO Y REVERSIBLE

Ordenado por riesgo que elimina, no por esfuerzo. **Nada implementado.**

| # | Commit | Qué hace | Reversión |
|---|---|---|---|
| **1** | `perf(db): poda diaria de analytics_events` | `cron.schedule` de `0 3 1 * *` → `0 3 * * *`. **Misma función, mismos 90 días, cero borrado extra.** Sólo cambia el ritmo | reagendar `0 3 1 * *` — una línea |
| **2** | *(sin commit)* histograma diario + `job_run_details` | Determina el régimen (§0.4) y cierra la pregunta 6 | — |
| **3** | `feat(db): rollup diario de analytics_events` | Tabla de agregados; nada se borra | `drop table` |
| **4** | `perf(db): ventana 90 → 45 días` | Sólo tras 3, y con el régimen conocido | volver a 90; **lo borrado no vuelve** |
| **5** | `perf(db): retirar índices sin lectores` | Uno por commit, con `idx_scan` de ≥7 días | `create index concurrently` |
| **6** | `refactor(telemetry): recortar eventos por impresión` | Lo único que baja **filas**, no requests | revertir |

### Primera migración recomendada

**Sólo el paso 1.** Es el único cambio que ataca un riesgo con fecha (1.º de septiembre),
y es el más barato de revertir de todo el plan.

Forma esperada — **no aplicada**, y respeta la guarda de `pg_cron` de la migración
original:

```sql
-- 2026080X000000_analytics_prune_daily.sql
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron not available — skipping.';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'prune_analytics_events_monthly') then
    perform cron.unschedule('prune_analytics_events_monthly');
  end if;

  perform cron.schedule(
    'prune_analytics_events_daily',
    '0 3 * * *',
    $sql$ select prune_analytics_events(); $sql$
  );
end;
$$;
```

Lo que **no** hace, a propósito: no toca `prune_analytics_events()`, no cambia los 90
días, no borra nada a mano, no toca índices ni esquema. Su primer efecto observable es una
corrida que borra ~1 día en vez de esperar al 1.º de septiembre.

---

## 6. Índices candidatos, con evidencia

**Ninguna acción sin antes tener `idx_scan` de una ventana representativa post-reset.** Lo
que sigue es el análisis, no una recomendación de ejecutar hoy.

| Índice | Evidencia | Propuesta |
|---|---|---|
| `analytics_events_pkey` | PK, garantiza unicidad | **conservar** — no es opcional |
| `idx_analytics_events_created_at` | 7 filtros + todo `order by created_at` + lo usa el DELETE de la poda | **conservar** — el más justificado |
| `idx_analytics_events_event` | 3 filtros `event IN (…)`, siempre con `created_at` | **conservar** |
| `idx_analytics_events_session` | **0 filtros por `session_id`.** Los lectores lo *seleccionan* para contar distintos, nunca lo filtran; un `count(distinct)` sobre un rango de fechas no lo usa | **candidato a retiro** |
| `idx_analytics_events_surface` | **0 filtros.** Creado 2026-07-23 "por si acaso" | **candidato a retiro** |
| `idx_analytics_events_container` | **0 filtros** | **candidato a retiro** |
| `idx_analytics_events_country` | **0 filtros.** Se selecciona en `:641`, no se filtra | **candidato a retiro** |
| `idx_analytics_events_account_ref` | **0 filtros.** Creado 2026-07-25 | **candidato a parcial** — si algún día se filtra, será sobre filas con wallet, que son minoría: `where account_ref is not null` |

**Impacto potencial:** retirar los 4 sin uso libera ~**20 MB de los 41 MB** de índices y
acelera cada INSERT (hoy son 8 escrituras de índice por fila).

**Alternativa a evaluar antes de retirar:** convertir `(col, created_at desc)` en índices
parciales `where created_at > now() - interval '45 days'` no funciona — `now()` no es
inmutable y Postgres lo rechaza en un predicado de índice. La vía real es la poda (§5),
que reduce todos los índices a la vez.

---

## 7. Plan reversible por commits

Cada paso es observable y revertible por separado. **Nada de esto está hecho.**

| # | Commit | Reversión |
|---|---|---|
| **0** | *(ninguno)* — correr las 3 consultas de §2. Decide todo lo demás | — |
| **1** | `chore(db): activar/verificar el cron de poda` — habilitar `pg_cron` si falta y confirmar el job. Sin cambio de código | `cron.unschedule` |
| **2** | `feat(db): rollup de agregados antes de expirar` — tabla de agregados diarios. **Antes** de acortar la ventana | tabla nueva; `drop table` |
| **3** | `perf(db): poda diaria en vez de mensual` — mismo DELETE, `0 3 * * *` | reagendar `0 3 1 * *` |
| **4** | `perf(db): ventana 90 d → 45 d` — sólo tras el paso 2 | volver a 90; **lo borrado no vuelve** |
| **5** | `perf(db): retirar índices sin lectores` — 4 `drop index`, uno por commit, con `idx_scan` medido en medio | `create index concurrently` (mismas definiciones, en las migraciones citadas) |
| **6** | `refactor(telemetry): recortar eventos por impresión` — lo único que baja el número de **filas** | revertir el commit |

**Orden no negociable: 2 antes que 4.** Acortar la ventana sin rollup pierde historia sin
vuelta atrás.

---

## 8. Riesgos

0. 🔴 **El disco a 90 días con volumen real (§0.5).** Si el 100 % de los eventos aterriza,
   la ventana actual proyecta ~6 GB contra los 8 GB de una Micro. Es el riesgo con fecha:
   la poda del **1.º de septiembre** llega antes que cualquier otro de esta lista.
1. **Retirar un índice por `idx_scan = 0` recién reseteado** — el error explícito que
   pediste evitar. Los contadores tienen minutos de vida. Mi evidencia es el código; aun
   así, medir antes de tocar.
2. **Un consumidor fuera del repo.** Busqué en `apps/`, `scripts/`, `tools/` y `supabase/`:
   no hay dashboards externos, exports ni RPC. Pero una consulta manual desde el panel de
   Supabase no deja rastro en el código — si alguien filtra por `country` desde el editor
   SQL, el índice sí sirve y yo no lo veo.
3. **`VACUUM FULL` bloquea escrituras.** Si el objetivo fuera recuperar espacio ya
   liberado, `pg_repack` o la poda incremental; nunca `VACUUM FULL` en horario activo.
4. **La poda mensual concentra el daño.** Si el cron está activo con ventana de 90 días, el
   1.º de cada mes hay un pico de DELETE + autovacuum — riesgoso en Micro.
5. **Fase 1 redujo requests, no filas.** El crecimiento sigue siendo ~1 fila por evento.
   Sin el paso 6, la tabla vuelve a crecer.
6. **`props jsonb` sin cota histórica.** El cap de 4 KB llegó con Fase 1 (ayer). Filas
   anteriores pueden ser mayores y explicar heap por encima de lo estimado.

---

## 9. Medición posterior requerida

> **Actualizado:** las 3 consultas de §2 ya se ejecutaron (§0). Lo que sigue vigente:

### Lo que falta medir, en orden

**A. Histograma diario — decide el régimen (§0.4). Es lo primero.**

```sql
select date_trunc('day', created_at)::date as dia, count(*) as filas
from analytics_events
group by 1 order by 1 desc limit 30;
```

- Plano en ~1.000/día → el tráfico creció de golpe y hay que redimensionar ya.
- Escalón reciente hacia decenas de miles → **las escrituras venían fallando** y Fase 1
  las destapó. Mismo plan, urgencia mayor.

**B. Historial del cron — cierra la pregunta 6.**

```sql
select d.jobid, d.status, d.start_time, d.end_time, d.return_message
from cron.job_run_details d
where d.jobid = 1 order by d.start_time desc limit 12;
```

**C. Filas/día durante 7 días post-paso-1** — proyecta el tamaño a 90 días y decide si el
paso 4 es urgente o puede esperar.

### Tabla original (sigue vigente)

| Qué | Cuándo | Por qué |
|---|---|---|
| `idx_scan` de `pg_stat_user_indexes` | tras **7 días** de tráfico normal | única base válida para el paso 5 |
| `pg_stat_statements` sobre `analytics_events` | 7 días | qué consulta de verdad, incluidas las manuales del panel |
| `n_dead_tup` + `last_autovacuum` | tras la primera poda | confirmar que autovacuum sigue el ritmo |
| Tamaño de heap e índices | semanal, 4 semanas | curva de crecimiento post-Fase-1 |

---

# Revalidación de D2.1 — **VERIFICADO** ✅

Lo que en la validación anterior quedó *"sin muestra concluyente"* (porque el 522 hacía
indistinguible "el gate funciona" de "todo está caído") ahora se puede medir.

## Wallet recurrente ⇒ cero escrituras

Seis lecturas consecutivas (3 en play, 3 en lite) de una wallet ya sembrada:

```
pares (balance, lastEventAt) distintos observados en 6 lecturas:
   (1, '2026-08-04T03:17:26.685451+00:00')
```

**Un único estado en las seis.** `lastEventAt` es `max(created_at)` del ledger para esa
wallet: si cualquiera de las seis lecturas hubiera insertado, avanzaría. **No se movió ni
un microsegundo ⇒ cero filas nuevas.** Es prueba directa desde el contrato HTTP, sin
depender del panel de Supabase.

Y `balance` se mantuvo en **1**, nunca 2: **sin doble otorgamiento**.

| Requisito | Estado |
|---|---|
| Wallet recurrente no provoca POST a `peones_ledger` | **VERIFICADO** — `lastEventAt` congelado en 6 lecturas |
| La sonda responde desde el índice único | **VERIFICADO indirectamente** — 200 en 0.50–0.87 s, con sonda + RPC + vista en cada request |
| Ningún retry | **VERIFICADO** — 1 log por request; las entradas duplicadas son del API de logs (mismo `requestId` **y** mismo `id`) |
| Máximo un seed por wallet nueva | **VERIFICADO** — ver abajo |

## La sonda de tres valores hizo exactamente lo diseñado

Tras la recuperación aparecieron **3 `peones_welcome_pack_seeded`** (6 entradas = doble
logueo), **3 wallets distintas, ninguna sembrada dos veces**.

No es un defecto: es el **otorgamiento diferido** funcionando. Durante el 522 la sonda
devolvía `"unknown"`, la ruta **no** escribía, y el pack quedaba pendiente. Con la base
viva, la sonda respondió `false` y el pack se otorgó — una sola vez cada uno.

**La confirmación más fuerte:** el hash `40d2923c2bb74db5` aparece en los `rpc_failed` de
**durante** el incidente y en un `peones_welcome_pack_seeded` de **después**. Misma wallet:
se le negó el intento de escritura durante la caída y recibió su pack exactamente una vez
al volver. Eso es el comportamiento documentado, observado end-to-end en producción.

**Privacidad:** **0 wallets crudas** en los logs de la ventana. `peones_welcome_pack_seeded`
emite `wallet_hash` de 16 hex.
