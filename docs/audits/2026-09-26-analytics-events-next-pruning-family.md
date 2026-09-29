# Auditoría de candidatos para segunda poda de `analytics_events`

**Consulta:** 2026-09-26 · **Modo:** READ-ONLY · **Tabla:** `public.analytics_events`

## Resumen ejecutivo

- Se midieron individualmente 98 eventos con cutoff fijo; todos los planes previos fueron `Index Only Scan` en `idx_analytics_events_event`, sin Seq Scan grande. No hubo agrupación global.
- Familia recomendada para revisar/autorizar posteriormente: **Arena entry/recovery diagnostics** (`arena_mount` + `arena_fresh_reset_fired`), **10,605 filas** (~**2.25%** de referencia 470,588).
- Ambos son diagnósticos sin consumidor RPC localizado; la documentación exige dashboard review antes de consolidar. Clasificación conservadora: `KEEP TEMPORARILY`. No se borró nada.
- No incluir `arena_x_close_fired`, `arena_game_start/end`, `app_opened`, aliases stats/Lite ni eventos PRO en poda inmediata.
- RPC/agregadores principales miran 30 días; cutoff está fuera. `/api/admin/lite-stats` permite rangos históricos para daily/training seleccionados.

## Método y límites

Cutoff exacto: `2026-08-11T14:12:14.822368Z`. Para cada literal se hizo primero `EXPLAIN` sin `ANALYZE`; todos los 98 planes fueron por `idx_analytics_events_event`, sin Seq Scan grande. Luego se ejecutó COUNT individual junto a `min(created_at)`/`max(created_at)`. Conteos exactos del snapshot; ninguna escritura.

Porcentaje referido a snapshot previo de ~470,588 filas (antes de la última poda dock; no es denominador actual exacto). Sumas de familia se solapan y no representan filas únicas. Emitter en source significa llamada sujeta al flag; configuración efectiva no inspeccionada. Consumidores externos/dashboard no inspeccionados.

## Top 5 técnico

| # | Evento/familia | Filas | % ref. | Última aparición | Riesgo |
|---:|---|---:|---:|---|---|
| 1 | Arena entry/recovery (`arena_mount` + `arena_fresh_reset_fired`) | 10,605 | 2.25% | 2026-08-11 14:11Z | Bajo-medio: diagnostics sin RPC; comprobar dashboards. |
| 2 | Retirado `arena_select_view` | 7,601 | 1.62% | 2026-08-11 14:11Z | Medio: emitter retirado/redundancia documentada, aunque historia de producto. |
| 3 | Coach granular (`move_jump` + `replay_scrub`) | 835 | 0.18% | 2026-08-11 13:58Z | Bajo-medio; interacción específica, menos de 1%. |
| 4 | `modal_open` | 8,416 | 1.79% | 2026-08-11 14:10Z | Medio; genérico, dashboards externos desconocidos. |
| 5 | `tx_progress_view/step/step_duration` | 8,371 | 1.78% | 2026-08-11 14:10Z | Medio-alto operacional; migrar a métricas antes de descartar. |

Recomendación: revisar sólo el par Arena entry/recovery. `arena_mount` y `arena_fresh_reset_fired` son hechos distintos: reset sólo acompaña entradas frescas; conteos cercanos no demuestran duplicación. Una auditoría de septiembre lo deja como candidato tras dashboard review. `arena_x_close_fired` se conserva por valor post-game/Match Reviewer; `arena_game_start/end` apoyan análisis de progreso/abandono. `arena_select_view` es otra familia: 7,601 filas, emitter retirado pero con historia de selección.

## Sumas por familia

| Familia | Suma de filas/evento | % ref. | Riesgo |
|---|---:|---:|---|
| Arena diagnostics/entry | 27,230 | 5.79% | Medio; confirmar dashboards y separar señales de valor. |
| Arena navigation/config | 21,962 | 4.67% | Alto; acciones de usuario/funnel. |
| Coach viewer granular | 4,498 | 0.96% | Bajo-medio; interacción Coach. |
| Training granular | 2,274 | 0.48% | Medio; calidad y experimento reciente. |
| UI/navigation | 42,233 | 8.97% | Medio; métricas amplias y posible dashboard externo. |
| PRO/monetization | 13,553 | 2.88% | Alto; funnel comercial. |
| Legacy/canonical training | 48,155 | 10.23% | Alto; aliases y Lite histórico. |
| Other diagnostics/persistence | 28,160 | 5.98% | Medio-alto; cohortes y confiabilidad operacional. |

Las sumas no se deben agregar entre familias: existe solapamiento. Tampoco indican bytes recuperables.

## Matriz completa

| Event | Rows before cutoff | First seen UTC | Last seen UTC | Current emitter | Consumer | Stats dependency | Classification |
|---|---:|---|---|---|---|---|---|
| `peones_balance_viewed` | 20,488 | 2026-06-07 19:07:16.985247+00 | 2026-08-11 14:11:37.791268+00 | Sí; `track()` en source (flag-gated) | universal reach/operational signal; docs say do not degrade without replacement | no RPC clear; operational signal documented | **KEEP** |
| `play_hub_view` | 14,241 | 2026-07-05 14:26:18.722885+00 | 2026-08-11 14:01:11.662926+00 | Sí; `track()` en source (flag-gated) | stats_activation_funnel canonical alias | activation/access stats (30d; corte excluido) | **KEEP TEMPORARILY** |
| `training_exercise_started` | 10,213 | 2026-06-07 06:25:51.552373+00 | 2026-08-11 14:06:36.663065+00 | Sí; `track()` en source (flag-gated) | stats_activation_funnel canonical alias | activation/access stats (30d; corte excluido) | **KEEP** |
| `app_opened` | 8,850 | 2026-07-23 15:02:03.309629+00 | 2026-08-11 14:01:11.662926+00 | Sí; `track()` en source (flag-gated) | /api/telemetry → session_first_seen cohort write | cohort write session_first_seen; dependencia operacional | **KEEP** |
| `hub_view` | 8,850 | 2026-06-03 04:08:24.196258+00 | 2026-08-11 14:07:30.721809+00 | Sí; `track()` en source (flag-gated) | stats_activation_funnel canonical alias | activation/access stats (30d; corte excluido) | **KEEP TEMPORARILY** |
| `modal_open` | 8,416 | 2026-06-03 06:04:00.800679+00 | 2026-08-11 14:10:53.275686+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `arena_select_view` | 7,601 | 2026-06-03 03:39:58.524287+00 | 2026-08-11 14:11:22.632923+00 | No; emitter retirado | historical selection; emitter removed 2026-08-18 | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `arena_coach_signal_viewed` | 7,384 | 2026-06-03 03:39:58.57774+00 | 2026-08-11 14:11:22.632923+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `tx_progress_view` | 6,417 | 2026-06-03 06:04:00.769914+00 | 2026-08-11 14:10:53.275686+00 | Sí; `track()` en source (flag-gated) | tx operational diagnostic; docs propose metrics/logs | no stats dependency found; operational | **KEEP** |
| `arena_game_start` | 5,375 | 2026-06-03 06:02:10.743755+00 | 2026-08-11 14:11:37.791268+00 | Sí; `track()` en source (flag-gated) | Arena product/abandonment audit (2026-09-02) | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `arena_start_tap` | 5,374 | 2026-06-03 06:02:10.713934+00 | 2026-08-11 14:11:37.791268+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `arena_mount` | 5,368 | 2026-06-03 03:39:57.733017+00 | 2026-08-11 14:11:22.632923+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `arena_fresh_reset_fired` | 5,237 | 2026-06-03 03:39:58.412575+00 | 2026-08-11 14:11:22.632923+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `training_exercise_completed` | 5,212 | 2026-06-07 19:03:33.133296+00 | 2026-08-11 14:04:32.005169+00 | Sí; `track()` en source (flag-gated) | activation/access canonical alias | activation/access stats (30d; corte excluido) | **KEEP** |
| `exercise_complete` | 5,019 | 2026-06-03 23:17:13.087356+00 | 2026-08-11 14:04:32.005169+00 | Sí; `track()` en source (flag-gated) | activation/access canonical alias; /api/admin/lite-stats | activation/access stats (30d; corte excluido) | **KEEP** |
| `tx_progress_done` | 4,257 | 2026-06-03 06:04:00.830548+00 | 2026-08-11 14:10:53.275686+00 | Sí; `track()` en source (flag-gated) | tx progression/product analysis | no stats dependency found; operational | **KEEP** |
| `play_hub_arena_tap` | 4,042 | 2026-07-05 14:26:54.359757+00 | 2026-08-11 14:01:29.50708+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `coach_preview_viewed` | 3,248 | 2026-06-03 06:04:01.359945+00 | 2026-08-11 14:10:53.275686+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `arena_game_end` | 3,234 | 2026-06-03 06:04:00.561998+00 | 2026-08-11 14:10:53.275686+00 | Sí; `track()` en source (flag-gated) | Arena product/abandonment audit (2026-09-02) | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `game_persist_attempt` | 3,215 | 2026-06-03 06:04:00.56208+00 | 2026-08-11 14:10:53.275686+00 | Sí; `track()` en source (flag-gated) | persistence reliability diagnostic | no stats dependency found; operational | **KEEP** |
| `game_persist_outcome` | 3,198 | 2026-06-03 06:04:00.562466+00 | 2026-08-11 14:10:53.275686+00 | Sí; `track()` en source (flag-gated) | persistence reliability diagnostic | no stats dependency found; operational | **KEEP** |
| `pro_cta_clicked` | 2,855 | 2026-06-23 02:47:15.297903+00 | 2026-08-11 10:35:37.978132+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `pro_purchase_failed` | 2,830 | 2026-07-02 15:26:34.167221+00 | 2026-08-11 10:35:37.978132+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `arena_difficulty_tap` | 2,299 | 2026-06-04 09:34:19.384887+00 | 2026-08-11 14:11:37.791268+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `daily_tactic_started` | 2,292 | 2026-06-07 06:23:52.607075+00 | 2026-08-11 14:05:05.113219+00 | Sí; `track()` en source (flag-gated) | stats_daily_focus_funnel; /api/admin/lite-stats historical range | daily_focus stats (30d); daily_tactic también Lite histórico | **KEEP** |
| `hub_reward_tile_tap` | 2,252 | 2026-06-04 09:33:45.438128+00 | 2026-08-11 14:06:36.663065+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `pro_card_viewed` | 2,110 | 2026-06-03 22:53:12.179681+00 | 2026-08-11 12:56:05.633057+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `monetization.pro_sheet_view` | 2,109 | 2026-06-03 22:53:12.129828+00 | 2026-08-11 12:56:05.633057+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `play_hub_pro_tap` | 1,787 | 2026-07-05 20:18:37.540192+00 | 2026-08-11 12:56:05.633057+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `monetization.pro_chip_view` | 1,701 | 2026-06-03 04:08:24.186853+00 | 2026-08-08 22:51:31.398918+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `pro_training_card_viewed` | 1,701 | 2026-06-03 04:08:24.186858+00 | 2026-08-08 22:51:31.398918+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `coach_viewer_viewed` | 1,696 | 2026-06-03 23:13:55.37082+00 | 2026-08-11 14:11:06.412207+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `tx_progress_step` | 1,577 | 2026-06-04 00:16:11.564899+00 | 2026-08-11 14:10:53.275686+00 | Sí; `track()` en source (flag-gated) | tx operational diagnostic | no stats dependency found; operational | **KEEP TEMPORARILY** |
| `arena_x_close_fired` | 1,419 | 2026-06-03 23:16:34.871045+00 | 2026-08-11 14:11:06.412207+00 | Sí; `track()` en source (flag-gated) | post-game / Match Reviewer analysis (2026-08-28) | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `exercise_fail` | 1,343 | 2026-06-03 22:44:33.050432+00 | 2026-08-11 14:02:19.88238+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `daily_tactic_completed` | 1,340 | 2026-06-07 06:25:16.93587+00 | 2026-08-11 14:06:19.134194+00 | Sí; `track()` en source (flag-gated) | stats_daily_focus_funnel; /api/admin/lite-stats historical range | daily_focus stats (30d); daily_tactic también Lite histórico | **KEEP** |
| `training_retry_completed` | 885 | 2026-06-08 19:56:59.316606+00 | 2026-08-11 11:27:51.981569+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `play_hub_coach_tap` | 739 | 2026-07-05 14:26:49.755823+00 | 2026-08-11 13:52:18.524656+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `play_tactics_opened` | 645 | 2026-07-05 14:53:03.22328+00 | 2026-08-11 13:49:33.175083+00 | Sí; `track()` en source (flag-gated) | stats_activation_funnel canonical alias | activation/access stats (30d; corte excluido) | **KEEP TEMPORARILY** |
| `coach_viewer_back_tap` | 620 | 2026-06-03 23:14:46.609202+00 | 2026-08-11 14:11:22.632923+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `arena_color_tap` | 557 | 2026-06-04 03:46:04.921117+00 | 2026-08-11 13:59:08.025963+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `arena_back_tap` | 544 | 2026-06-04 00:07:57.294642+00 | 2026-08-11 13:55:17.809528+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `play_hub_shop_tap` | 536 | 2026-07-05 14:26:45.006939+00 | 2026-08-11 08:55:06.022227+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `hub_practice_link_tap` | 523 | 2026-06-03 06:01:11.906252+00 | 2026-08-08 22:46:38.489688+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `coach_viewer_move_jump` | 466 | 2026-06-16 08:02:33.138408+00 | 2026-08-11 13:22:49.858242+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `arena_account_tap` | 406 | 2026-07-07 14:50:15.174535+00 | 2026-08-11 13:59:35.37034+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `tx_progress_step_duration` | 377 | 2026-06-04 00:16:11.76892+00 | 2026-08-11 14:10:53.275686+00 | Sí; `track()` en source (flag-gated) | tx operational diagnostic | no stats dependency found; operational | **KEEP TEMPORARILY** |
| `coach_viewer_replay_scrub` | 369 | 2026-06-15 16:40:37.377536+00 | 2026-08-11 13:58:10.719525+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `coach_viewer_mint_tap` | 357 | 2026-06-03 23:53:34.777075+00 | 2026-08-11 13:23:05.366558+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `coach_viewer_mint_receipt_write` | 345 | 2026-06-04 00:28:42.350841+00 | 2026-08-11 09:00:10.422301+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `play_tactics_completed` | 343 | 2026-07-05 15:02:50.270025+00 | 2026-08-11 06:00:06.600795+00 | Sí; `track()` en source (flag-gated) | activation/access canonical alias | activation/access stats (30d; corte excluido) | **KEEP TEMPORARILY** |
| `coach_viewer_play_again_tap` | 275 | 2026-06-03 23:14:24.218691+00 | 2026-08-11 13:04:39.94175+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `hub_trophy_tap` | 250 | 2026-06-03 23:54:36.759241+00 | 2026-08-11 14:07:15.44923+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `share_modal_open` | 231 | 2026-06-03 06:04:03.713064+00 | 2026-08-10 23:03:55.967924+00 | Sí; `track()` en source (flag-gated) | social exposure analysis in 2026-09-02 audit; current emitter not found | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `error_boundary_shown` | 223 | 2026-06-10 19:22:11.717805+00 | 2026-08-09 08:51:01.614223+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `arena_coach_redirect` | 214 | 2026-06-07 23:43:35.272167+00 | 2026-08-11 13:28:45.977859+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `coach_viewer_ask_coach_tap` | 181 | 2026-07-08 19:48:58.952051+00 | 2026-08-11 13:28:58.858574+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `hub_pro_chip_tap` | 152 | 2026-06-03 22:53:12.208083+00 | 2026-07-19 03:08:16.646856+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `monetization.pro_chip_tap` | 152 | 2026-06-03 22:53:12.131478+00 | 2026-07-19 03:08:16.56863+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `coach_viewer_share_tap` | 151 | 2026-06-03 23:13:59.631043+00 | 2026-08-11 13:29:06.399497+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `secondary_arena_clicked` | 131 | 2026-06-03 23:18:35.888159+00 | 2026-08-08 22:46:47.847692+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `share_tile_tap` | 84 | 2026-06-03 23:14:55.214018+00 | 2026-08-08 02:44:23.398791+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `coach_analyze_idempotent_hit` | 46 | 2026-06-08 14:08:57.388621+00 | 2026-08-10 07:10:01.809021+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `consequence_shown` | 46 | 2026-08-08 21:31:42.331541+00 | 2026-08-11 14:01:09.850115+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `hub_account_chip_tap` | 45 | 2026-07-07 02:49:13.870136+00 | 2026-07-23 02:04:32.006127+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `hub_coach_chip_tap` | 39 | 2026-06-03 23:15:19.723946+00 | 2026-07-19 03:07:42.84912+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `pro_purchase_started` | 39 | 2026-06-23 02:47:15.289072+00 | 2026-08-11 05:45:08.801775+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `hub_connect_chip_tap` | 35 | 2026-06-04 09:31:36.436422+00 | 2026-07-25 09:40:43.258925+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `coach_viewer_back_to_hub_tap` | 29 | 2026-06-14 02:56:16.06586+00 | 2026-08-11 13:58:32.025382+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `pro_training_card_cta_tap` | 26 | 2026-06-03 23:13:48.551494+00 | 2026-07-04 05:21:03.399555+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `play_hub_connect_tap` | 11 | 2026-07-06 03:20:54.501881+00 | 2026-07-24 22:46:04.028086+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `pro_extend_tap` | 11 | 2026-07-02 19:55:48.302441+00 | 2026-08-03 10:45:52.590028+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `coach_viewer_view_celoscan_tap` | 9 | 2026-06-11 23:53:28.018003+00 | 2026-08-05 23:35:15.293728+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `pro_purchase_confirmed` | 9 | 2026-06-23 02:47:31.14256+00 | 2026-08-03 20:49:06.2515+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP** |
| `arena_pending_nav_consumed` | 7 | 2026-08-03 11:29:56.657131+00 | 2026-08-07 14:11:58.401214+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `monetization.pro_expiring_view` | 7 | 2026-06-04 00:11:28.645436+00 | 2026-06-06 01:54:36.514025+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `pro_active_cta_tap` | 3 | 2026-06-11 13:20:53.793871+00 | 2026-07-16 08:00:26.984061+00 | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `arena_change_difficulty_tap` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `coach_review_opened` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `coach_viewer_replay_error_shown` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **KEEP TEMPORARILY** |
| `daily_focus_completed` | 0 | — | — | No; alias histórico / no emisor literal | historical alias in canonical map | daily_focus stats (30d); daily_tactic también Lite histórico | **KEEP TEMPORARILY** |
| `daily_focus_started` | 0 | — | — | No; alias histórico / no emisor literal | historical alias in canonical map | daily_focus stats (30d); daily_tactic también Lite histórico | **KEEP TEMPORARILY** |
| `exercise_completed` | 0 | — | — | No; alias histórico / no emisor literal | historical alias in canonical map | activation/access stats (30d; corte excluido) | **KEEP TEMPORARILY** |
| `exercise_started` | 0 | — | — | No; alias histórico / no emisor literal | historical alias in canonical map | activation/access stats (30d; corte excluido) | **KEEP TEMPORARILY** |
| `hub_exercises_entry_tap` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `hub_premium_slot_tap` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `hub_pro_tile_tap` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `hub_shields_chip_tap` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `hub_v2_mastery_locked_tap` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `hub_v2_mastery_tap` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `hub_v2_training_band_tap` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `hub_viewed` | 0 | — | — | No; alias histórico / no emisor literal | historical alias in canonical map | activation/access stats (30d; corte excluido) | **KEEP TEMPORARILY** |
| `monetization.pro_expired_view` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `monetization.pro_renew_tap` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `pro_verify_retry_failed` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `profile_refresh_tapped` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `sweep_replay_cta_shown` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |
| `sweep_replay_started` | 0 | — | — | Sí; `track()` en source (flag-gated) | sin consumidor RPC directo localizado; telemetría de producto | ninguna encontrada; genéricas limitadas a 30d | **LOW IMPACT** |

## Dependencia de stats

- Activation/access: aliases de hub/training via `canonical-events.ts`; 30d, cutoff fuera.
- Daily focus: eventos daily, 30d. `/api/admin/lite-stats/route.ts` acepta from/to y contiene daily_tactic_started/completed y exercise_complete: mantener esas filas temporalmente.
- Retention/account lifecycle/activity trend y agregador público: ventanas 30d; cutoff fuera.
- `app_opened` es input al write de `session_first_seen` en `/api/telemetry`; dependencia operativa aunque la fila antigua no parece releerse para ese write.
- Arena entry/recovery: ningún RPC actual localizado; dashboard externo pendiente de verificación.

## Fuentes

- Source: `apps/web/src/lib/telemetry.ts`, `lib/analytics/canonical-events.ts`, `lib/stats/public-aggregator.ts`, `app/api/admin/lite-stats/route.ts`, `app/[locale]/arena/page.tsx`; migrations `20260805000000_stats_aggregation_rpcs.sql`, `20260805020000_split_daily_focus_from_training_funnel.sql`.
- Docs: `2026-09-16-phase-1-disk-io-containment.md`, `2026-08-18-telemetry-yellow-reduction.md`, `2026-08-28-core-loop-diagnostic.md`, `2026-09-02-where-they-quit-and-why-they-return.md`, `2026-08-17-supabase-historical-archive-recoverability.md`.
- COUNT es exacto en momento de consulta; min/max describen sólo corte. No se comprobó continuidad, usuarios únicos ni dashboard externo.

## Decisión

**Una sola familia siguiente:** `arena_mount` + `arena_fresh_reset_fired` (**10,605** filas bajo cutoff, ~2.25% de la referencia). Requisito previo para autorizar poda: confirmar consumidores dashboard o preservar agregados necesarios. Ningún DELETE ni mantenimiento fue ejecutado.
