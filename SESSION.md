# Session Handoff — 2026-07-16

> Decí **"continuemos"** y el agente lee este archivo y sigue.

## Completed

- **Knight's Tour — el juego firma del caballo, end to end** (merge `aa323e99`, 8 commits atómicos).
  Módulo puro · grader de cobertura · ledger propio · catálogo · 3 niveles · board · host · i18n
  EN/ES · probe `/dev/knight-tour` · e2e. **Detalle: `docs/plans/2026-07-16-knight-tour-plan.md`.**
- **Fix (`162ea1ae`)**: el drawer mostraba el título del tour **en inglés a jugadores ES**
  (`specialTrainingLabels` no ruteaba los tours por i18n). Invisible: la fila tenía título, en el
  idioma equivocado.
- **Regla derogada (`ad95b7a4`)**: la verificación de deploys **NO es tarea del agente**.
  Reescrita en `CLAUDE.md` §"Verificación de deploys" — estaba codificada en el repo y cada
  sesión la heredaba.
- **Plan de N-Queens escrito (`26434aa5`)**: `docs/plans/2026-07-16-n-queens-plan.md`.

## Current State

- **Branch**: `main`, sincronizado con `origin/main`.
- **Build**: vitest **5172/5172 (439 files)** · `tsc --noEmit` limpio · e2e del tour **8/8**
  (`--project=minipay`).
- **Uncommitted work**: no. Árbol limpio, sin PRs abiertos.

## Next Tasks

1. **N-Queens (`kind: "queens"`)** — spec §2 (`docs/specs/2026-07-16-signature-games-spec.md`).
   **Leer `docs/plans/2026-07-16-n-queens-plan.md` PRIMERO**: tiene el modelo de datos derivado,
   los stages y el refactor que pide. ⚠️ **Tiene una pregunta abierta para el founder — hacerla
   antes de codear** (ver Blockers).
2. **Safe Path (rey) + Promotion Run (peón)** — spec §3/§4. **JUNTOS, nunca separados**: comparten
   la cirugía `{pos, piece}` + capa de ataque (plan §15.6.3). **No son los baratos.**
3. **Maestría** — el founder la maneja "en su momento" (ver Notes).

## Blockers

- ⚠️ **Pregunta abierta para el founder, ANTES de codear N-Queens**: ¿los bloques rompen los rayos
  de la dama para "abrir posibilidades" (spec §2, última línea)? El código dice que sí
  (`getQueenMoves` ya corta en bloqueadores) y es ajedrecísticamente correcto, pero **cambia por
  completo el diseño de niveles y el techo**.
- **`contextual-header.spec.ts` falla 6/6 — PREEXISTENTE**, no es regresión (su `bypassFirstVisit`
  no setea `chesscito:hub-tour:v1`).
- **VR `hub-shop-sheet-open` roja también en `main`** (env sin treasury). No perseguir.
- ⚠️ **`hub-clean` VR pasa cambios sin verlos** (`maxDiffPixelRatio: 0.005` ≈ 12k píxeles).

## Notes

- 📌 **Los deploys los verifica el founder, visualmente. NO hacerlo por iniciativa propia** →
  `CLAUDE.md` §"Verificación de deploys".
- 📌 **El carril 2 NO es "laberintos": es el juego lúdico, uno por pieza** (aclaración del founder,
  2026-07-16). Para la torre *resulta ser* un laberinto porque ese es su juego (curado, con
  título). Los laberintos genéricos **sin título** de peón/dama/rey son **relleno ocupando el
  slot** hasta que llegue su juego — no son un carril. Los 5 del caballo eran eso, y el tour los
  reemplazó: el slot se llenó, no se perdió nada. → [[project_signature_games_per_piece]]
- ⚠️ **Un juego de cobertura NO puede usar el carril de laberinto para calificar** — `labyrinthStars`
  queda **ciega** (3★ a todo) y `recordLabyrinthBest` se **invierte** (la peor corrida pisa la mejor).
  Ambos fijados con test. → [[feedback_same_shape_number_wrong_meaning]]
- ⚠️ **Techo ≠ alcanzable**: el techo del tour es una cota superior (BFS), por eso sus niveles se
  filtraron con Warnsdorff. **El de N-Queens SÍ es exacto** (backtracking 8×8) → derivar N del
  solver, nunca autorearlo. → [[feedback_reachable_is_not_achievable]]
- **Maestría, medido y diferido**: un jugador que ya completó `knight-lab-1..5` y reclamó el badge
  **pierde la maestría** (`complete` → `available`), porque exige el pool actual (los 3 tours) y
  están sin jugar. Le habría pasado igual al alfil con los pivotes. **El founder lo maneja después.**
- **Deuda**: el probe de Diagonal Run forkeó el board en un spike copiado
  (`components/dev/diagonal-run-spike.tsx`) — dos implementaciones de las mismas reglas sin nada que
  las sincronice. El probe del tour renderiza el board REAL para no repetirlo.
- **Deuda**: 4 duplicados de ejercicios (`docs/audits/2026-07-16-exercise-redundancy-audit.md`) —
  ediciones de tablero para el builder, no trabajo de motor.
- Regenerar catálogo: `pnpm -C apps/web import-puzzles`; después `rm -rf apps/web/.next`.
  Regenerarlo **NO** invalida el `unstable_cache` tag `"content"`; un build fresco sí.
- El founder pule niveles en `/dev/labyrinth-builder`. **Construir la mecánica, no perfeccionar niveles.**
