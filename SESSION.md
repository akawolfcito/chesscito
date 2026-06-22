# Session Handoff — 2026-06-22

## Completed

- `0d997c2c` fix(b1.3): landing P0 assets — static OG image, favicon, apple-icon
- `cf3707ba` chore(assets): brand icons y OG images en apps/landing y apps/web
- `baf42a39` feat(b1.3): landing P1 narrative — Lite/Full CTAs, remove "from an early age"
- `de16b44b` feat(b1.3): landing /stats page — Lite + Full cards; footer Stats → /stats

All 4 commits pushed to `origin/main`. Confirmed in production.

## Current State

- **Branch**: main (`de16b44b`)
- **Build**: landing 7/7 static pages ✅ — tsc clean ✅
- **Uncommitted work**: none
- **Open PRs**: none

## apps/landing Routes (B1.3)

| Route | State |
|---|---|
| `/` | ✅ Landing homepage |
| `/stats` | ✅ Lite + Full cards |
| `/robots.txt` | ✅ |
| `/sitemap.xml` | ✅ |
| `/favicon.ico` | ✅ new brand asset |
| `/apple-icon.png` | ✅ new brand asset |
| `/og/chesscito-landing.jpg` | ✅ 1200×630 new brand |

## Env Vars (landing project in Vercel)

| Var | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://www.chesscito.com` |
| `NEXT_PUBLIC_PLAY_URL` | `https://lite.chesscito.com` |
| `NEXT_PUBLIC_FULL_URL` | `https://play.chesscito.com` ← confirmed set |
| `NEXT_PUBLIC_LEGAL_URL` | `https://lite.chesscito.com` (explicit recommended) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | set in Vercel |

## Footer Links — Smoke Risk

Footer Privacy / Terms / Support / About → `lite.chesscito.com/{path}`.
Must exist as routes in apps/web Lite. Not yet verified.

## Next Tasks

1. **Smoke /stats** — `https://www.chesscito.com/stats` debe mostrar las dos cards post-deploy
2. **Verify footer legal links** — `lite.chesscito.com/privacy`, `/terms`, `/support`, `/about` responden 200
3. **Cluster Closure Protocol (B1.3)** — per CLAUDE.md:
   - Cerrar GitHub issues/milestone B1.3
   - Actualizar README "What's live"
   - Actualizar MEMORY.md con B1.3 cerrado
   - Escribir `docs/handoffs/2026-06-22-b1.3-landing-closure-handoff.md`
4. **Welcome Package spec** (`docs/specs/welcome-package-lite.md`) — ready for TDD post-aprobación
5. **Exercises Save Flow spec** (`docs/specs/exercises-save-flow-simplification.md`) — ready for TDD post-aprobación

## Blockers

- None blocking. Footer legal links son smoke risk, no build risk.

## Notes

- `apps/landing` standalone — sin coupling con apps/web en runtime
- CTAs con fallbacks: PLAY_URL → lite, FULL_URL → play
- `favicon-wolf` en apps/web/public/art/ actualizado con nuevo brand (512×512)
- Audit en `docs/testing/landing-audit-2026-06-22.md`
- Contexto al ~60% — seguro continuar o /clear para próximo cluster
