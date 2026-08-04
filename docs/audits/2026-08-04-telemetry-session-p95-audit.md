# Auditoría — el RED de `telemetry_volume`: «p95 session emits 218 events»

**Fecha:** 2026-08-04 · **Corrida de referencia:** `2026-08-04T17:12:54Z`
**Estado:** investigación cerrada. **Sin cambios de código, umbrales, datos ni infraestructura.**

---

## Veredicto en una línea

> **El indicador está mal construido. El sistema no lo está.**
>
> El "p95" del monitor **no es un p95 poblacional**: se calcula sobre el **top 20**
> de sesiones de la última hora, así que devuelve **la 2.ª sesión más ruidosa**.
> El p95 real de la población es **73**. El umbral es 200. No hubo incidente.

---

## 1. Verificación inicial — `pnpm ops:health`

**Corrida `2026-08-04T17:12:54.261Z`** (12:12:54 Bogotá) · **exit 0** ·
**ESTADO: 🟢 GREEN (partial)** — el RED **no se reprodujo** en esta corrida.

| Dato | Valor |
|---|---|
| **p95 (indicador del monitor)** | **no disparó** — por debajo de 200 en esta corrida |
| **p95 real poblacional (1h)** | **77** (medido por SQL, §2) |
| Latencia `play.chesscito.com` | **HTTP 200 · 1.074 ms** |
| Latencia `learn.chesscito.com` | **HTTP 200 · 1.979 ms** |
| Filas de `analytics_events` | **144.530** |
| Ritmo 15m | 1.179 ev · 53 ses · **78,6 ev/min** |
| Ritmo 1h | 4.262 ev · 153 ses · **71,0 ev/min** |
| 5XX | `/api/coach/analyze=1` (play) · ninguno en learn |
| `/api/telemetry` | 10 req · **0 err** |
| eventos/sesión del día | **25,35** (umbral amarillo 35) |

> ⚠️ **Dos observaciones volátiles, no relacionadas con el p95.** Una corrida un
> minuto antes (`17:11:20Z`) reportó `play.chesscito.com · NO RESPONDE — fetch
> failed`, y a los 90 s el mismo dominio respondió 200 en 1.074 ms. Y el 5XX de
> `/api/coach/analyze` apareció en una corrida y no en la anterior. Son eventos
> aislados dentro de una muestra de ~50 requests; **no constituyen un patrón** con
> esta evidencia. Se anotan para que no se lean como parte del hallazgo.

---

## 2. La causa raíz, confirmada

### 2.1 Qué calcula realmente el monitor

Tres hechos del código, encadenados:

```ts
// launch-health-snapshot.ts:419
session_event_counts: supabase.top_sessions_1h.map((s) => s.events),
```

```sql
-- collectors/supabase-sql.ts:202 — la fuente de esos counts
select left(md5(session_id), 12) as session_digest, count(*) as events
from public.analytics_events
where created_at > now() - interval '1 hour'
group by 1 order by 2 desc limit 20        -- ← TOP 20
```

```ts
// classify.ts:86 — percentil de rango más cercano
return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
```

Con **20 valores**: `ceil(0.95 × 20) − 1 = 18` → `sorted[18]` = **el 2.º valor más
grande de un top 20**.

> **"p95 de eventos por sesión" es, literalmente, "la segunda sesión más ruidosa
> de la última hora".** No depende de cuántas sesiones haya: con 150 sesiones o
> con 5.000, el indicador siempre mira las dos peores.

### 2.2 La medición que lo prueba

```
sesiones | p95_real | p99_real | maximo | filas_top20 | p95_del_top20
---------+----------+----------+--------+-------------+---------------
     152 |       77 |      182 |    318 |          20 |           182
```

**`p95_del_top20` = 182 = `p99_real`, exactamente.** El indicador rotulado p95
está midiendo el **p99**. Con ~150 sesiones/hora, dos sesiones por encima de un
valor lo ubican en el percentil ~98,7 — no en el 95.

El **218** del reporte original es el mismo fenómeno en una hora con dos sesiones
algo más largas. Nunca significó "el 5 % de las sesiones emite ≥200 eventos".

---

## 3. Distribución completa — la población real

### 3.1 Percentiles (`percentile_disc`, población entera)

| Ventana | Sesiones | Eventos | Media | p50 | p75 | p90 | **p95** | p99 | Máximo |
|---|---|---|---|---|---|---|---|---|---|
| **últimas 24 h** | 2.411 | 61.310 | 25,43 | 15 | 31 | 54 | **73** | 148 | 592 |
| **hoy UTC** | 1.846 | 46.843 | 25,38 | 15 | 31 | 53 | **73** | 151 | 476 |
| **última 1 h** | 152 | — | — | — | — | — | **77** | 182 | 318 |

**El p95 real es 73.** El umbral rojo es 200. Hay un factor **2,7×** de margen.

### 3.2 Sesiones por encima de cada banda (24 h)

| Umbral | Sesiones | % del total |
|---|---|---|
| ≥ 50 | 280 | 11,613 % |
| ≥ 100 | 53 | 2,198 % |
| ≥ 150 | 24 | 0,995 % |
| **≥ 200** | **19** | **0,788 %** |
| ≥ 500 | 2 | 0,083 % |

Para que el p95 real llegase a 200 haría falta que **el 5 %** de las sesiones
superara ese valor. Hoy lo hace el **0,79 %** — seis veces menos.

---

## 4. Las sesiones ruidosas: legítimas, y **largas** más que intensas

### 4.1 Top 20 (24 h)

| Sesión | Eventos | `event` distintos | Visitas | Dur. (min) | ev/min | País | Contenedor |
|---|---|---|---|---|---|---|---|
| `212cc3ebca` | 592 | 34 | 3 | 112,9 | 5,2 | UG | minipay |
| `70e4f1ae1c` | 526 | 32 | 1 | 49,9 | 10,5 | ID | minipay |
| `28d1a15c9d` | 476 | 30 | 1 | 91,2 | 5,2 | NG | minipay |
| `e2650c13e2` | 466 | 34 | 2 | 78,5 | 5,9 | NL | minipay |
| `11c7399044` | 456 | 31 | 2 | 44,0 | 10,4 | NG | minipay |
| `75265d324e` | 448 | 23 | 2 | 136,2 | 3,3 | ID | minipay |
| `b905cc0a02` | 293 | 46 | 4 | **625,6** | 0,5 | MY | minipay |
| `5f70ac2f08` | 276 | 45 | 4 | **893,2** | 0,3 | NG | minipay |
| `3033e2a54d` | 255 | 32 | **8** | **1.115,1** | 0,2 | NG | minipay |
| `daadbf2881` | 210 | 41 | **7** | **1.264,1** | 0,2 | CO | minipay |

*(Las 20 filas están en la consulta 4+5. `identificada = t` en las 20.)*

**Todas emiten entre 23 y 48 `event_name` distintos.** Un bot, un bucle de render
o un retry emitirían uno o dos nombres repetidos, no cuarenta y ocho. Todas
vienen de **MiniPay**, con países dispersos (UG, ID, NG, NL, BR, MY, SG, CO, CG) y
cuatro versiones de app distintas.

### 4.2 El dato que descarta "sesión desbocada"

| Banda | Sesiones | Duración media | Visitas medias | **ev/min** |
|---|---|---|---|---|
| **≥200 ev** | 19 | **297,9 min** | 2,68 | **1,07** |
| 100–199 | 35 | 154,1 min | 2,26 | 0,85 |
| 50–99 | 227 | 41,8 min | 1,38 | 1,60 |
| **<50 ev** | 2.123 | **6,8 min** | 1,07 | **2,45** |

> **Las sesiones grandes son las MENOS intensas.** Emiten 1,07 ev/min contra 2,45
> de las pequeñas. No hay nada desbocado: son personas que juegan mucho rato, con
> el `session_id` acumulando a lo largo de **varias visitas**.

### 4.3 Distribución por minuto (top 5)

El minuto más cargado de las cinco sesiones más altas es **32 eventos con 18
nombres distintos** (`11c7399044`, 11:07). El resto se mueve entre 11 y 27 eventos
por minuto con 5–18 nombres distintos. `28d1a15c9d` es el caso más nítido: 14
eventos por minuto con **14 nombres distintos** — un evento de cada tipo.

**No hay ningún minuto con un solo evento repetido en masa.**

### 4.4 Eventos dominantes dentro de esas sesiones

| Evento | Eventos | Sesiones | % |
|---|---|---|---|
| `training_exercise_started` | 392 | 7 | 6,3 % |
| `modal_open` | 374 | 20 | 6,0 % |
| `peones_balance_viewed` | 368 | 20 | 5,9 % |
| `labyrinth_complete` | 286 | 7 | 4,6 % |
| `exercise_complete` | 267 | 7 | 4,3 % |

**Ningún evento supera el 6,3 %.** La cola no la produce un evento suelto: es
gameplay repartido. Si un re-render estuviera emitiendo vistas, un solo nombre
dominaría con 40–60 %.

---

## 5. Lo que sí apareció: dos defectos reales, y **ninguno** causa el p95

### 5.1 🟡 Duplicados exactos — 8,6 % de las filas

```
grupos_duplicados | filas_excedentes | peor_grupo
------------------+------------------+------------
             3878 |             5262 |         17
```

**5.262 filas excedentes sobre 61.310 en 24 h = 8,6 %.** Mismo `session_id`, mismo
`event`, **mismo `created_at`**. Las rachas consecutivas lo confirman:

| Sesión | Evento | Racha | Span |
|---|---|---|---|
| `f4ffec8163` | `dock_tap` | 14 | **0,0 s** |
| `5e2cc41be8` | `hub_reward_tile_tap` | 12 | **0,0 s** |
| `af3ae40399` | `score_submit_tx` | 11 | **0,0 s** |
| `fd92f17a40` | `play_hub_arena_tap` | 10 | **0,0 s** |
| `ea2a044440` / `404ccee0ea` | `exercise_fail` | 10 | **0,0 s** |

**Span 0,0 s = emisión múltiple en el mismo tick**, no un usuario tapeando rápido.
`dock_tap` ×14 y `score_submit_tx` ×11 en el mismo instante son un `track()`
disparado varias veces por el mismo handler o un efecto sin guard.

**No explica el p95:** quitar los duplicados bajaría todas las cifras ~8,6 %
uniformemente. El p95 real pasaría de 73 a ~67. El veredicto no cambia.

### 5.2 🟡 El `session_id` no rota entre visitas

```
cruzan_dia | mas_de_6h | mas_de_12h | multi_visita | mas_de_3_visitas | total
-----------+-----------+------------+--------------+------------------+-------
        19 |        28 |         16 |          217 |               20 |  2404
```

**217 sesiones (9 %) tienen más de un `visit_id`**, y las peores acumulan 7–8
visitas a lo largo de 18–21 horas. Es la mecánica por la que una sesión llega a
200+ sin ser intensa (§4.2): no es un pico, es un contador que no se reinicia.

Es una **decisión de modelado**, no un defecto obvio: `visit_id` existe justamente
para distinguir visitas. Pero significa que **"eventos por sesión" mide un lapso
de días, no de una sentada**, y cualquier umbral sobre esa métrica hereda la
ambigüedad.

---

## 6. Hipótesis: todas comprobadas

| Hipótesis | Veredicto | Evidencia |
|---|---|---|
| **Sesión legítima larga** | ✅ **CONFIRMADA — es el driver** | banda ≥200: 298 min de media, 1,07 ev/min (el ritmo MÁS BAJO), 23–48 eventos distintos |
| **`session_id` que no rota** | ✅ **CONFIRMADA — contribuye** | 217 sesiones multi-visita; hasta 8 visitas / 21 h |
| **Varias pestañas compartiendo sesión** | 🔸 indistinguible de lo anterior | `visit_id` múltiple es compatible con ambas; MiniPay es un webview, el caso multi-pestaña es poco probable |
| **Re-render que emite vistas** | ❌ **REFUTADA** | ningún evento supera 6,3 %; minutos con 14–18 nombres distintos |
| **Retries / reenvío de batches** | ❌ **REFUTADA como causa del p95** | los duplicados son 8,6 % uniforme, no concentrados en las sesiones grandes |
| **Duplicados exactos** | ⚠️ **EXISTEN (8,6 %)**, pero no causan el p95 | 5.262 filas; span 0,0 s |
| **Bots** | ❌ **REFUTADA** | anónimas: 48 sesiones, **máximo 6 eventos**. Las 19 sesiones ≥200 son **todas identificadas** |
| **Pruebas internas** | ❌ **REFUTADA** | países dispersos (UG/ID/NG/NL/BR/MY/SG/CO/CG), 4 versiones de app |
| **Una cuenta concentrando** | ❌ **REFUTADA** | la mayor pesa **1,50 %** del total; el top 10 suma <9 % |
| **Un evento específico en la cola** | ❌ **REFUTADA** | el máximo es 6,3 % |

**Identificadas vs anónimas (24 h):**

| Tipo | Sesiones | Eventos | Media | p95 | Máximo | ≥200 |
|---|---|---|---|---|---|---|
| anónima | 48 | 133 | 2,8 | 6 | 6 | **0** |
| identificada | 2.356 | 61.139 | 26,0 | 75 | 592 | 19 |

---

## 7. Impacto sobre Vercel y Supabase

| Sistema | Impacto | Lectura |
|---|---|---|
| **Vercel** | in-scope **29.257 invocaciones** en el ciclo (chesscito 17.150 · lite 12.107); `/api/telemetry` **0 errores** | los duplicados viajan **dentro** del batch (20 ev/request), así que **no multiplican requests**. El costo del 8,6 % es de filas, no de invocaciones |
| **Supabase — filas** | 5.262 filas/día excedentes ≈ **158 K/mes** | sobre 61 K/día es ruido de almacenamiento, no un riesgo |
| **Supabase — disco** | 144.530 filas · 84 MB (32 heap + 52 índices); base 109 MB | los índices pesan **1,6× el heap** — eso sí merece mirada propia, aparte de esta auditoría |
| **Supabase — proyección** | 24 h: 61.164 filas/día → **90 d 3,1 GB**; 15 m: 113.184 → **90 d 5,8 GB** | la ventana de 15 m ya proyecta por encima del amarillo (4 GB). Es ritmo instantáneo, no régimen — pero es lo que hay que vigilar, **no** el p95 |

---

## 8. ¿El umbral de 200 sigue siendo correcto?

**El umbral no es el problema; el estimador sí.** Con la definición actual —
"2.ª sesión más ruidosa de la última hora" — **ningún umbral es correcto**, porque
la magnitud no significa lo que su nombre dice y no escala con el tráfico.

Como **p95 poblacional**, 200 es un umbral razonable y hoy holgado: el valor real
es 73 y sólo el 0,79 % de las sesiones lo cruza. **No moverlo.**

> El diseño original (`spec §8`) definió la regla como *«pocas sesiones generan
> cientos de eventos» → p95 de eventos por sesión ≥ 200 en 24 h*. Nótese
> **«en 24 h»**: la implementación quedó en **1 h** y sobre un **top 20**. La
> intención estaba bien; la implementación se desvió en dos ejes a la vez.

---

## 9. ¿Se requiere kill switch?

**No.** Rotundamente.

- El p95 real (73) está a **2,7×** del umbral.
- `eventos/sesión` del día: **25,35**, contra un amarillo de 35.
- `/api/telemetry`: **0 errores** en ambos proyectos.
- Supabase responde, cero 5XX de gateway, `n_dead_tup = 0`.
- El volumen es **gameplay real de usuarios identificados en MiniPay**.

Activar `NEXT_PUBLIC_TELEMETRY_ENABLED=0` cegaría el funnel completo para
responder a un artefacto de medición. Y ⚠️ **jamás** `NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED=0`,
que sube la carga ~20×.

---

## 10. Recomendación mínima

**Por orden de valor, y ninguna ejecutada en esta sesión.**

### 1️⃣ Corregir el estimador del p95 — *es el hallazgo*

Calcular el percentil **en el servidor, sobre la población entera**, no en el
cliente sobre un top 20:

```sql
select percentile_disc(0.95) within group (order by n)
from (select session_id, count(*) n from public.analytics_events
      where created_at > now() - interval '24 hours' group by 1) s
```

Y alinear la ventana a las **24 h** que pedía el spec. El top 20 sigue siendo útil
para *mirar* sesiones concretas — pero como muestra, **nunca como distribución**.

> Es el mismo error de categoría que el monitor ya evita en otros ejes: derivar un
> estadístico poblacional de una muestra sesgada por construcción. Un top-N está
> ordenado por la variable que se quiere percentilar; su percentil no es el de la
> población, y no converge por más que crezca el tráfico.

### 2️⃣ Investigar los duplicados de span 0,0 s

Empezar por `dock_tap` (×14), `score_submit_tx` (×11), `hub_reward_tile_tap` (×12)
y `play_hub_arena_tap` (×10): mismo instante, mismo handler. Es **8,6 % de filas y
de escrituras** que nadie quiso emitir.

### 3️⃣ Decidir qué significa "sesión"

217 sesiones abarcan varias visitas y hasta 21 h. Mientras `session_id` no rote,
"eventos por sesión" mide un lapso de días. Si la métrica busca *intensidad*,
`visit_id` es el agrupador correcto; si busca *engagement acumulado*, está bien
como está — pero entonces el umbral debería revisarse contra esa definición.

**Nada de esto es urgente.** El sistema está sano; lo que falló fue el instrumento.

---

## 11. Consultas utilizadas

Todas **read-only** (`SELECT`), ejecutadas vía el mismo mecanismo del monitor
(`psql` en contenedor efímero, connection string en env del contenedor y nunca en
`argv`), con un guard que rechaza `insert|update|delete|drop|alter|truncate|
vacuum|reindex|grant|revoke|pg_stat_reset`. Ningún `session_id`, `account_ref` ni
wallet se imprimió en crudo: todo va por `left(md5(...), 10)`.

<details>
<summary><b>1+2 · Percentiles poblacionales</b></summary>

```sql
with s as (
  select session_id, count(*) n, 'last_24h' w from public.analytics_events
  where created_at > now() - interval '24 hours' group by 1
  union all
  select session_id, count(*) n, 'today_utc' from public.analytics_events
  where created_at >= date_trunc('day', now() at time zone 'UTC') group by 1
)
select w as ventana, count(*) as sesiones, sum(n) as eventos,
  round(avg(n),2) as media,
  percentile_disc(0.50) within group (order by n) as p50,
  percentile_disc(0.75) within group (order by n) as p75,
  percentile_disc(0.90) within group (order by n) as p90,
  percentile_disc(0.95) within group (order by n) as p95,
  percentile_disc(0.99) within group (order by n) as p99,
  max(n) as maximo
from s group by w order by w;
```
</details>

<details>
<summary><b>2bis · La consulta que prueba la causa raíz</b></summary>

```sql
with s as (
  select session_id, count(*) n from public.analytics_events
  where created_at > now() - interval '1 hour' group by 1
), pop as (
  select count(*) sesiones,
    percentile_disc(0.95) within group (order by n) p95_real,
    percentile_disc(0.99) within group (order by n) p99_real,
    max(n) maximo from s
), top20 as (select n from s order by n desc limit 20),
t as (
  select count(*) c,
    percentile_disc(0.95) within group (order by n) p95_del_top20
  from top20
)
select pop.sesiones, pop.p95_real, pop.p99_real, pop.maximo,
       t.c as filas_top20, t.p95_del_top20
from pop, t;
```
</details>

<details>
<summary><b>3 · Bandas de umbral</b></summary>

```sql
with s as (select session_id, count(*) n from public.analytics_events
           where created_at > now() - interval '24 hours' group by 1),
tot as (select count(*) c from s)
select b.umbral,
  (select count(*) from s where s.n >= b.umbral) as sesiones,
  round(100.0*(select count(*) from s where s.n >= b.umbral)/tot.c, 3) as pct
from (values (50),(100),(150),(200),(500)) b(umbral), tot order by b.umbral;
```
</details>

<details>
<summary><b>4+5 · Top 20 sesiones con forma</b></summary>

```sql
with s as (
  select session_id, count(*) n, min(created_at) t0, max(created_at) t1,
         count(distinct event) ev_distintos, count(distinct surface) superficies,
         max(container) contenedor, max(locale) loc, max(country) pais,
         max(app_version) ver, count(distinct visit_id) visitas,
         bool_or(account_ref is not null) identificada
  from public.analytics_events
  where created_at > now() - interval '24 hours' group by 1
)
select left(md5(session_id),10) as ses, n as eventos,
  ev_distintos, superficies, visitas, identificada,
  to_char(t0,'HH24:MI:SS') as inicio, to_char(t1,'HH24:MI:SS') as fin,
  round(extract(epoch from (t1-t0))/60.0, 1) as dur_min,
  round(n / greatest(extract(epoch from (t1-t0))/60.0, 0.0167), 1) as ev_por_min,
  contenedor, loc, pais, ver
from s order by n desc limit 20;
```
</details>

<details>
<summary><b>6 · Eventos dominantes en las sesiones ruidosas</b></summary>

```sql
with s as (
  select session_id, count(*) n from public.analytics_events
  where created_at > now() - interval '24 hours'
  group by 1 order by n desc limit 20
)
select e.event, count(*) as eventos,
  count(distinct e.session_id) as sesiones,
  round(100.0*count(*)/sum(count(*)) over (), 1) as pct
from public.analytics_events e join s on s.session_id = e.session_id
where e.created_at > now() - interval '24 hours'
group by 1 order by 2 desc limit 15;
```
</details>

<details>
<summary><b>7 · Distribución por minuto de las 5 sesiones más altas</b></summary>

```sql
with s as (
  select session_id from public.analytics_events
  where created_at > now() - interval '24 hours'
  group by 1 order by count(*) desc limit 5
), m as (
  select left(md5(e.session_id),10) ses, date_trunc('minute', e.created_at) min,
         count(*) n, count(distinct e.event) distintos
  from public.analytics_events e join s on s.session_id=e.session_id
  where e.created_at > now() - interval '24 hours' group by 1,2
), r as (select *, row_number() over (partition by ses order by n desc) rk from m)
select ses, to_char(min,'HH24:MI') minuto, n as eventos_en_ese_minuto, distintos
from r where rk <= 12 order by ses, n desc;
```
</details>

<details>
<summary><b>8a · Duplicados exactos</b></summary>

```sql
select count(*) as grupos_duplicados,
       coalesce(sum(c-1),0) as filas_excedentes,
       coalesce(max(c),0) as peor_grupo
from (
  select session_id, event, created_at, count(*) c
  from public.analytics_events
  where created_at > now() - interval '24 hours'
  group by 1,2,3 having count(*) > 1
) d;
```
</details>

<details>
<summary><b>8b · Rachas consecutivas del mismo evento (gaps &amp; islands)</b></summary>

```sql
with e as (
  select session_id, event, created_at,
    row_number() over (partition by session_id order by created_at)
      - row_number() over (partition by session_id, event order by created_at) grp
  from public.analytics_events where created_at > now() - interval '24 hours'
), r as (
  select left(md5(session_id),10) ses, event, count(*) racha,
         min(created_at) t0, max(created_at) t1
  from e group by session_id, event, grp
)
select ses, event, racha, round(extract(epoch from (t1-t0)),1) as span_seg
from r where racha >= 8 order by racha desc limit 15;
```
</details>

<details>
<summary><b>9 / 9b · Persistencia de sesión y correlación con la banda</b></summary>

```sql
-- 9
with s as (
  select session_id, count(*) n, min(created_at) t0, max(created_at) t1,
         count(distinct date(created_at)) dias, count(distinct visit_id) visitas
  from public.analytics_events
  where created_at > now() - interval '24 hours' group by 1
)
select count(*) filter (where dias > 1) as cruzan_dia,
  count(*) filter (where t1-t0 > interval '6 hours') as mas_de_6h,
  count(*) filter (where t1-t0 > interval '12 hours') as mas_de_12h,
  count(*) filter (where visitas > 1) as multi_visita,
  count(*) filter (where visitas > 3) as mas_de_3_visitas,
  count(*) as total
from s;

-- 9b
with s as (
  select session_id, count(*) n, max(created_at)-min(created_at) dur,
         count(distinct visit_id) visitas
  from public.analytics_events
  where created_at > now() - interval '24 hours' group by 1
)
select case when n >= 200 then 'a) >=200 ev'
            when n >= 100 then 'b) 100-199'
            when n >= 50  then 'c) 50-99'
            else 'd) <50' end as banda,
  count(*) sesiones,
  round(avg(extract(epoch from dur)/60.0),1) as dur_media_min,
  round(avg(visitas),2) as visitas_medias,
  round(avg(n)/greatest(avg(extract(epoch from dur)/60.0),0.1),2) as ev_por_min
from s group by 1 order by 1;
```
</details>

<details>
<summary><b>10 / 10b · Identidad y concentración por cuenta</b></summary>

```sql
-- 10
with s as (
  select session_id, count(*) n, bool_or(account_ref is not null) ident
  from public.analytics_events
  where created_at > now() - interval '24 hours' group by 1
)
select case when ident then 'identificada' else 'anonima' end as tipo,
  count(*) sesiones, sum(n) eventos, round(avg(n),1) media,
  percentile_disc(0.95) within group (order by n) p95,
  max(n) maximo, count(*) filter (where n >= 200) as ses_sobre_200
from s group by 1 order by 1;

-- 10b — account_ref SIEMPRE hasheada
select left(md5(account_ref),10) as cuenta, count(*) eventos,
  count(distinct session_id) sesiones,
  round(100.0*count(*)/sum(count(*)) over (),2) as pct_del_total
from public.analytics_events
where created_at > now() - interval '24 hours' and account_ref is not null
group by 1 order by 2 desc limit 10;
```
</details>
