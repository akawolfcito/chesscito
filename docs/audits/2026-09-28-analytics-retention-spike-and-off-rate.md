# Investigación read-only: spikes y flujo de `analytics_events`

Fecha: 2026-09-28. No se ejecutó DML ni mantenimiento y no se modificó el cron.

## Resumen ejecutivo

- Los dos spikes son **crecimiento general del stream de telemetría**, no un único evento runaway: el evento de mayor volumen explica sólo 9–10% y se necesitan 43–52 eventos para cubrir 90% de cada ventana.
- Hubo 6,448 sesiones distintas en el spike B y 1,514 en el spike A, frente a 245 en la semana pequeña. Esto apoya una subida amplia de tráfico/actividad, pero los IDs de sesión son client-generated y no prueban que cada sesión sea una persona.
- La dimensión `app_version` confirma múltiples builds por ventana; `source=direct` y `campaign=NULL`. El repo documenta que Preview y Production comparten base y que no se guarda una dimensión de ambiente. No se puede separar actividad de usuarios de Preview/test con estos datos.
- El repo documentó una reciente “launch peak” que concentró 62% de la tabla en seis días de agosto. Las fechas coinciden ampliamente. Además, el batching desplegado el 3 de agosto mejoró el camino de escritura, pero no redujo filas por evento. Son explicaciones plausibles y respaldadas por documentación, no una atribución causal completa a las dos ventanas exactas.
- Writes observados en los últimos 7 días: **0**; 24 h: **0**; 3 días: **0**. `created_at` es la única fecha de fila y tiene `DEFAULT now()`, así que se usa como aproximación de inserción.
- A 90 días, en la captura actual hay **12,680** filas elegibles para la función de pruning vigente. El cron programado no se ejecutó.
- `IMPLEMENTATION READINESS: NEED MORE INVESTIGATION`: antes de fijar la política definitiva hay que reconciliar el origen Preview/Production de los build SHAs, y observar el flujo más tiempo si se planea volver a encender la telemetría.

## Método

Captura fija de ventanas recientes: `v_now = 2026-09-28T16:37:36.535685Z`. Límites usados:

| Ventana | Desde UTC | Hasta UTC |
| --- | --- | --- |
| 24 h | 2026-09-27 16:37:36.535685 | 2026-09-28 16:37:36.535685 |
| 3 días | 2026-09-25 16:37:36.535685 | 2026-09-28 16:37:36.535685 |
| 7 días | 2026-09-21 16:37:36.535685 | 2026-09-28 16:37:36.535685 |
| 90 días | antes de 2026-06-30 16:37:36.535685 | — |

Para las distribuciones por evento y las dimensiones se revisó `EXPLAIN` sin `ANALYZE` antes de contar. Los planes usaron el rango de `idx_analytics_events_created_at` con `Index Scan` o `Index Only Scan`; no hubo Seq Scan global. Se devolvieron sólo agregados: nombres de evento/dimensiones y conteos; nunca `props`, payloads, IDs de sesión ni IDs de fila.

`pnpm ops:query` permite sólo sentencias que empiezan con `SELECT`/`WITH` y rechazó `EXPLAIN` antes de abrir conexión. Los EXPLAIN y agregados posteriores se corrieron con Docker/psql y el helper de credenciales del repo, en una sesión que ejecutó `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`. No se cambió el runner ni código del proyecto.

## SPIKE ROOT DISTRIBUTION

Ventanas fijas: spike A 45,303 filas; spike B 159,194; semana pequeña 3,242. Las tablas muestran los eventos más grandes hasta superar 90% acumulado.

### Spike A — 2026-08-07 16:15:43.147851 a 2026-08-14 16:15:43.147851 UTC

COUNT por evento: 45,303. Sesiones distintas: **1,514**. Plan indexado. El top 52 llega a 90.36%.

| Event | Count | % ventana |
| --- | ---: | ---: |
| `peones_balance_viewed` | 4,252 | 9.39% |
| `play_hub_view` | 2,648 | 5.85% |
| `app_opened` | 1,851 | 4.09% |
| `arena_coach_signal_viewed` | 1,663 | 3.67% |
| `modal_open` | 1,509 | 3.33% |
| `training_exercise_started` | 1,448 | 3.20% |
| `arena_game_start` | 1,276 | 2.82% |
| `arena_start_tap` | 1,276 | 2.82% |
| `tx_progress_view` | 1,129 | 2.49% |
| `hub_tour_view` | 1,066 | 2.35% |
| `hub_view` | 1,063 | 2.35% |
| `hub_tour_finish` | 1,031 | 2.28% |
| `tx_progress_done` | 941 | 2.08% |
| `training_exercise_completed` | 914 | 2.02% |
| `exercise_complete` | 908 | 2.00% |
| `coach_preview_viewed` | 877 | 1.94% |
| `arena_game_end` | 865 | 1.91% |
| `game_persist_attempt` | 865 | 1.91% |
| `game_persist_outcome` | 858 | 1.89% |
| `play_hub_arena_tap` | 826 | 1.82% |
| `training_stars_earned` | 798 | 1.76% |
| `arena_select_view` | 731 | 1.61% |
| `monetization.coach_review_offered` | 682 | 1.51% |
| `arena_difficulty_tap` | 664 | 1.47% |
| `labyrinth_complete` | 651 | 1.44% |
| `score_save_free` | 646 | 1.43% |
| `lite_session_started` | 567 | 1.25% |
| `daily_tactic_started` | 540 | 1.19% |
| `hub_reward_tile_tap` | 507 | 1.12% |
| `arena_fresh_reset_fired` | 490 | 1.08% |
| `arena_mount` | 490 | 1.08% |
| `score_save_failed` | 482 | 1.06% |
| `pro_cta_clicked` | 469 | 1.04% |
| `pro_purchase_failed` | 463 | 1.02% |
| `peones_earned` | 403 | 0.89% |
| `coach_viewer_viewed` | 397 | 0.88% |
| `victory_claim_tx` | 369 | 0.81% |
| `monetization.play_again_tap` | 368 | 0.81% |
| `arena_x_close_fired` | 350 | 0.77% |
| `onboarding_variant_assigned` | 342 | 0.75% |
| `monetization.pro_sheet_view` | 331 | 0.73% |
| `pro_card_viewed` | 331 | 0.73% |
| `daily_streak_updated` | 319 | 0.70% |
| `daily_tactic_completed` | 319 | 0.70% |
| `play_hub_pro_tap` | 299 | 0.66% |
| `dock_tap` | 280 | 0.62% |
| `tx_progress_step` | 271 | 0.60% |
| `monetization.shop_item_view` | 270 | 0.60% |
| `exercise_fail` | 234 | 0.52% |
| `coach_history_unanalyzed_view` | 226 | 0.50% |
| `badge_claim_tx` | 201 | 0.44% |
| `score_submit_tx` | 182 | 0.40% |

### Spike B — 2026-07-31 16:15:43.147851 a 2026-08-07 16:15:43.147851 UTC

COUNT por evento: 159,194. Sesiones distintas: **6,448**. El top 43 llega a 90.11%.

| Event | Count | % ventana |
| --- | ---: | ---: |
| `peones_balance_viewed` | 16,607 | 10.43% |
| `play_hub_view` | 11,845 | 7.44% |
| `app_opened` | 7,464 | 4.69% |
| `hub_tour_view` | 6,368 | 4.00% |
| `hub_tour_finish` | 6,052 | 3.80% |
| `arena_coach_signal_viewed` | 5,770 | 3.62% |
| `training_exercise_started` | 5,435 | 3.41% |
| `modal_open` | 5,094 | 3.20% |
| `arena_game_start` | 4,386 | 2.76% |
| `arena_start_tap` | 4,386 | 2.76% |
| `tx_progress_view` | 3,672 | 2.31% |
| `play_hub_arena_tap` | 3,466 | 2.18% |
| `hub_view` | 3,450 | 2.17% |
| `exercise_complete` | 3,286 | 2.06% |
| `training_exercise_completed` | 3,204 | 2.01% |
| `training_stars_earned` | 3,198 | 2.01% |
| `tx_progress_done` | 2,850 | 1.79% |
| `score_save_free` | 2,682 | 1.68% |
| `labyrinth_complete` | 2,637 | 1.66% |
| `coach_preview_viewed` | 2,613 | 1.64% |
| `game_persist_attempt` | 2,612 | 1.64% |
| `arena_game_end` | 2,610 | 1.64% |
| `game_persist_outcome` | 2,597 | 1.63% |
| `pro_cta_clicked` | 2,563 | 1.61% |
| `pro_purchase_failed` | 2,548 | 1.60% |
| `lite_session_started` | 2,545 | 1.60% |
| `monetization.coach_review_offered` | 2,067 | 1.30% |
| `arena_difficulty_tap` | 1,883 | 1.18% |
| `hub_reward_tile_tap` | 1,784 | 1.12% |
| `daily_tactic_started` | 1,699 | 1.07% |
| `pro_card_viewed` | 1,628 | 1.02% |
| `monetization.pro_sheet_view` | 1,627 | 1.02% |
| `play_hub_pro_tap` | 1,526 | 0.96% |
| `peones_earned` | 1,342 | 0.84% |
| `coach_viewer_viewed` | 1,339 | 0.84% |
| `victory_claim_tx` | 1,305 | 0.82% |
| `arena_x_close_fired` | 1,166 | 0.73% |
| `tx_progress_step` | 1,127 | 0.71% |
| `daily_streak_updated` | 1,060 | 0.67% |
| `daily_tactic_completed` | 1,060 | 0.67% |
| `exercise_fail` | 1,007 | 0.63% |
| `monetization.play_again_tap` | 981 | 0.62% |
| `monetization.shop_item_view` | 910 | 0.57% |

### Semana pequeña — 2026-07-24 16:15:43.147851 a 2026-07-31 16:15:43.147851 UTC

COUNT por evento: 3,242. Sesiones distintas: **245**. El top 35 llega a 90.07%.

| Event | Count | % ventana |
| --- | ---: | ---: |
| `hub_view` | 339 | 10.46% |
| `peones_balance_viewed` | 266 | 8.20% |
| `app_opened` | 222 | 6.85% |
| `training_exercise_started` | 197 | 6.08% |
| `modal_open` | 176 | 5.43% |
| `play_hub_view` | 146 | 4.50% |
| `web_wallet_ready` | 108 | 3.33% |
| `lite_session_started` | 107 | 3.30% |
| `tx_progress_view` | 107 | 3.30% |
| `web_access_gate_viewed` | 103 | 3.18% |
| `web_login_succeeded` | 103 | 3.18% |
| `training_exercise_completed` | 93 | 2.87% |
| `hub_tour_finish` | 84 | 2.59% |
| `exercise_complete` | 65 | 2.00% |
| `hub_tour_view` | 63 | 1.94% |
| `training_stars_earned` | 63 | 1.94% |
| `hub_tour_replay` | 55 | 1.70% |
| `tx_progress_done` | 54 | 1.67% |
| `hub_reward_tile_tap` | 45 | 1.39% |
| `arena_coach_signal_viewed` | 42 | 1.30% |
| `web_login_started` | 42 | 1.30% |
| `labyrinth_complete` | 40 | 1.23% |
| `hub_start_focus_tap` | 39 | 1.20% |
| `exercise_fail` | 38 | 1.17% |
| `training_retry_completed` | 36 | 1.11% |
| `monetization.coach_review_offered` | 35 | 1.08% |
| `monetization.pro_sheet_view` | 35 | 1.08% |
| `play_hub_pro_tap` | 35 | 1.08% |
| `pro_card_viewed` | 35 | 1.08% |
| `daily_tactic_started` | 34 | 1.05% |
| `score_submit_tx` | 24 | 0.74% |
| `arena_game_start` | 23 | 0.71% |
| `arena_start_tap` | 23 | 0.71% |
| `score_save_free` | 23 | 0.71% |
| `tx_progress_step` | 20 | 0.62% |

## Builds y sesiones: qué aporta la evidencia de DB

El código de `apps/web/src/lib/analytics/client-dimensions.ts` rellena `app_version` con `NEXT_PUBLIC_BUILD_SHA` (fallback `dev`); la migración `20260723040000_analytics_dimensions.sql` documenta ese valor como SHA de build de siete caracteres. En las tres distribuciones de dimensiones, los grupos principales tenían `source=direct` y `campaign=NULL`.

| Ventana | Distribución de builds (sin imprimir sus IDs) | Sesiones distintas | Filas/sesión aprox. |
| --- | --- | ---: | ---: |
| Spike A | 5 builds explican 95.80%; sus cuotas son 28.11%, 24.80%, 23.12%, 11.40% y 8.37% | 1,514 | 29.9 |
| Spike B | 7 builds explican 93.12%; sus cuotas son 28.83%, 21.64%, 21.39%, 9.05%, 4.96%, 3.93% y 3.33% | 6,448 | 24.7 |
| Semana pequeña | `dev` explica 40.44%; otros builds distribuidos, con 19 grupos para llegar a 90.19% | 245 | 13.2 |

La comparación local del campo `app_version` con el historial Git sitúa los grupos entre commits del 2 al 12 de agosto; incluyen cambios de arte, interfaz, progreso/guardado y handoffs/documentación. Los valores de versión se omiten: no se exportan identificadores de DB ni valores de sesión. No hay un solo build dominante. El repo documenta que Preview y Production compartían la misma base y que no había dimensión que permitiera separarlos. `source=direct` significa atribución sin fuente de campaña; no significa “deploy Production”.

Las sesiones por fila fueron aproximadamente 13.2 en la semana pequeña, 24.7 en el spike B y 29.9 en A. La subida combina más sesiones registradas y más eventos por sesión. Como `session_id` se genera del lado cliente, no es una prueba anti-bot ni una identificación de personas; no se extrajo ningún valor de sesión.

## DB evidence vs repository inference

### DB evidence

- No existe un evento que explique por sí solo el spike: el primero representa 9.39% (A) y 10.43% (B). Las primeras cinco categorías explican 26.32% (A) y 30.36% (B).
- La mezcla incluye navegación (`play_hub_view`, `hub_view`, `hub_tour_*`), apertura (`app_opened`), entrenamiento, Arena, pagos/tx, Coach y overlays. Esto apunta a una subida general del stream, no a un loop aislado de un solo emitter.
- Spike B tiene 6,448 sesiones y A 1,514; la semana pequeña tiene 245.
- `app_version` cambia por múltiples SHAs; `source=direct`; `campaign` está nulo en los grupos dominantes.
- Algunos eventos retirados posteriormente aparecen durante las ventanas: `arena_select_view`, `arena_mount`, `arena_fresh_reset_fired` y `dock_tap`. Esto es compatible con sus emisores activos entonces; no significa que sigan activos hoy.

### Repository inference y límites

- `docs/audits/2026-08-18-physical-reclamation-design.md` registra que el **62% de la tabla** correspondía a seis días de agosto y lo denomina pico de lanzamiento reciente; estima que sale de la ventana de 45 días alrededor del 17 de septiembre. La concentración temporal concuerda con estos spikes, aunque ese documento no asigna las filas de estas ventanas a una campaña concreta.
- El cambio del 3 de agosto (“batch client events and bulk writes”) redujo requests/round-trips, no el número de filas por evento aceptado. La auditoría del 4 de agosto documentó fallos 522 previos y que, tras mejorar el camino de escritura, más eventos podían aterrizar. Eso es un posible factor de cambio en escrituras exitosas, pero no demuestra cuántas filas de estos spikes se deben al despliegue.
- El reporte de telemetría del 18 de agosto encontró una sesión extrema de 660 eventos que correspondía a un jugador con 22 partidas, y un p50 de 2 eventos por sesión para esos eventos. Es evidencia separada de que algunas colas altas pueden ser actividad real; no valida individualmente las sesiones de julio/agosto de estos spikes.
- No se encontró evidencia versionada que marque esas ventanas como una campaña o carga de test específica. Como Preview y Production comparten base y no se etiqueta el ambiente, no se puede descartar contaminación de Preview ni clasificar todos los `session_id` como usuarios reales.

## Historial de los emisores que más contribuyeron

| Eventos principales | Emitter y función | Historial relevante | Estado en código actual |
| --- | --- | --- | --- |
| `peones_balance_viewed` | `apps/web/src/lib/peones/telemetry.ts`, señal de balance visible | Introducido el 7 jun; cambio del 18 ago redujo duplicación por remount | Sigue activo con dedupe mejorado; aun es el mayor evento individual en las tres ventanas. |
| `play_hub_view` | `apps/web/src/components/hub/play-hub-client.tsx`, view del Play hub | Presente en el cleanup del Play hub del 5 jul | Sigue activo; usa `track()`. |
| `app_opened` | `apps/web/src/components/analytics/analytics-boot.tsx`, una vez por visita/tab | Añadido junto con dimensiones el 23 jul | Sigue activo; `/api/telemetry` también lo usa para el write de `session_first_seen`. |
| `hub_tour_view`, `hub_tour_finish` | `apps/web/src/components/hub/use-hub-tour.ts` | Cableado del tour el 12 jul | Sigue activo; eventos de recorrido/interacción. |
| `training_exercise_started` | `apps/web/src/hooks/use-exercise-progress.ts`, inicio de intento | Emitters de Sprint 1 introducidos el 6 jun | Sigue activo y protegido contra reemisión por hidratación. |
| `modal_open` | Varias overlays de Arena, ejercicios y Daily | Call sites distribuidos; hubo cambios de dedupe de overlays, pero no un solo modal explica el total | Sigue activo como familia de vistas de UI. |
| `arena_game_start`, `arena_start_tap`, `arena_coach_signal_viewed` | `apps/web/src/app/[locale]/arena/page.tsx` | Anteriores al intervalo; lógica funcional existente antes del cambio de ruta locale de mayo | Siguen activos. Son eventos distintos de los tres emitters retirados de Arena. |
| `tx_progress_view`, `tx_progress_done`, `tx_progress_step` | `apps/web/src/components/redesign/tx-progress-steps.tsx` | Cableado el 20 may | Siguen activos como telemetría de progreso de transacción. |

Los eventos históricos `arena_select_view`, `arena_mount`, `arena_fresh_reset_fired` y `dock_tap` aparecen en la evidencia de DB pero sus emitters fueron retirados desde entonces. La distribución no indica que ellos originaran el pico.

El cambio de batching no añadió una tormenta de eventos: mantuvo los call sites y juntó solicitudes del cliente en batches de hasta 20. Los comentarios y tests del handoff del 3 de agosto dicen explícitamente que batching reduce requests, no filas aceptadas. No se encontró un cambio de un solo emitter dominante que coincida con un salto de 10–60×.

## CURRENT WRITE RATE

`created_at` es `timestamptz NOT NULL DEFAULT now()` en `20260424000000_analytics_events.sql`. La tabla no ofrece un `inserted_at` independiente; por ello, esto mide filas creadas en el periodo como proxy de inserciones. Los límites se fijaron con una sola captura `v_now`.

| Window | Rows inserted/equivalent created |
| --- | ---: |
| Últimas 24 h | **0** |
| Últimos 3 días | **0** |
| Últimos 7 días (2026-09-21 16:37:36.535685–2026-09-28 16:37:36.535685 UTC) | **0** |

Distribución por evento en los últimos 7 días: **0 filas**, sin eventos que listar. `current_daily_avg = 0 / 7 = 0`; `current_weekly_total = 0`.

**Clasificación: CURRENT FLOW < 10K/WEEK.** El flujo observado es cero con el estado actual. Es una medición de una ventana de siete días, no una proyección garantizada.

## ACTIVE WRITERS

La búsqueda de `analytics_events` e `insert()` en `apps/web/src` encontró dos writers runtime:

1. **Ruta de telemetría cliente:** `apps/web/src/app/api/telemetry/route.ts`, `POST`, inserta el lote validado en `analytics_events`. La bandera cliente detiene `track()` en `apps/web/src/lib/telemetry.ts`, pero la ruta server-side no consulta `NEXT_PUBLIC_TELEMETRY_ENABLED`; un bundle antiguo o una llamada directa todavía podría escribir.
2. **Eventos server-side de duelos:** `apps/web/src/lib/duel/service.ts`, `recordDuelEvent()`, hace insert directo con Supabase. Lo llaman `apps/web/src/app/api/duel/route.ts` (`duel_created`), `apps/web/src/app/api/duel/[id]/join/route.ts` (`duel_joined`), `apps/web/src/app/api/duel/[id]/move/route.ts` (`duel_first_move`, `duel_finished`) y `apps/web/src/app/api/duel/[id]/resign/route.ts` (`duel_finished`). No depende de la telemetría cliente.

El conteo cero de los últimos siete días dice que esos writers no produjeron filas observables en esa ventana; el código demuestra que siguen siendo caminos posibles. `stats`, `/api/admin/lite-stats` y otras referencias encontradas son lecturas, no writers.

## 90D CURRENT ELIGIBLE

Con la misma captura temporal, el COUNT indexado de:

```sql
created_at < '2026-06-30T16:37:36.535685Z'::timestamptz
```

devolvió **12,680 filas elegibles ahora** para la función actual de 90 días. `EXPLAIN` usó `Index Only Scan using idx_analytics_events_created_at`, estimando 12,948 filas.

La última lectura viva disponible del cron confirma `prune_analytics_events_monthly`, activo, `0 3 1 * *`, timezone GMT, siguiente ejecución derivada el **2026-10-01 03:00 GMT**. No se invocó el job. En su siguiente ejecución, el cutoff de 90 días habrá avanzado; por ello, 12,680 es el número elegible **al instante medido**, no una predicción exacta del DELETE del 1 de octubre.

## STEADY STATE RECOMMENDATION

**Cap semanal recomendado para el estado actual con cliente telemetry OFF: 5,000 filas/semana**, como techo normal inicial. Está muy por encima de las cero filas creadas en los últimos siete días y evita un cap semanal grande e innecesario ahora. Esto **no** revoca la clasificación histórica `CAP 5000 INSUFFICIENT`: el cap no cubrió el flujo histórico cliente-on (5/7 ventanas previas sobre 5,000). Si se reactiva la telemetría cliente o vuelve a aparecer un flujo alto, hay que recalibrar antes; 5,000 no cubre esos spikes históricos.

## CATCH-UP RECOMMENDATION

Separar un proceso temporal del cron semanal. Si se usa el backlog de referencia de 240,965 filas y se ignoran nuevas entradas:

| Presupuesto máximo de catch-up | Runs/días teóricos | Comentario |
| ---: | ---: | --- |
| 10,000 filas/día | **25** | Recomendación inicial de diseño, en lotes pequeños con checkpoint y pausa; no autorización de DML. |
| 20,000 filas/día | **13** | Sólo escenario teórico; duplica presión por día y no se recomienda como arranque. |

El catch-up debería tener tope de 100 por transacción, máximo 100 batches (10,000 filas) y **60 s de wall-clock por día/run** al empezar, sin retry ciego, salida de progreso (filas y duración), observación de locks/autovacuum y condición de parada. Los 60 s son un guard propuesto, no una duración verificada para ese DELETE general. Si el 90-day cron corre antes, recontar el backlog en una futura fase; no sumar dos veces sus filas elegibles.

## IMPLEMENTATION READINESS

### NEED MORE INVESTIGATION

Antes de fijar migration y gate de telemetría, resolver con evidencia de despliegues qué `NEXT_PUBLIC_BUILD_SHA` eran Preview vs Production para las ventanas del 31 jul–14 ago. Los hashes, el `source=direct`, `campaign=NULL` y el uso de una base compartida impiden decidir si el crecimiento fue tráfico real, pruebas en Preview o ambos. Mantener cliente telemetry OFF y medir otro periodo continuo, incluyendo métricas de inserts del writer de duelos/ruta, antes de considerar reactivación. La ventana actual en cero es alentadora, pero no identifica causalidad histórica ni garantiza el flujo futuro.

No se implementó migration, no se cambió cron, no se ejecutó DELETE ni mantenimiento y no se reactivó telemetría.
