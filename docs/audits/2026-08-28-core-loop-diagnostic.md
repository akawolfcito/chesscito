# Core loop — diagnóstico pre-cambio

**Fecha:** 2026-08-28 · **Ventana:** 2026-07-23 → 2026-08-28 · **Read-only, sin cambios**
**Alcance:** las dos fugas por separado. Nada de este documento mezcla #1 con #2.

Tipos: **[HECHO]** medido · **[INFERENCIA]** derivada · **[NO MEDIBLE]** fuera de la
instrumentación actual.

⛔ **Caveat de medición que aplica a TODO el documento.** `analytics_events.created_at` es
**hora de inserción en el servidor**, no del cliente: la ruta `/api/telemetry` nunca escribe
ese campo (`route.ts:277` inserta sin él) y el cliente no manda timestamp. Los eventos se
**encolan y se envían en lotes** (`TELEMETRY_BATCH_SIZE=20`, `TELEMETRY_FLUSH_IDLE_MS=5000`,
`lib/telemetry.ts`). Consecuencia: **todo evento del mismo lote comparte `created_at`**, la
resolución real es de ~5 s, y **un flush fallido se descarta sin reintento**. Los huecos
MAYORES a ~5 s son reales; los de ≤5 s no se pueden resolver.

---

## A · PRE-COMPLETION: quién empieza y no termina

**[HECHO]** Dedup por `session_id`, `surface='play'`. Empezaron ≥1 partida: **3.650**.
Terminaron ≥1: **1.898**. Nunca terminaron ninguna: **1.752 (48,0%)**.

### A.1 La diferencia observable es de VOLUMEN DE SEÑAL, no de contenido

| Métrica desde el primer `arena_game_start` | Terminó ≥1 | Nunca terminó |
| --- | ---: | ---: |
| Eventos posteriores (media) | 54,9 | **3,6** |
| Eventos posteriores (p50) | 24 | **1** |
| Segundos hasta su ÚLTIMO evento (p50) | 428 | **3** |

| Último evento tras el start | Terminó ≥1 | Nunca terminó |
| --- | ---: | ---: |
| ≤ 1 s | 1 | **771 (44,0%)** |
| 1–10 s | 2 | 220 |
| 10–60 s | 39 | 181 |
| 1–5 min | 582 | 407 |
| > 5 min | 1.274 | 173 |

**[HECHO] 771 personas (44%) no emiten un solo evento después del lote que contiene su
`arena_game_start`.**

⛔ **[NO MEDIBLE] Eso NO significa "abandonó a los 3 segundos".** Ver A.3.

### A.2 Lo que se descarta como explicación

| Señal | Terminó ≥1 | Nunca terminó | Lectura |
| --- | ---: | ---: | --- |
| Dificultad `easy` en el primer start | 89,3% | 92,9% | **[HECHO]** la dificultad NO los separa |
| Dificultad `medium` | 6,9% | 3,6% | — |
| Dificultad `hard` | 3,8% | 3,5% | — |
| `error_boundary_shown` | 0,47% | **0,23%** | **[HECHO]** no es un crash capturado |
| `arena_x_close_fired` | 65,5% | **0,2%** | **[HECHO]** ese evento es del END-STATE, no de la partida |
| `arena_game_start` sin `arena_start_tap` | 0,0% | 0,0% | **[HECHO]** todo start es un tap deliberado (el auto-start de `page.tsx:1017` no ocurre en la práctica) |
| Volvió otro día UTC | 12,7% | 4,5% | — |
| Usó Coach | 21,3% | **0,0%** | mecánico: Coach requiere partida terminada |
| Completó el daily | 15,2% | 5,8% | — |

⛔ **[HECHO] `arena_x_close_fired` no puede explicar la fuga #1.** Sólo lo dispara el
popup de resultado — el 0,2% de los no-terminadores lo tiene.

**[HECHO] Primer evento posterior al start, entre los que nunca terminan** (n=1.752):
`peones_balance_viewed` 21,0% · `play_hub_view` 10,7% · **`arena_start_tap` 8,4%**
(volvieron a empezar otra partida y tampoco la terminaron) · `arena_coach_signal_viewed` 5,3%
· `minipay_add_cash_click` 1,7%. El resto no tiene ninguno.

### A.3 ⛔ Por qué esto NO se puede cerrar hoy

**[HECHO] No existe NINGÚN evento durante el juego.** Se midió el intervalo
`arena_game_start` → `arena_game_end` de los terminadores: lo único que aparece dentro es
ruido de re-entrada (`peones_balance_viewed` 495 personas, `arena_start_tap` 246,
`play_hub_view` 84). **Cero eventos de movimiento, de jaque, de turno o de heartbeat.**

**[INFERENCIA] Por lo tanto los dos escenarios son indistinguibles con los datos actuales:**

1. tocó Start, vio la transición de 1.800 ms (`MATCHUP_TRANSITION_MS`, `page.tsx:127`) y se fue;
2. jugó 40 movimientos en silencio durante 10 minutos, cerró la app, y el lote final se
   perdió (los flush fallidos se descartan sin reintento).

**Ambos producen exactamente la misma traza.** Cualquier afirmación de "abandona a los X
minutos" sería inventada. Ésta es la conclusión central de la sección A y el hueco de
instrumentación #1 del producto.

---

## B · Qué datos conoce realmente el Match Reviewer

El "Match Reviewer" es la ruta **`/coach/[gameId]?wallet=…`**
(`app/[locale]/coach/[gameId]/page.tsx` + `coach-game-client.tsx`), evento
`coach_viewer_viewed`.

### B.1 Procedencia de cada dato

Fuente de verdad: el `GameRecord` (`lib/coach/types.ts:27`) leído por `getGameRecord()`
desde **Upstash Redis**, clave `coach:game:<wallet>:<gameId>`, **TTL 90 días**, tope
**200 partidas por wallet** (`GAME_LIST_CAP`), con desalojo del más viejo NO analizado.

| Dato | Runtime | Props/router/context | localStorage | Redis | Supabase | Analytics | Al cerrar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **move history** (SAN[]) | sí | prop `gameRecord` (SSR) | `chesscito:arena-game` (partida en curso) | **sí**, 90 d | **no** | **no** | sobrevive 90 d |
| **PGN** | derivable con chess.js | no | no | **no** | no | no | nunca existió |
| **posiciones / FEN** | derivadas de `moves` | no | FEN en curso | sólo `startingFen?` | no | no | se recomputa |
| **resultado** (`win/lose/draw/resigned`) | sí | sí | no | sí | no | **sí** (`arena_game_end.status` + `is_player_win`) | persiste |
| **mate / derrota / victoria** | sí | sí | no | sí | no | **sí** (`status` = checkmate/stalemate/draw/resigned) | persiste |
| **dificultad** | sí | sí | `LAST_DIFFICULTY_KEY` | sí | no | **sí** (`difficulty`) | persiste |
| **duración / timer** | sí | sí | no | `elapsedMs` | no | **sí** (`elapsed_ms`) | persiste |
| **nº de movimientos** | sí | sí | no | `totalMoves` | no | **sí** (`moves`) | persiste |
| **causa de finalización** | sí | sí | no | sólo `result` | no | **sí** (`status`) | persiste |
| **review index / scrub state** | sí (`useState`) | no | **no** | no | no | sólo el delta (`coach_viewer_move_jump`, `_replay_scrub`) | **desaparece** |
| **análisis del Coach** | sí | merge en `getGameRecord` | no | `coach:analysis:*` | `coach_analyses` (parcial) | sólo la petición | — |

⛔ **[HECHO] Todo el `GameRecord` está gated por wallet.** Sin `?wallet=` la ruta renderiza
el prompt de reconexión; sin wallet conectada `runPersist()` retorna temprano
(`page.tsx:658`) y **no se persiste nada**. El invitado no deja rastro de partida fuera de
analytics.

### B.2 La pregunta central — respuesta: **SÍ, ya tenemos los datos**

**[HECHO] `arena_game_end` ya lleva `moves`, `elapsed_ms`, `difficulty`, `status`,
`is_player_win`, `player_color`** — 4.806 eventos, 1.899 personas. `game_persist_attempt` y
`game_persist_outcome` repiten lo mismo más `game_id` y `error`. **No hace falta instrumentar
nada para estudiar longitud y dificultad real de las partidas TERMINADAS**, y es irrelevante
que `score_saves` no tenga filas de PLAY.

**[HECHO] Distribución real de las 4.807 partidas terminadas:**

| Dificultad | Partidas | % gana | % tablas/ahogado | % abandona | % le hacen mate | p50 mov. | p90 mov. | p50 dur. | p90 dur. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| easy | 2.997 | **28,8%** | **50,0%** | 16,8% | 4,4% | 71 | 121 | 4m19s | 8m23s |
| medium | 984 | 7,9% | 7,3% | 12,9% | **71,8%** | 44 | 92 | 3m27s | 9m22s |
| hard | 826 | **3,6%** | 8,0% | 23,1% | **65,3%** | 36 | 99 | 3m47s | 12m02s |
| **TODAS** | **4.807** | **20,2%** | **34,1%** | 17,1% | 28,7% | **56** | 115 | **4m06s** | 9m05s |

⛔ **[HECHO] No existe una banda de victoria satisfactoria.** En `easy` el desenlace MODAL
no es ganar (28,8%) sino **tablas o ahogado (50,0%)**, tras una mediana de **71 movimientos
y 4m19s**. En `medium` y `hard` al jugador le dan mate el **71,8%** y **65,3%** de las veces.
El resultado individual más frecuente de todo PLAY es **tablas en easy: 927 partidas,
p50 97 movimientos, 5m44s.**

### B.3 Mínimo set a instrumentar — **sólo para partidas NO terminadas**

Las seis preguntas del pedido ya se responden hoy para partidas terminadas. Lo único que
falta es la fuga #1. **Mínimo set (4 campos + 1 evento):**

| # | Qué | Por qué es el mínimo |
| --- | --- | --- |
| 1 | **`game_id` en `arena_game_start`** | Hoy sólo lleva `difficulty` + `player_color`. Sin id **no se puede aparear un start con su end**, así que "no terminó" se infiere por ausencia y nunca por evidencia. |
| 2 | **Un evento `arena_game_abandoned`** con `game_id`, `moves`, `elapsed_ms`, `reason` (`unload`/`nav`/`back`/`hidden`) | Es lo único que separa "rebotó en 2 s" de "jugó 40 movimientos y cerró". Debe emitirse por `visibilitychange` + `pagehide` con `sendBeacon`. |
| 3 | **`reached_board:true`** (o un `arena_board_ready`) al terminar los 1.800 ms de `MATCHUP_TRANSITION_MS` | Separa "no llegó al tablero" de "llegó y no jugó". Hoy nada marca esa frontera. |
| 4 | **Un heartbeat de partida** (`arena_game_tick` cada 30–60 s, o `first_move_made`) | Sin ninguna señal intra-partida, el batching de 5 s hace que toda partida silenciosa sea invisible. Con sólo `first_move_made` ya se distingue el rebote del juego real. |
| 5 | **`context` en el `play_again` del camino de VICTORIA** | Ver C.3: hoy ese tap no se trackea. |

⚠️ Nada de esto exige tocar la DB: son props de `analytics_events`.

---

## C · El post-game flow REAL

### C.1 Jerarquía de CTAs — camino de VICTORIA (`victory-celebration.tsx`)

| Orden | CTA | Línea | Telemetría |
| ---: | --- | --- | --- |
| 1 | **Save Victory / claim** (primaria) | 208 | `monetization.save_victory_tap{context:"endgame_win"}` |
| 2 | **Ask Coach** | 237 | `coach_victory_analyze_tap` + `monetization.coach_review_tap` |
| 3 | **Play Again** | 284 | ⛔ **ninguna** |
| 4 | Back to hub | 291 | — |

⛔ **[HECHO] El backdrop NO cierra si hay claim disponible**: `disableBackdropClose={Boolean(onClaimVictory)}` (línea 162).

### C.2 Jerarquía de CTAs — DERROTA / TABLAS / ABANDONO (`arena-end-state.tsx`)

| Orden | Bloque | Telemetría |
| ---: | --- | --- |
| 1 | Hero (icono + título del resultado) | `modal_open{id:"arena-loss"}` |
| 2 | **Sección COACH REVIEW — CTA primaria** | `monetization.coach_review_offered` al render, `monetization.coach_review_tap` al tap |
| 3 | Fila de stats (dificultad, movimientos, tiempo) | — |
| 4 | **Save match** | `monetization.save_victory_tap` |
| 5 | **PLAY / Play Again — secundaria** | `monetization.play_again_tap{context}` |

⛔ **[HECHO] La democión es deliberada y está escrita en el código**: el comentario de la
línea 637 dice *"PLAY button — M1 funnel (Commit 2 + Commit 4): **demoted to** [secondary]"*.

### C.3 ⛔ El hallazgo estructural: la X no cierra, NAVEGA

`evaluateXClose()` (`end-state-close-policy.ts`) empuja a `/coach/[gameId]` cuando la
partida se persistió. Medido sobre los 2.064 `arena_x_close_fired`:

| Efecto de la X | Destino | Eventos | Personas | % |
| --- | --- | ---: | ---: | ---: |
| `push` | **→ MATCH REVIEWER** | 1.926 | **1.159** | **93,3%** |
| `noop` | (bloqueada durante el claim) | 78 | 71 | 3,8% |
| `push` | → Training Journal | 43 | 43 | 2,1% |
| `set-pending` | (persist en vuelo) | 14 | 12 | 0,7% |
| `push` | → selector de arena | 3 | 3 | 0,1% |

**[HECHO] El gesto universal de "sacame de acá" mete al jugador MÁS ADENTRO del embudo de
review, en el 93,3% de los casos.** Y es la acción post-partida nº1 (C.4).

### C.4 Primera acción con sentido después de la PRIMERA partida terminada (n=1.898)

| Acción | Personas | % |
| --- | ---: | ---: |
| **`arena_x_close_fired`** (→ reviewer) | 293 | **15,4%** |
| `monetization.play_again_tap` | 215 | 11,3% |
| `monetization.save_victory_tap` | 205 | 10,8% |
| `victory_claim_tx` | 201 | 10,6% |
| `coach_viewer_viewed` (reviewer) | 160 | 8,4% |
| **`arena_game_start`** (segunda partida directa) | 80 | **4,2%** |
| `play_hub_view` | 71 | 3,7% |
| `coach_victory_analyze_tap` | 76 | 4,0% |
| *(sin ninguna acción posterior)* | ~350 | ~18,4% |

### C.5 ⛔ La fricción objetiva `game_end → next_game`

**[HECHO] "Play Again" no vuelve a jugar: vuelve al SELECTOR.**
`handlePlayAgain = () => { resetArenaState(); game.reset(); }` (`page.tsx:551`) deja
`status="selecting"`. El jugador cae en el selector de rival y necesita **otro tap (Start)
más 1.800 ms de transición** para volver a un tablero.

**[HECHO] Y se paga en la conversión.** De los 1.885 taps de `play_again`:

| Contexto | Taps | Empezó partida ≤5 min | **Nunca volvió a empezar** |
| --- | ---: | ---: | ---: |
| `endgame_loss` | 729 | 63,8% | 14,4% |
| `endgame_draw` | 704 | 51,8% | **28,3%** |
| `endgame_resign` | 452 | 54,0% | 21,5% |

**[HECHO] Entre el 36% y el 48% de quienes piden explícitamente "otra partida" no llegan a
una en 5 minutos.** Es la fricción más limpia y menos ambigua de todo el documento: la
intención está declarada por el usuario y el sistema no la consuma.

⚠️ **[NO MEDIBLE] El camino de victoria.** `monetization.play_again_tap` sólo existe con
contexto `loss`/`draw`/`resign` — el botón del `VictoryCelebration` no trackea. **No sabemos
cuánta gente pide otra partida después de GANAR.**

---

## D · Activation threshold

**[HECHO]** Cohorte con ≥7 días de ventana, dedup `session_id`, sólo eventos de acción
(se excluyen renders y automáticos). n = **4.566**. "Volvió" = acción en un día UTC posterior.

| Hito en el DÍA 0 | Usuarios | % de nuevos | % volvió | Lift vs baseline |
| --- | ---: | ---: | ---: | ---: |
| **BASELINE (todos los nuevos)** | 4.566 | 100,0% | **6,5%** | 1,00 |
| Llegó al hub de PLAY | 3.136 | 68,7% | 7,0% | 1,07 |
| **Inició ≥1 partida** | 3.322 | 72,8% | **7,0%** | **1,08** |
| **Terminó ≥1 partida** | 1.693 | 37,1% | **9,6%** | **1,47** |
| **Terminó ≥2 partidas** | 553 | 12,1% | **16,1%** | **2,47** |
| Terminó ≥3 partidas | 265 | 5,8% | 20,8% | 3,19 |
| Terminó ≥5 partidas | 94 | 2,1% | 24,5% | 3,76 |
| Completó el daily | 447 | 9,8% | 13,9% | 2,13 |
| Usó Coach | 335 | 7,3% | 14,6% | 2,25 |
| Abrió el Match Reviewer | 1.135 | 24,9% | 9,8% | 1,50 |
| Miró el Shop | 367 | 8,0% | 13,4% | 2,05 |
| Intentó reclamar Victory | 544 | 11,9% | 12,9% | 1,98 |
| daily + ≥1 partida terminada | 219 | 4,8% | 18,3% | 2,81 |
| Coach + ≥1 partida terminada | 335 | 7,3% | 14,6% | 2,25 |

**[HECHO] Iniciar una partida no vale nada como hito: 7,0% contra un baseline de 6,5%
(lift 1,08).** El primer salto real es **terminar** (1,47×) y el salto grande es
**terminar la SEGUNDA (2,47×)**.

**[INFERENCIA] La mejor definición observable de PLAY activation es "terminó ≥2 partidas el
día 0"**: alcanza al 12,1% (suficiente para mover), duplica el retorno, y a partir de ahí la
curva se aplana (≥3 → 3,19×, ≥5 → 3,76×, con alcance ya marginal de 5,8% y 2,1%).

⚠️ **[INFERENCIA, no causa]** todo esto es asociación. Quien iba a volver de todos modos
también termina más partidas el primer día. Ninguna de estas cifras autoriza a decir "si
logramos que terminen 2, volverá el 16%".

---

## E · Crossover sin circularidad

**[HECHO]** Clasificación **restringida al primer día de actividad**, dedup por
`account_ref` (la única clave que cruza orígenes), cohorte con ≥7 días de ventana. n = 5.771.

| Clase en D0 | Personas | Volvió (cualq. día) | D1 | ≤D3 | ≤D7 | Días activos prom. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| D0 PLAY only | 3.580 | **6,0%** | 2,3% | 3,3% | 4,3% | 1,11 |
| D0 LEARN only | 1.340 | **5,7%** | 2,7% | 3,6% | 4,3% | 1,12 |
| **D0 BOTH** | 851 | **8,8%** | 4,1% | 5,5% | 7,1% | 1,29 |

⛔ **[HECHO] El efecto del crossover se DERRUMBA al quitar la circularidad.**

| | Auditoría anterior (clasif. sobre toda la vida) | Este documento (clasif. sólo D0) |
| --- | ---: | ---: |
| PLAY only | 4,5% | 6,0% |
| LEARN only | 2,1% | 5,7% |
| **BOTH** | **23,0%** | **8,8%** |
| **Ventaja de BOTH vs PLAY only** | **5,1×** | **1,47×** |

**[INFERENCIA] Unas cuatro quintas partes de aquel 23% eran el artefacto**: "tocó las dos
superficies" a lo largo de la vida a menudo **requiere** haber vuelto, así que la variable
independiente contenía la dependiente. Cerrado el D0, queda una ventaja de **1,47×** — del
mismo orden que "terminó ≥1 partida" (1,47×) y **menor** que daily (2,13×), Coach (2,25×) o
terminar 2 partidas (2,47×).

**[INFERENCIA] Y el 1,47× restante tampoco está limpio**: explorar dos superficies el primer
día es en sí mismo una medida de curiosidad/tiempo invertido. No hay diseño aquí que separe
"cruzar causa retención" de "la gente retenible cruza".

---

## F · Secuencia post-game y segunda partida

**[HECHO]** Entre quienes terminaron una primera partida (n = 1.899):

| | Personas | Jugó 2ª partida | 2ª partida el MISMO día |
| --- | ---: | ---: | ---: |
| **Todos los que terminaron 1ª** | 1.899 | **45,2%** | **42,5%** |
| No entró al Match Reviewer | 1.075 | **52,8%** | 51,4% |
| **Entró al Match Reviewer antes de la 2ª** | 824 | **35,2%** | 30,9% |
| No tocó "Play Again" | 1.632 | 41,1% | 38,1% |
| Tocó "Play Again" | 267 | **70,0%** | 69,7% |
| No guardó | 1.431 | 45,1% | 42,9% |
| Guardó / reclamó primero | 468 | 45,5% | 41,5% |

**[HECHO] El 42,5% inicia una segunda partida el mismo día.**

**[HECHO] Guardar/reclamar NO tiene relación con continuar** (45,5% vs 45,1%). Es el único
CTA del post-game que sale plano.

**[HECHO] Quien entra al Match Reviewer juega una 2ª partida el 35,2% de las veces, contra
52,8% de quien no entra** — una diferencia de 17,6 puntos.

⚠️ **[INFERENCIA con confusión severa, NO causal]** Hay al menos tres explicaciones no
descartables: (a) el reviewer distrae y enfría la sesión; (b) **quien vuelve a jugar rápido
nunca tuvo tiempo de entrar**, así que la variable "no entró" incluye por construcción a los
más rápidos en reiniciar; (c) el 93,3% de las entradas al reviewer vienen de tocar la **X**
(C.3) — es decir, del gesto de quien ya quería salir. **La correlación es real; la dirección
no se puede establecer.**

**[HECHO] Primera acción tras entrar al Match Reviewer** (n=1.293): `coach_viewer_back_tap`
11,8% · `play_hub_view` 9,3% · `coach_viewer_replay_scrub` 8,2% · `coach_viewer_mint_tap`
7,5% · `coach_viewer_move_jump` 4,9% · `coach_viewer_ask_coach_tap` 3,7% ·
**`coach_viewer_play_again_tap` 3,4%** · `arena_game_start` 2,7% · **~41% no hace nada más**.

**[INFERENCIA] El reviewer no tiene una salida hacia otra partida que la gente use**: sólo
el 6,1% combinado sale de ahí hacia jugar (3,4% + 2,7%).

---

## Lo que sabemos

1. **[HECHO] La fuga #1 no es de dificultad.** Entre quienes nunca terminan una partida el
   92,9% eligió `easy`, contra 89,3% de quienes terminan. Tampoco es de crashes:
   `error_boundary_shown` es 0,23% vs 0,47% — **más bajo** en los que no terminan.
2. **[HECHO] 771 de 1.752 no-terminadores (44,0%) no emiten un solo evento después del lote
   que contiene su `arena_game_start`**, y su mediana de eventos posteriores es **1** contra
   **24** de los terminadores.
3. **[HECHO] Ya tenemos longitud, duración, dificultad y causa de finalización de las 4.807
   partidas terminadas**, en `arena_game_end.props` (`moves`, `elapsed_ms`, `difficulty`,
   `status`, `is_player_win`, `player_color`). No hay que instrumentar nada para eso.
4. **[HECHO] El jugador gana el 20,2% de las partidas.** En `easy` el desenlace modal son
   **tablas o ahogado (50,0%)** tras 71 movimientos y 4m19s; en `medium` y `hard` le dan mate
   el 71,8% y el 65,3% de las veces. **No existe una banda de dificultad donde ganar sea lo
   normal.**
5. **[HECHO] La X del popup de resultado navega al Match Reviewer en el 93,3% de los casos**
   (1.159 personas), y es la acción post-partida nº1 (15,4%).
6. **[HECHO] "Play Again" devuelve al SELECTOR, no a una partida** (`page.tsx:551`), y entre
   el 36% y el 48% de quienes lo tocan no llegan a una partida en 5 minutos.
7. **[HECHO] El 42,5% de quienes terminan una partida juegan otra el mismo día**; sólo el
   4,2% pasa directo de terminar a `arena_game_start`.
8. **[HECHO] Iniciar una partida no predice retorno** (7,0% vs baseline 6,5%; lift 1,08).
   El salto está en **terminar la segunda**: 16,1%, lift **2,47×**.
9. **[HECHO] El crossover PLAY+LEARN cae de 5,1× a 1,47×** al clasificar sólo por el primer
   día (8,8% BOTH vs 6,0% PLAY only). El grueso del 23% anterior era circularidad.
10. **[HECHO] Guardar/reclamar es indiferente a la continuación** (45,5% vs 45,1%), mientras
    que el paso por el Match Reviewer se asocia a 35,2% vs 52,8%.

---

## Lo que todavía no podemos saber

| Pregunta | Razón técnica concreta |
| --- | --- |
| **¿El que no termina rebotó en segundos o jugó en silencio y cerró?** | **No existe ningún evento durante la partida** — se verificó el intervalo start→end de los terminadores y sólo hay ruido de re-entrada. Sin `first_move_made` ni heartbeat, ambos escenarios producen la misma traza. |
| **¿Cuánto duró una partida NO terminada?** | `arena_game_start` no lleva `game_id` ni `elapsed_ms`, y no hay evento de abandono. Un start no se puede aparear con nada. |
| **¿Llegó siquiera al tablero?** | Nada marca el fin de los 1.800 ms de `MATCHUP_TRANSITION_MS`. "Tocó Start" y "vio un tablero" son el mismo dato hoy. |
| **Momento exacto de cualquier acción (<5 s)** | `created_at` es hora de inserción en servidor y el cliente envía en lotes (idle 5 s / 20 eventos). Todo evento del mismo lote comparte timestamp. |
| **¿Cuánta gente pide otra partida después de GANAR?** | El botón Play Again de `victory-celebration.tsx:284` **no llama a `track()`**. `monetization.play_again_tap` sólo existe en loss/draw/resign. |
| **¿El Match Reviewer reduce la continuación, o sólo la absorbe?** | Confusión estructural triple (F): quien reinicia rápido nunca entra, y el 93,3% de las entradas vienen del gesto de salir (la X). Requiere un experimento, no una consulta. |
| **¿Qué pasa con los invitados sin wallet?** | `runPersist()` retorna temprano sin `address` (`page.tsx:658`): no hay `GameRecord`, no hay reviewer, no hay `game_persist_*`. Su partida sólo existe en `arena_game_end`. |
| **Partidas de más de 90 días, o más de 200 por wallet** | El `GameRecord` vive en Redis con `ex: 90*24*60*60` y tope 200 con desalojo. No hay copia en Supabase. |
| **Cualquier corte por comprador / PRO / Peones** | Sigue vigente: `analytics_events` guarda `account_ref` (HMAC) y las compras guardan `wallet`. Sin el secreto no hay join. |

---

## Las 3 hipótesis que ahora sí sería razonable probar

> Evaluadas contra los datos, no contra quién las propuso.

### 1. "Jugar otra" como acción primaria inmediatamente después de la partida — **SÍ, con soporte fuerte; y el cambio de mayor valor no es el que se propuso**

**A favor.** El soporte más limpio no viene de la jerarquía visual sino de la **fricción
mecánica**: "Play Again" no juega otra vez, devuelve al selector (`page.tsx:551`), y entre el
**36% y el 48%** de quienes lo tocan no llegan a una partida en 5 minutos (C.5). Ahí la
intención está **declarada por el usuario** y el sistema no la consuma — no hace falta inferir
nada. Además la X, que es el gesto de salida, lleva al reviewer el **93,3%** de las veces
(C.3), y sólo el **4,2%** pasa directo de terminar a empezar otra (C.4). Y el hito que más
mueve el retorno es exactamente **terminar la segunda partida** (2,47×, D).

**En contra / matices.** El 70% de continuación de quienes tocan Play Again es casi
tautológico y **no debe usarse como estimación del efecto**. Y hay un techo: sólo el 42,5%
juega una 2ª partida, pero el 45,2% acaba jugándola en algún momento — el margen no es
infinito.

**Veredicto: los datos la respaldan, pero el experimento correcto es "que Play Again LLEVE a
una partida" (saltar el selector, reusar la última dificultad), no "moverlo más arriba".** La
segunda mitad — que la X deje de navegar al reviewer — está igual de respaldada y es más barata.

### 2. Mover Guardar / Coach / Share a acciones secundarias — **PARCIAL: sí para Guardar, NO probado para Coach**

**A favor (Guardar).** `Save`/`claim` es la CTA nº1 del camino de victoria y la nº3 del de
derrota, y es **exactamente indiferente a la continuación**: 45,5% vs 45,1% (F). Ocupa la
posición primaria y no compra nada del loop. Degradarlo tiene soporte y riesgo bajo.

**En contra (Coach).** Aquí los datos **no** respaldan la propuesta. Usar Coach es uno de los
hitos con más lift del día 0 (**2,25×**, D) y el paso por el reviewer también tiene lift
positivo (1,50×). Lo que se midió negativo es la **continuación dentro de la sesión** (35,2%
vs 52,8%), no la retención — y ese número está confundido por tres vías (F). **Degradar Coach
para ganar una segunda partida podría estar cambiando retención por volumen de sesión.**

⚠️ Sobre **Share**: no hay caso ni a favor ni en contra. `coach_viewer_share_tap` son 91
personas y `share_modal_open` 47 — es demasiado chico para medir.

**Veredicto: probar la degradación de Guardar; NO tocar Coach sin un experimento que separe
retención de continuación.** Son dos decisiones distintas y los datos las separan.

### 3. Una experiencia más unificada entre PLAY y LEARN — **NO, los datos ya NO la sostienen**

Ésta es la que cambia de signo. El argumento original era el **23% vs 4,5% (5,1×)**. Cerrada
la circularidad, la ventaja real es **8,8% vs 6,0% = 1,47×** (E) — por debajo de daily
(2,13×), Coach (2,25×) y terminar dos partidas (2,47×). Y ese 1,47× residual sigue sin estar
limpio: explorar dos superficies el primer día es en sí una medida de involucramiento.

Es además, con diferencia, la más cara de las tres: implica arquitectura, dos orígenes
distintos (`session_id` no cruza), y el trabajo de unificación toca todo el producto.

**Veredicto: el dato que la motivaba era en su mayor parte un artefacto de medición. Con
1,47×, es la peor relación esfuerzo/evidencia de las tres y no debería competir con #1.**

---

### Lo que hay que instrumentar antes de poder juzgar la fuga #1

Ninguna de las tres hipótesis toca la fuga PRE-COMPLETION, que son **1.752 personas** —
la más grande del embudo. Hoy es **estructuralmente inobservable**. El paso previo a
cualquier experimento sobre ella es el mínimo set de B.3: **`game_id` en `arena_game_start`,
un `first_move_made`, y un `arena_game_abandoned` por `pagehide`/`visibilitychange` con
`sendBeacon`.** Sin eso, cualquier cambio dirigido a esa fuga se evalúa a ciegas.
