# Surface System Correction — Design Spec

**Date:** 2026-03-25
**Status:** Frozen
**Goal:** Restore presence, legibility, and authority across all screens without redesigning architecture. Correct the opacity/surface/contrast system that drifted too far toward transparency.

## Core Principle

> The world/background can be atmospheric. The HUD, surfaces, and panels cannot.

---

## Surface Tiers

### Surface A — Full Panel (Dominant Opaque)

**Opacity:** 0.95
**Backdrop:** `blur(24px)`
**Border:** `rgba(255, 255, 255, 0.08)`
**Scrim behind panel:** `bg-black/50` (soft, only to dim peripheral forest)

The panel dominates the viewport. The world is visible only as ambient context in the periphery — through rounded corners (`rounded-t-3xl` or `rounded-3xl`) and edge gaps. This peripheral visibility is strictly atmospheric. It must not compromise text contrast or interactive clarity within the panel itself.

**Screens:** About, Trophy Vitrine, Legal pages.

### Surface B — Sheet / Modal (Dense)

**Opacity:** 0.82
**Backdrop:** `blur(20px)`
**Border:** `rgba(255, 255, 255, 0.10)`
**Scrim behind sheet:** `bg-black/60`

The forest is faintly perceptible but never competes with content. Sheets feel solid and authoritative.

**Inner card override:** Inner cards may use a stronger fill than the parent sheet when hierarchy requires a hero state. This applies especially to featured store items and owned badge rows, which need elevated mass to read as protagonists within the sheet.

**Screens:** Store, Badges, Hall of Rooks, Exercises.

### Surface B+ — Modal Premium (Near-Opaque)

**Opacity:** 0.88–0.92
**Backdrop:** `blur(24px)`
**Border:** `rgba(255, 255, 255, 0.08)`
**Scrim behind modal:** `bg-black/70`

Centered modals with high-stakes decisions. Almost fully opaque to command focus.

**Screens:** Arena Difficulty selector (0.90), Mission Briefing (0.92).

### Surface C — Controls / HUD (Range by Role)

Surface C is not a single value. It is a range scaled by the control's role in the interface:

| Sub-level | Opacity | Backdrop | Use |
|-----------|---------|----------|-----|
| C-light | 0.55 | `blur(10px)` | Progress chip, exercise chip, info tags |
| C-mid | 0.60 | `blur(12px)` | Arena HUD buttons, back/resign, icon actions |
| C-heavy | 0.62–0.65 | `blur(14px)` | Footer bar, dock base |

**C-heavy restriction:** C-heavy is exclusively for persistent HUD/navigation elements (footer, dock). It must not be reused for content containers, lists, or any element that holds readable text requiring sustained attention.

**All C-level borders:** `rgba(255, 255, 255, 0.12)`

---

## Header Pattern B — Dense Integrated Zone

All sheets (Surface A and B) use Header Pattern B: the same layout as today but with a clearly denser, more visible header zone within the sheet. The header is not a separate bar — it is an integrated zone with more mass.

### Tokens

| Token | Default | Fallback | Purpose |
|-------|---------|----------|---------|
| Header bg | `rgba(255, 255, 255, 0.08)` | `rgba(255, 255, 255, 0.06)` | Mass over sheet body — differentiates without cutting |
| Header border-bottom | `rgba(255, 255, 255, 0.08)` | — | Soft separation, connected to body |
| Header padding | `20px 20px 18px` | — | Generous air = presence |
| Title color | `#f1f5f9` (slate-100) | — | Full white, always legible |
| Close button bg | `rgba(255, 255, 255, 0.10)` | `rgba(255, 255, 255, 0.08)` | Tactile and visible |
| Close button border | `rgba(255, 255, 255, 0.12)` | — | Reinforced presence |

### Criteria

- The user identifies the header in under 1 second.
- The title never sinks into the artistic background.
- The close button reads as clearly tactile (44px touch target minimum).
- The header feels premium, not administrative.
- The body remains visually connected to the header — no hard cut.

### Applies to

Store, Badges, Hall of Rooks, Exercises, About, Trophy Vitrine.

---

## Footer & Dock Adjustments

| Element | Before | After |
|---------|--------|-------|
| Footer bg | `rgba(2, 12, 24, 0.50)` | `rgba(2, 12, 24, 0.65)` |
| Footer border-top | `rgba(255, 255, 255, 0.03)` | `rgba(160, 205, 225, 0.10)` |
| Dock items opacity | `0.20` | `0.45` |
| Dock items bg | `rgba(255, 255, 255, 0.03)` | `rgba(255, 255, 255, 0.08)` |
| Dock items border | `rgba(255, 255, 255, 0.05)` | `rgba(255, 255, 255, 0.10)` |

---

## Screen Classification Map

| Screen | Surface | Opacity | Header | Key Change |
|--------|---------|---------|--------|------------|
| About | A | 0.95 | Pattern B | Dominant panel with breathing edges |
| Trophy Vitrine | A | 0.95 | Pattern B | Dominant panel, cards with mass, ceremonial header |
| Store | B | 0.82 | Pattern B | Dense sheet, featured card reinforced |
| Badges | B | 0.82 | Pattern B | Opaque sheet, solid rows |
| Hall of Rooks | B | 0.82 | Pattern B | Real sheet with body |
| Exercises | B | 0.82 | Pattern B | Cards with body, dense sheet |
| Arena Difficulty | B+ | 0.90 | — | Premium modal, near-opaque |
| Mission Briefing | B+ | 0.92 | — | Already correct, maintain |
| Footer + Dock | C-heavy | 0.65 | — | Dock items 0.45, visible borders |
| Arena HUD buttons | C-mid | 0.60 | — | Reinforced bg/border |
| Progress chip | C-light | 0.55 | — | Maintain, already has mass |

---

## Anti-Regression Rule

**Any screen containing text, lists, metadata, and secondary actions MUST use Surface A or Surface B (high). Never Surface C.**

Surface C is exclusively for punctual controls (chips, buttons, dock) that live *within* the world. If an element contains readable content and requires sustained user attention, it does not belong to Surface C.

This rule exists to prevent future regressions where pursuit of transparency sacrifices legibility. The world is atmospheric. The surfaces are not.

---

## Per-Screen Specific Adjustments

### About
Full panel Surface A. Header Pattern B. Panel with `rounded-3xl` — breathing edges expose the mission-shell world behind. All link items get reinforced backgrounds.

### Trophy Vitrine
Full panel Surface A. Header Pattern B with ceremonial treatment. Trophy cards get increased fill (`bg-[#121c2f]` already solid — maintain, ensure border contrast). Header needs more mass than current state.

### Hall of Rooks (Leaderboard)
Surface B sheet. Currently too weak — the `sheet-bg-leaderboard` overlay at 0.58 must rise to 0.82 effective opacity. Header Pattern B with crown icon. Row backgrounds reinforced.

### Store
Surface B sheet. `sheet-bg-shop` overlay rises to 0.82. Featured item card uses inner card override — stronger fill, amber ring, elevated shadow. Non-featured items at standard sheet fill. Header Pattern B with amber accent.

### Badges
Surface B sheet. `sheet-bg-badges` overlay rises to 0.82. Owned badge rows use inner card override — stronger emerald fill and glow to read as heroes. Locked badges at reduced but still readable fill. Header Pattern B with emerald accent.

### Exercises
Surface B sheet. No background image currently — add one or use solid Surface B fill. Exercise cards get reinforced backgrounds. Active exercises pop, locked ones readable but subdued. Header Pattern B with cyan accent.

### Arena Difficulty Selector
Surface B+ modal (0.90). Already uses `--surface-frosted` at 0.92 — adjust to 0.90 for consistency. Scrim behind: `bg-black/70`. No header pattern — centered modal with fantasy-title.

### Arena HUD Buttons
Surface C-mid (0.60). Back and resign buttons: `bg rgba(6, 14, 28, 0.60)`, `border rgba(255, 255, 255, 0.12)`, `backdrop-blur(12px)`. Confirm states maintain their existing color treatments (white for back, rose for resign).

### Footer + Dock
Surface C-heavy (0.65). Dock items at 0.45 opacity (up from 0.20). Center button (Free Play) maintains teal accent treatment. Footer border-top visible at `rgba(160, 205, 225, 0.10)`.

---

## CSS Implementation Strategy

Define CSS custom properties for each surface tier in `globals.css`:

```css
--surface-a: rgba(6, 14, 28, 0.95);
--surface-b: rgba(6, 14, 28, 0.82);
--surface-b-plus: rgba(6, 14, 28, 0.90);
--surface-c-light: rgba(6, 14, 28, 0.55);
--surface-c-mid: rgba(6, 14, 28, 0.60);
--surface-c-heavy: rgba(6, 14, 28, 0.65);

--header-zone-bg: rgba(255, 255, 255, 0.08);
--header-zone-border: rgba(255, 255, 255, 0.08);
```

Update the existing `.sheet-bg-*::after` overlays to use `--surface-b` instead of the current `rgba(10, 20, 25, 0.58)`.

Replace inline opacity/bg values in components with the corresponding CSS variable or Tailwind arbitrary value referencing the variable.

---

## What This Spec Does NOT Change

- Board geometry or hit-grid calibration
- Piece rendering or game logic
- Arena game flow or chess engine
- Victory NFT mint flow
- Coach overlay stacking (fixed in previous session)
- Hero selector layout (fixed in previous session)
- CTA button design (fixed in previous session)
