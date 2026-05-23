# i18n ES / EN — Design Spec

- **Date**: 2026-05-23
- **Author**: Wolfcito 🐾
- **Status**: draft (audit + plan; not yet implemented)
- **Motivation**: scale Chesscito beyond English-only so LATAM students can test the MiniPay flow in Spanish without a separate fork.

---

## 1. Audit — what we have today

Numbers measured on `main` @ 2026-05-23.

| Layer | State | Evidence |
|---|---|---|
| i18n library | **none installed** | `apps/web/package.json` has no `next-intl`, `i18next`, `@lingui/*`, `@formatjs/*`, `paraglide-js` |
| Next.js i18n config | **not wired** | No `i18n:` block in `apps/web/next.config.js`; no `middleware.ts` for locale routing; no `[locale]` dynamic segment under `apps/web/src/app/` |
| HTML lang | **hardcoded "en"** | `apps/web/src/app/layout.tsx:65` → `<html lang="en">` |
| Editorial layer | **good base, EN-only** | `apps/web/src/lib/content/editorial.ts` — 2195 lines, 88 exports. Flat dictionaries per feature (GLOSSARY, CTA_LABELS, COACH_COPY, ARENA_COPY, …) with raw EN strings |
| Inline JSX strings | **leakage present** | ~21 raw `>Sentence Case Text<` JSX nodes and ~79 attribute strings (`aria-label="…"`, `title="…"`, `placeholder="…"`) across components/app. Examples in `/coach/history`: `"Your training progress"`, `"Connect your wallet to view your Coach history."`, `"Back"` |
| Coach AI prompts | **EN-only** | `apps/web/src/lib/coach/**` prompts written in EN; responses surface to UI verbatim |
| Metadata | **EN-only** | `layout.tsx` `metadata` block has EN title/description; OG / Twitter cards in EN |
| OG images | **EN baked** | `apps/web/src/app/api/og/exercise/route.tsx` renders EN copy onto OG cards |

### 1.1 Editorial.ts structure (representative)

```ts
export const COACH_COPY = {
  yourSessions: "Training Journal",
  creditTitle: "Coach Credits",
  // … 60 more keys
} as const;
```

→ **Already keyed by message-id, not by EN string.** This is the single biggest win in the audit: the migration cost is `S * keys` value-substitution, not full key extraction.

---

## 2. Goal

Ship a switch — in-app and via URL — that flips the entire UI between EN and ES with no English fallback leakage on shipped strings. Default locale stays EN. ES targets pt-BR/LATAM Spanish (`es` / `es-419`).

Non-goals for v1:
- pt-BR, fr, or any other locale beyond EN + ES.
- Localized OG images (defer to v2 — current OG card is EN).
- Localizing the Remotion promo video voiceover (separate cluster — bilingual props already supported per `apps/video`).

---

## 3. Library choice

**Recommendation: `next-intl` (App Router + middleware mode).**

Rationale vs alternatives:

| Lib | Pros | Cons | Verdict |
|---|---|---|---|
| **next-intl** | App-Router native, RSC + Client support, message extraction CLI, ICU MessageFormat (plural/select), `getTranslations` server / `useTranslations` client; widely used in Next 14 | Adds middleware + `[locale]` segment; ~12KB client | ✅ Pick |
| react-i18next | Mature, big ecosystem | Client-side bias, awkward in RSC; manual SSR plumbing | ❌ |
| @lingui/macro | Best-in-class extraction (`<Trans>` JSX) | Babel macro + compile step adds friction with Turbopack/SWC; small community in Next 14 | ❌ |
| paraglide-js | Compile-time, tree-shakable, type-safe | Newer, less docs; full re-keying refactor required | ❌ for now |
| Custom dict (`{en: {...}, es: {...}}`) | Zero deps, full control | Reinvents middleware, plural rules, fallback chain, ICU — months of yak shaving | ❌ |

`next-intl` lets us keep our existing message-id-first dictionary shape; we just split values per locale.

---

## 4. Architecture

### 4.1 Route structure

```
apps/web/src/app/
├── [locale]/
│   ├── layout.tsx          # sets <html lang> + loads messages
│   ├── page.tsx            # → moved from src/app/page.tsx
│   ├── hub/page.tsx
│   ├── arena/page.tsx
│   ├── coach/history/page.tsx
│   └── …
├── api/                    # routes stay outside [locale]
└── middleware.ts           # next-intl locale detection + redirect
```

Locale segments: `en` (default), `es`. URL shape:
- `chesscito.com/` → 307 → `chesscito.com/en` (default) or `chesscito.com/es` (Accept-Language match)
- `chesscito.com/en/arena`
- `chesscito.com/es/arena`

API routes (`/api/coach`, `/api/sign-victory`, etc.) stay locale-agnostic. Locale is passed as a body/header field when the API response contains user-facing copy (coach explanations).

### 4.2 Message store

Split `editorial.ts` per locale:

```
apps/web/src/lib/content/
├── editorial.ts            # legacy import shim — re-exports `en` for back-compat during migration
├── messages/
│   ├── en.ts               # current editorial.ts content (rename keys: no change)
│   └── es.ts               # new Spanish dictionary, same shape as en.ts
└── locale.ts               # `Locale = 'en' | 'es'`, helpers
```

Why TS modules and not JSON: editorial.ts currently has computed values (e.g. `submitFailed: (n) => \`${n} left\``, `buildDeleteMessage(...)`). Keeping TS lets us preserve those without porting to ICU `{count, plural, …}` in this pass; we ICU-fy on demand.

### 4.3 Hook API

```ts
// Server Component
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('coach');
t('yourSessions'); // → "Training Journal" | "Diario de Entrenamiento"

// Client Component
'use client';
import { useTranslations } from 'next-intl';
const t = useTranslations('coach');
t('yourSessions');
```

The `'coach'` namespace maps to `COACH_COPY` in `messages/en.ts`. One namespace per current `*_COPY` export.

---

## 5. Migration plan

### Cluster A — Foundation (1 day)

- A1. Install `next-intl@4.x`. Pin exact version (HARD RULE).
- A2. Add `apps/web/src/middleware.ts` with locale detection (`Accept-Language` → fallback `en`).
- A3. Add `apps/web/src/i18n.ts` config (locales, default, message loader).
- A4. Wrap `RootLayout` so `<html lang={locale}>` is dynamic.
- A5. Move every route under `apps/web/src/app/` into `apps/web/src/app/[locale]/`. Keep `api/` outside.
- A6. Update internal links — `<Link href="/arena">` → `<Link href={\`/\${locale}/arena\`}>` OR adopt next-intl's `Link` helper.
- A7. CI: run typecheck + unit tests; expect ~all to pass since this is structural only.

**Deliverable**: build still ships in EN; locale segment exists but no Spanish copy yet. URL `/en/arena` works.

### Cluster B — Editorial split (1 day)

- B1. Rename current `editorial.ts` body to `messages/en.ts` (no value changes).
- B2. Generate `messages/es.ts` skeleton via codemod — same keys, EN values placeholder.
- B3. Re-export `editorial.ts` as a back-compat shim: `export * from './messages/en'` so unmigrated callers keep compiling.
- B4. Write `lib/content/locale.ts` with `Locale` type + `getMessages(locale)`.

**Deliverable**: editorial layer is locale-keyed; runtime still serves EN.

### Cluster C — Component migration (2-3 days)

- C1. Replace `import { COACH_COPY } from "@/lib/content/editorial"` with `useTranslations('coach')` in every component. Codemod-friendly because keys are stable.
- C2. Convert inline JSX strings (~21) and inline attribute strings (~79) to `t('...')` calls; add missing keys to `messages/en.ts`.
- C3. Component test suite — every Vitest test that asserts on copy must pass NextIntlClientProvider with a stub dictionary.
- C4. VR baselines — re-snapshot affected screens once EN is wired (no visual change expected).

**Deliverable**: every user-facing string flows through `next-intl`. Switching `locale` cookie shows the placeholder ES copy (still EN until D).

### Cluster D — Spanish translation pass (1-2 days, parallel with C)

- D1. Translate `messages/es.ts` end-to-end. Maintain stress-tested-for-overflow guideline (Spanish runs +15–25% longer; check 22-char title cap in `ContextualHeader`).
- D2. Manual QA pass with locale=es on every screen — capture overflow + truncation bugs.
- D3. Vocabulary glossary committed to `docs/i18n/glossary-es.md` (e.g. "rook" = "torre", "checkmate" = "jaque mate", "skill tree" = "árbol de habilidades").

**Deliverable**: full ES UI ships.

### Cluster E — Locale switch + polish (1 day)

- E1. UI: language toggle in account sheet or settings. Sets cookie + rewrites to `/{locale}` prefix.
- E2. Metadata localization in `[locale]/layout.tsx` per-locale title/description/OG description.
- E3. Coach prompts: pass `locale` to `/api/coach/*` and prepend "Respond in Spanish." to system prompt when `es`. Defer image-OG localization to v2.
- E4. Telemetry: tag analytics events with `locale`.
- E5. Docs: README, MEMORY.md, CLAUDE.md updates.

**Deliverable**: ES toggle ships to prod.

**Total estimate: 6–8 dev days** (single dev, focused). Range accounts for Spanish QA + overflow fixes.

---

## 6. Open questions (resolve before kickoff)

1. **Locale persistence**: cookie vs URL-only? Recommendation: both — URL is source of truth, cookie sticks user preference for next visit.
2. **Number/currency formatting**: keep `Intl.NumberFormat` standalone or wire through `next-intl`'s formatter? Recommendation: `next-intl` formatter for consistency.
3. **Coach prompts in ES**: do we trust the LLM to write coach feedback in Spanish that matches the gameplay terminology? Mitigation: in `messages/es.ts`, include a `coachPromptInstructions` block listing canonical piece names + tactical vocab in ES so the prompt anchors to our glossary.
4. **Founder badge marketing copy** (`/about`, `/support`, social cards): scope creep risk. Recommendation: in scope for v1, no exceptions. If a string is in the bundle, it gets translated.
5. **MiniPay store listing**: Spanish version of the form? Out of scope — store submission stays EN for v1, in-app locale switch covers the LATAM test cohort.
6. **`<DesktopAppFrame>` and `[locale]` segment**: confirm the desktop wrapper composes cleanly inside the new layout depth.

---

## 7. Risks

- **Text overflow on ES**: Spanish strings run longer; existing 22-char title cap on `ContextualHeader` and pill labels in arena will need re-validation. Mitigation: D2 manual QA on every locale=es screen, fix by abbreviating or expanding caps.
- **VR snapshot churn**: every component touching copy will likely re-snapshot. Mitigation: batch VR refresh after Cluster C lands, document drift in PR.
- **Test suite blast radius**: ~1700 unit tests; many assert on exact copy. Mitigation: provider stub returns identity (`t(k) => k`) for tests that don't care about value; targeted assertions for tests that do.
- **Coach API latency**: re-prompting for ES may hit cache misses. Mitigation: cache key includes `locale`.
- **Migration shim debt**: `editorial.ts` re-export shim must be deleted at end of Cluster C, or it rots.

---

## 8. Done definition

- `<html lang>` reflects active locale.
- Every user-facing string under `apps/web/src/` flows through `next-intl`.
- `/es/*` URL prefix renders Spanish on every screen; no English leakage.
- Coach AI feedback comes back in the active locale.
- VR baselines refreshed for both locales (EN + ES on minipay viewport).
- README + MEMORY.md updated with i18n state.
- Locale switch persists across sessions via cookie.

---

## 9. Out of scope (v2+)

- pt-BR, fr, additional locales.
- Localized OG / share-card images.
- Localized Remotion promo video.
- Localized contract revert messages (chain-level, stays EN).
- Localized error monitoring tags / Sentry breadcrumbs.
