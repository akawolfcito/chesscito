# Session Handoff — 2026-07-07

## Completed (all merged to main)
- [ PR #168 ] Landing onboarding real ES copy.
- [ PR #169 ] Play Kingdom hub unification (Phase 1) — `KingdomCard` panel, CHESS TOOLS grid, "Arena"→"Play Kingdom" rename.
- [ PR #170 ] Arena account entry (Phase 2, initial).
- [ PR #171 ] PLAY mascot exact LEARN parity + smaller CHESS TOOLS icons.
- [ PR #172 ] PLAY header LEARN grammar (Peones + Account; account later removed in #173).
- [ PR #173 ] Extract `AccountSheet` → `components/account/account-sheet.tsx`; wire inline in /arena; hide account circle in PLAY hub; hide WarmUp modal on /arena.
- [ PR #174 ] AccountSheet z-[70] (later reverted — mis-diagnosis).
- [ PR #175 ] **Real fix**: account chip `z-index:20` above the ContextualHeader (was intercepting the tap → sheet never opened).
- [ PR #176 ] Account entry = LEARN pill style (avatar + "Account" + "PRO · Nd"); AccountSheet back to z-50 (aux panels sit below the dock, dock reachable on top).
- **Play Kingdom hub unification cluster CLOSED** (thread 3 of MiniPay listing feedback). Founder confirmed the /arena account sheet works on-device.

### Continuation — PLAY hub LEARN parity + Peones layering (2026-07-07)
- **PLAY hub adopts the LEARN distribution**: removed the `.play-hub-body` centered wrapper so mascot · panel · CTA · tools are direct siblings of `<main>` (flat stack). `.play-hub-scaffold` now `flex-start` + `gap:6px` + 14px gutter; header aligned to the gutter; CTA breathing `24/16`; CHESS TOOLS pinned to the floor (`margin-top:auto`) like the Training Path. Base `.hub-scaffold` (legacy FULL hub) untouched.
- **Tactics/Coach/Shop tiles → LEARN gold piece-tiles**: 78px cream retired; now the gold `.reward-tile.is-compact` look (48px, gold gradient, piece 28×30, label 0.55rem). Overrides HubActionTile's `is-locked` gray back to active gold.
- **PLAY CHESS CTA → blue clone of Start Focus**: new `.play-chess-cta` duplicates `.hub-lite-start-focus` geometry 1:1 (60px, 0 46px, radius 20px, 1.35rem, stacked bevel) in canonical blue, keeps the crossed-swords icon + haptic. Replaced `PrimaryPlayCta`. Duplicated, NOT shared — keep in sync by hand (documented in CSS).
- **Fix: Get Peones modal layering in /arena Account sheet**. The Radix `<Sheet>` slide-in `transform` trapped the modal's `position:fixed` inside the sheet (read as an "interior screen", z stuck under the dock). `VictoryPopupShell` got opt-in `portal` + `scrimZClassName` props; `GetPeonesSheet` passes `portal` + `z-[55]` → portals to `<body>`, covers the whole Account sheet (z-50), stays UNDER the dock (z-60). Arena/exercises popups unchanged (`z-[70]`, no portal).

## Current State
- **Branch**: `feat/play-hub-learn-parity-and-peones-layering` (off main @ PR #176)
- **Build**: `tsc --noEmit` clean; targeted unit tests green (play-hub 11/11, shell/sheet/card 23/23). Full-suite pass count in commit footers.
- **Uncommitted work**: this session's 2 commits (play-hub parity, peones layering fix) + this handoff.

## Next Tasks
1. **save-score-onchain gas-only validation** — thread 2 of MiniPay listing feedback, **NOT STARTED** (needs a spec first). Only remaining cluster thread.
2. (Perf) `/api/founder-status` was ~55s on the tunnel — the AccountSheet's Founder row triggers it. Consider deferring/lazy the founder read. See [[founder-status-mitigated-2026-06-03]].
3. (Coverage) No VR fixture covers `/hub` play mode or the arena account sheet — all PLAY visual QA was manual. Consider adding fixtures.

## Blockers
- None.

## Notes
- **`AccountSheet` is reusable** at `components/account/account-sheet.tsx` (13 props). Mounted in exercises (unchanged) + arena. Same sheet everywhere — no learn/play-specific content.
- **z-index rules** (learned this session, see [[feedback_zindex_sheet_and_trigger_layering]]): a sheet trigger must beat `ContextualHeader` (z-10); aux/destination sheets open at z-50 BELOW the dock (z-60) so the dock stays on top; only ProSheet-type uses `z-[70]`.
- **Debugging connected flows**: injected an EIP-1193 provider from `ONLY_TEST_NO_FUNDS_PK` (`.env.local`, gitignored) via Playwright — key stays in Node, only the address is injected. This is how the tap-interception bug was found.
- `.next` stale cache can mask merged changes in local dev (`rm -rf apps/web/.next`) — a red herring, not a code bug.
- "PRO not updating on MiniPay" was env (ngrok origin not allowlisted) — resolved by setting `NEXT_PUBLIC_APP_URL`/`PREVIEW_URL` to the tunnel; `enforceOrigin` untouched.
- Local drive: `/hub` = FULL hub unless `NEXT_PUBLIC_CHESSCITO_MODE=play`; LEARN needs `=learn` + `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true`. Playwright scripts run from `apps/web`.
- Specs: `docs/specs/play-kingdom-hub-unification{,-redteam}.md`. Memory: `project_play_kingdom_hub_2026_07.md` + `feedback_zindex_sheet_and_trigger_layering.md` + MEMORY.md index.
