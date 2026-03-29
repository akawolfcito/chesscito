# Phase A — Depth & Atmosphere

**Date:** 2026-03-28
**Spec:** `docs/superpowers/specs/2026-03-28-premium-visual-layer-design.md` (Sections 2, 6, 9)
**Status:** Approved
**Effort:** S (CSS-only, no component logic changes)

## Objective

Add atmospheric depth to Play Hub and Arena via CSS gradient overlays. The user should feel *inside a world*, not looking at a flat interface. Zero new assets, zero JS, pure CSS.

## Current State

- **Play Hub**: `body` has `background-image: var(--playhub-game-bg)` — flat, no depth layers
- **Arena**: `.arena-bg::before` renders the same bg with `::after` as a dark scrim (`rgba(6,14,24,0.72)`)
- **Shell tokens** (`--shell-*`, `--treat-*`): already defined in `:root`
- **No atmospheric system exists** — this is greenfield CSS

## Design (from spec Section 2)

One reusable class `.atmosphere` with 3 CSS gradient layers:

| Layer | Pseudo | Effect | Value |
|-------|--------|--------|-------|
| Vignette | `::before` | Darkens edges, draws eye to center | `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)` |
| Light falloff | `::after` (gradient 1) | Top-to-bottom directional light simulation | `linear-gradient(to bottom, transparent 0%, rgba(6,14,28,0.15) 60%, rgba(6,14,28,0.3) 100%)` |
| Ambient haze | `::after` (gradient 2) | Depth fog near bottom | Combined in same `::after` via stacked `background` |

Both pseudo-elements: `position: absolute; inset: 0; pointer-events: none; z-index: 0;`
Direct content inside `.atmosphere` wrapper: `position: relative; z-index: 1;` — ensures interactive elements always stack above atmospheric layers.

## Spec Rules (hard constraints)

1. Overlays must never reduce board clarity, text contrast, or CTA legibility
2. No particles — depth from CSS gradients only
3. No state-reactive backgrounds — background defines place, not state
4. Max 2 pseudo-element layers per surface (we use exactly 2: `::before` + `::after`)
5. All overlays: `pointer-events: none`, `position: absolute` (compositor layer)
6. `prefers-reduced-motion` — exempt (gradients are not motion)

## Implementation Steps

### Step 1 — Define `.atmosphere` in globals.css

Add to `@layer components` in `globals.css`:

```css
/* ── Atmospheric depth overlays ── */

.atmosphere {
  position: relative;
}

.atmosphere::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(0, 0, 0, 0.35) 100%);
}

.atmosphere::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    linear-gradient(to bottom, transparent 0%, rgba(6, 14, 28, 0.15) 55%, rgba(6, 14, 28, 0.25) 100%),
    linear-gradient(to bottom, transparent 70%, rgba(6, 14, 28, 0.30) 100%);
}

.atmosphere > * {
  position: relative;
  z-index: 1;
}
```

**Location:** After the existing `/* ── Arena background ── */` section (~line 509).

**Notes:**
- Vignette center is offset to 40% Y to push focus slightly above center (where the board sits)
- Opacity values (0.35 vignette, 0.15–0.30 falloff) are initial tuning — adjust during visual review
- Arena already uses `::before` and `::after` on `.arena-bg`, so Arena gets a variant class

### Step 2 — Apply to Play Hub (body-level)

The Play Hub background lives on `body` (`globals.css` line 145). Options:

**Approach:** Add `.atmosphere` to the `<main>` or outermost wrapper in Play Hub rather than `body`, since `body` pseudo-elements would span the entire viewport including sheets.

Target: `mission-panel.tsx` outer container (the `flex h-[100dvh]` div). This is the Play Hub's full viewport wrapper.

### Step 3 — Apply to Arena

Arena already has `.arena-bg` with `::before` (blurred bg) and `::after` (dark scrim). We cannot add `.atmosphere` directly because pseudo-elements would conflict.

**Approach:** Merge atmospheric gradients into the existing `.arena-bg::after`:

```css
.arena-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(0, 0, 0, 0.25) 100%),
    linear-gradient(to bottom, transparent 0%, rgba(6, 14, 28, 0.10) 55%, rgba(6, 14, 28, 0.20) 100%),
    rgba(6, 14, 24, 0.72);
  z-index: 0;
}
```

Arena gets slightly reduced atmospheric intensity (0.25 vignette, 0.10–0.20 falloff) because the dark scrim already adds depth. Tuning during visual review.

### Step 4 — Ensure z-index layering doesn't break interactivity

Verify that:
- Board cells (`.playhub-board-hitgrid`) remain clickable above atmosphere layers
- CTAs in GameplayPanel remain clickable
- Dock remains clickable
- HUD bar remains interactive

The `.atmosphere` pseudo-elements use `z-index: 1` with `pointer-events: none`. All interactive elements should already be above z-index 1 or in their own stacking context. Verify by tapping through the full Play Hub flow.

### Step 5 — Build verification

```bash
cd apps/web && pnpm build
```

Zero new dependencies, no logic changes. One small wrapper class addition in `mission-panel.tsx`.

### Step 6 — Visual review gate

Manual MiniPay WebView review checklist:
- [ ] Board squares remain clearly distinguishable
- [ ] Board labels (a1–h8) remain legible
- [ ] Piece images on board remain clear
- [ ] HUD bar piece selector remains visible and tappable
- [ ] CTA buttons remain legible and tappable
- [ ] Stats text (score, timer) remains readable
- [ ] Dock icons remain visible and tappable
- [ ] Tutorial banner text remains readable when active
- [ ] Arena board remains clear with atmospheric merge
- [ ] Arena HUD elements remain legible
- [ ] No visible jank or performance degradation during gameplay
- [ ] Vignette feels natural, not like a visible overlay

**Rollback rule:** If any item fails, reduce opacity values or remove the layer. Clarity > richness.

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/globals.css` | Add `.atmosphere` class + merge atmosphere into `.arena-bg::after` |
| `apps/web/src/components/play-hub/mission-panel.tsx` | Add `atmosphere` class to outer container |

## Commits (expected)

1. `style: add .atmosphere CSS overlay system (vignette + light falloff)`
2. `style: apply atmosphere to Play Hub and Arena backgrounds`

## Risks

- **Opacity tuning**: Initial values are best-guesses from spec. Will need 1-2 rounds of visual adjustment.
- **z-index conflicts**: Low risk — atmosphere uses `pointer-events: none` and low z-index.
- **Arena pseudo-element merge**: Slightly more complex than adding a class, but avoids needing a wrapper div.

## Not In Scope

- Panel tiers (`panel-base`/`panel-elevated`/`panel-showcase`) — Phase B
- Sheet cohesion — Phase C
- Reward spectacle — Phase D
- Treatment class activation — Phase B
- New background assets — spec confirms none needed
