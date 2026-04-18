# Redesign Deferred Assets — Generation Specs

**Date**: 2026-04-17
**Status**: Queued for asset production
**Relates to**: `2026-04-16-visual-redesign-candy-game-design.md`

## Context

The Arena + Play Hub candy-game redesign reached a ship-worthy state for the **board itself** (frame, tiles, pieces, labels, HUD). The remaining gap against the reference mockup (`design/redesign/escenario.png`) is entirely the **surrounding scene and chrome** — assets we did not have on hand and chose not to fake in CSS.

This doc queues the missing assets with enough detail for consistent generation.

## Must-have (blocks visual parity with mockup)

### 1. Outdoor forest scene background

- **Purpose**: Replace the current dark teal `arena-bg` void around the board with the mockup's lush outdoor scene.
- **Target file**: `apps/web/public/art/redesign/bg/outdoor-scene.png`
- **Dimensions**: 1080×1920 (mobile portrait, 9:16)
- **Visual notes**: Grass field with scattered stone tiles, rocks, low bushes, soft vignette corners, slight sparkle/particles. Top portion brighter than bottom. Greenery should frame the board without overpowering pieces.
- **Style anchors**: Clash Royale / Royal Match map tiles.
- **Prompt sketch**: "Top-down mobile game map, candy aesthetic, grass clearing with stone floor tiles, scattered moss rocks, low bushes on sides, soft cartoon shading, transparent center-safe zone for a chess board, 1080x1920, no text, no characters."

### 2. Dock icon set — 5 pieces

- **Purpose**: Replace the current dock's dark slate icon plates with the mockup's playful rounded wooden plates.
- **Target files**: `apps/web/public/art/redesign/dock/{badge,shop,chess,trophy,mail}.png`
- **Dimensions**: 160×160 each, transparent background
- **Style**: Round wood-backed plate with a candy icon at center (badge paw, treasure chest, crossed-swords on shield, trophy cup, envelope). Center "chess" (Free Play) is elevated with a brighter ring.

### 3. Chess title banner (blank variant)

- **Purpose**: Reuse the wooden ribbon style but with a clean center area for dynamic text ("Mission", "Exercise 3/15", etc.).
- **Target file**: `apps/web/public/art/redesign/banners/banner-blank.png`
- **Dimensions**: 1230×260
- **Notes**: Same ribbon tails as `banner-chess.png` and `banner-your-turn.png` but with a blank wood center so the app overlays dynamic text with CSS + Fredoka One.

## Should-have (visual polish)

### 4. Currency strip

- **Purpose**: Top HUD resource bar (XP progress, coin counter, gem counter, purple gem counter) as in the mockup.
- **Target files**:
  - `apps/web/public/art/redesign/hud/xp-bar.png` (horizontal bar with percentage fill mask)
  - `apps/web/public/art/redesign/hud/counter-coin.png`, `counter-gem.png`, `counter-mystic.png` (rounded pill ends with gem icon + plus button)
- **Notes**: Optional for v1. Play Hub may not need it; Arena might display only progression relevant to the match.

### 5. Piece white-on-cream outline helper

- **Purpose**: White/cream pieces on cream light tiles have borderline contrast (UX agent flag).
- **Option A**: Add a darker outer drop-shadow to cream pieces only via CSS (`filter` tweak in `arena-treat-natural`).
- **Option B**: Re-export the white piece PNGs with a subtle darker outline built in.
- **Recommendation**: Start with Option A (CSS tweak, no asset re-export) and re-evaluate.

## Nice-to-have (character)

### 6. Ambient sparkle/particles layer

- **Purpose**: Break up visual staleness around the board, match the mockup's lived-in feel.
- **Target file**: `apps/web/public/art/redesign/bg/sparkles.png` (subtle particles, tileable or sprite-animated)
- **Notes**: Low priority — would be a Phase E4 polish pass.

## Integration notes

- Once the outdoor scene lands, swap `.arena-bg` background-image and extend to Play Hub's `atmosphere` class.
- Dock icons are wired via image paths in `persistent-dock.tsx`; no structural changes, just swap the paths.
- Currency strip is a **new component** — defer until the app has real data to populate it (badges earned, score, etc.).

## Priority order

1. Outdoor scene (biggest visual lift)
2. Dock icons (second-biggest consistency gap)
3. White piece contrast (CSS-only first)
4. Chess title banner blank variant (enables dynamic title chrome)
5. Currency strip (only if economy becomes visible)
6. Sparkles (polish)
