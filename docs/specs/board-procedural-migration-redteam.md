# Red Team Review — board-procedural-migration

**Date**: 2026-06-17
**Reviewer mindset**: hostile QA + senior engineer

## Findings

### P0 — Must address before implementation

- **[piece-drift-inset-unification]** The three surfaces use DIFFERENT hit-grid
  insets today: board ≈ `4.9/4.4/3.6/4.6%`, thumbnail `5.25/9.25/12.75/10.25%`
  (asymmetric!), arena its own. The spec unifies everything to ONE frame opening
  (`BOARD_INSET ≈ 3.4/3.56/3.99/3.65%`). That asymmetric thumbnail inset is a
  strong signal its background art is framed completely differently from the
  candy frame — so the thumbnail composition will visibly shift, not just "align
  better". Why blocking: "pieces land where they do today" (Behavior 1) is FALSE
  by construction if the inset changes. Either (a) each surface keeps its own
  overlay inset as a prop, or (b) accept the reframe and validate each visually.
  Decide + encode per-surface inset in the contract, don't assume one fits all.

- **[orientation-not-implemented]** `ProceduralBoard` renders a8 top-left, fixed.
  It has NO orientation concept. Arena flips for black (`vf/vr` view coords) for
  BOTH tiles and pieces. The promoted `GameBoard` must flip tiles, coordinates,
  AND the overlay layer together — a partial flip (tiles flip, overlay doesn't)
  is a total break that a white-only VR pass won't catch. Why blocking: arena is
  unplayable as black otherwise; needs an explicit black-orientation test + VR.

- **[dev-assets-are-they-final]** The tiles + candy frame live under
  `/public/dev/tablero/`. If they are PLACEHOLDERS (dev-grade), flipping any flag
  on ships placeholder art to players. Open question #3 must be answered BEFORE
  any surface flips on (Phase 0 relocation is safe regardless). Why blocking: a
  silent placeholder-to-prod is exactly the kind of regression this migration
  could sneak in. Treat "final art confirmed" as a flag-on gate.

### P1 — Should address

- **[accessibility-regression]** Today's boards use `role="grid"` +
  `aria-label="Chess board"` on the hit-grid and `.playhub-board-label` per cell.
  `ProceduralBoard` uses `title` attrs + no grid role. The promoted component must
  preserve the grid semantics + per-cell accessible names, or this is an a11y
  regression (and MiniPay listing review may flag it). Add to acceptance.

- **[arena-rerender-cost]** Arena updates the board on every move/animation. 64
  tile DOM nodes + per-cell overlays re-render where today it's 1 background image
  + a thin hit-grid. Even with one cached tile asset, reconciliation cost and
  paint area grow. Measure arena move latency before/after on a mid device; if it
  regresses, memoize tiles (they never change) separately from the overlay layer.

- **[vr-baseline-captures-the-bug]** "VR green" is meaningless for exercises
  (no baseline exists) — capturing a NEW baseline after the change just locks
  whatever shipped, bug and all. Each surface needs a human before/after diff
  (old image board vs new) at 390px, not just a self-referential VR snapshot.
  Make "founder/QA visual sign-off" an explicit gate per phase.

- **[old-new-css-collision]** During the per-surface migration, old (image) and
  new (tile) boards coexist (e.g. arena still image while exercises is tiles).
  Both reuse `.playhub-board-canvas` / `.playhub-board-*` classes. Adding tile
  styles to those shared classes could bleed into the not-yet-migrated surface.
  Namespace the new substrate's classes (or scope via the component) so a migrated
  surface can't restyle a pending one.

- **[coordinate-font-scaling]** `ProceduralBoard` hardcodes label `fontSize: 1rem`.
  On the small thumbnail that's enormous; on arena it may be hidden. The promoted
  component needs responsive/optional coordinates, or the thumbnail breaks.

### P2 — Nice to clarify

- **[64-picture-elements]** Spec says png+webp+avif triplets. Do NOT render 64
  `<picture>` tiles — use a single CSS `background-image: image-set(...)` rule per
  color on the tile (2 cached requests total), or the perf P1 gets worse.
- **[dev-board-calibration-obsolete]** `/dev/board-calibration` (inset tuner) and
  the perspective-era tooling become dead once geometry is structural — schedule
  cleanup in Phase 4 so they don't mislead future calibration hunts.
- **[asset-location-naming]** Spec says `/public/art/board/**`; confirm it doesn't
  collide with existing `chesscito-board.png` under `/public/art/`. Keep both
  until Phase 4.

## Categories audited

### Contract gaps
- `BoardOverlayGeometry.center()` returns % of "the overlay region" — but P0
  inset-unification means that region may differ per surface. The contract must
  take the inset as input (per-surface) or the helper lies for the thumbnail.
- `pieceWidth()` (from board-geometry) still governs sprite size — confirm it’s
  threaded into `renderOverlay`, not re-hardcoded.
- No error/empty contract: what does `GameBoard` render for an empty/invalid FEN
  (thumbnail)? Today’s thumbnail handles it; preserve.

### Hidden assumptions
- Assumes `board-geometry` is uniform everywhere — **verified** (grep: no
  `interpolateQuad`/`BOARD_V_GAMMA` consumers remain; only cellCenter/cellGeometry
  in board.tsx, arena-board, board-thumbnail, dev/board-calibration). OQ#4 can be
  marked resolved (uniform, no perspective build).
- Assumes the candy frame PNG is 1:1 and scales cleanly to each surface’s
  `maxWidth` — verify on the small thumbnail.

### Backward compatibility
- Flag-off byte-identical is the safety net — good, but the shared CSS classes
  threaten it (see css-collision P1). The flag must gate CSS too, not just JSX.
- `arena-board-canvas[data-checkmate]` + animation classes must ride the new
  wrapper (spec notes it — add an explicit acceptance line).

### Security & data
- None (pure rendering). No PII, no network.

### Test coverage gaps
- Add: importability test (prod path), orientation-flip unit test (logical→view
  for tiles AND overlay), per-surface VR (×3, white+black for arena), a11y
  assertion (role=grid + cell names).

### Operational readiness
- Rollback = per-surface flag off. Good. Ensure the flag genuinely bypasses the
  new CSS + component (kill-switch parity with `CONTENT_OVERLAY_ENABLED`).

## Verdict
**NEEDS REVISION** before `/tdd`. Fold these into the spec:
1. Make the overlay inset **per-surface** (not one global), or explicitly accept +
   document the thumbnail reframe (P0 piece-drift).
2. Add **orientation** to the `GameBoard` contract + a black-flip acceptance
   criterion & test (P0).
3. Gate flag-on behind **"final art confirmed"** (P0 OQ#3) and **human before/after
   visual sign-off** per phase (P1 vr-baseline).
4. Add **a11y preservation** (role=grid + per-cell names) and **namespaced CSS**
   to acceptance (P1).
5. Specify **one image-set tile rule, not 64 `<picture>`** (P2/perf).

Then it is READY for a phased `/tdd` (Phase 0 first — promote + relocate, no flip).
P0 #3 (art final?) is a founder answer; the rest are spec edits.
