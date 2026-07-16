# Bishop D1 — Diagonal Run: delta + contrato técnico (read-only)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Estado:** commit `5c8b447` **deshecho** (soft reset, reflog lo conserva); working tree intacto y staged.
El **currículo de 9 ejercicios queda** — solo cambia el contrato del Special Training del alfil.
**Alcance:** solo D1 (diseño). Sin editar producción. Sin commit.

Nuevo juego: **Diagonal Run / Carrera diagonal** — "Guía al alfil de diagonal en diagonal hasta la
estrella." Control por turnos: elegir dirección → deslizar 1 movimiento → repetir. Supera "Pivot Challenge".

---

## 1. Delta exacto vs working tree actual

### CONSERVAR (sin cambios)

- **Currículo alfil (B4.3):** `content/exercises.json` (bishop), `lint.ts` CURATED, descripciones
  EN/ES del alfil, `bishop-pedagogy.test`, `bishop-rules.test`, `bishop-nine-exercises-smoke`,
  y los 4 tests reajustados (generated-merge/rotation/pool-mastery/badge-sheet).
- **Infra Special Training reutilizable:** el mecanismo de bucket en `catalog.ts`, `catalog-context`,
  `merged-catalog`, `overlay-types`, el **adapter** `specialTrainingCatalog` en `exercises-screen`,
  el **render canónico del Board**, la i18n genérica "Special Training", el **drawer por títulos**
  (`labyrinthLabels`), y `mission-panel-candy` / `mission-detail-sheet` (props genéricos).
- **Labs históricos:** `bishop-lab-3` / `bishop-lab-4` en `labyrinths.json` — no borrar.

### MODIFICAR (renombrar/repurpose pivot → diagonal-run)

- `kind:"pivot"` → **`kind:"diagonal-run"`** (`fen-puzzle` union, ruteo en `catalog.ts`, filas en `labyrinths.json`).
- `GENERATED_PIVOTS`→`GENERATED_DIAGONAL_RUN`; `PIVOTS`→`DIAGONAL_RUN`; `usePivotCatalog`→`useDiagonalRunCatalog`;
  `pivotCatalog`/`activePivot`/`pivotMode` → equivalentes diagonal-run.
- **Board:** `mode:"pivot"` → `mode:"glide"`, **interacción reescrita** (glide por turno, no auto-ruta de 1 tap).
- **Lint:** reemplazar el gate `optimalMoves===2` por lint diagonal-run (solvable bajo glide BFS, mismo
  color, blockers = caballos amigos). `pivot-lint.test` → `diagonal-run-lint.test`.
- **Copy:** PIVOT_COPY + "Connector/Connections" → copy Diagonal Run.

### REEMPLAZAR / RETIRAR

- **`isConnectingPivot` + `pivot-challenge.ts`** → **`getBishopGlideDestination` + `glideBfs`** en nuevo
  módulo puro `diagonal-run.ts`. `pivot-challenge.test` → `diagonal-run.test`.
- **Restricción `optimalMoves===2`** → fuera (glide usa su propio óptimo).
- **Los 3 niveles opt=2** (`bishop-pivot-1/2/3`): **RETIRAR** — no funcionan bajo glide (bishop-4/5:
  el target es **inalcanzable deslizando** en tablero casi vacío; el alfil rebota esquina-a-esquina).
- **Interacción auto-ejecución** del Board (tap connector → start→connector→target): **RETIRAR**.
- **Probe/E2E pivot** (`dev/pivot-spike`, `pivot-spike.spec`, `pivot-real-flow.spec`, `pivot-challenge-spike`):
  **REEMPLAZAR** por los de diagonal-run.

### EVALUAR — nombre del `kind`

**Opción A elegida: renombrar a `kind:"diagonal-run"` ahora.** Semánticamente correcto; evita dejar
`pivot` como deuda engañosa; no crea framework genérico. (B = mantener "pivot" interno → deuda; C =
tipo genérico → sobrealcance.)

---

## 2. Contrato de interacción final

| Fase | Comportamiento |
|---|---|
| Entrada | alfil tamaño normal, **sin** seleccionar, sin dots. Banda: "Ayuda al alfil a llegar a la estrella." + "Toca el alfil para comenzar." |
| Tap en casilla antes de seleccionar | no mueve; "Primero toca tu alfil." |
| Seleccionar alfil | zoom/escala de selección de los ejercicios normales + casilla iluminada; banda → "Elige una dirección diagonal." |
| Tap dirección legal (cualquier casilla de una diagonal legal) | marcador temporal (spark reforzado) 250–500 ms → **glide** hasta el punto de parada → cuenta 1 movimiento; el alfil **queda seleccionado**; repetir |
| Tap ilegal (no diagonal / sin hueco en esa dirección) | no mueve; feedback + "The bishop cannot move there." / "El alfil no puede moverse hasta ahí." |
| Llega a la estrella | completa; "¡Encontraste el camino!" |
| Estado insoluble (recalc tras cada glide) | fade/portal simple + "This path cannot reach the star. Try again." → reinicia el nivel |
| Sparks | **L1 tutorial:** auto-mostrar un spark por dirección diagonal legal al seleccionar. **L2+:** solo vía el sistema de hints existente (o diferir si no hay seam pequeño). |

Sin botón de confirmar, sin marcar toda la ruta, sin rechazar direcciones legales subóptimas.

## 3. Regla de glide (pura, determinista)

`getBishopGlideDestination(pos, chosen, blockers, target) → square | null`

1. `df=chosen.f-pos.f, dr=chosen.r-pos.r`. Si `df===0` o `|df|≠|dr|` → **null** (no es diagonal → ilegal).
2. dir `= (sign(df), sign(dr))`. Primer paso `pos+dir`: si off-board o blocker → **null** (dirección sin hueco → ilegal).
3. Avanzar en dir desde `pos`: parar cuando el **siguiente** paso sea off-board o blocker, o cuando la
   casilla actual sea la **estrella**. Devolver esa casilla. Nunca aterriza sobre el blocker ni lo atraviesa.

Cada glide = **1 movimiento**. No se puede parar en una casilla intermedia.

## 4. BFS / optimalMoves (semántica glide)

- **estado** = posición del alfil. **sucesores** = las ≤4 destinos de glide (uno por dirección legal).
- **transición** = 1 movimiento. `glideBfs(start,target,blockers)` → `optimalMoves` + set alcanzable.
- **insoluble** = target fuera del set alcanzable desde la posición actual.
- **NO reutilizar** el `optimalMoves` del alfil normal (difiere: en glide el alfil no para a media diagonal).
  Módulo pequeño y específico, sin motor genérico. (Prototipo validado en scratchpad.)

## 5. Estrategia de estrellas

- **Reutilizar `labyrinthStars(moves, optimal)`** (ya compartida, ya en el flujo `handleLabyrinthMove`).
  ⚠️ Su escala (opt→3, opt+2→2, opt+4→1) es **más indulgente** que la propuesta (opt→3, opt+1→2, opt+2→1).
  **Recomendación: reusar `labyrinthStars`** (menor deuda, consistencia con laberintos) en vez de crear una escala nueva.
- **Reinicio por insoluble:** menor deuda = reusar el patrón de laberinto (**retry libre**, se guarda el
  mejor). El reinicio ya penaliza (rehacer movimientos); no añadir contador de errores nuevo. El óptimo
  se mide sobre la corrida exitosa. (Alternativa −1 estrella queda documentada, no elegida.)

## 6. Nivel propuesto para el spike (validado por glide BFS)

```
start: a1   target: g1   blocker: e5 (caballo amigo)   glide opt: 2
```

- a1 (oscura) → g1 (oscura), mismo color. Un blocker (e5), necesario.
- **Turno 1 forzado (tutorial):** a1 solo tiene NE con hueco → glide a **d4** (para antes de e5). L1 muestra
  el spark en esa dirección.
- **Turno 2 (decisión real, 3 direcciones desde d4):**
  - **SE → g1** = estrella (óptimo, opt 2). ✅
  - **SW → a1** = vuelve al inicio (subóptimo **recuperable**).
  - **NW → a7** = se aleja (recuperable, pero el juego persistentemente malo llega a estados **insolubles**
    del grafo — demuestra el path de "camino perdido").
- Un solo tablero demuestra: glide, control por turno, subóptimo-recuperable **y** el path insoluble.

## 7. Archivos previstos (D2 spike, en `/dev`)

- **Nuevos:** `src/lib/game/diagonal-run.ts` (glide + BFS) · `src/lib/game/__tests__/diagonal-run.test.ts` ·
  `src/components/dev/diagonal-run-spike.tsx` · `src/app/dev/diagonal-run/page.tsx` ·
  `e2e/diagonal-run-spike.spec.ts` · banda de misión compacta (dev-scoped primero).
- **Board:** añadir `mode:"glide"` (selección → elegir dirección → marcador → glide → repetir; recalc insoluble).
- **No se toca** `exercises.json` ni ExercisesScreen en el spike (integración real = D3).

## 8. Riesgos

- Glide contradice parcialmente el movimiento libre de los ejercicios (el alfil **no** para a media
  diagonal) → mitigar con banda de misión + sparks + marcador (que la decisión se vea).
- Un target no-borde en tablero casi vacío es **inalcanzable** por glide → todo nivel debe validarse con
  glide BFS (blockers/edge crean los puntos de parada).
- La banda de misión compacta full-width es UI nueva → solo para el modo del alfil en el spike, evaluar en 390×844 antes de generalizar.

## 9. Esfuerzo real

**MEDIUM** para el spike de 1 nivel en `/dev`: módulo puro + BFS pequeño + `mode:"glide"` del Board +
selección/marcador/banda + path insoluble + tests. Sin multi-target, sin motor genérico, sin refactor de
ExercisesScreen, sin segundo board productivo (reusa el render canónico).

## 10. Kill criteria — ninguno disparado en D1

Motor genérico ❌ · multi-target ❌ · refactor ExercisesScreen ❌ · segundo board productivo ❌ · óptimo
computable con BFS pequeño ✅ (validado) · supera MEDIUM ❌.

---

## VEREDICTO: 🟢 READY FOR DIAGONAL-RUN SPIKE

Renombrar pivot→diagonal-run (Opción A), reemplazar la validación de conector por el glide puro + BFS,
reutilizar `labyrinthStars`, y construir **un** nivel en `/dev` (a1→g1, blocker e5, glide opt 2) que
demuestra glide + turnos + subóptimo-recuperable + insoluble. **Detente para aprobación antes de D2.**
Sin commit; currículo de 9 ejercicios preservado; labs históricos intactos.
