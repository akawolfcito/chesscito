# Graphify — mapa motor + flujo de ejercicios

**Fecha**: 2026-07-14
**Corridas**: `apps/web/src/lib/game` (64 arch) + `apps/web/src/components/exercises` (40 arch),
fusionadas en un solo grafo rooteado en `apps/web/src`.
**Grafo**: 515 nodos · 1033 edges · 35 comunidades · **code-only (AST, 0 tokens LLM)**.
**Salidas**: `graphify-out/graph.html`, `GRAPH_REPORT.md`, `graph.json` (gitignored, commit `211cc3d`).

> Nota de método: graphify es **filtro**, no diseñador. Lo de abajo son hechos estructurales
> (imports/calls por AST). Las lecturas de producto están marcadas como tales.

---

## 1. Módulos centrales (god nodes, por grado)

| # | Nodo | Edges | Rol |
|---|------|-------|-----|
| 1 | `PieceId` | 26 | Tipo raíz; cruza 9 comunidades (catálogo, arena, board, progreso, FEN, BFS, laberinto). |
| 2 | `EXERCISES` | 20 | Catálogo central consumido por el flujo analizado; hoy forma parte de la fuente oficial mantenida en Git. |
| 3 | `Exercise` | 17 | Tipo del ejercicio; lo consume BFS, board y screen. |
| 4 | `ExercisesScreen()` | 16 | **Orquestador de UI** — ver §3. |
| 5 | `BoardPosition` | 15 | Tipo de coordenada; base de board/BFS/FEN. |
| 6 | `getValidTargets()` | 14 | **Choke-point de reglas** — ver §2. |
| 7 | `LABYRINTHS` | 12 | Catálogo de laberintos (Rook Rails). |
| 8 | `sq()` | 12 | Constructor de posición (notation DSL); puente entre comunidades. |
| 9 | `getVisibleExercisesForToday()` | 10 | Rotación diaria. |
| 10 | `PLAYABLE_PIECES` | 9 | Las seis piezas jugables. |

**Bridges de alta intermediación** (betweenness): `sq()` (0.107), `GameBoard()` (0.095),
`PieceId` (0.086). Son los cuellos que conectan subsistemas: tocarlos propaga lejos.

---

## 2. Dependencias: BFS · obstáculos · captura · objetivos múltiples

**Todo converge en una sola función:** `getValidTargets(piece, position, blockers, isCapture,
captureTargets, targetPos)` en `lib/game/board.ts:33`. Es el único punto por donde pasan las
cuatro mecánicas.

```
ExercisesScreen()  ──calls──►  getValidTargets()  ◄──calls──  computeExerciseBfs()
        │                            │                         computeExerciseBfsPath()
        └──calls──► computeExerciseBfs()                             (exercise-bfs.ts)
                                     │
        getValidTargets() ──calls──► getRook/Bishop/Knight/Pawn/Queen/KingMoves()

defineLabyrinth() ──calls──► validateObstacles() ──calls──► posToString()   (notation.ts)
```

- **BFS**: `exercise-bfs.ts` importa `getValidTargets` y lo usa como función de expansión.
  `computeExerciseBfs()` (primer paso + conteo) y `computeExerciseBfsPath()` (ruta completa por
  parent-tracking) leen `exercise.obstacles`, `exercise.isCapture`, `exercise.captureTargets`
  y los reenvían a `getValidTargets` (`exercise-bfs.ts:44-69, 105-115`).
- **Obstáculos**: parámetro `blockers` de `getValidTargets`; regla "no aterrizar en obstáculo"
  en `board.ts:72`. Validación de autoría en `notation.validateObstacles()`.
- **Captura**: `isCapture` + `captureTargets` allowlist; unión `captureTargets ∪ targetPos`
  para peón (`board.ts:52-65`).
- **Objetivos múltiples**: modelados como `captureTargets: BoardPosition[]` (allowlist de
  varias casillas), no como multi-goal real. `targetPos` sigue siendo único.

**Implicación estructural**: cualquiera que instancie el tablero debe pasar `obstacles`/`isCapture`/
`captureTargets` **a mano** — el grafo no fuerza esa correspondencia. Esa costura manual explica el
origen histórico de A0 y el riesgo residual de una regresión similar (§4).

---

## 3. Ciclos y acoplamientos sospechosos

- **Ciclos**: **no se detectaron ciclos dentro del corpus analizado** (`simple_cycles` = 0 sobre
  el subgrafo de imports/calls de los dos paths escaneados). No implica que el monorepo completo
  esté validado — solo `lib/game` + `components/exercises`.
- **`ExercisesScreen()` = god component.** 16 dependencias salientes cruzando 6 comunidades:
  board (`getValidTargets`, `getPositionLabel`), BFS (`computeExerciseBfs`, `key`), context-action,
  progreso (`getMaxPossibleStars`), laberinto (`getLabyrinthBest`, `recordLabyrinthBest`,
  `areAllLabyrinthsSolved`), save-flow (`claimWelcomePackageGift`, `shouldShowWPCtaInSlot`),
  mission-briefing. Es el punto de mayor concentración de riesgo: la lógica de negocio del
  ejercicio vive en el componente, no en el motor. *(lectura de producto: candidato #1 a extraer
  un hook/servicio.)*
- **Colisión de nombres reales** (no bug, sí trampa cognitiva): `readMap()`, `storageKey()`,
  `PIECES`, `PieceKey`, `key()`, `CatalogItem` existen duplicados en varios módulos. El grafo los
  mantiene separados por id, pero al editar es fácil tocar el equivocado.
- 47 nodos débilmente conectados (`INJECTED`, `BASE`, `PIECES_WITH_LABYRINTHS`…): posibles
  huecos de edge o constantes aisladas; ruido, no deuda.

---

## 4. ¿Cambia alguna decisión del plan actual?

**No. Graphify no descubrió ningún bug nuevo.** El grafo solo **confirma estructuralmente la causa
del antiguo A0** — un defecto que **ya está resuelto en el runtime actual**.

### 4.1 Estado actual (verificado)

- El bug A0 de obstáculos en `/exercises` **ya fue corregido**.
- Los ejercicios normales **ya pasan sus obstáculos correctamente**.
- Los blockers **se renderizan como piezas** en practice.
- Los **10 ejercicios de torre** se verificaron mediante smoke tests repetidos.

A0 **no es trabajo pendiente ni el siguiente paso**; queda registrado aquí solo como el defecto
histórico que la topología ayuda a explicar.

### 4.2 Qué confirma la topología (histórico A0)

1. **`getValidTargets` es el único choke-point** de obstáculos (§2). Si un caller no le pasa
   `blockers`, la mecánica desaparece silenciosamente — no hay segundo camino que la recupere.
   Eso explica por qué A0 se manifestó a partir de un único sitio de binding.
2. **`ExercisesScreen()` es un god component** (§3) que llama `getValidTargets` directo, sin pasar
   por el motor. Ese acoplamiento es lo que permitió que el argumento se perdiera en un solo lugar.
3. El motor (`computeExerciseBfs`) **sí** reenvía `exercise.obstacles` bien (`exercise-bfs.ts:44`):
   confirma que el defecto vivía en el binding de UI, no en las reglas.

### 4.3 Riesgo residual (regresión, no bug activo)

El defecto funcional fue corregido, pero la topología explica **por qué ocurrió y dónde permanece el
riesgo de regresión**: el binding de `obstacles`, `isCapture`, `captureTargets` y `targetPos` sigue
**construyéndose a mano** en la costura entre **contenido** (catálogo/laberinto), **motor**
(`getValidTargets` / BFS) y **UI** (`ExercisesScreen`). Nada en el grafo fuerza esa correspondencia,
así que un caller futuro podría volver a omitir uno de esos argumentos.

### 4.4 Mejora futura (no bloqueante, no ahora)

Como defensa contra regresiones —**no como trabajo inmediato**— se podría centralizar ese binding en
un adapter/helper único que produzca las reglas de tablero de forma uniforme. Conceptualmente:

```ts
getExerciseBoardRules({
  exercise,
  labyrinth,
}) => {
  blockers,
  isCapture,
  captureTargets,
  targetPos,
}
```

Así habría **un solo lugar** donde se derivan esos cuatro valores, y ningún caller (UI o motor)
podría volver a omitir uno. **No implementar este adapter ahora. No abrir un refactor completo de
`ExercisesScreen()`.**

### 4.5 Conclusión

- Este reporte **no cambia el plan actual**.
- **No bloquea Rook Rails.**
- **No requiere cambios de producto ahora.**
- El siguiente trabajo sigue siendo **diseñar y validar el tablero corto `Two Turns`** para cerrar
  Rook Rails.

En una frase: **el defecto funcional (A0) fue corregido; la topología solo explica por qué ocurrió y
dónde permanece el riesgo de regresión.**
