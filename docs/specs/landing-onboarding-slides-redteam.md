# Red Team Review — landing-onboarding-slides

**Date**: 2026-07-04
**Reviewer mindset**: hostile QA + senior engineer

## Findings

### P0 — Must address before implementation
- [middleware conflict] The spec asserts locale middleware and onboarding
  logic "won't conflict" because onboarding lives inside the server
  component, not middleware — but `next-intl`'s middleware itself decides
  whether `/` gets rewritten/redirected for locale BEFORE the server
  component ever runs. If `localePrefix: "as-needed"` triggers a redirect
  for a non-default locale (e.g. `/` → `/es`), the returning-visitor cookie
  read happens on the SECOND request, not the first — meaning the cookie
  logic works, but the "no flash" claim in Behavior #4 is only true for the
  default locale. Non-`en` returning visitors get a real navigation hop
  before the no-flash render. Spec must say this explicitly or design
  around it (e.g. skip the redirect for `/` specifically via middleware
  matcher).
- [route collision] `/classic` as a plain top-level route will ALSO be
  swept into `next-intl`'s locale routing (middleware matcher typically
  matches all paths minus `_next`/api by default) unless explicitly
  excluded. The spec says "`/classic`... stays Spanish-only, out of
  next-intl's locale list or explicitly excluded via middleware matcher" —
  this is stated as an either/or without picking one. Pick one now:
  excluding `/classic` from the middleware matcher is the only option that
  actually keeps it un-prefixed and un-redirected; "out of the locale list"
  doesn't accomplish that on its own. This is a P0 because getting it wrong
  either 404s `/classic` under a locale prefix or silently redirects it.
- [cookie write path unspecified] Behavior #3 says "a Server Action sets"
  the two cookies, but Next 14 Server Actions cannot both set cookies AND
  return a value used for an immediate client-side `router.push` to an
  EXTERNAL origin (`lite.chesscito.com`/`play.chesscito.com`) in the same
  atomic step the way the spec implies — a Server Action triggered from a
  Client Component can set cookies via `cookies().set()` in the action,
  but navigating to a cross-origin URL afterward requires the client to
  read the action's return value and then call `window.location.href =`
  itself (a Server Action `redirect()` only works for internal Next
  routes, not arbitrary external origins). The spec's contract needs to
  say explicitly: Server Action sets cookies + returns `{ destinationUrl }`
  → client does `window.location.href = destinationUrl`. As written, an
  implementer could reasonably (and wrongly) try `redirect(externalUrl)`
  inside the action and hit a Next.js runtime error or an unstyled crash
  page in production.
- [JS-disabled fallback contradicts external-redirect requirement] Edge
  cases demands slide-4 CTAs work via `<form action={...}>` with JS
  disabled. But per the P0 above, reaching an EXTERNAL origin from a form
  action's Server Action still needs a client-side `location.href` hop —
  which does NOT work with JS disabled. So the "graceful JS-disabled
  fallback" acceptance bar is currently impossible for slide 4 as specified
  (it CAN work for slides 1-3, which stay same-origin). Spec must either
  (a) accept slide 4 requires JS for the external navigation, with a plain
  `<a href={PLAY_URL}>`/`<a href={FULL_URL}>` as a NON-JS fallback that
  skips the cookie write entirely (degraded but functional), or (b) proxy
  the redirect through an internal route handler (`/api/enter?mode=learn`)
  that sets the cookie AND does a real HTTP 302 to the external URL —
  this DOES work without JS. Recommend (b); it's strictly better and still
  simple.

### P1 — Should address
- [test runner scope creep risk] "Setup Vitest+RTL real for this feature"
  is a meaningfully-sized side quest (new config, new deps, new CI
  awareness if `apps/landing` isn't in the current test-run matrix) bolted
  onto a UI feature spec. Acceptance criteria bundle "runner works" with
  "feature works" — if the runner setup stalls (e.g. path alias issues,
  jsdom/react version clash with this app's exact pins per
  `feedback_exact_version_pins`), the whole feature is blocked. Recommend
  treating runner setup as its own first TDD increment/commit, gated
  separately before writing feature tests against it.
- [history/back-button behavior underspecified] Edge cases says "don't
  push history per slide" but doesn't say what SHOULD happen. If slide
  state is pure client state with no URL reflection at all, a user who
  reaches slide 3, hits browser Back, lands wherever they were before `/`
  (e.g. a search engine) — losing their place entirely, with no way to
  resume slide 3 via Back/Forward. That may be fine, but the spec should
  say it's an accepted tradeoff, not leave it implicit. Also: does
  reloading the page mid-carousel (slide 3, tab refresh) reset to slide 1?
  Spec doesn't say — reasonable default is yes (no per-slide persistence),
  but it should be an explicit behavior line, not inferred.
- [`preferredMode` cookie never updates after first choice] Once
  `chesscito_preferred_mode` is set, nothing in this spec ever changes it
  again — a returning user who taps "Not sure? See other modes" and then
  manually navigates to the OTHER mode from `/classic` still gets routed to
  their OLD preferred mode on their next `/` visit forever. Is that
  intended (first choice is sticky for life, only changeable by clearing
  cookies) or should landing on the other product surface at least once
  update the preference? Spec should state this is intentionally
  one-and-done, or add a mechanism.
- [desktop breakpoint choice mismatched to project convention] Spec uses
  `≥768px` matching `landing-page.tsx`'s existing `md:` Tailwind breakpoint
  — reasonable, but note this directly conflicts with the broader
  CLAUDE.md rule "Desktop no es prioridad" which the spec correctly scopes
  as apps/web-only (not apps/landing) — worth a one-line callout in the
  spec itself (not just this review) so a future reader doesn't assume the
  global rule applies here and skip desktop QA.
- [no error state for cookie-write failure surfaced to spec's acceptance
  criteria] Edge cases describes falling back gracefully if the cookie
  write fails, but no acceptance criterion actually tests "cookie write
  throws → user still reaches destination." Add one.
- [`WHY_PAGE_COPY` reuse un-addressed] `editorial.ts` in `apps/landing`
  also exports `WHY_PAGE_COPY`, consumed somewhere in the existing page.
  Spec doesn't confirm whether `/classic` still imports it unchanged (it
  should — Non-goals implies yes) — worth one explicit line so the mover
  doesn't accidentally touch that export while relocating `landing-page.tsx`
  content.

### P2 — Nice to clarify
- [ES content placeholder risk] Shipping `es` messages as an EN mirror
  "temporarily" has a way of becoming permanent (see the existing
  `next-intl` Stage 1/2/3 comment in `apps/web`'s `request.ts`, which
  documents exactly this kind of stub outliving its intended lifespan).
  Consider a lint/test that fails if `es.ts` and `en.ts` are byte-identical
  past a certain date, or just track it as a named backlog item so it
  doesn't silently rot.
- [pill icon format] `SlidePillContent.icon` says "no extension, consumer
  picks .avif/.webp/.png" — matches the project's 3-format-per-image
  convention ([[feedback_image_three_formats]]), but the spec never
  confirms the NEW custom assets (avatars, titles, season-pass icons, the
  web background) will actually ship in all 3 formats, only that the
  component *supports* picking between them. Add an acceptance criterion:
  each new `design/landing-slides/*` asset arrives (or gets generated) in
  `.png`+`.webp`+`.avif`.
- [analytics gap acknowledged but worth a flag] Non-goals correctly
  excludes telemetry, but this is a MiniPay-listing-driving feature with a
  real conversion funnel (4 slides → mode choice) and zero instrumentation
  planned. Not blocking, but worth a backlog note so it isn't forgotten
  entirely once shipped.

## Categories audited

### Contract gaps
- `OnboardingCookieState` doesn't model the "cookie write failed" case as a
  type — it's handled procedurally in Edge cases prose only. Fine for a
  spec this size, but flag for whoever writes the Server Action that the
  return type should be a discriminated union (`{ ok: true, destinationUrl
  } | { ok: false, destinationUrl }` — destination still needed even on
  write failure, per the "navigate regardless" edge case).
- No error type exists for "invalid `mode` param" reaching the redirect
  route handler proposed in the P0 fix — should 400 or default-fallback,
  not crash.

### Behavioral ambiguity
- See P0 (middleware/redirect mechanics) and P1 (back-button, sticky
  preference) above — these are the real gaps.

### Hidden assumptions
- Assumes `PLAY_URL`/`FULL_URL` env vars are already correctly configured
  in `apps/landing`'s Vercel project for both Preview and Production — not
  verified in this spec. Confirm before relying on them for the redirect
  route handler.
- Assumes the existing `normalizeAppOrigin()` helper in `landing-page.tsx`
  is safe to import/reuse from the new onboarding code without
  side-effects — likely fine (pure function per its own docstring) but
  worth a one-line confirmation during implementation rather than assuming.

### Backward compatibility
- Moving `landing-page.tsx`'s content to `/classic` changes its canonical
  URL. Anything external (ads, social posts, MiniPay's own listing
  metadata, search engine index) pointing at `www.chesscito.com/` now hits
  the NEW onboarding instead of the old hero — likely the intended
  outcome, but the spec should note whether a redirect or canonical tag
  strategy is needed for SEO continuity, or whether that's accepted
  churn.

### Security & data
- Cookie is non-HttpOnly by design (spec says "read-only signal, not
  sensitive") — correct call, but confirm no server-side authorization
  logic ever trusts this cookie's value for anything beyond a UX
  redirect default (it must never gate access to a paid feature, since
  it's client-writable).
- No PII involved. No auth. Low risk surface overall.

### Test coverage gaps
- Acceptance criteria don't explicitly test the P0 external-redirect
  mechanism once it's redesigned per the P0 finding above — add a test
  once the route-handler approach is chosen.
- No acceptance criterion for the middleware-matcher fix for `/classic`
  (P0 above) — add one once resolved.

### Operational readiness
- No logging/observability planned for the onboarding funnel (see P2
  analytics gap) — acceptable for v1, flagged as backlog.
- Rollback plan if shipped broken: reverting to `landing-page.tsx` at `/`
  is a simple route swap (git revert), no data migration involved — low
  operational risk.

## Verdict (revised 2026-07-04)
- **READY for /tdd.** All 4 P0 findings addressed in the spec:
  (1) Behavior #9 now states the non-default-locale one-hop tradeoff
  explicitly; (2) Behavior #9 commits to excluding `/classic` and
  `/api/enter` from the middleware matcher; (3)+(4) Contracts + Behavior #3
  replaced the Server Action with a `GET /api/enter?mode=` route handler
  (cookie write + real 302), which fixes both the external-redirect
  mechanics and the JS-disabled fallback in one shot.
  All 6 P1s addressed: test-runner-as-separate-commit, explicit
  reload/back-button behavior (#10), sticky-preference documented as a
  Non-goal, desktop-priority scope callout added to Behavior #7,
  cookie-write-failure + invalid-mode acceptance criteria added,
  `/classic`'s unchanged `editorial.ts` imports called out explicitly.
  P2s (ES-placeholder decay, 3-asset-format criterion, analytics gap) also
  folded in as acceptance criteria / backlog notes.
- Original findings below, kept for iteration history.

- **Superseded** — 4 P0 findings, all resolvable with small spec edits
  (no architecture rewrite needed): (1) state explicitly that non-default
  locale returning visitors get one navigation hop, not zero; (2) commit to
  excluding `/classic` from the i18n middleware matcher; (3) redefine the
  slide-4 cookie-write-then-navigate contract to return a destination URL
  the client navigates to (not a Server Action `redirect()` to an external
  origin); (4) replace the JS-disabled form-action approach for slide 4
  specifically with an internal `/api/enter?mode=` route handler that sets
  the cookie and issues a real 302 — this fixes both the JS-disabled
  fallback AND the external-redirect problem in one shot.
