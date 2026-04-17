# Visual Redesign — Candy-Game Aesthetic (Royal Match Style)

**Date**: 2026-04-16
**Status**: Draft — pending implementation
**Scope**: Arena (vertical slice) + Play Hub (adaptation)

## Context

Current UI uses a dark slate/teal MiniPay aesthetic with subtle glow and minimalist panels. The user provided a new visual direction via `design/redesign/escenario.png` and `design/redesign/assets.png` — a vibrant casual-game aesthetic (Royal Match / Clash Royale style) with:

- Outdoor grass scene background
- 3D cartoon chess pieces (cream/ivory white, purple black)
- Wooden banners and candy-colored 3D buttons
- Cream + olive green board tiles with integrated rank/file labels
- Character avatars (You vs Bot)
- Playful dock icons (cupcake, chest, trophy, envelope)

Target: both **Arena** (native PvP fit — Resign/Undo/turns) and **Play Hub** (adapted — no PvP controls).

## Goals

1. Replace visual identity of Arena and Play Hub to match the candy-game mockup
2. Preserve MiniPay compatibility (390px max-width, mobile-first)
3. Reuse existing mechanics — no new features, only visual personalization
4. Keep the original piece set alongside the redesigned set (user may want theme switching later)
5. Document assets we cannot extract so they can be generated later with consistent prompts

## Non-Goals

- Adding gameplay features from the mockup (currency system, XP progression, leaderboards beyond what exists)
- Replacing existing smart contracts or economy (badges, VictoryNFT, retry shields remain)
- Desktop polish (mobile-first per project policy)
- Immediate generation of deferred assets (outdoor scene, bespoke dock icons, currency chrome)

## Asset Inventory

Source: `design/redesign/assets.png` (1086×1448) and `design/redesign/escenario.png` (1024×1536).

### ✅ Extract now (Phase 1)

Output directory: `apps/web/public/art/redesign/`

| Asset | Filename | Purpose |
|---|---|---|
| 6 white pieces | `pieces/w-{king,queen,rook,bishop,knight,pawn}.png` | New 3D cartoon set |
| 6 black pieces | `pieces/b-{king,queen,rook,bishop,knight,pawn}.png` | New 3D cartoon set |
| Avatar You | `avatars/you.png` | Arena HUD + Play Hub placeholder |
| Avatar Bot | `avatars/bot.png` | Arena HUD opponent |
| Banner Chess | `banners/chess-title.png` | Title header |
| Banner Your Turn | `banners/your-turn.png` | Turn indicator |
| VS medallion | `banners/vs-medal.png` | Match separator |
| Board tile light | `board/light-square.png` | Reference color |
| Board tile dark | `board/dark-square.png` | Reference color |
| Board corner | `board/corner.png` | Reference color for border |

Piece coordinates (approximate, to be refined during extraction):

The sprite sheet is organized in rows. White pieces row ≈ y=60–180, black pieces row ≈ y=230–370. Each piece ≈ 120×120 px with consistent spacing across 6 columns on the left half (x=0–720).

### 🎨 CSS-only (no new art)

- Color tokens: `--grass-green`, `--cream-ivory`, `--wood-brown`, `--olive-board-dark`, `--olive-board-light`, `--gem-purple`, `--candy-red`, `--candy-blue`, `--candy-green`
- 3D buttons (Play/Resign/Undo) — gradients + insets + shadows
- Wooden panels — CSS gradient + border treatment
- Board geometry fix (height-first sizing — fixes missing rank 1 bug)

### 📌 Deferred (generate later with stable prompts)

| Asset | Purpose | Placeholder strategy |
|---|---|---|
| Outdoor grass scene background | Replace `bg-game.png` | Radial gradient grass green with subtle pattern |
| Dock icon: cupcake | Achievements/collection | Current badge icon |
| Dock icon: treasure chest | Shop | Current shop icon |
| Dock icon: trophy | Leaderboard | Current trophy icon |
| Dock icon: envelope with notif | Invite | Current envelope icon |
| Currency counter chrome (XP bar, gold, gems) | HUD economy visuals | Not used v1 — Play Hub keeps star progress |
| Rank/file label sprites | Outside-board labels | CSS text with Fredoka One |

## Technical Approach

### Phase 1 — Asset extraction

Use `sips` (macOS) to crop `assets.png` by pixel regions into individual PNGs. Output to `apps/web/public/art/redesign/`. Iterate coordinates until each sprite is cleanly isolated.

### Phase 2 — Visual tokens + board fix

Update `globals.css`:

```css
:root {
  /* Redesign palette */
  --grass-green: hsl(95, 55%, 52%);
  --cream-ivory: hsl(45, 55%, 92%);
  --wood-brown: hsl(28, 45%, 38%);
  --olive-board-light: hsl(85, 40%, 78%);
  --olive-board-dark: hsl(88, 35%, 58%);
  --candy-red: hsl(0, 75%, 58%);
  --candy-blue: hsl(210, 80%, 58%);
  --candy-green: hsl(110, 60%, 48%);
  --gem-purple: hsl(280, 60%, 55%);
}
```

Board color override (used only in redesign mode or globally):

```css
.playhub-board-cell.is-light { background: var(--olive-board-light); }
.playhub-board-cell.is-dark { background: var(--olive-board-dark); }
.playhub-board-canvas { background: var(--wood-brown); }
```

Board fix (resolves rank 1 cutoff — height-first sizing):

```css
.playhub-game-stage,
.playhub-stage-shell { display: flex; align-items: center; justify-content: center; }
.playhub-board-canvas {
  aspect-ratio: 1 / 1;
  height: 100%;
  max-height: 23.5rem;
  max-width: 100%;
  width: auto;
}
```

### Phase 3 — Arena vertical slice

1. Swap piece art in `arena-board.tsx` via conditional: if `NEXT_PUBLIC_ASSET_THEME=candy`, use `/art/redesign/pieces/`; else default set
2. `arena-hud.tsx` — add "You vs Bot" card with avatars, ELO-like rating, VS medal
3. Add banner components: `ChessTitleBanner`, `YourTurnBanner`
4. Redesigned buttons: `<CandyButton variant="green|red|blue">` for Play/Resign/Undo
5. Dock gets CSS theming (keep existing icons for now)

### Phase 4 — Play Hub adaptation

1. Same board treatment + piece swap
2. Mission panel wrapped in wooden scroll styling
3. Piece rail visual upgrade — wooden shelf
4. No Resign/Undo (not applicable to puzzles)
5. "You" avatar can appear in HUD area showing player identity

### Phase 5 — Deferred assets spec

Document prompts for AI generation of:
- Outdoor grass scene (top-down, 1024×1536, bright saturated, slight vignette)
- Individual dock icons (matching candy aesthetic, 128×128 transparent PNG)
- Currency chrome (if ever needed)

## Risk Analysis

| Risk | Mitigation |
|---|---|
| VictoryNFT mint image uses piece art — swap changes future mints | Keep original set in `/art/pieces/`; redesign set in `/art/redesign/pieces/`. Mint flow continues using original unless explicitly swapped |
| DESIGN_SYSTEM.md contradicts new palette | Update design system at end of each phase |
| Theme switching complexity | For v1: controlled by `NEXT_PUBLIC_ASSET_THEME` env var or a single hardcoded flip. No runtime user preference toggle |
| Small screen (360px) breakage | Every phase verified at 360px and 390px |
| Wood banners made in CSS look flat compared to extracted wooden banners | Use extracted banner PNGs from assets.png (Chess title + Your Turn) |

## Implementation Order

1. **Phase 1**: Asset extraction (coords refined iteratively)
2. **Phase 2**: Tokens + board fix (also fixes rank-1 bug — user priority)
3. **Phase 3**: Arena vertical slice
4. **Phase 4**: Play Hub adaptation
5. **Phase 5**: Deferred asset prompts doc

Commit after each phase per project HARD RULE (granular commits).

## Success Criteria

- [ ] Arena at 360px and 390px shows full 8 rows, new pieces, You vs Bot card, candy buttons
- [ ] Play Hub at 360px and 390px shows full 8 rows, new pieces, adapted mission panel
- [ ] Original piece set still accessible under `/art/pieces/`
- [ ] VictoryNFT mint unchanged (or flag documented)
- [ ] DESIGN_SYSTEM.md updated with new palette
- [ ] Spec follow-up doc lists all deferred assets with generation prompts

## Open Questions

1. Theme switching mechanism — env var, user toggle, or hardcoded?
2. Should the original piece theme remain the default while we test, or flip the default to redesign immediately?
3. Does the `Chess` banner title appear in Arena only, or globally as brand header?
