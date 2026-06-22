# Session Handoff — 2026-06-22

## Completed

### B1.1.1 — Route Hardening
- `aeb9a830` — `[locale]/not-found.tsx` + `NOT_FOUND_PAGE_COPY` editorial
- `7d49ffbe` — `[locale]/[...slug]/page.tsx` catch-all fix: Lite → `redirect("/hub")`, Full → `notFound()` → styled 404 UI
  - Root cause: `redirect()` dentro de `not-found.tsx` no es confiable; catch-all intercepta ANTES del error boundary
  - 4310/4310 tests passing, tsc limpio

### B1.3 — Domain Architecture (`apps/landing`)
- `f75402de` — `apps/landing` standalone Next.js 14 app para `www.chesscito.com`
  - Server Component LandingPage: sin hooks, sin next-intl, sin wallet deps
  - CTAs como `<a href>` apuntando a `NEXT_PUBLIC_PLAY_URL` (default: `lite.chesscito.com`)
  - `globals.css` mínimo: `--paper-*`, `--landing-*`, CTA green vars + clases
  - `layout.tsx` + `robots.ts` + `sitemap.ts` para canonical `www.chesscito.com`
  - Assets copiados: 9 landing art + 60 candy icons (avif/webp/png triplets)
  - `apps/web [locale]/page.tsx` → `redirect("/hub")` — game app es hub-only
  - `apps/landing` build: static 138B JS · `apps/web` 4310/4310 · tsc clean en ambos

## Current State

- **Branch**: `main` (`f75402de`, pushed)
- **Build**: 4310/4310 tests ✅ · tsc clean ✅ · `apps/landing` build ✅
- **Uncommitted work**: `SESSION.md` (este archivo) · `docs/testing/` (untracked, sin relación)

## Next Tasks

1. **Vercel — crear proyecto `apps/landing`** (manual, founder):
   - New Vercel project → Root Directory: `apps/landing`
   - Domains: `chesscito.com` + `www.chesscito.com`
   - Env vars: `NEXT_PUBLIC_APP_URL=https://www.chesscito.com`, `NEXT_PUBLIC_PLAY_URL=https://lite.chesscito.com`, `NEXT_PUBLIC_SUPPORT_EMAIL=<actual>`
2. **Vercel — actualizar proyectos existentes** (manual):
   - Lite project: `NEXT_PUBLIC_APP_URL` → `https://lite.chesscito.com`
   - Full project: `NEXT_PUBLIC_APP_URL` → `https://play.chesscito.com`
   - Transferir dominio `www.chesscito.com` del proyecto Full → proyecto Landing
3. **Smoke `apps/landing`** tras deploy: hero carga, CTA → `lite.chesscito.com/hub`, footer links, OG, robots/sitemap
4. **Smoke `apps/web`** tras transferencia: `/` → 307 a `/hub`, rutas de juego sin regresión
5. **Cleanup diferido** (post-verificación landing live): borrar `apps/web/src/components/landing/` y `apps/web/src/lib/server/wallet-detection.ts` si sin otros usos

## Blockers

- Vercel project setup es 100% manual — requiere acción del founder (pasos 1–2)
- Dominio `www.chesscito.com` debe transferirse al proyecto Landing antes del smoke final

## Notes

- `NEXT_PUBLIC_LEGAL_URL` es opcional en landing: sin él, footer links caen a `NEXT_PUBLIC_PLAY_URL`
- `apps/landing` es EN-only (no next-intl) — i18n diferido, fuera del scope B1.3
- Cleanup de `components/landing/` en `apps/web` va en PR separado tras confirmar landing live
- `docs/testing/` untracked — carpeta nueva, no es trabajo de esta sesión
