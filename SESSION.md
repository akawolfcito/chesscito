# Session Handoff — 2026-06-21

## Completed

- **Score model audit** — `docs/reviews/2026-06-21-score-rating-model-audit.md` — diagnóstico completo: 12★ × 100 pts = 1200, laberintos no cuentan, LEADERS suma cross-piece, sin bugs.
- **Score transparency** — 5 commits (`578ef6dd`…`f079828a`):
  - `getMaxPossibleStars(piece)` en `progress-adapter.ts` (pool × 3, laberintos excluidos)
  - `scoreBreakdown` + `scoreAtMax` copy keys EN + ES con interpolación real
  - Breakdown line en `MissionDetailSheet` bajo "Climb the leaderboard": `12★ × 100 pts` normal; `30★ / 30★ · Max` en cap; hidden cuando `canSaveScore=false`
  - Pass-through `totalStars` + `maxPossibleStars` por `MissionPanelCandy` → `exercises-screen`
  - Test ES: `"30★ / 30★ · Máximo"` via `renderWithIntl(locale:"es")`
  - 4238/4238 tests · tsc 0 errores · fórmula/Save Flow/LEADERS intactos
- **Content Loop v1** (sesión anterior, commits en main):
  - `deriveContentLoopAction` + `NextStepCard` + wiring Lite-only en `hub-scaffold-client`
  - HubScaffold Lite vs Full gate tests (`vi.doMock` pattern)
- **LEADERS refresh after save** (`6014b0d8`) — `refreshTrigger` prop en `LeaderboardSheet`; off-chain + on-chain paths lo incrementan

## Current State

- **Branch**: `main` — HEAD `f079828a`
- **Build**: 4238/4238 passing · tsc clean
- **Uncommitted work**: solo `SESSION.md` (este archivo) + 6 docs untracked (archival, no bloqueantes):
  - `docs/reviews/2026-06-18-celopedia-ecosystem-fit-and-grants-strategy.md`
  - `docs/reviews/2026-06-19-lite-transactional-loop-audit.md`
  - `docs/reviews/2026-06-21-score-rating-model-audit.md`
  - `docs/specs/exercises-save-flow-simplification-redteam.md`
  - `docs/specs/exercises-save-flow-simplification.md`
  - `docs/specs/welcome-package-lite-redteam.md`
  - `docs/specs/welcome-package-lite.md`

## Score Transparency — Resumen técnico

Breakdown line visible en `MissionDetailSheet` cuando `canSaveScore=true` + props presentes:
- No al máximo: `12★ × 100 pts`
- Al máximo (todos los ejercicios 3★): `30★ / 30★ · Max`
- ES: `{stars}★ / {maxStars}★ · Máximo`

`getMaxPossibleStars` usa `catalog[piece].length * 3` — se actualiza automático si el pool crece.

## Next Tasks

1. **Smoke manual** — abrir Mission Detail en exercises (rook), verificar `12★ × 100 pts`. Completar un laberinto → score no cambia.
2. **Push a origin/main** — `git push` para que los commits queden en remoto (5 commits Score Transparency pendientes de push).
3. **Welcome Package Lite** — spec en `docs/specs/welcome-package-lite.md` (untracked) listo. Revisar + red-team + TDD si founder aprueba.
4. **Exercises Save Flow Simplification** — spec en `docs/specs/exercises-save-flow-simplification.md` (untracked). Analizar si vale continuar o descartarlo.
5. **VR baseline refresh** — `MissionDetailSheet` tiene nueva breakdown line; correr `pnpm test:e2e:visual` en servidor limpio si hay smoke OK.
6. **Score Transparency Opción D** (low priority) — mostrar `total_score` cross-piece en HUD exercises, no solo score de pieza seleccionada.

## Open Questions

- ¿El founder quiere breakdown también en la vista de LEADERS (debajo del score del jugador)?
- ¿`scoreAtMax` debería incluir el score numérico (`3,000 / 3,000 pts · Max`) además de las estrellas?
- ¿Welcome Package Lite y exercises-save-flow specs tienen red-team aprobado para pasar a TDD?
- Grant pack: ¿ya se envió? (`docs/grants/2026-06-20-chesscito-lite-grant-pack.md` § Submission copy)

## Blockers

- Ninguno técnico. Smoke pendiente para confirmar render en MiniPay WebView.

## Notes

- `NEXT_PUBLIC_CHESSCITO_LITE_MODE` era correcto desde antes — verificado, sin cambios.
- ES translations en `src/lib/content/messages/es.ts` — ambas keys añadidas.
- `docs/reviews/2026-06-21-score-rating-model-audit.md` tiene las 12 preguntas del diagnóstico + opciones A-F de producto.
- Grant pack: `docs/grants/2026-06-20-chesscito-lite-grant-pack.md`. Grant shots: `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true PORT=3001 pnpm dev` + `GRANT_SHOTS=true BASE_URL=http://localhost:3001 pnpm exec playwright test e2e/grant-shots.spec.ts --project=minipay`
