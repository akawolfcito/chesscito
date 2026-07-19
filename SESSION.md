# Session Handoff — 2026-07-18

> Decí **"continuemos"** y el agente lee este archivo y sigue.

## Completed
- **[ commit 74c97f6a ] feat(badge): gate on 80% exercise completion, not stars**
  - `BADGE_THRESHOLD` (10★) eliminada. Nuevo en `lib/game/exercises.ts`:
    `BADGE_COMPLETION_RATIO=0.8`, `badgeRequiredCount`, `isBadgeEarned`, `completedExerciseCount`.
  - Migradas TODAS las superficies del gate: hook `use-exercise-progress`, `exercise-drawer`
    (barra plotea ejercicios, no estrellas; hint "Badge at {count} exercises"), `badge-sheet`,
    celebración del último ejercicio, milestone machine (`pieceRequiredExercises`), `training/path`
    (nueva `UnlockRule {type:"completion"}`), Hub reward tiles (`completedPerPiece` en `use-hub-data`).
  - Estrellas = métrica de recompensa/desempate (NO se tocan). Decisión founder 2026-07-17.
- **[ commit 4232e628 ] docs(readme): sync lane-2 signature games (6/6) + badge gate.**
- **Cluster Closure carril-2 (6/6):** README sync · branches limpias (`main`+`production`) ·
  sin issues del cluster que cerrar (#104 Treasure Hunt = futuro en M14) · handoffs ya existían.
- **VR re-corrido:** 58/58. La única roja (`hub-shop-sheet-open`) es la conocida (env sin treasury,
  ya roja en `main`). **El gate nuevo NO rompió snapshots.**
- **Overlay TRY AGAIN verificado RESUELTO** para las 6 piezas (mecanismo general `holdForTap`).

## Current State
- **Branch**: main (HEAD = `4232e628`). Commits `74c97f6a` + `4232e628` en `main` — confirmar push a origin.
- **Build**: passing — suite **5484 passing / 466 files**, `tsc` limpio.
- **Uncommitted work**: `SESSION.md` (este handoff). Memoria actualizada
  (`project_badge_gate_is_completion`, `feedback_exercise_ids_are_not_sequential`, current_state, MEMORY.md).

## Next Tasks
1. **🎨 PRÓXIMO FRENTE (founder, 2026-07-18): construir el THEME BUILDER.**
   Es el editor del marketplace de temas creado por usuarios → `[[project_theme_marketplace_vision]]`
   (se juzga por su techo, NO es tooling interno). Arrancar con **spec** (skill `/spec`): enumerar
   estados de UI, superficies del tablero que un tema pinta (ver `globals.css` clases `.playhub-board-*`
   y `project_board_geometry`), y el modelo de persistencia/distribución.
2. Confirmar **push** de los 2 commits a `origin/main` (el founder verifica el deploy visualmente).
3. **Backlog sin agenda** (founder): afinar niveles rey/peón con Zones on · maestría rota
   (`queen-lab-*` → `queens-*`, igual alfil/caballo) · debounce de queens si hay stutter.

## Blockers
- None.

## Notes
- ⚠️ **Ids de ejercicios NO secuenciales** (rook: `rook-distance-1`/`rook-no-diagonal-1`, sin
  `rook-3`/`rook-5`). Fixtures hand-written deben usar ids reales; `seedProgress` (posicional) y
  `countCompleted` (map crudo) son seguros. Ver `feedback_exercise_ids_are_not_sequential`.
- `/api/sign-badge` sigue firmando sin chequear el gate (client-only) — server-verified progress abierto.
- Alternativa al theme builder si el founder cambia de idea: **duelo asíncrono por enlace** (~2-3 días).
  (Ojo: "etapa 10" NO es un frente — era la última etapa de la Promotion Run, ya cerrada. Borrada.)
