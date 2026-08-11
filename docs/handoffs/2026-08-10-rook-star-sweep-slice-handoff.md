# Handoff — Rook Star Sweep, vertical slice de mastery

**Fecha:** 2026-08-10 · **Rama:** `feat/rook-star-sweep-mastery-slice` (6 commits, NO pusheada)
**Spec:** `docs/specs/2026-08-10-rook-mastery-vertical-slice-spec.md`
**Análisis que lo motiva:** `docs/audits/2026-08-10-content-flatness-and-progression-analysis.md`

---

## Estado en una línea

**La máquina está construida y verde; el contenido y la pantalla no.** Las etapas 1–6 del
plan (tipos, grader, solver, persistencia, telemetría, decodificador de contenido) están
commiteadas y con suite verde. Las etapas 7–9 (condición de victoria multi-objetivo, CTA de
replay, eventos del CTA) **no están empezadas**, y sin la 7 el slice no es jugable.

⛔ **NO mergear esta rama todavía.** Ver §"La trampa" abajo.

---

## Verificación (medida, no estimada)

| | |
|---|---|
| Baseline en `main` limpio, antes de empezar | **623 archivos / 7691 tests, exit 0** (132 s) |
| Tras las etapas 1–5 | **628 archivos / 7731 tests, exit 0** (143 s) |
| `pnpm exec tsc --noEmit` | limpio en cada etapa |
| VR | **NO corrido** — ningún cambio toca pixeles todavía |

El conteo de archivos SUBIÓ (623 → 628 = mis 5 archivos de test nuevos; +40 tests). Regla de
`CLAUDE.md`: si baja respecto de tu propia medición, la corrida no vale.

---

## Lo que está hecho (commiteado, verde)

1. **`29249625` docs** — el análisis de planitud + el spec del slice.
2. **`95f4d769` `targets[]`** — `lib/game/targets.ts`: `exerciseTargets()` / `isSweep()` /
   `sweepTargetKey()`. `targetPos` NO se fue; un sweep mantiene `targetPos === targets[0]`
   para que los ~100 lectores viejos sigan funcionando. **9 tests.**
3. **`69cf8e63` grader** — `sweepStars` (bandas relativas, **0★ posible**) y
   `gradeExerciseRun` como **único** punto de dispatch. **18 tests.**
4. **`954a04dd` solver** — `computeSweepOptimal`: el óptimo es el mejor ORDEN (TSP diminuto),
   no la suma del orden autorado. Rechaza el peón explícitamente. **6 tests.**
5. **`f0e75894` persistencia + telemetría** — `PieceProgress.bestMoves` (sólo se sobrescribe
   al superar; lectura tolerante) y el evento `sweep_result`. **7 tests.**
6. **(por commitear) decodificador** — `mapFenPuzzle` acepta `targets` algebraicos y valida el
   invariante; `catalog.ts` calcula `optimalMoves` con el solver. **9 tests.**

### 🔎 El hallazgo que casi rompe el scoreboard

El spec decía que había **tres** llamadas a `computeStars` en la pantalla más una en el
servidor. **Eran cinco.** La quinta —`use-exercise-progress.ts:444`— es la que **PERSISTE la
estrella**, y mi grep inicial no la vio porque sólo busqué en `exercises-screen.tsx` y
`attempt-grading.ts`.

Si se hubiera quedado sin migrar: la pantalla muestra una nota, el servidor persiste otra y el
progreso local guarda una tercera. Los dos graders son `(number, number) => number`, así que
el sitio olvidado **tipa, corre y miente**. El test de paridad
(`lib/scores/__tests__/sweep-grading-parity.test.ts`) ancla los dos extremos ahora.

---

## ⛔ La trampa: el contenido convertido NO es shippeable sin la etapa 7

Convertí los tres ejercicios, corrí `import-puzzles`, verifiqué los óptimos —y **lo revertí a
propósito**. Motivo:

`handleMove` (`exercises-screen.tsx:1765`) todavía gana con **una** casilla:

```ts
const isTarget =
  position.file === currentExercise.targetPos.file &&
  position.rank === currentExercise.targetPos.rank;
```

Con `rook-2` convertido, `targetPos` es `e8` = `targets[0]`. El jugador toca `e8`, el ejercicio
**se completa con 1 de 3 estrellas recogidas**, y `sweepStars(1, 3)` devuelve **3★** porque
`1 <= 3`. Resultado: `rook-2` quedaría **más fácil que antes** y el tablero mostraría una sola
estrella. Exactamente el bug que el slice existe para arreglar, pero peor.

**Por eso el contenido se revirtió y la capacidad se quedó.** Hoy ningún ejercicio declara
`targets`, así que el runtime es idéntico al de antes.

### Los 12 tests que la conversión rompe (ya diagnosticados)

Cuando se reintroduzca el contenido, esto es lo que hay que arreglar — **ninguno es un bug del
código nuevo**:

| Archivo | Tests | Causa | Arreglo |
|---|---:|---|---|
| `lib/game/__tests__/exercise-bfs.test.ts` | 3 | la red de regresión compara contra el BFS de objetivo único | hacerla sweep-aware (`computeSweepOptimal` cuando `isSweep`) |
| `lib/game/__tests__/exercises-bfs-verifier.test.ts` | 3 | idem | idem |
| `lib/scores/__tests__/attempt-grading.test.ts` | 1 | "grades every shipped level with the canonical grader" | idem |
| `components/exercises/__tests__/exercise-drawer.test.tsx` | 5 | **pinea títulos autorados** (`"Move along the file"`, `"Turn the corner"`) | consultar por id, no por texto — ver [[feedback_never_pin_authored_content_in_tests]] |

⚠️ Los 5 del drawer son un **anti-patrón preexistente** que mi cambio expuso, no un daño nuevo:
la memoria ya dice "NUNCA pinear en tests un valor que el builder puede cambiar". Vale
arreglarlos aunque el sweep no siguiera adelante.

### La conversión exacta, para no re-derivarla

`apps/web/content/exercises.json`, `target` debe seguir siendo `targets[0]`:

| id | targets | óptimo calculado | bandas |
|---|---|---:|---|
| `rook-2` | `e8, b8, b4` | **3** | 3★=3 · 2★≤4 · 1★≤5 · 0★≥6 |
| `rook-distance-1` | `b3, g3, g7, b7` | **4** | 3★=4 · 2★≤5 · 1★≤6 · 0★≥7 |
| `rook-4` | `b2, b7, g2` | **3** | 3★=3 · 2★≤4 · 1★≤5 · 0★≥6 |

Títulos/prompts nuevos y la justificación de cada uno están en el §4 del spec. `rook-1` **no se
toca**: es el control (543 de 545 wallets pasan por él).

---

## Lo que falta (etapas 7–9)

7. **Condición de victoria multi-objetivo** en `exercises-screen.tsx`. Recoger todas las
   casillas de `exerciseTargets(ex)`, contador vivo `2/3`, y completar sólo en la última.
   Es la etapa que desbloquea todo lo demás.
8. **CTA de replay** en el `PhaseFlash` (⛔ no es un overlay —
   [[project_exercise_completion_surface_is_phaseflash]]): "Tu mejor: 9 · Perfecta: 7".
   Una corrida perfecta **no** invita a repetir.
9. **Eventos del CTA**: `sweep_replay_cta_shown`, `sweep_replay_started`.

---

## Preguntas abiertas (necesitan decisión del founder)

1. **¿0★ en el segundo ejercicio del juego es demasiado?** `rook-2` lo ven 520 wallets y es de
   lo primero que toca alguien que recién aprende cómo se mueve la torre. Con óptimo 3, seis
   movimientos ya dan **0★**. Protegimos `rook-1` por la activación; puede que `rook-2` merezca
   un piso de 1★ por el mismo motivo. **No lo decidí solo.**
2. **El VR no va a ver nada de esto.** El contador `2/3` y el CTA miden mucho menos que la
   tolerancia de `hub-clean` (~1.646 px contra un chip de ~450). Se anclan con **aserciones de
   DOM**, nunca con la foto — [[feedback_vr_tolerance_hides_small_elements]].
3. **¿Alcanza el tráfico para medir?** El firehose del listing decayó 94 %. Conviene fijar el N
   mínimo **antes** de leer el resultado, o el experimento no va a poder falsarse.

---

## Cómo retomar

```
git checkout feat/rook-star-sweep-mastery-slice
pnpm -C apps/web test          # debe dar >= 629 archivos, exit 0
```

Empezar por la etapa 7 con el test primero (`2/3` no completa, `3/3` sí). El contenido se
reintroduce **después** de que la pantalla sepa ganarlo, no antes.
