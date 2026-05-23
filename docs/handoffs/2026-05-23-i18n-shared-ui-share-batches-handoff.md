# Handoff — i18n Stage C: shared-ui + share batches

- **Date:** 2026-05-23
- **Branch:** `main`
- **HEAD:** `9d7908f7`
- **Status:** 2 batches shipped this session (`shared-ui+redesign` + `share/*`) + 1 production deploy fix. `/es` still gated behind `NEXT_PUBLIC_I18N_ES_READY=1` (default OFF in prod).

---

## What shipped this session

### Commit `c9133c57` — `refactor(ui,redesign): migrate primitives to next-intl + ES translations`

Batch: **shared-ui + redesign primitives** (4 source + 3 test).

- `components/ui/global-status-bar.tsx` (client) → `useTranslations(GLOBAL_STATUS_BAR_COPY)` + `HUD_COPY.proRemainingFormat` via ICU `"{days}d"`
- `components/ui/coming-soon-chip.tsx` → now `"use client"` + `useTranslations(PRO_COPY)`
- `components/redesign/journey-rail.tsx` (client) → `useTranslations(PIECE_LABELS + JOURNEY_RAIL_COPY)`. **New namespace `JOURNEY_RAIL_COPY` replaces 9 pre-existing inline strings** (`Badge`, `Unlock`, `Claimed`, `Ready to claim`, `Claim badge first`, `All pieces mastered`, etc.)
- `components/redesign/tx-progress-steps.tsx` (client) → `useTranslations(TX_PROGRESS_COPY)` + ICU `stepCounter: "Step {current} of {total}"`. Module-scope `PILLS_LABEL`/`TOAST_LABEL` Records refactored to `PILLS_KEY`/`TOAST_KEY` (just key strings, `t()` called at use site).
- `dev/layout.tsx` wrapped with `NextIntlClientProvider` (EN bundle) so VR fixtures under `/dev/*` see translations.
- 3 tests migrated to `renderWithIntl` (alias as `render` for minimum diff).

**Bonus fix:** the `eslint-disable-next-line @typescript-eslint/no-explicit-any` directive on `messages/es.ts:21` referenced a rule not configured in the project's ESLint setup, breaking the production build at commit `0f03513`. Removed the directive; the `as any` cast itself doesn't trigger because the rule isn't configured. Both `messages/es.ts` and the new `messages/en.ts` post-strip override use the bare cast with a doc comment explaining why.

### Commit `9d7908f7` — `refactor(share): migrate routes + components to next-intl + ES translations`

Batch: **share/*** (6 source + 1 test).

- 4 server pages → `getTranslations` + async + locale-aware `generateMetadata` (`share/daily`, `badge`, `endgame`, `score`)
- 2 client components → `useTranslations`:
  - `share-grid.tsx`: replaced inline state labels (`Save`/`Saved`/`Link copied`/`Try Share`/`Copy`/`More`) + `aria-label="Share on {service}"` via new `SHARE_GRID_COPY` namespace
  - `share-modal.tsx`: replaced default `title = "Share"`, alt text, generating-card state, preview-unavailable state, close affordance via new `SHARE_MODAL_COPY` namespace
- 1 test migrated to `renderWithIntl`
- New namespaces in editorial.ts: `BADGE_SHARE_COPY`, `SCORE_SHARE_COPY`, `SHARE_GRID_COPY`, `SHARE_MODAL_COPY`
- Existing namespaces expanded: `SHARE_COPY` (+`playCta`), `DAILY_SHARE_COPY` (+5 page-chrome keys + ICU split for `ctaSolved`), `ENDGAME_SHARE_COPY` (+6 page-chrome keys + ICU split for `ctaSolved`)
- 8 namespaces fully translated to ES in `messages/es.ts`

**Brand names** (WhatsApp, Telegram, Facebook, X) intentionally stay hardcoded as proper nouns.

---

## Health check at handoff

- **TypeScript:** clean (`npx tsc --noEmit`)
- **Lint:** clean (`pnpm lint`)
- **Build:** production-ready (`pnpm build`)
- **Unit tests:** 1874/1874 passing (`pnpm test`)
- **VR:** 11/13 (`pnpm test:e2e:visual`) — parity with baseline. The 2 failures (`hub-clean` + `hub-shop-sheet-open`) are pre-existing deferred from 2026-05-23 commit `1783f8d8`, not regressions from this session.
- **Smoke (flag ON, port 3346):**
  - `/en/hub` + `/es/hub`: `GlobalStatusBar` renders `Guest`/`Invitado`, `Back to hub`/`Volver al hub`; `JourneyRail` renders `Your journey`/`Tu camino`, `Rook Badge`/`Insignia de Torre`
  - `/en/share/{badge,daily,endgame,score}` + `/es/share/*`: all 4 surfaces render their locale correctly with interpolated piece/stars/streak/moves values
- **Vercel deploy:** previous commit `0f03513` was failing on build until commit `c9133c57` shipped the eslint-disable fix. **User confirmed `c9133c57` deploy passed.** `9d7908f7` deploy status to verify next session.

---

## Deferred this session

### OG card endpoints (`/api/og/*`) stay EN-only v1

Tracked in `_bmad-output/implementation-artifacts/deferred-work.md` (gitignored, local-only). 5 endpoints, ~1112 LOC. Blockers:

1. `/api/*` outside `[locale]` segment by design — no `params.locale`
2. Endpoints don't use `useTranslations`/`getTranslations` — would need manual bundle loader (third pattern)
3. ~5 new namespaces required
4. Caller propagation surface includes share/* (migrated) + arena/* + victory/* + hub/* (NOT migrated) — adding `?locale=` from share alone leaves others inconsistent
5. Cache key must include locale (URL param OK, header not)

Recommended batch: `og-cards/*` after `arena/*` and `victory/*` land.

---

## Per-session contract (preserved from prior handoff)

1. Pick ONE surface batch from the table below.
2. Grep `from "@/lib/content/editorial"` inside the batch → enumerate namespaces.
3. **Plus:** open every file in the batch and grep raw English strings inside templates / JSX text (e.g. "Play Chesscito", "Daily Tactic", `${PIECE_LABELS[x]} Badge`). The `import editorial` audit alone is insufficient — JourneyRail and share-grid both had 9+ hidden inline strings that needed namespace expansion or new namespaces.
4. Migrate files: `useTranslations` (client) or `getTranslations` (server async). ICU for interpolated copy.
5. Update affected tests: `renderWithIntl as render` alias for minimum diff.
6. Add ES translations for that batch's namespaces in `messages/es.ts`.
7. Verify: `npx tsc --noEmit` + `pnpm lint` + `pnpm build` + `pnpm test` + smoke `/en/<route>` + `/es/<route>` with `NEXT_PUBLIC_I18N_ES_READY=1`.
8. Run `pnpm test:e2e:visual` if UI touched. 11/13 is current baseline — anything below = new regression.
9. ONE commit per batch.

---

## Remaining batches (suggested order)

| Surface batch | Files (approx) | Risk notes |
|---|---|---|
| **victory/\*** | ~8 | Contract interaction surfaces; mint flow + receipt UI |
| **trophies/\*** | ~6 | Badge sheets; mostly leaf |
| **profile + kingdom + pro** | ~10 | Sheets + chips |
| **coach/\*** | ~12 | Also needs `/api/coach/*` to accept `locale` (red-team H-4) |
| **arena/\*** | ~12 | Game UX; high-touch |
| **exercises/\*** | ~20 | Most entangled |
| **hub/\*** | ~10 | Composes everything; do last |
| **lib/\* helpers** | ~6 | Return KEYS, let consumer translate |
| **app pages** | ~12 | Per-route `getTranslations` calls |
| **og-cards/\*** | ~5 | Deferred — after arena+victory |

After all surfaces: **Stage 4** (translate remaining namespaces) + **Stage 5** (locale toggle UI, sitemap+hreflang, coach API locale, metadata localization, flag flip).

---

## Open items to address before Stage 4 flag flip

(carried forward from prior handoff, no change this session)

- **VR baselines red on hub-clean + hub-shop-sheet-open** — diagnose before flag flip; suspected `freezeDate` × `NextIntlClientProvider` paint timing
- **H-4 Coach prompts ES** — `/api/coach/*` needs `locale` param; move from Stage E E3 to part of Stage 4 so ES launch is internally coherent
- **M-1 Date/number formatting** — `useLocale()` consumer; grep `.toLocaleDateString`/`.toLocaleString`
- **M-2 Sitemap + hreflang** — `apps/web/src/app/sitemap.ts` with both locales + `alternates`
- **M-4 Internal navigation** — Stage 5 codemod from `next/link` → `next-intl/navigation` `<Link>`
- **OG card endpoints** — entire batch deferred this session (see above)

---

## Quick reload checklist for next session

1. `git pull origin main` (expect HEAD `9d7908f7` or later)
2. Read `MEMORY.md` → i18n section (updated this session)
3. Read this handoff + prior handoff `2026-05-23-i18n-stage-c-pilot-handoff.md`
4. **Verify Vercel deploy of `9d7908f7` passed** before kicking off next batch
5. Recommended next batch: `victory/*` — fresh session for contract-touching surface

---

## Files touched this session (cumulative)

```
# c9133c57 — shared-ui + redesign primitives
apps/web/src/app/dev/layout.tsx
apps/web/src/components/redesign/__tests__/tx-progress-steps.test.tsx
apps/web/src/components/redesign/journey-rail.tsx
apps/web/src/components/redesign/tx-progress-steps.tsx
apps/web/src/components/ui/__tests__/coming-soon-chip.test.tsx
apps/web/src/components/ui/__tests__/global-status-bar.test.tsx
apps/web/src/components/ui/coming-soon-chip.tsx
apps/web/src/components/ui/global-status-bar.tsx
apps/web/src/lib/content/editorial.ts        # +JOURNEY_RAIL_COPY
apps/web/src/lib/content/messages/en.ts      # post-strip ICU overrides
apps/web/src/lib/content/messages/es.ts      # cast fix + ES for 5 namespaces

# 9d7908f7 — share/*
apps/web/src/app/[locale]/share/badge/page.tsx
apps/web/src/app/[locale]/share/daily/page.tsx
apps/web/src/app/[locale]/share/endgame/page.tsx
apps/web/src/app/[locale]/share/score/page.tsx
apps/web/src/components/share/__tests__/share-grid.test.tsx
apps/web/src/components/share/share-grid.tsx
apps/web/src/components/share/share-modal.tsx
apps/web/src/lib/content/editorial.ts        # +SHARE_GRID_COPY +SHARE_MODAL_COPY +BADGE_SHARE_COPY +SCORE_SHARE_COPY + expansions
apps/web/src/lib/content/messages/en.ts      # +SHARE_COPY ICU helpers
apps/web/src/lib/content/messages/es.ts      # ES for 8 share namespaces
```

---

## Risks / known issues at handoff

- **Vercel deploy verification pending for `9d7908f7`** — first action next session
- **VR 2/13 red** — `hub-clean` + `hub-shop-sheet-open` deferred since 2026-05-23 `1783f8d8`
- **OG cards EN-only on /es** — accepted v1; deferred ledger entry in `_bmad-output/implementation-artifacts/deferred-work.md`
- **Coach API still EN** — until red-team H-4 ships in Stage 4
- **PWA manifest stays EN** — accepted v1
