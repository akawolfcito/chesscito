# Handoff — Rook Star Sweep, vertical slice de mastery

**Fecha:** 2026-08-10 · **Rama:** `feat/rook-star-sweep-mastery-slice` (6 commits, NO pusheada)
**Spec:** `docs/specs/2026-08-10-rook-mastery-vertical-slice-spec.md`
**Análisis que lo motiva:** `docs/audits/2026-08-10-content-flatness-and-progression-analysis.md`

---

## Estado en una línea

> **ACTUALIZADO 2026-08-11 (2).** **Las nueve etapas están cerradas.** El slice es jugable y
> ya es un experimento: el jugador recibe una meta explícita (`YOUR BEST` / `PERFECT` / el CTA)
> y los dos eventos que separan "lo vio" de "decidió volver" están emitiendo.
>
> **Lo único que falta es el smoke manual en preview.**

**Verificación al cierre:** **634 archivos / 7787 tests, exit 0** · `tsc` limpio ·
VR **no corrido a propósito**: el contador y el CTA miden ~450 px contra una tolerancia de
~1.646, así que una foto verde no probaría que renderizaron. Van anclados por **aserción de
DOM** — 15 tests, incluidos los dos casos que fijó el founder, verificados dos veces (en la
lógica pura y renderizados).

⚠️ **La sección "La trampa" de abajo quedó RESUELTA** — se conserva porque explica por qué el
contenido se separó de la capacidad, y esa es la razón por la que el bug no llegó a producción.

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

## Lo que se cerró el 2026-08-11 (etapas del piso y la 7)

- **`52b9360b` — `starFloor`, piso como POLÍTICA del ejercicio.** Se aplica en
  `gradeExerciseRun`, nunca dentro de un grader: `sweepStars` y `computeStars` siguen siendo
  puros y la política de UN tablero no se vuelve la escala de todos. Tipado **`1 | 2`, nunca 3**
  — un tablero infallable es la planitud que sacamos. `rook-2` lleva `1`; sus vecinos llegan a 0★.
- **`bcd529ff` — victoria sweep-aware.** `lib/game/sweep-run.ts`, máquina de estados pura:
  orden libre, dedup por `Set`, `isComplete` sólo al último. Un ejercicio plano es un sweep de
  un objetivo, así que la pantalla **nunca ramifica por `isSweep`**.
- **`635e10b4` — contenido reintroducido** + los 12 tests arreglados en su causa.

### Dos bugs que aparecieron al conectar (y que valen para la próxima)

1. **`useEffect` con `currentExercise` en las deps.** Es `pool[safeIndex]` — un elemento de un
   array que el catálogo puede reconstruir, **sin identidad estable**. Se re-ejecutaba a mitad
   de ruta, borraba las estrellas recogidas y dejaba el sweep **literalmente inganable**. Va por
   `.id`, como ya hacían los effects del propio hook (`use-exercise-progress.ts:429,446`).
2. **El tablero recibe `activeExercise` (= `activeLabyrinth ?? currentExercise`)** pero el run
   sólo sigue al ejercicio. Sin aislar, una casilla recogida en el ejercicio **apagaba el
   objetivo del laberinto** cuando compartían cuadro.

## Etapas 8–9, cerradas el 2026-08-11 (`c8091d8e`)

**El gap se mide contra el RECORD, no contra la corrida.** Jugaste 10, tu mejor es 9, la
perfecta es 7 → **`TRY AGAIN — 2 TO GO`**, no 3. La promesa es "superá tu récord"; un gap
medido desde una corrida descartable se movería en cada intento mientras la meta no. Un
récord perfecto **no ofrece replay**, y el gap se topea en 0 (un best bajo el óptimo significa
que el **óptimo** está mal, y el CTA no puede decir "te faltan −1" mientras se investiga).

El contador es **condición de presentación, no de lógica**: la máquina modela un ejercicio
plano como sweep de un objetivo para que nada ramifique, pero `1 / 1` en los 56 tableros
legacy es ruido.

Eventos (criterio de aceptación, no telemetría opcional): `sweep_replay_cta_shown` y
`sweep_replay_started`, ambos con `exercise_id`, `best_moves`, `optimal_moves`,
`gap_to_perfect`. El `_shown` sale de un **effect**, no del render — en render disparaba en
cada re-render del mismo success e inflaba el denominador de la conversión que mide.

⚠️ **Tercer bug de orden de hooks:** el effect quedó bajo el early return `!visible || !flash`.
Un hook que corre en algunos renders y no en otros es un crash, no un detalle. Es el tercero
de la misma familia en este slice (identidad inestable → contaminación por `activeExercise` →
este): **la lección es que la lógica pura se prueba sola y el pegamento con React es donde
aparecen los errores.**

⚠️ La copy va **hardcodeada en inglés** como sus vecinas (`+N Stars`, `×N Combo`) en vez de
pasar por `editorial.ts`. Si sobrevive al experimento, va al bundle — y el guard del ES cubre
todo el bundle.

## Lo único que falta

**Smoke manual en preview** (founder). Qué mirar, en orden:

1. `rook-2` muestra **tres** estrellas y el contador `0 / 3` → `1 / 3` → `2 / 3`.
2. No completa hasta la tercera; volver a pisar una ya recogida **no** suma.
3. Al completar: `YOUR BEST` / `PERFECT` y el CTA con el número correcto.
4. Rejugar y **empeorar**: el best NO baja y el gap no cambia.
5. Llegar a la perfecta: aparece `PERFECT RUN` y **desaparece** el CTA.
6. `rook-1` (el control) sigue **sin** contador y sin bloque de récord.

---

## Preguntas abiertas (necesitan decisión del founder)

1. ~~**¿0★ en el segundo ejercicio del juego es demasiado?**~~ **RESUELTA** (founder,
   2026-08-11): `rook-2` lleva `starFloor: 1`, expresado como política del ejercicio y **no**
   como cambio del grader global. `rook-distance-1` y `rook-4` conservan el 0★.
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
