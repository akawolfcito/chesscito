# Landing onboarding — nav polish + Slide 4 button pass — handoff

**Date:** 2026-07-04
**Branch:** `main` (pushed, `main` == `origin/main` @ `3871821e`)
**Cluster:** [[project_minipay_listing_feedback_2026_07]] — item 1 (landing onboarding), continuing from `docs/handoffs/2026-07-04-...` prior session (commit `995f8afa`)

## State

Session picked up right after the previous handoff (Slide 4 CTAs had just been moved inline per price row, but had lost their gold/blue bevel + icon styling and their button-vs-flat-strip contrast). Everything below landed in one commit, `3871821e feat(onboarding): enhance slide navigation and disable zoom; update CTAs and styles`, already pushed to `origin/main`.

### 1. Slide 4 CTA button restore + restructure
- Restored the real button chrome (`primary-play-cta` + `hub-scaffold-practice-cta` gold / `hub-scaffold-arena-cta` blue, bevel+shadow) that had been flattened into plain colored `<a>` labels — was the very first ask this session.
- Restructured each price row: label (bold) + price (small, muted → now green accent) on one line, description below, CTA button below that (was: label+price+button all on one row). Founder iterated the exact copy by hand mid-session:
  - `seasonPassDescription`: "Join Challenge with your"
  - `proDescription`: "Level up every match with" (typo "wit" caught and fixed to "with" during the session)
  - `enterArena` label: "Play" → "Play Chess"
- Founder did a final manual pass re-adding the piece icon inline inside the LEARN PIECES button (`primary-play-cta-piece-icon` reused, PRO button's icon stayed commented out) and repositioned icons in the price rows (ArtImage now `h-16 w-16` instead of small inline icons). That manual edit is in the pushed commit — don't revert it.

### 2. Slide 4 layout fixes
- `4 / 4` progress counter was intentionally hidden before (spec said "no progress counter" on the last slide) — changed per this session: now **always shown** (`slide-nav.tsx` no longer conditionally hides the `ProgressPill`), because hiding it made the nav row asymmetric and the back-arrow appeared to "jump" position.
- Slide 4 had a bigger gap between the top nav and the gold frame than slides 1-3, because it has no CTA button below the frame (its 2 real CTAs live inside). Fixed with an **invisible same-size placeholder** (`invisible` class, same `primary-play-cta` classes) in `ctaSlot` so `SlideShell`'s vertical centering produces an identical top gap on all 4 slides.
- Content block (`Choose your path` headline onward) moved up via `-mt-24` (was `-mt-16`) so it overlaps the avatar's lower body per founder's explicit ask — screenshot-verified against the founder's own reference image.

### 3. New: nav arrows + swipe (founder-approved: arrows+swipe yes, auto-advance no)
- New `slide-nav.tsx`: back/forward chevrons (reuses the existing `chevron-down` icon asset rotated ±90deg — no new icon files), 44px touch targets, `disabled` + `opacity-0` at the ends (slide 1 = no back, slide 4 = no forward).
- `slide-shell.tsx` gained `onSwipeLeft`/`onSwipeRight` props + touch handlers (40px threshold, ignores vertical-dominant gestures so it doesn't fight the frame's internal scroll). Had to add `"use client"` + `useRef` — safe because `WelcomeBack` (the other consumer, a Server Component) never passes those props.
- Also fixed a layout bug found while building this: the `topSlot` wrapper div lacked `w-full`, so — being a flex child of a `items-center` (not `stretch`) container — it was shrink-wrapping instead of spanning full width, which visually mis-centered the nav row.
- `onboarding-carousel.tsx`: `goBack`/`goForward` wired to arrows + swipe; the big bottom CTA button (START/NEXT) is unchanged and still the primary forward action.
- Tests: `onboarding-carousel.test.tsx` grew from 4 → 8 cases covering back/forward arrows (disabled states + navigation) and swipe in both directions.

### 4. New: selection lock + zoom disable
Ported verbatim from `apps/web` (founder: "ya lo hicimos en el app, debe ser sencillo"):
- `globals.css` `body`: `user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`; `img`: `user-drag: none`; opt-back-in via `input`/`textarea`/`[contenteditable]`/`[data-allow-select="true"]` (same escape hatch as apps/web, see [[selection-block]]).
- `layout.tsx` `viewport` export: added `maximumScale: 1, userScalable: false` (was missing — apps/web has had this since Sprint 4 commit O).
- Verified at runtime via Playwright eval: `getComputedStyle(body).userSelect === 'none'`, `touchAction === 'manipulation'`, viewport meta contains `maximum-scale=1, user-scalable=no`.

### 5. Design discussion (no code change) — Slide 4 button hierarchy
Founder asked whether the big gold bottom CTA (START/NEXT) still makes sense now that there are top nav arrows, and separately whether Slide 4's gold/blue button pairing needs work to bias users toward LEARN PIECES first.

**Agreed criteria (worth remembering, not obvious from the code):**
- Keep the big bottom CTA — mobile thumb-zone heuristic, arrows are secondary/correctional, not a replacement for the primary driver.
- The gold=LEARN PIECES / blue=PLAY CHESS choice **already does the intended nudge**: gold is the same `hub-scaffold-practice-cta` treatment as START/NEXT on slides 1-3, so by the time the user reaches slide 4 they've already learned "gold = continue" — LEARN PIECES reads as the default path, PLAY CHESS as the alternative. This wasn't a deliberate initial design intent flagged by the founder but held up as the right explanation on review.
- Proposed (not implemented, founder didn't confirm): a small ⭐ badge on LEARN PIECES (reusing the existing star asset from `Divider`) to reinforce the nudge further without adding new visual language. **Open — pick up if founder wants to revisit.**

## Verification this session
- `tsc --noEmit` clean after every change.
- Test suite: 21 → 25 → still 25 (net, some renamed) after all changes; final run 25/25 passing.
- Visual verification via Playwright screenshots at 390×844 (mobile) after every structural change: button restore, row restructure, nav arrows (orientation + disabled states on slides 1/2/4), gap-fix, avatar-overlap, and computed-style check for the selection/zoom lock.
- No `next build` run this session (dev-server + Playwright only) — worth a full `pnpm build` before considering this fully shippable, per project convention.

## Open questions / next steps
1. **Real ES copy** — `apps/landing/src/lib/content/messages/es.ts` still mirrors `en.ts` verbatim (placeholder). Still not written.
2. **⭐ badge on LEARN PIECES** — proposed, not confirmed/implemented (see §5 above).
3. Remaining 2 items in [[project_minipay_listing_feedback_2026_07]] untouched: validate save-score-onchain is gas-only, and the "full→play" simplification (Lite→"Train Pieces", Play→"Play Chess + Coach").
4. No `pnpm build` run this session — recommend running it before calling the landing onboarding surface fully done.
