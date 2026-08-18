# Salida de costo de infraestructura — auditoría de emergencia

**Fecha:** 2026-08-18 · **Tipo:** sólo lectura / diseño. Cero deploys, migraciones, borrados o
cambios de plan.
Etiquetas: **[FACT]** medido · **[INFERENCE]** derivado · **[ESTIMATE]** modelado · **[UNKNOWN]**

---

## 0. La corrección que reordena el plan entero

⛔ **La base de datos YA cabe en el free tier de Supabase. Hoy. Sin tocar una línea.**

**[FACT] 197 MB de un límite de 500 MB (39,4%).** El brief —y mi propia auditoría de ayer—
daban por hecho que desacoplar `/stats` y encoger la tabla eran *el camino* hacia Free. **No lo
son.** Son **seguro**, no ahorro.

**Consecuencia:** los ~$20/mes de Supabase son, hasta donde la evidencia alcanza, **ahorrables
esta semana con esfuerzo de ingeniería cercano a cero**, y el trabajo de particionado que diseñé
ayer **no está en el camino crítico del dinero**.

⚠️ **Con una pregunta abierta que hay que contestar antes:** *¿por qué está en Pro hoy?* Si es
por backups, por no querer la pausa por inactividad o por CPU dedicada, eso es una decisión de
producto, no una restricción de tamaño. **[UNKNOWN]** — y la contesta el founder, no yo.

---

## PARTE 1 — Mapa de dependencias

| Proveedor | Servicio | Propósito | ¿Runtime crítico? | Estado | Datos | Si falla | Costo/mes | Uso observado | Dificultad de reemplazo |
|---|---|---|---|---|---|---|---|---|---|
| **Vercel** | Hosting `chesscito` (PLAY) | App entera | ⛔ **Sí** | stateless | — | Producto caído | ~$20 (equipo) | ~180 ses/día | **BAJA** |
| **Vercel** | Hosting `lite-chesscito` (LEARN) | App entera | ⛔ Sí | stateless | — | LEARN caído | (mismo equipo) | mucho menor | BAJA |
| **Supabase** | Postgres | Estado + analítica | ⛔ Sí | **stateful** | 197 MB | Sin progreso ni scores | ~$20 | 39,4% del límite Free | **ALTA** |
| **Upstash** | Redis (REST) | Caché, rate limit, coach, estado PRO | ⛔ Sí | stateful (efímero) | TTL | Degradación amplia | ~$5–8 | **[ESTIMATE]** 250–400k cmd/mes | **MEDIA** |
| **Railway** | Facilitador Stellar/x402 | Servicio aparte | No para Chesscito | stateless | — | Sin impacto en Chesscito | ~$5 | **sin tráfico real** | — |
| **Celo RPC** | Lecturas on-chain | Balances, PRO, mint | ⛔ Sí | — | — | Rail de pagos ciego | $0 (público) | **[UNKNOWN]** | MEDIA |
| **pg_cron** | `prune_analytics_events_monthly` | Borrado >90 días | No | — | — | La tabla crece | $0 | 1 job activo | BAJA |
| **DNS/dominios** | `play.` · `learn.` · `www.` | Enrutado | ⛔ Sí | — | — | Todo caído | fuera de alcance | — | BAJA |
| Object storage | **ninguno** | — | — | — | — | — | $0 | — | — |

**[FACT] Cero paquetes `@vercel/*`. Sin `vercel.json`. Sin crons de Vercel. Sin Blob ni KV.**

---

## PARTE 2 — Salida a Supabase Free

| Tabla | Clasificación | MB | ¿Protegida? |
|---|---|---:|---|
| `analytics_events` | **RECENT_TELEMETRY** + **HISTORICAL_ONLY** | 161,7 | Histórico ya archivado |
| `peones_ledger` | ⛔ **PRODUCT_STATE** | 7,5 | **Sí** |
| `score_attempts` | ⛔ **PRODUCT_STATE** | 7,3 | **Sí** |
| `score_saves` | ⛔ **PRODUCT_STATE** | 2,8 | **Sí** |
| `session_first_seen` | **RUNTIME_AGGREGATE** | 1,4 | Lo usa `stats_activity_trend` |
| `account_first_seen` | **RUNTIME_AGGREGATE** | 1,3 | ⛔ Y la retención del archivo |
| `score_write_sessions` · `welcome_pack_claims` · `pro_subscriptions` · `treasury_*` · `duels` · `content_overlay` · `lite_season_passes` · `focus_day_ledger` | ⛔ **PRODUCT_STATE** | ~1,5 | **Sí** |
| `victories` | **DERIVED** (la cadena manda) | 0,3 | Reconstruible |
| `leaderboard_*_v` | **DERIVED** (vistas) | 0 | — |

**Piso real de Supabase: ~22 MB de estado de producto + agregados.** El resto es telemetría.

---

## PARTE 3 — Desacoplar `/stats` de 30 días de crudo

**[FACT] Semántica medida de las 9 RPC:** todas son **por día y por SESIÓN** (no por wallet),
todas admiten filtros opcionales `p_surface` y `p_container`, 7 usan ventana de **30 días**,
`stats_install_counts` 7 días y `stats_activity_trend` genera 30 días.
`stats_top_countries` añade `country`. `stats_activity_trend` **une `session_first_seen`**.

⛔ **Un solo `stats_daily` plano NO alcanza, y hay que decirlo:** la retención no es una suma.
Necesita pares *(día de cohorte, día de actividad)*, que un contador diario no puede expresar.

### Diseño mínimo correcto — tres tablas

```
stats_daily            (day, surface, container)      → contadores por familia de evento
stats_daily_country    (day, surface, container, country) → sesiones
stats_retention_daily  (cohort_day, surface, container, offset_days)
                                                      → cohort_size, returned
```

`stats_daily` cubre lo que hoy sale de conteos: `sessions`, `new_sessions`,
`returning_sessions`, `active_wallets`, y un contador por familia — `daily_started/completed`,
`arena_started/completed`, `coach_used`, `learn_started/completed`, `mint_started/success`,
`pro_impressions/taps/no_token`, `app_opened`.

**[ESTIMATE] Tamaño:** ~3 superficies × 2 containers × 365 días ≈ **2.200 filas/año** en
`stats_daily`; con país, ~20× más. **Todo junto: < 2 MB por año.**

⛔ **Contra los 161,7 MB actuales, `/stats` pasaría a costar ~1% del almacenamiento que consume
hoy** — y dejaría de depender de que el crudo siga caliente.

⚠️ **Qué se pierde, dicho de frente:** el agregado congela las dimensiones. Cualquier pregunta
nueva por una dimensión no precomputada **ya no se contesta desde Postgres**. Se contesta desde
el archivo Parquet — que existe y está probado — pero **no en la página**, sino en un análisis.

**Backfill:** ✅ **desde el archivo Parquet ya verificado, offline, sin tocar producción.** Es
justamente lo que `06d5815` habilitó. **[INFERENCE]** ~10 min de DuckDB para los 108 días.

---

## PARTE 4 — Ventana caliente mínima de crudo

**Una vez `/stats` desacoplado**, quién exige crudo:

| Consumidor | Necesita | Por qué |
|---|---|---|
| `ops:no-token` | **7 días** | El Lote 1 recolecta hacia ~200 observaciones |
| Diagnóstico de incidentes | 48–72 h | Un incidente se detecta y se mira el mismo día |
| Salud operativa (`ops:health`) | 24 h | Ventanas móviles cortas |
| Investigación histórica | **0** | Parquet + DuckDB |
| `/stats` | **0** *(tras el desacople)* | Agregados |

### **MÍNIMO SEGURO HOY: 7 días**

⛔ **Y lo exige exactamente un flujo: `ops:no-token`.** No es una preferencia de arquitectura —
es que la instrumentación del Lote 1 está viva y con 5 observaciones de ~200. Bajar a 72 h
apagaría la única medición en curso.

**[FACT]** 7 días ≈ **44.416 filas ≈ 25 MB** contra 161,7 MB. La base bajaría a **~60 MB**.

---

## PARTE 5 — Encogimiento físico más rápido

⛔ **Reevalúo mi diseño de ayer y cambia la conclusión.** Ayer recomendé particionar porque
suponía retención de 45 días, donde la ganancia era ~9,5 MB y la arquitectura era lo único que
justificaba el trabajo. **Con 7 días la aritmética se invierte.**

| Opción | Disco liberado | Downtime | Riesgo de escritura | Disco temporal | Complejidad | Rollback | Tiempo de implementación |
|---|---:|---|---|---:|---|---|---|
| **A · Copia + swap** | **~137 MB** | ms (`RENAME`) | BAJO ⚠️ | ~25 MB *(sólo lo caliente)* | **BAJA** | ✅ tabla vieja intacta | **~1 día** |
| B · Particionar | ~137 MB | ~0 | BAJO | ~0 | **ALTA** | ✅ | ~1 semana |
| C · `DELETE` + `pg_repack` | ~137 MB | bajo | BAJO | ~162 MB | MEDIA | ✅ | ~2 días |

⛔ **Con retención de 7 días, copia+swap gana claramente**, y por una razón que ayer no aplicaba:
**la tabla nueva sólo lleva 44 k filas de 297 k.** El disco temporal deja de ser 162 MB y pasa a
ser ~25 MB, la copia tarda segundos, y el catch-up cubre segundos en vez de minutos.

⚠️ **Y el riesgo de escritura es menor de lo que parece: la telemetría YA descarta en fallo por
diseño** (`lib/telemetry.ts`). Perder los eventos de una ventana de segundos **es el
comportamiento normal**, no una regresión.

**[INFERENCE] Particionar sigue siendo el destino correcto a largo plazo**, pero **no es el
camino más rápido al ahorro**, y el ahorro es lo urgente.

---

## PARTE 6 — Restricciones de Supabase Free

*Verificado hoy en `supabase.com/pricing`.*

| Eje | MEDIDO | LÍMITE | HOLGURA |
|---|---:|---:|---|
| Tamaño de base | **197 MB** | 500 MB | **60,6%** |
| MAU | **[ESTIMATE]** ~1.500 | 50.000 | 97% |
| **Egress** | ⛔ **[UNKNOWN]** | 5 GB | **no medible por SQL** |
| File storage | ~0 | 1 GB | libre |
| Proyectos activos | 1 | 2 | libre |
| Pausa por inactividad | tráfico diario | 1 semana | sin riesgo |
| Compute | Shared CPU · 512 MB RAM | — | ⚠️ **riesgo bajo pico** |

**BLOCKER:** ninguno de tamaño. **[UNKNOWN]:** egress, y **por qué está en Pro hoy**.

### **SUPABASE FREE: READY AFTER EGRESS CHECK**

⚠️ Y una advertencia que no es de tamaño: **Free es CPU compartida.** El incidente 522 del
2026-08-03 ocurrió **en Pro**. Bajo un pico de ~2.600 sesiones/día en Free, **[INFERENCE]** la
CPU es el eje que cede primero, no el disco.

---

## PARTE 7 — Portabilidad fuera de Vercel

**[FACT] Auditado en el código:**

| Dependencia | Clasificación | Evidencia |
|---|---|---|
| Next.js App Router · Server Components · SSR | **PORTABLE_AS_IS** | `next start` estándar |
| Route Handlers | **PORTABLE_AS_IS** | Node normal |
| `middleware.ts` | **PORTABLE_AS_IS** | 85 líneas, sin API de Vercel |
| **Edge runtime** | **PORTABLE_AS_IS** | ⛔ **cero rutas edge** |
| **Optimización de imágenes** | **PORTABLE_AS_IS** | ⛔ **`next/image` usado CERO veces** |
| ISR | PORTABLE_AS_IS | 2 `export const revalidate` |
| `next.config.js` | PORTABLE_AS_IS | intl, redirects, rewrites, headers |
| Crons de Vercel | **N/A** | ⛔ **no existen** — el único cron es `pg_cron` |
| Paquetes `@vercel/*` | **N/A** | ⛔ **ninguno** |
| Blob / KV / Analytics de Vercel | **N/A** | no se usan |
| `VERCEL_GIT_COMMIT_SHA` | **PORTABLE_WITH_CONFIG** | una línea en `next.config.js` |
| **`x-vercel-ip-country`** | ⛔ **REQUIRES_CODE_CHANGE** | `api/telemetry/route.ts:218`. **Única atadura runtime real** |
| Previews por rama | PORTABLE_WITH_CONFIG | Railway tiene entornos PR |
| Dominios / TLS | PORTABLE_WITH_CONFIG | Railway da TLS |

**CAN PLAY RUN AS A NORMAL NODE/NEXT SERVER? → YES**
**CAN LEARN RUN AS A NORMAL NODE/NEXT SERVER? → YES**

**Esfuerzo de migración: BAJO.** ⚠️ Con una salvedad concreta: **se pierde la dimensión
`country`** hasta reemplazar el header. Railway no inyecta geo; habría que usar el
`CF-IPCountry` de un proxy o un lookup por IP. **Es un punto, no un proyecto** — pero la
geografía es una de las dimensiones que el análisis de producto usa.

---

## PARTE 8 — Railway para Chesscito

*Precios verificados hoy: Hobby **$5/mes con $5 de crédito**; Pro $20/mes con $20. Recursos por
segundo → **RAM ~$10/GB-mes**, **vCPU ~$20/vCPU-mes**, egress **$0,05/GB**, volumen
~$0,156/GB-mes.*

⛔ **`NEXT_PUBLIC_CHESSCITO_MODE` se hornea en el bundle del cliente** (`feature-flags.ts:6`),
así que **PLAY y LEARN son dos builds obligatorios → dos servicios.** Unificarlos exigiría sacar
el modo del bundle: cambio de código real, no configuración.

| Servicio | RAM **[ESTIMATE]** | vCPU **[ESTIMATE]** | Costo/mes **[ESTIMATE]** |
|---|---:|---:|---:|
| Facilitador (sin tráfico) | ~0,25 GB | ~0,01 | **~$2,70** |
| Chesscito PLAY | ~0,35 GB | ~0,03 | **~$4,10** |
| Chesscito LEARN | ~0,30 GB | ~0,01 | **~$3,20** |

| Combinación | LOW | **LIKELY** | HIGH |
|---|---:|---:|---:|
| Sólo facilitador | $5 | **$5** | $6 |
| Sólo Chesscito (2 servicios) | $6 | **$7,30** | $12 |
| **Facilitador + Chesscito** | $8 | **~$10** | $16 |

⛔ **NO cabe en $5, y no voy a decir que sí.** El plan Hobby son $5 **con $5 de crédito**: en
cuanto el uso pasa de $5, se paga el uso. Tres servicios Node siempre encendidos rondan **$10**.

⚠️ **Railway cobra por segundo de recurso asignado.** La página no documenta escalado a cero,
así que **[UNKNOWN]** si un servicio ocioso deja de facturar. Si no lo hace —lo esperable para
un servidor web— el piso es la RAM, no el tráfico. **Ese es el número que decide, y conviene
confirmarlo antes de migrar.**

**Egress [ESTIMATE]:** 180 sesiones/día × ~1,5 MB ≈ 8 GB/mes ≈ **$0,40**. Despreciable.

---

## PARTE 9 — Vercel como plataforma de experimentación

**[INFERENCE] El modelo es practicable, y el repo ya lo permite:** cada proyecto de Vercel es
independiente; sacar `chesscito` y `lite-chesscito` no toca a los demás.

⛔ **Pero hay una condición dura y es la que hace que el modelo AHORRE:** Hobby prohíbe uso
comercial (verificado el 2026-08-17). El equipo baja a Hobby **sólo si NINGÚN proyecto que quede
es comercial.** Si queda uno, el piso de $20 sigue ahí y **sacar a Chesscito no ahorra los $20
de Vercel** — sólo agrega los ~$7 de Railway.

⚠️ **Esto es lo que puede invertir el signo de toda la operación**, y sólo el founder sabe qué
más vive en ese equipo.

**Veredicto del modelo:** sensato — experimento nuevo → Vercel; producto con usuarios sin
ingresos → runtime barato; producto que factura → vuelve a hosting premium.

---

## PARTE 10 — Necesidad real de Redis

**[FACT] 21+ módulos usan Upstash**, vía cliente **REST** — elegido porque serverless no sostiene
conexiones TCP. ⚠️ **En Railway esa restricción desaparece**, y un Redis TCP normal sirve.

| Familia | Propósito | Consistencia | ¿Coordinación distribuida? | Si falla | Clasificación |
|---|---|---|---|---|---|
| `Ratelimit` (`rate-limit.ts`, `demo-signing.ts`) | Límite por IP/wallet | fuerte | ⛔ **SÍ** | Firma abierta a abuso | ⛔ **KEEP** — *necesidad* |
| `chesscito:score-pending:` · `victory-pending:` | Mutex de escritura | fuerte | ⛔ **SÍ** | Doble escritura | ⛔ **KEEP** — *necesidad* |
| `coach:analysis:` · `coach:game:` | Caché de análisis | eventual | No | Recalcula | **MOVE_TO_POSTGRES** o TTL más largo |
| `chesscito:pro-active:` · `founder-active:` | Caché de estado on-chain | eventual | No | Lectura RPC extra | **IN_PROCESS** (LRU con TTL) |
| `chesscito:coach-credits:` | Contador de créditos | ⚠️ fuerte-ish | Sí si hay varias instancias | Créditos mal contados | **KEEP** hasta verificar |
| `chesscito:display-name:` | Nombre custom | eventual | No | Se cae al default | **REMOVE** — ⚠️ el nombre **nunca sale del dispositivo** |
| `chesscito:welcome-pack:` · `badge-earned:` | Idempotencia de reclamo | fuerte | Sí | Doble reclamo | ⛔ **KEEP** — *necesidad* |
| `chesscito:connect-prompt-shown:` | Estado de UI | eventual | No | Se repite un prompt | **IN_PROCESS** o cliente |
| `chesscito:duel:` | Estado de duelo | fuerte | Sí | Duelo roto | **KEEP** ⛔ *(P2P congelado — no tocar)* |
| `lite:season-pass:` · `chesscito:save:` | Caché | eventual | No | Lectura extra | **MOVE_TO_POSTGRES** |

**REDIS POR NECESIDAD:** rate limiting, mutex de escritura, idempotencia de reclamos, estado de
duelo. **Son coordinación distribuida real y no se mueven a Postgres sin trasladarle el costo.**

**REDIS POR CONVENIENCIA:** cachés de lectura de estado on-chain, nombres, flags de UI,
season-pass. **[ESTIMATE]** son la mayoría del volumen porque se consultan en cada render.

---

## PARTE 11 — Reducción de comandos

**[ESTIMATE] Perfil actual**, derivado del gasto ($5–8/mes ÷ $0,20 por 10k):
**250.000–400.000 comandos/mes** ≈ **8.300–13.300/día** ≈ **46–74 por sesión**.

| Bloque | **[ESTIMATE]** | % |
|---|---:|---:|
| Cachés de estado (PRO, founder, season-pass, save) | ~55% | **removibles** |
| Rate limiting | ~20% | esenciales |
| Mutex / idempotencia | ~10% | esenciales |
| Coach | ~10% | reducibles |
| Resto | ~5% | — |

**ESENCIALES ~30% · REMOVIBLES ~55% · REDUCCIÓN ALCANZABLE ~55–65%** → **110.000–180.000
cmd/mes** ≈ **$2,20–3,60/mes**.

| Opción | Costo/mes | Complejidad | Dominio de fallo | Latencia | Durabilidad |
|---|---:|---|---|---|---|
| Mantener Upstash | $5–8 | ninguna | externo | REST, alta | buena |
| **Upstash reducido** | **$2–4** | media | externo | igual | igual |
| **Redis en Railway** | **~$1–3** *(RAM)* | media | ⚠️ **mismo host que la app** | **TCP, mucho menor** | ⚠️ sin persistencia salvo volumen |
| Sin Redis | $0 | ⛔ **alta** | Postgres | — | ⛔ traslada carga a Supabase Free |

⛔ **"Sin Redis" no es gratis: mueve rate limiting y mutex a Postgres, es decir, al recurso que
queremos poner en el tier gratis con CPU compartida.** Es exactamente el anti-patrón que el
brief advierte.

---

## PARTE 12 — Costo por sesión

| Métrica | Valor | Etiqueta |
|---|---:|---|
| Filas de analítica / sesión | **35,9** | **[FACT]** |
| Requests de telemetría / sesión | ~2–3 | **[ESTIMATE]** *(batch de 20)* |
| Status reads / sesión | ~22 | **[ESTIMATE]** *(del audit del 2026-08-03)* |
| **Requests HTTP totales / sesión** | **~26** | **[ESTIMATE]** |
| Escrituras a DB / sesión | ~2–4 inserts | **[ESTIMATE]** |
| Lecturas de DB / sesión | ~10–20 | **[ESTIMATE]** |
| Comandos de Redis / sesión | **46–74** | **[ESTIMATE]** |
| Llamadas RPC externas / sesión | ~3–8 | **[ESTIMATE]** |
| CPU / sesión | ⛔ | **[UNKNOWN]** |
| Egress / sesión | ~1,5 MB | **[ESTIMATE]** |

### **COSTO POR SESIÓN HOY: ~$0,0093** (≈ **0,93 ¢**)

$50–53/mes ÷ ~5.400 sesiones/mes. **[ESTIMATE]**

**Con la arquitectura objetivo (~$10/mes): ~$0,0019** (≈ 0,19 ¢) — **5× menos.**

⚠️ **La métrica engaña y conviene decirlo: el costo es casi todo PISO FIJO, no marginal.** A
1.000 sesiones/día el costo por sesión cae ~5,5× sin que nada mejore. **Sirve para comparar
arquitecturas, no para juzgar eficiencia.**

---

## PARTE 13 — Modelo de carga

| Escenario | Requests/día | Escrituras DB/día | Filas analítica/día | Comandos Redis/día | Egress/mes | Presión |
|---|---:|---:|---:|---:|---:|---|
| **100 ses/día** | 2.600 | ~300 | 3.600 | 4.600–7.400 | 4,5 GB | trivial |
| **180 ses/día (HOY)** | 4.700 | ~540 | **6.475** | 8.300–13.300 | 8 GB | trivial |
| **1.000 ses/día** | 26.000 | ~3.000 | 36.000 | 46k–74k | 45 GB | ⚠️ **egress de Supabase Free** |
| **3.000 ses/día** | 78.000 | ~9.000 | 108.000 | 138k–222k | 135 GB | ⛔ **CPU de Supabase Free** |
| **10.000 ses/día** | 260.000 | ~30.000 | 360.000 | 460k–740k | 450 GB | ⛔ todo |
| **Pico tipo lanzamiento (2.600)** | ~68.000 | ~7.800 | ~93.000 | 120k–190k | 117 GB | ⛔ CPU + egress |

### **¿QUÉ SE ROMPE PRIMERO?**
⛔ **La CPU compartida de Supabase Free.** El incidente 522 del 2026-08-03 ocurrió **en Pro**;
en Free el margen es menor. **[INFERENCE]** cede alrededor de **1.000–3.000 sesiones/día**.

### **¿QUÉ SE VUELVE CARO PRIMERO?**
⛔ **Upstash**, y **no es lo mismo**. Es lineal y sin techo: a 3.000 sesiones/día son
138k–222k comandos/día ≈ **4–6,6 M/mes ≈ $80–130/mes**. **Rompe la economía antes de romper
nada técnico.**

⚠️ **Esa diferencia es el hallazgo operativo de la parte 13: lo que se cae y lo que te arruina
son sistemas distintos, y la factura no avisa.**

---

## PARTE 14 — Disciplina de load test previo al lanzamiento (sólo diseño)

```
1 usuario  →  10 concurrentes  →  100 concurrentes  →  tráfico sintético tipo lanzamiento
```

En cada escalón medir: requests, escrituras a DB, **comandos de Redis** (el eje económico),
filas de telemetría, llamadas RPC, latencia p50/p95, errores, y **costo proyectado por
proveedor**.

⛔ **La salida no es un informe: son tres umbrales de corte** decididos **antes** de abrir el
grifo — comandos de Redis/día, filas de analítica/día y CPU de Supabase.

⚠️ **Cada escalón debe reportar comandos de Redis POR SESIÓN, no en total.** Un total sube con
el tráfico y no dice nada; el ratio por sesión es lo que delata un caché que se consulta en cada
render — y ése es el defecto que hoy pagamos.

---

## PARTE 15 — Controles de gasto

| Proveedor | Alertas | Límite blando | **Límite duro** | Kill switch |
|---|---|---|---|---|
| **Vercel** | Sí | Spend Management (**sólo Pro**) | ⚠️ Hobby: pausa al exceder | Pausar proyecto |
| **Supabase** | Sí | — | ⛔ **Free: se detiene; Pro: cobra** | Pausar proyecto |
| **Upstash** | Sí | Cuota mensual configurable | ✅ **Sí, por comandos** | Deshabilitar base |
| **Railway** | Sí | ⚠️ **[UNKNOWN]** si hay tope duro | **[UNKNOWN]** | Borrar servicio |

⛔ **Railway es el hueco.** Es facturación por uso, y **[UNKNOWN]** si permite un límite duro.
**Antes de migrar hay que confirmarlo** — irse a un proveedor con menos frenos que el actual
sería empeorar el riesgo mientras se baja la factura.

**Comportamiento deseado ante un pico:** alertar → degradar (apagar telemetría no esencial,
subir TTL de cachés) → tope duro. ⚠️ **La degradación ya existe a medias y a favor:** la
telemetría descarta en fallo por diseño.

---

## PARTE 16 — Escenarios

| Escenario | Vercel | Supabase | Upstash | Railway | **TOTAL/mes** | Esfuerzo | Riesgo | Complejidad | Headroom |
|---|---:|---:|---:|---:|---:|---|---|---|---|
| **ACTUAL** | $20 **[FACT]** | $20 **[FACT]** | $5–8 **[FACT]** | $5 **[FACT]** | **$50–53** | — | — | media | alto |
| **SUPABASE-FIRST** | $20 | **$0** | $5–8 | $5 | **$30–33** | ⚠️ **casi cero** | **BAJO** | igual | ⚠️ menor (CPU) |
| **CHESSCITO LOW-COST** | **$0** ⚠️ *(si nada comercial queda)* | $0 | $2–4 | **~$10** | **$12–14** | MEDIO | MEDIO | mayor | medio |
| **MÍNIMO AGRESIVO** | $0 | $0 | **$0** *(Redis en Railway)* | **~$11** | **~$11** | ALTO | ⛔ **ALTO** | alta | bajo |

⛔ **El mínimo agresivo no baja de ~$11**, porque tres servicios Node siempre encendidos son
~$10 de RAM en Railway. **No existe un escenario responsable de $5.**

⚠️ **Y el escenario CHESSCITO LOW-COST depende de una premisa que no puedo verificar:** que
ningún otro proyecto comercial quede en el equipo de Vercel. Si queda uno, ese $0 vuelve a ser
$20 y el total sube a **$32–34** — con lo cual **migrar Chesscito habría agregado costo, no
quitado**.

---

## PARTE 17 — Acciones por ROI

| # | Acción | **Ahorro/mes** | Esfuerzo | Riesgo | Tiempo | Reversible |
|---|---|---:|---|---|---|---|
| **1** | **Supabase Pro → Free** | **$20** | ⚠️ **~0** *(ya cabe)* | MEDIO *(CPU)* | **hoy** | ✅ **inmediato** |
| **2** | **Reducir cachés de Upstash** | **$3–5** | MEDIO | BAJO | ~1 semana | ✅ |
| **3** | Chesscito → Railway **+ Vercel a Hobby** | **$20 − $7 = $13** ⚠️ *(condicionado)* | MEDIO | MEDIO | 1–2 semanas | ✅ |
| 4 | Desacoplar `/stats` a agregados | **$0 hoy** | ALTO | BAJO | ~1 semana | ✅ |
| 5 | Encoger físicamente (copia+swap, 7 d) | **$0 hoy** | BAJA | MEDIO | ~1 día | ✅ |
| 6 | Redis a Railway | $2–4 | MEDIO | MEDIO | ~1 semana | ✅ |
| 7 | Unificar PLAY+LEARN en un servicio | ~$3 | ALTO | MEDIO | ~2 semanas | ⚠️ |

⛔ **Las acciones 4 y 5 ahorran CERO dólares hoy** y son las que el brief ponía en el centro.
**Son seguro**, no ahorro: mantienen a Supabase dentro de Free cuando la analítica crezca (+3,7
MB/día → el tope llega en ~82 días sin ellas).

---

## PARTE 18 — Congelamiento de producto

⛔ **Nada de esta auditoría toca:** estado de usuario, progreso, scores, Peones, PRO, compras,
pagos, victorias, P2P congelado, la instrumentación del Lote 1 (5 de ~200 observaciones), ni la
reproducibilidad del archivo. **Cero features, cero economía, cero precios.**

---

## PARTE 19 — Secuencia recomendada

⚠️ **Reordeno respecto del brief, y la razón es que el dinero está donde no se esperaba.**

```
0.  Contestar DOS preguntas (bloquean $40/mes y no cuestan nada)
    ├── ¿Por qué Supabase está en Pro?  ¿backups, CPU, la pausa?
    └── ¿Queda algún proyecto COMERCIAL en el equipo de Vercel?
1.  Supabase Pro → Free            → $20/mes, HOY, reversible al instante
2.  Reducir cachés de Upstash      → $3–5/mes, ~1 semana
3.  Confirmar el tope duro de Railway   → antes de migrar nada
4.  Chesscito → Railway + Vercel Hobby  → $13/mes neto, condicionado
5.  Encoger físicamente a 7 días        → seguro, no ahorro
6.  Desacoplar /stats a agregados       → seguro, no ahorro
7.  Costo/sesión + load test + topes    → prevención
```

⛔ **El paso 0 no es burocracia: son dos preguntas que valen $40/mes y que sólo vos podés
contestar.** Si Supabase está en Pro por una razón real, el paso 1 muere. Si queda un proyecto
comercial en Vercel, el paso 4 **agrega** costo en vez de quitarlo.

---

```
CURRENT MONTHLY FLOOR:
$50–53  [FACT, del founder]

TARGET SAFE MONTHLY FLOOR:
$12–14  [ESTIMATE]   ⛔ NO $5–10: tres servicios Node en Railway son ~$10 de RAM

EXPECTED MONTHLY SAVING:
$36–41  [ESTIMATE], de los cuales $20 son de riesgo bajo y disponibles casi hoy

SUPABASE FREE:
READY AFTER EGRESS CHECK — el tamaño ya cabe (197 de 500 MB); egress es [UNKNOWN]

FASTEST SAFE SUPABASE SAVING:
Bajar a Free tal como está. NO hace falta encoger nada primero: ya cabe.

CHESSCITO VERCEL EXIT:
EASY — cero paquetes @vercel/*, sin vercel.json, sin rutas edge, next/image usado
cero veces. Una sola atadura de runtime: x-vercel-ip-country.

RAILWAY FOR CHESSCITO:
CONDITIONAL — técnicamente sí (~$7/mes por dos servicios). Condicionado a que
Vercel pueda bajar a Hobby; si no, se suma costo en vez de restarlo.

RAILWAY FOR FACILITATOR + CHESSCITO:
YES — ~$10/mes [ESTIMATE]. ⛔ NO $5.

VERCEL SHOULD REMAIN THE DEFAULT EXPERIMENT PLATFORM:
YES — pero sólo ahorra si NINGÚN proyecto que quede es comercial.

UPSTASH:
REDUCE — rate limiting, mutex e idempotencia son necesidad real. Los cachés de
lectura son conveniencia y son ~55% del volumen.

CURRENT COST PER SESSION:
~$0,0093 (0,93 ¢) [ESTIMATE] · objetivo ~$0,0019 (0,19 ¢)
⚠️ Es casi todo piso fijo, no marginal.

FIRST BOTTLENECK AT LAUNCH-LIKE LOAD:
La CPU compartida de Supabase Free, alrededor de 1.000–3.000 sesiones/día.
⚠️ Pero lo que se vuelve CARO primero es Upstash, y son sistemas distintos:
a 3.000 ses/día son $80–130/mes de comandos.

TOP 3 ACTIONS IN ORDER:
1. Supabase Pro → Free (tras verificar egress y por qué está en Pro) — $20/mes
2. Reducir cachés de Upstash — $3–5/mes
3. Chesscito → Railway + Vercel a Hobby — $13/mes neto, condicionado

WHAT CAN SAVE MONEY THIS WEEK:
Supabase → Free ($20) y el recorte de cachés de Upstash ($3–5). $23–25/mes,
sin migrar nada de runtime.

WHAT CAN BE DONE TODAY:
Contestar las dos preguntas del paso 0, leer el egress en el panel de Supabase, y
confirmar si Railway admite un tope duro de gasto. Cero código.

WHAT MUST NOT BE TOUCHED:
La instrumentación del Lote 1 (5 de ~200); P2P congelado; el rate limiting, los
mutex y la idempotencia de Redis; el estado de producto (~22 MB); las 9 RPC
stats_* mientras /stats siga leyendo crudo; precios, PRO y pagos.
```

---

# NOT READY — NEEDS EGRESS, VERCEL COMMERCIAL SCOPE, AND RAILWAY HARD-LIMIT

⛔ **La arquitectura está diseñada; lo que falta son tres datos que no puedo medir y que
deciden si el plan ahorra o cuesta:**

1. **Egress de Supabase contra el tope de 5 GB.** No es medible por SQL; está en el panel. Es el
   único eje que podría bloquear el ahorro más grande y más barato.
2. **¿Queda algún proyecto comercial en el equipo de Vercel?** Si sí, sacar a Chesscito
   **agrega** ~$7/mes en vez de quitar $20. **Invierte el signo del paso 4.**
3. **¿Railway admite un límite duro de gasto?** Migrar a un proveedor con menos frenos que el
   actual sería cambiar una factura alta por una impredecible.

⚠️ **Lo que SÍ está listo y no depende de los tres:** la evidencia de que **Supabase ya cabe en
Free hoy**, y de que **la salida de Vercel es técnicamente fácil**. Si el egress da bien, el
paso 1 se puede ejecutar esta semana y vale $20/mes por sí solo.

⛔ **Nada se ejecuta sin traértelo antes.**
