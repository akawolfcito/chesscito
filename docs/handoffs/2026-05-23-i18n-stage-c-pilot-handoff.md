# Handoff — i18n Stage 1 + Stage 2 + Stage C pilot

- **Date:** 2026-05-23
- **Branch:** `main` (5 commits pushed `e98e1edd..a29c85ee`)
- **Status:** infrastructure complete; one pilot surface (legal pages) migrated end-to-end with real ES translations behind a feature flag; ready to scale to the remaining surfaces

---

## What shipped this session

### Pre-i18n (unrelated batch — closed earlier)

`d44a3a93..f1b80d75` (8 commits): header icon scale fix on `/coach/history` + `/trophies`; arena selector badge unclip; corona-pro AVIF/WEBP generation; i18n design spec + red-team; locale-aware `/play-hub` rewrite; `NEXT_PUBLIC_I18N_ES_READY` flag gate; `renderWithIntl` test helper.

### i18n migration — Stage 1 (foundation), Stage 2 (message bundles), Stage C pilot

`235d67e9..a29c85ee` (8 commits):

1. **`chore(deps)`** — pin `next-intl@4.12.0`.
2. **`feat(i18n)`** — scaffold `i18n/routing.ts`, `i18n/request.ts`, `middleware.ts`, message stubs, `next.config.js` plugin wrap.
3. **`refactor(app)`** — move 30 routes under `apps/web/src/app/[locale]/`. Layout reads `params.locale`, validates against `routing.locales`, calls `setRequestLocale`, wraps with `NextIntlClientProvider`, sets `<html lang>` dynamic. `generateStaticParams` exported.
4. **`feat(i18n)`** — seed `messages/en.ts` (imports `* from editorial`, `stripFunctions` filter so the Client-Component-bound bundle is JSON-serializable), `messages/es.ts` (mirror EN until Stage 4), `lib/content/locale.ts` (helpers re-export).
5. **`fix(i18n)`** — `/play-hub` rewrite locale-aware (`/:locale/play-hub` → `/:locale/exercises`).
6. **`feat(i18n)`** — `/es` gated behind `NEXT_PUBLIC_I18N_ES_READY=1`. Flag OFF: intl middleware constructed with `locales=['en']` so naked `/` resolves directly to `/en` (1 hop), and any direct hit to `/es/*` 307s to `/en`. Flag ON: full bilingual routing with `Accept-Language` detection.
7. **`feat(test)`** — `src/test-utils/render-with-intl.tsx` wraps trees in `NextIntlClientProvider` with EN or ES bundle. `getMessageFallback` returns dotted key path so partial migrations don't cascade-fail.
8. **`refactor(legal)`** — Stage C pilot:
   - `LegalPageShell` (client) → `useTranslations("LEGAL_SHELL_COPY")` for back chip
   - `/about/page.tsx`, `/support/page.tsx`, `/privacy/page.tsx`, `/terms/page.tsx` (all server) → `getTranslations(namespace)`
   - `/about/invite-link.tsx` (client) → `useTranslations("ABOUT_COPY")`
   - `AboutMethodology`, `CognitiveDisclaimer` (server) → `getTranslations`, became `async`
   - New namespace `LEGAL_SHELL_COPY` (back / aboutTitle / lastUpdatedLabel) in editorial.ts
   - Full Spanish translations for `ABOUT_COPY`, `ABOUT_METHODOLOGY_COPY`, `COGNITIVE_DISCLAIMER_COPY`, `SUPPORT_COPY`, `PRIVACY_COACH_COPY`, `LEGAL_COPY.terms/privacy`, `LEGAL_SHELL_COPY` in `messages/es.ts`
   - `vitest.setup.ts` globally stubs `next-intl/server` (`getTranslations`, `setRequestLocale`, `getLocale`, `getMessages`) → server-component unit tests resolve EN bundle by dotted path with no per-file mocks
   - 3 tests migrated to async pattern (`await PageComponent(); render(tree)`)
9. **`fix(dev)`** — `dev/layout.tsx` imports `globals.css` (broke after Stage 1 removed root layout) + metadata rebranded from "Next.js" scaffold defaults to `Chesscito — Dev Fixtures` with `robots: noindex/nofollow`.

---

## Health check

- **TypeScript:** clean
- **Unit tests:** 1874/1874 passing (1871 baseline + 3 new helper tests; 8 surface tests migrated to async pattern)
- **VR:** 11/13 passing
  - PASS: all 4 legal pages (no baselines existed before), all 4 dev fixtures (after globals.css fix), hub-daily-tactic-open, mint-pills, save-toast, persist-overlay, coach-history-mixed
  - FAIL: `hub-clean — anonymous /hub, no overlays` + `hub-shop-sheet-open — ShopSheet from dock` — see `_bmad-output/implementation-artifacts/deferred-work.md` entry 2026-05-23. Suspected `freezeDate` × `NextIntlClientProvider` paint timing causing the daily-tile to render in actual but not expected. No functional regression; URLs render correctly.
- **Dev smoke (flag ON, port 3346):**
  - `/es/about` → 200, renders Acerca / Metodología / Operado por / Política / Soporte / Términos / Por qué Chesscito
  - `/en/about` → 200, renders About / Methodology / Operated by / Privacy / Support / Terms
  - `/es/support`, `/es/privacy`, `/es/terms` → 200
- **Dev smoke (flag OFF):**
  - `/` + Accept-Language es-MX → 307 → `/en` (1 hop, no /es round-trip)
  - `/es/about` → 307 → `/en/about`
  - `/en/about` → 200

---

## What's NOT done (Stage C remaining)

Per the red-team's leaf-to-trunk migration order (`docs/reviews/2026-05-23-i18n-stage-c-redteam.md`):

| Surface batch | Files (approx) | Notes |
|---|---|---|
| **shared-ui + redesign primitives** | ~20 | `components/ui/*`, `components/redesign/*` — high reuse, migrate carefully, may impact many tests |
| **share/\*** | ~6 | Mostly autonomous; OG share routes |
| **victory/\*** | ~8 | Includes contract interaction surfaces |
| **trophies/\*** | ~6 | Badge sheets etc. |
| **profile + kingdom + pro** | ~10 | Sheets + chips |
| **coach/\*** | ~12 | Will also need `/api/coach/*` to accept `locale` (red-team H-4) |
| **arena/\*** | ~12 | Game UX; high-touch |
| **exercises/\*** | ~20 | Most entangled surface; do near the end |
| **hub/\*** | ~10 | Composes most other surfaces; do last |
| **lib/\* helpers** | ~6 | `lib/errors.ts`, `lib/profile/*`, `lib/hub/hero-cta.ts`, etc. Special handling: return KEYS, let consumer translate |
| **app pages** | ~12 | Per-route `getTranslations` calls |

After all surfaces: **Stage 4** (translate remaining namespaces in `messages/es.ts`) + **Stage 5** (locale toggle UI, sitemap+hreflang, coach API locale, metadata localization, flag flip).

---

## Per-session contract (don't break this)

1. Pick ONE surface batch from the table above.
2. Before editing: grep `from "@/lib/content/editorial"` within the batch → enumerate which editorial namespaces to translate.
3. Migrate each file: import swap, `useTranslations` (client) or `getTranslations` (server), dotted-path access. Arrays → `t.raw()`. Computed objects with env-derived fields → spread `en` in `messages/es.ts` overrides.
4. Update affected tests: server components need async + `await Component(); render(tree)`; client components need `renderWithIntl()` from `@/test-utils/render-with-intl`.
5. Add ES translations for that batch's namespaces in `messages/es.ts`.
6. Run: `npx tsc --noEmit` + `pnpm test` + smoke with `NEXT_PUBLIC_I18N_ES_READY=1 pnpm dev` on the migrated surface in both `/en/*` and `/es/*`.
7. Run `pnpm test:e2e:visual` if UI touched. New ES baselines OK to add; refresh diff'd EN baselines only with justification.
8. ONE commit per batch. PR title: `refactor(<surface>): migrate to next-intl + ES translations`.

Done = batch surface's `/es/*` renders Spanish coherently, no Spanglish; flag-OFF still works; tests + typecheck green.

---

## Open items to address before Stage 4 (E1 flag flip)

From the red-team (`docs/reviews/2026-05-23-i18n-stage-c-redteam.md`):

- **H-1 WalletProvider remount on locale switch** — documented as accepted v1; design the toggle as "Switch language (will reload)".
- **H-2 Share URLs in the wild** — post-deploy smoke per surface (badge/daily/endgame/score) once Stage C ships to production.
- **H-3 VR baselines** — re-establish a clean 13/13 pre-Stage 4. Hub-clean + hub-shop-sheet-open need diagnosis (deferred-work entry above).
- **H-4 Coach prompts ES** — move from "Stage E E3" to "part of Stage 4" so ES launch is internally coherent.
- **M-1 Date/number formatting** — grep `.toLocaleDateString`, `.toLocaleString` and route through `useLocale()`.
- **M-2 Sitemap + hreflang** — `apps/web/src/app/sitemap.ts` with both locales + per-page `alternates`.
- **M-3 ICU pluralization** — replace `submitFailed: (n) => ...` style helpers with ICU MessageFormat inside the bundle as their consumer surfaces migrate.
- **M-4 Internal navigation** — Stage 5 codemod from `next/link` → `next-intl/navigation` Link to avoid the 307 redirect per click.

---

## Quick reload checklist for the next session

1. `git pull origin main` (expect HEAD at `a29c85ee`).
2. Read `MEMORY.md` → i18n section (added this session).
3. Read this handoff + `docs/superpowers/specs/2026-05-23-i18n-es-en-design.md` + `docs/reviews/2026-05-23-i18n-stage-c-redteam.md`.
4. Decide which surface batch to take (recommended next: **shared-ui** as the highest-reuse leaf — done early means fewer cascade migrations later).
5. Follow the per-session contract above.
6. Test the smoke flow with `NEXT_PUBLIC_I18N_ES_READY=1 PORT=3346 pnpm --filter web dev` and curl/visit both `/en/<route>` and `/es/<route>`.

---

## Files added/touched (cumulative this session)

```
# New
apps/web/src/i18n/routing.ts
apps/web/src/i18n/request.ts
apps/web/src/middleware.ts
apps/web/src/lib/content/messages/en.ts
apps/web/src/lib/content/messages/es.ts
apps/web/src/lib/content/locale.ts
apps/web/src/test-utils/render-with-intl.tsx
apps/web/src/test-utils/__tests__/render-with-intl.test.tsx
apps/web/src/app/dev/layout.tsx          # was untracked; now committed
docs/superpowers/specs/2026-05-23-i18n-es-en-design.md
docs/reviews/2026-05-23-i18n-stage-c-redteam.md
docs/handoffs/2026-05-23-i18n-stage-c-pilot-handoff.md  # this file

# Renamed (Stage 1 [locale] move)
apps/web/src/app/{about, arena, coach, exercises, hub, privacy,
                  share, support, terms, trophies, victory, why,
                  __tests__, error.tsx, layout.tsx, page.tsx,
                  template.tsx}
→ apps/web/src/app/[locale]/...

# Modified
apps/web/package.json                # next-intl pin
apps/web/next.config.js              # plugin wrap + locale rewrites
apps/web/vitest.setup.ts             # global next-intl/server mock
apps/web/src/app/[locale]/layout.tsx # locale-aware root
apps/web/src/app/[locale]/about/page.tsx
apps/web/src/app/[locale]/about/invite-link.tsx
apps/web/src/app/[locale]/privacy/page.tsx
apps/web/src/app/[locale]/support/page.tsx
apps/web/src/app/[locale]/terms/page.tsx
apps/web/src/app/[locale]/__tests__/privacy.test.tsx
apps/web/src/components/legal-page-shell.tsx
apps/web/src/components/about/about-methodology.tsx
apps/web/src/components/about/__tests__/about-methodology.test.tsx
apps/web/src/components/legal/cognitive-disclaimer.tsx
apps/web/src/components/legal/__tests__/cognitive-disclaimer.test.tsx
apps/web/src/lib/content/editorial.ts  # +LEGAL_SHELL_COPY namespace
```

---

## Risks / known issues at handoff

- **VR red on 2 hub baselines** — see deferred-work.md. Not a regression in product behavior; resolve before Stage 4 flag flip.
- **In-app navigation still hits middleware redirects** — every `<Link href="/arena">` click goes `/arena` → 307 `/en/arena`. Functional but adds a roundtrip per nav. Codemod is Stage 5.
- **Coach AI responses still EN** — until red-team H-4 ships, /es users get Spanish UI + English coach feedback. Plan: include in Stage 4.
- **PWA manifest stays EN** — accepted v1.
