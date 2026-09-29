# Auditoría read-only de capacidad para retención de `analytics_events`

Fecha: 2026-09-28\
Alcance: medir backlog y expiración histórica para retención raw de 45 días con frecuencia semanal. No se ejecutaron DML ni operaciones de mantenimiento, y no se cambió el cron.

## Resumen

- Referencia PostgreSQL: `v_now = 2026-09-28T16:15:43.147851Z`; `cutoff_45d = 2026-08-14T16:15:43.147851Z`.
- Backlog actual anterior al cutoff: **240,965 filas**. COUNT indexado, duración reportada por `psql`: **1.979 s**.
- Las siete ventanas semanales suman **229,993 filas**; **10,972** filas adicionales son anteriores a la ventana observada de 49 días.
- El volumen semanal varió entre **3,242 y 159,194**; mediana **6,578**, promedio **32,856**. El cap de 5,000 es **insuficiente** para la serie histórica observada.
- El pico de 159,194 es muy distinto de las otras ventanas; esta serie no demuestra que ese pico se repita en el estado futuro con telemetría cliente apagada.
- Recomendación: **10,000 filas/run como cap inicial provisional y observable**, sólo mientras la telemetría cliente siga apagada y después de medir las entradas actuales. No se puede certificar steady state futuro con esta serie; investigar los dos picos antes de reactivar telemetría o declarar suficiente un cap fijo.
- Producción sigue con `prune_analytics_events_monthly`, `0 3 1 * *`, activo, timezone `GMT`, y función de 90 días con un DELETE sin límite.

## Método y seguridad

El runner existente `pnpm ops:query` rechazó `EXPLAIN` antes de abrir conexión porque su guard sólo permite sentencias que empiezan con `SELECT` o `WITH`; no se ejecutó SQL en ese intento. Para satisfacer el precheck sin cambiar archivos del proyecto, los EXPLAIN y lecturas se ejecutaron en Docker/psql usando el helper de credenciales ops y `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` en la misma sesión. No se imprimieron credenciales.

Los EXPLAIN se revisaron antes de los COUNT exactos. Todas las consultas de conteo usaron `idx_analytics_events_created_at`; no hubo Seq Scan.

## Backlog >45 días

| Métrica | Resultado |
| --- | ---: |
| `v_now` | `2026-09-28T16:15:43.147851Z` |
| `cutoff_45d` | `2026-08-14T16:15:43.147851Z` |
| Filas con `created_at < cutoff_45d` | **240,965** |
| COUNT exacto | **1.979 s** |

Plan: `Finalize Aggregate` → `Gather` → `Partial Aggregate` → `Parallel Index Only Scan using idx_analytics_events_created_at`. La estimación del plan fue 139,992 filas frente a 240,965 observadas, así que el optimizador subestimó este backlog en aproximadamente 42%. El tiempo medido es el COUNT en la sesión auditada; no implica el tiempo de un DELETE.

## Volumen de filas que cruzó el umbral en siete semanas

Cada intervalo es UTC y semiabierto `[inicio, fin)`. Semana 1 corresponde a edades de 45–52 días; semana 7, a 87–94 días. Se contaron todas las filas, sin agrupar por evento.

| Window | Intervalo UTC | Rows becoming eligible |
| --- | --- | ---: |
| 1 | `[2026-08-07 16:15:43.147851, 2026-08-14 16:15:43.147851)` | 45,303 |
| 2 | `[2026-07-31 16:15:43.147851, 2026-08-07 16:15:43.147851)` | 159,194 |
| 3 | `[2026-07-24 16:15:43.147851, 2026-07-31 16:15:43.147851)` | 3,242 |
| 4 | `[2026-07-17 16:15:43.147851, 2026-07-24 16:15:43.147851)` | 5,133 |
| 5 | `[2026-07-10 16:15:43.147851, 2026-07-17 16:15:43.147851)` | 7,155 |
| 6 | `[2026-07-03 16:15:43.147851, 2026-07-10 16:15:43.147851)` | 6,578 |
| 7 | `[2026-06-26 16:15:43.147851, 2026-07-03 16:15:43.147851)` | 3,388 |

Los siete COUNT individuales tardaron entre 67.270 y 106.130 ms según `psql`. Sus planes fueron `Aggregate` sobre `Index Only Scan using idx_analytics_events_created_at`.

Las ventanas suman 229,993; el backlog total excede esa suma en 10,972 filas que tienen más de 94 días.

### Estadísticas de capacidad semanal

Ordenando las siete observaciones: 3,242; 3,388; 5,133; 6,578; 7,155; 45,303; 159,194.

| Estadística | Filas/semana |
| --- | ---: |
| Mínimo | 3,242 |
| Máximo | 159,194 |
| Promedio | 32,856.14 |
| Mediana | 6,578 |
| Semanas por encima de 5,000 | 5 de 7 |

**Clasificación: CAP 5000 INSUFFICIENT.** El cap queda por debajo de la mediana y no cubre cinco de las siete ventanas. Incluso excluyendo los dos picos, tres de cinco semanas superan 5,000; por tanto, no basta con atribuir toda la insuficiencia a un solo outlier.

El máximo y los dos picos (45,303 y 159,194) son evidencia de alta variabilidad histórica, no una predicción demostrada de la entrada futura. La cifra histórica no debe extrapolarse directamente al periodo con telemetría cliente apagada ni a una eventual reactivación.

## Catch-up teórico del backlog inicial

Cálculo: `ceil(240,965 / cap)`. Supone que no entran nuevas filas y que cada run alcanza su cap; no es un plan operativo ni autorización para elevarlo.

| Cap por run | Runs teóricos |
| ---: | ---: |
| 5,000 | 49 |
| 10,000 | 25 |
| 20,000 | 13 |

Con cron semanal serían, idealmente, 49, 25 o 13 semanas para consumir sólo el backlog inicial. El flujo que siga entrando extendería ese tiempo. La cola más antigua de 10,972 filas tampoco queda cubierta por las siete semanas analizadas como ritmo reciente.

## Selección limitada e índice

EXPLAIN sin ANALYZE para:

```sql
SELECT id
FROM public.analytics_events
WHERE created_at < '2026-08-14T16:15:43.147851Z'::timestamptz
ORDER BY created_at ASC
LIMIT 100;
```

Plan: `Limit` → `Index Scan Backward using idx_analytics_events_created_at`; costo estimado 0.42..6.05 para 100 filas. El índice físico es DESC y el recorrido backward satisface el orden ASC sin Sort. No se ejecutó el SELECT de filas ni un DELETE.

## Writers mientras `NEXT_PUBLIC_TELEMETRY_ENABLED=0`

La bandera desactiva el `track()` del cliente: `apps/web/src/lib/telemetry.ts` retorna antes de encolar o hacer POST. Sin embargo, no prueba que la tabla quede inmóvil:

- `apps/web/src/app/api/telemetry/route.ts` sigue aceptando POST y escribe filas saneadas. La ruta no revisa `NEXT_PUBLIC_TELEMETRY_ENABLED`; clientes antiguos o llamadas directas podrían seguir escribiendo.
- Los endpoints de duelos llaman a `recordDuelEvent()` en `apps/web/src/lib/duel/service.ts`, que inserta directamente en `analytics_events`, sin depender de `track()` ni de esa bandera. Los eventos incluyen creación, unión, primer movimiento, finalización y renuncia.
- Las referencias de stats/admin consultadas son lecturas, no writers.

Por tanto, `telemetry OFF` reduce el flujo normal del cliente, pero no equivale a cero writes. En esta auditoría no se midió la tasa de nuevos writes por emisor.

## Cron vivo

Consulta de solo lectura a `cron.job` y `cron.job_run_details`, comprobada el 2026-09-28:

| Propiedad | Estado observado |
| --- | --- |
| Nombre | `prune_analytics_events_monthly` |
| Schedule | `0 3 1 * *` |
| Activo | Sí |
| Zona horaria | `GMT` |
| Base / usuario | `postgres` / `postgres` |
| Comando | `select prune_analytics_events();` |
| Última ejecución | 2026-09-01 03:00:00.145499–03:00:00.439826 UTC |
| Resultado | `succeeded` |

Definición viva: `public.prune_analytics_events()` es `SECURITY DEFINER`, retorna entero y ejecuta un único `DELETE FROM analytics_events WHERE created_at < now() - interval '90 days'`, con `GET DIAGNOSTICS` para el total borrado. No usa batches ni límites por run. La siguiente hora derivada del schedule es 2026-10-01 03:00 GMT.

## Recomendación

1. **No aprobar 5,000 como capacidad steady-state demostrada:** es inferior a la mediana y a cinco ventanas históricas.
2. **Cap inicial recomendado para el diseño: 10,000 filas/run, provisional y con telemetría cliente aún apagada.** Supera en ~40% la mayor de las cinco ventanas menores (`7,155`) sin dimensionar una ejecución semanal para el pico extremo completo. Esto no ofrece margen frente a las semanas de 45,303 y 159,194, ni demuestra que no habrá backlog si esos volúmenes se repiten.
3. Antes de declarar steady state o reactivar telemetría, identificar la causa/recurrencia de las dos ventanas grandes y medir writes nuevos por semana con emisores identificados. Si los picos son reproducibles, 10,000 tampoco será suficiente: habrá que diseñar catch-up separado, limitado y observado, en vez de elevar automáticamente el cap semanal a 160,000.
4. Mantener instrumentación observable del backlog >45 días, filas borradas por run, duración y errores; comparar el flujo semanal observado con la capacidad antes de cambiar el cron.

No se implementó migration, no se modificó cron, no se hizo DML ni mantenimiento y la telemetría sigue apagada.
