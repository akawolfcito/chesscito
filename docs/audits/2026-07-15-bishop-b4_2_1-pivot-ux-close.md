# Bishop B4.2.1 — Cierre de UX de Pivot Challenge (sin commit)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Alcance:** solo los 3 pendientes de UX del flujo real. Sin B4.3, sin tocar FEN/catálogo/adapter/ejercicios.

---

## 1. Cambios aplicados

### Fix 1 — Prompt visible en el flujo real
- El `playerPrompt` del pivot se surface en el **Mission Detail** (la superficie de instrucción existente:
  `hint = exercisePrompt`), sin tarjeta nueva.
- Derivado de `activePivot` (no de IDs para comportamiento):
  `exercisePrompt = pivotPrompt ?? currentExercise.playerPrompt`.
- Verificado en el flujo real: el sheet muestra *"Tap the square that connects the bishop to the star."*

### Fix 2 — Sin contador de movimientos en modo pivot
- Nuevo prop de presentación `pivotMode` en `MissionPanelCandy` (derivado de `activePivot`, no de IDs).
- `showMoveCounter = labyrinthMode && optimalMoves && !pivotMode` gatea la etiqueta del chip, el
  aria-label y los `data-testid="mission-optimal-moves"` / `data-optimal-moves`.
- En pivot el chip cae al formato de destino → **"Move to g1"** (no "0 / 2 moves", no "2"). `targetLabel`
  del pivot pasa a ser la casilla objetivo, no el contador.

### Fix 3 — Copy ES (seam editorial existente, LOW)
- **No** se construyó subsistema nuevo. Se usó el i18n existente (`editorial.ts` EN → bundle `en.ts`;
  `messages/es.ts` ES) añadiendo un namespace `PIVOT_COPY` con `title`/`prompt` **keyed por id (solo copy)**.
- Resolución en la capa de presentación: `tPivot(\`title.${activePivot.id}\`)` / `\`prompt.${id}\``.
  El chip usa `labyrinthTitle = pivotTitle ?? activeLabyrinth?.title`.
- ES aprobado cableado: El conector / Dos conexiones / Conexión bloqueada + los tres prompts.
- **Comportamiento actual de otros Special Trainings en ES:** los títulos de labyrinth son **EN-only**
  (vienen del contenido, sin ruta i18n). Los pivots quedan **por delante** (localizados), sin tocar labs.

## 2. Archivos modificados adicionales (B4.2.1)

- `src/lib/content/editorial.ts` — `PIVOT_COPY` (EN source)
- `src/lib/content/messages/es.ts` — `PIVOT_COPY` (ES)
- `src/components/exercises/exercises-screen.tsx` — `tPivot`, `pivotTitle`/`pivotPrompt`, ramas pivot de `targetLabel`/`pieceHint`, props `exercisePrompt`/`labyrinthTitle`/`pivotMode`
- `src/components/exercises/mission-panel-candy.tsx` — prop `pivotMode` + `showMoveCounter`
- `e2e/pivot-real-flow.spec.ts` — **nuevo** E2E del flujo productivo (5 tests)

## 3. Validación en el flujo REAL (no probe)

Sembrando progreso (`chesscito:progress:bishop` 9★/3 ejercicios + `labyrinth-best` de pivots 1–2) y
entrando por el drawer de Special Training (`/en/exercises?piece=bishop` → "Exercises" → "Labyrinth N"):

- **Prompt visible:** ✅ Mission detail muestra el prompt del pivot.
- **Sin contador "0/2 moves":** ✅ el chip muestra "Move to g1/g3/f4"; `mission-optimal-moves` ausente.
- **Título/alfil/estrella/blocker/ruta:** ✅ `data-labyrinth-title` = título localizado; estrella en el
  target; **Blocked Connection dibuja el caballo amigo en d6** (`is-friendly-blocker`), **sin muro**
  (`is-wall` count 0); tocar el conector completa (→ "Labyrinth Solved!").
- **ES:** ✅ `/es` → "Laberinto 1" → `data-labyrinth-title="El conector"`.
- **Viewport MiniPay (390×844):** ✅ capturas en scratchpad (`pivot-real-L1/L3` + `L1-prompt`).

**E2E:** `pivot-real-flow.spec.ts` **5/5** (3 niveles: sin contador + título + estrella + completa;
prompt visible; ES localiza). `pivot-spike.spec.ts` (probe, Board canónico) **6/6**.

## 4. Validaciones

- Unit impactadas (`src/lib/content` + `src/components/exercises`): **331/331** (33 files).
- `tsc --noEmit` → limpio. · `git diff --check` → exit 0.

## 5. Cosméticos remanentes (aceptados esta fase — pivot va por el canal labyrinth)

- El chip de misión dice **"Move to g1"** (formato destino, sin contador). No es una métrica nueva; es el
  formato de ejercicio existente. Fiel a "ocultar el contador, no sustituir por nueva métrica".
- Las etiquetas **"Now: Labyrinth N"** / **"EXIT LABYRINTH"** / overlay **"Labyrinth Solved!"** dicen
  "Labyrinth" porque el pivot se proyecta como nodo labyrinth (adapter aprobado, no se toca). Renombrarlas
  a "Pivot/Special Training" requeriría copy condicional — fuera de alcance de B4.2.1.

## 6. Veredicto

### 🟢 READY FOR VISUAL APPROVAL

Los tres pendientes cerrados y validados en el **flujo productivo real** (no solo la probe): prompt
visible, contador de movimientos oculto, y copy ES por el seam i18n existente (LOW, keyed por id solo para
copy). Sin commit. bishop-lab-3/-4 intactos. B4.3 no iniciado.

**Restricciones respetadas:** sin B4.3 · sin borrar labs · sin `TrainingNodeKind` pivot · sin cambiar el
adapter de navegación · sin framework de i18n · sin commit.

**Fin de B4.2.1.**
