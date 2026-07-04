# Spec — landing-onboarding-slides

**Date**: 2026-07-04
**Status**: draft

## Problem
MiniPay's listing reviewer flagged (call feedback, 2026-07-03) that Chesscito's
current public landing (`apps/landing`, `www.chesscito.com`) doesn't have a
simple onboarding, doesn't surface Privacy/Terms/Support prominently, and
that the app's first-run experience can feel overwhelming for new users. The
existing landing page (`landing-page.tsx`, 957 lines, single long-scroll
hero) doesn't orient a first-time visitor toward a specific entry point
(Train Pieces vs Play + Coach) and re-explains the same thing to every
visitor on every visit.

## Goal
`www.chesscito.com` (`/`) greets first-time visitors with a 4-slide
onboarding carousel that ends in an explicit choice (Train Pieces vs Play +
Coach), persists that choice, and greets returning visitors with a single
simplified welcome screen that routes them straight to their prior choice —
no repeated carousel, one tap to re-enter.

## Non-goals
- Redesigning `/classic` (the current 957-line hero) beyond moving it off
  `/` — its content, copy (Spanish), and lack of i18n are untouched.
- Any change to `apps/web` (the in-app product). This is `apps/landing`
  only.
- Full i18n migration of the rest of `apps/landing` beyond what the new
  onboarding route needs (see Open Questions).
- Building the "full → play" in-app rename (Lite → "Train Pieces", Play →
  "Play Chess + Coach") — that's a separate, larger `apps/web` effort
  tracked in [[project_minipay_listing_feedback_2026_07]]; this spec only
  needs the *destination URLs* to be correct today.
- Ever updating `preferredMode` after slide 4's initial choice. It is
  sticky for the life of the cookie (1 year) — visiting the other product
  surface later does not change it. Only clearing cookies resets a
  visitor to "first-time."

## Contracts (SDD)

```ts
// apps/landing/src/lib/onboarding/types.ts

export type PreferredMode = "learn" | "play";

export interface OnboardingCookieState {
  /** true once the user has completed OR explicitly chosen a mode on slide 4 */
  onboarded: boolean;
  preferredMode: PreferredMode | null;
}

export const ONBOARDING_COOKIE = {
  onboarded: "chesscito_onboarded",
  preferredMode: "chesscito_preferred_mode",
} as const;

// Cookie attributes: Path=/, SameSite=Lax, Max-Age=31536000 (1y), no HttpOnly
// (read-only signal, not sensitive). Single write path: the GET route handler
// below — never written from client JS or a Server Action directly.

export type EnterMode = PreferredMode;

/**
 * GET /api/enter?mode=learn|play
 * Sets both onboarding cookies (best-effort — failure doesn't block the
 * redirect) then issues a real HTTP 302 to PLAY_URL (learn) or FULL_URL
 * (play). Plain <a href="/api/enter?mode=..."> links to this route work
 * identically with or without client JS, and correctly cross-origin-redirect
 * (a Server Action cannot `redirect()` to an external origin).
 * Invalid/missing `mode` → 302 to `/classic` (safe default, never a 500).
 */

export interface SlidePillContent {
  icon: string; // public/ path, no extension (consumer picks .avif/.webp/.png)
  label: string;
  sublabel?: string;
}

export interface SlideContent {
  step: 1 | 2 | 3 | 4;
  avatarSrc: string;
  titleSrc: string; // pre-rendered title graphic, not text
  headline: string;
  support: string;
  pills: SlidePillContent[];
  footerNote: string; // e.g. price disclaimer or "Train pieces first..."
  ctaLabel: string; // "START" (slide 1) | "NEXT" (2,3) | n/a (slide 4 has 2 CTAs)
}
```

```ts
// apps/landing/src/lib/content/messages/{en,es}.ts — next-intl message shape
// (mirrors apps/web's lib/content/messages/*.ts convention)

export interface OnboardingMessages {
  slide1: { headline: string; support: string; learnPill: string; playPill: string; cta: string };
  slide2: { headline: string; support: string; passportLabel: string; passportSub: string; seasonPassLabel: string; footnote: string; cta: string };
  slide3: { headline: string; support: string; savedGamesPill: string; coachProPill: string; proPill: string; cta: string };
  slide4: { headline: string; support: string; startLearning: string; enterArena: string; seasonPassPrice: string; proPrice: string; footnote: string; notSureLink: string };
  welcomeBack: { cta: string; notSureLink: string };
  legal: { privacy: string; terms: string; support: string };
}
```

## Behavior

1. Given a visitor with no `chesscito_onboarded` cookie, when they load `/`,
   then the server component renders slide 1/4 of the carousel with a
   progress pill ("1/4") and no Skip control.
2. Given the visitor is on slide N (1-3), when they tap the CTA button
   (labels: slide 1 = "START", slides 2-3 = "NEXT"), then the client
   navigates to slide N+1 without a full page reload (client-side state,
   same route, no `?slide=` query param needed — see Edge cases for
   back-button behavior).
3. Given the visitor reaches slide 4, when they tap "Start Learning" or
   "Enter Arena" — rendered as plain `<a href="/api/enter?mode=learn">` /
   `<a href="/api/enter?mode=play">` links, never `onClick`-only handlers —
   then the browser hits `GET /api/enter`, which sets
   `chesscito_onboarded=true` + `chesscito_preferred_mode=<mode>` and
   issues an HTTP 302 to `PLAY_URL` (learn → Train Pieces /
   lite.chesscito.com) or `FULL_URL` (play → Play + Coach /
   play.chesscito.com). No Server Action, no client-side `location.href`
   hop — works identically with or without JS.
4. Given a visitor WITH `chesscito_onboarded=true`, when they load `/`, then
   the server component reads the cookie server-side (no client flash) and
   renders only the slide-1 visual (avatar + title + headline, no pills, no
   progress counter) with a single "START" CTA — also a plain
   `<a href="/api/enter?mode={preferredMode}">` — plus a small "Not sure?
   See other modes" text link (`<a href="/classic">`) below the button.
5. Given a returning visitor taps "Not sure? See other modes", then they
   navigate to `/classic` (the existing marketing page) — this is NOT a
   re-entry into the carousel (explicitly rejected option, see Open
   Questions history).
6. Given any visitor, when on any slide (1-4) or the returning-visitor
   welcome, then Privacy / Terms / Support links are always visible in the
   footer, separated by a CSS-drawn dot (no image asset).
7. Given a visitor on desktop/wide viewport (≥768px, matching the project's
   existing `md:` breakpoint convention in `landing-page.tsx`), when any of
   the above states render, then the layout uses the wide composition from
   the 4 web reference images (`design/landing-slides/chesscito-slide-web-{1..4}.png`)
   instead of the mobile single-column card — same copy/content contracts,
   different visual composition per breakpoint. Background for all 4 web
   slides is `design/landing-slides/bg-slides-web.png` (replaces
   `art/bg-wallpaper-lite.png`, which stays mobile-only). Note: the
   project-wide "desktop is not a priority" rule ([[chesscito-visual-first]]
   context, CLAUDE.md) applies to `apps/web` (the MiniPay in-app product)
   only — `apps/landing` serves the public `www.chesscito.com` site, viewed
   on real desktop browsers, so desktop QA here is required, not optional.
8. Given the existing `/` content (`landing-page.tsx`), when this ships,
   then it becomes reachable only at `/classic`, unchanged in content/copy/
   language (Spanish, no next-intl).
9. Given locale detection (`next-intl` middleware, `en`/`es`, mirroring
   apps/web's `routing.ts` pattern — default `en` un-prefixed, `es` gets
   `/es` prefix), when a visitor hits `/` or `/es`, then the onboarding
   renders in the resolved locale. `middleware.ts`'s `matcher` **explicitly
   excludes `/classic` and `/api/enter`** (committed decision, not "or") so
   neither is ever locale-prefixed or redirected by next-intl.
   **Known tradeoff, accepted for v1**: a returning visitor whose browser
   resolves to `es` (non-default) takes ONE navigation hop — `/` → `/es`
   (next-intl's own locale redirect) → the no-flash cookie-based render
   happens on that second request. Only default-locale (`en`) returning
   visitors get a true zero-hop render. See Open Questions.
10. Given a visitor reloads the page while mid-carousel (on slide 2, 3, or
    4), then the carousel resets to slide 1 — slide position is pure
    client state, never persisted or reflected in the URL. Given a visitor
    presses browser Back from any slide, then they leave `/` entirely
    (whatever page they were on before), not step back one slide — no
    per-slide history entries are pushed.

## Edge cases
- **Cookie blocked/disabled**: `/api/enter`'s `Set-Cookie` header is
  silently dropped by the browser → functionally identical to "always
  first-time visitor" on the next load. The 302 to the destination URL
  happens regardless — it's a plain redirect response, not conditioned on
  the cookie write succeeding. No special-case code needed.
- **Partial/corrupt cookie** (`onboarded=true` but `preferredMode` missing
  or an invalid value): treat as NOT onboarded — fall back to the full
  first-time carousel rather than crashing or guessing a destination.
- **Browser back button / reload mid-carousel**: see Behavior #10 — reload
  resets to slide 1, Back leaves `/` entirely. No per-slide history or URL
  state, by design (v1 scope; not a bug to fix later without a deliberate
  decision to add it).
- **JS disabled**: slides 1-3 advance via client state (`onClick`) and
  require JS — accepted degradation for v1, since MiniPay's in-app WebView
  and virtually all landing-page traffic runs JS. Slide 4's two CTAs and
  the returning-visitor CTA are plain `<a href="/api/enter?mode=...">`
  links regardless — these work standalone with zero JS, satisfying the
  actually-important case (a user reaching their destination).
- **Invalid `mode` on `/api/enter`** (missing, mistyped, or tampered query
  param): 302 to `/classic` — never a 500, never guesses a destination.
- **Middleware ordering**: locale detection stays in `middleware.ts`
  (required by next-intl) with `/classic` and `/api/enter` excluded from
  its matcher (Behavior #9); onboarding-cookie branching happens INSIDE the
  `/` server component (plain `cookies()` read, no middleware redirect) —
  avoids a second redirect hop for the default locale, accepts one hop for
  non-default locales (Behavior #9).
- **Desktop reference images not yet reviewed by implementer**: only file
  paths were provided, not visual content, at spec time — see Open
  Questions.
- **`21-day-challente-title.png` filename**: confirm exact spelling before
  implementation (see Open Questions) — using a wrong filename fails
  silently as a broken `<Image>` in dev, easy to miss.

## Acceptance criteria
- [ ] `apps/landing` has a working Vitest + RTL setup (`vitest.config.ts`,
      `vitest.setup.ts`, `package.json` scripts) mirroring `apps/web`'s
      config, with at least one passing smoke test proving the runner
      works. **Ships as its own preceding commit**, before any
      feature-specific test is added — if runner setup stalls, it blocks
      itself, not the whole feature.
- [ ] Unit/component tests cover: slide-to-slide advance (1→2→3→4), slide 4
      mode selection writes the correct cookie values, returning-visitor
      render path (cookie present → welcome-only, no carousel), corrupt-
      cookie fallback (→ full carousel), reload-mid-carousel resets to
      slide 1, and correct destination URL per mode.
- [ ] `GET /api/enter?mode=learn|play` sets both cookies and issues a real
      302 to the correct destination URL; a test simulating a cookie-write
      failure still asserts the 302 fires to the correct URL; a test with
      an invalid/missing `mode` asserts a 302 to `/classic` (never a 500).
- [ ] `next-intl` is wired in `apps/landing` (`routing.ts`, `request.ts`,
      `middleware.ts`, `lib/content/messages/{en,es}.ts`) scoped to the new
      onboarding route only; `en` is default/un-prefixed per the
      `apps/web` convention already established; `middleware.ts`'s matcher
      excludes `/classic` and `/api/enter`.
- [ ] `/classic` serves the exact current `landing-page.tsx` content,
      unchanged — including its existing imports of `WHY_PAGE_COPY` /
      `LANDING_COPY` from `editorial.ts`, untouched — reachable and
      indexable (not noindex'd unless explicitly decided).
- [ ] `/` serves the new onboarding for both first-time and returning
      visitors per the cookie state machine above, on mobile AND desktop
      breakpoints.
- [ ] Privacy/Terms/Support links present and correctly linked on every
      onboarding state (all 4 slides + returning-visitor welcome).
- [ ] Every new `design/landing-slides/*` asset (avatars, titles, icons,
      the web background) ships in `.png` + `.webp` + `.avif`.
- [ ] `pnpm -C apps/landing type-check` and `pnpm -C apps/landing build`
      pass clean.
- [ ] Manual QA pass in a real mobile viewport (390px) AND a desktop
      viewport, both `en` and `es` locales, both first-time and
      cookie-primed (returning) states.

## Out of scope / future
- In-app `apps/web` rename cluster (Lite→"Train Pieces", Play→"Play Chess +
  Coach") — separate spec.
- i18n migration of `/classic`.
- A/B testing or telemetry on carousel completion/drop-off (no analytics
  wired in this spec) — flagged as a real gap for a MiniPay-listing-driving
  conversion funnel, worth a follow-up backlog item.
- "Not sure? See other modes" landing anywhere other than `/classic`.
- **Watch item**: if `es.ts` ships as a byte-for-byte mirror of `en.ts`
  (see Open Questions), track it explicitly as backlog so it doesn't rot
  into permanent fake-i18n the way `apps/web`'s Stage-1 message stubs
  nearly did.

## Open questions
- **Desktop composition**: I have file paths for
  `design/landing-slides/chesscito-slide-web-{1..4}.png` but haven't seen
  their contents in this conversation. Implementation will use a
  straightforward centered/scaled adaptation of the mobile card (consistent
  with `landing-page.tsx`'s existing `md:` patterns) as a placeholder until
  the actual images are shared or reviewed — flag for a follow-up visual QA
  pass once real assets land.
- **`21-day-challente-title.png`**: confirm this is the real filename
  (vs. a typo for "challenge") before implementation.
- **i18n scope**: does `es` need its own copy for these 4 slides written
  now, or ship `en`-only content behind the `en`/`es` routing scaffold
  (with `es` messages temporarily mirroring `en` as a placeholder)? Spec
  assumes the latter (ship scaffold + EN content, ES content is a fast
  follow) unless told otherwise.
- **`/classic` indexability**: should search engines still index `/classic`
  (currently the only page, presumably already indexed), or `noindex` it
  now that `/` is the canonical entry?
- **Cookie consent**: does a non-essential preference cookie
  (`chesscito_preferred_mode`) require a consent banner under the site's
  current privacy posture? Out of scope to resolve here, flagged for the
  founder / Terms doc.
