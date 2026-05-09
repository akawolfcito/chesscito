# Audit — `/exercises` top zone

**Date**: 2026-05-09
**Scope**: All chrome above the board on `/exercises` at 360×740 (canonical short viewport).
**Trigger**: User feedback "se siente entrecortada la pantalla; el peón de la equina arriba; chip de PRO con countdown verboso; sección del top con mucho por mejorar." Quick wins B (commit `619dbe8`) trimmed the worst offenders; this audit covers what remains.

## TL;DR

- Three rows of chrome (title + chip-row + tabs) eat **195 px** = **26 %** of a 740 px viewport before the board even paints. The board canvas (338 px) takes another 46 %. That leaves 28 % for the action-row + dock — already painful.
- Vertical density is the root cause of the "entrecortado" feeling, not visual-language drift. After the quick wins, the remaining surfaces share a coherent dialect (cream pills + gold accents + brown text). The fragmentation is **structural**, not aesthetic.
- Consolidating title + peek chip into a **single contextual header band** and moving EXERCISES/LABYRINTHS off its dedicated row recovers ~70 px without dropping any semantic info.

## Method

1. Capture `/exercises` at 360×740 with a no-wallet test fixture (Playwright + cache-buster).
2. DOM `getBoundingClientRect` on every named layout band: status-bar, contextual header wrapper, peek chip + drawer row, tabs, board stage, board canvas, dock.
3. Compare against the user-supplied images #8 and #9 (real device, wallet-connected) to confirm the measurements transfer.
4. Cross-check each surface against the diegetic vocabulary catalogued in DESIGN_SYSTEM.md §16 (M3.5 primitives) and the "Why each row exists" comments inside `mission-panel-candy.tsx`.

## Inventory

Measured at 360×740, no-wallet (the wallet variant adds a PRO pill on the right of Z1 but identical heights):

| Band | Top y | Height | Cumulative | Notes |
|---|---:|---:|---:|---|
| Z1 status bar | 0 | 36 | 36 | brand back-chip + handle (or "Guest") + PRO pill slot |
| (gap mt-2 + safe-area top) | 36 | 22 | 58 | breathing |
| Pieces title row (`<h1>Rook</h1>` + `<PiecePickerTrigger>` floating right) | 58 | 24 | 82 | h1 only — subtitle removed in `619dbe8` |
| Mission peek chip + 15/15 stars chip + drawer | 82 | ~50 | 132 | left=peek, right=stars; both cream rounded pills |
| (gap) | 132 | 12 | 144 | mt-2 |
| EXERCISES / LABYRINTHS tabs | 144 | 35 | 179 | gold pill toggle, own row |
| (gap) | 179 | 16 | 195 | mt-2 + grid padding-top |
| **Board stage** | 195 | 405 | 600 | min-h-0 flex-1; canvas inside ~338 px |
| Action row | 600 | ~80 | 680 | pedestals + central pin |
| Dock | 680 | ~60 | 740 | shrink-0 + safe-area-bottom |

Three structural insights:

1. **Pieces title** + **peek chip row** are visually two bands but they convey ONE compound piece of info ("you are training the rook on a Capture exercise"). They were split when the legacy mission briefing got broken into title-only `ContextualHeader` (`d856fe8` era) + a sibling chip row (`contextual-header-spec-2026-05-01.md` §8). The spec literally tags this row as a transitional sibling: *"TODO(zone-map-phase-2): fold MissionDetailSheet entry into the piece-picker sheet as a sub-tab"* (mission-panel-candy.tsx:305).
2. **EXERCISES / LABYRINTHS tabs** consume their own 35 px row even though only one tab is interactive at the L1 stage (LABYRINTHS unlocks only at totalStars ≥ 12). For the 90 % of the player's rook journey where labyrinths are locked, the row is decorative.
3. The **right cluster** stacks `<PiecePickerTrigger>` (rook avatar with arrow) **above** the `15/15` stars chip. They both reference the same piece — duplication of the rook glyph + duplication of "you're on rook progress."

## Visual-language audit

After the `619dbe8` quick wins:

| Surface | Dialect | Diegetic family | Status |
|---|---|---|---|
| Z1 status bar (back chip + handle text + PRO pill) | white sans on translucent bar + amber pill | ❌ tech / generic | Acceptable: Z1 is the canonical OS-level identity strip per DESIGN_SYSTEM §10. Doesn't need to be diegetic. |
| `<h1>Rook</h1>` | brown serif (`fantasy-title`) | ✅ candy / diegetic | OK |
| Mission peek chip "Capture" + crosshair | cream pill, gold border, brown text | ✅ candy | OK |
| Stars chip "15/15" + star glyph | cream pill, gold border, brown text | ✅ candy | OK |
| `<PiecePickerTrigger>` (rook avatar, gold ring, arrow) | photographic 3-D rook + gold ring | ✅ candy | OK |
| EXERCISES / LABYRINTHS tabs | gold-on-cream pill toggle | ✅ candy | OK |
| Board stage | candy board + grass field | ✅ candy | OK |
| Action-row stone pedestals | M3.5 diegetic primitives | ✅ candy | OK |
| Dock | navy-tile dock with painted glyphs | ✅ candy | OK |

**No visual-language regressions remain after `619dbe8`.** All surfaces above the board (except Z1) share the candy/diegetic family. The "entrecortado" feeling is **vertical density**, not dialect drift.

## Findings (prioritized)

### P0 — structural density

#### F1. Pieces title + peek chip should be one band, not two
- **Current**: 24 px (title) + 12 px gap + 50 px (chip row) = 86 px for "you're on Rook · current target Capture."
- **Issue**: two visually disconnected rows for one compound contextual statement.
- **Proposal**: collapse into one **"contextual band"** — `<ContextualHeader>` with the peek chip rendered as part of its layout, not as a sibling row below. The chip's interactive role (opens MissionDetailSheet) is preserved; it just lives next to the h1 instead of below it.
- **Estimated savings**: ~36 px.
- **Risk**: needs a `ContextualHeader` API change (already flagged in its spec for phase 2). Touch surface: 1 component + tests + 1 caller.

#### F2. EXERCISES / LABYRINTHS tabs collapse when labyrinths are locked
- **Current**: dedicated 35 px row + 16 px gap = 51 px, rendered for every player even when LABYRINTHS is non-interactive (≤ 12 stars on selected piece).
- **Issue**: zero-interactivity row consuming vertical real estate. The `labyrinthAvailable` gate exists in `mission-panel-candy.tsx:355` but only conditions the toggle — not the full row.
- **Proposal**: the existing `labyrinthAvailable` gate already wraps the entire `<div>` (line 355). **Currently working as intended**, BUT the L1 player who hits 12★ on rook abruptly gains the row mid-session — surprising layout shift. Two sub-options:
  - **F2a**: leave as-is (gate already correct); document the layout-shift as expected.
  - **F2b**: fold the toggle inline next to the title or into the piece-picker sheet to avoid the row even post-unlock.
- **Estimated savings**: 0 px for L1 sub-12★ players (already collapsed); 51 px recoverable for L2+ players if F2b adopted.
- **Risk**: F2b changes the toggle's surface; would require a small UX brief.

### P1 — duplication

#### F3. Right cluster duplicates the rook glyph between PiecePickerTrigger and stars chip
- **Current**: `<PiecePickerTrigger>` shows a rook avatar with a gold ring + down-arrow (opens piece picker). The stars chip below shows a star + "15/15." Two separate cream-pill chips stacked.
- **Issue**: both reference "rook progress." Reading top-to-bottom: rook icon, then star icon — feels like visual stutter.
- **Proposal**: merge into a **single piece-progress chip**: rook avatar **inside** the stars chip with the count to its right ("[rook] 15/15"), still tappable to open the piece picker. The existing PiecePickerTrigger and HudResourceChip stars become one composite primitive.
- **Estimated savings**: ~30 px (one stacked element collapses into the other's row) AND clearer info hierarchy.
- **Risk**: medium — needs a new combined primitive or a layout shuffle inside an existing one.

#### F4. Mission peek chip + the live `objectiveText` could become a richer single row
- **Current**: chip says "Capture" alone (or "Target a8" in non-capture exercises). Tap opens MissionDetailSheet which shows the full objective + stats.
- **Observation**: the chip is doing two jobs — communicate AND open detail. A "Move to a8" chip with a small "i" hint (or a chevron) would make the open-detail affordance more discoverable. Currently it looks like a passive label.
- **Proposal**: append a `›` chevron or `(i)` glyph to the chip so its interactive nature is read as such — a small affordance polish.
- **Estimated savings**: 0 px; readability win.
- **Risk**: trivial.

### P2 — polish

#### F5. Z1 status bar's "Guest" handle could lose visual weight
- The "Guest" / `0x0924…eba4` text on the translucent Z1 row reads white-on-green and feels heavy for a pre-board element. A subtle softening (text-white/70 → text-white/60) makes it recede behind the diegetic title row below.

#### F6. Vertical gap rhythm uses `mt-1` and `mt-2` interchangeably
- Tokens exist (`--shell-gap-xs`, `--shell-gap-sm`) but the chrome stack uses Tailwind `mt-1` / `mt-2` arbitrarily. Tightening to design tokens would not change the look but would make global tuning of the rhythm a single-knob decision.
- Pure refactor — defer until a rhythm change is wanted.

## Unification plan

Phased, to ship in granular commits.

### Phase 1 — F1 (collapse title + peek chip into one band)

1. Extend `<ContextualHeader>` to accept an optional **leading slot** (currently `variant="title-control"` only has trailing). Render slot to the right of title before the trailing control.
2. Pass `missionPeek` chip into the leading slot.
3. Remove the standalone `<MissionDetailSheet>` row from `mission-panel-candy.tsx` (the trigger lives in the header now; the sheet itself stays — sheet ≠ trigger).
4. Update tests: `contextual-header.test.tsx` for new prop; `mission-panel-candy` snapshot/integration if any.
5. Visual: bands above board drop from 4 to 3.
- **Estimated savings**: ~36 px.

### Phase 2 — F3 (merge right cluster: piece avatar + stars into one chip)

1. Create `<PieceProgressChip>` primitive: cream pill, rook avatar inline, "X/15" text, optional `aria-label` for screen readers.
2. Make it tappable (opens piece picker — replaces standalone `<PiecePickerTrigger>` for this surface).
3. Replace the stacked pair in `mission-panel-candy.tsx` with the new chip.
4. Update or replace `<PiecePickerTrigger>`'s tests; new `<PieceProgressChip>` tests.
- **Estimated savings**: ~30 px **AND** information re-stacks horizontally (left-band: title + peek; right-band: piece+progress) — two cohesive bands replace the current four scattered surfaces.

### Phase 3 — F4 + F5 (polish)

1. Add `›` chevron to the peek chip (or wrap the label inside an interactive-feeling envelope).
2. Soften Z1 handle text contrast.

### Phase 4 — F2b (deferred)

If post Phase 1 + 2 the layout still feels heavy on labyrinth-unlocked sessions, fold the EXERCISES / LABYRINTHS toggle into the piece picker as a sub-control. Gated on user preference.

## Out of scope

- Z1 redesign (canonical OS-level strip, not part of /exercises chrome)
- Action-row pedestals (M3.5 already shipped, validated by user)
- Board stage / canvas (recently fixed, not regressed)
- Dock (separate scope)

## Net expected impact

| Phase | Δ vertical px above board | Status |
|---|---:|---|
| Pre-quick-wins (image #3 baseline) | — | shipped historically |
| `619dbe8` quick wins | ~−40 | done |
| Phase 1 (F1) | ~−36 | proposed |
| Phase 2 (F3) | ~−30 | proposed |
| Phase 3 (F4 + F5) | 0 | proposed |
| **Cumulative if all shipped** | **~−66 from current baseline** | — |

Top zone goes from 195 px (≈26 % of viewport) to ~129 px (≈17 %), giving the board canvas more breathing room and the player a less segmented entry point.
