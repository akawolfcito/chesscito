# Plan — Visual Redesign (Candy Game Aesthetic)

**Spec**: `docs/superpowers/specs/2026-04-16-visual-redesign-candy-game-design.md`
**Date**: 2026-04-16

## Phases & Tasks

### Phase 1 — Asset extraction

- [ ] Identify pixel regions for each sprite in `design/redesign/assets.png` (1086×1448)
- [ ] Run `sips` crop commands to generate individual PNGs
- [ ] Save to `apps/web/public/art/redesign/{pieces,avatars,banners,board}/`
- [ ] Visual verify each extraction (no neighboring sprite bleed, clean transparency if possible)
- [ ] Commit: `chore(assets): extract redesign sprites from source sheet`

### Phase 2 — Visual tokens + board fix

- [ ] Add redesign palette tokens to `globals.css`
- [ ] Fix `.playhub-board-canvas` sizing (height-first, fixes rank-1 cutoff)
- [ ] Apply cream/olive board tile colors
- [ ] Make `.playhub-game-stage` and `.playhub-stage-shell` flex-centered
- [ ] Visual verify both boards (play-hub + arena) show 8 full ranks at 360px + 390px
- [ ] Commit: `fix(board): resolve rank 1 cutoff with height-first sizing`
- [ ] Commit: `feat(tokens): add candy-game palette and olive board colors`

### Phase 3 — Arena vertical slice

- [ ] Create `CandyButton` component (green/red/blue 3D variants)
- [ ] Create `WoodenBanner` wrapper for Chess title and Your Turn
- [ ] Update `arena-hud.tsx` with You vs Bot card + avatars + VS medal
- [ ] Swap piece art in `arena-board.tsx` (use redesign set)
- [ ] Update `arena-end-state.tsx` — Resign as red candy button, Play as green
- [ ] Add Undo button (if applicable to current arena flow)
- [ ] Visual verify Arena at 360px + 390px
- [ ] Commit per logical chunk

### Phase 4 — Play Hub adaptation

- [ ] Apply piece swap to `board.tsx`
- [ ] Wrap mission panel heading in wooden banner style
- [ ] Style piece rail as wooden shelf
- [ ] Update context action button to candy green
- [ ] Verify no Resign/Undo leakage (those are Arena-only)
- [ ] Visual verify Play Hub at 360px + 390px
- [ ] Commit per logical chunk

### Phase 5 — Deferred asset spec

- [ ] Create `docs/superpowers/specs/2026-04-16-redesign-deferred-assets.md` with AI prompts
- [ ] List each missing asset with exact spec (dimensions, style notes, prompt)
- [ ] Commit: `docs: queue deferred redesign assets with generation prompts`

## Dependencies

- Phase 2 requires Phase 1 (extracted piece art for visual verification)
- Phases 3 + 4 can run in parallel after Phase 2
- Phase 5 happens last, summarizing remaining work

## Rollback Plan

All changes are CSS + asset additions. To rollback:
1. Revert CSS token changes
2. Remove `/art/redesign/` directory
3. Original piece set remains untouched in `/art/pieces/`

## Verification Checklist

Per phase:
- [ ] iPhone SE viewport (375×667)
- [ ] Android compact (360×640)
- [ ] Standard mobile (390×844)
- [ ] Board shows all 8 ranks
- [ ] No overflow clipping
- [ ] Buttons reachable (44px min touch target)
- [ ] Type scale respected (no arbitrary text sizes)
