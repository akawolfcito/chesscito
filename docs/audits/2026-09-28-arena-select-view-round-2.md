# Poda de `arena_select_view`: ronda 2

**Fecha:** 2026-09-28\
**Clasificación:** `ARENA_SELECT_VIEW PARTIAL`\
**Cutoff fijo:** `2026-08-11T14:12:14.822368Z`

## Precheck y baseline

Un primer arranque del wrapper se detuvo antes de enviar DELETE porque su referencia interna seguía en 7,551. No se escribió ninguna fila. Un COUNT read-only independiente confirmó 5,551 candidatos, igual al baseline esperado de esta ronda. Se actualizó la referencia local del wrapper a 5,551 y se repitió el precheck.

| Verificación | Resultado |
| --- | --- |
| Proyecto / base / schema / tabla | `brsbdzpuvotxsadmcxyj` / `postgres` / `public` / `analytics_events` |
| `baseline_start` | 5,551 |
| Vacuum/autovacuum activo al inicio | 0 |
| Locks conflictivos al inicio | 0 |
| Deadlocks acumulados al inicio | 0 |
| EXPLAIN sin ANALYZE | `idx_analytics_events_event`; sin `Seq Scan` |

## Ejecución y reconciliación

Se ejecutaron 30 transacciones independientes con un máximo de 100 filas por batch, `lock_timeout = '1s'`, `statement_timeout = '15s'`, `FOR UPDATE SKIP LOCKED`, orden por `created_at` y pausa de 1.5 s. Cada COMMIT fue confirmado explícitamente y seguido por un COUNT read-only que coincidió con el remanente esperado.

| Medida | Resultado |
| --- | ---: |
| Batches intentados | 30 |
| Batches confirmados | 30/30 |
| `committed_rows` | 3,000 |
| DELETE round-trip promedio | 180.642 ms |
| DELETE round-trip máximo | 310.510 ms |
| Rango temporal eliminado | 2026-08-03 18:26:51.848865 UTC — 2026-08-05 05:34:02.545606 UTC |
| `expected_remaining` | 2,551 |
| `actual_remaining` | 2,551 |
| Rollbacks confirmados | 0 |
| Estados transaccionales ambiguos | 0 |
| Vacuum/autovacuum al cierre | 0 |
| Locks conflictivos al cierre | 0 |
| Deadlocks al cierre | 0 |
| Código de salida del wrapper | 0 |

## Cierre

La ronda llegó al límite autorizado de 30 batches y terminó normalmente. Quedan 2,551 candidatos bajo el cutoff. No se ejecutaron más batches ni mantenimiento.
