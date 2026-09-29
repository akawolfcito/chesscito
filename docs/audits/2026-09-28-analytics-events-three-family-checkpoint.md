# Checkpoint después de tres familias de poda

**Fecha:** 2026-09-28\
**Modo:** READ ONLY\
**Destino:** `postgres.public.analytics_events`\
**Cutoff fijo:** `2026-08-11T14:12:14.822368Z`\
**Decisión:** `STOP MANUAL PRUNING`; una operación controlada normal de `VACUUM (ANALYZE)` es razonable como siguiente acción, pendiente de autorización.

## Resumen ejecutivo

- Hay **19,866 filas eliminadas con COMMIT confirmado** en las cinco familias auditadas.
- Los cinco COUNT individuales bajo cutoff dan **0**.
- El tamaño físico no cambió: **274,874,368 bytes** total, **128,532,480** heap y **146,276,352** índices.
- Estadísticas actuales: `reltuples=470,588`, `n_live_tup=450,722`, `n_dead_tup=34,454`; todas son estimaciones, no libro mayor de DELETE.
- No se registra VACUUM desde el último ANALYZE ni hay worker de vacuum ahora. Autovacuum está activo, pero el umbral estimado de vacuum es ~94,168 y el contador de modificaciones desde ANALYZE aún no alcanza el umbral de autoanalyze.
- No hay beneficio físico inmediato en seguir podando familias adicionales: DELETE no encoge estos archivos. Los candidatos restantes conocidos tienen más valor actual o más incertidumbre.

## A. Filas eliminadas confirmadas

El total se reconstruyó desde checkpoints con COMMIT confirmado. Para `arena_select_view`, los cuatro checkpoints suman `50 + 2,000 + 3,000 + 2,551 = 7,601`.

| Event | Confirmed rows deleted |
| --- | ---: |
| `dock_tap` | 1,453 |
| `dock_center_close` | 207 |
| `arena_mount` | 5,368 |
| `arena_fresh_reset_fired` | 5,237 |
| `arena_select_view` | 7,601 |
| **Total confirmado** | **19,866** |

Fuentes: el [checkpoint posterior a las primeras cuatro podas](2026-09-28-analytics-events-post-prune-review.md), [canary de Arena Select](2026-09-28-arena-select-view-canary-50.md), [ronda 1](2026-09-28-arena-select-view-round-1.md), [ronda 2](2026-09-28-arena-select-view-round-2.md) y [poda final](2026-09-28-arena-select-view-final-prune.md). El experimento anterior de hasta 250 filas no está incluido porque no existe evidencia suficiente en los checkpoints versionados de su COMMIT y distribución por evento.

## B. Candidatos restantes bajo cutoff

Se ejecutó un COUNT independiente por evento mediante el runner del proyecto con sesión READ ONLY; no hubo `GROUP BY` global.

| Event | Rows before cutoff now |
| --- | ---: |
| `dock_tap` | 0 |
| `dock_center_close` | 0 |
| `arena_mount` | 0 |
| `arena_fresh_reset_fired` | 0 |
| `arena_select_view` | 0 |

Los checkpoints previos registran para estos filtros el uso de `idx_analytics_events_event` y ausencia de `Seq Scan` grande.

## C. Estado físico y estadístico actual

### Tamaños

| Medida | Bytes actuales | Referencia previa | Cambio |
| --- | ---: | ---: | ---: |
| Total (`pg_total_relation_size`) | 274,874,368 | 274,874,368 | 0 |
| Heap (`pg_relation_size`) | 128,532,480 | 128,532,480 | 0 |
| Índices (`pg_indexes_size`) | 146,276,352 | 146,276,352 | 0 |

| Índice | Bytes |
| --- | ---: |
| `analytics_events_pkey` | 19,316,736 |
| `idx_analytics_events_created_at` | 12,099,584 |
| `idx_analytics_events_event` | 38,903,808 |
| `idx_analytics_events_account_ref` | 18,489,344 |
| `idx_analytics_events_container` | 13,787,136 |
| `idx_analytics_events_country` | 13,647,872 |
| `idx_analytics_events_session` | 16,252,928 |
| `idx_analytics_events_surface` | 13,778,944 |

DELETE hace que las versiones de fila se vuelvan obsoletas; no devuelve ordinariamente los bytes al sistema operativo. El VACUUM normal puede limpiarlas y dejar espacio reutilizable dentro de la relación. PostgreSQL documenta que el retorno de espacio al sistema suele requerir `VACUUM FULL`, que reescribe la tabla; el VACUUM normal sólo puede truncar páginas finales vacías en condiciones limitadas. ([VACUUM PostgreSQL 16](https://www.postgresql.org/docs/16/sql-vacuum.html), [recuperación de espacio](https://www.postgresql.org/docs/16/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY))

### Estadísticas

| Estadística | Valor actual |
| --- | ---: |
| `pg_class.reltuples` | 470,588 |
| `pg_class.relpages` | 15,690 |
| `n_live_tup` | 450,722 |
| `n_dead_tup` | 34,454 |
| `last_vacuum` / `last_autovacuum` | null / null |
| `last_analyze` | 2026-09-25 13:24:02.694825 UTC |
| `last_autoanalyze` | null |
| `vacuum_count` / `autovacuum_count` | 0 / 0 |
| `analyze_count` / `autoanalyze_count` | 1 / 0 |
| `n_mod_since_analyze` | 19,866 |

Autovacuum está `on`. Valores efectivos: `autovacuum_vacuum_threshold=50`, `autovacuum_vacuum_scale_factor=0.2`, `autovacuum_analyze_threshold=50`, `autovacuum_analyze_scale_factor=0.1`. La tabla no tiene overrides (`reloptions` vacío) y no había worker de vacuum activo al consultar.

PostgreSQL define conceptualmente el vacuum threshold con `pg_class.reltuples`; usando los valores actuales, la aproximación es `50 + 0.2 × 470,588 = 94,167.6`. `n_dead_tup=34,454` queda aproximadamente **59,714** por debajo. Es una aproximación: el contador de tuplas obsoletas y las estadísticas acumuladas son semi-precisos, y puede haber otros disparadores de vacuum. La documentación describe también que el contador de cambios desde ANALYZE se compara contra un umbral similar. ([Routine Vacuuming PostgreSQL 16](https://www.postgresql.org/docs/16/routine-vacuuming.html#AUTOVACUUM))

El umbral efectivo aproximado de autoanalyze es `50 + 0.1 × 470,588 = 47,108.8`; `n_mod_since_analyze=19,866` sigue por debajo. Por eso no conviene esperar que autoanalyze refresque pronto las estadísticas sólo por esta ronda de DELETE.

`reltuples` y `n_live_tup` difieren en **19,866**, que coincide con los COMMIT confirmados desde el ANALYZE. También `n_dead_tup` subió en esa magnitud desde la última lectura posterior al ANALYZE. La coincidencia corrobora la contabilidad, pero no convierte estos campos estadísticos en conteos exactos.

## D. Evaluación de mantenimiento

### VACUUM normal

**Beneficio:** quitar versiones muertas del heap y de índices y dejar ese espacio disponible para reutilización; actualizar el visibility map. No se espera que reduzca los tamaños actuales de heap/índices en condiciones normales.

**Riesgo y locks:** genera I/O y puede competir con consultas activas. El VACUUM normal usa `SHARE UPDATE EXCLUSIVE`, que permite el DML y SELECT habitual pero entra en conflicto con otra operación del mismo modo y algunas operaciones DDL. La truncación de páginas vacías al final puede necesitar un breve `ACCESS EXCLUSIVE`; si se prioriza evitar ese lock, PostgreSQL 16 permite `TRUNCATE FALSE`. ([Locks explícitos PostgreSQL 16](https://www.postgresql.org/docs/16/explicit-locking.html), [opción TRUNCATE de VACUUM](https://www.postgresql.org/docs/16/sql-vacuum.html))

**Costo probable:** un pase por páginas modificadas y limpieza de los índices que lo requieran; la relación ocupa 262.1 MiB combinados. No hay duración observada de VACUUM en este proyecto. Como no consta un vacuum previo, hay que presupuestar I/O apreciable y programarlo en hora de baja actividad, aunque el volumen no es grande para una única operación.

**Oportunidad:** sí es razonable hacer un VACUUM normal dirigido a esta tabla ahora que terminaron las tres familias y se estiman 34,454 dead tuples. El umbral automático calculado está lejos, así que esperar sólo al umbral puede dejar espacio muerto sin limpiar durante más tiempo. No hay urgencia de devolver espacio al filesystem; el beneficio principal es reutilización y mantenimiento de índices/visibility map.

### ANALYZE

**Beneficio:** refrescar las estadísticas del planner, especialmente la distribución de `event` tras quitar 19,866 filas concentradas en cinco valores. La última ANALYZE fue antes de las podas. Los campos de tuplas vivos/muertos no sustituyen los histogramas y frecuencias usados por el planner.

**Costo:** ANALYZE toma una muestra aleatoria en tablas grandes, requiere lectura y un lock compatible con actividad normal. No se encontró duración registrada del ANALYZE controlado anterior, así que no se inventa una cifra de duración. ([ANALYZE PostgreSQL 16](https://www.postgresql.org/docs/16/sql-analyze.html))

**Orden recomendado:** después del VACUUM, o como parte de `VACUUM (ANALYZE)`, cuyo orden documentado es VACUUM seguido por ANALYZE. Para este caso conviene una sola operación dirigida a la tabla: `VACUUM (ANALYZE, TRUNCATE FALSE) public.analytics_events;` No se ejecutó.

### VACUUM FULL

No hay evidencia que lo justifique. Las eliminaciones confirmadas equivalen a ~4.2% de `reltuples` y el tamaño físico no se redujo, como se espera tras DELETE. VACUUM FULL exige `ACCESS EXCLUSIVE`, reescribe heap e índices y necesita espacio adicional cercano al tamaño de la tabla durante el cambio. No debe usarse sólo porque el tamaño en bytes no bajó. ([VACUUM FULL PostgreSQL 16](https://www.postgresql.org/docs/16/sql-vacuum.html), [locks explícitos](https://www.postgresql.org/docs/16/explicit-locking.html))

## E. ¿Hace falta una cuarta familia?

**Decisión: `STOP MANUAL PRUNING`.** El efecto de una poda adicional sería liberar espacio reutilizable sólo después de VACUUM, y no encoger por sí sola los archivos. Los candidatos ya medidos tienen emisores actuales o valor operacional/producto que supera su beneficio marginal inmediato.

| Familia | Volumen histórico conocido | Valor / riesgo | Beneficio marginal de podar ahora |
| --- | ---: | --- | --- |
| `modal_open` | ≈8,416 | Emisor actual y genérico de múltiples modales; sin consumidor RPC localizado, pero props dan contexto y dashboards externos no son visibles. Riesgo medio. | Bajo-medio: volumen material, pero no reduce tamaño físico y requiere descartar lectores externos. |
| `tx_progress_*` | ≈8,371 combinadas | Emisor actual; señales de vista, paso, duración y resultado para diagnósticos transaccionales. Riesgo medio-alto hasta sustituir esa observabilidad. | Bajo: conservar mientras se depura el flujo de transacciones. |
| Coach granular | ≈835 combinadas (`coach_viewer_move_jump`, `coach_viewer_replay_scrub`) | Emisor actual; diagnóstico de navegación/replay que no tiene señal equivalente. Alto valor por fila. | Muy bajo por volumen; no priorizar. |
| PRO / monetization | No hay total familiar actualizado. Ejemplos medidos: `pro_cta_clicked` 2,855; `pro_purchase_failed` 2,830; `pro_card_viewed` 2,110; `monetization.pro_sheet_view` 2,109; `monetization.pro_chip_view` 1,701. | Emisores actuales y señal comercial; no hay consumidor RPC directo localizado, pero hay experimentos/análisis comerciales y posibles dashboards externos. Riesgo medio/alto. | No justificar sin consolidar primero el funnel y revisar lectores. |

Los volúmenes provienen de auditorías previas por evento, no se volvieron a perfilar en este checkpoint. Los dashboards externos no versionados no pueden descartarse con búsqueda de repositorio.

## F. Política permanente propuesta

1. **Retención raw:** conservar 45 días lógicos de telemetría raw. Los RPCs principales usan ventanas móviles de 30 días; 15 días extra dan margen para retrasos, diagnósticos y lecturas operacionales.
2. **Frecuencia de poda:** reemplazar el actual cron mensual de 90 días por una política revisada de 45 días. Preferir ejecución semanal en baja actividad para acotar la retención efectiva a aproximadamente 45–52 días. Mantener el borrado indexado por `created_at`, por lotes acotados con límite por corrida, progreso verificable y sin reintentos ciegos. El repo define hoy un `prune_analytics_events()` de 90 días en un cron mensual; la actividad efectiva del cron no se revalidó en esta consulta.
3. **Qué conservar raw:** por 45 días, eventos canónicos usados por stats/RPC/admin, embudos de Arena/training y telemetría operativa de pagos/transacciones y persistencia de partidas. Retener sólo props útiles para decisiones o diagnóstico; limitar cardinalidad y no añadir payload identificable.
4. **Qué agregar:** antes de vencer raw que soporte análisis prolongado, guardar agregados diarios UTC compactos. Incluir conteos/tasas por dimensiones estables necesarias (p. ej. evento, surface, resultado), sin `session_id`, wallet, `game_id` ni payload raw. Preservar también definiciones/versiones de query y denominadores. El CSV de Arena entry y la serie factual de `arena_select_view` son precedentes; esta última no recupera cohort membership.
5. **Cohortes y retención:** para futuros análisis de D1/returning, definir y versionar entrada a cohorte, ventana, retorno, denominador y deduplicación antes de recolectar. Persistir sólo agregado por cohorte/día para análisis histórico. No presentar porcentajes heredados no reproducibles como recálculo.
6. **Emitters:** mantener retirados `dock_tap`, `dock_center_close`, `arena_mount`, `arena_fresh_reset_fired` y `arena_select_view`; no volverlos a emitir por accidente. Consolidar `modal_open` hacia eventos semánticos una vez auditados consumidores. Conservar `tx_progress_*`, coach granular y señales PRO mientras no exista una métrica/telemetría sustituta validada.
7. **Reactivar telemetría cliente:** mantener `NEXT_PUBLIC_TELEMETRY_ENABLED=0` hasta que esté aprobada la política, el pruning programado y la lista de eventos; después habilitar en un deployment fresco (la variable pública se incorpora al bundle), comprobar que batching siga activo y observar una ventana controlada de 15 minutos: requests, filas, errores, bloques dirtied/written y deltas de `pg_stat_statements`. Mantener un kill switch que reduzca carga y política de drop/no-retry.
8. **Guardrails:** preflight read-only de destino, plan indexado y workers/locks; batches con `SKIP LOCKED`, timeouts y límite de tiempo; baseline leído en cada ejecución, no heredado; COMMIT explícito confirmado; COUNT reconciliado tras cada batch; detener ante timeout, presión, mismatch o estado ambiguo; nunca automatizar reintentos de estado incierto; separar completamente runner read-only de wrapper de escritura y no ejecutar tests por import.

La implementación cron exacta debe revisarse aparte antes de cualquier migration/config change; esta auditoría sólo propone la política.

## Orden exacto de siguientes acciones

1. **No abrir una cuarta familia de poda manual.** Las cinco familias quedan confirmadas en cero bajo el cutoff.
2. Cuando exista autorización separada, ejecutar una única operación normal dirigida a `public.analytics_events`, preferiblemente `VACUUM (ANALYZE, TRUNCATE FALSE)`, en baja actividad. No usar FULL.
3. Hacer checkpoint read-only posterior de tamaños, `reltuples`, `n_live_tup`, `n_dead_tup`, tiempos/counts de vacuum/analyze e índices. Esperar que el espacio sea reutilizable; no exigir reducción de tamaño físico.
4. Aprobar e implementar retención raw lógica de 45 días con poda semanal por lotes, tras validar el cron vivo y sus privileges en producción.
5. Definir métricas históricas, cohortes y emitters canónicos; agregar lo necesario antes de expirar raw.
6. Mantener la telemetría cliente apagada hasta que esos cambios estén desplegados y pasen la ventana de observación; luego decidir reactivación gradual.

No se ejecutó DELETE, VACUUM, ANALYZE, REINDEX ni cambio de configuración en este checkpoint.
