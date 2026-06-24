# Session Handoff — 2026-06-24

## Completed

- `cddfc13` — drawer UX: auto-scroll al nodo activo al abrir, pieza pb-8, quitar spine line
- `87275fa` — path-map node polish: badge check verde/número, glow dorado (estilo TRAIN PIECES), `isActive && !isDone` solo
- `30ac4c9` — Claim Badge CTA en drawer (reemplaza hint cuando `badgeClaimable`), estrellas 2x más grandes (`h-6`), flush al nodo (`gap-0`)
- `40b8441` — icono streak → combo triplet (`icons/combo.{avif,webp,png}`)
- `3fc3969` — **bug fix crítico**: `lockedFor()` aplica la senda SIEMPRE aunque `rotationOn=true`; rotation solo filtra cuáles aparecen, la senda sigue gateando acceso
- `4e16f79` — revert safe-area-inset-top (añadía demasiado espacio al header)
- `e36c621` — rediseño completo drawer: path-map `path-map.png`, `btn-nodo.png` + pieza encima, `labyrint-icon.png` para laberintos, zigzag, grayscale+lock en bloqueados, tooltip al tap

## Current State

- **Branch**: `main` — sincronizado con `origin/main` (`63bb4ae9`)
- **Build**: passing — tsc clean, 22/22 exercise-drawer tests
- **Uncommitted work**: solo `docs/testing/analytics-test-patterns.md` (untracked, no urgente)

## Next Tasks

1. **B2.2a — Stable Challenge Links**: pinear puzzleId en URL `/challenge/daily?date=...&puzzle=dt-xxx-N` — spec completo en `.claude/TODO.md`; `resolveDailyPuzzle()` + actualizar `page.tsx`, `challenge-daily-client.tsx`, `hub-daily-tile.tsx`, 5 tests TDD
2. **B2.2b — Daily Content Pack**: expandir pool 30→40 (+2 puzzles por pieza excepto king) — bloqueado por B2.2a
3. **Smoke del drawer en device real**: verificar que el auto-scroll al nodo activo funciona en MiniPay WebView (el `scrollIntoView` a 250ms puede necesitar ajuste)
4. **VR baseline update**: el drawer cambió visualmente — refrescar snapshots Playwright con `--update-snapshots` antes del próximo ship a prod

## Blockers

- Ninguno

## Notes

- Bug de ejercicios todos unlocked: causado por `ENABLE_EXERCISE_ROTATION=true` en preview env + `getCanonicalFive` (primeros 5) con `lockedFor` que bypasseaba la senda. Fix `3fc3969`.
- El drawer usa `flex-col-reverse` para renderizar exercise 1 en la base visual; auto-scroll usa `scrollIntoView({ block: "center", behavior: "smooth" })` con 250ms delay.
- `scripts/gen-triplet.sh` funciona en macOS bash 3 — usar para cualquier asset nuevo.
- B2.2a spec detallado en `.claude/TODO.md` (implementation order + smoke manual incluidos).
