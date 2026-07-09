# Handoff — Landing slides 1/2/3 redesign (2026-07-08)

**Status:** SHIPPED. PR [#185](https://github.com/akawolfcito/chesscito/pull/185) merged to `main` as `d3dd8f59`. Branch deleted (remote + local). Working tree clean.

## What shipped

Onboarding carousel in `apps/landing`. Slide 4 shipped earlier in #184 and was untouched except its CTA label.

| Surface | Before | After |
|---|---|---|
| Slide 1 | "Turn chess into your daily focus ritual." | **"Two ways into chess."** + mode pills with sublabels (`From zero` / `Full matches`) |
| Slide 2 | "Build a daily chess habit." + Season Pass pill + PRO footnote | **"Decide better in 21 days."** + Focus Passport pill + price line |
| Slide 3 | "Play free. Upgrade for Coach PRO." + gold PRO pill | **"Coach PRO includes the Season Pass."** + 2 pills + price line |
| CTA sequence | START, NEXT, NEXT, Learn Pieces | **NEXT, NEXT, NEXT, START** |
| Welcome Back | rendered `slide1.headline`, no `fantasy-title`, wordmark `h-14 w-6/12`, avatar `w-48` | own `welcomeBack.headline` ("Your board is waiting."), `fantasy-title`, `h-12 w-auto`, avatar `w-56` |

## The reasoning that drove it

Slides 2 and 3 have a NEXT button. **There is no buy button anywhere in the carousel**, and the onboarding cookie routes returning visitors straight past it via `welcome-back.tsx`. These screens never convert: they plant one idea the visitor must recognize weeks later, when the paywall appears in-game. One idea per screen. Founder chose **decision making** as slide 2's surviving idea (habit, focus, wellbeing, scatter all cut).

Slide 3's "Play free" reinstated one screen earlier the exact price inversion slide 4 was rebuilt to remove: read "free" on 3, then on 4 we recommend Learn, which runs through a $0.99 Season Pass.

Prices stopped being pills. A pill is a thing you own; a price in the same tray as `Focus Passport` reads as the same category of thing.

## Bugs found and fixed on the way

1. **`pill.tsx` hierarchy inverted** — label `0.6rem`, sublabel `0.7rem`, `opacity-80` on the larger. `21 focus days` outweighed `Focus Passport`. Only slide 2 used sublabels, so nobody saw it.
2. **Sublabels wrapped and centered** — `SlideShell` sets `text-center`; the pill's `items-start` aligns the two spans *as boxes*, not the text inside them, so a wrapped line centers under a left-aligned label. Fixed with `text-left` + icon `2.3rem` → `1.9rem`.
3. **`welcome-back.tsx` borrowed `slide1.headline`** — one string greeting a returning player and orienting a stranger. Its wordmark was `h-14 w-6/12`; `ArtImage` is `object-contain`, so the width cap bound before the height did and the art rendered small (not stretched, as first assumed).

## Verification

- 36 tests passing (8 files), up from 35. `pnpm -C apps/landing test`.
- `pnpm -C apps/landing exec tsc --noEmit` clean. `pnpm -C apps/landing build` green.
- Driven in Chromium at 390px: slide 1 EN + ES (`Partidas reales` is the longest sublabel), slide 4, Welcome Back with cookies set.
- Copy has no em/en-dashes. `en.ts` + `es.ts` changed together; `es.ts` is typed against `OnboardingMessages`, so key drift cannot compile.

**Verification gotcha hit:** the first Welcome Back screenshots came from a stale `next start` still holding port 3117 while the new server died with `EADDRINUSE`. `pkill -f "next start"` did not kill the node child. Always confirm `lsof -ti:<port>` is empty before trusting a screenshot.

## Known, accepted

- **Dead cream in the lower third of the frame** on slides 2/3 after removing the footnote and the gold pill. Founder reviewed screenshots and called it imperceptible. Lever if it ever matters: `justify-center` on `SlideShell`'s content box, which also moves slide 4 (depends on `mt-10` to clear the frame's crown).
- **`next lint` is unconfigured in `apps/landing`** — prompts for an ESLint config interactively and exits 1. Pre-existing. That app has no lint gate.
- `.onboarding-pill--gold` was deleted with the gold PRO pill. Recover from git if a gold treatment is wanted.

## Artifacts

- `docs/specs/2026-07-08-landing-slides-123-goals.md` — founder's goal per screen.
- `docs/specs/2026-07-08-landing-slides-123-ux-critique.md` — Sally's critique.
- `docs/specs/2026-07-08-landing-slides-123-redesign-spec.md` — copy tables + code changes.

## Next session

Founder to pick the front. Open, in priority order as last discussed:

1. **MiniPay Lote 2.5** — Tactical Day Gift + Proof of Consistency. Spec ready: `docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`.
2. **On-chain smokes pending founder's device** — PLAY win-save permit; LEARN Claim Badge / Save Score / Get Peones / Shop-Shield. Map: `reference_play_learn_onchain_tx_map`.
3. **LEARN/PLAY backlog items 1–11** — `docs/backlog/2026-07-08-lote2-smoke-findings-learn-play-backlog.md`, plus the PLAY dock 4-slot.

## Open questions

- Does the LEARN "Save proof" golden CTA still need an on-device smoke? (P1 was fixed in #183; the smoke was never run.)
- Stale VR baseline `hub-shop-sheet-open` still fails on `main`. It is a product-state decision (baseline expects Coach Credits + PRO $1.99 + Streak Shield $0.03; app renders PRO "Coming soon"), not a chore. Needs founder's call before `--update-snapshots`.
