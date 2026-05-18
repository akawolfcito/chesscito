# SPEC 1 Hub Redesign — Phase 9 Candy Polish Handoff

**Date:** 2026-05-18 (same day, fourth sitting)
**Branch:** `feat/spec-1-candy-polish`
**Base:** `feat/spec-1-hub-redesign` (SPEC 1 PR #112, open against `main`)
**Worktree:** `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito-spec-1-candy-polish`

---

## Why a separate branch / PR

SPEC 1 (PR #112) deliberately scoped structure + behavior only. The visual smoke surfaced obvious candy-aesthetic gaps (Hero CTA gradient, LEARN/UNLOCK dark pills, dark onboarding card, plain SecondaryCta pill, empty-state cards on `/trophies`). This branch lands the polish in its own PR so SPEC 1 can merge or be reviewed independently of the visual pass.

## Scope (5 surfaces, 3 atomic commits)

| # | SHA | Surface | Treatment |
|---|---|---|---|
| 1 | `712662b` | LEARN / UNLOCK rails, SecondaryCta, Onboarding card, Hero CTA (amber + blue) | All in `globals.css`. Migrates from flat dark/gradient styles to the shared `candy-frame` wooden-scroll vocabulary: warm amber gradient bg, warm-brown text, brown border, gold-leaf depth shadow, depressed press feel. The blue Hero variant keeps the same wooden frame but flips the inner panel to a cool sky→deep-blue ramp so the daily-pending state still reads as carved from the same material. |
| 2 | `e127c6c` | `/trophies` empty-state cards (wallet not connected + connected with zero victories) | Translucent `bg-white/10` → `.candy-frame .candy-frame-amber`. Icons get a brown-tinted halo; copy switches to warm-brown semibold. |
| 3 | `df951a8` | `/trophies` `!configured` fallback (chain config missing — common in local dev) | Same amber wooden-scroll card with a small trophy icon halo. Replaces the bare "Trophies are offline" text. |

## Validation

### Unit suite
- 1599 passing / 46 baseline failures / 1645 total — identical to the SPEC 1 final baseline. All Phase 9 changes are visual (CSS + class swaps); no behavior tests affected.

### Visual smoke (Playwright + dev server from this worktree on port 3001)
Captures in `/tmp/spec1-candy-shots/` (compared visually against the pre-polish set in `/tmp/spec1-shots/`):

- **01 hub-fresh** — Onboarding wooden-scroll + gold "Got it" button; LEARN/UNLOCK amber pills with brown copy; Hero `START WITH PIECES`/`CONTINUE TRAINING` wooden-scroll sculpt; SecondaryCta `Enter Arena →` calm text-link with gold underline.
- **02 onboarding-dismissed** — Same chrome, card gone.
- **03 hub-with-progress** — Hero amber `CONTINUE TRAINING` (default variant) candy-frame.
- **04 daily-pending** — Hero **BLUE** `PLAY TODAY'S TACTIC` keeps the wooden border but flips the inner panel cool-blue; cream copy on blue.
- **05 trophies-candy** — Amber candy-frame card with trophy icon halo + warm-brown copy (configError fallback path in local dev; the wallet-not-connected and zero-victories paths use the same frame and were committed in step 2).

All 5 surfaces now share one material vocabulary with the rest of the candy chrome (peek cards, candy-frame-gold claim CTAs, principal-button, sheet-bg-hub backgrounds).

## Known limitations / not in scope

1. **No new component primitives.** Polish is all class swaps + CSS variable values. Future passes could extract `.hub-scaffold-hero` to a real `<HeroCta>` component with the wooden-scroll baked in; the current commit keeps it as a styled button to minimize SPEC 1 diff conflict risk.
2. **Hero blue variant is the only color outside amber.** Spec asks for amber (default/onboarding) + blue (daily-pending) only. If more states emerge (e.g. red error), they'd need their own variant.
3. **`/trophies` populated states (TrophyList / Hall of Fame / Achievements) untouched.** Those already use the existing PageSection treatment which is candy-aligned; only the empty/error fallbacks needed work.
4. **Avatar HUD chip + notif-dot** — still deferred from SPEC 1 Task 5.5. Independent of this polish pass.

## How to ship

1. PR opens against `main` (NOT against `feat/spec-1-hub-redesign`). Because `feat/spec-1-candy-polish` branches off the SPEC 1 tip, its diff against `main` includes both SPEC 1 and Phase 9. After SPEC 1 (#112) merges to `main`, this branch's diff naturally narrows to just the 3 polish commits.
2. Alternative: rebase `feat/spec-1-candy-polish` onto `main` once SPEC 1 merges, then open the PR. Cleaner diff for review.
3. Run Task 8.2 manual QA (from SPEC 1 plan §3221) — the visual changes here change *every* hub state, so the checklist now needs a "candy palette consistent" pass on the same surfaces.

## Tooling notes

- Worktree at `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito-spec-1-candy-polish`. `node_modules` installed via `pnpm install --prefer-offline` (~15s, content-addressable cache).
- Dev server on port **3001** (3000 is held by the parallel `feat/spec-1-hub-redesign` worktree).
- Test command: `cd apps/web && pnpm exec vitest run`.
- Commit signature: `Wolfcito 🐾 @akawolfcito`.

## Pre-commit hook gotcha

The repo has a pre-commit secret-scan hook that blocks any commit message containing the literal string `.env`. Mentioning environment variables in commit messages must use a phrase like "populated environment variables" instead. Already cost one retry on `df951a8`.
