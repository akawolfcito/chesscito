# Plan de implementación — Currículo de TORRE + captura compartida

**Fecha**: 2026-07-13
**Fuente**: `docs/audits/2026-07-13-rook-curriculum-audit.md`
**Estado**: plan. **Sin implementación, sin commits.**
**Frente**: Frente 1 — pulir el aprendizaje actual (`docs/product/2026-07-13-direction-where-we-are.md` §6).

> ⚠️ **Este plan corrige a la auditoría que lo originó.** Al bajar al runtime aparecieron dos hechos
> que la auditoría no vio, y uno de ellos es más grave que todo lo que reportó. Ver §3.1.

---

## 1. Resumen ejecutivo

El plan entrega el currículo definitivo de torre (10 ejercicios) y *Rook Rails* (5 niveles) en **dos
entregas**, separadas por un gate. **La Entrega 1 no depende del motor y es enviable sola.**

Pero el orden de trabajo **cambió respecto de la auditoría**, porque al leer el runtime apareció esto:

> ## 🔴 Los obstáculos de los ejercicios NUNCA se aplican en `/exercises`.
>
> `exercises-screen.tsx:2860` pasa `obstacles={activeLabyrinth?.obstacles}` — **sólo los del
> laberinto**. Cuando el jugador hace un ejercicio normal, `activeLabyrinth` es `null`, así que
> `obstacles` llega `undefined`, `getValidTargets` recibe `[]`, y **la torre atraviesa los bloqueadores
> como si no existieran**.
>
> **19 ejercicios, en 5 piezas, tienen obstáculos que el juego descarta.** Y como
> `computeStars` da 3★ con `movesUsed <= optimalMoves` (`scoring.ts:13`), **el jugador saca 3 estrellas
> de taquito en la mitad difícil de cada pieza.**

**Esto reordena todo el plan**: escribir textos pedagógicos sobre ejercicios cuya dificultad no existe
sería pintar una pared podrida. **La Fase A empieza por A0 — reparar el runtime — y recién después
viene el contenido.**

**Lo bueno:** A0 es un cambio chico y hay **prueba interna de que es un bug, no un diseño**:
`daily-tactic-sheet.tsx:172` pasa `obstacles={puzzleData.exercise.obstacles}` **correctamente**. El
mismo ejercicio se bloquea bien en el Daily y se rompe en `/exercises`.

---

## 2. Decisiones cerradas (input del founder, no se re-litigan)

1. La captura de torre **sí entra** en el currículo definitivo.
2. **No bloquea** la corrección pedagógica inmediata.
3. La torre mantiene **10 ejercicios**. No crece a 13.
4. **No** se crean `Rook I` / `Rook II`.
5. La captura se implementa como **infraestructura compartida**: rook, bishop, queen.
6. *Rook Rails* se conserva como Special Training propio de la torre.
7. Cinco niveles: `One Turn`, `Two Turns`, `Dead End`, `Break Through`, `Two Roads`.
8. `Break Through` depende del soporte de captura.
9. En ejercicios, **una pieza propia se representa como pieza propia** — ni enemigo incapturable, ni
   roca genérica.
10. Los obstáculos ambientales pueden existir en *Rook Rails*, pero **no sustituyen una regla real de
    ajedrez dentro de los ejercicios**.

### Secuencia pedagógica definitiva

`mover → distinguir → restringir → capturar → planificar`

1. Movimiento en fila · 2. Movimiento en columna · 3. Distancia variable · 4. La torre no se mueve en
diagonal · 5. Cambio de dirección entre movimientos · 6. Una pieza propia bloquea · 7. Capturar al
primer enemigo · 8. No puede capturar detrás de otra pieza · 9. Rodear un bloqueo · 10. Ruta más
eficiente.

*"El enemigo detiene el recorrido"* **no lleva ejercicio propio**: queda demostrado en el 7 y el 8.

---

## 3. Estado actual relevante (verificado en código)

| Hecho | Dónde | Consecuencia |
| --- | --- | --- |
| El rayo **corta antes** del bloqueador (`break` sin `push`) | `lib/game/rules/rook.ts:36-38`, `bishop.ts:28` | La torre **no puede capturar nada**. Alfil idéntico. |
| `withoutBlockers` **filtra** la casilla del obstáculo | `lib/game/board.ts:41-43, 72-73` | Segunda barrera contra el aterrizaje. Hay que levantar **las dos**. |
| `isCapture` / `captureTargets` sólo actúan en la rama `pawn` | `lib/game/board.ts:50-67` | La captura hoy es **exclusiva del peón**. |
| **El importador PROHÍBE enemigos en piezas no-peón** | `lib/game/fen-puzzle.ts:99-101` — *"black piece on {sq}: captures unsupported for {piece}; model as obstacles"* | **El guardrail que Fase B debe levantar.** Hoy un FEN de torre con enemigo **no compila**. |
| `objective` se alimenta de `explanation` del JSON | `fen-puzzle.ts:118` | **El pipeline de texto YA EXISTE.** Ningún ejercicio setea `explanation` → por eso `GENERATED_EXERCISE_DESCRIPTIONS = {}` (`puzzles.generated.ts:2325`) y la UI cae a `Exercise {n}` (`editorial.ts:1265`). |
| Progreso keyed por **`id`**, no por posición | `types.ts:96-102`, `exercise-progress.ts:28-51` | **Reordenar es seguro.** Cambiar el contenido de un id **no** lo es (§10). |
| `computeStars`: 3★ si `movesUsed <= optimalMoves` | `scoring.ts:13` | Si el tablero es más fácil de lo que dice `optimalMoves`, **3★ automáticas**. |
| Muros sólo se dibujan en `mode === "labyrinth"` | `board.ts:541-542` | En `practice` los obstáculos **no se ven** — aunque se pasaran. |

### 3.0 — 🔴 TERCERA CORRECCIÓN (añadida durante A1/A7): el fallback `Exercise N` NUNCA se veía

**La auditoría, y la primera versión de este plan, afirmaron que la UI mostraba "Exercise 1…10".
ERA FALSO.** `resolveExerciseDescription` tiene **tres** escalones, no dos: mapa generado (vacío) →
**`EXERCISE_DESCRIPTIONS` (`editorial.ts:1271`)** → fallback. Ese mapa i18n del medio **siempre tuvo una
etiqueta por ejercicio**, así que el fallback era inalcanzable.

**Qué cambia y qué NO cambia:**

- ❌ **NO era cierto** que el jugador viera *"Exercise 1"*. Veía *"Horizontal move"*, *"Around the
  wall"*, *"Boxed-in square"*.
- ✅ **SIGUE SIENDO CIERTO** que el jugador **no lee la lección**: esas etiquetas **nombran la postal**,
  no enseñan el principio.
- 🔴 **Y es PEOR de lo que dijo la auditoría en otro eje**: la mentira de la captura **llegaba a la
  pantalla**. `rook-4` = *"Corner capture"*, `rook-5` = *"Cross capture"*, `rook-9` = *"Capture
  detour"* — **en tableros sin nada que capturar**. No era metadata sucia: **era una promesa rota
  frente al jugador.**

**Consecuencia para A7:** su trabajo **no es** "matar el fallback" (ya era inalcanzable). Es
**reemplazar etiquetas-nombre, algunas falsas, por título + prompt curados**. El fallback se conserva
en el código como defensa y **el linter lo vuelve inalcanzable para las piezas curadas** — que es lo
que se pidió.

**Deuda menor que queda abierta:** las 10 entradas de torre en `EXERCISE_DESCRIPTIONS`
(`editorial.ts:1271-1281`) quedaron **muertas** (el mapa generado gana) y **dos siguen mintiendo**
("Corner capture", "Cross capture"). No se borran en este bloque para no tocar la paridad
`editorial.ts` ⇄ `messages/es.ts`. **Son inalcanzables, pero conviene limpiarlas.**

---

### 3.1 — Las dos correcciones a la auditoría

**🔴 CORRECCIÓN 1 — Los obstáculos de ejercicio se descartan (hallazgo nuevo, el más grave del plan).**

`exercises-screen.tsx:2860`: `obstacles={activeLabyrinth?.obstacles}`, con
`activeExercise = activeLabyrinth ?? currentExercise` (línea 2376). En un ejercicio normal
`activeLabyrinth === null` → **los `obstacles` del ejercicio nunca llegan al tablero.**

Radio de impacto medido (BFS con obstáculos vs. sin ellos):

| Pieza | Ejercicios afectados | Óptimo declarado → real en la app |
| --- | --- | --- |
| **rook** | `rook-6…10` | 3→1, 4→2, 4→2, 3→2, 4→**1** |
| **bishop** | `bishop-6…10` | 3→2, 3→2, 4→1, 4→1, 5→**1** |
| **queen** | `queen-6…10` | 3→**1** en los cinco |
| **king** | `king-8`, `king-10` | 3→2, 4→3 |
| *(benignos)* | `knight-8`, `king-7` | el óptimo no cambia (el caballo salta igual) |

**17 ejercicios pierden su dificultad y regalan 3★.** La curva real que juega el usuario hoy en torre
es **1,1,1,2,2,1,2,2,2,1** — es decir, **la intuición del founder ("la dificultad es casi plana") era
literalmente cierta en la app, y peor de lo que la auditoría midió en los datos.**

**🟠 CORRECCIÓN 2 — Los bloqueadores NO se renderizan como caballos.** La auditoría (§4 P1, §8) dijo que
los obstáculos se dibujan como caballos y que eso "promete captura". **Es falso.** `board.ts:541-542`
los dibuja como **muro de piedra** (`is-wall`), y **sólo en modo laberinto**. La decisión ya está
tomada y comentada en el código (*"a blocked square reads clearer than a locked rook — founder
2026-06-16"*).

→ **La decisión cerrada n.º 9 (pieza propia = pieza propia) contradice esa decisión previa del founder
para los ejercicios.** No es un conflicto grave — son superficies distintas (ejercicio vs. laberinto) —
pero **hay que hacerlo explícito**, y este plan lo resuelve así:

- **Ejercicios** → **pieza propia visible** (decisión n.º 9). El principio 6 dice *"una pieza propia
  bloquea"*: si es un muro, el principio ajedrecístico se pierde.
- **Rook Rails** → **muro de piedra** (obstáculo ambiental, decisión n.º 10). Se conserva tal cual está.

---

## 4. Arquitectura de contenido

```
apps/web/content/exercises.json     ← FUENTE DE VERDAD editorial (FEN + texto curado)
apps/web/content/labyrinths.json    ← idem, para Rook Rails
        │  pnpm import-puzzles  (scripts/import-puzzles.ts → lib/content/catalog.ts)
        │    ├── mapFenPuzzle()        FEN → startPos/targetPos/obstacles/enemies   (fen-puzzle.ts)
        │    ├── computeExerciseBfs()  → optimalMoves            [+ nuevos campos calculados]
        │    └── LINTER SEMÁNTICO      [NUEVO — §11]  falla el build ante divergencia
        ▼
src/lib/game/generated/puzzles.generated.ts   ← GENERADO. Nunca se edita a mano.
        ▼
EXERCISES / LABYRINTHS / GENERATED_EXERCISE_DESCRIPTIONS   (lib/game/exercises.ts)
        ▼
exercises-screen.tsx → <Board />   +   exercise-drawer.tsx (títulos)
```

**Regla de oro:** el **tablero (FEN) es la verdad**; el **texto es una promesa**; el **linter verifica
que la promesa se cumpla**. Sin el linter, la divergencia vuelve — porque ya volvió.

---

## 5. FASE A — Corrección pedagógica y estructural (sin motor)

### A0 🔴 — Aplicar los obstáculos de ejercicio en `/exercises` `[BLOQUEANTE DE TODA LA FASE]`

| | |
| --- | --- |
| **Qué** | Pasar los obstáculos del ejercicio activo al `<Board>`, y **renderizarlos en modo `practice`**. |
| **Archivos** | `components/exercises/exercises-screen.tsx:2860` · `components/board.tsx:541-542` (+ `globals.css` para el sprite de pieza propia) |
| **Cómo** | `obstacles={activeExercise.obstacles}` (ya resuelve laberinto **y** ejercicio, línea 2376). En `board.tsx`, la condición `mode === "labyrinth"` deja de gobernar **qué** se dibuja y pasa a gobernar **cómo**: muro en laberinto, **pieza propia** en práctica. |
| **Dependencias** | Ninguna. Es el primer commit. |
| **Riesgo** | 🔴 **Alto pero necesario.** 17 ejercicios se vuelven realmente difíciles de golpe. Es la corrección de un bug, no un cambio de dificultad. |
| **Migración de datos** | **No.** |
| **¿Afecta progreso guardado?** | **Sí, semánticamente.** Quien tenga 3★ en `rook-6` las sacó en un tablero sin obstáculos. **Las estrellas se conservan** (son "mejor histórico") — no se borran. Ver §10.4. |
| **Pruebas** | Unit: `getValidTargets` con obstáculos en `practice`. Component: el rayo se corta en el bloqueador. **Regresión: los 17 ejercicios vuelven a su `optimalMoves` declarado.** VR: el bloqueador se ve. |
| **Aceptación** | Para los 19 ejercicios con obstáculos, **el óptimo jugable == `optimalMoves` del catálogo**. Hoy difieren en 17. |

> **Sin A0, todo lo demás es cosmético.** Se pueden escribir los diez textos más claros del mundo: si
> el tablero no bloquea, *"You cannot jump over your own piece"* es **mentira en pantalla**.

### A1 — Campos pedagógicos explícitos

- **Qué**: `principle`, `title`, `playerPrompt`, `learningObjective` en `content/exercises.json`.
- **Archivos**: `content/exercises.json` · `lib/game/types.ts` (extender `Exercise`) ·
  `lib/game/fen-puzzle.ts` (`PuzzleInput`/`MappedPuzzle`) · `lib/content/catalog.ts`
  (`renderGeneratedModule` → poblar `GENERATED_EXERCISE_DESCRIPTIONS`).
- **Nota**: **el pipeline ya existe** (`explanation` → `objective`, `fen-puzzle.ts:118`). Se decide si
  `playerPrompt` reusa ese canal o entra como campo propio. **Recomendado: campos propios** — `objective`
  está documentado como *authoring-only, NOT user-facing* (`types.ts:43-46`), y mezclarlos borra esa
  distinción.
- **Riesgo**: Bajo. Aditivo.
- **Migración**: No. **Progreso**: No lo toca.
- **Aceptación**: los 10 de torre tienen los 4 campos; `GENERATED_EXERCISE_DESCRIPTIONS` deja de estar vacío.

### A2 — Eliminar los tags `capture` falsos

- **Qué**: quitar `capture` de `rook-4`, `rook-5`, `rook-9` (ninguno tiene nada capturable).
- **Archivos**: `content/exercises.json`.
- **Riesgo**: Nulo. **Nota**: el linter (A8) lo volvería imposible de reintroducir.

### A3 — `rook-3` enseña distancia variable

- **Qué**: hoy `d7→d2` duplica el principio de `rook-2` (columna). Pasa a **`d7→d6`**: una casilla.
- **Riesgo**: Bajo. **⚠️ Progreso**: cambia el significado del ejercicio → **id nuevo** (§10.3).
- **Aceptación**: `optimalMoves === 1` y la distancia es de **una sola casilla**.

### A4 — Reemplazar `rook-5` (duplicado exacto de `rook-4`)

- **Qué**: `rook-5` (`g2→c7`, 2 mov., tablero vacío) es el mismo ejercicio que `rook-4`. Se reemplaza por
  **"The rook is not a bishop"**: `d4→e5`, **tablero vacío**, óptimo **2**.
- **⚠️ Progreso**: contenido pedagógicamente distinto → **id nuevo obligatorio** (§10.3).

### A5 — Recortar obstáculos decorativos

- **Qué**: `rook-6`: **21 → ~6**. `rook-7`: **14 → ~8**. Sólo sobreviven los que tocan la solución.
- **⚠️ Progreso**: **el `optimalMoves` no debe cambiar.** Si al recortar cambia, es contenido nuevo → id nuevo.
- **Aceptación**: mismo `optimalMoves`, mismas rutas óptimas, menos ruido. **Verificado por BFS del importador.**

### A6 — Reordenar

- **Qué**: el orden de §8. **`rook-9` sube al puesto 6**; **`rook-8` baja al 8**; **`rook-7` cierra**.
- **Riesgo**: 🟢 **Nulo para el progreso** — es keyed por `id` (`types.ts:96-102`). Sólo cambia `order`.

### A7 — Matar el fallback `Exercise N`

- **Qué**: con A1 poblado, `resolveExerciseDescription` **nunca** debe caer al fallback.
- **Archivos**: `components/exercises/exercise-drawer.tsx:469-475` · `editorial.ts:1265`.
- **Decisión**: el fallback **se conserva en el código** (es la red de seguridad de una pieza sin curar),
  pero **el linter lo vuelve inalcanzable** para torre (título vacío → build rojo).
- **Aceptación**: test que recorre el catálogo de torre y afirma que ninguna fila renderiza `Exercise \d`.

### A8 — Linter semántico en el importador

→ Detalle completo en §11. **Es el cambio que evita que esta auditoría haya que repetirla.**

### A9 — Render de la pieza propia bloqueadora

- **Qué**: en `practice`, el bloqueador se dibuja como **pieza blanca propia** (decisión n.º 9). En
  laberinto sigue siendo **muro** (decisión n.º 10).
- **Archivos**: `board.ts:541-557` · `globals.css` · arte en `public/art/**`.
- **⚠️ Regla del repo**: reusar assets canónicos antes de crear nuevos; **nunca upscalear**.
- **Riesgo**: 🟠 Toca el laberinto — **no debe cambiarle nada**. VR obligatorio en ambas superficies.

### A10 — Reemplazar `rook-lab-2`

- **Qué**: 34 obstáculos (media tabla) y **1 sola solución** → es un pasillo, no un puzzle.
- **Destino**: se rediseña como **`Dead End`** (nivel 3 de Rook Rails, §9).

### A11 — *Rook Rails* enviable con 4 niveles

- **Qué**: `One Turn`, `Two Turns`, `Dead End`, `Two Roads`. **`Break Through` NO entra** en la Entrega 1.
- **Regla**: no se disfraza el hueco. Cuatro niveles, y el quinto llega con el motor.

---

## 6. FASE B — Infraestructura compartida de captura

**No es un parche de torre.** Es una capacidad de las **piezas de rayo** (rook, bishop, queen), que hoy
comparten la misma función de rayo copiada tres veces.

### Reglas (las del founder, en términos del motor)

1. Pieza **propia** → detiene el rayo; **su casilla NO es legal**.
2. Pieza **enemiga** → detiene el rayo; **su casilla SÍ es legal** (aterrizar = capturar).
3. **Ninguna casilla posterior al primer bloqueo es legal** — sea propio o enemigo.
4. Al aterrizar sobre un enemigo, **el enemigo desaparece**.
5. El estado posterior sigue siendo compatible con BFS, scoring, persistencia y UI.

### 🔴 La consecuencia arquitectónica que hay que ver ahora

> **La captura muta el tablero. Por lo tanto el estado del puzzle deja de ser una casilla y pasa a ser
> `(posición, enemigos restantes)`.**

Esto **rompe el supuesto del BFS actual**, que explora un grafo de casillas (`computeExerciseBfs`).
Después de la captura, el mismo casillero con distintos enemigos vivos **es un estado distinto**.

**Está verificado**, no es teoría: en el ejercicio 8 propuesto, `a1→a4(x)→a6(x)` cuesta **2**
movimientos; si el enemigo de `a4` fuera una pieza propia, el mismo objetivo cuesta **3** (hay que
rodear). **La misma geometría, distinto costo, según lo capturado.** Un BFS de casillas no puede
distinguir esos dos mundos.

### Dónde vive cada cosa

| Capa | Archivo | Cambio |
| --- | --- | --- |
| **Generador de movimientos** | `rules/rook.ts`, `rules/bishop.ts`, `rules/queen.ts` | 🔴 **Núcleo.** Extraer **un solo** `castRay(origin, dirs, friendlies, enemies)`. Las tres piezas pasan a ser *"qué direcciones tengo"*. Hoy la lógica está triplicada. |
| **Capa de tablero** | `board.ts:33-74` | `getValidTargets` recibe `enemies` además de `blockers`; `withoutBlockers` deja de filtrar las casillas enemigas. |
| **Definición del puzzle** | `types.ts` (`Exercise`) | Nuevo `enemies?: BoardPosition[]`, **separado** de `obstacles`. |
| **FEN → puzzle** | `fen-puzzle.ts:99-101` | 🔴 **Levantar el `throw`.** Hoy un FEN de torre con negras **no compila**. Minúscula = enemigo, mayúscula = propia. La convención **ya existe** (el peón la usa). |
| **Estado de ejecución** | `board.tsx` (`useState` del piece) | Nuevo estado: **enemigos vivos**. Hoy sólo vive la pieza. |
| **Resolución del movimiento** | `board.tsx` `onMove` | Si el destino tiene enemigo → quitarlo del estado + emitir el evento de captura. |
| **BFS / importador** | `lib/game/exercise-bfs.ts` | 🔴 **Estado = `(casilla, enemigos vivos)`.** Es el cambio conceptual, no una optimización. |
| **Render** | `board.tsx:541-557`, `globals.css` | Enemigo ≠ pieza propia ≠ muro. **Tres formas distintas, tres reglas distintas.** |

### ¿El modelo actual distingue lo que hace falta?

| Concepto | ¿Existe hoy? |
| --- | --- |
| Pieza propia | ⚠️ **Parcial** — es `obstacles`, pero **se dibuja como muro** y en ejercicios ni se pasa (A0). |
| Pieza enemiga | ❌ **NO existe** para piezas de rayo. `captureTargets` es **exclusivo del peón**. |
| Obstáculo ambiental | ⚠️ **Colisiona con "pieza propia"** — hoy son el mismo campo `obstacles`. |
| Objetivo | ✅ `targetPos`. |
| Casilla capturable | ❌ No, salvo `captureTargets` del peón. |

**Modelo mínimo propuesto** — tres campos, tres semánticas, sin ambigüedad:

```ts
obstacles?: BoardPosition[];   // pieza PROPIA — detiene el rayo, NO aterrizable
enemies?:   BoardPosition[];   // pieza ENEMIGA — detiene el rayo, SÍ aterrizable (captura)
walls?:     BoardPosition[];   // ambiental (Rook Rails) — detiene el rayo, NO aterrizable, NO es ajedrez
```

`obstacles` y `walls` se comportan igual **mecánicamente** y se **dibujan distinto** — y esa separación
es justo la decisión n.º 10 del founder: *el muro ambiental no sustituye una regla de ajedrez dentro de
un ejercicio*. Con un solo campo, esa regla **no se puede expresar**.

---

## 7. Modelo compartido de captura — el corazón de Fase B

```ts
// lib/game/rules/ray.ts — NUEVO. Única fuente de verdad del rayo.
export function castRay(
  origin: BoardPosition,
  directions: ReadonlyArray<[number, number]>,
  friendlies: BoardPosition[],   // obstacles ∪ walls  → bloquean, no aterrizables
  enemies: BoardPosition[],      //                     → bloquean, aterrizables
): RayMove[] {                   // RayMove = BoardPosition & { isCapture: boolean }
  // por dirección: avanzar mientras la casilla esté vacía;
  //   si hay amiga → break SIN push
  //   si hay enemiga → push({ isCapture: true }) y break
}
```

- `getRookMoves`   = `castRay(o, ORTHOGONAL, …)`
- `getBishopMoves` = `castRay(o, DIAGONAL, …)`
- `getQueenMoves`  = `castRay(o, [...ORTHOGONAL, ...DIAGONAL], …)`

**El punto 8 del temario ("no capturar detrás") sale gratis**: es la consecuencia natural del `break`.
No se codifica como regla — **emerge**. Ésa es la señal de que la abstracción es la correcta.

**Riesgo de regresión (alto, y acotado):** las tres piezas cambian de generador a la vez. La red es la
suite actual — **VR 51/51 y 5003 tests** (baseline 2026-07-12) — más las pruebas nuevas de §12.

---

## 8. Secuencia definitiva de 10 ejercicios

| Nº | Título | Principio | Prompt visible | Qué detecta | Óptimo | Acción / origen |
| --: | --- | --- | --- | --- | --: | --- |
| 1 | **Move along the rank** | `rank-movement` | *Reach the star without leaving the rank.* | Confundir fila con columna | 1 | `KEEP` ← `rook-1` (b1→h1) |
| 2 | **Move along the file** | `file-movement` | *Now go straight up the file.* | Idem, eje opuesto | 1 | `KEEP` ← `rook-2` (a2→a8) |
| 3 | **One square is a move too** | `variable-distance` | *A rook can move just one square. Take it.* | Creer que la torre "debe" ir lejos | 1 | **ID NUEVO** ← `rook-3` (d7→**d6**) |
| 4 | **The rook is not a bishop** | `no-diagonal` | *The star is one diagonal step away. The rook needs two moves.* | El error #1 del principiante | 2 | **ID NUEVO** (reemplaza `rook-5`; d4→e5, vacío) |
| 5 | **Turn the corner** | `direction-change` | *Change direction between moves — never inside one.* | Creer que se doblan las L | 2 | `KEEP` ← `rook-4` (g7→b2, quitar tag falso) |
| 6 | **Your own piece blocks the way** | `friendly-blocker` | *You cannot jump over your own piece. Go around it.* | Intentar atravesar una pieza propia | 3 | `KEEP` + `REORDER` ← `rook-9` (a1→c3) |
| 7 | **Capture the first enemy** | `capture-on-line` | *The enemy is on your file. Take it.* | No ver que la torre captura en su línea | 1 | **NUEVO — FASE B** |
| 8 | **You cannot capture behind** | `no-capture-behind` | *Two enemies, one file. Only the first is within reach.* | Creer que se captura "a través" | 2 | **NUEVO — FASE B** |
| 9 | **Find the shortest route** | `route-planning` | *Many roads work. Find the shortest one.* | Conformarse con la primera ruta | 3 | `ADJUST` ← `rook-6` (21 → ~6 obst.) |
| 10 | **Plan the whole route** | `route-planning-advanced` | *Look before you move. Plan all four.* | Falta de planificación | 4 | `ADJUST` + `REORDER` ← `rook-7` (14 → ~8 obst.) |

**Durante la Entrega 1**, los puestos 7 y 8 quedan **vacíos** y la torre envía **8 ejercicios**, no 10
rellenados con paja. `BADGE_THRESHOLD = 10` estrellas (`exercises.ts:28`) se alcanza igual con 8
ejercicios (máx. 24★). **No hay que tocar el badge.**

### Ejercicio 7 — Capture the first enemy `[FASE B]`

| | |
| --- | --- |
| **Enseña** | La torre captura **en la misma línea en que se mueve**, y **se detiene** en la casilla capturada. |
| **Configuración propuesta** | Torre `b1`. Enemigo (negro) en **`b6`**. Nada más en el tablero. |
| **FEN propuesto** | `8/8/1n6/8/8/8/8/1R6 w - - 0 1` — `mover: b1`, `target: b6` |
| **Objetivo visual** | **La pieza enemiga ES el objetivo.** Sin estrella: capturar *es* ganar. |
| **Solución óptima** | **1 movimiento** — `b1 → b6` *(verificado con BFS de captura simulado)* |
| **Error que detecta** | No reconocer la casilla enemiga como destino legal. |
| **Criterio de éxito** | La torre aterriza en `b6`; el enemigo desaparece del tablero. |
| **⚠️ A validar con el motor real** | Que `b6` se **resalte** como destino legal, y que las casillas `b7`/`b8` (**detrás** del enemigo) **NO** se resalten. |

### Ejercicio 8 — You cannot capture behind `[FASE B]`

| | |
| --- | --- |
| **Enseña** | Con dos enemigos alineados, **sólo el primero es alcanzable**. |
| **Configuración propuesta** | Torre `a1`. Enemigos en **`a4`** y **`a6`**. El objetivo es **`a6`** — el de atrás. |
| **FEN propuesto** | `8/8/n7/8/n7/8/8/R7 w - - 0 1` — `mover: a1`, `target: a6` |
| **Objetivo visual** | El enemigo **lejano** marcado como objetivo; el cercano, como enemigo común. |
| **Solución óptima** | **2 movimientos** — `a1 → a4 (captura) → a6 (captura)` *(verificado)* |
| **Error que detecta** | Intentar disparar directo a `a6`. **El tablero se lo niega: `a6` no está entre los 10 destinos legales iniciales.** |
| **Criterio de éxito** | Llegar a `a6`. El camino barato **exige** comerse primero al de adelante. |
| **Por qué es el ejercicio correcto** | **Control medido**: si `a4` fuera pieza **propia**, el mismo objetivo costaría **3** movimientos (hay que rodear: `a1→b1→b6→a6`). Con enemigo cuesta **2**. **La diferencia entre "propia" y "enemiga" es exactamente lo que el ejercicio le hace sentir al jugador.** |
| **⚠️ A validar con el motor real** | Que el BFS del importador dé **2** (necesita estado con captura, §6) y que `a5`/`a6` no se resalten desde `a1`. |

> **Los dos FEN están verificados con un BFS que simula el motor propuesto, no con el motor real —
> porque el motor real todavía no existe.** Al terminar Fase B, **se re-verifican contra
> `computeExerciseBfs`**. Hasta entonces son **propuestas medidas**, no verdad.

---

## 9. Rook Rails definitivo

> **Rook Rails** — *Navigate ranks and files, avoid the blocks, and reach the exit in the fewest moves.*

**Regla de diseño (la que hoy no se respeta):**
> **Un nivel se juzga por sus DECISIONES, no por sus obstáculos.** Si sacar la mitad de los bloqueadores
> no cambia la solución, esa mitad es decoración.

| # | Nivel | Principio | Obst. objetivo | Óptimo | Rutas | Tipo de decisión | Estrellas | Contenido reusable | Motor |
| --: | --- | --- | --: | --: | --: | --- | --- | --- | --- |
| 1 | **One Turn** | Un cambio de dirección | 3–5 | 2 | 1–2 | Reconocer el giro | 3★ = óptimo | **Nuevo** | — |
| 2 | **Two Turns** | Encadenar giros | 5–7 | 3 | 2 | Primera bifurcación falsa | 3★ = óptimo | **Nuevo** | — |
| 3 | **Dead End** | Rutas que no llevan a nada | 8–10 | 4 | 1–2 | **Descartar antes de entrar** | 3★ = óptimo; entrar al callejón cuesta 2★ | `MODIFY` ← **`rook-lab-2`** (34 obst., 1 solución: su pasillo forzado se convierte en el callejón) | — |
| 4 | **Break Through** | 🔴 **Captura que abre el camino** | 8–10 | 4–5 | 1 | **La captura ES la llave** | 3★ = óptimo | **Nuevo** | 🔴 **FASE B** |
| 5 | **Two Roads** | Planificación eficiente | 10–14 | 5 (corta) / 7 (larga) | **2 completas** | **Elegir ruta ANTES de moverse** | **3★ sólo por la corta; la larga completa con 1★** | `KEEP` ← `rook-lab-1` o `rook-lab-3` (ya tienen varias rutas; hay que **desbalancearlas a propósito**) | — |

### `Two Roads` es el nivel que le da sentido al sistema de estrellas

`labyrinthStars` (`exercises.ts:107-112`) puntúa por cercanía al óptimo — **y hoy no mide nada**, porque
en los laberintos actuales todas las rutas óptimas empatan: las estrellas premian **caminar sin
perderse**. Con **dos rutas completas y desbalanceadas** (una de 5, otra de 7), **la misma función pasa
a premiar planificar**. El sistema ya sabe medirlo. **Nadie le dio nada que medir.**

**Entrega 1 sale con 4 niveles** (1, 2, 3, 5). `Break Through` llega con el motor. **No se disfraza.**

---

## 10. Estrategia de IDs y progreso

**Verificado en código** (la auditoría acertó): el progreso es `{ stars: Record<exerciseId, number> }` —
`types.ts:96-102`, `exercise-progress.ts:28-51`. `loadProgress` migra el array posicional legacy y
**descarta los ids que ya no están en el pool**.

### 10.1 — Qué es seguro

- **Reordenar: 100% seguro.** Cambiar `order` no toca el progreso. `currentId` es un id, no un índice.
- **Renombrar título / prompt / tags: seguro.** No son clave de nada.
- **Recortar obstáculos decorativos SIN cambiar `optimalMoves`: seguro.** Mismo puzzle, menos ruido.

### 10.2 — Qué NO es seguro (y la auditoría no lo dijo)

> **Conservar el id no rompe el progreso técnicamente — y aun así puede estar mal.**

Si `rook-3` deja de ser *"movimiento en columna"* y pasa a ser *"distancia variable"*, un jugador con
3★ en `rook-3` **queda con un ejercicio completado que ahora enseña otra cosa — y nunca lo va a ver.**
El progreso no se corrompe: **el aprendizaje se saltea en silencio.** Es peor, porque no se nota.

### 10.3 — Regla de decisión

| Situación | ID | Por qué |
| --- | --- | --- |
| Mismo tablero, texto nuevo | **REUSAR** | Es el mismo ejercicio, ahora explicado. |
| Mismo tablero, obstáculos decorativos recortados, **mismo `optimalMoves`** | **REUSAR** | El puzzle no cambió. |
| **Cambia el principio enseñado** (`rook-3` → distancia variable) | 🔴 **ID NUEVO** | El viejo 3★ certifica otra lección. |
| **Ejercicio reemplazado** (`rook-5` → *"not a bishop"*) | 🔴 **ID NUEVO** | Contenido distinto. |
| Ejercicios nuevos (7, 8) | **ID NUEVO** | Obvio. |
| Cambia `optimalMoves` | 🔴 **ID NUEVO** | Las estrellas viejas se ganaron contra otro baremo. |

**IDs nuevos propuestos** (semánticos, no posicionales — así el orden puede volver a cambiar sin
mentir): `rook-distance-1`, `rook-no-diagonal-1`, `rook-capture-first`, `rook-capture-behind`.
Los ids viejos (`rook-3`, `rook-5`) **desaparecen del pool** → `loadProgress` **ya descarta** las
entradas huérfanas. **Sin migración.**

### 10.4 — El caso incómodo: A0 revaloriza estrellas ya ganadas

Tras A0, quien tenga 3★ en `rook-6` las ganó en un tablero **sin obstáculos**. El ejercicio ahora es
genuinamente más difícil, **y esas estrellas siguen ahí**.

**Recomendación: no tocarlas.** Borrar progreso ganado de buena fe castiga al jugador por un bug
nuestro. El costo es acotado: **el jugador se saltea una lección**; ganarla de nuevo es opcional.
La alternativa (resetear los 17) es un castigo visible por un error invisible.

**⚠️ Decisión del founder** — es producto, no técnica. **Recomiendo conservar.**

### 10.5 — ¿Hace falta versión de contenido?

**No para la Entrega 1.** La disciplina de id-nuevo-cuando-cambia-el-significado (§10.3) hace el trabajo
sin maquinaria. **Sí conviene** cuando lleguen los themes/creadores externos — pero eso es techo, no
ahora (directriz §8).

---

## 11. Linter semántico

Corre en `pnpm import-puzzles` (`lib/content/catalog.ts` ya acumula `errors[]` y `warnings[]`, y el CLI
**ya hace `process.exit(1)`** con errores — `import-puzzles.ts:33-37`). **La maquinaria existe: hay que
darle reglas.**

| # | Validación | Tipo | Severidad |
| --: | --- | --- | --- |
| 1 | `capture` sin pieza capturable en el tablero | **Determinística** | 🔴 **Error** |
| 2 | `friendly-blocker` sin pieza propia bloqueando una línea **relevante** (que esté en alguna ruta óptima) | **Determinística** | 🔴 **Error** |
| 3 | `blocked-file` sin bloqueo en la **columna del mover** | **Determinística** | 🔴 **Error** |
| 4 | `blocked-rank` sin bloqueo en la **fila del mover** | **Determinística** | 🔴 **Error** |
| 5 | `no-diagonal`: el objetivo **no** está en diagonal respecto del origen | **Determinística** (geometría pura) | 🔴 **Error** |
| 6 | `variable-distance` con `optimalMoves !== 1` o distancia > 1 casilla | **Determinística** | 🔴 **Error** |
| 7 | `title`, `playerPrompt` o `learningObjective` vacíos | **Editorial** | 🔴 **Error** — *mata el fallback `Exercise N` de raíz* |
| 8 | Objetivo **inalcanzable** (BFS sin solución) | **Determinística** | 🔴 **Error** |
| 9 | Objetivo **encima de un bloqueador incompatible** (sobre `obstacles` o `walls`) | **Determinística** | 🔴 **Error** |
| 10 | `optimalMoves` desactualizado respecto del BFS | **Determinística** | 🔴 **Error** — *es generado; si diverge, algo se editó a mano* |
| 11 | Captura imposible según el motor (enemigo en pieza sin soporte) | **Determinística** | 🔴 **Error** — *hoy ya lo hace `fen-puzzle.ts:99-101`; en Fase B se **acota** a las piezas sin soporte, no se elimina* |
| 12 | 🔴 **Obstáculos declarados que el runtime no aplica** | **Determinística** | 🔴 **Error** — **el linter que habría cazado A0.** Falla si un ejercicio tiene `obstacles` y su superficie no los pasa al tablero. |
| 13 | El texto promete una acción **no representada** en el tablero (ej. `playerPrompt` dice *"capture"* sin enemigos) | **Heurística** (match de verbos contra la geometría) | 🟠 **Warning** — *no puede ser error: el lenguaje natural no es decidible* |
| 14 | Obstáculo **decorativo** (quitarlo no cambia `optimalMoves` ni las rutas óptimas) | **Heurística** | 🟠 **Warning** — *habría gritado con los 21 de `rook-6`* |
| 15 | Dos ejercicios de la misma pieza con **idéntico principio y dificultad** | **Heurística** | 🟠 **Warning** — *habría cazado el duplicado `rook-4`/`rook-5`* |
| 16 | `tier` incoherente con el óptimo medido | **Heurística** | 🟠 **Warning** |

**Determinístico → error. Heurístico → warning.** Un warning heurístico que bloquee el build entrena al
equipo a apagarlo. **La regla 12 es la más importante del plan**: es la única que impide que el bug de
A0 vuelva a existir.

---

## 12. Matriz de pruebas

### Contenido (unit, sobre el catálogo generado)

| Prueba | Fase |
| --- | --- |
| Orden final == el de §8 | A |
| Los 10 (8 en Entrega 1) tienen `title`, `playerPrompt`, `principle`, `learningObjective` | A |
| **Ningún tag `capture` sin pieza capturable** | A |
| Sin duplicados (mismo principio + misma dificultad) | A |
| `optimalMoves` de cada uno == BFS | A |
| **🔴 Óptimo jugable == `optimalMoves` declarado** (la prueba que falla HOY en 17 ejercicios) | **A0** |
| Todos los objetivos alcanzables | A |
| Obstáculos: ninguno decorativo en el set final | A |

### Motor

| Prueba | Fase |
| --- | --- |
| Pieza propia bloquea; **su casilla NO es destino legal** | A0 / B |
| Enemigo **es** destino legal | B |
| **El rayo termina EN el enemigo** (no lo atraviesa) | B |
| **No se puede capturar detrás** — nada posterior al primer bloqueo es legal | B |
| La captura **actualiza el tablero** (el enemigo desaparece) | B |
| **BFS explora estados post-captura** — `(casilla, enemigos vivos)` | B |
| **Alfil y dama conservan su movimiento** (sin regresión) | B |
| **Torre sin captura: cero regresión** (los 8 ejercicios de Entrega 1 siguen idénticos) | B |
| Obstáculos ambientales (`walls`) siguen funcionando en Rook Rails | A9 / B |

### UI

| Prueba | Fase |
| --- | --- |
| Pieza propia y enemiga se **distinguen visualmente** | A9 / B |
| El jugador **ve** que puede capturar (la casilla enemiga se resalta) | B |
| El objetivo visual **coincide con la consigna** | A |
| **No aparece `Exercise N`** en ninguna fila de torre | A7 |
| Rook Rails muestra ruta, salida y estrellas | A11 |
| **VR**: `/exercises` y Rook Rails, antes y después de A9 | A |

> ⚠️ **VR**: un VR verde puede ser la foto de un error de Next
> (`feedback_vr_green_can_photograph_an_error`). **Mirar los baselines nuevos, no sólo el exit code.**

### Persistencia

| Prueba | Fase |
| --- | --- |
| El progreso existente sobrevive al **reordenamiento** | A6 |
| Los ids retirados (`rook-3`, `rook-5`) **se descartan sin corromper** el resto | A3/A4 |
| El ejercicio reemplazado **no hereda** estrellas del viejo | A4 |
| Retries, óptimo, estrellas y reanudación siguen funcionando | A/B |

---

## 13. Riesgos y mitigaciones

| # | Riesgo | Prob. | Impacto | Mitigación |
| --: | --- | --- | --- | --- |
| 1 | **A0 vuelve difíciles 17 ejercicios de golpe, en 5 piezas** | Alta (por diseño) | 🔴 Alto | Es la **corrección de un bug**, no un rebalanceo. Enviar A0 **solo**, con su propio commit y su regresión. **Si algo se rompe, se sabe qué fue.** |
| 2 | **A0 toca 5 piezas, no sólo torre** | Alta | 🟠 Medio | El fix es transversal por naturaleza. **Correr la suite completa de las 6 piezas**, no sólo torre. |
| 3 | **Fase B cambia el generador de las 3 piezas de rayo a la vez** | Media | 🔴 Alto | `castRay` con tests **antes** de migrar. Migrar **rook → bishop → queen**, un commit por pieza, suite verde entre medio. |
| 4 | El BFS con estado `(casilla, enemigos)` **explota en combinatoria** | Baja | 🟠 Medio | Los puzzles tienen ≤ 4 enemigos → ≤ 16 subconjuntos × 64 casillas = **1024 estados**. Trivial. **Poner un tope y fallar ruidosamente** si se supera. |
| 5 | El sprite de pieza propia **rompe el laberinto** | Media | 🟠 Medio | El muro **no cambia** (decisión n.º 10). VR en **ambas** superficies. |
| 6 | Reusar un id cuyo significado cambió | Media | 🟠 Medio | §10.3 es normativo. Ante la duda: **id nuevo** (es gratis). |
| 7 | Arte del bloqueador no disponible | Media | 🟢 Bajo | Reusar assets canónicos de `public/art/**`. **Nunca upscalear.** Si no hay, **A9 se difiere** — no bloquea A0…A8. |
| 8 | Los FEN de los ejercicios 7/8 no sobreviven al motor real | Baja | 🟢 Bajo | Ya están verificados con BFS simulado; **re-verificar al cerrar Fase B**. El gate lo exige. |

---

## 14. Orden exacto de implementación

### ENTREGA 1 — Ship pedagógico sin captura

| # | Trabajo | Commit |
| --: | --- | --- |
| 1 | **A0 — aplicar los obstáculos en `/exercises`** + regresión de las 6 piezas | `fix(exercises): apply exercise obstacles in practice mode` |
| 2 | **A8 — linter semántico** (reglas determinísticas 1-12) | `feat(content): semantic linter in import-puzzles` |
| 3 | **A2 — quitar los tags `capture` falsos** (el linter ya los rechaza) | `fix(content): drop false capture tags on rook` |
| 4 | **A1 — campos pedagógicos** + poblar descripciones | `feat(content): pedagogical fields for rook` |
| 5 | **A7 — matar el fallback `Exercise N`** | `feat(exercises): surface exercise titles` |
| 6 | **A3 + A4 — `rook-3` a distancia variable; reemplazar `rook-5`** (ids nuevos) | `feat(content): rook distance + no-diagonal exercises` |
| 7 | **A5 — recortar obstáculos decorativos** (`rook-6`, `rook-7`) | `refactor(content): trim decorative obstacles` |
| 8 | **A6 — reordenar** | `feat(content): final rook exercise order` |
| 9 | **A9 — render de pieza propia** en práctica (muro intacto en laberinto) | `feat(board): friendly blocker renders as a piece` |
| 10 | **A10 + A11 — `rook-lab-2` → `Dead End`; Rook Rails con 4 niveles** | `feat(labyrinth): Rook Rails levels 1-3, 5` |

**A0 va primero y va solo.** Es el único commit que cambia la dificultad de 5 piezas; **no se mezcla
con nada.**

### 🚦 GATE 1 → 2

- [ ] Suite verde (**5003+ tests**) y `pnpm exec tsc --noEmit` limpio.
- [ ] **VR verde — y con los baselines nuevos MIRADOS**, no sólo el exit code.
- [ ] **El óptimo jugable == `optimalMoves` en los 19 ejercicios con obstáculos.**
- [ ] **Cero `Exercise N`** en el recorrido de torre.
- [ ] El linter **falla el build** ante un tag `capture` falso (probado a propósito).
- [ ] Rook Rails enviable con 4 niveles.
- [ ] Smoke en viewport móvil (390px).

### ENTREGA 2 — Motor de captura compartido

| # | Trabajo | Commit |
| --: | --- | --- |
| 1 | `lib/game/rules/ray.ts` — `castRay` **con sus tests, antes de migrar nada** | `feat(rules): shared castRay primitive` |
| 2 | Migrar **rook** a `castRay` (sin captura aún) — **cero cambios de comportamiento** | `refactor(rules): rook uses castRay` |
| 3 | Migrar **bishop** y **queen** — cero cambios | `refactor(rules): bishop + queen use castRay` |
| 4 | Modelo de datos: `enemies` / `walls` (`types.ts`, `fen-puzzle.ts`) — **levantar el `throw` de la línea 99** | `feat(content): enemy pieces for ray pieces` |
| 5 | **BFS con estado `(casilla, enemigos vivos)`** | `feat(game): capture-aware BFS` |
| 6 | Captura en el runtime del tablero (estado + render + evento) | `feat(board): capture resolution` |
| 7 | **Ejercicios 7 y 8** + **re-verificar los FEN contra el BFS real** | `feat(content): rook capture exercises` |
| 8 | **`Break Through`** (Rook Rails nivel 4) | `feat(labyrinth): Break Through` |
| 9 | Linter: acotar la regla 11 y activar la validación de captura | `feat(content): capture lint rules` |

### 🚦 GATE 2 → cierre

- [ ] **Alfil y dama: cero regresión** (suite + VR).
- [ ] **Torre sin captura: cero regresión** en los 8 ejercicios de la Entrega 1.
- [ ] Los FEN de los ejercicios 7 y 8 **re-verificados contra `computeExerciseBfs` real** (óptimo 1 y 2).
- [ ] `a6` **no** se resalta desde `a1` en el ejercicio 8 (la lección, probada).
- [ ] Rook Rails completo (5 niveles).
- [ ] Cluster Closure Protocol (CLAUDE.md): issues, README, MEMORY.md, handoff.

---

## 15. Archivos probables

**Contenido**: `apps/web/content/exercises.json` · `apps/web/content/labyrinths.json`

**Motor** *(Fase B, salvo A0)*: `src/lib/game/rules/ray.ts` **(nuevo)** · `rules/rook.ts` ·
`rules/bishop.ts` · `rules/queen.ts` · `src/lib/game/board.ts` · `src/lib/game/exercise-bfs.ts` ·
`src/lib/game/types.ts` · `src/lib/game/fen-puzzle.ts`

**Importador / linter**: `src/lib/content/catalog.ts` · `apps/web/scripts/import-puzzles.ts` ·
`src/lib/game/generated/puzzles.generated.ts` *(generado — nunca a mano)*

**UI**: `src/components/exercises/exercises-screen.tsx` **(A0 — línea 2860)** ·
`src/components/board.tsx` **(A0 + A9 — líneas 541-557)** ·
`src/components/exercises/exercise-drawer.tsx` · `src/lib/content/editorial.ts` ·
`src/app/globals.css` *(único CSS del app)*

---

## 15.5 — 🔴 A5.5 · AUDITORÍA DE FUENTE DE VERDAD (GATE BLOQUEANTE)

**Fecha**: 2026-07-13. **Estado**: auditoría cerrada. **Bloquea A6, A9, A10, A11 y Rook Rails.**
**Verificado contra el código Y contra la base configurada** (12 filas reales leídas).

### 15.5.1 — El veredicto

> ## 🔴 El catálogo de Git NO es lo que consume el jugador.
>
> `/exercises` sirve **baseline ⊕ overlay de Supabase**, y **el overlay gana por `id`**.
> **Hay 12 filas en `content_overlay`, y las 12 colisionan con ids oficiales de torre.**
> **`rook-1` tiene una fila `published`, visible desde CUALQUIER `CONTENT_STAGE` → producción ya sirve
> `rook-1` desde Supabase, no desde Git.**

### 15.5.2 — Flujo de lectura real de `/exercises`

```
app/[locale]/exercises/page.tsx:89
  envStageFloor()               ← env CONTENT_STAGE. null → baseline-only (kill-switch, 0 DB hits)
        │ no-null
        ▼
  getMergedCatalog()            ← unstable_cache, tag "content", TTL 60s
        ▼
  loadMergedCatalog()
    ├── getBaseline()           ← puzzles.generated.ts  (lo que produce import-puzzles desde Git)
    ├── fetchOverlayRows(floor) ← Supabase `content_overlay`, timeout 2s → null = fallback a baseline
    ├── resolveVisibleRows()    ← 1 fila por (kind,id): la de MENOR rank ≥ floor
    └── mergeOverlay()          ← ⚠️ POR ID: la fila del overlay REEMPLAZA la entrada del baseline
        ▼
  <ContentCatalogProvider>      ← se serializa al cliente; ExercisesScreen lee de acá
```

**Entornos (verificado con `vercel env ls`):**

| Entorno | `CONTENT_STAGE` | Overlay |
| --- | --- | --- |
| **Production** | **SETEADO** (desde hace 26 días) | 🔴 **ACTIVO** |
| Preview | ausente | ✅ baseline-only |
| Local (`apps/web/.env`) | **`draft`** | 🔴 **ACTIVO — y con el piso más permisivo: ve las 12 filas** |

### 15.5.3 — Estado real de las filas de torre en Supabase

**12 filas. Ninguna es contenido nuevo: son ediciones del builder sobre los ejercicios oficiales.**
Ninguna tiene `explanation`.

| id | stage | FEN vs Git | order vs Git | Efecto si la fila aplica |
| --- | --- | --- | --- | --- |
| `rook-1` | **published** + draft | igual | igual | 🔴 **borra el título curado**, pierde el prompt |
| `rook-2` | **preview** + draft | 🔴 **DISTINTO** (`g2→g8`, no `a2→a8`) | igual | 🔴 **otro ejercicio** + borra título |
| `rook-3` | draft | — | — | 🔴 **RESUCITA el duplicado retirado en A3** |
| `rook-4` | draft | igual | igual | ✅ **DESCARTADA por el linter** (tag `capture` falso) |
| `rook-5` | draft | — | — | ✅ **DESCARTADA por el linter** (tag `capture` falso) |
| `rook-6` | draft | 🔴 **el board VIEJO de 21 bloqueadores** | 5 → **11** | 🔴 **revierte A5** + reordena |
| `rook-7` | draft | 🔴 **el board VIEJO de 14** | 6 → **10** | 🔴 **revierte A5** + reordena |
| `rook-8` | draft | igual | 7 → **5** | 🔴 reordena |
| `rook-9` | draft | igual | 8 → **6** | ✅ **DESCARTADA por el linter** (tag `capture` falso) |
| `rook-10` | draft | igual | 9 → **7** | 🔴 reordena |

**Hallazgo colateral:** las filas conservan **los tags falsos que A2 eliminó** (`capture` en rook-4/5/9,
`blocked-rank` en rook-6). **El linter semántico de A8 las rechaza y las descarta** — o sea que A8, sin
proponérselo, **ya está protegiendo el runtime**. Pero **el descarte es SILENCIOSO**
(`buildOverlayRow` → `null` → `continue`): nadie se entera de que una fila publicada no llegó.

### 15.5.4 — La matriz de precedencia

| Campo | JSON generado | Supabase | Precedencia actual | Riesgo |
| --- | --- | --- | --- | --- |
| `id` | ✅ | ✅ | **Supabase gana** (mismo id → reemplaza; id nuevo → se agrega) | 🔴 **Colisión accidental: basta insertar `id=rook-1`** |
| `order` | ✅ | ✅ | **Supabase gana** | 🔴 Reordena el recorrido (ya pasa: rook-6 → 11) |
| `fen` / `startPos` / `targetPos` | ✅ | ✅ | **Supabase gana** | 🔴 **Revierte A5** (boards viejos en la DB) |
| `obstacles` | ✅ (derivado del FEN) | ✅ (derivado del FEN) | **Supabase gana** | 🔴 Igual que FEN |
| `enemies` | ❌ (no existe aún) | ❌ | — | 🟠 **Fase B necesitará columna** |
| `principle` | ✅ | ❌ **SIN COLUMNA** | **se pierde** | 🔴 |
| `title` | ✅ | ❌ **SIN COLUMNA** | 🔴 **se BORRA**: `mergeOverlay:145` hace `delete descriptions[id]` cuando la fila no trae `explanation` | 🔴 **El jugador vuelve a la etiqueta i18n vieja — o a `Exercise N` en los ids nuevos, que no tienen entrada i18n** |
| `playerPrompt` | ✅ | ❌ **SIN COLUMNA** | **se pierde** → el prompt desaparece | 🔴 |
| `learningObjective` | ✅ | ❌ **SIN COLUMNA** | **se pierde** | 🟠 |
| `tags` | ✅ | ✅ | **Supabase gana** | 🔴 **Reintroduce los tags falsos** (mitigado: el linter descarta la fila) |
| `optimalMoves` | ✅ (BFS) | ✅ (`optimal_moves`) | **Recalculado y verificado** (`buildOverlayRow:85`) | 🟢 **Trust-but-verify: la única defensa que ya existía** |
| `tier` | ✅ | ✅ | **Supabase gana** | 🟢 Bajo |
| `stage` (estado) | — | ✅ `draft`/`preview`/`published` | Piso por env | 🟠 El piso es un env var: un typo apaga TODO el overlay |

### 15.5.5 — Respuestas a las 19 preguntas (resumen)

1-5. Ver §15.5.2. **Supabase es un OVERLAY por `id` sobre el baseline compilado**, no un fallback y no
un catálogo aparte. **6.** Gana **Supabase**. **7.** **Reemplaza el objeto COMPLETO** (`list[idx] = entry`,
`mergeOverlay:139`) — no hace merge de campos: lo que la tabla no tiene, **se pierde**.
**8.** `id, kind, piece, fen, target, mover, tier, tags, explanation, order, disabled, optimal_moves,
updated_at, stage`. **9.** Eso mismo. **10.** 🔴 **SÍ — y ya lo hizo con los 10 ejercicios de torre.**
**11.** ❌ **NO sobreviven: no hay columnas.** **12.** ✅ **Sí aparecen** (`rook-distance-1`,
`rook-no-diagonal-1` no tienen fila) — **pero en un env con piso `draft`, `rook-3` resucita y el pool
queda con 11 ejercicios.** **13.** 🔴 **Sí** — el `order` de la DB gana. **14.** 12 filas (§15.5.3).
**15.** Producción sirve **`rook-1` desde Supabase**; el resto, desde el baseline (asumiendo piso
`published`, que es el único con fila `published`). **16.** `unstable_cache` (tag `content`, TTL 60s)
+ timeout de 2s + kill-switch por `CONTENT_STAGE`. **17.** 🔴 **SÍ** — `requirePedagogy:false` en
`merged-catalog.ts:79`: **una fila publicada llega al jugador sin `title` ni `playerPrompt`.**
**18.** 🔴 **SÍ.** **19.** Ver §15.5.6.

### 15.5.6 — Impacto sobre los commits ya hechos

| Commit | ¿Llega al jugador? |
| --- | --- |
| **A0** — obstáculos en práctica | 🟢 **SEGURO.** Es código de runtime; el overlay no lo toca. |
| **A2** — tags falsos fuera | 🟢 **SEGURO en el baseline** — y de yapa, el linter **descarta** las filas de la DB que aún los traen. |
| **A8** — linter semántico | 🟢 **SEGURO, y protege el runtime** (descarta 4 filas mentirosas). ⚠️ Silenciosamente. |
| **A1/A7** — pedagogía visible | 🔴 **PARCIALMENTE OCULTO.** Para `rook-1` en **producción**, el título curado **se borra** y el prompt **no existe**. En un env con piso `draft`, se pierde en **6 de 10**. |
| **A3/A4** — ids nuevos | 🟠 **Llegan** — pero con piso `draft` **`rook-3` vuelve** y el pool queda inconsistente. |
| **A5** — recorte de obstáculos | 🔴 **REVERTIDO** en cualquier env con piso `draft`: las filas de `rook-6`/`rook-7` traen **los boards viejos**. |

### 15.5.7 — Arquitectura recomendada

**El diagnóstico de fondo:** el overlay se diseñó como *"deltas sobre el baseline"*, pero **se
implementó como reemplazo total por `id`, sin espacio de nombres**. Una fila del builder y un ejercicio
oficial **compiten por la misma clave** — y gana la fila.

1. **`content/exercises.json` es la fuente de verdad del currículo oficial** (ids, orden, FEN, principio,
   título, prompt, objetivo, tier, tags, óptimos). Pasa por Git, review, importador, BFS y linter.
2. **Supabase guarda lo que NO es oficial**: borradores, contenido del builder, experimentos, comunidad.
3. **Namespacing de ids** — `official:rook-1`, `builder:<uuid>`, `community:<uuid>`. **Una fila NO puede
   ganar por compartir `id` de casualidad.**
4. **`source`**: `"official" | "builder" | "community" | "official-override"`.
5. **El override oficial es EXPLÍCITO**: `{ source: "official-override", baseExerciseId, contentVersion }`
   — y aun así **no debería borrar campos que no puede almacenar**.
6. **Merge por CAMPO, no por objeto**: lo que el overlay no trae, **hereda del baseline**. Hoy
   `list[idx] = entry` pisa todo, y por eso el título curado desaparece.
7. **`publish` valida como el release**: `principle`, `title`, `playerPrompt`, `learningObjective`,
   tablero legal, objetivo alcanzable, obstáculos aplicados, `optimalMoves` por BFS, coherencia
   tags↔geometría, sin colisión no autorizada. **Draft puede estar incompleto; publish no.**
8. **El descarte deja de ser silencioso**: una fila rechazada se loguea y se cuenta.

### 15.5.8 — Migración mínima (lo más barato que destraba el gate)

**Opción A — LIMPIAR (recomendada, 5 minutos, cero código):**
> **Borrar las 12 filas de `content_overlay`.** No son contenido: son ediciones de prueba del builder
> sobre ejercicios que Git ya define mejor. Con la tabla vacía, **el jugador recibe exactamente el
> catálogo de Git** y los seis commits quedan íntegros.
> **Reversible**: el contenido de las filas queda registrado en §15.5.3 y en el probe.

**Opción B — apagar el overlay** (quitar `CONTENT_STAGE` de Production). Destraba igual, pero **apaga el
builder** y deja el problema para después.

**Opción C — arreglar la arquitectura primero** (namespacing + merge por campo + columnas nuevas).
**Es lo correcto a mediano plazo, y NO hace falta para destrabar A6.**

**Recomiendo A ahora + C agendado.** B sólo si el founder quiere el builder congelado.

### 15.5.9 — El GATE

**No se avanza a A6/A9/A10/A11/Rook Rails hasta que se cumpla UNA de estas dos:**

- [ ] **(1) El catálogo de Git es el que consume el jugador** — verificado con `content_overlay` vacía
      (o sin filas que colisionen con ids oficiales), **más una lectura de producción que lo confirme**.
- [ ] **(2) Existe un mecanismo probado de precedencia** que garantice que Git gane sobre las filas
      viejas sin perder datos (namespacing + merge por campo + backfill de las columnas pedagógicas).

**Hoy no se cumple ninguna.**

---

## 16. Preguntas abiertas reales

Sólo quedan **tres**, y las tres son de producto — ninguna bloquea empezar por A0.

1. **🔴 ¿Qué se hace con las estrellas ganadas antes de A0?** 17 ejercicios se completaron en tableros sin
   obstáculos. **Recomiendo conservarlas** (§10.4): borrar progreso ganado de buena fe castiga al jugador
   por un bug nuestro. La alternativa es resetear esos 17. **Es decisión tuya, no mía.**
2. **🟠 A0 arregla torre, alfil, dama y rey a la vez. ¿Se envía el fix completo, o sólo torre?**
   **Recomiendo el fix completo**: el bug es del runtime, no del contenido, y dejarlo a medias significa
   dejar 12 ejercicios rotos a sabiendas. El contenido de las otras piezas se pule después, pieza por
   pieza — pero **el motor no debería mentir en ninguna**.
3. **🟢 ¿El bloqueador propio es arte nuevo o se recolorea una pieza existente?** Afecta al cuello de
   botella conocido (el arte). Si no hay asset, **A9 se difiere sin bloquear nada**.

**Ya NO son preguntas abiertas** (las cerró el founder): si entra la captura (sí), cuántos ejercicios
(10), si hay Rook I/II (no), y si la captura es infraestructura compartida (sí).
