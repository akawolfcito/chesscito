# Auditoría de retención permanente para `analytics_events`

**Fecha:** 2026-09-28\
**Alcance:** auditoría read-only de repositorio y catálogos vivos de producción. No se ejecutaron migrations, cambios de cron, DML ni mantenimiento. La telemetría cliente sigue desactivada.

## Resumen ejecutivo

- Producción ejecuta `prune_analytics_events_monthly` desde `pg_cron`, activo y definido como `0 3 1 * *` (03:00 GMT el día 1 de cada mes).
- La función viva borra en una sola sentencia todas las filas anteriores a 90 días. No tiene límite, batches, `SKIP LOCKED` ni timeout propio.
- Última corrida observada: 2026-09-01, `succeeded`, 294 ms. Las cinco corridas registradas (mayo–septiembre) aparecen exitosas. `return_message = '1 row'` no proporciona cuántas filas borró.
- El índice `idx_analytics_events_created_at (created_at DESC)` es apropiado para una selección antigua ordenada y limitada; el plan debe revisarse antes del despliegue.
- Recomendación inicial: batches de 100 filas, hasta 50 batches/5,000 filas por run, commits por batch, cutoff fijado una vez, advisory lock y ledger de ejecuciones. Confirmar el volumen semanal elegible antes de fijar el cap definitivo.
- Las stats `stats_*` consultan raw events para ventanas de hasta 30 días; tablas `*_first_seen` conservan cohortes, pero no el historial de actividad. El snapshot Redis es una última instantánea, no una serie histórica.
- **No todos los emitters retirados están retirados:** `arena_mount` y `arena_fresh_reset_fired` siguen llamando `track()` en el código actual. Mantener la telemetría apagada hasta resolverlos o aceptar explícitamente su volumen.

## CURRENT STATE

### Migraciones y definición actual

La función se creó en [20260424010000_analytics_cleanup.sql](../../apps/web/supabase/migrations/20260424010000_analytics_cleanup.sql):

```sql
create or replace function prune_analytics_events()
returns int as $$
declare
  deleted_count int;
begin
  delete from analytics_events
  where created_at < now() - interval '90 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql security definer;

revoke all on function prune_analytics_events() from public;
revoke all on function prune_analytics_events() from anon;
revoke all on function prune_analytics_events() from authenticated;
```

La función elimina todo el conjunto elegible en una sola transacción/DELETE. Usa `created_at`; no especifica límite, `ORDER BY`, `FOR UPDATE`, `SKIP LOCKED`, lock timeout, statement timeout, control de concurrencia, registro de progreso ni manejo de errores propio. No ejecuta VACUUM ni ANALYZE. Si falla, la sentencia falla y el job puede registrar el error en `cron.job_run_details`; la función no deja un registro propio.

`analytics_events` define `idx_analytics_events_created_at ON analytics_events(created_at DESC)` en [20260424000000_analytics_events.sql](../../apps/web/supabase/migrations/20260424000000_analytics_events.sql). Un B-tree sobre `created_at` puede resolver el corte temporal y recorrer en orden ascendente para un `ORDER BY created_at ASC LIMIT N`; `SKIP LOCKED` permite saltar filas ocupadas. No se verificó un EXPLAIN del DELETE vivo en esta auditoría; debe ser una condición de rollout.

### Estado vivo de función y privilegios

Consulta SELECT a producción, destino confirmado `postgres.public.analytics_events`:

| Propiedad | Valor vivo |
| --- | --- |
| Función | `public.prune_analytics_events()` |
| Owner | `postgres` |
| `SECURITY DEFINER` | Sí |
| `proconfig` / `SET search_path` | vacío / no fijado |
| `anon` / `authenticated` EXECUTE | No / no |
| `service_role` EXECUTE | Sí |
| Job role | `postgres` |

La función actual usa el nombre de tabla sin calificar (`analytics_events`) y no fija `search_path`. La nueva rutina debería calificar `public.analytics_events` y fijar un `search_path` seguro; es preferible una procedure `SECURITY INVOKER` invocada por el usuario `postgres` del job, con EXECUTE sólo para `postgres`, antes que ampliar una rutina `SECURITY DEFINER`.

Timeouts vivos observados: `statement_timeout = 120000 ms` desde configuración de servidor; `lock_timeout = 0`; `idle_in_transaction_session_timeout = 0`. No hay overrides de esos valores para el rol `postgres`/base `postgres`. Por tanto el pruning no tiene un timeout específico y hereda actualmente el límite global de 120 s para la sentencia del job.

### Cron vivo

La creación y actualización versionada está en [20260424050843_schedule_analytics_cron.sql](../../apps/web/supabase/migrations/20260424050843_schedule_analytics_cron.sql). En producción:

| jobid | nombre | schedule | comando | database | username | activo |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `prune_analytics_events_monthly` | `0 3 1 * *` | `select prune_analytics_events();` | `postgres` | `postgres` | sí |

`pg_cron` versión `1.6.4`, `cron.timezone = GMT`. A la hora de la consulta (2026-09-28 15:16 UTC), el siguiente horario calculado por ese schedule era **2026-10-01 03:00 UTC**. `cron.job` no expone un campo next-run; se deriva del schedule y su timezone.

Las cinco últimas filas de `cron.job_run_details` son `succeeded` (2026-05-01, 06-01, 07-01, 08-01 y 09-01). La última empezó 2026-09-01 03:00:00.145499 UTC y terminó 03:00:00.439826 UTC (294.327 ms). Cada `return_message` es `1 row`: no permite confirmar el valor entero retornado por la función ni el número de filas eliminadas.

El código de migración guarda nombre, frecuencia y comando. La tabla `cron.job` viva verifica existencia, habilitación, schedule, usuario y comando; `cron.job_run_details` aporta runs, estado, mensaje y duración, pero no un próximo horario ni la cantidad borrada. Para esta última hace falta que el job persista el resultado.

### Concurrencia, carga y operación normal

La función actual no se protege de invocaciones externas/duplicadas. El propio `pg_cron` serializa ejecuciones solapadas del mismo job (la segunda queda en cola), pero eso no evita otra función/job que borre a la vez. Tampoco hay límites por run.

Un DELETE adquiere locks de escritura y bloquea las filas que modifica; lecturas normales no requieren el mismo lock de tabla y pueden continuar, pero el DELETE ilimitado puede generar WAL, I/O, presión de autovacuum y contención con escrituras sobre filas afectadas. La consulta no llama mantenimiento explícito. El VACUUM normal periódico de PostgreSQL/autovacuum recupera para reutilización el espacio dejado por borrados; no se debe añadir VACUUM por cada ejecución semanal.

## TARGET DESIGN

### Parámetros operativos iniciales

| Parámetro | Propuesta | Motivo |
| --- | ---: | --- |
| Retención raw | 45 días | Decisión de producto; las RPC principales miran hasta 30 días y quedan 15 días de margen. |
| Cron | `0 3 * * 0` | Una vez por semana, domingo 03:00 GMT, separado del cron mensual previo. |
| Batch | 100 filas | Tamaño con evidencia: 100 por transacción tuvo DELETE medio ~0.18–0.24 s y máximos observados <0.5 s en campañas recientes. |
| Máximo por run | 50 batches = 5,000 filas | Límite inicial acotado con margen respecto de rondas manuales estables de 20–30 batches. Revalidar contra el volumen que caduca por semana; si supera el cap, la política no está alcanzando steady state. |
| `lock_timeout` | 1 s por batch | Evita esperar indefinidamente por locks. |
| `statement_timeout` | 15 s por batch; límite total conservador <120 s | La instancia hereda 120 s hoy. Probar el alcance del timeout en una procedure con commits antes de producción. |
| Simultaneidad | `pg_try_advisory_lock` de sesión | Conserva exclusión entre commits y cubre jobs duplicados/llamadas externas. Liberar al terminar; una desconexión también libera el lock. |
| Error | Sin reintento inmediato; próxima ejecución sólo tras inspección | Cada lote confirmado queda contabilizado; una falla debe quedar visible. |

La evidencia apoya **100 filas por transacción**, no una tasa futura concreta. El límite de 5,000 es punto de partida, no garantía de capacidad. Antes de activar 45 días, medir con EXPLAIN y conteo indexado cuántas filas están fuera de 45 días y cuántas vencerán en una semana. Si la cadencia esperada supera 5,000, elevar el tope sólo tras ensayo medido, o la cola de filas >45 días crecerá. En el catch-up inicial, no proclamar política efectiva de 45 días mientras haya backlog fuera del cutoff.

### Forma de selección y borrado

Capturar una vez `v_cutoff := statement_timestamp() - interval '45 days'` al inicio del run y guardarlo en el registro del run. Reutilizarlo durante todos los batches, de modo que un lote no persiga un límite móvil.

```sql
WITH candidates AS MATERIALIZED (
  SELECT e.id
  FROM public.analytics_events AS e
  WHERE e.created_at < v_cutoff
  ORDER BY e.created_at ASC
  LIMIT 100
  FOR UPDATE SKIP LOCKED
), deleted AS (
  DELETE FROM public.analytics_events AS e
  USING candidates AS c
  WHERE e.id = c.id
  RETURNING e.id
)
SELECT count(*) INTO v_batch_rows FROM deleted;
```

Repetir hasta que un lote afecte cero filas o se alcance 50 lotes. Cada lote debe ser una transacción propia: grabar conteo/duración junto con el DELETE y hacer COMMIT, para que una falla posterior no revierta lotes ya confirmados. No ejecutar COUNT global tras cada batch. `SKIP LOCKED` puede dejar filas bloqueadas para una ejecución posterior; por eso debe quedar registrado si se llegó al cap.

Para permitir commits dentro del loop, la propuesta es un `PROCEDURE` invocado directamente por `CALL` como comando top-level de pg_cron, no una función ni `SECURITY DEFINER`. PostgreSQL permite control transaccional en procedures invocadas por `CALL` sin un bloque de transacción externo; `SECURITY DEFINER` y una cláusula `SET` en la definición impiden ese control. Confirmar en el stack local que la invocación concreta de pg_cron conserva esa semántica antes de producción. [PostgreSQL: transaction management](https://www.postgresql.org/docs/16/plpgsql-transactions.html), [user-defined procedures](https://www.postgresql.org/docs/16/xproc.html)

En cada transacción aplicar `SET LOCAL lock_timeout = '1s'` y `SET LOCAL statement_timeout = '15s'` antes del DELETE. Como los commits inician transacciones nuevas, volver a establecer ambos en cada iteración. Añadir un límite total de run inferior a 120 s para no alcanzar el timeout global observado.

### Protección contra solapamiento y observabilidad

pg_cron evita dos ejecuciones concurrentes de una misma entrada, pero encola la siguiente si una ejecución sigue corriendo; un advisory lock de sesión agrega defensa ante duplicados o una invocación adicional. Si no se consigue, terminar como `skipped_locked` sin borrar. [Documentación de pg_cron](https://github.com/citusdata/pg_cron/blob/main/README.md?plain=1)

El `RETURN integer` actual no ha resultado observable en `cron.job_run_details`. Propuesta mínima: tabla privada pequeña `public.analytics_prune_runs`, sin acceso de cliente/RLS con cero policies, con:

```text
run_id, started_at, finished_at, cutoff_at,
status (running/succeeded/failed/skipped_locked/budget_reached),
batches_committed, rows_deleted, duration_ms, error_sqlstate
```

Insertar el encabezado del run antes del loop y persistir progreso/resumen dentro de cada commit de batch. No almacenar filas, IDs, payloads ni texto de error potencialmente sensible. `cron.job_run_details` mantiene el estado de ejecución/error y el ledger añade el número exacto de filas y el progreso incluso si el proceso termina a mitad. Una fila `running` antigua junto con un job fallido alerta de cancelación abrupta.

### Vacuum

No añadir VACUUM/ANALYZE al job semanal. Tras reducir la eliminación a un volumen semanal acotado, dejar que autovacuum mantenga visibility map y espacio reutilizable. Monitorear `n_dead_tup`, autovacuum, locks e I/O; sólo considerar mantenimiento separado si las métricas lo justifican. VACUUM normal recicla espacio para reutilización y suele mantener concurrencia de lectura/escritura; no promete reducir el tamaño físico. [PostgreSQL: VACUUM](https://www.postgresql.org/docs/16/sql-vacuum.html)

## Persistencia de estadísticas y agregados

### Dependencias raw activas

Las ocho RPC `stats_*` de [20260805000000_stats_aggregation_rpcs.sql](../../apps/web/supabase/migrations/20260805000000_stats_aggregation_rpcs.sql) leen `analytics_events` para conteos, embudos, país, actividad/hábito, lifecycle y retención; sus ventanas de actividad son rolling/calendar hasta 30 días. `stats_daily_focus_funnel` de [20260805020000_split_daily_focus_from_training_funnel.sql](../../apps/web/supabase/migrations/20260805020000_split_daily_focus_from_training_funnel.sql) también usa 30 días. La retención toma cohortes de `session_first_seen`; lifecycle usa `account_first_seen`. Mantener los 45 días deja margen a estas lecturas.

`session_first_seen` y `account_first_seen` son persistencia DB independiente de los eventos: guardan identificador pseudónimo, fecha de primera aparición y dimensiones de primer toque; no guardan actividad/retorno agregado y no reemplazan raw para calcular métricas dentro de una ventana. El snapshot duradero de `/stats` vive en Redis/Upstash y representa el último snapshot completo; se reemplaza al refrescar y no constituye archivo histórico diario. `stats_activity_trend` devuelve 30 días densos, pero tampoco crea un historial indefinido.

`/api/admin/lite-stats` consulta directamente `analytics_events` y agrega en runtime filas seleccionadas por fecha y por `props.isLite`. No se encontró en el route una ventana máxima de 45 días. Si se necesita consulta histórica Lite, limitar explícitamente el rango a la retención o conservar un rollup previo con granularidad suficiente. La copia de seguridad de ops excluye `analytics_events` (`scripts/ops/backup.ts`), así que el raw podado no se recupera del backup normal.

Los CSV de auditoría ya creados para `arena_mount`/`arena_fresh_reset_fired` y `arena_select_view` son preservaciones one-off, no jobs de agregación. No existe una tabla de rollups automáticos identificada. Antes de expirar cualquier métrica que se quiera usar después de 45 días, decidir y generar su agregado; no atribuir persistencia histórica a Redis ni a `*_first_seen`.

## Emitters retirados y riesgo de regresión

| Evento | Estado del código actual | Riesgo |
| --- | --- | --- |
| `dock_tap` | No encontrado como emitter en código runtime actual. Historial Git muestra instrumentación antigua y refactors del dock. | Bajo hoy; prueba estática para evitar reintroducción accidental. |
| `dock_center_close` | No encontrado como emitter runtime actual. | Bajo hoy; misma protección. |
| `arena_select_view` | Comentario explícito en `apps/web/src/app/[locale]/arena/page.tsx` dice que se eliminó el 2026-08-18 porque duplicaba la transición de `arena_coach_signal_viewed`; el evento más rico queda como alternativa. | Bajo hoy; añadir guard de regresión. |
| `arena_mount` | **Activo:** `track("arena_mount", ...)` en `apps/web/src/app/[locale]/arena/page.tsx` (actualmente línea 1039). | Volverá a llenar la tabla cuando telemetría esté activa. |
| `arena_fresh_reset_fired` | **Activo:** `track("arena_fresh_reset_fired", ...)` en el mismo archivo (actualmente línea 1062). | Volverá a llenar la tabla para entradas `?fresh=1`. |

Por tanto, no es correcto confirmar que los cinco emitters siguen retirados. Antes de reactivar, decidir si `arena_mount` y `arena_fresh_reset_fired` continúan siendo señales operacionales necesarias; si no, retirar sus llamadas y añadir una prueba/source guard. No volver a introducir los otros tres sin actualizar catálogo, consumidor y retención.

## MIGRATION PLAN propuesto (no aplicado)

1. **Preflight read-only:** confirmar EXPLAIN indexado y medir conteo `created_at < statement_timestamp()-45 days`; estimar filas semanales por cohorte temporal sin GROUP BY de toda la tabla. Verificar que el máximo operativo elegido cubre el catch-up y el flujo esperado.
2. **Métricas:** decidir qué `/api/admin/lite-stats` necesita fuera de 45 días; añadir agregación si se requiere.
3. **Emitters:** resolver `arena_mount`/`arena_fresh_reset_fired`; añadir guards que impidan reintroducir los cinco emitters podados.
4. **Archivo nuevo:** `apps/web/supabase/migrations/20260929000000_bounded_analytics_events_retention.sql` (nombre/versión a confirmar al implementar): crea `analytics_prune_runs`, procedure invoker acotada, ACL cerrada, `search_path` seguro y reemplaza de forma idempotente el job mensual por el semanal. Mantener la función existente de 90 días disponible durante la ventana de rollback.
5. **Validación local/staging:** probar `CALL` top-level con commits por lote, advisory lock, `SKIP LOCKED`, salida por lote cero, budget alcanzado, error de SQL y fila ledger. Comprobar que el EXPLAIN elige el índice. No usar producción para smoke tests destructivos.
6. **Rollout:** aplicar migration, verificar `cron.job` vivo y primer run en ledger + `cron.job_run_details`. Mantener telemetría en OFF. Si backlog > cap, considerar una fase de catch-up limitada antes de dar por efectiva la ventana de 45 días.
7. **Publicación y gate:** actualizar la política de privacidad (hoy [editorial.ts](../../apps/web/src/lib/content/editorial.ts) aún declara hasta 90 días), comprobar dashboards/RPC y luego evaluar telemetría por separado.

### SQL de cron objetivo

```sql
select cron.schedule(
  'prune_analytics_events_weekly',
  '0 3 * * 0',
  'CALL public.prune_analytics_events_weekly();'
);
```

La migration debe comprobar y desprogramar el job mensual por nombre antes de crear el semanal; debe comprobar `to_regprocedure('cron.schedule(text,text,text)')` y omitir la programación en local si pg_cron no está instalado, como ya hace la migration actual. No ejecutar este SQL durante la auditoría.

## ROLLBACK PLAN

Conservar `public.prune_analytics_events()` y el schedule previo como reversión: desprogramar `prune_analytics_events_weekly`, volver a programar `prune_analytics_events_monthly` con `0 3 1 * *` y comando `select public.prune_analytics_events();`. La función anterior vuelve a aplicar 90 días. Los datos ya borrados bajo el cutoff de 45 días no se restauran al volver a 90; no hacer rollback destructivo del ledger ni reconstruir raw. La telemetría permanece apagada mientras se evalúa el rollback.

## TELEMETRY REACTIVATION GATE

Mantener `NEXT_PUBLIC_TELEMETRY_ENABLED=0` hasta que se cumplan todos:

- cron semanal activo verificado en producción, timezone GMT, usuario esperado, último run exitoso y salida ledger reconciliada con `cron.job_run_details`;
- EXPLAIN usa el índice temporal; límite semanal cubre backlog y volumen de expiración esperado, sin crecimiento persistente de filas >45 días;
- protección de simultaneidad, timeouts por batch, cap, `SKIP LOCKED`, logging de filas/duración/error y prueba de interrupción/rollback verificados fuera de producción;
- `/api/admin/lite-stats` limitado a 45 días o agregado histórico requerido preservado;
- decisión documentada sobre los dos emitters Arena que siguen activos; fuentes y prueba impiden reintroducir los otros tres;
- agregados históricos que producto requiera se guardan antes de expirar, y texto de privacidad refleja 45 días;
- verificar explícitamente `NEXT_PUBLIC_TELEMETRY_ENABLED=0` en Preview y Production antes del cambio; al reactivarlo, establecer valor deliberado (`1`) y desplegar bundle nuevo (es `NEXT_PUBLIC_*` y Next.js lo incorpora al build);
- reactivación gradual con ventana de observación: requests/batches, filas creadas vs podadas, backlog >45d, errores, duration, WAL/I/O, dead tuples y autovacuum; conservar kill switch inmediato a `0`.

## Recomendación

Implementar una procedure de ejecución top-level con batches independientes de 100, cap inicial de 5,000 filas/run, límite total inferior a los 120 s globales, cutoff fijo, advisory lock y ledger privado. Antes de fijar el cap o programar 45 días, medir el backlog y el volumen que caduca por semana; si exceden la capacidad, ajustar el cap tras medir o completar catch-up limitado. Retirar o justificar las emisiones activas de Arena. Mantener telemetría apagada hasta superar el gate completo.
