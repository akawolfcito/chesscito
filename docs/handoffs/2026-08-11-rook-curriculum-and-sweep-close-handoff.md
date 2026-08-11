# Handoff — Star Sweep + currículo de la torre (cierre de sesión)

**Fecha:** 2026-08-11 · **Rama:** `main` LOCAL, **sin pushear** · **26 commits** de esta sesión
**Estado:** ✅ jugado y **aprobado para prod por el founder**

Antecedentes: `docs/handoffs/2026-08-10-rook-star-sweep-slice-handoff.md` (el slice, etapas 1–9)
Spec: `docs/specs/2026-08-10-rook-mastery-vertical-slice-spec.md`
Análisis que lo motivó: `docs/audits/2026-08-10-content-flatness-and-progression-analysis.md`

---

## 1. Verificación al cierre

| | |
|---|---|
| Vitest | **638 archivos / 7819 tests · exit 0** |
| `pnpm exec tsc --noEmit` | limpio |
| `pnpm build` | **exit 0**, 115 páginas |
| VR | **67/67 · exit 0** (`--project=minipay --update-snapshots=none`, baselines 81 antes y después) |
| Smoke manual | hecho por el founder, **aprobado** |

⚠️ Los conteos **envejecen**. Medí vos en `main` limpio antes de empezar y compará contra tu
propia medición. Lo que no envejece: **si el conteo de ARCHIVOS baja, la corrida no vale** —
pasó en esta sesión (633 con load average 49; volvió a 638 con la máquina libre).

---

## 2. Qué quedó vivo

**El mecanismo.** `targets[]` en el tipo, con `exerciseTargets()` como único lector.
`sweepStars` con bandas relativas y **0★ posible**; `gradeExerciseRun` como **único** punto de
dispatch (cliente y servidor). `computeSweepOptimal` calcula el óptimo como el **mejor orden**.
`bestMoves` persistido, victoria con orden libre + dedup, contador vivo, bloque de récord y CTA.

**El currículo de la torre**, en cuatro escalones:

| # | id | escalón | ★ | óptimo | muros |
|---:|---|---|---:|---:|---:|
| 1 | `rook-1` | entrada | 1 | 1 | 0 |
| 2 | `rook-2` | sweep | 3 | 3 | 0 |
| 3 | `rook-distance-1` | sweep | 4 | 4 | 0 |
| 4 | `rook-no-diagonal-1` | sweep | 2 | 4 | 0 |
| 5 | `rook-10` | obstáculos | 1 | 4 | 10 |
| 6 | `rook-9` | obstáculos | 1 | 5 | 6 |
| 7 | `rook-8` | obstáculos | 1 | 5 | 17 |
| 8 | `rook-4` | ambos | 3 | 7 | 3 |
| 9 | `rook-6` | ambos | 3 | 8 | 18 |
| 10 | `rook-7` | ambos | 3 | 10 | 18 |

Curva **1, 3, 4, 4, 4, 5, 5, 7, 8, 10**: monótona, sin saltos > 2. Los tres avisos de curva que
tenía la torre desaparecieron.

⛔ **`rook-1` no se convierte nunca.** Es la puerta del producto (543 de 545 wallets) y el
**control within-subject** del experimento.
⛔ **Sólo `rook-2` lleva `starFloor: 1`** — es el segundo tablero que toca alguien nuevo.

---

## 3. 🔁 EL PATRÓN, para repetirlo en las otras piezas

Esto es lo que el founder pidió conservar. Nueve pasos, en orden.

1. **Medí la pieza antes de tocarla.** Densidad de tablero, óptimos y alcance por ejercicio.
   Sin esto se elige por gusto: yo elegí los tres primeros sweeps por **alcance medido** y el
   resultado fue alternancia, no currículo. Hubo que rehacerlo.
2. **Asigná los cuatro escalones**: 1 entrada · 2-4 sweep · 5-7 obstáculos · 8-10 ambos.
   Mirá primero qué ejercicios **ya** tienen muros: en la torre, 5 de 10 ya los tenían y casi
   todo fue **reorden**, que es gratis.
3. **Reordenar es seguro.** El progreso se guarda por **id**, no por posición.
4. ⛔ **No diseñes tableros densos a ojo.** Usá un solver que enumere casillas alcanzables y
   puntúe cada conjunto candidato **antes** de escribir. El de esta sesión quedó en el
   scratchpad; vale reescribirlo (30 líneas: BFS de torre + permutaciones).
5. **Autorá en `content/exercises.json`**, nunca en el builder (lo rechaza, §5).
   Reglas: `target` **debe** ser `targets[0]`; `starFloor` es opcional (`1` o `2`);
   ⛔ **nunca escribas `optimalMoves`** — lo calcula el import.
6. **`pnpm -C apps/web import-puzzles`.** Verifica solubilidad, calcula óptimos y falla fuerte
   si algo miente.
7. **Revisá la curva.** El linter avisa si retrocede o salta más de 2. Ordená el escalón de
   obstáculos por su óptimo computado, no por su id.
8. **Arreglá los tests que pinean contenido.** Pasó **tres veces** en esta sesión. Un test debe
   leer el pool (por id o por índice, según lo que afirme), nunca literales de copy ni
   posiciones. Ver `feedback_never_pin_authored_content_in_tests`.
9. **Verificá**: Vitest (máquina libre) + `tsc` + `build` + VR (dev server **abajo**).

⚠️ **Antes de AGREGAR ejercicios al pool** (no reordenar): el gate de la insignia es **80 % del
pool**. De 10 a 13 sube de 8 a 11, y quien la tenía **ganada pero sin reclamar** la ve
`locked` otra vez. Ya reclamada = intacta (`claimed` gana en `badge-sheet.tsx`).
`MAX_EXERCISES_PER_PIECE = 100`, así que el techo no es el problema; el gate sí.

---

## 4. Cómo se lee el experimento

**Instrumentación viva y verificada contra prod.** Tres eventos en `analytics_events`:
`sweep_result`, `sweep_replay_cta_shown`, `sweep_replay_started`.

```
replay_rate = sweep_replay_started / sweep_replay_cta_shown
```

El contraste honesto es **within-subject**: `rook-1` sin convertir, el mismo jugador, la misma
sesión. Umbral del spec: **≥ 2× el control**. Baseline histórico: **9,0 %** de las cadenas
wallet×ejercicio con nota < 3★ reintentaron (84 de 935).

⚠️ **Las filas de `sweep_replay_cta_shown` anteriores a `5e322bcc` están contaminadas** con
impresiones fantasma (disparaba también en corrida perfecta, donde no hay botón). Al leer,
descartá las que tengan `gap_to_perfect = 0` o tomá sólo las posteriores.

---

## 5. El builder: qué puede y qué no

| | builder | JSON + `import-puzzles` |
|---|---|---|
| Ejercicios de un objetivo | ✅ | ✅ |
| Laberintos y juegos firma | ✅ | ✅ |
| Deshabilitar cualquier cosa | ✅ | ✅ |
| **Sweeps** | ❌ **400 con el motivo** | ✅ |

`content_overlay` no tiene columnas `targets` ni `starFloor`, así que una fila suya **no puede**
representar un sweep. Bloqueado en **lectura** (`mergeOverlay` conserva el baseline) **y en
escritura** (`POST /api/admin/content` devuelve 400 diciendo dónde editar). Los dos hacen falta:
sólo con el de lectura, guardar era un **no-op silencioso**.

Detalle: `/api/dev/publish` reenvía el motivo **sólo en 400**. Un 500 trae `error.message` de
Supabase y puede filtrar un connection string.

---

## 6. Lo que sigue

1. **Pushear `main`.** 26 commits locales. Es del founder, no del asistente.
2. **Repetir el patrón** en la siguiente pieza (§3). El alfil tiene 9 ejercicios y es la segunda
   más jugada.
3. **Leer el experimento** cuando haya muestra (§4).
4. **Decidir sobre el builder**: si se van a autorar muchos sweeps, agregarle `targets` y
   `starFloor` a la tabla y el modo multi-estrella al formulario. Hoy el camino es el JSON y el
   sistema lo dice en vez de fallar callado.

**Abiertas, sin urgencia:**
- 32 filas `draft` en `content_overlay`, inertes (prod lee `published`). Las 3 que causaban el
  incidente se borraron; respaldo en `docs/audits/2026-08-11-content-overlay-rook-rows-backup.json`.
- El solapamiento vertical del título con el header, preexistente y **sólo en el marco de
  escritorio**. Móvil está limpio.

---

## 7. Los cinco defectos que encontró el smoke manual

Ninguno lo detectaron los tests. Vale como argumento a favor de seguir haciéndolo.

1. **El overlay degradaba el sweep a 1 movimiento** → y la pantalla trata `optimalMoves === 1`
   como "cualquier movimiento que no sea la estrella es derrota". Imposible de jugar **y**
   castigaba por intentarlo.
2. **Un best obsoleto anunciaba `PERFECT RUN`** que nadie hizo, y retiraba el CTA.
3. **La línea "You learned" se recortaba en web** (`92vw` es del viewport, no del marco).
4. **Las pastillas anunciaban premios inexistentes** (`+1 STARS` sin haber ganado nada).
5. **El chip de pieza abría Badges** en vez del PATH, duplicando lo que el dock ya hacía.

Y uno más que salió de **mirar los datos**, no la pantalla: `sweep_replay_cta_shown` contaba
impresiones de un botón que no existía.

---

## 8. Gotchas que dejó esta sesión

- ⛔ **Varias rojas del VR sin código en común = un banner de dev de tu shell.** Mirá el
  `-actual.png` antes de tocar código. → `feedback_vr_reds_can_be_a_dev_banner_from_your_shell`
- ⛔ **Una fila del builder no puede representar un sweep.** → `project_overlay_cannot_express_a_sweep`
- ⛔ **El carril 1 califica con `computeStars`** (0★ imposible), no con `labyrinthStars`.
  → `project_lane1_grader_is_computestars`
- ⚠️ **Los tres bugs de integración fueron en el pegamento con React**, ninguno en la lógica
  pura: identidad inestable en deps de un effect, contaminación por `activeExercise`, y un hook
  bajo un early return. La lógica pura se prueba sola; el pegamento hay que mirarlo.
- ⚠️ **El guard anti-AI-prose prohíbe la raya `—`** en copy de usuario. Comas.
