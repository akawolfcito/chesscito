# Validación del wrapper de canary DELETE de analytics_events

**Fecha:** 2026-09-28\
**Destino de las pruebas:** proyecto configurado `brsbdzpuvotxsadmcxyj`, base `postgres`\
**Alcance:** validar control transaccional sin escribir en tablas persistentes\
**Resultado:** **WRAPPER READY** para un canary único cuando se autorice por separado

## Resumen

Se identificó y corrigió el fallo del wrapper temporal: el runner de la ronda no activaba `\timing on`, pero esperaba parsear una línea `Time:`. Por eso no pudo verificar la duración del primer DELETE y envió ROLLBACK. El conteo READ-ONLY posterior permaneció en 5,187.

El control validado mide el tiempo de ida y vuelta del comando con `time.monotonic_ns()` en el proceso Python; captura filas desde un resultado SQL agregado de `DELETE ... RETURNING`; inspecciona `:ERROR`, `:SQLSTATE` y `:ROW_COUNT` de psql después de cada sentencia; y envía COMMIT o ROLLBACK de forma separada, esperando el acuse correspondiente antes de continuar/cerrar.

No se ejecutó DELETE en `analytics_events`. Las pruebas de DML usaron sólo tablas temporales de sesión y terminaron con ROLLBACK, salvo el test aislado de COMMIT sobre una tabla temporal, que se verificó y luego se eliminó antes de cerrar la sesión.

## Diagnóstico del fallo anterior

1. El runner de la última ronda invocó psql por Docker con stdin abierto y marcadores `\echo`; enviaba transacción y CTE, pero **no activaba `\timing on`** antes de buscar `Time: ...`. Por tanto, el parser recibía la fila de resultado pero no una duración y trataba el resultado como no verificable. Como salvaguarda envió ROLLBACK y no COMMIT.
2. Una prueba adicional mostró que `stderr` y `stdout` multiplexados por Docker no garantizan el orden visible: el marcador stdout pudo llegar antes que el mensaje `ERROR` de stderr. Parsear `ERROR:` junto al marcador es frágil.
3. El primer lector también tuvo buffering de `TextIO` con `select()`: podía dejar el marcador en el buffer Python aunque el descriptor ya no apareciera listo. Se reemplazó por lectura binaria no bufferizada y `os.read()`.
4. `\quit 3` no produjo el código esperado con el cliente `psql` de la imagen Postgres 16. El controlador no debe depender de ese argumento; la salida no cero del wrapper se decide en Python después de confirmar el rollback.
5. Una excepción local de tipo bytes/string al cerrar el wrapper anterior ocurrió **después** del COMMIT y del checkpoint confirmados. No cambió el estado de la transacción, pero refuerza que el cierre del cliente no es una señal de COMMIT: el acuse SQL debe validarse antes.

## Mecanismo validado

- psql corre dentro de Docker con `-X -A -t -F '|'`, stdin/stdout/stderr controlados por el proceso Python. La cadena de conexión nunca se escribe en logs.
- Se envía **una sentencia por vez**. Después de cada sentencia, psql emite una línea de estado con sus variables especiales `:ERROR`, `:SQLSTATE`, `:ROW_COUNT` y un marcador propio. El controlador no envía la siguiente sentencia mientras no reciba y valide ambos.
- Se usa `ON_ERROR_STOP=off` para que, tras un error SQL, el controlador todavía pueda mandar `ROLLBACK` y comprobar su respuesta. El comportamiento equivalente a fail-stop está en el controlador: al recibir `ERROR=true` o `SQLSTATE != 00000`, no envía ninguna sentencia de negocio/COMMIT; manda sólo ROLLBACK, exige acuse y retorna código de wrapper no cero.
- La duración se mide con `time.monotonic_ns()` desde inmediatamente antes de escribir la sentencia hasta recibir el marcador de finalización de psql. No se parsea el formato localizado/variable de `\timing`.
- Esta duración es el **round-trip wall-clock del comando SQL** (incluye Docker/psql/red). Para el umbral de 5 s es conservadora: nunca reduce el tiempo de espera observado a una duración menor. No se presenta como CPU/execution-time interna del servidor.
- El conteo de filas se obtiene en el resultado del CTE `deleted AS (DELETE ... RETURNING ...) SELECT count(*) ...`. `ROW_COUNT` de psql por sí solo sería 1 para ese SELECT agregado, no el número de filas borradas.
- COMMIT sólo se informa si psql devuelve `COMMIT`, estado de sentencia exitoso (`ERROR=false`, `SQLSTATE=00000`) y el proceso termina limpiamente. ROLLBACK requiere `ROLLBACK` y estado exitoso. Si falta acuse, se informa estado desconocido y se detiene; nunca se reintenta.

## Resultados de pruebas

### Operación válida + ROLLBACK

En transacción temporal se creó `pg_temp.wrapper_probe`, se insertaron siete filas y se borraron tres con un CTE `DELETE ... RETURNING`. No se tocó una tabla persistente.

```text
TEST_SUCCESS=PASS
TRANSACTION_STARTED=true
DELETE_ROWS=3
DELETE_DURATION_MS=69.638
SQL_SUCCESS=true
TRANSACTION_RESULT=ROLLBACK
ROLLBACK_CONFIRMED=true
PSQL_EXIT_CODE=0
```

La duración observada en esa ejecución fue 69.638 ms round-trip. Hubo también ejecuciones repetidas con resultado exitoso (p. ej. 82.378 ms). La cifra es variable por red/host y no debe tomarse como benchmark del servidor.

### Error SQL + ROLLBACK

`SELECT 1/0` dentro de una transacción produce SQLSTATE `22012`. El controlador detectó el estado mediante variables de psql —no mediante el texto del error—, mandó ROLLBACK y recibió acuse. Luego el controlador retornó código 1.

```text
TEST_ERROR=PASS
SQL_SUCCESS=false
SQLSTATE=22012
TRANSACTION_RESULT=ROLLBACK
ROLLBACK_CONFIRMED=true
COMMIT_CONFIRMED=false
PSQL_EXIT_CODE=0
WRAPPER_EXIT_CODE=1
```

psql sale con 0 porque el error fue capturado por el controlador y se ejecutó una reversión explícita. La interfaz que invoca el wrapper recibe código 1 para que CI/shell no confunda el error SQL con éxito.

### COMMIT temporal + verificación

Se creó e insertó en una tabla temporal, se envió COMMIT, se recibió `COMMIT` del servidor y se verificó que la fila temporal siguiera visible en esa sesión. La tabla temporal se eliminó después.

```text
TEST_COMMIT=PASS
TRANSACTION_RESULT=COMMIT
COMMIT_CONFIRMED=true
TEMP_ROW_VISIBLE_AFTER_COMMIT=true
PSQL_EXIT_CODE=0
PERSISTENT_TABLES_MODIFIED=none
```

## Estado de preparación

### WRAPPER READY

- Duración capturada: sí, reloj monotónico alrededor del comando completo.
- Filas capturadas: sí, conteo de filas devueltas por `DELETE ... RETURNING`.
- Exit code: sí; psql transport/status y código final del controlador se distinguen.
- COMMIT/ROLLBACK: diferenciados mediante respuesta del servidor y estado psql.
- Error SQL: probado, SQLSTATE capturado; sin COMMIT; ROLLBACK confirmado; controlador retorna no cero.
- Cierre stdin/psql: el controlador no cierra la sesión con una transacción abierta en los paths probados; espera primero confirmación explícita. Si el acuse falta, no reporta éxito.
- Cambios persistentes: ninguno.

El artefacto de validación está en `/private/tmp/analytics-events-wrapper-validation.py`; no se añadió ni modificó un runner de aplicación en el repositorio. Esta fase no reanuda la ronda de batches.

## SQL propuesto para un futuro canary de 50 filas

No ejecutar todo como un único script que contenga COMMIT anticipado. El controlador interactivo enviaría BEGIN, cada SET LOCAL y el siguiente statement por separado, comprobando el estado psql en cada paso. Para la sentencia de DELETE, el CTE mantiene el filtro/selección autorizados y agrega sólo salida verificable:

```sql
WITH candidates AS MATERIALIZED (
  SELECT id
  FROM public.analytics_events
  WHERE event = 'arena_fresh_reset_fired'
    AND created_at < '2026-08-11T14:12:14.822368Z'::timestamptz
  ORDER BY created_at
  LIMIT 50
  FOR UPDATE SKIP LOCKED
), deleted AS (
  DELETE FROM public.analytics_events AS e
  USING candidates AS c
  WHERE e.id = c.id
  RETURNING e.created_at
)
SELECT count(*) AS delete_rows,
       min(created_at) AS first_deleted,
       max(created_at) AS last_deleted
FROM deleted;
```

La sesión controlada enviaría, individualmente:

```sql
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '15s';
-- sentencia CTE anterior; medir su round-trip con reloj monotónico
```

Después:

- sólo con SQL exitoso, `0 < delete_rows <= 50` y duración round-trip `<= 5000 ms`, enviar `COMMIT;` y exigir respuesta `COMMIT` y SQLSTATE `00000`;
- si supera cinco segundos, hay error, row count inesperado o estado ambiguo, enviar únicamente `ROLLBACK;`, exigir respuesta `ROLLBACK` y detenerse;
- no repetir la sentencia si no se puede determinar si COMMIT fue confirmado.

Esta consulta/comando es propuesta únicamente. No se ejecutó; tampoco se reanudaron batches ni se tocó `arena_mount`.
