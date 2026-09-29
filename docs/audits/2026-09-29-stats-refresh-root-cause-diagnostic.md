# Diagnóstico read-only — stats refresh 503

Fecha: 2026-09-29 UTC. No se modificó producción ni configuración. No se ejecutaron migrations, DELETE, VACUUM, ANALYZE, ni EXPLAIN ANALYZE.

## RPC TIMINGS

Argumentos iguales a `POST /api/internal/stats/refresh`: `p_surface = NULL`, `p_container = NULL` (filtros all/all traducidos a null). Ejecución secuencial directa contra PostgreSQL, sesión configurada read-only y `statement_timeout = 8s`. Cada llamada contó las filas devueltas, sin exponer datos de sesión/wallet. Las duraciones son wall-clock de psql por sentencia (incluyen ida/vuelta DB); excluyen el establecimiento inicial de conexión. El transporte fue psql/PostgreSQL, no el HTTP de PostgREST usado por la app.

| RPC | Success | Duration por pasada | Timeout | Error |
|---|---:|---|---:|---|
| `stats_activation_funnel` | Sí, 3/3 | 4.752 s; 1.707 s; 0.201 s | 0 | Ninguno / SQLSTATE — |
| `stats_access_funnel` | Sí, 3/3 | 0.191 s; 0.193 s; 0.194 s | 0 | Ninguno / SQLSTATE — |
| `stats_retention` | Sí, 3/3 | 1.606 s; 0.195 s; 0.172 s | 0 | Ninguno / SQLSTATE — |
| `stats_account_lifecycle` | Sí, 3/3 | 0.366 s; 0.239 s; 0.224 s | 0 | Ninguno / SQLSTATE — |
| `stats_activity_trend` | Sí, 3/3 | 0.191 s; 0.185 s; 0.182 s | 0 | Ninguno / SQLSTATE — |

### Resumen de tres pasadas

| RPC | Min | Median | Max | Timeouts |
|---|---:|---:|---:|---:|
| `stats_activation_funnel` | 0.201 s | 1.707 s | 4.752 s | 0 |
| `stats_access_funnel` | 0.191 s | 0.193 s | 0.194 s | 0 |
| `stats_retention` | 0.172 s | 0.195 s | 1.606 s | 0 |
| `stats_account_lifecycle` | 0.224 s | 0.239 s | 0.366 s | 0 |
| `stats_activity_trend` | 0.182 s | 0.185 s | 0.191 s | 0 |

Clasificación por peor medición: activation **MARGINAL** (4–7 s); las otras cuatro **FAST** (<4 s). Ninguna llegó a AT RISK (7–8 s) ni TIMEOUT (>=8 s). Hay variabilidad marcada en activation y retention, pero no se reprodujo el límite de producción.

## DB LATENCY

Cinco muestras secuenciales de cada consulta, en una sesión read-only. Cada tiempo es el `Time:` de psql para la sentencia.

| Query | Muestras (ms) | Min | Median | Max |
|---|---|---:|---:|---:|
| `select now()` | 72.882, 68.744, 67.500, 67.706, 72.139 | 67.500 ms | 68.744 ms | 72.882 ms |
| `select 1` | 68.533, 67.411, 71.261, 68.118, 67.663 | 67.411 ms | 68.118 ms | 71.261 ms |

La lectura anterior de health (`select now()` = 5.889 s) no se reprodujo: las cinco muestras actuales quedaron entre 67 y 73 ms. Es una señal de salud puntual, no un benchmark ni evidencia de que la latencia alta no vuelva.

## REDIS

Consultas REST read-only, sin GET del payload del snapshot:

| Check | Resultado | Latencia |
|---|---|---:|
| PING #1 | PONG / HTTP 200 | 344.9 ms |
| PING #2 | PONG / HTTP 200 | 204.1 ms |
| PING #3 | PONG / HTTP 200 | 68.1 ms |
| GET `stats:public:refresh-lock:v1` | HTTP 200, sin valor | 69.5 ms |
| EXISTS `stats:public:all-all:v1` | HTTP 200, existe | — |
| TTL snapshot | HTTP 200, `-1` (sin expiración Redis) | — |
| STRLEN snapshot | HTTP 200, 4,283 bytes | — |

El snapshot existe y no está expirando por TTL. En el GET público previo de `/stats` se mostró `refreshedAt = 2026-09-28 13:48 UTC`. Un GET posterior de `/stats` desde esta sesión terminó en reset de conexión del cliente (`HTTP 000`, 15.02 s); por ello, la última confirmación HTTP 200 sigue siendo la lectura anterior (200 en 1.668 s). Redis REST está accesible y las operaciones de lectura fueron exitosas; no se reproduce una causa Redis para el 503.

## ENDPOINT: MAPA DE 503

Route: `apps/landing/src/app/api/internal/stats/refresh/route.ts`.

| Cause | HTTP | Detalle |
|---|---:|---|
| Refresh secret ausente/incorrecto | 401 | No es 503. |
| `getStatsRedis()` devuelve null | 503 | `{ error: "Snapshot storage unavailable" }`. |
| Alguna RPC requerida devuelve error/no-array/null o expira a 8 s | 503 | La llamada individual retorna null; el snapshot candidato queda incompleto y responde `reason: "incomplete_snapshot"`. |
| Candidato estructuralmente incompleto / RPC requerida marcada failed | 503 | `{ refreshed: false, reason: "incomplete_snapshot" }`; snapshot anterior preservado. |
| Timeout fase `lock_cooldown` (5 s), `stats_rpcs` (30 s) o `redis_write` (5 s) | 503 | `{ reason: "phase_timeout", phase }`; snapshot anterior preservado. Una RPC individual que agota 8 s normalmente retorna null y sigue la ruta `incomplete_snapshot`, no necesariamente `phase_timeout`. |
| Error Redis al adquirir lock/cooldown, publicar o error inesperado durante build | 503 | `{ reason: "refresh_failed" }`; log sólo incluye `name`, no texto de error/SQLSTATE. |
| Redis eval de publish falla por excepción | 503 | `refresh_failed`; si vence el presupuesto de escritura, `phase_timeout` con `phase: "redis_write"`. |
| Lock de refresh ocupado | 409 | No es 503. |
| Cooldown de refresh activo | 429 | No es 503. |

No se hizo POST contra el endpoint: el entorno local no tenía `STATS_REFRESH_URL` ni `STATS_REFRESH_SECRET`; tampoco se lanzó rerun de GitHub.

## EXPLAIN SIN ANALYZE

La RPC más lenta fue `stats_activation_funnel` (4.752 s, marginal). Se leyó la definición viva con `pg_get_functiondef`; sus filtros all/all recorren el rango `created_at >= now() - interval '30 days'` y agrupan por `session_id` con agregaciones booleanas.

Plan de su consulta interna con `EXPLAIN (COSTS TRUE)`, sin ANALYZE:

- `Index Scan using idx_analytics_events_created_at` con `Index Cond` en `created_at >= now() - interval '30 days'`.
- Estimación de entrada: **128,326 filas**; `HashAggregate` estima **5,642** grupos/cohortes.
- No apareció un Seq Scan de tabla completa en este plan.
- Índices existentes relevantes: `idx_analytics_events_created_at`, `idx_analytics_events_session`, `idx_analytics_events_event`; índices por superficie, container, país y account_ref.
- No hay filas/tiempos reales del plan porque no se hizo ANALYZE. El conteo de filas de la RPC fue 4 (forma viva actual).

El plan usa el índice temporal esperado y las estadísticas se habían actualizado con ANALYZE reciente. La estimación no demuestra duración real ni causalidad; activation tuvo dispersión (0.201–4.752 s). No se consideró necesario explicar las otras RPC: sus máximos fueron inferiores a 1.61 s.

## OBSERVABILIDAD DEL ROUTE

El route registra:

- Fase `auth`, duración y outcome.
- Fases `lock_cooldown`, `stats_rpcs`, `redis_write` y `total`, con duración y outcome.
- Por RPC: nombre, duración y outcome (`success`, `timeout`, `error`).
- Timeout de fase con nombre de fase; refresh genérico con `error.name`.

No registra SQLSTATE, código de PostgREST, mensaje sanitizado, ni lista `failedRpcs` en el log de `incomplete_snapshot`. El workflow usa `curl --fail --silent` y sólo dejó `curl: (22) ... 503`; no capturó el body. Logs de Vercel filtrados por `stats/refresh` y 5XX no devolvieron filas para el período consultado.

Logging mínimo recomendado, aún no implementado:

1. En `incomplete_snapshot`, registrar sólo la lista allow-listed de RPC fallidas y outcome (`timeout`/`error`), correlacionada por request ID.
2. Para errores RPC/Redis, añadir código estable/SQLSTATE y fase; recortar/sanitizar mensaje, sin parámetros, headers, secretos ni datos de usuario.
3. Hacer que el workflow capture status y un body limitado/redactado del endpoint para errores no-2xx, manteniendo secretos fuera de logs.

## TELEMETRY PRODUCTION STATE

Se consultó el bundle JavaScript público servido por `play.chesscito.com`, no la configuración/secrets de Vercel. El fragmento desplegado compila el gate como `if(!f("0") ...)`; `f("0")` es false. Por tanto, `NEXT_PUBLIC_TELEMETRY_ENABLED` quedó en **`0` y el cliente está OFF** en el deployment público inspeccionado. Esto confirma el valor público efectivo sin cambiar env ni inferirlo por la ausencia de eventos.

## MOST LIKELY FAILING COMPONENT

**NOT REPRODUCIBLE** — cinco lecturas pequeñas y quince RPC secuenciales tuvieron éxito; Redis estuvo accesible, el snapshot existe, y ningún RPC llegó a 8 s. El componente histórico exacto del 503 sigue **UNKNOWN**: no se capturó el body del endpoint y no hubo logs de función disponibles.

## ROOT CAUSE

**LIKELY / UNKNOWN.** La causa original no queda confirmada. La RPC más sospechosa por duración es `stats_activation_funnel`, cuyo primer run fue marginal a 4.752 s y el plan estima leer 128,326 filas; aun así, sus dos repeticiones fueron 1.707 s y 0.201 s, y no hubo timeout. El dato anterior de 5.889 s de DB tampoco se reprodujo. Redis queda razonablemente descartado como problema actual, no como causa histórica concluyente.

## NEXT ACTION

1. Capturar en el siguiente fallo el `reason`/body HTTP y la lista de RPC fallidas con SQLSTATE/código sanitizado.
2. Si vuelve a fallar activation o se acerca a 8 s, repetir mediciones secuenciales y revisar EXPLAIN sin ANALYZE bajo el mismo estado de carga.
3. No cambiar cron, Redis, env, migrations o telemetry hasta contar con el motivo del endpoint para un fallo concreto.
