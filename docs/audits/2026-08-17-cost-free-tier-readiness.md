# Chesscito — Mapa de costo y aptitud para free tier

**Fecha:** 2026-08-17 · **Tipo:** auditoría de **sólo lectura**. Cero código, cero migraciones,
cero cambios de plan, cero índices tocados, cero borrado, cero deploy.
**Fuentes:** `pnpm ops:query` contra producción · `vercel env/ls` · docs oficiales verificadas
hoy · `docs/audits/2026-08-03-vercel-invocations-audit.md`.

Etiquetas: **[FACT]** · **[INFERENCE]** · **[UNKNOWN]**

---

## 0. El titular, y no es un número

⛔ **El plan Hobby de Vercel prohíbe el uso comercial.** Textual, verificado hoy en
`vercel.com/docs/plans/hobby`:

> *"the Hobby plan restricts users to non-commercial, personal use only."*

Chesscito **cobra**: PRO a $1,99, packs de Peones, Season Pass y mints de victoria. **Eso es
uso comercial.** El análisis numérico de Vercel que sigue existe para saber *cuánto* consumimos
— pero **la aptitud para Hobby no se decide por consumo, y el consumo es cómodo.** Bajar a
Hobby sería una violación de términos, no una optimización.

**[FACT] En Supabase la historia es la opuesta:** cabemos hoy, y hay una reducción segura y
grande disponible. **El 81,9% de la base es analítica, y sus ÍNDICES (91,7 MB) pesan más que
sus datos (70,0 MB).**

---

## PARTE G — Mapa de costo de la analítica

**[FACT]** Filas totales W2 (08-10→08-16): **45.324**. Últimas 24 h: ~5.700.

| Evento | Lanzamiento (W1) | W2 | Últimas 24 h | por sesión (W2) | % de W2 | Clasificación |
|---|---:|---:|---:|---:|---:|---|
| `peones_balance_viewed` | 18.168 | 3.939 | 526 | 3,4 | **8,7%** | `AGGREGATE_IS_ENOUGH` |
| `play_hub_view` | 12.731 | 2.578 | 345 | 3,4 | 5,7% | `AGGREGATE_IS_ENOUGH` |
| `app_opened` | 8.230 | 1.600 | 203 | 1,3 | 3,5% | `OPERATIONAL_METRIC` |
| `arena_select_view` | 6.389 | 1.531 | 193 | 3,0 | 3,4% | `AGGREGATE_IS_ENOUGH` |
| `arena_coach_signal_viewed` | 6.382 | 1.518 | 193 | 3,0 | 3,3% | `AGGREGATE_IS_ENOUGH` |
| `modal_open` | 5.726 | 1.338 | 183 | 3,4 | 3,0% | `AGGREGATE_IS_ENOUGH` |
| `training_exercise_started` | 6.203 | 1.141 | 166 | 7,7 | 2,5% | **`KEEP_RAW_HOT`** |
| `arena_game_start` | 4.862 | 1.127 | 144 | 2,4 | 2,5% | **`KEEP_RAW_HOT`** |
| `arena_start_tap` | 4.862 | 1.127 | 144 | 2,4 | 2,5% | ⚠️ **duplicado** |
| `arena_mount` | 4.512 | 1.043 | 148 | 2,1 | 2,3% | `AGGREGATE_IS_ENOUGH` |
| `arena_fresh_reset_fired` | 4.504 | 1.035 | 148 | 2,1 | 2,3% | `OPERATIONAL_METRIC` |
| `hub_tour_view` | 6.744 | 1.033 | 141 | 1,0 | 2,3% | `AGGREGATE_IS_ENOUGH` |
| `tx_progress_view` | 4.098 | 1.024 | 136 | 2,9 | 2,3% | `OPERATIONAL_METRIC` |
| `hub_tour_finish` | 6.415 | 996 | 135 | 1,0 | 2,2% | `AGGREGATE_IS_ENOUGH` |
| `exercise_complete` | 3.709 | 852 | 152 | 7,8 | 1,9% | **`KEEP_RAW_HOT`** |
| `score_save_failed` | 586 | **844** | **7** | **22,2** | 1,9% | ⚠️ **`UNKNOWN`** |
| `training_exercise_completed` | 3.647 | 813 | 138 | 7,5 | 1,8% | **`KEEP_RAW_HOT`** |

### G.1 Lo que la tabla delata

⛔ **[FACT] `arena_game_start` y `arena_start_tap` tienen conteos IDÉNTICOS en las dos
ventanas** — 4.862/4.862 y 1.127/1.127. Son **dos eventos para un mismo instante**. Uno de los
dos es peso puro.

⚠️ **[FACT] `score_save_failed` es una anomalía sin explicar:** 586 en el lanzamiento → **844
en W2** (creció mientras la población caía 82%) → **7 en las últimas 24 h**. Y **22,2 por
sesión**, el ratio más alto del sistema. **[UNKNOWN]**: subió, dominó, y se apagó. No lo
clasifico hasta saber qué fue.

⚠️ **[FACT] `peones_balance_viewed` es el evento más caro del sistema (8,7%) y lo dispara el
render**, no una decisión: lo tocan el 99,7% de los wallets. Como métrica de producto vale
cero; como volumen es el número uno.

**[FACT] La cola es larga:** el evento más caro es el 8,7%. **No hay un culpable único** — no
existe "apagar un evento" que resuelva el costo.

⚠️ **`app_opened` (10.341 filas históricas) tiene `account_ref` en sólo 8 wallets** y
`hub_tour_view` en 55: se emiten antes de conocer la wallet. Son **operacionales**, no
analíticas de producto.

---

## PARTE H — Mapa físico de Supabase

**[FACT] Tamaño de la base: 197 MB.**

| Tabla | Filas (est.) | Heap MB | Índices MB | Total MB | % base | ¿Crítica en runtime? | Categoría |
|---|---:|---:|---:|---:|---:|---|---|
| **`analytics_events`** | 277.824 | **70,0** | **91,7** | **161,7** | **81,9%** | No | `PRODUCT_ANALYTICS` |
| `peones_ledger` | 7.889 | 2,4 | 5,0 | 7,5 | 3,8% | **Sí** | `PRODUCT_STATE` |
| `score_attempts` | 9.208 | 2,5 | 4,7 | 7,3 | 3,7% | **Sí** | `PRODUCT_STATE` |
| `score_saves` | 4.895 | 1,3 | 1,5 | 2,8 | 1,4% | **Sí** | `PRODUCT_STATE` |
| `session_first_seen` | 7.583 | 0,8 | 0,6 | 1,4 | 0,7% | No | `PRODUCT_ANALYTICS` |
| `account_first_seen` | 5.951 | 0,6 | 0,7 | 1,3 | 0,6% | No | `PRODUCT_ANALYTICS` |
| `score_write_sessions` | 1.498 | 0,3 | 0,5 | 0,8 | 0,4% | **Sí** | `PRODUCT_STATE` |
| `welcome_pack_claims` | 576 | 0,4 | 0,2 | 0,6 | 0,3% | **Sí** | `PRODUCT_STATE` |
| `victories` | 395 | 0,1 | 0,2 | 0,3 | 0,2% | **Sí** | `DERIVED` *(on-chain manda)* |
| Resto (15 tablas) | — | — | — | ~1,2 | 0,6% | mixto | mixto |

### Respuestas exigidas

- **CURRENT DB SIZE:** **197 MB** *(límite free: 500 MB → 39,4% usado)*
- **PRODUCT-STATE SIZE:** **~19,5 MB** (9,9%)
- **ANALYTICS SIZE:** **164,4 MB** (83,5%) — `analytics_events` + `*_first_seen`
- **ANALYTICS INDEX SIZE:** **91,7 MB** (46,5% de la base entera)
- **OTHER SIZE:** **~13,1 MB** (6,6%)

⛔ **"Base menos analítica" NO es estado de producto, y se verificó:** la suma de las 24 tablas
da ~184,8 MB contra 197 MB de base. **Faltan ~12 MB** que son catálogos del sistema, TOAST y
otros esquemas. Restar habría inflado el estado de producto un 60%.

### H.1 Los índices de `analytics_events` — el hallazgo más grande [FACT]

| Índice | MB | Scans | Lectura |
|---|---:|---:|---|
| `idx_..._event` | **22,9** | **432** | El más grande, casi sin usar |
| `idx_..._account_ref` | 11,8 | **385.070** | Caliente |
| `idx_..._session` | 11,4 | **675.584** | El más caliente |
| `analytics_events_pkey` | 11,3 | **0** | Cero scans |
| `idx_..._container` | 8,9 | 225 | Casi sin usar |
| `idx_..._surface` | 8,8 | 156 | Casi sin usar |
| `idx_..._country` | 8,7 | **12** | Prácticamente muerto |
| `idx_..._created_at` | 7,8 | 3.171 | Usado |

⛔ **[FACT] 60,6 MB en índices con ≤432 scans — el 30,8% de la base entera.**
**[INFERENCE]** Es la reducción más grande y barata disponible.

⚠️ **Tres cautelas antes de que alguien los borre:**
1. `idx_scan` **se reinicia** con la instancia. Un número bajo puede ser una ventana corta.
2. `analytics_events_pkey` con 0 scans **no es inútil**: sostiene identidad y unicidad.
3. Los de baja cardinalidad (`container`, `surface`, `country`) pueden servir a un plan que
   sólo corre en consultas raras — como las de esta pasada.
   ⛔ **Nada de esto se toca en esta auditoría.**

---

## PARTE I — Simulación de ventana caliente

**[FACT] Base:** 297.519 filas · heap 70,0 MB · índices 91,7 MB · **570 bytes/fila** en total
(247 B heap + 323 B índice). `props` promedia **89 bytes**.

| Retención | Filas quedan | Filas salen | % sale | Heap est. | Índice est. | Total est. | **Base resultante** |
|---|---:|---:|---:|---:|---:|---:|---:|
| **24 h** | 6.092 | 291.427 | **98,0%** | 1,4 MB | 1,9 MB | 3,3 MB | **~38,6 MB** |
| **72 h** | 18.860 | 278.659 | 93,7% | 4,4 MB | 6,0 MB | 10,4 MB | **~45,7 MB** |
| **7 d** | 44.416 | 253.103 | 85,1% | 10,5 MB | 14,0 MB | 24,5 MB | **~59,8 MB** |
| **14 d** | 199.524 | 97.995 | 32,9% | 47,0 MB | 62,9 MB | 109,9 MB | **~145,2 MB** |

⚠️ **El salto 7 d → 14 d (44 k → 199 k) no es un error:** 14 días alcanzan el pico de
lanzamiento del 08-04..08-09. **El 62% de toda la analítica histórica son esos seis días.**

### ⛔ DATO LÓGICO ELIMINADO ≠ DISCO RECUPERADO

**[FACT] Un `DELETE` en Postgres no devuelve un solo byte al disco.** Marca las tuplas
muertas; el espacio queda **reutilizable por esa misma tabla** y `pg_database_size` **no baja**.

Lo que haría falta de verdad:

| Vía | Devuelve disco | Costo |
|---|---|---|
| `DELETE` + autovacuum | ❌ **No** | Sólo habilita reúso interno |
| `VACUUM FULL` | ✅ Sí | ⛔ **ACCESS EXCLUSIVE**: la tabla queda ilegible, y necesita ~2× su tamaño libre |
| `pg_repack` | ✅ Sí | Sin lock largo, pero **es una extensión** — [UNKNOWN] si está disponible |
| `TRUNCATE` de partición | ✅ Sí | Exige particionar primero, que hoy no lo está |
| Tabla nueva + swap | ✅ Sí | Ventana de escritura |

**[INFERENCE] La forma correcta no es borrar: es particionar por tiempo y soltar particiones.**
`TRUNCATE`/`DROP` de una partición sí devuelve disco, sin `VACUUM FULL` y sin lock global.
⛔ **Diseño, no propuesta de ejecución.**

---

## PARTE J — Viabilidad del archivo histórico (sólo diseño)

**[INFERENCE] Sí, la analítica histórica es exportable sin pérdida a Parquet + DuckDB.**

- **Particionado:** `event_date=YYYY-MM-DD/` (Hive). Alinea con la unidad de retención y
  permite pruning por fecha, que es como se consulta.
- **Columnas requeridas:** `id`, `created_at`, `event`, `session_id`, `account_ref`, `props`
  (JSON como string), `surface`, `container`, `locale`, `source`, `campaign`, `country`,
  `app_version`, `visit_id`.
- **Nombres:** `analytics_events/event_date=2026-08-04/part-0000.parquet`, compresión zstd.
- **Verificación de filas:** `count(*)` por día en Postgres contra `count(*)` en DuckDB, **por
  partición**, no en total. Un total que coincide puede esconder dos días cruzados.
- **Verificación de rango:** `min(created_at)`/`max(created_at)` por partición dentro de su día.
- **Integridad:** SHA-256 por archivo + manifiesto con `(archivo, filas, min_ts, max_ts, sha256)`.
- **Privacidad:** ⛔ `account_ref` **es un identificador**. El archivo va a almacenamiento
  privado; para análisis compartido, `account_ref` se reemplaza por `left(md5(account_ref||salt), 8)`
  — la misma disciplina que usan los informes de esta sesión. `props` puede traer mensajes de
  error crudos: **se redacta con el mismo enmascarado de `read-only-query.ts`**.
- **Restore:** `CREATE TABLE ... AS SELECT * FROM read_parquet(...)` en DuckDB, o `COPY` de
  vuelta a Postgres si hiciera falta.

### ¿Se reproducen las consultas de este informe desde Parquet?

| Métrica | ¿Reproducible? | Dependencia |
|---|---|---|
| DAU / WAU | ✅ | sólo `analytics_events` |
| Daily / Arena / Coach / Learn | ✅ | sólo `analytics_events` |
| Embudo PRO · mint | ✅ | sólo `analytics_events` |
| Análisis por ejercicio | ✅ | `props->>'exerciseId'` |
| País / container / superficie | ✅ | columnas propias |
| **D1 / D3 / D7** | ⚠️ **Sólo si se archiva `account_first_seen`** | **tabla externa** |
| Cohortes de lanzamiento | ⚠️ Ídem | `account_first_seen` |
| Leaders | ⛔ **[UNKNOWN]** | sin instrumentar |

⛔ **La dependencia externa es real y es la que rompe un archivo ingenuo:** las métricas de
retención **no salen de `analytics_events`**. Salen de `account_first_seen` (y
`session_first_seen`). Son 2,7 MB entre las dos: **archivarlas junto con la analítica es
obligatorio**, o D1/D3/D7 dejan de ser reproducibles para siempre.

---

## PARTE K — Mapa de trabajo en Vercel

**[FACT] Base medida el 2026-08-03** (`docs/audits/2026-08-03-vercel-invocations-audit.md`):
82 K invocations en 12 h, ~19 min de Active CPU. Reparto: **66% telemetría** (1 request por
evento), **27% status reads**, 7% resto. **El 100% son Route Handlers** — las páginas se sirven
estáticas y no generan volumen.

**[FACT] Eso cambió el mismo día:** la telemetría pasó a **batches de 20 eventos / 5 s de idle**
(`lib/telemetry.ts`), ~1/20 de los requests.

### Estimación del estado actual **[INFERENCE]**

| Bloque | Cálculo | Invocations/día |
|---|---|---:|
| Telemetría | 6.475 filas/día ÷ ~20, con flush por idle | **~450** (rango 324–650) |
| Status reads | 180 sesiones/día × ~22 requests/sesión *(derivado del audit)* | **~4.000** |
| Resto (games, og) | ~7% del total | ~350 |
| **Total** | | **~4.800/día ≈ 145 K/mes** |

**Reparto PLAY vs LEARN [INFERENCE]:** en el audit, `chesscito` 55 K contra `lite-chesscito`
27 K ≈ **67% / 33%**. La analítica actual muestra `lite_session_started` en 16 wallets de 934
en W2, así que **hoy LEARN debería pesar bastante menos**. **[UNKNOWN]** sin datos por proyecto.

- **Tasa diaria reciente:** **[UNKNOWN]** — el CLI no expone usage; el dashboard sí.
- **Active CPU actual:** ⛔ **[UNKNOWN].** No lo invento. En el audit eran ~19 min/12 h con la
  telemetría sin batchear; con el batch debería haber bajado mucho, pero **no está medido**.
- **Tráfico de preview/test:** **[UNKNOWN]**, no separable sin `deployment` como dimensión.
- **Ops tooling:** no material — `ops:query` y `ops:no-token` van **directo a Postgres**, no
  pasan por Vercel.

### Trabajo de alta frecuencia que no parece esencial **[INFERENCE]**

1. **Status reads: ~83% de las invocations estimadas.** Es el bloque dominante, muy por encima
   de la telemetría que motivó el trabajo anterior.
2. **`arena_game_start` + `arena_start_tap`**: dos eventos por el mismo instante.
3. **`peones_balance_viewed`** disparado por render: 8,7% de las filas.
4. ⛔ **Nada de esto se optimiza en esta pasada.**

---

## PARTE L — Aptitud para free tier

### Supabase Free *(verificado hoy en `supabase.com/pricing`)*

| Eje | MEDIDO | LÍMITE | HOLGURA |
|---|---:|---:|---|
| Tamaño de base | **197 MB** | 500 MB | **60,6% libre** |
| Usuarios activos mensuales | ~1.500 | 50.000 | **97% libre** |
| Egress | **[UNKNOWN]** | 5 GB | ⚠️ no medible por SQL |
| File storage | ~0 | 1 GB | libre |
| Proyectos activos | 1 | 2 | libre |
| Pausa por inactividad | tráfico diario | 1 semana | sin riesgo |

- **EJES DESCONOCIDOS:** egress; cached egress.
- **BLOQUEANTES:** ninguno hoy. ⚠️ **Pero crece 3,7 MB/día** (6.475 filas × 570 B) → **~82 días
  hasta el tope**, y **un pico como el del lanzamiento suma ~14 MB/día**.
- **VEREDICTO: LIKELY READY, BUT EGRESS MUST BE VERIFIED**

### Vercel Hobby *(verificado hoy en `vercel.com/docs/plans/hobby` y `/docs/limits`)*

| Eje | MEDIDO | LÍMITE | HOLGURA |
|---|---:|---:|---|
| Invocations | ~145 K/mes **[INFERENCE]** | 1.000.000 | ~85% libre |
| Active CPU | **[UNKNOWN]** | **4 CPU-hrs/mes** | ⚠️ **no medido** |
| Provisioned Memory | **[UNKNOWN]** | 360 GB-hrs | **[UNKNOWN]** |
| Fast Data Transfer | **[UNKNOWN]** | 100 GB | **[UNKNOWN]** |
| **Uso comercial** | **Cobramos** | ⛔ **Prohibido** | **—** |

- **EJES DESCONOCIDOS:** Active CPU, memoria aprovisionada, transferencia.
- **BLOQUEANTE:** ⛔ **el uso comercial.** Único, y es dirimente.
- **VEREDICTO: NOT READY** — y **no por consumo**. El consumo sobra; **el plan no admite un
  producto que cobra.**

⚠️ **Y aunque el uso comercial se permitiera, quedaría un riesgo sin medir:** **4 CPU-hrs/mes**
es un techo estrecho. El audit midió ~19 min de Active CPU **en 12 horas** con la telemetría sin
batchear; a esa tasa serían ~24 h/mes, **6× el límite**. El batch debería haberlo bajado mucho,
pero **hasta medirlo, ese eje es un [UNKNOWN] con antecedente rojo.**

---

## PARTE M — Estado estable vs pico

| | **ESTADO ESTABLE (W2)** | **PICO TIPO LANZAMIENTO** |
|---|---:|---:|
| Sesiones/día | **180** *(184–230 durante 9 días)* | **1.960** (×10,9) |
| Filas de analítica/día | **6.475** | ~51.900 |
| Crecimiento de base/día | **3,7 MB** | ~29,6 MB |
| Invocations/día **[INFERENCE]** | ~4.800 | ~50.000 *(con el batch de hoy)* |
| Upstash/Redis | **[UNKNOWN]** | **[UNKNOWN]** |

**¿El free tier aguanta el estado estable?**
- **Supabase: [FACT] sí hoy** (39,4% del tope) — **pero se llena en ~82 días** sin retención.
- **Vercel: [FACT] no**, por uso comercial, con consumo de sobra.

**¿Y en un pico?**
- **[INFERENCE]** Supabase: ~30 MB/día durante 6 días = +178 MB. Desde 197 MB, **el pico solo
  llega a ~375 MB de 500**. Aguanta uno; **no aguanta dos sin retención**.
- **[INFERENCE]** Vercel: ~50 K/día × 6 = 300 K, dentro de 1 M. **Numéricamente cabría.**

**[INFERENCE — recomendación, no ejecución] El modelo correcto es el de baseline barato + pico
temporal.** Lo sostiene la evidencia: el 62% de toda la analítica son 6 días de pico, y el
estado estable es 9 días planos de 180 sesiones. Un sistema dimensionado para el pico está
sobredimensionado el 94% del tiempo.
⛔ **Con una excepción que no es negociable: en Vercel el piso no puede ser Hobby.**

---

## PARTE O — Decisiones finales de costo y arquitectura

**QUÉ NECESITA CHESSCITO PARA SEGUIR VIVO** — **[FACT] ~19,5 MB de estado de producto**
(`peones_ledger`, `score_attempts`, `score_saves`, `score_write_sessions`, `welcome_pack_claims`,
`pro_subscriptions`, `treasury_*`, `duels`, `content_overlay`) más los Route Handlers.
**El 9,9% de la base.**

**QUÉ ES PESO HISTÓRICO** — **[FACT] 164,4 MB de analítica (83,5%)**, de los cuales **91,7 MB
son índices** y **el 62% de las filas son los seis días del pico**.

**QUÉ PUEDE SALIR DE SUPABASE** — **[INFERENCE]** `analytics_events` con más de 14 días, a
Parquet. Preserva toda consulta de esta pasada **siempre que `account_first_seen` y
`session_first_seen` viajen con ella**.

**QUÉ DEBE QUEDARSE CALIENTE** — **[FACT]** Todo `PRODUCT_STATE`. Y **entre 7 y 14 días** de
analítica: 7 días cubre el ciclo de observación del `no-token`; menos, y `pnpm ops:no-token`
deja de tener ventana.

**QUÉ IMPULSA EL TRABAJO EN VERCEL** — **[INFERENCE] Los status reads, ~83%** de las
invocations estimadas. **[FACT]** La telemetría **ya dejó de ser el problema**: era el 66% y el
batch la bajó ~20×.

**QUÉ SEGUIMOS SIN PODER MEDIR** — **[UNKNOWN]** Active CPU · memoria aprovisionada ·
transferencia · egress de Supabase · reparto PLAY/LEARN actual · tráfico de preview ·
Upstash/Redis · qué fue `score_save_failed`.

**BRECHA DE SUPABASE FREE** — **Ninguna hoy** (197 de 500 MB). ⚠️ **Temporal, no estructural:
~82 días.**

**BRECHA DE VERCEL FREE** — ⛔ **Contractual, no técnica: el uso comercial.** Insalvable con
optimización.

**TOP 3 REDUCCIONES SEGURAS** *(medidas, **no ejecutadas**)*
1. **Índices casi ociosos de `analytics_events`: 60,6 MB = 30,8% de la base.** ⚠️ Requiere
   confirmar `idx_scan` en una ventana larga y **no** tocar la PK.
2. **Retención de 14 días con particionado por tiempo: −97.995 filas ≈ −52 MB.** Con
   particiones, `DROP` devuelve disco de verdad.
3. **Deduplicar `arena_game_start`/`arena_start_tap`: −1.127 filas/semana**, y quita una
   ambigüedad permanente del catálogo.

**QUÉ NO SE DEBE TOCAR TODAVÍA**
- ⛔ La instrumentación del Lote 1: la ventana está en 5 de ~200.
- ⛔ `peones_balance_viewed`: es el 8,7% del volumen, pero **es la única señal de alcance
  universal** que tenemos hoy.
- ⛔ Ningún índice, hasta confirmar contadores en ventana larga.
- ⛔ Ningún `DELETE` sin particionado: gasta el riesgo y **no devuelve disco**.
- ⛔ Ningún cambio de plan.

---

# NOT READY — NEEDS ACTIVE CPU AND EGRESS MEASUREMENT FIRST

**Por qué no alcanza con lo que hay** — la separación de datos es un diseño **de costo**, y dos
de sus tres ejes están sin medir:

1. **Active CPU de Vercel [UNKNOWN]**, con antecedente rojo: ~19 min/12 h ≈ 6× el tope de
   Hobby antes del batch. **Sin ese número no se sabe si el costo de Vercel es de invocations
   o de CPU**, y las dos se arreglan distinto.
2. **Egress de Supabase [UNKNOWN]** contra un tope de 5 GB. Archivar reduce **almacenamiento**;
   si la restricción real fuera egress, el archivo no la mueve.
3. **`score_save_failed` [UNKNOWN]**: 844 filas en W2, 22,2 por sesión, 7 en 24 h. Un diseño de
   retención escrito sin saber qué fue eso puede quedar dimensionado sobre una anomalía.

⚠️ **Lo que SÍ está listo, y no depende de esos tres:** la parte de Supabase está medida entera
—197 MB, 81,9% analítica, 91,7 MB de índices, la simulación de las cuatro ventanas y el diseño
del archivo Parquet. **Si querés avanzar sólo con la separación de datos de Supabase, la
evidencia alcanza.** Lo que no alcanza es para decidir la arquitectura de costo completa.
