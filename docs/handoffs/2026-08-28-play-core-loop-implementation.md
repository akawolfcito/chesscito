# PLAY core loop — post-game momentum + taxonomía

**Fecha:** 2026-08-28 · **Commits:** `0ec18cc0`, `ce62e065`, `baf607a3` (en `main` local, **sin pushear**)
**Evidencia:** `docs/audits/2026-08-28-core-loop-diagnostic.md`

---

## 1. Archivos cambiados

| Archivo | Qué cambió |
| --- | --- |
| `app/[locale]/arena/end-state-close-policy.ts` | 5 ramas → 3. La X sale al hub. Nueva export `PLAY_HUB_HREF` |
| `app/[locale]/arena/page.tsx` | `handlePlayAgain` (replay instantáneo), `handleChangeDifficulty` (nuevo), consumer de la X, `currentGameIdRef`, `firstMoveTrackedRef`, `replayRef`, 2 efectos de telemetría |
| `components/arena/arena-end-state.tsx` | Props `onChangeDifficulty` + `previousGameId`; bloque PLAY AGAIN movido arriba y promovido a verde |
| `components/arena/victory-celebration.tsx` | Idem; Play again sale del carril crema |
| `components/arena/victory-claim-success.tsx` | Play again promovido + `play_again_tap` con contexto propio |
| `components/coach/game-actions-bar.tsx` | Label `playAgain` → `newDuel` |
| `app/[locale]/coach/[gameId]/coach-game-client.tsx` | Idem en el fallback de error |
| `app/globals.css` | `--play`, `.arena-result-play-section`, `.arena-result-change-difficulty` |
| `lib/content/editorial.ts` · `lib/content/messages/es.ts` | Labels (§3) |
| `app/dev/arena-end-state/fixture.tsx` | Wirea `onChangeDifficulty` para que el VR fotografíe la pantalla real |
| +2 archivos de test nuevos, 3 de test actualizados | §5 |

---

## 2. Before → after de cada flujo

| Flujo | Antes | Ahora |
| --- | --- | --- |
| **Jugar otra (derrota/tablas/abandono)** | `play_again_tap` → `game.reset()` → **selector DUEL** → tap PLAY → 1800 ms → tablero | `play_again_tap` → **1800 ms → tablero** |
| **Jugar otra (victoria)** | botón crema **sin telemetría** → selector → … | verde primario, `play_again_tap{context:"endgame_win"}` → 1800 ms → tablero |
| **Jugar otra (victoria ya guardada)** | crema en fila terciaria | verde primario, `context:"endgame_win_saved"` |
| **Cambiar dificultad** | no existía | CTA secundaria → `game.reset()` → **selector DUEL** → `PLAY` → partida |
| **X (persistido)** | push `/coach/[gameId]` — **93,3% de las X** | push `/` (**Hub de PLAY**) |
| **X (0 movimientos)** | push `/coach/history` | push `/` |
| **X (sin wallet / failed / dismissed)** | push `/arena?fresh=1` | push `/` |
| **X durante el mint** | `noop` | `noop` — **sin cambios, deliberado** |
| **X durante el persist** | `set-pending` → luego `/coach/[gameId]` | `set-pending` → luego `/` |
| **Match Reviewer → jugar** | `Play again` → `/arena?fresh=1` (selector) | `NEW DUEL` → `/arena?fresh=1` (selector) — **misma navegación, label honesto** |
| **Coach / Review** | CTA primaria en derrota | secundaria en orden, **misma sección, mismo morado, mismo tamaño** |

⚠️ El replay **no** es un teleport: los 1.800 ms de `ArenaMatchupTransition` se conservan y hay un test que falla si alguien los saca.

---

## 3. Labels anteriores → nuevos

| Clave | Antes (EN / ES) | Ahora (EN / ES) |
| --- | --- | --- |
| `ARENA_COPY.title` | `Arena` / `Arena` | **`DUEL` / `DUELO`** |
| `ARENA_COPY.playAgain` | `PLAY` / `JUGAR` | **`PLAY AGAIN` / `JUGAR OTRA`** |
| `ARENA_COPY.changeDifficulty` | — | **`Change difficulty` / `Cambiar dificultad`** |
| `VICTORY_CELEBRATION_COPY.playAgainShort` | `Play again` / `Jugar otra` | **`PLAY AGAIN` / `JUGAR OTRA`** |
| `COACH_VIEWER_COPY.playAgain` | `Play again` / `Jugar otra vez` | **→ `newDuel`: `NEW DUEL` / `NUEVO DUELO`** |
| `ARENA_COPY.startMatch` | `PLAY` / `JUGAR` | **sin cambios** — ya iniciaba partida |

**Regla codificada:** el label describe lo que pasa *inmediatamente después del tap*.
`PLAY AGAIN` sólo donde hay tablero al toque; `NEW DUEL` donde hay pantalla de configuración.

---

## 4. Jerarquía visual anterior → nueva

**Antes** (y por qué era el problema): la misma acción tenía tres tratamientos según pantalla.

| Superficie | Antes | Ahora |
| --- | --- | --- |
| Victoria | 1 Guardar (dorado) · 2 Coach (morado) · 3 Play again + Share (crema) | **1 PLAY AGAIN (verde)** · 2 Coach (morado) · 3 Guardar (dorado) · 4 Share (crema) |
| Derrota / tablas / abandono | 1 Coach (morado) · 2 Guardar (dorado) · 3 PLAY (crema) | **1 PLAY AGAIN (verde)** · 2 Coach (morado) · 3 Guardar (dorado) |
| Victoria guardada | Play again + Share + Save again, todos crema | **1 PLAY AGAIN (verde)** · 2 Share / Save again (crema) |

**Contrato de color** (documentado en `globals.css`):
verde = seguir jugando · morado = analizar · dorado = guardar/claim · crema = terciario.

Sin iconos nuevos: el CTA verde es **sólo texto** en las tres superficies, para que se aprenda como un objeto único.

⚠️ **Trampa documentada, no arreglada:** la clase `.arena-result-primary-cta--amber` **renderiza verde** (y morado si está dentro de `.arena-result-coach-text`). No se renombró — tiene call sites fuera de este cambio. Queda una nota en el CSS.

---

## 5. Tests añadidos

| Archivo | Tests | Qué fija |
| --- | ---: | --- |
| `arena/__tests__/arena-instant-replay.test.tsx` **(nuevo)** | 9 | replay no llama `reset()`; la transición de 1800 ms sobrevive; `arena_game_start` lleva `game_id`; `play_again_game_started` sólo al llegar y **sin doble-log**; cambiar dificultad sí resetea y **nunca** inicia; la X va a `/` y jamás a `/coach` ni `/arena` |
| `arena/__tests__/arena-end-state-replay-loop.test.tsx` **(nuevo)** | 28 | los 5 desenlaces (win/loss/draw/stalemate/resign) × clase verde, handler correcto, `play_again_tap` con contexto y sin duplicar, `previous_game_id`, Coach sigue presente, cambiar dificultad ausente si no se wirea |
| `arena/__tests__/arena-end-state-close-policy.test.tsx` | 9 (reescrito) | la X nunca empuja a `/coach`; `claiming` gana sobre todo estado de persist |
| `coach/__tests__/game-actions-bar.test.tsx` · `coach-game-client.test.tsx` | 7 (actualizados) | rename `playAgain` → `newDuel` |

---

## 6. Verificación

| Check | Resultado |
| --- | --- |
| `pnpm exec tsc --noEmit` | **limpio** |
| `next lint` (5 archivos tocados) | **0 warnings, 0 errors** |
| Vitest suite completa | **727 archivos / 9.243 tests passed, 1 todo, exit 0**, 157 s |
| Workers | sin `Failed to start forks worker` ni `Timeout waiting for worker` — sin `pnpm dev` arriba durante la corrida |

⚠️ El conteo de CLAUDE.md (614 archivos / 7.565 tests, 2026-08-09) está viejo: **medido hoy da 727 / 9.243**. Vale actualizarlo.

---

## 7. Deuda dejada fuera **a propósito**

1. ⛔ **Baselines de VR no regrabadas.** El layout de los tres end-states cambió, así que `hub-*` y las fotos de `/dev/arena-end-state` van a dar rojo. **No las toqué**: la regla del repo es mirar el `-actual.png` antes de regrabar, y un `--update-snapshots` a ciegas hornearía cualquier error dentro de la foto. Es el primer paso de la próxima sesión.
2. **Instrumentación de abandono** (`arena_game_abandoned` por `pagehide`/`visibilitychange`, `reached_board`). Excluida por el §10 del pedido. Sin ella la fuga #1 (1.752 personas) sigue siendo inobservable — `game_id` y `first_move_made` son 2 de los 5 campos del mínimo set del audit §B.3.
3. **`lossPlayAgainCta` y `lossSubtitle` quedaron sin uso.** Se conservan en ambos bundles por la paridad de claves del guard de ES; borrarlas es un cambio de dos archivos cuando alguien limpie.
4. **`.arena-result-primary-cta--amber` sigue mal nombrada.** Renombrarla es un barrido fuera de scope.
5. **`coach_viewer_play_again_tap` conserva su nombre** aunque el botón ahora diga NEW DUEL — renombrar el evento partiría la serie histórica.
6. **`VictoryClaimError` / `VictoryClaiming`** conservan su Play again crema. Son estados de error/espera, no end-states de resultado.
7. **`--inset` no se unificó con `--play`.** Son gemelas de tokens; fusionarlas toca call sites ajenos.

---

## 8. Lo que este cambio NO puede probar

El experimento queda medible pero **no concluido**. Con la telemetría nueva, dentro de ~2 semanas se puede comparar contra la línea base del audit:

| Métrica | Línea base (2026-07-23 → 2026-08-28) | Dónde leerla ahora |
| --- | ---: | --- |
| `play_again_tap` → partida ≤5 min | 51,8% – 63,8% | `play_again_tap` vs `play_again_game_started` |
| Finishers que juegan una 2ª partida | 45,2% (42,5% mismo día) | pares `arena_game_start.game_id` |
| Entradas al Reviewer vía X | 93,3% de 2.064 | debería caer a ~0 |
| Terminó ≥2 partidas en D0 | 12,1% (lift 2,47×) | el hito de activación propuesto |

⚠️ Ninguna de esas comparaciones es un experimento controlado: no hay A/B, y la población de agosto llegó casi entera en una semana. Es un before/after, con todo lo que eso no prueba.

---

## 9. Pase visual — Fase 1 (Sally, commit `40b0a119`)

### 9.1 ⛔ El contrato de color se INVIRTIÓ

| | Antes (commit `ce62e065`) | Ahora |
| --- | --- | --- |
| Seguir jugando | **verde** | **morado** |
| Analizar (Coach) | morado | morado |
| Guardar / claim | dorado | dorado |
| Terciario | crema | crema |
| Verde | color de CTA | **el mundo** — marco, fondo, tablero |

**Motivo:** el entorno de Chesscito es verde, así que un CTA verde no tiene de qué
separarse. El morado es el complementario. El contrato viejo vivió un solo commit.

⚠️ **El morado se usa DOS veces** (repetir + Coach) y no es ambiguo porque la jerarquía la
carga la **forma**: barra full-width de 76px vs píldora chica dentro de una card. Si aparece
un problema de jerarquía, se arregla la forma — no se inventa un cuarto color.

### 9.2 Lo que cambió, medido

| Defecto | Antes | Ahora |
| --- | ---: | ---: |
| Desborde del CTA del Coach (`scrollWidth − clientWidth`) | **20 px** | **0 px** |
| Cinta de Peones encima del label (área de solape) | colisión visible | **0 px²** |
| CTA primario: ancho / alto / radio | 200 px auto / 56 px / 14 px | **272 px full-col / 76 px / 999 px** |
| Share en la fila terciaria | descolgado a la izquierda | centrado |

⛔ **El `nowrap` no estaba en el botón sino en `.arena-result-primary-cta-label`.** Relajar
el botón no alcanzaba. Por eso el primer intento midió 20 px de desborde igual.

Medido con `getBoundingClientRect` sobre `/dev/arena-end-state` a 390×844 @2x, en las tres
variantes (`win-celebration`, `resigned`, `loss-save`). **No** se juzgó por captura completa:
a 390 px un solape de 20 px no se distingue a ojo.

### 9.3 Copy de botón — presupuesto nuevo

> **Máx. 3 palabras / ~18 caracteres. Sin punto final.**

| Clave | Antes | Ahora |
| --- | --- | --- |
| `lossReviewCta` | `Let's see what happened.` (24) | **`What happened?`** (14) |
| `drawReviewCta` | `How did this end?` (17) | **`How it ended`** (12) |
| `winCoachReviewCta` | `Why did you win?` (16) | **`Why you won`** (11) |

⚠️ **`pnpm content:audit` NO detecta esto.** Su umbral es de **32 caracteres** y es
**warn-only (`exit 0` siempre)**, así que `"Let's see what happened."` pasaba. Hoy reporta
151 hallazgos, 107 de longitud de botón — de los cuales **sólo 27 son botones reales**, el
resto son `ariaLabel` (falso positivo conocido del heurístico). **El brief existe y no se
aplica**: no hay nada que lo haga fallar.

### 9.4 Fase 2 — NO hecho, y por qué

| Pendiente | Razón |
| --- | --- |
| **La card del Coach** (fondo lila, lobo chico a la izquierda, chip PRO + botón a la derecha) | Hoy el lobo es enorme y "asoma" desde la derecha, dejando la columna de texto en **152 px**. Ése es el verdadero techo del CTA del Coach; la copy corta lo esquiva, no lo resuelve. |
| Corona sobre el panel, subtítulo, hero del lobo, kicker `RESUMEN DE LA PARTIDA` | Composición nueva. |
| Corona partida (derrota) | **El asset no existe.** |
| Hero del lobo a ~290 px | `shared.feedback-happy/sad` están a **512×562**; a 2x eso pide ~580 px. Alcanza justo y **no da para más**. ⛔ No upscalear. |
| Revisión de partida (mockup 3) | Proyecto aparte — el pedido original decía explícitamente no rehacer el Match Reviewer. |

### 9.5 ⛔ VR sigue rojo, y sigue sin regrabarse

Las baselines cambiaron dos veces (jerarquía + este pase visual). **No se regrabaron.** La
regla del repo se mantiene: mirar el `-actual.png` antes de decidir, porque un
`--update-snapshots` a ciegas hornea el error dentro de la foto. Con la fase 1 cerrada,
ahora sí conviene un solo pase de regrabación.
