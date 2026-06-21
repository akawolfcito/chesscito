# Session Handoff — 2026-06-21

## Completed

- `49b2288d` + `391eb10c` **feat(exercises): Exercise Path Sequencing** — `getLabyrinthForAutoAdvance` en `lib/training/path.ts`; auto-advance respeta labyrinths interleaved al completar ejercicios. Case 1 = inmediato, Case 2 = scan full path (cubre late-unlock y manual replay). 9 unit tests + widened scan fix.
- `8b597754` **docs(grants): grant-ready evidence pass** — `docs/grants/2026-06-20-chesscito-lite-grant-pack.md` actualizado (Exercise Path Sequencing en Lite loop table, tabla 9 screenshots, métrica Full-only clarificada). `docs/grants/assets/README.md` con checklist + capture notes.
- `bfe66afc` + `ef641ae8` **test(e2e): grant-shots spec** — `apps/web/e2e/grant-shots.spec.ts`: genera 9 screenshots Lite a `docs/grants/assets/` en 390×844. Seeds localStorage (streak, WP, rook progress). Opt-in: `GRANT_SHOTS=true BASE_URL=<lite-url>`.
- `391eb10c` **9 grant screenshots committed** — `docs/grants/assets/01-hub-lite.png` … `09-stats-public.png`, todos verificados visualmente.

## Current State

- **Branch**: `main` — `391eb10c`, synced with `origin/main`
- **Build**: tsc clean · 4171 tests passing (baseline pre-session; no suite run this session)
- **Uncommitted work**: 6 untracked docs (archival, no impact):
  - `docs/specs/exercises-save-flow-simplification.md` + redteam
  - `docs/specs/welcome-package-lite.md` + redteam
  - `docs/reviews/2026-06-18-celopedia-ecosystem-fit-and-grants-strategy.md`
  - `docs/reviews/2026-06-19-lite-transactional-loop-audit.md`

## Next Tasks

1. **Submit Lite grant** — `docs/grants/2026-06-20-chesscito-lite-grant-pack.md` + `docs/grants/assets/` listos. Revisar copy final y enviar a programa de grants (Celopedia / target).
2. **Commit untracked spec/review docs** — decidir si van a main para auditoría (ningún blocker técnico).
3. **VR baseline hub Lite** — refresh snapshots para hub surface en Lite (deferred desde P1 Focus Passport).
4. **P1.5 Focus Passport calendar real** — `completedDates[]` con backend (actualmente localStorage streak-only).
5. **P2 Cross-device Lite sync** — requiere auth layer + backend (fuera de scope actual).

## Blockers

- None

## Notes

- **Grant shots regeneration**: `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true PORT=3001 pnpm dev` (terminal aparte), luego `GRANT_SHOTS=true BASE_URL=http://localhost:3001 pnpm exec playwright test e2e/grant-shots.spec.ts --project=minipay`
- **`getLabyrinthForAutoAdvance` Case 2**: scan ALL interleaved rows (no solo `[0,currentPos)`); modelo chained-unlock garantiza ≤1 lab disponible a la vez — safe.
- **WP `autoShowCount`**: `< 2` → `shouldAutoShow=true` → modal abre en mount. Grant shot 05 usa `autoShowCount: 0`; hub/passport usan `autoShowCount: 99` para hub limpio.
- **`/hub`** es el surface del juego (no `/`, que es la landing de marketing).
