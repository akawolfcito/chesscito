# Bishop D3 — Diagonal Run: graduación productiva (sin commit)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Alcance:** integrar Diagonal Run en el Special Training real del alfil, renombrando el tipo pivot y
retirando la experiencia anterior. Sin commit. **Sin tocar:** currículo de 9 ejercicios, Rook Rails,
otras piezas, ni borrar bishop-lab-3/-4.

---

## 1. Qué se hizo

- **Renombre `kind:"pivot"` → `kind:"diagonal-run"`** en todo el pipeline: `fen-puzzle` (unión),
  `catalog.ts` (bucket `diagonalRun`, ruteo, gate de caballo), `exercises.ts` (`DIAGONAL_RUN`),
  `catalog-context` (`useDiagonalRunCatalog`), `merged-catalog`, `overlay-types`, `exercises/page`.
  Bucket runtime `GENERATED_DIAGONAL_RUN`.
- **Lint nuevo** (D1): reemplaza `optimalMoves===2` + `isConnectingPivot` por
  **`pivotBfs(start,target,blockers).reachable`** + mismo color + blockers = caballos amigos. El
  `optimalMoves` generado se **sobrescribe con el óptimo de pivote** (no el BFS de alfil libre).
- **3 niveles** (validados por `pivotBfs`, con decisión real en el inicio):
  - `bishop-run-1` "First Pivot" — a1→g1, N@e5, **opt 1** (pivote d4).
  - `bishop-run-2` "Turn to the Star" — a1→f2, N@e3, **opt 2**.
  - `bishop-run-3` "The Long Run" — a1→b8, N@c7, **opt 2**.
- **Componente productivo `DiagonalRunBoard`** (turn-based): reusa `<GameBoard>` + geometría + CSS
  `.is-selected` (mismo zoom), copy vía i18n `DIAGONAL_RUN_COPY`, incluye el tooltip anclado a la pieza y
  la banda compacta. `ExercisesScreen` lo renderiza en lugar de `<Board>` cuando el nodo activo es
  diagonal-run; completado vía el ledger de laberinto (`handleLabyrinthMove` → best + overlay).
- **i18n `DIAGONAL_RUN_COPY`** (EN/ES): 3 títulos + prompts + strings de banda.
- **Retirada de lo pivot:** `mode:"pivot"` del Board, `pivot-challenge.ts`/`isConnectingPivot`, el probe
  `/dev/pivot-spike`, y los tests/E2E pivot. Copy genérica "Special Training" (B4.2.2) intacta.
- **Labs históricos** bishop-lab-3/-4: conservados en contenido, ocultos de la nav (el adapter usa el
  bucket diagonal-run para el alfil).

## 2. Archivos

**Nuevos:** `components/exercises/diagonal-run-board.tsx` (producción) · `lib/game/diagonal-run.ts` +
`__tests__/diagonal-run.test.ts` · `components/dev/diagonal-run-spike.tsx` + `app/dev/diagonal-run/page.tsx`
(probe) · `e2e/diagonal-run-spike.spec.ts` · `e2e/diagonal-run-real-flow.spec.ts`.
**Modificados:** `content/labyrinths.json`, `fen-puzzle.ts`, `catalog.ts`, `exercises.ts`,
`catalog-context.tsx`, `merged-catalog.ts`, `overlay-types.ts`, `app/[locale]/exercises/page.tsx`,
`generated/puzzles.generated.ts`, `editorial.ts`, `messages/es.ts`, `exercises-screen.tsx`,
`mission-panel-candy.tsx`, `board.tsx`, `resolve-exercise-description.test.ts`.
**Eliminados:** `pivot-challenge.ts`, `pivot-challenge.test.ts`, `pivot-lint.test.ts`,
`components/dev/pivot-challenge-spike.tsx`, `app/dev/pivot-spike/`, `e2e/pivot-spike.spec.ts`,
`e2e/pivot-real-flow.spec.ts`.

## 3. Validaciones

- **E2E (minipay):** `diagonal-run-real-flow` **2/2** (flujo productivo: seleccionar → tap pivote d4 →
  captura → "Training Complete!"; ES localiza "Primer pivote") · `diagonal-run-spike` **7/7** ·
  `rook-rails-shots` **5/5** (regresión intacta) · `bishop-nine-exercises-smoke` **9/9** (currículo intacto).
- **Unit COMPLETO: 5136/5136** (434 files).
- `tsc --noEmit` → limpio. · `git diff --check` → exit 0.

## 4. Validación visual (flujo real 390×844)

Chrome completo (header, chip "Move to g1", EXIT TRAINING, dock) + banda "Choose a pivot square." + alfil
a1 seleccionado con **3 sparks** (b2/c3/d4), caballo e5, estrella g1. (Nota: el shot de dev mostró el
overlay "1 error" de Next porque ese spec no suprime errores; el E2E real —que sí lo hace— pasa en verde.
Ruido del app-shell en dev, no del juego; a verificar en la revisión.)

## 5. Kill criteria — ninguno disparado

Multi-target ❌ · motor genérico ❌ · refactor general de ExercisesScreen ❌ (adapter + swap de board
puntual) · **segundo board productivo ❌** (DiagonalRunBoard reusa `<GameBoard>`; el spike es dev-only) ·
óptimo con BFS pequeño ✅.

## 6. Veredicto

### 🟢 DONE (sin commit)

Diagonal Run integrado en el Special Training real del alfil (3 niveles), con el tipo `diagonal-run` limpio
(sin deuda "pivot"), la experiencia pivot retirada, i18n/progreso/E2E actualizados, y currículo/Rook
Rails/labs intactos. Pendiente de tu revisión visual del flujo real antes de decidir el commit final.

**Pendiente para el commit (cuando apruebes):** este trabajo D3 reemplaza al bloque pivot dentro del
commit único aprobado antes (`feat: stabilize bishop training`, que fue deshecho); el commit final incluirá
currículo (B4.3) + Diagonal Run (D1-D3) juntos.
