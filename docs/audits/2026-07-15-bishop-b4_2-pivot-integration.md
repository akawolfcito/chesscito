# Bishop B4.2 — Integración productiva de Pivot Challenge (sin commit)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Diseño:** `2026-07-15-bishop-b4_1-*` + decisión de nav (canal labyrinth / adapter).
**Estado:** implementado, validado, **sin commit**. Pendiente de revisión visual del flujo real.

---

## 1. Arquitectura entregada (según la decisión aprobada)

- `kind:"pivot"` es un tipo de contenido real → **bucket runtime separado `GENERATED_PIVOTS`**
  (nunca aparece en `GENERATED_LABYRINTHS`).
- Se **proyecta** en `buildTrainingPath` como nodo `labyrinth` vía un **adapter** en la pantalla
  (`specialTrainingCatalog`), reutilizando navegación/unlock/mission-sheet/autoavance/progreso/completado
  **sin** añadir `TrainingNodeKind="pivot"` y **sin** tocar los 9 consumidores de `path.ts`.
- Detección de modo pivot **por lookup de catálogo** (`pivotCatalog[piece].some(id===active)`), no por
  Set de IDs ni prefijo.
- Connectors **derivados en runtime** (`isConnectingPivot`), nunca almacenados.

## 2. Archivos modificados / nuevos

**Nuevos:**
- `src/lib/game/pivot-challenge.ts` (helper puro, promovido) + `__tests__/pivot-challenge.test.ts` (8)
- `src/lib/content/__tests__/pivot-lint.test.ts` (4)
- `src/components/dev/pivot-challenge-spike.tsx` (probe, usa el Board **canónico** en modo pivot)
- `src/app/dev/pivot-spike/page.tsx` · `e2e/pivot-spike.spec.ts` (6 tests)

**Modificados (13, +274/−19):**
- `content/labyrinths.json` — 3 filas `kind:"pivot"` (The Connector / Two Connections / Blocked Connection)
- `fen-puzzle.ts` — unión `kind` +`"pivot"`
- `content/catalog.ts` — bucket `pivots`, ruteo, gate de caballo para pivot, **lint pivot** (opt=2, mismo color, ≥1 connector), emite `GENERATED_PIVOTS`
- `content/baseline-write.ts` — `KindedRecord` usa `Omit<…,"kind">` (colisión de ejes `kind`)
- `game/exercises.ts` — export `PIVOTS`
- `content/catalog-context.tsx` — `pivots?` + `usePivotCatalog()`
- `content/merged-catalog.ts` + `overlay-types.ts` — `pivots` en baseline/merged (pass-through)
- `app/[locale]/exercises/page.tsx` — pasa `pivots` al provider
- `components/board.tsx` — **modo `"pivot"`** (intercepta tap → valida connector → anima start→connector→target → `onMove(target,2)`; drag desactivado; blocker se dibuja como caballo, sin muro)
- `components/exercises/exercises-screen.tsx` — adapter `specialTrainingCatalog` + `activePivot` + rama de modo del Board
- `generated/puzzles.generated.ts` — regenerado (`GENERATED_PIVOTS`)
- 1 test: mock de generated +`GENERATED_PIVOTS`

## 3. Diff resumido

3 niveles (todos `optimalMoves 2`), bucket separado, proyección labyrinth, modo del Board aditivo
(default sin cambios para todo caller existente). El alfil, al tener pivots, **surfacea los 3 pivots y
oculta** bishop-lab-3/-4 (siguen en contenido, no seleccionados). Otras piezas: idénticas.

## 4. Validaciones (comandos corridos)

- **Unit pivot:** `isConnectingPivot` (8) + lint pivot (4) → **12/12**.
- **Suites impactadas** (`content`, `game`, `training`, `components/exercises`): **1008/1008** (67 files).
- **E2E** `pivot-spike.spec.ts` (Board canónico, minipay): **6/6** — L1 conector correcto/incorrecto, L2 elegir conector, L3 conector bloqueado no completa + conector abierto sí.
- **Revisión visual mobile (390px):** los 3 niveles renderizan en el Board canónico; alfil/estrella
  correctos; Blocked Connection dibuja el **caballo amigo** en d6 (no muro); estado resuelto anima
  a1→d4→g1 y muestra "Solved ★★★". (Capturas en scratchpad.)
- **TypeScript** `tsc --noEmit` → limpio. · **`git diff --check`** → exit 0.

## 5. Impactos no previstos / items para la revisión antes de commit

1. **⚠️ Prompt no visible en el flujo REAL.** `playerPrompt` solo se surfacea para `currentExercise`
   (ejercicio normal), no para labyrinth/pivot. En el probe se muestra; en la nav real de Special
   Training **falta** surfacear el prompt del pivot ("Tap the square that connects…"). Pequeño pero
   necesario para que el nivel sea jugable sin instrucción. **Pendiente.**
2. **⚠️ Copy EN/ES no movido a i18n.** Títulos/prompts viven en el contenido (EN), igual que los
   labyrinths — el canal labyrinth **no tiene** hoy una ruta ES para su copy. Añadir ES para pivots sería
   un subsistema nuevo (aplicaría a todos los labyrinths). **No hecho** — se reporta como desvío del paso 7.
3. **HUD de movimientos cosmético.** El chip "X / Y moves" del mission panel muestra 0/2 en pivot (no se
   cuentan taps). Cosmético; ocultarlo en modo pivot es un ajuste menor.
4. **Warning de generación** esperado: The Connector reusa la posición de bishop-4 → "duplicate position"
   (warning cross-kind, no error). Aceptado por diseño.

## 6. Esfuerzo real y kill criteria

- **Esfuerzo: MEDIUM.** 13 archivos, cambios aditivos; sin refactor de `path.ts` ni general de
  ExercisesScreen; un solo board productivo (el canónico).
- **Kill criteria: NINGUNO activado.** No multi-target · no motor de rutas nuevo · no refactor general ·
  no framework · no segundo board productivo · dentro de MEDIUM · L2/L3 aportan decisión (elegir entre
  conectores / descartar el bloqueado) — se sienten distintos a un ejercicio.

## 7. Estado y siguiente paso

- **Sin commit.** bishop-lab-3/-4 conservados (ocultos, no borrados/renumerados).
- Antes de commit (revisión reservada por el usuario): (a) surfacear el prompt del pivot en el flujo real,
  (b) decidir el tratamiento de copy ES, (c) revisar visualmente el flujo real de Special Training del
  alfil (requiere sembrar 6★ para desbloquear el primer nodo).
- **B4.3 (currículo) NO iniciado** — como se indicó, me detengo tras integrar los tres Pivot Challenges.

**Fin de B4.2. Sin commit.**
