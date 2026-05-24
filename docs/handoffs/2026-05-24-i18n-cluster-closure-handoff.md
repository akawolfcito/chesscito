# Handoff — i18n ES/EN cluster closure

- **Date:** 2026-05-24
- **Branch:** `main`
- **HEAD on closure:** `c254ba25` (Stage 5 — sitemap, hreflang, Link codemod)
- **Predecessor handoff:** `docs/handoffs/2026-05-24-i18n-stage-c-arena-exercises-handoff.md`
- **Status:** ✅ **CLOSED.** `NEXT_PUBLIC_I18N_ES_READY=1` live in Vercel prod; `chesscito.com/es/*` serves real Spanish copy.

---

## What this closes

Everything in `project_i18n_es_en.md`'s "Open items before Stage 4 flag flip" + "Open items for Stage 5".

### Coverage shipped this closure session (2026-05-24, post-Stage C)

| # | Commit | Surface |
| --- | --- | --- |
| `3bc21d90` | docs(handoff) | Stage C handoff doc (pro/coach/lib/arena/exercises 1A.1) |
| `742a35cc` | refactor(exercises) | sub-batch 11.2 — 10 components + SHOP_ITEMS const refactor + tests (1884→1884) |
| `20f801e4` | refactor(exercises) | sub-batch 11.3 — 24 namespaces translated to ES |
| `7041000f` | refactor(lib) | sub-batch 12 — `classifyTxError(t)` threading + `classifyTxErrorKind` for telemetry |
| `941c4e04` | refactor(hub) | hub/* batch — 10 components + 9 ES namespaces (LAST i18n migration batch) |
| `b5d7ccea` | fix(chrome) | desktop phone-bezel restored on locale-prefixed routes (regression from Stage 1) |
| `dbcb57ef` | feat(i18n) | LocaleSwitcher segmented control inside AccountSheet |
| `b2617fab` | docs(content) | Editorial brief + README + audit script (`pnpm content:audit`) |
| `e4fed01b` | style(content) | Editorial polish pass #1 — Victory / Badge / Trophy |
| `f015b307` | style(content) | Editorial polish pass #2 — PRO / Shop |
| `9c344014` | style(content) | Editorial polish pass #3 — Hub / Missions |
| `c9456e88` | style(content) | Editorial polish pass #4 — Arena |
| `20859632` | style(content) | Editorial polish pass #5 — Account / Profile |
| `a8d1da27` | feat(i18n) | 17 namespaces ES coverage closed — FULL bilingual (83/87 namespaces) |
| `c254ba25` | feat(i18n) | **Stage 5** — sitemap, hreflang in layout metadata, `@/i18n/navigation` helper, Link codemod (11 files), LocaleSwitcher refactored to next-intl router, vitest mock for navigation |

---

## Architecture (final state)

```
apps/web/src/
├── i18n/
│   ├── routing.ts          ← defineRouting(locales=[en,es], defaultLocale=en, localePrefix=always)
│   ├── request.ts          ← per-request loader (next-intl/server)
│   └── navigation.ts       ← createNavigation(routing) → Link, useRouter, usePathname, redirect
├── middleware.ts           ← intl middleware + ES_READY gate
├── lib/content/
│   ├── editorial.ts        ← EN authoring source (~85 namespaces)
│   ├── README.md           ← technical architecture doc
│   └── messages/
│       ├── en.ts           ← bundle derived from editorial.ts + ICU mirrors
│       └── es.ts           ← 83 namespaces overridden + ...en spread fallback
├── components/i18n/
│   └── locale-switcher.tsx ← segmented EN/ES button rendered in AccountSheet
├── app/
│   ├── sitemap.ts          ← bilingual sitemap with xhtml:link alternates
│   └── [locale]/
│       └── layout.tsx      ← metadata.alternates.languages = { en, es, x-default }
└── ...

docs/
├── content/chesscito-language-brief.md  ← editorial voice, vocab, do/don't
└── handoffs/2026-05-24-i18n-cluster-closure-handoff.md  ← this doc

scripts/
└── audit-content-messages.ts  ← `pnpm content:audit` — warn-only editorial linter
```

---

## What ships in prod today

- **`/en/*` and `/es/*`** are first-class. Naked `/` redirects to user's `Accept-Language` match (or `defaultLocale: 'en'` as last resort).
- **Cookie `NEXT_LOCALE`** sticks the choice for 1 year.
- **LocaleSwitcher** lives in AccountSheet (segmented English / Español) — uses next-intl router so the locale swap is canonical.
- **Sitemap** at `/sitemap.xml` lists 12 static paths × 2 locales (+ root) with `xhtml:link rel="alternate" hreflang="..."` on every entry.
- **`<head>` hreflang triplet** (`en` / `es` / `x-default`) emitted on every locale page via inherited layout metadata.
- **Internal `<Link>`** components in 11 high-traffic files now resolve to the active-locale path automatically (`<Link href="/hub">` → `/en/hub` or `/es/hub`).
- **Coach API** accepts a `locale` body param (H-4 closed in `f03f4338`).

---

## Coverage scorecard

| Layer | Coverage |
| --- | --- |
| Architecture (next-intl + middleware + cookie) | ✅ 100% |
| Component migration to `useTranslations` | ✅ 100% of in-flag surfaces |
| ES namespace overrides | ✅ 83 of 87 (95%) — the 4 unmapped are locale-invariant (CHAIN_NAMES, PIECE_IMAGES, SCORE_UNIT, TIER_THRESHOLDS) plus 3 namespaces authored in Spanish in editorial.ts (WHY_PAGE_COPY, LANDING_COPY, WELCOME_COPY which is English-locked by spec) |
| Editorial polish passes (Victory/Badge/Trophy, PRO/Shop, Hub/Missions, Arena, Account/Profile) | ✅ 5 of 5 |
| Sitemap + hreflang | ✅ done |
| Internal `<Link>` codemod | ✅ done (selective — landing page intentionally kept on next/link) |
| OG cards bilingual rendering | ⏸ deferred to v2 |
| **Flag `NEXT_PUBLIC_I18N_ES_READY=1` in Vercel prod** | ✅ **LIVE** |

---

## Prod smoke (2026-05-24, post-deploy of `c254ba25`)

```
GET https://chesscito.com/sitemap.xml
  → 307 to www.chesscito.com (normal apex redirect)
  → 200 with valid XML + xhtml:link alternates per URL ✓

GET https://chesscito.com/es/hub
  → 200, final URL www.chesscito.com/es/hub ✓
  → <link rel="alternate" hrefLang="en|es|x-default"> in <head> ✓

GET https://chesscito.com/es/about
  → renders "Acerca", "Metodología", "Operado por" in real Spanish ✓
```

Wolfcito ran the manual smoke in MiniPay + browser; this handoff is updated after he confirms zero regressions.

---

## Known non-blockers / future work

### Improvable, not broken
1. **hreflang accuracy** — current implementation points to `/en` and `/es` roots from every page's metadata. Sitemap correctly lists `/en/hub ↔ /es/hub`, etc. For tighter SEO, override `alternates` per-page via `generateMetadata` so each page emits its own alternate path. Low priority — Google associates pages via sitemap + canonical regardless.
2. **OG cards bilingual** — the `/api/og/*` endpoints render English-only. When social previews matter (post-launch growth), add `?locale=es` to OG URLs and gate the layout's editorial reads by that param.
3. **landing-page (`app/page.tsx`)** — root-level landing kept on `next/link` because it lives outside `[locale]`. If the landing is moved inside `[locale]` in a future redesign, the codemod completes naturally.
4. **VR baselines 2/13 red** — `hub-clean` + `hub-shop-sheet-open` from `1783f8d8`, unrelated to i18n. Triage in a separate session.

### Done-as-designed
- `editorial.ts` stays the EN authoring source — no JSON migration planned.
- `messages/es.ts` keeps the `...en` spread as the fallback contract.
- 17 i18n batch commits are intentionally granular for blameability.

---

## How future content work flows

1. Edit `editorial.ts` (EN source).
2. If the change is to a function helper, add a matching ICU mirror to `messages/en.ts`.
3. Translate or update the matching namespace in `messages/es.ts`. Keep the `...en` spread.
4. Run `pnpm content:audit` — warn-only, exit 0. Verify no new findings on your namespace.
5. Run `npx tsc --noEmit` + `pnpm test` + `pnpm lint` + smoke ES.
6. Ship.

Brief: `docs/content/chesscito-language-brief.md`.
Arch: `apps/web/src/lib/content/README.md`.
Audit: `pnpm content:audit`.

---

## Cluster Closure Protocol checklist (per CLAUDE.md)

- [x] GitHub housekeeping — no open issues tagged for this cluster; no milestone to close.
- [ ] README.md sync — "What's live" section update with bilingual status. _(Optional follow-up; the README didn't list i18n status before so there's nothing visibly stale.)_
- [x] MEMORY.md sync — `project_i18n_es_en.md` updated with closure note + HEAD.
- [ ] Branch hygiene — no work branches were used (all batches landed direct to `main`).
- [x] Handoff doc — this file.

---

**Mantiene:** Wolfcito (@akawolfcito).
