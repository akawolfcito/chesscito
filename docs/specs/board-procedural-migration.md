# Spec — board-procedural-migration

**Date**: 2026-06-17
**Status**: draft

## Problem
The app renders three boards from a **background image** (`chesscito-board.png`)
with an absolutely-positioned hit-grid + pieces layered on top:
- `components/board.tsx` — exercises / labyrinths / tutorial / viewer.
- `components/arena/arena-board.tsx` — full chess (orientation-aware).
- `components/board/board-thumbnail.tsx` — read-only FEN snapshot (journal, coach).

The cells are positioned by percentage over the image, so alignment depends on
hand-calibrated insets (`.playhub-board-hitgrid` insets differ per surface:
board ≈ `4.9/4.4/3.6/4.6%`, thumbnail `5.25/9.25/12.75/10.25%`). Any art change
re-breaks calibration, the dark-square art can't be themed per-cell, and the
labyrinth wall is a CSS hack over the image.

Meanwhile `/dev` already has a **reconstructed programmatic board**
(`app/dev/_components/procedural-board.tsx`) where the 8×8 textured tiles **ARE**
the board (CSS grid) under a candy-frame PNG — alignment is guaranteed by
construction, cells are real DOM tiles, and walls/markers are per-cell overlays.

## Goal
Replace the background-image boards with the procedural tile board across all
three surfaces, so cell alignment is structural (not calibrated), walls/markers
are per-cell, and the board is themeable — with **visual + behavioral parity**
verified per surface before each swap.

## Non-goals
- Changing game rules, move validation, or the `board-geometry` coordinate model
  (already a uniform 12.5% grid — reused as-is).
- Redesigning the board art (reuse the existing dev tiles + candy frame).
- Touching piece sprites, animations semantics, or the FEN/orientation logic
  (arena flip stays; only the substrate under the pieces changes).
- A new theme system (the procedural board accepts colors/assets; theming is a
  later consumer).

## Architecture (locked)
1. **One shared `GameBoard` substrate** promoted from `ProceduralBoard` into
   `src/lib/game/` (prod path), rendering: tile grid (inset to the frame opening)
   + candy-frame overlay + optional coordinate band. It exposes a **piece/marker
   overlay layer** that shares the SAME inset region as the tile grid, so
   `cellCenter()` percentages (0–100% of that region) resolve identically for
   tiles and pieces — this is the single alignment contract (replaces 3 different
   hand-calibrated hit-grid insets).
2. **Each surface keeps its own logic** (interaction modes, orientation, capture
   floats, read-only) and only swaps its `<picture>`+hit-grid substrate for
   `<GameBoard>` with a `renderCell`/overlay render-prop.
3. **Geometry source stays `board-geometry.ts`** (uniform grid). The overlay
   layer wraps pieces in a div inset to the frame opening (mirrors how
   `board-thumbnail` already wraps pieces in a hit-grid-inset div), so existing
   `cellCenter`/`cellGeometry` callers are unchanged.
4. **Assets graduate to prod.** The dev tiles + frame
   (`/public/dev/tablero/{casilla-clara,casilla-oscura,borde-tablero-chesscito1}.png`)
   move to `/public/art/board/**` as a png+webp+avif triplet each (dev `/public/dev`
   is not a prod-canonical location). The labyrinth wall reuses
   `public/art/labyrinths/wall.*` (already shipped).
5. **Per-surface, behind a flag.** `PROCEDURAL_BOARD_ENABLED` (or per-surface
   props) lets each surface flip independently with its own VR pass; flag off =
   today's image board (byte-identical) until that surface is validated.

## Contracts (SDD)

```ts
// src/lib/game/game-board.tsx (promoted + generalized ProceduralBoard)
export interface GameBoardProps {
  /** Board orientation. "white" = a1 bottom-left (default); "black" flips both
   *  axes (arena, when the player is black). Thumbnail/exercises use "white". */
  orientation?: "white" | "black";
  /** Per-cell substrate overlay (highlight ring, dot, wall img, target).
   *  (file,rank) are LOGICAL (0–7, 1–8), not view coords. */
  renderCell?: (file: number, rank: number, square: string) => ReactNode;
  /** Absolute overlay layer (pieces, capture floats) positioned via cellCenter
   *  against the frame-opening inset region. Receives a helper to convert
   *  logical (file,rank) → {leftPct, topPct} honoring orientation. */
  renderOverlay?: (geo: BoardOverlayGeometry) => ReactNode;
  onCellClick?: (file: number, rank: number, square: string) => void;
  showCoordinates?: boolean;
  interactive?: boolean;          // cells are buttons when true
  maxWidth?: string;              // default 23.5rem (390px cap)
  className?: string;             // surface hook (arena-board-canvas, etc.)
}

export interface BoardOverlayGeometry {
  /** Center of a logical cell as % of the OVERLAY region, already
   *  orientation-adjusted. Wrap pieces in the inset region so these resolve
   *  correctly (same contract as today's cellCenter). */
  center(file: number, rank: number): { leftPct: number; topPct: number };
  cellSizePct: number;            // 12.5
  pieceWidthPct: number;          // from board-geometry pieceWidth(), not re-hardcoded
}

/** Per-surface overlay inset (red-team P0 piece-drift). The overlay region is
 *  NOT one global inset — each surface passes its own so pieces don't drift when
 *  its framing differs (the thumbnail inset is asymmetric today). Defaults to the
 *  frame opening BOARD_INSET. */
export type OverlayInset = { top: number; right: number; bottom: number; left: number };
```

## Behavior
1. Given a surface renders `<GameBoard>` with the flag ON, then the visible board
   is the tile grid + candy frame (no `chesscito-board.png`), and every piece /
   highlight / wall / coordinate lands on the same cell it does today.
2. Given the arena board with `orientation="black"`, then tiles, coordinates, and
   pieces all flip together (parity with today's `vf/vr` view-coord flip).
3. Given a labyrinth wall cell, then it renders the `wall.*` art per cell (reusing
   the shipped asset), not a CSS gradient.
4. Given the read-only thumbnail, then it renders pieces from a FEN with no
   interaction and the same framing as the arena board (shared substrate).
5. Given the flag OFF for a surface, then that surface renders today's
   image-based board unchanged (byte-identical) — the migration is reversible
   per surface.

## Edge cases
- **Inset unification**: pieces today resolve against a per-surface hit-grid inset
  (board 4.9% vs thumbnail 5.25/9.25/12.75/10.25%). The shared overlay region uses
  ONE inset (the frame opening, `BOARD_INSET` ≈ 3.4/3.56/3.99/3.65%). Pieces must
  be re-anchored to that single region or they drift — this is the #1 risk;
  validate each surface visually against a before/after overlay.
- **Orientation flip** (arena, black): the procedural board renders a8 top-left by
  default; it must map logical→view coords for both tiles AND the overlay, or
  pieces and tiles disagree when flipped.
- **Capture floats / select hints / target ghost** (board.tsx + arena) are
  absolute overlays at `cellCenter` — they move to `renderOverlay` and must keep
  z-order above tiles, below the frame.
- **Coordinate labels**: today per-cell `.playhub-board-label`; procedural draws
  them on the frame band. Decide one model (see Open questions) — exercises show
  labels, arena may hide them.
- **Checkmate pause / data attributes** (`arena-board-canvas[data-checkmate]`)
  and animation classes must survive on the new canvas wrapper.
- **Asset load flash**: tiles are many small images; preload or use a tint
  fallback (as the wall cell already does) so first paint isn't blank.
- **Performance**: 64 tile images + overlays vs 1 bg image. Use one shared tile
  asset per color (cached) — not 64 unique requests.
- **VR**: every surface visual changes → new baselines required (exercises has
  none today; arena has `vr9-arena-end-state-*`). No flag-on surface ships
  VR-red.

## Acceptance criteria
- [ ] `GameBoard` lives in `src/lib/game/`, prod-importable (no `/dev` or
      `scripts/` dependency); a test asserts an `app/` route can import it.
- [ ] Board assets relocated to `/public/art/board/**` as png+webp+avif triplets;
      no surface references `/public/dev/**` when the flag is on.
- [ ] With `PROCEDURAL_BOARD_ENABLED` OFF, all three surfaces are byte-identical
      to today (full suite green + `tsc` clean).
- [ ] Exercises/labyrinth board (flag ON): pieces, highlights, dots, targets,
      walls, coordinates all align; a VR baseline is added and green.
- [ ] Arena board (flag ON): white AND black orientation align (tiles + pieces +
      coords flip together); capture floats + checkmate pause intact; VR green.
- [ ] Thumbnail (flag ON): FEN snapshot renders aligned, read-only; VR green.
- [ ] Labyrinth walls render the `wall.*` art per cell on the new board.
- [ ] No measurable first-paint regression: tiles use ONE `background-image:
      image-set(...)` rule per color (2 cached requests), NOT 64 `<picture>` tiles
      (red-team P2). Arena move latency measured before/after, no regression.
- [ ] **a11y preserved** (red-team P1): the new board keeps `role="grid"` +
      `aria-label` + per-cell accessible names (no regression vs the image board).
- [ ] **CSS namespaced** (red-team P1): the new substrate's classes don't bleed
      into a not-yet-migrated surface; the flag gates CSS as well as JSX.
- [ ] **Orientation test** (red-team P0): a unit test asserts logical→view mapping
      for tiles AND overlay under `orientation="black"`.
- [ ] Each phase flip-on is gated by (a) **final art confirmed** (not dev
      placeholders) and (b) a **human before/after visual sign-off** at 390px —
      not just a self-captured VR baseline.

## Out of scope / future
- Per-theme tile/frame swaps (the board accepts assets; theming is a later
  consumer of this substrate).
- Retiring `chesscito-board.png` from the repo (keep until all surfaces flipped).
- Drag-to-move (tap-to-move parity only).

## Phases
- **Phase 0** — promote `ProceduralBoard` → `src/lib/game/game-board.tsx`
  (generalized: orientation + overlay layer), relocate assets to `/public/art/board`.
  `/dev` consumers import the promoted component. No surface flip yet.
- **Phase 1** — migrate **board.tsx** (exercises/labyrinth) behind the flag; VR.
- **Phase 2** — migrate **arena-board.tsx** (orientation, captures); VR.
- **Phase 3** — migrate **board-thumbnail.tsx**; VR.
- **Phase 4** — default the flag on, then retire the image substrate + dead CSS.

## Open questions
1. ~~Coordinate model~~ — **RESOLVED (founder 2026-06-17)**: adopt the
   reconstructed board exactly as built — tiles + frame + **frame-band labels** +
   wall art. No per-cell labels. `showCoordinates` stays a per-surface toggle
   (e.g. thumbnail may hide them) but the model is the frame band.
2. ~~Flag granularity~~ — **RESOLVED (founder 2026-06-17)**: **per-surface** props
   (each board flips independently when its visual sign-off is green; doesn't force
   staggering — they can still be flipped together). No global env flag.
3. **Asset scope**: are the dev tiles (`casilla-clara/oscura`, candy frame) the
   FINAL prod art, or placeholders pending a designer pass? If placeholders, Phase
   0 still relocates them but flags stay off until final art lands.
4. ~~board-geometry corners / perspective~~ — **RESOLVED**: grep confirms no
   `interpolateQuad`/`BOARD_V_GAMMA` consumers remain; `board-geometry.ts` is a
   uniform 12.5% grid used by board.tsx, arena-board, board-thumbnail (+ dev
   calibration). No perspective build to preserve.

**Status note**: red-team folded (per-surface overlay inset, orientation test,
a11y + namespaced-CSS + image-set acceptance, flag-on gated on final-art +
human sign-off). Founder calls still open: #1 (coords), #2 (flag granularity),
#3 (art final vs placeholder).
