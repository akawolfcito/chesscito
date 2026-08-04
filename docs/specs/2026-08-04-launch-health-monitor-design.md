# Monitor operativo de lanzamiento — diseño

**Fecha:** 2026-08-04 · **Estado: ✅ IMPLEMENTADO** en seis commits (§0).

> ## 📄 Documento operativo vigente
>
> Para **usar** el monitor, leé **[`docs/runbooks/launch-health-monitor.md`](../runbooks/launch-health-monitor.md)**.
> Este archivo es el registro de diseño: qué se probó antes de escribir código, qué se
> decidió y por qué. Se conserva porque explica los *porqués* que el runbook da por
> sentados — sobre todo los límites de observabilidad de cada proveedor.

---

## 0. Estado de implementación

| Commit | Qué entregó |
|---|---|
| `89fc70e0` | `feat(ops): add read-only Supabase health collector` |
| `b4435a86` | `feat(ops): add Vercel and Upstash health collectors` |
| `503dfba4` | `test(exercises): derive the tap-prompt wait from the panel's own timing` — flake destapado por la carga de los tests nuevos, arreglado aparte |
| `f336364a` | `feat(ops): add health classification and snapshots` |
| `eab10c33` | `feat(ops): add pnpm ops:health command` |
| `22b4e443` | `docs(ops): add launch health monitor runbook` |

**Entregado:** `pnpm ops:health` → informe en consola, par de artefactos en
`artifacts/ops/`, diff contra el snapshot anterior, exit codes 0/1/2 (+3 para fallo del
propio monitor). Solo lectura. ~10 s por corrida. 174 tests.

### Decisiones cerradas durante la implementación

| Pregunta abierta en §10 | Resolución |
|---|---|
| ¿`artifacts/ops/` se versiona? | **Gitignoreado.** Datos operativos con ritmo de minutos; se versiona solo el código y el runbook |
| ¿Un eje no observable puede dar verde? | **No.** `GREEN (partial)` con el conteo de ejes sin medir. Un rojo observado **sigue siendo rojo** por más ejes que falten |
| ¿Colectores opcionales? | **Se activan solos** cuando aparecen `VERCEL_TOKEN` o `UPSTASH_EMAIL`+`UPSTASH_API_KEY`. Sin ellos reportan `not_observable` con la ruta del panel para leerlo a mano |

### Decisión que NO estaba en el diseño y salió de correrlo

**`not_configured` vs `unreachable`.** Correr el monitor desde un checkout limpio lo
destapó: sin credenciales reportaba **ROJO, exit 2**, sobre una base perfectamente sana.
El clasificador leía "no hay medición" como "la base no responde", y son hechos
distintos — *nunca preguntamos* vs *preguntamos y no contestó*. Solo el segundo dice algo
sobre producción. Corregido en `eab10c33`, con tres tests que lo fijan.

---

**Lo que sigue es el diseño tal como se aprobó**, incluida la auditoría de capacidades
que lo fundamentó. No se reescribió: los hallazgos de medición valen como registro de lo
que se probó y cuándo.

---

## 1. Auditoría de disponibilidad (probado, no supuesto)

### 1.1 Supabase — ✅ TODO alcanzable

`psql` local no existe, pero **docker sí**, y el pooler responde:

```
aws-1-us-east-1.pooler.supabase.com:5432   →  OK 2026-08-04 03:55:05+00
```

Usuario `postgres.<ref>`, `sslmode=require`, session mode. Coincide con lo ya documentado
(`aws-0` no resuelve; el host directo es IPv6-only).

Probé **las 13 métricas pedidas, una por una**:

| Métrica | Estado | Muestra real |
|---|---|---|
| `select now()` | ✅ | responde |
| Tamaño de la base | ✅ | 82 MB |
| Heap / índices de `analytics_events` | ✅ | 20 MB / 41 MB |
| Total de filas | ✅ | 99.542 |
| Eventos por hora, 24 h | ✅ | 16 buckets |
| Eventos/sesiones/día, 8 días | ✅ | 9 días |
| Top 20 eventos | ✅ | 20 filas |
| `pg_stat_user_tables` | ✅ | `1531 / 0 / null` |
| `pg_stat_user_indexes` | ✅ | los 8 índices |
| `cron.job` | ✅ | 1 job |
| `cron.job_run_details` | ✅ | **4 corridas** — cierra la pregunta 6 |
| `pg_stat_activity` | ✅ | 27 conexiones |
| `pg_stat_statements` | ✅ | **ya habilitado, 152 filas** — no hay que activar nada |

**Ningún dato de Supabase queda fuera.**

### 1.2 Vercel — ⚠️ parcial

| Fuente | Estado |
|---|---|
| `vercel ls --prod`, `vercel inspect` | ✅ deployment actual, estado, target, alias, edad |
| `vercel logs <url> --json` | ✅ rutas, status, `requestId`, líneas de log estructuradas |
| **`vercel usage`** | ❌ **`Error: Costs not found (404)`** — el plan Hobby no expone el endpoint de costos |

**Consecuencia:** invocations totales y Fluid Active CPU **no salen del CLI**. Los logs son
una **muestra de ventana corta** (~50 entradas, minutos), útil para *tasa de error por
ruta* y *mezcla de rutas*, inútil como contador acumulado del período de facturación.

⚠️ Y el `--json` **duplica cada request** (misma `requestId` y mismo `id`). Verificado en
esta serie: cualquier conteo debe deduplicar o infla al doble.

### 1.3 Upstash — ⚠️ parcial, y con una trampa

| Fuente | Estado |
|---|---|
| REST data plane (`UPSTASH_REDIS_REST_URL/TOKEN`) | ✅ configurado y responde |
| `DBSIZE` | ✅ **5.799 claves** — determinista |
| `INFO` (`used_memory`, `total_commands_processed`, hits/misses, clients) | ⚠️ responde, **pero no es confiable** |
| **Management API** (uso mensual vs cuota de 500 K) | ❌ **faltan `UPSTASH_EMAIL` + `UPSTASH_API_KEY`** |

**La trampa, medida:** dos llamadas a `INFO` con segundos de diferencia devolvieron
`total_commands_processed` = **67.615** y luego **295.319**; `used_memory` = 16 KB y luego
32 KB. Upstash rutea a nodos distintos y el contador es **por nodo**, no global.

> **Por lo tanto NO voy a derivar el % de cuota mensual desde `INFO`.** Sería un número
> con aspecto de métrica y comportamiento de ruido — exactamente lo que un monitor no debe
> producir. Va marcado **no observable** hasta que existan credenciales de management.

---

## 2. Hallazgo material de la auditoría (cambia una conclusión previa)

Aproveché los probes para responder la pregunta abierta del régimen de crecimiento:

```
dia   | eventos | sesiones | ev/sesión
08-04 |   1.580 |       78 |  20,3
08-03 |  46.337 |    1.930 |  24,0   ← pico real de tráfico
08-02 |      64 |        7 |   9,1
08-01 |      96 |        3 |  32,0
07-31 |      84 |        6 |  14,0
07-30 |     163 |       22 |   7,4
07-29 |     893 |       51 |  17,5
07-28 |     479 |       19 |  25,2
07-27 |     734 |      135 |   5,4
```

**La brecha de 102× era tráfico real, no escrituras perdidas.** El 08-03 hubo 1.930
sesiones contra decenas los días previos. El promedio de 1.059/día estaba diluido por ~90
días tranquilos.

Dos consecuencias:

- **`eventos/sesión = 24,0` en el día de pico → VERDE** (umbral 35). El instrumento no
  está desbocado; el volumen es tráfico genuino.
- **Proyección a 90 días sosteniendo 46 K/día:** ~4,1 M filas ≈ 860 MB de heap + ~1,8 GB
  de índices ≈ **2,7 GB**. Verde por umbral, pero **a un solo día pico de distancia del
  amarillo**. Es justamente lo que el monitor debe vigilar.

---

## 3. Arquitectura propuesta

```
scripts/ops/launch-health-snapshot.ts        ← entrada, orquesta y clasifica
scripts/ops/collectors/supabase.ts           ← docker psql, 1 sesión, N queries
scripts/ops/collectors/vercel.ts             ← CLI (ls/inspect/logs) + REST si hay token
scripts/ops/collectors/upstash.ts            ← REST data plane + latencia medida
scripts/ops/lib/redact.ts                    ← allow-list de salida (§5)
scripts/ops/lib/classify.ts                  ← umbrales VERDE/AMARILLO/ROJO
scripts/ops/lib/render.ts                    ← consola + Markdown
scripts/ops/lib/snapshot-store.ts            ← artifacts/, latest.*, diff previo
docs/runbooks/launch-health-monitor.md       ← runbook
```

**Decisiones:**

1. **Un solo contenedor docker por corrida.** Los probes tardaron ~5 s cada uno por el
   arranque; el colector manda **todas las queries en una sesión** con un único `psql`,
   separadas por `\gset`/salida JSON. Objetivo: < 15 s en total.
2. **`row_to_json` en el servidor** → el script parsea JSON, no texto tabulado. Sin
   parsers frágiles.
3. **Colectores independientes con `Promise.allSettled`.** Un proveedor caído marca su
   bloque `not_observable` y no arrastra a los otros. Timeouts: Supabase 20 s, Vercel 25 s,
   Upstash 10 s.
4. **Sólo lectura, garantizado por construcción:** cada query pasa por un guard que
   rechaza `insert|update|delete|drop|alter|create|truncate|vacuum|reindex|grant|revoke|
   pg_stat_reset` antes de ejecutarse. Un test lo cubre.
5. **Sin dependencias nuevas.** `tsx` ya está; docker y el CLI de Vercel ya están. No
   agrego `pg`.

**Exit codes:** `0` verde · `1` amarillo · `2` rojo · `3` fallo del propio monitor
(distinto de rojo: "no pude medir" ≠ "está mal").

---

## 4. Credenciales

### Ya presentes (`apps/web/.env.local`) — nada que crear

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | derivar el project ref |
| `SUPABASE_DB_PASSWORD` | conexión al pooler |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | `DBSIZE` + latencia |

`SUPABASE_SERVICE_ROLE_KEY` **no se usa** — el monitor no toca PostgREST.

### Opcionales, desbloquean lo que hoy falta

| Variable | Qué desbloquea | Sin ella |
|---|---|---|
| `VERCEL_TOKEN` | invocations y Active CPU reales vía REST | CPU y cuota = **no observable** |
| `UPSTASH_EMAIL` + `UPSTASH_API_KEY` | uso mensual vs 500 K | cuota = **no observable** |

El informe imprime `configurada: sí/no` por credencial. **Nunca el valor, ni la URL con
token, ni el connection string.**

---

## 5. Qué NO se puede obtener hoy

| Métrica | Motivo | Qué hacer |
|---|---|---|
| **Vercel invocations totales** | `vercel usage` → 404 en Hobby | `VERCEL_TOKEN` + REST, o copiar del panel |
| **Fluid Active CPU y % de cuota** | ídem | ídem |
| **Días hasta agotar CPU** | depende de lo anterior | se calcula solo cuando exista el dato |
| **Upstash: comandos del período y %** | falta management API; `INFO` es por nodo (§1.3) | `UPSTASH_EMAIL`+`UPSTASH_API_KEY`, o copiar del panel |
| **Upstash: bandwidth** | no está en el data plane | panel |
| **Upstash: comandos por hora/día** | no hay serie temporal en REST | panel |
| Vercel: invocations por ruta (totales) | los logs son muestra corta | se reporta como **muestra**, con su ventana explícita |

Cada uno sale en el informe bajo **"Datos no observables"** con la instrucción exacta de
qué copiar del panel. **No habrá scraping del dashboard.**

---

## 6. Privacidad

- **Allow-list de salida**, no deny-list: el renderer sólo emite campos declarados.
- `session_id` → `sha256(id + LOG_SALT)[0..12]`. Nunca completo. Reusa `hashWallet` en
  espíritu; el top-20 de sesiones sale hasheado.
- Sin wallets, sin `account_ref`, sin `props`, sin tokens, sin connection strings.
- El connection string vive en la env del contenedor (`-e PGCONN=…`), nunca en `argv` —
  así no aparece en `ps` ni en un log de comando.
- Un test verifica que ningún artefacto generado contenga `0x[0-9a-f]{40}`, `postgresql://`
  ni las credenciales conocidas.

---

## 7. Ejemplo del informe (datos reales de hoy, formato definitivo)

```
╔══════════════════════════════════════════════════════════════════════╗
║  CHESSCITO — LAUNCH HEALTH            2026-08-04T03:58:12Z           ║
║                                       2026-08-03 22:58:12 (Bogotá)   ║
║  ESTADO GLOBAL:  🟢 VERDE                            exit code 0     ║
╚══════════════════════════════════════════════════════════════════════╝

SUPABASE                                                    ✅ observable
  now()                    2026-08-04 03:55:05+00      (responde, 240 ms)
  base                     82 MB
  analytics_events         20 MB heap + 41 MB índices = 61 MB
  filas                    99.542            (+1.015 desde snapshot previo)
  ingesta última hora      1.580 ev/h                      [umbral 6.500]
  eventos/sesión (24 h)    24,0                            [umbral 35] ✅
  crecimiento estimado     46.337 filas/día  (pico 08-03)
  proyección física        30 d: 0,9 GB │ 45 d: 1,4 GB │ 90 d: 2,7 GB
                                                     [amarillo ≥4 GB] ✅
  cron poda                prune_analytics_events_monthly · active
    últimas corridas       4 registradas · última: succeeded 2026-08-01 03:00
  autovacuum               n_live 1.531 · n_dead 0 · último: null ⚠️ post-reset
  conexiones               27 (activas + idle)
  pg_stat_statements       habilitado · 152 statements

  top eventos 24 h         app_opened 8.412 │ hub_view 6.201 │ …

VERCEL                                                   ⚠️ parcial
  chesscito                dpl_3Bff4Cx… ● Ready · production · 986bb383
  lite-chesscito           dpl_46vK7Zu… ● Ready · production · 986bb383
  muestra de logs          ventana 2,9 min · 50 requests (deduplicados)
    5XX por ruta           /api/welcome-pack/status 5 · resto 0
    /api/telemetry         21 req · 0 errores
  ─ invocations totales    ⛔ no observable (falta VERCEL_TOKEN)
  ─ Active CPU y % cuota   ⛔ no observable
  ─ días hasta agotar CPU  ⛔ no observable

  BATCHING (validación de Fase 1)
    filas analytics 24 h   46.337
    requests telemetry     ⛔ no observable → ratio no calculable
    ratio en la muestra    46.337 filas / 21 req ≈ 20,7 ev/req  (muestra corta)

UPSTASH                                                  ⚠️ parcial
  claves (DBSIZE)          5.799
  latencia PING            41 ms
  ─ comandos del período   ⛔ no observable (falta management API)
  ─ % de 500 K             ⛔ no observable
  ─ bandwidth              ⛔ no observable

CAMBIOS DESDE EL SNAPSHOT ANTERIOR (2026-08-04T02:41:03Z)
  filas analytics          98.527 → 99.542        (+1.015, +1,0 %)
  tamaño total             61 MB → 61 MB          (sin cambio)
  claves Upstash           5.780 → 5.799          (+19)
  deployments              sin cambio

CAPACIDAD RESTANTE
  disco Supabase           82 MB / 8 GB           (1,0 %)
  margen a 90 días         2,7 GB proyectado      (34 % del disco)
  Upstash claves           5.799                  (sin cuota observable)

ACCIONES RECOMENDADAS  (ninguna ejecutada)
  1. Poda diaria en vez de mensual. A 46 K filas/día la corrida del
     1-sep borraría ~1,4 M filas en una transacción.
  2. Definir VERCEL_TOKEN para desbloquear CPU e invocations.
  3. Definir UPSTASH_EMAIL/API_KEY para desbloquear la cuota.

DATOS NO OBSERVABLES  (copiar del panel si se necesitan)
  · Vercel → Usage → Fluid Active CPU (GB-hrs y % del plan)
  · Vercel → Usage → Function Invocations del período
  · Upstash → Console → Usage → Commands (mes) y Bandwidth
```

---

## 8. Umbrales — con dos matices que quiero confirmar

Implemento tal cual los definiste, con dos aclaraciones:

| Regla | Matiz propuesto |
|---|---|
| «>6.500 eventos/h durante 2 h» → amarillo | Requiere **dos buckets horarios consecutivos** por encima. Un pico aislado no dispara. Con una sola corrida no hay historia suficiente → uso los buckets de `events/hour` de la propia query, que sí cubren 24 h. ✅ resoluble |
| «Vercel CPU ≥80 %» | **Hoy no observable.** Propongo: si no hay `VERCEL_TOKEN`, este eje **no puede poner verde** — el estado global se marca `VERDE (parcial)` y el informe lo dice. Un monitor que dice "verde" sin haber mirado el eje más caro es peor que no tenerlo |
| «Upstash ≥70 %» | mismo tratamiento |
| «522 generalizados» | Definición operativa: **≥3 rutas distintas** con 5XX cuyo `error_class = html_gateway_error` en la muestra de logs, **o** `select now()` con latencia >5 s |
| «pocas sesiones generan cientos de eventos» | Operativo: **p95 de eventos por sesión ≥ 200** en 24 h (sale del top-20 de sesiones) |

---

## 9. Plan de commits (tras tu aprobación)

| # | Commit | Contenido |
|---|---|---|
| 1 | `feat(ops): colector de Supabase read-only` | docker psql + guard anti-escritura + tests |
| 2 | `feat(ops): colectores de Vercel y Upstash` | CLI/REST, degradación a no-observable |
| 3 | `feat(ops): clasificación, render y snapshots` | umbrales, diff, `artifacts/ops/`, exit codes |
| 4 | `feat(ops): comando pnpm ops:health` | script en `package.json` + `.gitignore` de artefactos |
| 5 | `docs(ops): runbook del monitor` | `docs/runbooks/launch-health-monitor.md` |

---

## 10. Preguntas antes de escribir código — ✅ TODAS RESUELTAS

*(Se conservan con su resolución; el detalle está en §0.)*

1. ~~¿`artifacts/ops/` se commitea o se ignora?~~ → **Gitignoreado** (`eab10c33`).
2. ~~¿Conseguís `VERCEL_TOKEN` y las credenciales de management de Upstash?~~ →
   **Pendiente del founder**, y el monitor no espera: los colectores están escritos y se
   activan solos en cuanto existan. Mientras tanto reportan `not_observable` con la ruta
   exacta del panel. Es lo único que sigue abierto de todo el diseño.
3. ~~¿Confirmás que un eje no observable no puede reportar verde pleno?~~ → **Confirmado
   e implementado**: `GREEN (partial)` + conteo de ejes sin medir, y un rojo observado no
   se ablanda por más ejes que falten.

---

## 11. Lo único que queda abierto

**Los dos ejes de costo siguen sin medir**, y son precisamente por donde el proyecto
puede quedarse sin capacidad sin que aparezca ningún error:

| Credencial | Desbloquea |
|---|---|
| `VERCEL_TOKEN` | invocations del período y Fluid Active CPU |
| `UPSTASH_EMAIL` + `UPSTASH_API_KEY` | comandos del período, % de la cuota de 500 K, bandwidth |

Hasta entonces cada informe sale como `GREEN (partial)` y lista los dos con la ruta del
panel. No hace falta tocar código para activarlos.
