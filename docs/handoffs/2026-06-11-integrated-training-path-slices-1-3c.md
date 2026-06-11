# Handoff — Integrated Training Path, Slices 1–3C

**Date**: 2026-06-11
**Branch**: `main` (clean) — HEAD `15d4811a`
**Spec**: `docs/specs/integrated-training-path.md` + red-team (verdict READY, all 3 P0 gates closed)
**Suite**: 3575/3575 · tsc clean · VR 3/3 green

## 1. Resumen ejecutivo

Exercises + Labyrinths ya son UNA senda por pieza, no dos tabs:

- `TrainingNode` view-model **puro y derivado** (`apps/web/src/lib/training/path.ts`):
  exercise → labyrinth → badge → mastery. Cero storage nuevo, cero migración.
- Path UI dentro de `MissionDetailSheet`: chips de ejercicios, filas de laberinto,
  grupo Milestones separado (Badge/Mastery con su propia regla — red-team P0-3).
- **Nodos de laberinto interactivos**: tap en nodo unlocked → entra a labyrinthMode
  con ESE laberinto. Los 18 laberintos del catálogo son alcanzables por UI
  cuando cumplen unlock (antes solo se jugaba el índice 0: 12 dormidos).
- `labyrinthList[0]` eliminado; el gate viejo de 10★ también.
- Unlock nuevo: **primer lab a 6★** (`LABYRINTH_UNLOCK_THRESHOLD`), siguientes por
  completion (≥1★) del anterior en orden de path (optimalMoves asc, tie-break catálogo).
- **Badge intacto a 10★** (stars de ejercicios solamente). Mastery = badge claimed +
  todos los labs ≥1★ (presentacional; guest nunca "mastered").
- Toggle EXERCISES/LABYRINTHS removido; única salida mid-run = pill
  "Back to exercises" visible solo en labyrinthMode (la otra salida es el
  overlay de completion, mismo `handleExitLabyrinth`).

## 2. Commits incluidos (en orden)

| Commit | Qué |
|---|---|
| `87ffd040` | docs(specs): spec + red-team |
| `93b6629b` | Slice 1 — path core (`buildTrainingPath`, `getPieceMastery`, 16 tests) |
| `c664afbb` | chore: comentario stale BADGE_THRESHOLD |
| `a7e13910` | test(vr): refresh hub-clean (drift pre-existente flag chip `f29b4c39`) |
| `fb59311b` | Slice 2 — TrainingPathRail read-only + copy EN/ES + 8 tests |
| `ab634b25` | Slice 2 — wiring sheet/panel/screen (memo + props opcionales) |
| `6f7318a5` | Slice 3A — BFS solvability verifier (18/18) + helper `test-utils/bfs-optimal.ts` |
| `aa2929a7` | docs: inventario corregido (18 labs, 12 dormidos) |
| `d15ae275` | Slice 3B — `useRotationSteering` con `suspended` (P0-2; el effect inline NO chequeaba labyrinthMode) |
| `c2eb6b25` | Slice 3C — nodos tappables en el rail + 5 tests (incl. knight-lab-3 dormido) |
| `64b09421` | Slice 3C — selección por node tap, kill `labyrinthList[0]`, exit pill |
| `15d4811a` | test(vr): refresh hub-clean (shift intencional: franja del toggle removida) |

## 3. Garantías técnicas

- Sin migración de datos; localStorage formats intactos
  (`chesscito:progress:{piece}`, `chesscito:labyrinth-best:{piece}`).
- Sin storage nuevo: el path se deriva en un `useMemo`.
- Sin cambios a SaveScore, Get Peones, Coach, Victory, contracts, payment rail.
- **Sin Peones earn de laberintos todavía** (Slice 4).
- Rotation engine intacto (flag off por default); steering extraído a
  `useRotationSteering` y **suspendido mientras labyrinthMode está activo** —
  8 tests fijan legacy + guards.
- Thresholds solo se AFLOJAN (labs 10★→6★): nadie pierde progreso.
- Cero referencias huérfanas a `labyrinthAvailable` / `onToggleLabyrinth`.

## 4. QA / tests

- BFS verifier: **18/18 laberintos** alcanzables con `optimalMoves` === mínimo BFS
  exacto; techo 1★ (`optimal+4`) verificado; los 12 dormidos cubiertos por CI;
  inventory guard en 18 (un lab nuevo sin verifier rompe la suite).
- Suite **3575/3575** (baseline de sesión 3519 → +56 en el cluster).
- TypeScript limpio; eslint limpio en archivos tocados.
- VR 3/3 (hub-clean, hub-daily-tactic-open, hub-shop-sheet-open); hub-clean
  refrescado 2 veces con rationale (drift pre-existente + shift intencional).
- Screenshots 390px validados: labs locked / "Labyrinth 1 READY" /
  board activo con back-pill. Sin overflow horizontal, sin carousel.

## 5. UX actual

- Mission sheet (tap en el peek de misión) → "Training path": chips de stars por
  ejercicio, filas de laberinto con estados locked ("Unlocks at 6★" /
  "Beat previous lab"), READY pill, o stars si complete.
- Milestones aparte: "Badge at 10★" / "Badge ready" / "Connect to claim" (guest)
  y "Mastery — Badge + labyrinths". Un badge claimable sobre labs locked no
  parece un salto roto.
- En labyrinthMode: chip de moves en el peek + pill "Back to exercises".
- Copy EN/ES completo, sin em-dashes (gate anti-AI-prose).

## 6. Riesgos / follow-ups

- **MissionBriefing sobre laberinto**: al entrar a un lab, el briefing first-visit
  reaparece con label raro ("Move your Rook to 0 / 3 moves"). Pre-existente,
  recién visible. Candidato a fix antes o durante Slice 5.
- **Slice 4 pendiente**: earn `labyrinth_completion` +1 Peón primera completion
  (`bestBefore == null`), daily-capped, idempotency
  `labyrinth_completion:{piece}:{labyrinthId}` (red-team P1 economy-cap +
  first-completion-race ya especifican los guards).
- **Slice 5 pendiente**: mastery crown en piece selector + telemetría
  `training.path_*` (contrato estilo `monetization.*`).
- Hint / Deep Hint dentro de laberintos: fuera de scope (bloque Deep Hint).
- P1 guest-mastery-flicker (badgeClaimed async on-chain): aceptado por ahora,
  revisar en Slice 5 si se nota.

## 7. Próximo paso recomendado

1. **Smoke manual MiniPay/390px** del path integrado:
   - pieza con 0★ (labs locked, copy correcto);
   - pieza con 6★ (Labyrinth 1 READY);
   - abrir Labyrinth 1, completarlo, verificar overlay + stars;
   - abrir Labyrinth 2 si quedó unlocked;
   - "Back to exercises" mid-run;
   - confirmar SaveScore / Get Peones / Hint intactos en exercises.
2. Luego **Slice 4** (Peones earn) con los guards del red-team.

## Open questions

- ¿El threshold 6★ se siente bien en queen/king (pool de 15★ max)? Decidido
  flat para v1; revisar con datos de juego real.
- ¿La pill "Back to exercises" debe sobrevivir al rediseño visual del board en
  labyrinthMode o migrar al HUD? Decisión de polish, no de contrato.
