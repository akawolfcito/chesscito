# Web Landing Architecture — `/` ↔ `/hub` split (delta spec)

*Den Labs / Chesscito artifact — facilitated by Samus Shepard.*

| Field | Value |
|---|---|
| Date | 2026-04-25 |
| Status | Spec v0.1 — locked, ready for sprint |
| Parent doc | [`2026-04-25-why-landing-page-design.md`](./2026-04-25-why-landing-page-design.md) |
| Type | URL architecture refactor + responsive landing redesign |
| Scope | 7 commits — see §6 |

---

## 1. Why this exists

The first landing pass shipped at `/why` as a mobile-only Spanish surface. While valid, it left two structural gaps:

1. **`/` is the play hub** — every web visitor (sponsor, parent, casual reader, search-engine crawler) lands inside the game UI, with no marketing context. Bad SEO, bad first impression, broken sponsor pitch.
2. **`/why` is hidden** — only reachable from `/about`. No web-class home for the product.

The Duolingo Chess landing demonstrates the right pattern: a public, web-responsive home page at the root with phone-frame mockups + alternating image/text sections, while the actual app lives somewhere else and is discovered after conversion.

This spec captures the URL split + responsive landing architecture that closes that gap.

---

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | URL architecture | **Full split** — `/` = landing, `/hub` = game |
| 2 | MiniPay detection | **Hybrid** — server-side User-Agent first, client-side `useMiniPay` fallback |
| 3 | `/why` fate | **Merged into `/`** — `/why` redirects to `/` |
| 4 | Layout reuse | **Reuse copy + screenshots, add desktop responsive** — `WHY_PAGE_COPY` content stays, new alternating-row desktop layout, mobile keeps the single-column flow |

---

## 3. URL map (before / after)

| Path | Before | After |
|---|---|---|
| `/` | Play Hub | **Public landing** (web responsive, Spanish copy, indexable) |
| `/hub` | (does not exist) | **Play Hub** (the actual game, mobile-first 390 px) |
| `/why` | Mobile landing | Redirects to `/` (sunset) |
| `/arena`, `/trophies` (sheet), `/about`, etc. | unchanged | unchanged. Internal back targets that pointed at `/` now point at `/hub`. |

MiniPay player flow: lands on `/` → server detects MiniPay UA → 302 to `/hub`. Web visitor flow: lands on `/` → sees landing.

---

## 4. MiniPay detection contract

Two layers; whichever fires first wins.

### Layer 1 — Server-side UA sniff (primary)

In `app/page.tsx` (server component) read `headers().get("user-agent")`. If the UA contains `MiniPay`, `Valora`, `Celo Wallet`, or any other known wallet WebView fingerprint, return a `redirect("/hub")` from `next/navigation`.

Pros: no flash, instant redirect, indexed correctly by search engines (they don't get redirected because they don't carry wallet UA).

Cons: only catches wallets that send a distinctive UA. We have logs that confirm MiniPay does, but if a wallet ships a custom build without the fingerprint, layer 2 catches it.

### Layer 2 — Client-side fallback

The landing component runs `useEffect` with the existing `useMiniPay` hook (or a thin client-only check on `window.ethereum?.isMiniPay`). If it fires inside a wallet, `router.replace("/hub")`.

Pros: catches wallets the UA sniff missed.

Cons: ~200 ms flash of landing markup before the redirect completes. Acceptable as a fallback.

### Telemetry

Both layers fire a `landing_redirect` track event with `{ via: "ua" | "client", reason: "<wallet>" }` so we can read which path triggered the redirect in the wild and tighten the UA list.

---

## 5. Responsive layout strategy

### Mobile (≤ 768 px)

Identical to the current `/why` flow: single-column scroll, max-width `--app-max-width` (390 px), candy-paper aesthetic. The phone-frame mockup is just the screenshot inside a candy frame (no chrome — there's no point framing a phone shot inside another phone).

### Desktop (≥ 768 px)

Three patterns inspired by the Duolingo reference:

1. **Hero split row** — text + CTAs left (40 %), big illustration / mockup right (60 %). Both vertically centered.
2. **Alternating image/text rows** — each subsequent section uses a 50/50 split; even rows put the image left, odd rows put it right. Creates the gentle zig-zag scroll Duolingo uses.
3. **Phone-frame mockup wrapper** — every screenshot on desktop is wrapped in a CSS-only phone chrome (rounded corners, dark border, notch, bottom indicator). No new asset needed. On mobile the wrapper collapses into a plain candy frame.

### Container

Max-width `1200 px` centered on desktop. Inside it, sections have generous vertical padding (`6rem`) on desktop, tighter (`2.5rem`) on mobile. Background remains the existing forest + cream wash so the page reads in-world.

---

## 6. Sprint plan — 7 commits

| # | Commit | What it does | Risk |
|---|---|---|---|
| 1 | `refactor(routing): extract PlayHubRoot component` | Move `app/page.tsx` body into `components/play-hub/play-hub-root.tsx`. Page still renders it. **No behavior change.** | Low |
| 2 | `feat(hub): create /hub route rendering PlayHubRoot` | New `app/hub/page.tsx` + `app/hub/layout.tsx`. Both `/` and `/hub` serve the play hub during this commit. | Low |
| 3 | `feat(landing): MiniPay detection + redirect from /` | Convert `app/page.tsx` to a server component that detects MiniPay UA and `redirect("/hub")`. Adds the client-side fallback in the (yet-to-build) landing component. | Medium — production routing change |
| 4 | `feat(landing): responsive web landing at / (hero + sections)` | Replace `app/page.tsx` content with the new responsive landing. Reuses `WHY_PAGE_COPY` and the three landing screenshots. Desktop split hero + alternating rows; mobile single column. | Medium |
| 5 | `feat(landing): phone-frame mockup wrapper` | New `<PhoneFrame>` component (CSS-only, no asset). Wraps screenshots on desktop, transparent passthrough on mobile. | Low |
| 6 | `chore(routing): point internal /-targets at /hub + redirect /why → /` | Sweep all back-buttons, Link `href`, About `backHref`, arena `backToHub`, etc. Replace `/why` with a redirect to `/`. | High — many files |
| 7 | `chore(e2e): update tests + visual snapshots for new architecture` | `e2e/visual-snapshot.spec.ts`, `e2e/secondary-pages.spec.ts`, `e2e/ux-review.spec.ts` — adjust expectations. New landing screenshots taken from desktop + mobile viewports. | Medium |

After commit 7: full TypeScript + ESLint + Vitest + Playwright pass, then PR description references this spec.

---

## 7. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Existing MiniPay bookmarks pointing at `/` get the wrong content | Hybrid detection (§4) + 302 redirect + telemetry to monitor in production |
| Internal links pointing at `/` break the back-button flow | Commit 6 sweep + grep audit before push |
| Search engines index `/hub` instead of `/` | `app/hub/layout.tsx` adds `<meta name="robots" content="noindex">` |
| Existing OG share URLs containing `/` go to landing instead of game | Acceptable — share targets are public surfaces; `/` landing is appropriate. Player-only deep links should already use `/arena`, `/trophies` (sheet), specific routes |
| Tests assume `/` is play hub | Commit 7 adjusts every assumption + adds dedicated landing tests |

---

## 8. Acceptance criteria

1. ✅ A web visitor (no MiniPay UA) navigating to `/` sees the landing with hero + sections.
2. ✅ A MiniPay player navigating to `/` is redirected (server-side) to `/hub` and lands inside the game.
3. ✅ `/hub` works as the canonical play-hub URL — bookmarkable, deep-linkable.
4. ✅ `/why` redirects to `/` with a 308 / 301 (permanent).
5. ✅ Desktop ≥ 1024 px shows alternating image/text rows. Mobile ≤ 480 px shows a single column.
6. ✅ Phone-frame mockup wraps screenshots on desktop, becomes a clean candy frame on mobile.
7. ✅ All internal back-buttons / "Back to Hub" CTAs route to `/hub`.
8. ✅ Lighthouse desktop ≥ 90 perf for `/` against a local prod build.
9. ✅ Telemetry: `landing_redirect` fires with `via` + `reason` so we can audit which detection layer caught the wallet.
10. ✅ All existing e2e + visual snapshot suites green after commit 7.
11. ✅ TypeScript clean, ESLint clean, all unit tests pass.
12. ✅ Cognitive disclaimer renders at least twice on the landing (kept from prior spec).

---

## 9. Out of scope (future work)

- English (`/en`) version of the landing.
- Video embedding, motion graphics, scroll-triggered animations.
- Sponsor logo grid.
- Investor / press kit pages.
- A/B testing the landing copy.
- Custom illustrated wolf mascot for the hero (uses existing `favicon-wolf.png` for now).
