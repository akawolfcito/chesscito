# Coach Viewer Cluster C — Handoff

**Date:** 2026-05-29 · **Branch:** main · **Range:** `28ffbfc8..1bf3acfd` (27 commits)
**Status:** Closed. Preview pushed; production promote pending VR refresh + user sign-off in MiniPay.

## What shipped

The `/coach/[gameId]` post-game visor was redesigned end-to-end across 27 commits in a single session. The starting point was an unstyled prose surface that spawned the user's 4 paint-points from the morning kickoff:

1. Board was a 56px thumbnail, not the hero.
2. Move list was infinite vertical prose — long games buried the board.
3. "Ask Coach Mint Victory Play again" rendered as one prose blob — buttons invisible.
4. No hierarchy guiding the player toward Save Victory / Analyze / Play Again.

By the end of session the visor reads as a single coherent journal page:
**Header → Board hero (~46vh) → adorno chapter-break → MOVES panel (framed data) → floating controls (replay + 3 action tiles bottom-anchored).**

## Commit breakdown

The work split into three phases. Granular per CLAUDE.md hard rule.

### Phase 1 — Structural primitives (commits 3e25b82c → fb33341f)

Built the spec-mandated state machine + visual foundation. Each commit one logical change.

- **3e25b82c** `feat(coach-viewer): board hero + header band + CSS foundation` — `BoardThumbnail size: number | string` (P0-2 from red-team); `/* COACH VIEWER */` CSS block; `CoachPanel` / `CoachFallback` gain `embedded?` prop (P1-1); GameViewer accepts `replay` + `hideBoardThumbnail` so host owns replay state; coach-game-client renders new header band.
- **42a20782** `fix(coach-viewer): drop duplicate ContextualHeader from success branch` — field bug, server page.tsx and client both rendered `t("title")` causing "Match review" to stack twice.
- **2a4d73ab** `feat(coach-viewer): replay controls + collapsible move list` — `.hub-hud-pill` arrows, candy-skinned slider, ply counter, collapsed "All moves (N)" pill with 2-col grid expansion.
- **3a2d5aaa** `feat(coach-viewer): rewrite GameActionsBar as state-driven stack` — 5-state primary/secondary/tertiary slot model (too-short / replay-errored / win+!claimed / win+claimed / loss-draw-resigned).
- **bbf8952b** `feat(coach-viewer): Save Victory sprite + price ribbon (treasure CTA)` — `.arena-result-primary-cta--treasure` sprite reuse + `formatVictoryPriceForDifficulty` helper.
- **98e20e7b** `feat(coach-viewer): trophy ribbon + View on Celoscan tertiary` — `#{tokenId}` corner ribbon on board card for win+claimed; viewNft → viewOnCeloscan rename.
- **fb33341f** `feat(coach-viewer): telemetry events (7 new track calls)` — `coach_viewer_viewed` + `view_celoscan_tap` + `back_to_hub_tap` + `move_list_toggle` + `move_jump` + `replay_scrub` + `replay_error_shown`.

### Phase 2 — Layout pivots (commits 00cc0510 → c2b1f61d)

User feedback on screenshots drove a series of structural realignments.

- **6d0fc27e** `fix(coach-viewer): adopt ContextualHeader to align with rest of app` — dropped custom header band, adopted canonical `<ContextualHeader>` so the visor matches trophies / journal / legal.
- **00cc0510** `fix(coach-history): wire row taps to visor, filter replay-errored, rename chip` — sidequest: `/coach/history` tap-to-no-op was a pre-existing gap. Wired `onAnalyzeUnanalyzed` to route to visor; added `hasReplayError` validator to filter corrupted rows; renamed `analyzeChipLabel` to "Review".
- **0b63d9a3** `feat(coach-viewer): static move list panel with Moves header` — drop collapsible toggle, always-visible 4-row panel with green-circle badges and inline MATE/CHECK annotation.
- **77a35734** `feat(coach-viewer): swap order — history above controls + drop ply counter` — JSX reorder + dropped redundant `N/N` slider counter.
- **324e76f6** `feat(coach-viewer): 3-tile flat actions row with icons + labels` — replaced primary/secondary/tertiary hierarchy with 3-tile equal-weight icon row.
- **13ffe487** `style(coach-viewer): compact pass — fit the visor on a single viewport` — first vertical-rhythm tuning pass.
- **c2b1f61d** `feat(coach-viewer): adopt new btn icons + vitrine-style progress bar` — adopted user-supplied `ask-coach-icon.png`, `play-again-icon.png`, `play.png` (avif/webp/png triplets); slider track restyled to match `.trophy-vitrine-hero-progress`.
- **d9032b26** `feat(coach-viewer): moves panel = 3 rows + auto-scroll active row` — `scrollIntoView({block: "nearest"})` on active `data-active="true"` move keeps the highlighted row in the panel viewport as the slider scrubs.

### Phase 3 — Sally polish passes (commits cee9dd50 → 1bf3acfd)

Multi-pass premium polish driven by adversarial UX critique.

- **cee9dd50** `feat(coach-viewer): Sally pass 2 — Action Deck + premium polish` — replay row moved up to coach-game-client and wrapped with tiles in one cream-amber Action Deck (`margin-top: auto` bottom-anchored). Board card dropped (chess illustration's painted frame was the right frame all along). MOVES flourishes dropped. MATE/CHECK pill moved inline with SAN.
- **6f5bdaf2** `feat(coach-viewer): Sally pass 3 — panel-bg4 material + bigger board` — attempted to swap CSS bg for `panel-bg4.png` painted asset. Board grew to `46vh` (kept).
- **2d96c55f** `fix(coach-viewer): revert panel-bg4 to premium CSS treatment` — `panel-bg4` was a scene-map shell with painted rocks/flowers that ate corner real-estate. Reverted to CSS premium treatment.
- **9a18a28b** `feat(coach-viewer): Sally pass 4 — drop purple tile canvas, icons stand alone` — user asked for strong opinions; Sally voted drop the purple canvas. Crafted icons already carry painted bgs; stacking on a purple square was visual stutter. Icons sit directly on the deck like figurines.
- **d11a260b** `feat(coach-viewer): Sally pass 5 — chapter break + gold corners + slider channel` — connecting signs between the 3 sections: thin warm-brown rules with `⟁` glyph, gold L-corner accents on panels, slider track restyled as a recessed channel.
- **53ef9151** `feat(coach-viewer): Sally pass 6 — badge-vitrine panels + adorno-icon break` — adopted canonical `.badge-vitrine-hero` panel treatment (cream→amber 160deg gradient + 2px cream inset + soft single shadow). Replaced `⟁` Unicode with `adorno-icon.png`. Dropped pass 5 corner accents (badge vitrine doesn't use them).
- **ac1e910d** `feat(coach-viewer): Sally pass 7 — merge moves + deck into one page` — merged MOVES + replay + tiles into one `.coach-viewer__page` panel. Sally vote: one continuous journal page > two duplicate cards.
- **e414421f** `feat(coach-viewer): Sally pass 8 — MOVES framed, controls float open` — REVERT of pass 7. User noticed during pass-7 codegen that controls without panel looked elegant; MOVES inside the panel felt "different" (because it IS — data table vs floating affordances). Density contrast restored: MOVES gets badge-vitrine frame, controls float on green.
- **89e07439** `style(coach-viewer): pass 9 — bg transparency + rounded active row + bigger adorno` — bg alpha softened `0.95 → 0.78` so green grass filters through; active row gets `border-radius: 8px` + suppressed bottom rule for soft pill; adorno bumped `28px → 44px`.
- **41cd9bfc** `fix(coach-viewer): adorno-icon at full width + safe-area bottom padding` — user spotted the chapter-break asset already contained the painted gold rules; my CSS flanking spans duplicated the artwork. Spans dropped; icon renders alone at 220px width. Outer bottom padding bumped to `max(1.6rem, env(safe-area-inset-bottom, 1.6rem))` so tile labels stop clipping.

### Phase 4 — Adjacent vitrine fixes (commits dfd72d4f → 1bf3acfd)

Two non-visor bugs surfaced while smoke-testing.

- **dfd72d4f** `fix(vitrines): badge wolf faces right + drop duplicate leaderboard champion card` — `.badge-vitrine-hero-wolf img` gets `transform: scaleX(-1)` so wizard wolf faces INTO the badges. `.leaderboard-champion-card` block (lines 264-290) deleted — duplicated info already in the THE RANKING hero band.
- **1bf3acfd** `fix(badges): drop inner square frame on piece icons + restore natural aspect` — `.badge-card-icon-wrap` strips its white-wash bg + border + radius; img sizing changes from forced `32×32` square to `100%/100% + object-fit: contain` so pieces respect their natural aspect (taller than wide). Net rendered piece area grows ~75% without changing row height. Bonus: fixed pre-existing `object-contain: contain` typo (invalid property).

## State at handoff

- **Tests:** typecheck clean. Coach-panel + coach-credits + use-coach-analysis suites carry ~39 pre-existing failures from a vitest env regression (`window.localStorage.clear is not a function`); verified against `main` via stash in commit 3e25b82c — none introduced by this cluster.
- **Build:** Vercel preview deploy will fire on the push of `28ffbfc8..1bf3acfd`.
- **Branches:** main is the only branch touched. No PR opened (granular commits direct to main, per repo convention).

## Outstanding work (deferred — needs separate sessions)

1. **VR baselines refresh — bundled session post-reboot.**
   The full Cluster C visual surface has 4+ new states that need baselines (win+!claimed / win+claimed / loss / draw / replay-errored). Bundled with the pre-existing 14-baseline backlog from `_bmad-output/implementation-artifacts/deferred-work.md`. Blocked by disk pressure per `memory/project_disk_telemetry.md`; needs a clean reboot before running `pnpm test:e2e:visual`.

2. **Smoke on `preview.chesscito.com` in MiniPay.**
   This session iterated on screenshots; final desktop screenshot was approved. The real validation is MiniPay Android (390×844 viewport). Path: play a quick game in `/arena?fresh=1` → end → end-state popup close → auto-routes to visor. Confirm all 5 states render correctly on device.

3. **Production promote.**
   Gated on (1) + (2). Production stays on `f54f6fc` per the preview/prod separation established 2026-05-29 (see `docs/handoffs/2026-05-29-preview-stabilization-and-polish-handoff.md`). After VR + smoke pass, push origin/main → promote manually via Vercel UI.

4. **Coach-panel + coach-credits + arena-persistence vitest env failures.**
   ~39 tests failing in `main` with `window.localStorage.clear is not a function`. Pre-existing; blocks no shipping but should be triaged. Likely a vitest.setup.ts misalignment.

5. **i18n hygiene pass on the deferred `og-cards/*` batch.**
   Tracked separately in `_bmad-output/implementation-artifacts/deferred-work.md` (entry 2026-05-23). Not Cluster C scope.

## Open questions for next session

- Does the visor land correctly on Android MiniPay across the 5 states? Specifically: does the 46vh board cap break on shorter viewports (e.g., iPhone SE 375×667)? My CSS uses `max-width: 46vh` which caps the board on tall screens — on short screens the board could overflow vertically. Test on a small MiniPay device.
- Should the MOVES panel get a small "X moves total" subtitle? Today the panel just says "MOVES"; the count lives in the header subtitle. Open whether to surface it twice.
- Will the chapter-break adorno-icon read on the very-light grass background of older MiniPay versions? Drop-shadow is strong but the asset is mostly warm gold; on a brighter green it might wash out.

## Pointers for next session

- **Spec:** `_bmad-output/planning-artifacts/coach-viewer-cluster-c-spec-2026-05-29.md` — 13 sections, includes pass 2 audit. NOT in git (`_bmad-output/` is gitignored).
- **Red team:** `docs/reviews/2026-05-29-coach-viewer-cluster-c-redteam.md` — pre-implementation adversarial review.
- **This handoff:** `docs/handoffs/2026-05-29-coach-viewer-cluster-c-handoff.md`.
- **Visor entry points** (already wired):
  1. `/arena` → end-state popup close → `router.push("/coach/{gameId}?wallet={addr}")`.
  2. `/coach/history` → row tap (both analyzed AND unanalyzed) → same route.
  3. Direct URL `/coach/{uuid}?wallet={0x...}`.
  4. Dev fixture `/dev/coach-viewer/?state={win|loss|partial|minted}`.

---

Wolfcito 🐾 @akawolfcito
