# Preservación mínima de `arena_select_view`

**Fecha:** 2026-09-28\
**Clasificación:** `MINIMAL ARCHIVE PRESERVED`\
**Cutoff:** `2026-08-11T14:12:14.822368Z`\
**Ejecución:** consultas a producción mediante `pnpm ops:query`, que valida SQL de lectura y fuerza la sesión PostgreSQL a READ ONLY.

## Resultado histórico publicado

Se preservaron las tasas que aparecen en el análisis original en [el resumen histórico](data/2026-09-28-arena-select-view-historical-summary.md): 28.9% para la cohorte `one-day` y 47.9% para `returning`. Se etiquetaron expresamente como resultados publicados que no se pueden reproducir desde las fuentes versionadas. No se inventaron denominadores ni se recalcularon las tasas.

## Serie diaria factual

El CSV [arena-select-view-daily.csv](data/2026-09-28-arena-select-view-daily.csv) contiene sólo `date_utc` y `arena_select_view_count`. No contiene cohortes, cuentas, sesiones, payloads ni inferencias de retención.

Antes de esta extracción, el informe [post-prune review](2026-09-28-analytics-events-post-prune-review.md) registró un `EXPLAIN` sin `ANALYZE` para el filtro individual del mismo evento y cutoff. El plan usó `idx_analytics_events_event` con condición sobre `event` y `created_at`, sin `Seq Scan`. La consulta individual de conteo/min/max de ese informe encontró 7,601 filas.

Se volvió a consultar el conteo actual con el runner READ ONLY:

| Verificación | Resultado |
| --- | ---: |
| Conteo exacto bajo cutoff | 7,601 |
| Primera aparición UTC | 2026-06-03 03:39:58.524287 |
| Última aparición UTC | 2026-08-11 14:11:22.632923 |

El conteo actual coincide con la referencia, por lo que se generó la serie diaria limitada al evento y cutoff. Se completaron con cero los días sin eventos entre la primera y última fecha observadas.

| Validación CSV | Resultado |
| --- | ---: |
| Días consecutivos | 70 |
| Primera fecha UTC | 2026-06-03 |
| Última fecha UTC | 2026-08-11 |
| Suma de `arena_select_view_count` | 7,601 |
| Fechas consecutivas sin huecos | Sí |
| Conteos no negativos | Sí |
| Identificadores o payloads raw | Ninguno |

## Wrapper y límites de esta fase

Se confirmó que `/private/tmp/analytics-events-wrapper-validation.py` conserva el entry point explícito `--smoke-tests`. Una carga mediante `runpy.run_path(...)` produjo stdout y stderr vacíos; no se pasó `--smoke-tests` ni se ejecutó SQL al importar.

No se ejecutó DELETE, canary ni mantenimiento. El agregado de días preserva volumen temporal factual, pero no reconstruye la pertenencia de cuentas a las cohortes del análisis histórico.
