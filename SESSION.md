# Session Handoff — 2026-07-04

Full detail: spec `docs/specs/landing-onboarding-slides.md` (status: implemented).

## Completed
- **Landing onboarding feature (MiniPay listing feedback item 1/3)** — `apps/landing` (`www.chesscito.com`) now serves a real onboarding at `/`:
  - First-time visitor: 4-slide carousel (client state, no history per slide), progress counter pinned to the top edge, legal footer pinned to the bottom edge.
  - Returning visitor: cookie-decided (`GET /api/enter?mode=` route handler sets `chesscito_onboarded`/`chesscito_preferred_mode`, 302s to destination) — single Welcome + START screen, no carousel, no flash (server-side decision).
  - `/classic` = the old 957-line hero, moved unchanged, outside locale routing.
  - `next-intl` scaffold (`en`/`es`, `es` is a typed placeholder mirror of `en` — no real ES copy yet).
  - Pills + CTA buttons now reuse the Hub's exact CSS (`.candy-tray-pill`/`.hub-hud-pill`, `.primary-play-cta`/`.hub-scaffold-practice-cta`/`.hub-scaffold-arena-cta`, ported verbatim from `apps/web/globals.css`).
  - Slide 4: "Learn Pieces" / "Play" (renamed from "Start Learning"/"Enter Arena") now render as small inline pills next to their matching price row (Season Pass / PRO), not as big buttons below the frame.
- Real founder assets iterated 3x (`design/landing-slides/bg-slides.png`: 1018×1768 → 1070×1264 → 980×1398, each re-optimized to png+webp+avif and the code's hardcoded aspect ratio updated to match).
- **Real mobile-viewport scroll bug found + fixed**: frame sizing by width alone produced a too-tall card on real phone viewports (browser chrome eats into `dvh`) — fixed with an explicit `min(100%, height-budget-derived-width)` CSS formula. Verified at 375×667 (smallest tested), 390×844, 390×700 (simulated chrome-eaten), and 1440×900 desktop — no scroll at any size.
- 2 new memory lessons saved: [[feedback_gitignore_design_dirname_collision]] (bare `design/` gitignore rule swallows any `public/design/` dir anywhere in the repo — land assets under `public/art/**` instead) and [[feedback_negative_zindex_bg_color_gotcha]] (`-z-10` paints BEHIND its own parent's `background-color` in real Chromium, contra naive recall — fix by making the foreground sibling `relative` too, not by going more negative).
- 27 commits, all local on `main`, **nothing pushed to origin yet**.

## Current State
- **Branch**: `main`, 27 commits ahead of `origin/main`, working tree clean.
- **Build**: `apps/landing` 21/21 tests passing, `tsc --noEmit` clean, `next build` clean.
- Founder made several direct manual edits/commits mid-session (spacing, icon sizes, copy) — all incorporated, nothing reverted.
- `next lint` was never configured for `apps/landing` (pre-existing gap, untouched this session — out of scope, not blocking).

## Next Tasks
1. **Push these 27 commits to origin** (never asked to push this session — confirm with founder before doing it, per repo's push-confirmation norm).
2. **Real ES copy** for the 4 slides — `es.ts` is currently a byte-identical mirror of `en.ts` (tracked as a watch item in the spec so it doesn't rot into permanent fake-i18n).
3. Remaining MiniPay listing feedback backlog (items 2–3, not started this session):
   - Validate save-score-onchain is gas-only.
   - "Full → play" simplification in `apps/web`: hide/retire Train Pieces (Lite) from the primary entry, rename Lite→"Train Pieces", Play→"Play Chess + Coach".
4. Desktop composition for the 4 web reference mockups (`chesscito-slide-web-{1..4}.png`) was never pixel-matched — current desktop uses a straightforward centered scale-up of the same mobile card; acceptable per spec, revisit only if founder flags a specific desktop issue.
5. Optional polish backlog: MiniPay "unknown transaction/dev mode" listing item (separate, from the earlier Victory NFT cluster) still open.

## Blockers
None.

## Notes
- Command hygiene: `git -C`/`pnpm -C`, never `cd`; one cmd per call; Write tool for files.
- **`next build`/`next start` gotcha this session**: piping `next build`'s output through `| tail -N` in this sandboxed shell silently truncated the build before it wrote `BUILD_ID`, then `next start` failed claiming "no production build" even though the route table had printed. Fix: run `next build` plain (no pipe to `tail`) or redirect to a file instead. Also hit real stale-server issues (`lsof -ti:4173 | xargs kill` + fresh `rm -rf .next` before every rebuild-and-screenshot cycle) — always fully clear `.next` and kill any lingering `next-server`/`next start` process before trusting a fresh screenshot.
- Manual QA this session was all via headless Playwright screenshots at fixed viewports (375×667, 390×844, 390×700, 1440×900) — no real device testing.
- Key files: `apps/landing/src/components/onboarding/{slide-shell,slide-bodies,onboarding-carousel,welcome-back,pill,legal-footer}.tsx`, `apps/landing/src/app/globals.css` (ported Hub CSS lives at the bottom), `apps/landing/src/lib/onboarding/{slides,types,resolve-state}.ts`, `apps/landing/src/app/api/enter/route.ts`.
