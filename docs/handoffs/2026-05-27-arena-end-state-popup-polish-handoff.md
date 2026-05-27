# Arena End-State Popup Polish — Handoff

> **Date:** 2026-05-27 · **Owner:** Sally (UX) + Wolfcito (dev) · **Status:** shipped on `main`
> **Cluster commits:** `2a322b8b..54604915` (4 commits)

---

## Outcome

The Arena end-state popups (resigned loss + 6 win/claim states) now share a unified visual vocabulary with a premium-feeling Save Victory CTA, consistent hero treatment, and a Coach section that telegraphs value before the on-chain TX prompt.

The work was driven by Wolfcito's live MiniPay feedback after the first session against `chesscito.com`: users were tapping Save Victory, seeing the MiniPay TX prompt with no value context, cancelling, and dropping off the funnel. The polish moves the "why this is worth $0.01" into the popup itself, before the wallet prompt.

## What shipped

### Win celebration popup (`victory-celebration.tsx`) — 14 Sally passes

Final structure top-to-bottom:

```
Hero    Checkmate!  (centered, no trophy/avatar)
Stats   [⭐ Easy] [♟ N] [⏱ T]  (compact celebration unit)
Save    Yours forever.                ← micro-section telegraphs value
        A digital trophy of this match, yours for life.
        [🎁 Save Victory  $0.01]       ← cta-principal sprite + price ribbon
Coach   ─── COACH REVIEW ───
        Want a deeper look?
        Coach reviews your match and surfaces key moments.
        [Open coach insight / See key moments]   wolfcito 🐺
Escape  [Play again]  [Share]   (cream tertiary pills)
```

Key technical decisions:
- **Save Victory CTA** uses the existing `/art/hub/cta-principal.{avif,webp,png}` sprite (same as TRAIN PIECES on the hub). Sticker `save.png` icon scaled 1.25 on the left, cream-white embossed text matching `.primary-play-cta` family, $0.01 corner ribbon following the `.shop-item-tile-featured-ribbon` pattern. Border-radius dropped (sprite carries the silhouette).
- **Coach section** reuses the resign popup's `arena-result-coach-section` verbatim (kicker + body + purple pill + full-body wolf avatar). Visual cohesion across loss + win without duplicating CSS.
- **Hero** dropped the trophy lottie + 2-col grid in favor of a centered headline (`.victory-popup-hero-solo`). Trophy was static and weak; sparkles backdrop + amber CTA + wolfcito carry the celebration weight.
- **`proActive`** is now a prop on `<ArenaEndState>` + `<VictoryCelebration>` (was a `useIsProActive()` hook call inside). Lets the dev fixture render without a `WagmiProvider`.

### Other win-* variants (claiming / success / error / cancelled / timeout)

Consistency pass:
- All use `.victory-popup-hero-solo` (centered headline, no trophy).
- Error / cancelled / timeout get the `--with-kicker` variant (kicker eyebrow above headline).
- Green primary CTAs (`PLAY`, `Try Again`) stripped of internal icons — the `principalbutton.png` sprite carries the green pill, icons live only on tertiary cream pills now.
- `victory-claim-success` swapped avatar from `feroz` to `feliz` — post-mint celebration is joyful, not aggressive.
- Timeout headline split from error: kicker `STILL CONFIRMING…` + headline `Hang tight` in neutral brown (was `Error` in red). Cancelled + timeout are both `isNeutral`; only true error uses rose.

### Coach copy

`coachPillFree` shortened from `Coach explains this win` (overflowed past the wolf) to **`See key moments`**. ES: `Ver momentos clave`. PRO copy unchanged: `Open coach insight`.

### Visual regression baselines

Added 7 `vr9-arena-end-state-*` baselines under `apps/web/e2e/visual-regression.spec.ts-snapshots/`. All passing against `localhost:3002` (run with `BASE_URL=http://localhost:3002 npx playwright test e2e/visual-regression.spec.ts --project=minipay -g vr9`). Future popup PRs need to refresh these with rationale per the `vr-baseline-discipline` memory rule.

## Files touched

```
apps/web/src/app/[locale]/arena/page.tsx            +proActive forwarding
apps/web/src/app/globals.css                         +treasure pill, hero solo, save section, kicker variant
apps/web/src/app/dev/arena-end-state/{page,fixture}  +win-* variants
apps/web/src/components/arena/arena-end-state.tsx    +proActive prop, drop composedCoachPreview
apps/web/src/components/arena/victory-celebration.tsx  full rewrite
apps/web/src/components/arena/victory-claim-{error,success,claiming}.tsx  hero unify
apps/web/src/components/arena/victory-popup-shell.tsx  shared modal scrim
apps/web/src/lib/content/editorial.ts                +VICTORY_CELEBRATION_COPY keys, statusHeadlineTimeout
apps/web/src/lib/content/messages/es.ts              ES translations
apps/web/e2e/visual-regression.spec.ts               +vr9-arena-end-state-* tests
apps/web/public/art/new-assets-chesscito/fun/avatar-{asustado,feliz,feroz}.{avif,webp,png}  new assets
scripts/capture-victory-popup-flow.mjs               playwright capture harness
docs/ux-reviews/2026-05-27-victory-popup-flow/*.png  7 review screenshots
```

## Known follow-ups

1. **Save Later flow** (deferred, task #11) — surface a "Save Victory" CTA on Coach History rows + Trophy Vitrine empty state so users who cancel the in-the-moment TX can save retroactively. Reuses the same EIP-712 signing flow. ~half day of work, includes a new server route to validate the past-game payload.
2. **Dev server CSS staleness** — during this session, `pnpm dev` started serving 404 for `/_next/static/css/app/dev/layout.css` after several HMR cycles. Required `rm -rf apps/web/.next` + restart to recover. Likely a Next 14 + Tailwind JIT edge case; flag if it repeats.
3. **VR coverage on CI** — the new vr9 tests are local-only. Memory note `vr-baseline-discipline` already calls out the "CI VR job is open work" gap.

## Open questions

- Should the Coach section's PRO copy reinforce subscription value? Today `Open coach insight` is neutral. Could be `Your full analysis` or similar.
- Save Later (#11) — surface from history list, or always reachable from Trophy Vitrine empty state too? Both are valid; need a product call before building.

---

## Cluster closure checklist (per CLAUDE.md)

- [x] GitHub housekeeping — no associated milestone or issues for this polish cluster
- [x] README sync — "What's live" unchanged (UI polish, not new feature)
- [x] MEMORY.md sync — entry added under arena section
- [x] Branch hygiene — work on `main`, nothing to delete
- [x] Handoff doc — this file
