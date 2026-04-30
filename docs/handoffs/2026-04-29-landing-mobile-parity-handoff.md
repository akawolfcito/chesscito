# Handoff — Landing mobile parity

**Date**: 2026-04-29
**Branch**: `main`
**Commit**: `9e39eec — style(landing): improve mobile parity with desktop`
**Push**: ✅ to `origin/main`

## Context

User reported: console error `Failed to load script from /684266321c090098/script.js`
plus a request to make the mobile landing match desktop quality. Console error
diagnosed as benign (Vercel Web Analytics not enabled in project settings — the
client tries to fetch the script but the route 404s). User opted to fix mobile
parity instead of debugging analytics.

## What changed

`apps/web/src/components/landing/landing-page.tsx`
`apps/web/src/components/landing/phone-stack.tsx`

| Surface | Mobile fix |
|---|---|
| Hero | `text-3xl` → `text-[1.75rem] leading-[1.1]`; eyebrow tracking `0.18em` → `0.12em`; subcopy `text-base` → `text-[0.95rem]`; CTAs lose `max-w-[320px]` → real `w-full`; padding `py-12` → `pt-6 pb-10` |
| PhoneStack | Secondary phone `hidden md:block` — mobile shows only the primary frame; removed `mobileOffset` and `-mt-6` overlap (no longer needed) |
| Plans grid | Mobile becomes a horizontal `snap-x snap-mandatory` carousel; each tier `min-w-[72%]` so the next card peeks; desktop keeps 2/4-col grid |
| SectionRow | When `imageOnLeft=true`, mobile reorders to text-first via `order-1/order-2`; desktop alternation preserved |
| Final CTA | Buttons full-width mobile (`max-w-[420px]`), `w-auto` desktop |
| Vertical density | All intermediate sections `py-12` → `py-10` (mobile only; `md:py-20` unchanged) |

## Validation

- **Playwright at 390×844 (iPhone 14)**: 11 sectional screenshots captured before
  and after; visual evidence shown to user mid-session.
- **Total page scroll**: 9398px → 8937px (~5% reduction).
- **`pnpm type-check`** (next build + tsc --noEmit): pass.
- **`pnpm test:e2e:visual`**: 18/18 passing (9 mobile + 9 desktop projects).
  No desktop regressions.

## Open issues NOT addressed (deferred per user's "B" choice)

These were detected during the audit. User opted to commit the layout fixes
and defer copy cleanup to a separate session.

1. **Image `pre-chess-exercise` repeats 3x** on the page: hero secondary
   (now hidden on mobile, still visible on desktop), §3 preChess SectionRow,
   §3 Cognitive section. Visually monotonous.
2. **Title duplication**: §8 Impact (`LANDING_COPY.impact.title`) and §6
   Sponsors (`WHY_PAGE_COPY.sponsors.title`) both render
   *"Construido para impacto."*. Visible on desktop and mobile.
3. **§3 preChess SectionRow** is marked legacy in the code:
   `// §3 (legacy preChess block — image LEFT, text RIGHT on desktop). Will
   migrate to LANDING_COPY.solution in C9.` Candidate for removal.
4. **Vercel Web Analytics 404**: enable in Vercel dashboard → Project →
   Analytics → Enable, or remove `<Analytics />` from `apps/web/src/app/layout.tsx`.

## Suggested next step

Pick (3) first: removing the legacy §3 preChess block automatically resolves
one of the two `pre-chess-exercise` repetitions and shrinks scroll further.
Then rename `WHY_PAGE_COPY.sponsors.title` to break the duplication with
§8 Impact (e.g., *"Apoya el experimento."* or similar — keep §8 as the
"Construido para impacto" anchor).

## How to resume

```bash
cd apps/web
pnpm dev                           # local dev server
pnpm test:e2e:visual               # regression suite (18 snapshots)
pnpm type-check                    # build + tsc
```

To re-run the manual mobile audit:

```bash
npx playwright-cli -s=mobile open --browser=chrome
npx playwright-cli -s=mobile resize 390 844
npx playwright-cli -s=mobile goto http://localhost:3000/
# capture screenshots via run-code
npx playwright-cli -s=mobile close
```
