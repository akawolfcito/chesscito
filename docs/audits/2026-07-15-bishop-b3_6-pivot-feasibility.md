# Bishop B3.6 — Factibilidad y contrato mínimo de Pivot Challenge (read-only)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Entradas:** B0, B1, B2, B3, B3.5 del alfil.
**Alcance:** solo factibilidad. No se implementa, no se diseñan FEN, no se toca contenido.

**Corrección de identidad (adoptada):** el juego enseña
**"encontrar la casilla que conecta las diagonales correctas"**, no solo "girar". El pivote es un
*medio*; la identidad es la **casilla-conector**.

---

## 1. Contrato de interacción (loop mínimo)

Buscando el loop más pequeño posible:

| Paso | Definición mínima |
|---|---|
| Al comenzar ve | tablero con el alfil en `start` y una **meta marcada** en `target`; prompt: "Toca la casilla donde el alfil cambia de diagonal para llegar a la estrella" |
| Casillas seleccionables | **una** casilla (tap directo del pivote candidato). NO se mueve el alfil hasta él en el loop mínimo |
| ¿Selecciona pivote o mueve? | **selecciona el pivote directamente** (1 tap). Mover-hasta-él es una versión más cara, no necesaria para probar la mecánica |
| Validación | ¿la casilla ∈ conjunto de **pivotes-conector correctos** (derivado por BFS en runtime)? |
| Feedback acierto | resaltar el pivote y **animar la ruta `start→pivote→target`** como recompensa visual |
| Feedback fallo | shake/rojo en la casilla, permitir reintento (sin "fail" duro) |
| ¿Ejecutar ruta tras acertar? | sí, pero **como animación automática**, no como segunda fase de input |
| Nivel completado | al tocar **un** pivote correcto |
| Estrellas / intentos | mínimo: **acierto al primer intento → 3★**, con reintentos restando (o binario solved/no en el spike). Reutiliza `labyrinthStars`-style, no requiere esquema nuevo |

**Loop mínimo = 1 tap → validar → animar → completar.** Sin fase de movimiento libre.

---

## 2. Definición técnica de "pivote correcto"

Para una ruta `start → p1 → p2 → … → target`, el pivote es el punto donde **cambia la diagonal**.
`firstStep` **NO** siempre es el pivote: en rutas de ≥3 movimientos el primer salto puede ser una
**aproximación** por la misma diagonal, y el giro ocurre después.

**Solución de alcance: restringir intencionalmente los niveles a rutas de 2 movimientos**
`start → pivote → target`. En ese caso, y solo en ese caso:

- El pivote = la casilla de aterrizaje del **único** movimiento intermedio = `firstStep`. Sin ambigüedad.
- **Conjunto de pivotes correctos** = `{ P : P ∈ bishopMoves(start) ∧ target ∈ bishopMoves(P) ∧ P≠start ∧ P≠target ∧ (start,P,target no son colineales en una diagonal) }`. La cláusula de no-colinealidad garantiza un **cambio real de diagonal** (una casilla-conector), no un deslizamiento recto.
- **Múltiples rutas óptimas** = múltiples P en el conjunto (p.ej. dos pivotes simétricos). Se aceptan **todos**.
- **Pivotes válidos subóptimos** = **no existen** cuando `opt=2` (2 es el mínimo). Todo lo demás es un
  tap incorrecto → material de distractor gratis (casillas alcanzables en 1 salto que no conectan al target).
- **Caso "primer movimiento = aproximación, no pivote"** = queda **fuera por construcción** al fijar `opt=2`.

Esto evita lógica nueva de rutas: el conjunto de pivotes se computa con `bishopMoves` (ya existente),
sin motor nuevo. **Los 3 niveles pueden y deben restringirse a `opt=2`.**

---

## 3. Mapa de reutilización

**Reutilizable SIN cambios:**

| Activo | Evidencia |
|---|---|
| GameBoard / render / hit-grid | `components/board.tsx`; el layer labyrinth ya lo monta |
| Selección de casillas (tap) | mismo hit-grid de casillas |
| Blockers (render amigo, no capturable) | B2; `exercise-obstacles.test.tsx` |
| BFS + `bishopMoves` (deriva pivotes) | `exercise-bfs.ts`, `rules/bishop.ts` |
| Progreso por ID (index-independiente) | B2; `readPieceStars` |
| Mission panel | `mission-panel-candy.tsx` (ya tiene props de labyrinth) |
| Navegación de Special Training | `labyrinthMode` + `onLabyrinthSelect` + training-path nodes ya existen |
| Overlay de completado + cálculo de estrellas | `LabyrinthCompleteOverlay`, `labyrinthStars` |

**Requiere cambio/nuevo (pequeño):**

| Área | Cambio |
|---|---|
| Estado de preselección | un `selectedPivot` (o validar-en-tap sin estado persistente) |
| Validación | `isConnectingPivot(start, target, square, blockers)` sobre `bishopMoves` |
| Feedback | acierto (animar ruta) / fallo (shake) — copy nuevo + 1 string i18n |
| Rendering | una **rama** en el handler de tap: modo-pivote valida en vez de mover |
| Persistencia | reusa progreso id-keyed / labyrinth ledger (marcar solved) |
| Analytics | 1 evento (`pivot_select` acierto/fallo) |
| E2E | 1 test del loop tap→validar→completar |
| Tipo de contenido | **ninguno** para el spike (pivotes derivados en runtime); opcional flag mínimo si gradúa |

---

## 4. Encaje en el modelo actual

| Opción | Deuda | Veredicto |
|---|---|---|
| A. Variante de Labyrinth | media — mezcla semántica "contar movimientos" con "elegir pivote" en el mismo record | no |
| B. Variante de Exercise | media — contamina el pool de ejercicios/estrellas | no |
| C. Tipo mínimo nuevo de Special Training (`kind:"pivot"`) | baja-media — limpio, pero exige tocar catálogo/generación | **sí, al graduar** |
| **D. Solo config de UI, sin modelo nuevo** | **mínima** — reusa un record de Special Training para `start/target/obstacles` y **deriva los pivotes en runtime** vía BFS; una rama de UI | **sí, para el SPIKE** |

**Recomendación:** **spike con Opción D** (UI-only, pivotes derivados en runtime, reusando la navegación
y el record de Special Training). Si sobrevive, promover a **Opción C** (un `kind` mínimo). **No** construir
una abstracción genérica de minijuegos para caballo/dama/rey/peón todavía.

---

## 5. Evaluación de activos existentes (bajo la restricción `opt=2`)

| Asset | opt | ¿`start→pivote→target` exacto? | pivotes correctos | ¿subóptimos? | ¿se siente como el ejercicio? | candidato |
|---|---|---|---|---|---|---|
| bishop-4 (a1→g1) | 2 | **sí** | {d4} (1) | no | medio (mitigable con 1-tap + prompt distinto) | **L1** |
| bishop-5 (c3→g3) | 2 | **sí** | {e5, e1} (2) | no | medio | **L2** |
| bishop-6 (b2→f2) | 3 | **no** (dos giros; pivote único d4 bloqueado) | — | — | — | **descartar** (para pivote) |
| bishop-7 (c3→g3) | 3 | **no** (ambos pivotes bloqueados → sin ruta de 2) | — | — | — | **descartar** |
| bishop-lab-3 (c1→h6) | 3 | **no** (dos giros) | — | — | — | **descartar para pivote** (sirve al maze, no a esto) |

**Corrección a B3.5:** solo **bishop-4 y bishop-5** son assets de pivote válidos. bishop-6/7 y **lab-3**
NO se expresan como una sola casilla-conector (son opt-3, dos giros). Por lo tanto **L3 "The blocked turn"
NO puede reusar bishop-6/7**: requeriría una posición nueva de `opt=2` (p.ej. dos pivotes con **uno
bloqueado**, tipo bishop-5 + blocker en e5, dejando e1 como único conector) — diseño diferido, no en el spike.

---

## 6. Vertical mínima (UN nivel)

| Campo | Definición |
|---|---|
| Posición preferida | **bishop-4** (a1→g1, pivote conector = **d4**) — el caso de un solo conector, el más limpio |
| Interacción exacta | tablero con alfil en a1 + meta en g1; prompt "Toca la casilla que conecta las dos diagonales hacia la estrella"; 1 tap; validar ∈ {d4}; acierto → animar a1→d4→g1 + completar; fallo → shake + reintento |
| Criterio de éxito | tocar un pivote-conector correcto |
| Estado mínimo | validación-en-tap (sin estado persistente nuevo); reutiliza el estado de completado del layer Special Training |
| Archivos que probablemente cambian | `exercises-screen.tsx` (rama modo-pivote en el handler de tap), un componente/handler chico de PivotChallenge, copy + 1 string i18n (`editorial.ts`/messages), 1 evento analytics, 1 E2E |
| Tests mínimos | unit `isConnectingPivot` (acepta d4, rechaza no-conectores); E2E tap d4 → completa; E2E tap incorrecto → no completa |
| Estimación | **LOW–MEDIUM** |
| Riesgos | (a) reusar bishop-4 verbatim se siente como el ejercicio → mitigar con prompt/1-tap distinto y la animación-recompensa; (b) `ExercisesScreen` ya es grande → mantener la rama **mínima**, no refactor; (c) 1-tap puede sentirse trivial/quiz → la ejecución animada de la ruta da el payoff lúdico |

---

## 7. Kill criteria — abandonar Pivot Challenge y volver a formato existente si:

- requiere **multi-target**;
- requiere un **motor de rutas nuevo** (algo más que `bishopMoves`/BFS actual);
- exige **refactor general** de `ExercisesScreen`;
- requiere un **framework compartido de minijuegos**;
- **no se distingue perceptiblemente** de un ejercicio normal;
- la vertical mínima **supera alcance MEDIUM**.

Si se dispara cualquiera → **USE EXISTING FORMAT** (reutilizar bishop-lab-3 como Special Training tradicional).

---

## 8. Comparación final

| | Pivot Challenge (1-level spike) | Reusar bishop-lab-3 como Special Training tradicional |
|---|---|---|
| Esfuerzo | LOW–MEDIUM | **LOW** (ya funciona como labyrinth; solo copy + registro) |
| Cierra el alfil rápido | casi tan rápido | **el más rápido** |
| Identidad propia | **alta** ("la casilla-conector") | baja (maze genérico; B3.5: se siente ejercicio largo) |
| Enseña el principio reformulado | **sí** | no directamente (lab-3 es opt-3 sin pivote único) |
| Deuda futura | mínima (Opción D) | ninguna, pero sin identidad |

**Lectura:** lab-3 cierra **más rápido** pero **pierde identidad**. El spike de Pivot Challenge cierra
**casi igual de rápido conservando identidad** y enseña la casilla-conector. Con los criterios de decisión
(identidad primero), gana el spike; lab-3 queda como **fallback** si el spike supera MEDIUM (kill → USE EXISTING FORMAT).

---

## 9. VEREDICTO

### 🟢 READY FOR ONE-LEVEL SPIKE

Pivot Challenge es factible como **vertical mínima** con **Opción D** (UI-only, pivotes derivados en
runtime), reutilizando board + BFS + navegación de Special Training + progreso id-keyed, **sin multi-target,
sin motor de rutas nuevo y sin framework de minijuegos**, restringiendo los niveles a rutas de `opt=2`
(`start→pivote→target`).

**Autorizado:** UN nivel de prueba (bishop-4 / pivote d4).
**NO autorizado:** los tres niveles, ni un tipo de contenido nuevo, ni tocar el motor.
Si el spike dispara cualquier kill criterion → replegar a bishop-lab-3 (USE EXISTING FORMAT).

**Fin de B3.6. Sin implementar.**
