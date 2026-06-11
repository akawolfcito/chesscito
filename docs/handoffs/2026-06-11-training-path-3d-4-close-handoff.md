# Handoff — Training Path: 3D, briefing fix, Slice 4, 3E + quick fixes

**Date**: 2026-06-11 (sesión 2 del día)
**Branch**: `main` (clean) — continúa el handoff
`2026-06-11-integrated-training-path-slices-1-3c.md`
**Suite**: 3601/3601 · tsc clean · VR 3/3
**Migración hosted**: `20260611010000_peones_labyrinth_completion_source.sql`
**APLICADA** por el founder vía `supabase db push --linked` desde `apps/web`
(lección re-aprendida: NUNCA desde la raíz del repo; NUNCA aceptar el
`migration repair --status reverted` que sugiere el CLI en ese error).

## Commits de esta sesión (en orden)

| Commit | Qué |
|---|---|
| `6609adc1` | 3D — `getNextChallenge()` (primer lab unlocked sin completar) |
| `1ce1c6d7` | 3D — drawer principal = selector unificado (sección LABYRINTHS) |
| `0b348c3e` | 3D — pin contextual "Enter Labyrinth" (ActionPin nueva, brand family) |
| `faf71ebd` | fix — briefing diferido en labyrinthMode (`shouldShowMissionBriefing`) |
| `f4f2c5f9` | Slice 4 — migración + types + schema-sync lockstep |
| `3c885896` | Slice 4 — earn route acepta `labyrinth_completion` + prefijo |
| `31ce8cc8` | Slice 4 — client `labyrinth-earn.ts` + wiring (+1 primera completion) |
| `788e7075` | 3E — lab pendiente > next piece en PieceComplete (el bloqueo founder) |
| `73ca4906` | quick — hint "If MiniPay keeps…" fuera del Account sheet |
| `5d368ab7` | quick — bandera idioma 36→44px |
| `d9eca609` | quick — `/dev/reset` (wipe localStorage `chesscito*`) |

## Estado del producto tras esta sesión

- La senda es continua de verdad: drawer principal lista ejercicios +
  laberintos, pin "Enter Labyrinth" en pantalla cuando hay reto pendiente,
  y PieceComplete prioriza el laberinto sobre la siguiente pieza.
- Economía de labs viva end-to-end: +1 Peón primera completion, source
  `labyrinth_completion` daily-capped (cap 6), idempotencia
  `labyrinth_completion:{wallet}:{piece}:{labId}` (wallet DENTRO de la key
  — el índice único del ledger es GLOBAL; desviación documentada del spec).
  Migración ya en hosted → **smoke real de earn pendiente**.
- `/dev/reset`: QA fresh-user en device sin tocar site-data. Ledger de
  Peones NO se resetea (wallet nueva para economía desde cero).

## NEXT — orden aprobado por el founder

1. **Sesión Sally** (`bmad-agent-ux-designer`): spec de redistribución de
   superficies. Insumos del founder (verbatim de su feedback):
   - Mission = ayuda/guía de "qué hago ahora"; HOY mezcla guía + vitrina +
     data y no se entiende.
   - El listado del path "todos dicen 3, 3, 3" — ilegible; quizá resumen +
     botón save score off/onchain.
   - Milestones/Mastery "parecen badges" — propuesta founder: iconos
     B/N que se colorean al completar (también en Journey).
   - Vitrina de logros → Profile o TROPHIES, no Mission.
   - El selector de piezas (chip TORRE) podría SER el sheet YOUR BADGES.
   - Citar 2-3 patrones probados antes de proponer (regla
     ux-pattern-references, `docs/design-patterns/game-economy-patterns.md`).
2. **Spec economía narrativa + monetización visible**: Peones/stars/streak
   se sienten "números sueltos"; welcome pack debe ENTREGARSE al primer
   ingreso (no descubrirse); banner PRO en algún momento del flujo; tx
   visibles — sin esto MiniPay no listará. Red-team corto después.
3. **Smoke earn real en hosted**: completar lab con wallet → fila
   `labyrinth_completion` en ledger, +1 en chip; replay → duplicate.
4. **Re-smoke manual MiniPay/390px** del path completo (checklist §7 del
   handoff 1-3C + drawer/pin/cascada nuevos).
5. **Slice 5**: mastery crown + telemetría `training.path_*`.
6. **Contenido laberintos**: layouts más ricos (hoy muy simples) + cambiar
   obstáculo pieza-con-candado por CASILLA OSCURA pintada (render en
   `board.tsx`; autoría en `lib/game/exercises.ts`, el BFS verifier valida
   óptimos en CI).
7. Promote a producción (release process) cuando 3-4 estén verdes.

## Open questions

- Threshold 6★ en queen/king (pools de 15★): validar con juego real.
- Secuencia intercalada (Ex5 → Lab1 → Ex6 → Lab2) del modelo founder:
  hoy el path es bloques (exercises → labs). ¿Lo resuelve la spec de
  Sally como presentación, o cambia el modelo de `buildTrainingPath`?
- Guest-mastery-flicker (P1 red-team) sigue aceptado.

## Deuda/backlog que persiste

- Deep Hint (3 Peones) spec; re-smoke bug SAVE/CLAIM vanish (sesiones
  previas); Hint dentro de laberintos (fuera de scope hasta Deep Hint).
