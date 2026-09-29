# Poda de `arena_select_view`: ronda 1

**Fecha:** 2026-09-28\
**Clasificación:** `ARENA_SELECT_VIEW PARTIAL`\
**Cutoff fijo:** `2026-08-11T14:12:14.822368Z`

## Precheck

| Verificación | Resultado |
| --- | --- |
| Proyecto / base / schema / tabla | `brsbdzpuvotxsadmcxyj` / `postgres` / `public` / `analytics_events` |
| `baseline_start` read-only | 7,551 (referencia esperada: 7,551) |
| Vacuum/autovacuum activo al inicio | 0 |
| Locks conflictivos al inicio | 0 |
| Deadlocks acumulados al inicio | 0 |
| EXPLAIN sin ANALYZE | `idx_analytics_events_event`; sin `Seq Scan` |

## Ejecución y reconciliación

Se usó el wrapper transaccional validado, con 20 transacciones independientes, máximo 100 filas por batch, `lock_timeout = '1s'`, `statement_timeout = '15s'`, `FOR UPDATE SKIP LOCKED`, orden por `created_at` y pausa de 1.5 s. Después de cada COMMIT confirmado se comparó un COUNT read-only con el remanente esperado.

| Medida | Resultado |
| --- | ---: |
| Batches intentados | 20 |
| Batches confirmados | 20/20 |
| Filas eliminadas confirmadas | 2,000 |
| DELETE round-trip promedio | 200.310 ms |
| DELETE round-trip máximo | 477.974 ms |
| Rango temporal eliminado | 2026-06-06 22:18:21.079560 UTC — 2026-08-03 18:26:48.166412 UTC |
| `expected_remaining` | 5,551 |
| `actual_remaining` | 5,551 |
| Rollbacks confirmados | 0 |
| Estados transaccionales ambiguos | 0 |
| Vacuum/autovacuum al cierre | 0 |
| Locks conflictivos al cierre | 0 |
| Deadlocks al cierre | 0 |
| Código de salida del wrapper | 0 |

Los conteos intermedios reconciliaron tras cada batch, descendiendo de 7,551 a 5,551 en incrementos de 100.

## Cierre

La ronda fue segura y completó el máximo autorizado de 2,000 filas. Quedan 5,551 candidatos bajo el cutoff. No se ejecutaron más batches ni mantenimiento.
