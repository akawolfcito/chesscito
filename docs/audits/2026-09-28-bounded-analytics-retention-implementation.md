# Bounded `analytics_events` retention — implementation review

**Fecha:** 2026-09-28\
**Resultado:** `NOT READY`\
**Alcance:** prototipo SQL y validación local aislada. No se aplicó a Supabase de producción ni a staging.

## Resumen ejecutivo

Se añadió una migration prototipo para ledger, advisory lock, cutoff fijo, batches con `SKIP LOCKED`, commits reconciliados, caps por modo y cron semanal. La prueba local confirmó el `CALL` top-level y 11 escenarios de integración.

El diseño solicitado no pasa todavía el gate de seguridad: PostgreSQL no permite imponer `statement_timeout = 15s` a cada batch dentro de un procedimiento que conserva un único `CALL` y hace `COMMIT` interno. `SET LOCAL` ejecutado desde ese procedimiento no reinicia el timer del `CALL`; una cláusula `SET` que sí inicia el timer impide el control transaccional. La migration incluye un guard que aborta antes de cambiar objetos si detecta `pg_cron`, por lo que no programará la retención semanal en una base con cron activo hasta resolver el diseño.

## Implementación preparada

Migration: `apps/web/supabase/migrations/20260929000000_bounded_analytics_events_retention.sql`.

- `public.analytics_prune_runs`: ledger mínimo de estado, cutoff, modo, filas/batches confirmados, duración y SQLSTATE. No guarda IDs, payloads, sesiones, wallets ni mensajes arbitrarios. RLS habilitado, sin policies y ACL revocada a `PUBLIC`, `anon`, `authenticated` y `service_role`.
- `public.prune_analytics_events_bounded(...)`: `SECURITY INVOKER`, argumentos validados, cutoff capturado una sola vez, advisory lock de sesión y commit independiente por batch. El `DELETE` y el aumento de counters del ledger se confirman en la misma transacción.
- `public.prune_analytics_events_batch(...)`: helper de un batch, con `lock_timeout = 1s`, índice temporal, `ORDER BY created_at ASC`, `LIMIT` y `FOR UPDATE SKIP LOCKED`.
- `public.prune_analytics_events_weekly()`: invoca el modo semanal con 45 días, batches de 100 y cap 5,000.
- Catch-up se invocaría explícitamente como `CALL public.prune_analytics_events_bounded(45, 100, 10000, 60000, 'catch_up');`; no tiene cron.
- Se conserva `public.prune_analytics_events()` para rollback.
- El bloque de cron desprograma por nombre el job mensual y crearía `prune_analytics_events_weekly`, `0 3 * * 0`, con `CALL public.prune_analytics_events_weekly();` si `pg_cron` existe. En producción-shaped DB, el guard inicial actualmente impide llegar a ese bloque.
- Los procedimientos son invocables por `postgres` y no por los roles cliente ni `service_role`. Tablas y referencias están calificadas con `public`; no se adjunta un `search_path` inseguro.

### Límites aplicados

| Modo | Retención del wrapper | Batch máximo | Filas máximas | Presupuesto interno |
| --- | ---: | ---: | ---: | ---: |
| `weekly` | 45 días | 100 | 5,000 | sin límite de pared configurado |
| `catch_up` | argumento explícito; propuesto 45 días | 100 | 10,000 | 1–60,000 ms; objetivo 60,000 ms |

El límite final reduce el último batch para no sobrepasar `max_rows`. El advisory lock de sesión permanece durante commits; `skipped_locked` se registra sin borrar. Un batch fallido se revierte y se registra `failed`; commits previos permanecen reconciliados. Una desconexión no controlada puede dejar una fila `running`, aunque sus contadores sólo incluyen batches ya confirmados.

## Bloqueo de `statement_timeout`

El requisito era aplicar `statement_timeout = 15s` a cada transacción/batch. Las pruebas locales en PostgreSQL 17 demostraron:

1. `SET LOCAL statement_timeout = '15s'` dentro del procedimiento no interrumpió una sentencia de prueba que duró más de 15 segundos; la ejecución terminó y llegó al commit.
2. Mover el `SET LOCAL` fuera del subbloque de excepciones no cambió el resultado.
3. Un helper anidado con cláusula `SET statement_timeout = '1s'` tampoco reinició el timer cuando fue llamado desde el procedimiento externo.
4. Añadir una cláusula `SET statement_timeout` al wrapper externo sí impidió el commit interno (`invalid transaction termination`).
5. `SET statement_timeout = '15s'; CALL ...;` enviado como una sola consulta también produjo `invalid transaction termination`, porque el `CALL` quedó dentro del bloque de transacción de la consulta.

Esto concuerda con la documentación de PostgreSQL: la duración de `statement_timeout` se mide desde que llega el comando; el control de transacciones requiere un `CALL` top-level, y un procedimiento que lleva una cláusula `SET` no puede hacer control transaccional. [Documentación de `statement_timeout`](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-STATEMENT-TIMEOUT), [control de transacciones PL/pgSQL](https://www.postgresql.org/docs/17/plpgsql-transactions.html), [documentación `CREATE PROCEDURE`](https://www.postgresql.org/docs/18/sql-createprocedure.html). Un ejemplo concreto de `SET LOCAL` dentro de un procedure tampoco interrumpe la llamada, mientras que la cláusula `SET` sí lo hace; [discusión en la lista oficial de PostgreSQL](https://www.postgresql.org/message-id/46a33904c2cd86718cb4d7a0291906a08b8e246a.camel%40cybertec.at).

El SQL del prototipo **no afirma que este timeout esté cubierto**. Se conserva `lock_timeout` por batch, el cap de filas y el presupuesto interno de catch-up, y la migration falla de forma explícita donde existe `cron.schedule`. Para seguir, hace falta cambiar una premisa: orquestar cada batch como un `CALL` top-level separado desde un worker, o aceptar y dimensionar un timeout por ejecución completa mediante una identidad de job dedicada. Ninguna alternativa se activó.

## Validación local

Para evitar tocar una base local con datos preexistentes, la validación se hizo en una instancia Supabase scratch separada:

- proyecto: `analytics-retention-test`;
- contenedor: `supabase_db_analytics-retention-test`;
- PostgreSQL 17;
- sin `pg_cron`; la migration mostró el `NOTICE` esperado y omitió scheduling.

La instancia Supabase local preexistente `supabase_db_web` tenía 216,409 filas >45 días. No se aplicó migration ni se ejecutó DML ahí; el servicio que se inició sólo para inspección se detuvo preservando su volumen.

### Resultados

- Migration aplicada repetidamente al scratch: sintaxis válida e idempotencia de tabla, procedimientos y bloque cron guard.
- EXPLAIN con fixture local representativo: seleccionó `idx_analytics_events_created_at` para el selector ordenado de 100 filas.
- 11 pruebas de integración aprobadas: backlog vacío y `CALL` top-level; batch parcial; varios batches; cap y último batch parcial; advisory lock; lock timeout de 1s; `SKIP LOCKED`; error SQL con primer batch durable; presupuesto de catch-up; `CALL` del wrapper semanal con commits internos.
- El test específico del timeout de sentencia **falló como protección**: una sentencia lenta sobrepasó 15s. Esa falla es el bloqueo informado arriba, no un resultado aprobado.
- La extensión `pg_cron` no estaba instalada en el scratch; el calendario se revisó estáticamente, pero no se ejecutó `cron.schedule` localmente.
- Cleanup confirmado en scratch: 0 eventos sintéticos, 0 filas de ledger y probes temporales retirados. La instancia scratch quedó detenida preservando el volumen.

### Repetir la validación scratch

Desde la raíz del repositorio, el fixture versionado permite repetirla sin iniciar el proyecto local `web`:

```bash
supabase start --workdir apps/web/supabase/tests/retention-scratch \
  --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor

docker exec -i supabase_db_analytics-retention-test \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < apps/web/supabase/tests/retention-scratch/bootstrap.sql

docker exec -i supabase_db_analytics-retention-test \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < apps/web/supabase/migrations/20260929000000_bounded_analytics_events_retention.sql

node apps/web/scripts/db/test-analytics-retention-bounded.mjs
supabase stop --workdir apps/web/supabase/tests/retention-scratch
```

El arnés acepta exclusivamente `supabase_db_analytics-retention-test`, aborta si ya hay filas >45 días antes de empezar y limpia fixtures/ledger al finalizar. El test long-running de `statement_timeout` que detectó el bloqueo no forma parte del conjunto verde: su resultado fallido se registró en esta auditoría.

### Checks del repositorio

- Vitest: 15 tests aprobados entre la nueva prueba estática y `analytics-cron-migration.test.ts`.
- ESLint sobre la prueba TypeScript nueva: aprobado.
- `tsc --noEmit`: aprobado.
- `node --check` del arnés de integración y `git diff --check`: aprobados.

## Estado de copy de privacidad

No se cambió copy pública antes del despliegue.

- `apps/web/src/lib/content/editorial.ts`: el texto inglés de retención raw sigue indicando hasta 90 días.
- `apps/web/src/lib/content/messages/es.ts`: el texto español sigue indicando 90 días.

Ambos textos deben pasar a 45 días sólo cuando el mecanismo definitivo y la fecha efectiva de política estén aprobados para deploy.

## Rollback cuando exista un rollout aprobado

La migration nueva conserva `public.prune_analytics_events()`. Para volver al job mensual, ejecutar de forma controlada en la base objetivo:

```sql
DO $rollback$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is not available';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'prune_analytics_events_weekly'
  ) THEN
    PERFORM cron.unschedule('prune_analytics_events_weekly');
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'prune_analytics_events_monthly'
  ) THEN
    PERFORM cron.unschedule('prune_analytics_events_monthly');
  END IF;

  PERFORM cron.schedule(
    'prune_analytics_events_monthly',
    '0 3 1 * *',
    'select public.prune_analytics_events();'
  );
END;
$rollback$;
```

El rollback devuelve el pruning futuro a 90 días/mensual. No restaura raw rows que una ejecución anterior ya hubiera eliminado. No se ejecutó este rollback SQL.

## Decisión de readiness

### `NOT READY`

La migration falla deliberadamente en una base con `pg_cron`, y no cambia el job mensual ni programa el semanal mientras siga pendiente el límite de `statement_timeout` por batch.

La siguiente decisión de diseño debe escoger entre:

1. un worker externo que emita cada batch como solicitud/transacción top-level, con timeout propio de 15s y presupuesto total de 60s para catch-up; o
2. un timeout por ejecución completa bajo un rol de pruning dedicado, aceptando que no equivale a un timeout por batch y probando los límites reales del weekly de 5,000 filas.

Hasta entonces, no aplicar esta migration, no ejecutar catch-up y mantener desactivada la telemetría cliente.
