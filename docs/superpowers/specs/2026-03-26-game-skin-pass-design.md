# Game Skin Pass — Design Spec

**Date:** 2026-03-26
**Status:** Frozen
**Prerequisite:** Surface System Correction (2026-03-25) — must be applied first.
**Goal:** Elevate Chesscito from "premium sober product" to "premium game with tactility, ritual, and memorable components" — without redesigning architecture or breaking the frozen surface system.

## Core Principle

> The surface system provides legibility and structure. The game skin pass adds tactility, affordance, materialidad, and game feel on top of it.

This is not a redesign. It is a skin pass: targeted improvements to motion, affordance, hit areas, and visual weight that make the UI feel like a game.

---

## 1. Hero Selector — Rail Compacto + Materialidad

### Problem

- Changing between rook/bishop/knight causes layout reflow and flicker.
- Active button is 64px, inactive is 32px — container resizes on every switch.
- Inactive tabs are nearly invisible (opacity 0.16), don't read as touchable.
- The selector feels like 3 disconnected icons, not a unified game component.

### Solution: Option C — Compact Rail

A pill-shaped rail container groups all 3 tabs as a single component. Fixed-size containers eliminate reflow. The active tab is distinguished by glow/border/scale, not by layout size.

### Constraints

1. The rail is a base/material surface, not a protagonist. It sits behind the tabs.
2. Must not feel like a generic segmented control / app toggle.
3. Inactive tabs must be clearly visible and touchable (opacity 0.50, border, hover state).
4. Layout is completely fixed — zero reflow, zero board flicker on piece change.
5. Animations are restricted to: opacity, scale, glow, tiny translate. No size/position changes.

### Tokens

| Token | Value | Purpose |
|-------|-------|---------|
| Rail height | `60px` | Fixed, compact |
| Rail background | `rgba(6, 14, 28, 0.65)` | Surface C-heavy level |
| Rail border | `1px solid rgba(255, 255, 255, 0.10)` | Subtle containment |
| Rail radius | `36px` | Pill shape |
| Rail shadow | `0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)` | Materialidad |
| Rail backdrop | `blur(14px)` | Depth |
| Tab container width | `68px` | Fixed per tab |
| Tab container height | `52px` | Fixed per tab |
| Tab radius | `28px` | Pill segment |
| Active tab bg | `linear-gradient(180deg, rgba(34,211,238,0.22) 0%, rgba(6,14,28,0.80) 100%)` | Lit from above |
| Active tab border | `1.5px solid rgba(103,232,249,0.50)` | Cyan highlight |
| Active tab shadow | `0 0 14px rgba(34,211,238,0.25), inset 0 1px 0 rgba(255,255,255,0.08)` | Glow + inner edge |
| Active icon size | `26px` | Prominent |
| Active icon filter | `drop-shadow(0 0 6px rgba(34,211,238,0.5))` | Glow |
| Active label | `8px bold uppercase tracking-[0.15em] white` | Visible class name |
| Inactive tab opacity | `0.50` | Clearly visible |
| Inactive tab border | `1px solid rgba(255,255,255,0.05)` | Subtle edge |
| Inactive tab bg | `rgba(255,255,255,0.02)` | Minimal fill |
| Inactive hover opacity | `0.70` | Feedback |
| Inactive hover bg | `rgba(255,255,255,0.05)` | Light fill on touch |
| Inactive hover border | `rgba(255,255,255,0.10)` | Stronger edge |
| Inactive icon size | `20px` | Readable |
| Inactive label | hidden | Only active shows label |

### Layout Stabilization

The hero block must have completely fixed dimensions:

| Zone | Height | Behavior |
|------|--------|----------|
| Piece selector row | `60px` (rail height) | Fixed |
| Gap | `12px` | Fixed |
| Target/descriptor zone | `48px` | Fixed (contains "Move to" + target label) |
| **Total hero block** | **120px + safe-area-top** | **Never changes** |

When piece changes:
- Rail container stays exactly the same size.
- Active indicator transitions via `opacity + scale + glow` (200ms cubic-bezier).
- The plop animation fires on the active tab icon only, not the container.
- Board receives no layout change — zero flicker.

### Piece Change Animation

```
Tab becoming active:
  opacity: 0.50 → 1.0 (150ms ease-out)
  scale: 1.0 → 1.02 → 1.0 (200ms cubic-bezier(0.34, 1.56, 0.64, 1))
  border: transparent → cyan/50 (150ms)
  glow: 0 → full (150ms)

Tab becoming inactive:
  opacity: 1.0 → 0.50 (150ms ease-out)
  scale: 1.0 (no change)
  border: cyan/50 → transparent (150ms)
  glow: full → 0 (150ms)

Icon plop (active only):
  scale: 0.95 → 1.03 → 1.0 (300ms cubic-bezier)
```

---

## 2. Top Actions — Affordance Upgrade

### Problem

Back and more buttons are too small and ghostly. They don't read as touchable elements at first glance.

### Solution

Increase hit area, add visible surface, equalize visual weight.

### Tokens

| Token | Before | After |
|-------|--------|-------|
| Back button size | `32px`, no bg | `40px`, `bg: rgba(255,255,255,0.08)`, `border: 1px solid rgba(255,255,255,0.12)` |
| Back icon size | `16px` | `18px` |
| Back icon color | `white/35` | `white/65` |
| More button size | `28px`, no bg | `40px`, `bg: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.10)` |
| More icon size | `14px` | `16px` |
| More icon color | `white/25` | `white/55` |
| Pressed state (both) | none | `bg: rgba(255,255,255,0.12)`, `scale(0.95)`, 100ms |

**Rule:** More must not be visually weaker than back. Both must read as clearly tactile at first glance. Back gets slightly more contrast (primary action), more gets equal size but slightly softer fill.

### Applies to

- Mission panel utility band (Lv + exercise drawer + more action)
- Any future top-bar affordances

---

## 3. Trophy Vitrine Header — Compact Ceremonial

### Problem

The header zone at `min-h-40` (160px) is too tall relative to the content below it. The list should command viewport sooner.

### Solution

Reduce header height while keeping the ceremonial tone.

### Tokens

| Token | Before | After |
|-------|--------|-------|
| Header min-height | `min-h-40` (160px) | `min-h-[96px]` |
| Header max-height | `max-h-[200px]` | `max-h-[120px]` |
| Padding top | `pt-6` | `pt-4` |
| Padding bottom | `pb-5` | `pb-4` |
| Gradient opacity | `opacity-40` | `opacity-35` |
| Title size | `text-xl` | `text-xl` (keep) |
| Description | `text-xs text-slate-400` | `text-xs text-slate-400` (keep) |

The header retains its gradient overlay, back button, and fantasy treatment — just at 60% of the vertical space.

---

## 4. Sheet Close Button — Subtle Tactile

### Problem

The current close button (44px ring with bg + border) competes visually with the sheet title. But removing all surface makes it too ghostly.

### Solution

Intermediate: 40px hit area, visible icon, micro-surface that reads as tactile but doesn't compete with the title.

### Tokens

| Token | Value |
|-------|-------|
| Size | `40px` (h-10 w-10) |
| Border-radius | `50%` (rounded-full) |
| Background | `rgba(255, 255, 255, 0.05)` |
| Border | `1px solid rgba(255, 255, 255, 0.08)` |
| Icon color | `rgba(255, 255, 255, 0.45)` |
| Icon size | `16px` (h-4 w-4) |
| Hover bg | `rgba(255, 255, 255, 0.10)` |
| Hover icon color | `rgba(255, 255, 255, 0.65)` |
| Transition | `all 150ms ease` |

This is subtle but not invisible. The micro-surface gives it enough mass to read as a button without pulling attention from the title.

### Applies to

All bottom sheets: Store, Badges, Hall of Rooks, Exercises.

---

## 5. Store Hierarchy — Featured Dominance

### Problem

Featured item and secondary items are too close in visual weight. Featured should clearly dominate.

### Solution

Increase featured emphasis, decrease secondary visibility.

### Featured Card Tokens

| Token | Before | After |
|-------|--------|-------|
| Border | `amber-400/40` | `amber-400/50` |
| Background | `rgba(6,14,28,0.90)` | `rgba(6,14,28,0.92)` |
| Ring shadow | `0 0 20px rgba(245,158,11,0.12)` | `0 0 24px rgba(245,158,11,0.15), inset 0 0 16px rgba(245,158,11,0.04)` |
| Tag text color | `amber-400/60` | `amber-400/80` |
| Tag bg | `amber-500/20` | `amber-500/25` |
| Tag border | `amber-400/35` | `amber-400/45` |

### Secondary Card Tokens

| Token | Before | After |
|-------|--------|-------|
| Opacity | `0.90` | `0.75` |
| Background | `white/[0.04]` | `white/[0.02]` |
| Border | `white/[0.08]` | `white/[0.05]` |
| Title color | `slate-100` | `slate-300` (cbd5e1) |
| Subtitle color | `slate-400` | `slate-500` (64748b) |

**Rule:** Secondary must not look disabled — just clearly secondary. The opacity floor is 0.70; below that it risks looking broken.

---

## What This Spec Does NOT Change

- Surface system tiers (A/B/B+/C) — frozen
- Header Pattern B structure — frozen
- Footer/dock layout or opacity — frozen
- Board geometry or game logic
- Arena game flow, chess engine, or victory NFT mint
- Sheet content structure or data flow
- Any backend, contract, or API behavior

---

## Component Priority Order

1. Hero selector (rail + layout stabilization) — highest visual risk, most impactful
2. Top actions (affordance upgrade) — quick win, improves whole play-hub
3. Trophy Vitrine header (compact) — quick fix, improves content-first feel
4. Sheet close button (subtle tactile) — consistency pass across 4 sheets
5. Store hierarchy (featured dominance) — final polish
