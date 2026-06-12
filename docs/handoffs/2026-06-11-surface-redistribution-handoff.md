# Handoff — Surface Redistribution: spec Sally D1-D6 + implementación completa

**Date**: 2026-06-11 (sesión 3 del día)
**Branch**: `main` (clean), continúa
`2026-06-11-training-path-3d-4-close-handoff.md`
**Suite**: 3605/3605 · tsc clean · VR 49/49 (2 baselines stale refrescadas)
**Spec**: `docs/specs/ux-surface-redistribution-spec-2026-06-11.md`
(APPROVED, D1-D6 congeladas por el founder; copia espejo en
`_bmad-output/planning-artifacts/`, gitignored)

## Commits de esta sesión (en orden)

| Commit | Qué |
|---|---|
| `dbe39839` | spec D1-D6 congelada en docs/specs |
| `7bf9a081` | D1/D5 — Mission slim: solo guía + línea "Now: Labyrinth N" + botón Save score |
| `35679405` | D2 — TrainingPathRail eliminado (el drawer es el selector canónico) |
| `c75b26fd` | D4 — JourneyRail: iconos reales en gris → color al completar (CSS, cero arte) |
| `8c4a48d9` | D3 — Piece Sheet unificada: picker + badges merge, journey migra, gate pedagógico intacto |
| `1fe6b6d4` | D6 — drawer intercalado Ex→Lab→Ex (`interleaveTrainingRows()`, modelo intacto) |
| `735979b0` | VR refresh: terms-page (ba630333) + vr14-result-error (809a3e13), drift de trabajo ya shippeado |

## Estado del producto tras esta sesión

- **Mission responde "¿qué hago ahora?" en un vistazo**: objetivo +
  hint + línea viva "Now: Labyrinth N" (tappable) + Save score. Pills
  de score/time, TrainingPathRail y JourneyRail fuera.
- **Una sheet de pieza**: chip TORRE, botón badges del dock y
  PieceComplete "Choose another piece" abren la MISMA BadgeSheet
  (hero + journey de la pieza activa + cards + switch grid). El gate
  pedagógico (switch oculto hasta el primer badge) sobrevive. El hub
  (`useBadgeSheetState`) omite los props nuevos → vitrina pura, igual
  que antes.
- **Drawer = senda única intercalada**: Ex, Ex, Lab1, Ex, Lab2…
  presentación pura; `buildTrainingPath` y todo el unlock math
  intactos. Cierra la open question del modelo intercalado del founder.
- **Milestones gris→color**: vocabulario de la vitrine hero extendido a
  JourneyRail vía `.journey-row-icon--pending` (grayscale CSS).

## Ronda QA del founder (misma sesión) — spec §4b

| Commit | Qué |
|---|---|
| `73e1c474` | F2/F3 — overlay solved continue-first (X incluida) + pin de salida muted reemplaza la banda BACK TO EXERCISES |
| `fb2bb4c6` | F4 — cards de badges SON el switch; JourneyRail + SWITCH PIECE grid eliminados (enmienda D2/D3) |
| `995d77d2` | F1/F5 — línea promesa "Keep this score for life" + Save score sentence case; TX save diferido al Leaderboard Proof lane |

Suite final 3610/3610 · VR sanity 4/4 (hub-clean + vr14).

## Deferred / notas

- **VR fixtures nuevas pendientes**: no existe baseline del interior de
  MissionDetailSheet ni de la Piece Sheet unificada (tampoco existían
  antes). Añadir fixtures `/dev` + baselines en un VR-sprint.
- **Strings huérfanos**: TRAINING_PATH_COPY (exercise chips,
  milestones) y MISSION_DETAIL_COPY (scoreLabel/timeLabel/
  preFirstMoveHint/journeyTitle) quedaron sin consumidor — chore
  separado, precedente M1.
- `PIECE_RAIL_COPY` aún alimenta el trigger + switch grid; el resto de
  sus keys (title/infoSubtitle/closeLabel) quedaron huérfanos al borrar
  PiecePickerSheet.
- El smoke manual MiniPay/390px del path completo (NEXT-4 del handoff
  anterior) ahora incluye estas superficies nuevas.

## NEXT (hereda el orden del handoff anterior, ajustado)

1. Spec economía narrativa + monetización visible (NEXT-2 anterior).
2. Smoke earn real en hosted (lab + wallet → ledger row + replay
   duplicate) — NEXT-3 anterior, sin cambios.
3. Re-smoke manual MiniPay/390px del path + superficies redistribuidas.
4. Slice 5 mastery + telemetría `training.path_*`.
5. Laberintos ricos + casilla oscura.
6. Promote a producción cuando 2-3 estén verdes.

## Open questions

- ¿La Piece Sheet unificada debe mostrar el journey también en el hub
  (pasar selectedPiece desde hub-scaffold)? Hoy: hub = vitrina pura.
- Threshold 6★ en queen/king (pools 15★) sigue pendiente de juego real.
- Guest-mastery-flicker (P1 red-team) sigue aceptado.
