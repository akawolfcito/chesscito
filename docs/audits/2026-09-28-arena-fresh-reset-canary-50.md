# Canary de poda: `arena_fresh_reset_fired`

**Fecha:** 2026-09-28\
**Resultado:** FAST DELETE CONFIRMED\
**Cutoff fijo:** `2026-08-11T14:12:14.822368Z`

## Precheck

- Proyecto configurado: `brsbdzpuvotxsadmcxyj`
- Base/schema/tabla: `postgres` / `public` / `analytics_events`
- Candidatos bajo cutoff antes del batch: 5,187
- Vacuum/autovacuum activo: no
- Locks conflictivos: 0
- Deadlocks acumulados: 0
- EXPLAIN sin ANALYZE: `idx_analytics_events_event` y PK; sin Seq Scan

## Transacción

- Filas eliminadas: 50
- Duración round-trip del DELETE: 134.409 ms
- Primera fila eliminada: `2026-06-06 22:44:42.799795+00`
- Última fila eliminada: `2026-06-14 02:48:03.886457+00`
- Duración round-trip del COMMIT: 72.182 ms
- COMMIT confirmado por PostgreSQL: sí
- Exit code de psql: 0

## Checkpoint READ-ONLY

- Candidatos restantes bajo cutoff: 5,137
- Vacuum/autovacuum activo: no
- Locks conflictivos: 0
- Deadlocks acumulados: 0

Se ejecutó exactamente un batch. No se ejecutó un segundo batch y no se borró `arena_mount`. No se ejecutó VACUUM, ANALYZE ni REINDEX.
