# Handoff — estabilización de lanzamiento

**Fecha:** 2026-08-04 · Estado vigente al cierre de esta sesión.

---

## Estado actual

| Sistema | Estado |
|---|---|
| **Supabase** | Plan **Pro / Micro**. PostgreSQL **recuperado** — responde normal |
| **Vercel** (`goodwolf`) | Plan **Pro**, con **USD 20 incluidos** |
| **Spend Management** | Presupuesto on-demand **USD 5** · notificaciones **activas** · pausa automática **desactivada** |
| **`VERCEL_TOKEN`** | Configurado localmente |
| **Upstash Management API** | **Sin credenciales todavía** |

**Production y preview comparten la MISMA base Supabase**, y se monitorean **por
separado** en Vercel. Esa asimetría es deliberada y está señalizada en cada
informe: lo que se separa por entorno son deployments, logs, dominios y
snapshots; la base **no**.

---

## Topología

| Dominio | Proyecto | Target | Git ref |
|---|---|---|---|
| `play.chesscito.com` | `chesscito` | production | `production` |
| `learn.chesscito.com` | `lite-chesscito` | production | `production` |
| `preview.chesscito.com` | `chesscito` | preview | `main` |
| `learn-preview.chesscito.com` | `lite-chesscito` | preview | `main` |
| `www.chesscito.com` | `chesscito-landing` | — | **fuera del monitor** |

---

## Incidente confirmado

**Pico real del 3 de agosto**, no un defecto del instrumento:

| Métrica | Valor |
|---|---|
| Eventos | **46.337** |
| Sesiones | **1.930** |
| Cuentas identificadas | **1.526** |
| Eventos por sesión | **24,01** |

**24 eventos/sesión está por debajo del umbral amarillo (35)**: el volumen fue
tráfico genuino. Lo que lo convirtió en incidente fue la telemetría
**evento-por-request**, que consumió invocaciones de Vercel y presionó a Supabase
justo cuando la base estaba en su plan más chico.

---

## Cambios cerrados

| Cambio | Qué hizo |
|---|---|
| **Fase 0** | Buckets de rate limit por endpoint; fallo de Upstash distinguible de rate limit; timeout acotado en el cliente Redis |
| **Batching de telemetría** | 20 eventos → 1 request; bulk insert; cohortes dedupeadas por lote |
| **D2.1** | El GET de balance dejó de escribir en `peones_ledger` en cada lectura |
| **Supabase Nano → Micro** | Base recuperada |
| **Monitor read-only** | `pnpm ops:health` — Supabase, Vercel y Upstash en una corrida |
| **Targets production/preview** | Selección explícita + validación cruzada de dos señales |
| **Snapshots separados** | `artifacts/ops/production/` y `artifacts/ops/preview/` |
| **Runbook operativo** | `docs/runbooks/launch-health-monitor.md` |

---

## Estado del monitor

```bash
pnpm ops:health              # production (default)
pnpm ops:health:preview      # preview
```

**Veredicto actual en ambos targets: 🟢 GREEN (partial)** — nada de lo observado
está mal, y dos ejes críticos no se pueden medir.

| Eje | Estado |
|---|---|
| **Supabase** | ✅ observable — 13 métricas, ~1,5 s |
| **Vercel: deployments y logs** | ✅ observable |
| **Vercel: invocations por proyecto** | ✅ **observable desde el 2026-08-04** — Observability API |
| **Vercel: Fluid Active CPU** | ❌ no observable — **la atribución por proyecto de la API no es determinista** |
| **Vercel: % de cuota** | ❌ no observable — ninguna API expone lo incluido en el plan |
| **Upstash: data plane** (claves, latencia) | ✅ observable |
| **Upstash: cuota** (comandos, % de 500 K) | ❌ no observable — faltan credenciales de Management API |

`GREEN (partial)` **no significa que todo esté bien**: significa que nada de lo
observado está mal, y que dos ejes de costo no se miraron. Un monitor que dijera
`GREEN` sin haber mirado el eje más caro convertiría ignorancia en tranquilidad.

---

## ✅ CERRADO — el HTTP 400 del Vercel Usage API

**Auditoría:** `docs/audits/2026-08-04-vercel-usage-http-400-audit.md`
**Commits:** `157c908c` (auditoría) · `abf7e8da` (etapa 1) · `c0d53749` (etapa 2)

**Causa raíz, en dos capas.** El colector hacía `GET /v1/usage` **sin un solo
parámetro**, y el endpoint exige `from`/`to` — lo decía textualmente en un cuerpo
que el colector **descartaba**. Más de fondo: `/v1/usage` **no es un endpoint
público** (ausente de los 272 paths del OpenAPI oficial) y rechaza **todo** rango
temporal, incluido el ciclo de facturación real. **El token nunca estuvo mal:**
cuatro respuestas 200 lo confirman.

**Qué se hizo.** `/v1/usage` retirado, sin fallback. La fuente ahora es
`POST /v2/observability/query`, documentada. Todo error de la API de Vercel
**incluye el mensaje del servidor**, no sólo el código.

**Qué se GANÓ:** invocations por proyecto del ciclo de facturación, con la ventana
explícita, filtradas a `chesscito` + `lite-chesscito`. `chesscito-landing` y los
otros tres proyectos del equipo salen listados aparte y **nunca se suman** (~18 %
de consumo ajeno que antes se habría atribuido a Chesscito).

**Qué NO se ganó, y por qué el informe sigue `GREEN (partial)`:**

- **Active CPU.** Tres llamadas idénticas y consecutivas devolvieron **1, 3 y 2
  filas**, con valores moviéndose ~25 % y **el mismo valor atribuido a proyectos
  distintos entre llamadas**. Las invocaciones sobre el mismo `groupBy` fueron
  estables a ±1 → el defecto es de la medida de CPU. Es la trampa de `INFO` de
  Upstash otra vez, y se resolvió igual: **no se publica**.
- **% de cuota.** Falta el denominador; `/v1/billing/charges` da **404
  `costs_not_found`**.

> Detalle operativo completo en el runbook §12bis, incluidas las dos trampas que
> están fijadas por tests: la granularidad de 60 min (un `{hours:24}` sobreestima
> 87 %) y el filtrado por proyecto.

---

## ✅ CERRADO — el RED de `telemetry_volume` («p95 218»)

**Auditoría:** `docs/audits/2026-08-04-telemetry-session-p95-audit.md`
**Commits:** `80a63b8b` (auditoría) · `ca5f7ef3` (corrección)

**Fue un defecto del instrumento, no del sistema.** El p95 se derivaba en el
cliente sobre `top_sessions_1h`, que el SQL corta con `limit 20`, así que
`percentile(20 valores, 0.95)` devolvía `sorted[18]` — **la 2.ª sesión más ruidosa
de la última hora**, sin importar el tráfico. Medido en la misma ventana: el
top-20 daba **182** y el p95 real era **77**; 182 era exactamente el **p99**.

**Corregido:** `percentile_disc(0.95) within group` en PostgreSQL, sobre **toda**
la población de 24 h, con el tamaño de la población al lado. `top_sessions_1h`
queda sólo como muestra diagnóstica y **nunca** alimenta la clasificación.
**El umbral rojo sigue en 200.**

**Valor real hoy:** `p50 15 · p95 73 · máx 592` sobre 2.403 sesiones — a 2,7× del
umbral. Sólo el 0,79 % de las sesiones supera 200, y esas sesiones emiten 23–48
`event_name` distintos a **1,07 ev/min** (el ritmo más bajo de todas las bandas)
sobre 298 min de media: son **largas, no desbocadas**.

**Dos defectos reales que la auditoría destapó y que NO se tocaron** (fuera del
alcance aprobado, ninguno causa el p95):

- **Duplicados exactos: 8,6 % de las filas** (5.262 en 24 h), mismo evento y mismo
  `created_at`. `dock_tap` ×14 con span **0,0 s**, `score_submit_tx` ×11 en 0,0 s
  → emisión múltiple en el mismo tick.
- **217 sesiones (9 %) abarcan varias visitas**, hasta 8 en 21 h: el `session_id`
  no rota, así que "eventos por sesión" mide días, no una sentada.

---

## Pendientes priorizados

1. **Obtener `UPSTASH_EMAIL` + `UPSTASH_API_KEY`.** Desbloquea comandos del
   período y % de cuota. El colector ya está escrito y se activa solo.
2. **Cambiar la poda de `analytics_events` de mensual a diaria.** A volumen real,
   la corrida del 1.º de septiembre borraría ~1,4 M de filas en una transacción:
   pico de WAL y de autovacuum en una instancia chica. Misma función, mismos 90
   días, solo cambia el ritmo.
3. **Auditar las stats públicas.** Dos discrepancias sin explicar: **46 sesiones
   visibles contra 1.930 reales**, y las cuentas **truncadas exactamente en
   1.000** — ese número redondo huele a límite de paginación, no a dato.
4. **Medir `idx_scan` durante al menos 7 días** antes de tocar ningún índice. Los
   contadores se resetearon con el cambio de plan; `idx_scan = 0` hoy no dice
   nada.
5. **Diseñar el rollup ANTES de reducir la retención.** Acortar la ventana sin
   agregados pierde historia de forma irreversible.
6. **Investigar los duplicados de telemetría con span 0,0 s.** 8,6 % de las filas
   y de las escrituras que nadie quiso emitir. Empezar por `dock_tap`,
   `score_submit_tx`, `hub_reward_tile_tap` y `play_hub_arena_tap`: mismo
   instante, mismo handler.
7. **Decidir qué significa "sesión".** Mientras `session_id` no rote entre
   visitas, "eventos por sesión" mide días. Si la métrica busca *intensidad*, el
   agrupador correcto es `visit_id`.

---

## Restricciones

- **No mezclar snapshots de production y preview.** El monitor lo impide por
  partida doble (directorios separados + guard en `checkCompatibility`), pero la
  regla también aplica al leerlos a mano.
- **No `VACUUM FULL`** — toma `ACCESS EXCLUSIVE` y bloquea las escrituras de
  telemetría.
- **No `REINDEX`** en horario activo.
- **No `DELETE` manual** sobre `analytics_events`: existe la poda.
- **No retirar índices todavía** — ver pendiente 4.
- **Kill switch:** `NEXT_PUBLIC_TELEMETRY_ENABLED=0`.
- ⚠️ **Nunca usar `NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED=0` como freno de
  emergencia.** Parece un freno y es lo contrario: vuelve a un-request-por-evento
  y **sube la carga ~20×**. Es una escotilla de debug.

---

## Referencias

### Runbook operativo

- `docs/runbooks/launch-health-monitor.md` — **empezar acá para operar**

### Auditorías

- `docs/audits/2026-08-03-vercel-invocations-audit.md` — el incidente de
  invocaciones. Contiene dos hipótesis mías **refutadas** por evidencia posterior;
  se conservan marcadas como tales.
- `docs/audits/2026-08-04-analytics-events-audit.md` — por qué `analytics_events`
  pesa 61 MB, y la evidencia forense de que el cron de poda **sí** corrió.

### Specs

- `docs/specs/2026-08-04-launch-health-monitor-design.md` — diseño del monitor
- `docs/specs/2026-08-04-ops-health-targets-audit.md` — auditoría de targets

### Handoffs previos

- `docs/handoffs/2026-08-03-fase-0-rate-limit-report.md`
- `docs/handoffs/2026-08-03-fase-0-post-deploy-validation.md`
- `docs/handoffs/2026-08-03-fase-1-telemetry-batching.md`
- `docs/handoffs/2026-08-03-fase-1-post-deploy-validation.md`
- `docs/handoffs/2026-08-03-d2-1-welcome-pack-gate.md`
- `docs/handoffs/2026-08-03-d2-1-post-deploy-validation.md`

### Plan

- `docs/plans/2026-08-03-invocations-hotfix-plan.md`

---

## NEXT ACTION

> **Cambiar la poda de `analytics_events` de mensual a diaria.** Es el pendiente
> con fecha: la corrida del 1.º de septiembre borraría ~1,4 M de filas en una
> sola transacción sobre una instancia chica. Misma función, mismos 90 días de
> retención — sólo cambia el ritmo.
>
> (El HTTP 400 de Vercel Usage quedó cerrado; los tres commits y lo que sigue sin
> medirse están arriba. Upstash Management API sigue esperando credenciales del
> founder y no bloquea nada.)
