# Vitales e infra: qué está vivo y qué estamos pagando de más

> ⛔ **CORREGIDO EL MISMO DÍA por `2026-09-02-telemetry-verified-and-real-state.md`.**
> Dos errores de este documento: (1) el **−95,5%** compara contra el pico absoluto de 3 días
> — el número real es ~**−30%** sobre la meseta; (2) los índices de dimensión son
> **compuestos** `(surface, created_at desc)`, no de columna sola, así que **no** son
> desperdicio. Lo que se sostiene: analytics = 83% de la base, Redis no se suelta, Upstash
> sin medir. Leer el otro documento primero.

**Fecha:** 2026-09-02 · **Tipo:** spike (medición, no código)
**Fuente:** `pnpm ops:health` (read-only) contra **production**, comparado contra el
snapshot del 2026-08-04. Ambos snapshots leen la MISMA base compartida prod+preview, así
que la comparación es homogénea.

---

## El titular, antes que cualquier otra cosa

Preguntaste por métricas, salud, experimentos, infra y cómo soltar lo que sobra. La
medición contesta todo eso, pero con un orden que no es el que planteaste:

> **La actividad cayó ~95% en cuatro semanas. El almacenamiento creció 2,7×.**
> Estamos por optimizar la factura de un sistema que casi nadie está usando.

Ahorrar en infra es real y lo detallo abajo, pero es el segundo problema. El primero es que
**hay 117 sesiones en 24 h y 2 en la última hora.**

---

## 1. Cuánta gente está viva (medido)

| Métrica (24 h) | 2026-08-04 (pico) | 2026-09-02 (hoy) | Δ |
|---|---:|---:|---:|
| **Sesiones** | 2,612 | **117** | **−95,5%** |
| Eventos | 68,740 | 3,673 | −94,7% |
| Sesiones última hora | 165 | **2** | −98,8% |
| `peones_balance_viewed` | 5,822 | 297 | −94,9% |
| `play_hub_view` | 4,432 | 257 | −94,2% |
| Eventos/sesión | 22,79 | 25,61 | +12% |

**Lo que dice la última fila:** los que quedan **no se enganchan menos** — al contrario,
consumen un poco más por sesión (p50 19 eventos, p95 107, máx 160). No es un problema de
producto aburrido: **es un problema de que no entra nadie.** El pozo se vació; el que cae
adentro se comporta igual o mejor que en el pico.

⚠️ **Advertencias sobre estos números, todas del propio snapshot:**
- La base **no separa production de preview**. Los 117 son la suma; production sola es ≤117.
- El 2026-08-04 es el **pico absoluto** registrado, no un día normal. Comparar contra un pico
  exagera la caída. Lo que no cambia es el nivel: hoy estamos en **4,5% del pico**.
- `select now()` tardó **5,358 ms** (🔴 el único indicador rojo). Eso es un pooler frío,
  que es lo que se espera de una base casi ociosa — **es síntoma, no causa**.

⚠️ **Lo que NO verifiqué y cambiaría la lectura si estuviera mal:** que la telemetría siga
escribiendo bien. A favor de que sí: los logs de Vercel muestran `/api/telemetry: 15 req · 0
err` y el guardado de score reporta `fallo=10 · aplazado=4`. Pero **no lo medí de punta a
punta**, y si la caída fuera de instrumentación en vez de de gente, todo lo de arriba se
cae. Vale confirmarlo antes de tomar cualquier decisión de producto.

---

## 2. Qué se puede soltar y qué no

### ⛔ Redis (Upstash) — NO se suelta. No es caché, es el producto.

Tu hipótesis era que Redis podía sobrar. **No sobra.** Lo consumen ~20 rutas de API:
`peones/spend`, `shields/me`, `shields/spend`, `welcome-pack/claim`, `season-pass/status`,
`pro/status`, `verify-pro`, `verify-payment`, `focus-day`, `coach/*`, `games/*`,
`control-tower`.

El backlog documenta el detalle que lo confirma: el bug del Welcome Pack era *"si el INSERT
entraba y el `INCRBY` fallaba"* — es decir, **el saldo de Peones se mueve con un `INCRBY` de
Redis.** Eso es estado durable adyacente a dinero, no una caché que se puede tirar.

✅ Mitigante: existe `peones_ledger_init.sql` en Postgres, así que hay ledger. **No verifiqué
si el ledger permite reconstruir el saldo** si Redis se pierde — eso sí vale mirarlo, pero
es una pregunta de **durabilidad**, no de costo.

📊 Estado: **20,358 claves**, +521 en 2 días (~260/día, ~2 por sesión). Con ~5.900 cuentas
históricas eso da ~3,4 claves por cuenta: consistente con estado por cuenta, no con fuga.

⛔ **Lo que sí falta: medir los comandos.** Hoy es literalmente no-observable —
`UPSTASH_EMAIL` y `UPSTASH_API_KEY` no están configuradas. **No podemos afirmar que estemos
cerca ni lejos del tope de 500K.** Cuesta dos variables de entorno y desbloquea comandos,
ancho de banda y proyección de agotamiento.

### ✅ Supabase — acá SÍ hay grasa, y es casi toda telemetría

| | |
|---|---:|
| Base total | **241 MB** |
| `analytics_events` | **200 MB** (89 MB datos + **112 MB índices**) |
| **% de la base que es telemetría** | **83%** |
| Filas | 360,485 |
| Ventana retenida | desde **2026-06-03** (~3 meses) |
| Poda | `prune_analytics_events_monthly` · `0 3 1 * *` · activo |

**Dos cosas están mal dimensionadas, y las dos son baratas de arreglar:**

1. **Los índices pesan más que los datos** (112 MB vs 89 MB). Hay **7 índices** sobre
   `analytics_events`: `created_at`, `(session_id, created_at)`, `(event, created_at)`,
   `account_ref`, y **tres de dimensión — `surface`, `container`, `country`**. Los últimos
   tres son de **cardinalidad bajísima** (`container` tiene esencialmente dos valores:
   `browser` y `minipay`). Un índice sobre una columna de 2-3 valores casi nunca se usa para
   filtrar y sí cuesta escritura y disco en cada `INSERT` de telemetría.

2. **Retenemos 3 meses de un régimen que ya no existe.** Las 360K filas son en su mayoría
   del pico de agosto. Al ritmo de hoy (3,673 filas/día) **30 días son 61 MB**. Bajar la
   retención a 30-45 días saca del orden de 120-150 MB.

**Palanca combinada:** retención más corta + tirar los tres índices de dimensión llevaría la
base de **241 MB a menos de 100 MB**. Si el plan se paga por almacenamiento, ese es el
ahorro, y no toca ni una línea de producto.

⚠️ Antes de tirar un índice: confirmar que ninguna de las 8 RPC `stats_*` lo usa. No lo
verifiqué — se mide con `EXPLAIN`, no se supone.

### ⚠️ Vercel — medible, pero mal atribuido por diseño

213,194 invocaciones en el ciclo (chesscito 130,563 + lite-chesscito 82,631) para ~117
sesiones/día. Da del orden de **60 invocaciones por sesión**, que suena alto.

⛔ Pero el número **mezcla production y preview** (la API de Vercel factura por proyecto, no
por environment) y el propio snapshot marca como no observable el ratio de batching de
`/api/telemetry`. **Sin ese ratio no se puede decir si el grueso es telemetría o no**, y por
lo tanto no puedo recomendar un recorte acá sin inventar.

---

## 3. Lo que el monitor declara no-observable (y cuánto cuesta destaparlo)

| Dato | Por qué no se ve | Costo de destaparlo |
|---|---|---|
| Comandos Upstash, ancho de banda, % del tope de 500K | faltan credenciales de Management API | **2 env vars** |
| Fluid Active CPU por proyecto | la atribución de la API de Vercel es no determinística (3 llamadas idénticas dieron 1, 3 y 2 filas, ±25%) | no se arregla: copiar del panel |
| % de cuota y días hasta agotarla | ninguna API expone lo *incluido* en el plan | copiar del panel |
| Eventos por request de telemetría | la muestra de logs dura ~90 s y la ventana mínima de la base es 15 min — dividir ventanas de distinto span no es un ratio | requiere una medición pareada |

✅ Vale la pena reconocer que el monitor **se niega a estimar** en vez de rellenar con un
número plausible. Eso es correcto y hay que dejarlo así.

---

## 4. Lo que pediste y este spike NO contesta

Tu pregunta tenía seis piezas. Tres las contesta la medición de arriba; **tres necesitan su
propia pasada** y meterlas acá habría sido opinar sin datos:

- **Experimentos y estados** — no hay inventario de qué experimentos están corriendo ni en
  qué estado. Requiere leer flags + `docs/specs` contra el código.
- **Auditoría de resultados post-commit** — el último deploy es `de3d3856`, hace ~49 h. Para
  decir si movió algo hace falta una comparación antes/después por evento, no un snapshot.
- **Revisión de métricas** (¿medimos lo correcto?) — es una pregunta de diseño de telemetría.
  Y hay antecedente de que los nombres del funnel mienten, cada uno distinto.

---

## Recomendación

**Orden propuesto, del más barato al más caro:**

1. **Configurar `UPSTASH_EMAIL` + `UPSTASH_API_KEY`.** Dos variables. Es el único eje crítico
   que hoy está a ciegas, y sin él la pregunta "¿el Redis tiene demasiados comandos?" no
   tiene respuesta — sólo hipótesis.
2. **Confirmar que la telemetría no está rota** antes de creerle al −95%. Si la caída es de
   instrumentación, todo lo demás cambia de sentido.
3. **Bajar retención de analytics a 30-45 días** y **evaluar tirar los índices `surface`,
   `container`, `country`** (con `EXPLAIN` antes, contra las RPC `stats_*`). Saca ~150 MB sin
   tocar producto.
4. **No tocar Redis.** Es estado durable de producto. Si hay algo que revisar ahí, es si el
   ledger de Postgres puede reconstruir saldos — durabilidad, no costo.

⛔ **Y la observación que importa más que las cuatro:** el ahorro total de infra acá se mide
en decenas de MB y, probablemente, en decenas de dólares. **La caída de 2,612 a 117 sesiones
no se arregla con ninguna de estas cuatro cosas.** Si hay una sola pasada disponible después
de esto, debería ser sobre distribución, no sobre la factura.

---

*Snapshots: `artifacts/ops/production/2026-09-02T06-07-21Z.{md,json}` y
`artifacts/ops/2026-08-04T07-22-55Z.{md,json}` (gitignored).*
*Relacionado: `docs/audits/2026-09-01-farcaster-feasibility.md` — distribución.*
