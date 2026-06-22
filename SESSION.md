# Session Handoff — 2026-06-22

## Completed

- **Lite B1.2 — Metrics / Grant Readiness** (`a9e6eeed` → `main` = `production`)
  - `17c9be9c` claim gift telemetry module — 5 events (`claim_gift_tap/signing/success/rejected/failed`), `isLite:true`, razones sanitizadas, sin PII
  - `673af205` wire emitters → `useLiteWelcomeGiftClaim` + 10 hook tests (wallet/no-wallet/reject/fail paths)
  - `eef7cbc2` `lib/daily/telemetry.ts` — `isLite?` dim en 3 emitters + `emitPassportSlotsUpdated`
  - `1d7bf3ad` `hub-daily-tile` — pasa `isLite: CHESSCITO_LITE_MODE` + llama `emitPassportSlotsUpdated` post-completion
  - `61d7db94` `lite_session_started` — one-per-tab via `sessionStorage` dedupe en `hub-scaffold-client`
  - `6899bcb8` `exercise_complete` + `exercise_fail` ganan `isLite` dim en `exercises-screen`
  - `1482d96a` `labyrinth_complete` event (junto a `modal_open` legacy) con `isLite` en `labyrinth-complete-overlay`
  - `a71ad18a` `GET /api/admin/lite-stats?from=YYYY-MM-DD&to=YYYY-MM-DD` — ADMIN_TOKEN-gated, filtra `props.isLite===true` server-side, devuelve 11 contadores

## Current State

- **Branch**: main
- **Build**: 4307/4307 passing, tsc clean
- **Uncommitted work**: `docs/testing/` (artefacto de agente explorador — no relevante)
- **Deployed**: `main` = `production` = `a9e6eeed` — Vercel building/live

## Next Tasks

1. **Smoke B1.2 en production** (`www.chesscito.com` Lite mode):
   - Completar Daily Focus → verificar `daily_tactic_completed { isLite: true }` en Supabase `analytics_events`
   - Tap "Claim" en Welcome Package → verificar `claim_gift_tap` + `claim_gift_signing` + `claim_gift_success`
   - Rechazar firma → verificar `claim_gift_rejected`
   - Completar ejercicio → verificar `exercise_complete { isLite: true }`
   - Completar laberinto → verificar `labyrinth_complete { isLite: true }`
   - `curl -H "x-admin-token: $ADMIN_TOKEN" https://www.chesscito.com/api/admin/lite-stats?from=2026-06-22` → contar > 0
2. **Welcome Package spec TDD** — `docs/specs/welcome-package-lite.md` listo para implementación
3. **Exercises Save Flow spec TDD** — `docs/specs/exercises-save-flow-simplification.md` listo
4. **VR baseline refresh** — B1.1 cambió visuals de `WelcomePackageModal`; correr `pnpm test:e2e:visual --update-snapshots` contra server limpio (`rm -rf .next` primero)

## Blockers

- Ninguno. B1.2 feature-complete, test-green, en production.

## Notes

- Endpoint `/api/admin/lite-stats` requiere `ADMIN_TOKEN` en env (`x-admin-token` header). Si no está seteado en Vercel, retorna 503.
- Stats filtran `props.isLite === true` en servidor — eventos Full de `daily_tactic_*` y `exercise_complete` (sin `isLite`) no contaminan el conteo Lite.
- Error de claim gift: `claim_gift_rejected` = usuario canceló wallet; `claim_gift_failed { reason: "sign_failed" }` = error técnico. Sin raw `error.message` ni address en telemetría.
- `docs/testing/analytics-test-patterns.md` es artefacto de explorador — no commitear a menos que se quiera como referencia.
- QA reset: `/lite-debug/reset` limpia localStorage (welcome-package + daily progress)
