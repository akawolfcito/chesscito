# Canary de poda de `arena_select_view`

**Fecha:** 2026-09-28\
**Clasificación:** `FAST DELETE CONFIRMED`\
**Evento:** `arena_select_view`\
**Cutoff fijo:** `2026-08-11T14:12:14.822368Z`

## Precheck

| Verificación | Resultado |
| --- | --- |
| Proyecto configurado | `brsbdzpuvotxsadmcxyj` |
| Base / schema / tabla | `postgres` / `public` / `analytics_events` |
| Conteo inicial (`baseline_start`) | 7,601 (referencia: 7,601) |
| Vacuum/autovacuum activo | 0 |
| Locks conflictivos | 0 |
| Deadlocks acumulados | 0 |
| EXPLAIN sin ANALYZE | `idx_analytics_events_event`; sin `Seq Scan` |

El wrapper tomó el conteo leído como baseline, confirmó que coincidía con la referencia y pasó los prechecks antes de abrir la transacción.

## Canary

| Medida | Resultado |
| --- | ---: |
| `DELETE_ROWS` | 50 |
| DELETE round-trip | 163.689 ms |
| COMMIT round-trip | 77.385 ms |
| SQL | éxito, SQLSTATE `00000` |
| COMMIT | confirmado explícitamente |
| Primera fila por `created_at` | 2026-06-03 03:39:58.524287 UTC |
| Última fila por `created_at` | 2026-06-06 22:15:46.781330 UTC |
| `expected_remaining` | 7,551 |
| `actual_remaining` | 7,551 |
| Checkpoint: vacuum / locks / deadlocks | 0 / 0 / 0 |

## Cierre

El canary único fue confirmado y el conteo read-only posterior reconcilió. No se ejecutó otro batch ni mantenimiento.
