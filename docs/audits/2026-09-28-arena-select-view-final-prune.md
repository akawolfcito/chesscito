# Poda final de `arena_select_view`

**Fecha:** 2026-09-28\
**Clasificación:** `ARENA_SELECT_VIEW COMPLETE`\
**Cutoff fijo:** `2026-08-11T14:12:14.822368Z`

## Precheck

| Verificación | Resultado |
| --- | --- |
| Proyecto / base / schema / tabla | `brsbdzpuvotxsadmcxyj` / `postgres` / `public` / `analytics_events` |
| `baseline_start` read-only | 2,551 |
| Vacuum/autovacuum activo al inicio | 0 |
| Locks conflictivos al inicio | 0 |
| Deadlocks acumulados al inicio | 0 |
| EXPLAIN sin ANALYZE | `idx_analytics_events_event`; sin `Seq Scan` |

## Ejecución y reconciliación

Se usó el wrapper transaccional validado: 26 transacciones independientes, `lock_timeout = '1s'`, `statement_timeout = '15s'`, `FOR UPDATE SKIP LOCKED`, orden por `created_at`, y COUNT read-only después de cada COMMIT. Se ejecutaron 25 batches de 100 filas y un batch final de 51. Los conteos intermedios reconciliaron en todos los casos.

| Medida | Resultado |
| --- | ---: |
| Batches intentados | 26 |
| Batches confirmados | 26/26 |
| Filas eliminadas confirmadas | 2,551 |
| DELETE round-trip promedio | 173.291 ms |
| DELETE round-trip máximo | 237.857 ms |
| Rango temporal eliminado | 2026-08-05 05:34:26.451137 UTC — 2026-08-11 14:11:22.632923 UTC |
| `expected_remaining` | 0 |
| `actual_remaining` | 0 |
| Rollbacks confirmados | 0 |
| Estados transaccionales ambiguos | 0 |
| Vacuum/autovacuum al cierre | 0 |
| Locks conflictivos al cierre | 0 |
| Deadlocks al cierre | 0 |
| Código de salida del wrapper | 0 |

## Cierre

No quedan candidatos `arena_select_view` bajo el cutoff fijo. No se ejecutaron otras podas ni mantenimiento.
