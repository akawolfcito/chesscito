# Red Team Review — play-kingdom-hub-unification

**Date:** 2026-07-07
**Reviewer mindset:** hostile QA + senior engineer
**Target:** `docs/specs/play-kingdom-hub-unification.md`

## Findings

### P0 — Must address before implementation

- **[naming-scope] The "Arena" rename is unbounded and will break/​leak.**
  "Arena" copy lives in ≥6 keys across sections: `editorial.ts:1346` (`enterArena`),
  `:3163-3164` (`SECONDARY_CTA_COPY.arena.label/ariaLabel` — consumed by the FULL hub chevron
  link, `hub-scaffold.tsx:407-418`), `:3273-3274` (`PLAY_HUB_COPY.arenaLabel="PLAY CHESS"` /
  `arenaAriaLabel`), plus `messages/es.ts:1780-1781`. The CTA is ALREADY "PLAY CHESS" /
  "JUGAR AJEDREZ" — not "Enter Arena". A blanket rename would (a) rewrite the FULL hub's
  secondary link, (b) leak "Play Kingdom" into the arena page / arias / OG copy.
  **Why blocking:** spec must ship an explicit key-by-key rename table (which keys → "Play Kingdom",
  which stay "Play Chess"/functional aria) and grep every consumer before editing editorial.

- **[panel-nonpro-state] The non-PRO panel is undefined.**
  Spec enumerates the PRO chip as "shown/hidden" but Image 1 only shows the PRO-active state.
  For the majority (non-subscribers): does the body change? Is there a "Get PRO" affordance?
  Arena is free-to-all, so a PRO-framed panel may read as a paywall it isn't.
  **Why blocking:** the most common state has no defined DOM → TDD has no red test to write.

- **[tools-nav-contract] CHESS TOOLS tiles have no navigation contract.**
  Spec replaces the self-contained `<PlayTacticsTile>` (owns its own routing/state) with a dumb
  `KingdomToolTile`, but `play-hub-client.tsx` / `usePlayHubData` expose NO tactics handler
  (only `onCoachTap`/`onShopTap`/`onArenaPress`/`onTrophyTap`). Tools need `onTacticsTap` +
  explicit destinations. **Why blocking:** can't build the section without defining each tile's
  handler + container wiring; otherwise Tactics becomes a dead tile or PlayTacticsTile stays and
  won't match the reward-tile square style the spec promises.

### P1 — Should address

- **[mascot-divergence] "Reuse KingdomAnchor" vs "copy avatar from LITE" are contradictory.**
  `kingdom-anchor.tsx:84-91,161-172` is theme-aware and already swaps the PRO avatar via
  `useThemeAsset("hub.avatar", pro?…)` + `useIsProActive()`. LITE (`hub-lite-scaffold.tsx:176-203`)
  hardcodes `avatar-pro`/`avatar-lite-hub` pictures. Copying LITE would duplicate PRO logic and
  diverge from the theme system. **Resolve:** use KingdomAnchor (already in PLAY, PRO-aware,
  LCP-optimized); do NOT copy LITE's manual avatar. Also verify whether the CHESSCITO wordmark is
  baked into the portal art or needs a separate title image (LITE uses a separate `hub-lite-title`).

- **[gold-ring-mismatch] PRO gold ring won't fit the PLAY CTA.**
  `ring-start-focus.png` was authored for LITE's green Start Focus button. PLAY's CTA is
  `PrimaryPlayCta` (blue framed button, Image 1) — different shape/size. Reusing the ring = misfit.
  **Risk if ignored:** ugly overlap; or a new asset (3-format rule) sneaks in. Decide: drop the ring
  on PLAY, or scope a proper asset.

- **[reward-tile-reuse] `.reward-tile` is piece-specific and stateful.**
  `reward-column.tsx` couples `.reward-tile` to piece art + 4 states (claimed/claimable/progress/
  locked) with dots/locks/checks that don't apply to tools. Reusing the class inherits dead CSS.
  Duplicate only the square visual into a new `.kingdom-tool-tile`. **Also:** spec omits CSS file
  placement — per CLAUDE.md P4 split, PLAY-only classes go to the PLAY surface sheet
  (`styles/hub.css`/`arena.css`), NOT `globals.css`.

- **[crest-asset] Panel crest (Image 2) may not exist.**
  The crossed-swords-on-shield crest is not confirmed in `public/art/**`. Fallback "reuse
  enter-arena/battle art" may not read as a crest. **Risk:** panel blocked, or a new asset added
  without the png+webp+avif rule / reuse-first audit. Resolve the asset BEFORE building the panel.

- **[test-baseline-breakage] "Tests updated" understates the blast radius.**
  Rewriting the scaffold changes DOM/testids. Affected: `play-hub-scaffold` test,
  `play-tactics-tile.test.tsx` (orphaned if the tile is removed), `hub-scaffold-client.test.tsx`,
  and PLAY-hub VR baselines (PRO / non-PRO / guest). Enumerate + refresh VR in the SAME PR
  ([[feedback_vr_baseline_discipline]]).

- **[acceptance-criteria-thin] Criteria aren't behavior-mapped.**
  "Typecheck / tests / VR / drive real" are process gates, not observable per-state assertions.
  Add: non-PRO → no chip + Coach tile "Ask" badge; guest → Connect chip; loading → panel fixed
  height (no flash). Each maps to one test for TDD.

### P2 — Nice to clarify

- **[footer-affordance] "Quick Match" reads as a CTA but is spec'd static** — either wire it
  (Quick Match = enter arena) or rename to a noun (info row like `challenge-card-stats`). "Rewards"
  HAS a real destination (`onTrophyTap` → `/trophies`; `mintedVictoryCount` already loaded) — wire
  it to avoid a dead affordance. Same for "Coach Review" → coach.
- **[phase-2-account] Location of the Account entry in `/arena?fresh=1` unspecified** — needs LITE
  `hub-account-circle` grammar + `useAccount`/PRO derivation + route to `/exercises?sheet=account`.
  (Phase 2, ok to defer.)
- **[scope-size] Phase 1 is large** (copy + KingdomCard + KingdomToolTile + scaffold rewrite +
  tests + VR + asset audit) and may approach the 30-task budget. Consider splitting: (a) primitives
  + copy with isolated tests, (b) scaffold rewrite + integration.
- **[i18n-parity] es.ts already has a PLAY_HUB block (`:1780`)** — extend it in lockstep with
  editorial.ts + en.ts ([[feedback_i18n_key_parity]]); don't create a parallel block.

## Resolved non-issues (do NOT chase)
- `onArenaPress` already routes to `/arena?fresh=1` (`play-hub-client.tsx`) — CTA target is correct, no change.
- `KingdomAnchor` already swaps the PRO avatar — no manual PRO avatar wiring needed.
- The WARM UP modal `soft-gate-sheet.tsx` already renders only one button (Enter); `onLearn`/PIECES
  is dead. Phase 2 item 2 may be MOOT here — verify whether Image 3's PIECES lives in
  `arena-entry-panel.tsx` before assuming work remains.

## Verdict (v1)
**NEEDS REVISION** — resolve the 3 P0s in the spec first:
1. Naming rename table (key-by-key, grep-verified).
2. Non-PRO panel state (DOM + copy + whether a PRO CTA appears).
3. CHESS TOOLS per-tile navigation contract + container wiring.
Then the P1s (mascot choice, ring decision, tool-tile CSS placement, crest asset) can be folded in.

## Resolution (v2 — spec revised 2026-07-07)
- **P0-1 naming** → bounded rename table added; `SECONDARY_CTA_COPY.arena` + `enterArena` explicitly
  DO NOT TOUCH; CTA stays "PLAY CHESS".
- **P0-2 non-PRO panel** → same panel in both states (arena is free); only the chip differs — PRO active
  green chip vs tappable "PRO" discovery pill (`onProTap`). Body + 3 benefits shown to everyone.
- **P0-3 tools contract** → FALSE ALARM. `PlayTacticsTile` is self-contained (opens its own sheet, no
  parent prop); Coach/Shop already prop-driven. Fix = restyle the 3 existing tiles in place, NO new
  wiring. Spec updated to "restyle, don't rewrite."
- **P1-1 mascot** → KingdomAnchor (already PRO-aware); drop LITE avatar copy.
- **P1-2 ring** → dropped on PLAY (asset misfit).
- **P1-3 tool-tile CSS** → new `.kingdom-tool-tile` in `styles/hub.css` (not globals; not `.reward-tile`).
- **P1-4 crest** → reuse `btn-battle` (crossed swords, 3 formats confirmed); no new asset.
- **P1-6 acceptance** → per-state testable criteria added.
- P2s folded into the spec (footer items static/noun-phrased; Rewards not a dead tap; phase-2 account
  location noted; scope-split optional; es.ts PLAY_HUB block extended).

**Verdict: READY for `/tdd`.**
