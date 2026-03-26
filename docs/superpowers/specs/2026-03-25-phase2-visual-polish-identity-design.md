# Phase 2 Design Spec — Visual Polish & Identity

**Date:** 2026-03-25
**Status:** Approved
**Scope:** Visual polish, overlay differentiation, signature moments — no architecture changes
**Depends on:** Phase 1 HUD redesign (completed)

---

## Design Principles (Hard Rules)

1. **No architecture changes.** Block layout, zone structure, and component hierarchy from Phase 1 are frozen.
2. **Glow budget: max 2 protagonist glows per screen.** Hero piece (top) and CTA button (bottom) are the two. Inner glows for state (owned badge, active exercise) do NOT count toward this limit — they are ambient, not hierarchical.
3. **Accent by role.** Each overlay family has one accent color. No mixing. No gradients across families.
4. **Animation budget: 1 signature animation per screen.** Hero selector gets the "plop". Victory gets sparkles. Other screens are static.
5. **Glow must feel like halo, not LED.** If a glow competes with adjacent elements (target label, utility actions), reduce intensity until it recedes. The test: squint at the screen — glow should be atmosphere, not a point light.

---

## 1. Hero Selector Polish

### Piece Scale

| Element | Phase 1 | Phase 2 |
|---|---|---|
| Hero circle | `h-16 w-16` (64px) | Unchanged |
| Hero icon | `text-2xl` (24px) | `text-3xl` (30px) |
| Hero border | `border-2 border-cyan-400/45` | `border-2 border-cyan-300/60` |
| Hero glow | `shadow-[0_0_16px_rgba(34,211,238,0.20)]` | `shadow-[0_0_20px_rgba(34,211,238,0.30)]` |
| Hero bg | `bg-cyan-500/[0.12]` | `bg-gradient-to-b from-cyan-400/15 to-cyan-600/8` |
| Piece label | `text-[7px] font-bold text-cyan-200` | `text-[8px] font-extrabold tracking-[0.15em] text-cyan-100` |
| Inactive circle | `h-9 w-9` (36px) | `h-8 w-8` (32px) — default. Fall back to `h-[34px] w-[34px]` if real-device testing shows legibility issues at 32px. |
| Inactive opacity | `opacity-30` | `opacity-[0.22]` |
| Target value | `text-lg` (18px) | `text-xl` (20px) `font-black` (weight 900) |

**Glow guardrail:** If the hero halo visually bleeds into the target label or utility band actions on device, reduce shadow to `shadow-[0_0_16px_rgba(34,211,238,0.22)]`. The halo must frame the piece, not flood the zone.

### Signature Animation: Piece Selection "Plop"

When the active piece changes, the new hero gets a micro scale-bounce:

```
0%   → scale(0.95)
40%  → scale(1.03)
100% → scale(1.0)
```

Duration: `300ms`, easing: `cubic-bezier(0.34, 1.56, 0.64, 1)`. Implemented as a CSS keyframe `hero-plop` applied via a transient class toggled on piece change.

Only the hero circle animates. Inactive pieces transition smoothly with `transition-all duration-200`.

---

## 2. Board Stage Polish

### Vignette

Add an inset shadow to the board container to darken edges and focus the eye on the center:

```
shadow-[inset_0_0_40px_rgba(0,0,0,0.3)]
```

Applied to the board wrapper div. The board image itself is unchanged. The vignette is a CSS-only effect on the container.

### Board Corners

Add `rounded-lg overflow-hidden` to the board wrapper. Gives the board soft corners without clipping gameplay elements.

### Footer Transition Line

Between board and footer, add a `1px` gradient line:

```tsx
<div className="h-px bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent" />
```

This is a whisper of a line — exists as a visual transition, not a separator. If it feels heavy on device, reduce to `via-cyan-400/6`.

**Priority:** Medium. These are feel improvements, not identity-critical.

---

## 3. Overlay Differentiation

### Accent Color System

| Overlay | Accent | Usage |
|---|---|---|
| Exercise Drawer | Cyan (`cyan-500`) | Tactical, progress |
| Shop + Purchase Confirm | Amber (`amber-500`) | Premium, commerce |
| Badges | Emerald (`emerald-500`) | Achievement, collection |
| Leaderboard | Purple (`purple-500`) | Competitive, ranking |
| Errors | Rose (`rose-500`) | Failure, warning |
| Neutral/Navigation | White/Slate | Generic, no accent |

### Accent Stripe

A `2px` (`h-0.5`) gradient line at the very top of each sheet, immediately below the drag handle:

```tsx
<div className="h-0.5 w-full bg-gradient-to-r from-{accent}-500/40 via-{accent}-400/20 to-{accent}-500/40" />
```

**Rules:**
- Very fine and elegant — graphic signature, not a separator
- No glow, no shadow, no animation
- Fades to transparent at edges (the gradient handles this)
- Must not compete with the sheet title or content

### Title Icon Badge

A `20px` icon to the left of the sheet title:

```tsx
<SheetTitle className="fantasy-title text-cyan-50 flex items-center gap-2">
  <IconComponent size={20} className="text-{accent}-400/40" />
  {title}
</SheetTitle>
```

| Sheet | Icon | Color |
|---|---|---|
| Exercise Drawer | `Crosshair` | `cyan-400/40` |
| Shop | `ShoppingBag` | `amber-400/40` |
| Purchase Confirm | `ShoppingBag` | `amber-400/40` |
| Badges | `Trophy` | `emerald-400/40` |
| Leaderboard | `Crown` | `purple-400/40` |

Icon opacity is `40%` — present but subordinate. It adds identity without competing with content.

**Priority:** High. This is the core visual differentiation system.

---

## 4. Signature Components — 4 Featured Moments

### Moment 1: Selected Piece (hero selector)

Covered in Section 1. The "plop" animation + enhanced glow + gradient bg make the selection feel like choosing your card.

### Moment 2: Back to Hub Confirm (arena HUD)

The inline confirm pattern already works well. Polish only:

- Confirming state: add `backdrop-blur-sm` to the button for a momentary "pause" feel
- Border: `border-white/20` → `border-white/30` in confirm state
- No other changes — the countdown bar is already signature

### Moment 3: Owned Badge (badge sheet)

Current owned badge card: `bg-emerald-500/10 ring-1 ring-emerald-500/20` — flat, same weight as claimable.

**Enhanced owned state:**

```tsx
<div className="bg-emerald-500/10 ring-1 ring-emerald-500/20 shadow-[inset_0_0_16px_rgba(16,185,129,0.12)] relative">
  {/* Existing badge content */}

  {/* Owned check badge — top right */}
  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]">
    &#10003;
  </span>
</div>
```

The inner glow (`inset shadow`) is ambient — it does NOT count toward the glow budget. The check badge is a permanent trophy marker. Together they make "owned" feel like a real achievement, not just a state toggle.

### Moment 4: Featured Store Item (shop sheet)

Current: all items have identical `rune-frame` styling.

**Featured item enhancement:**

```tsx
<div className="rune-frame relative ring-2 ring-amber-400/30">
  {/* Tiny FEATURED label */}
  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/15 border border-amber-400/25 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-amber-400/60">
    Featured
  </span>

  {/* Existing item content */}
</div>
```

**Rules:**
- The FEATURED label is tiny and subordinate — never competes with price or CTA
- `ring-2 ring-amber-400/30` replaces the default ring — stronger but still subtle
- Only 1 item can be featured at a time
- The label floats above the card (negative top position), not inside it
- No glow on the label itself

**Priority:** High.

---

## 5. About Page — Same Universe

### Background

Replace `bg-[#0b1220]` with `mission-shell` class on the container. This gives it the same dark gradient/texture as the game screens.

### Logo

Add halo glow:

```
drop-shadow-[0_0_24px_rgba(103,232,249,0.15)]
```

### Title "Chesscito"

Add text glow to match game world:

```
drop-shadow-[0_0_8px_rgba(103,232,249,0.2)]
```

### Nav Links

Replace `bg-cyan-950/40 rounded-xl` with:

```
rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]
```

Same visual family as dock items and utility elements — part of the game, not a settings page.

**Priority:** Low. These are cheap wins but not identity-critical.

---

## 6. Implementation Priority

### High Priority (identity-critical)
1. Hero selector polish (icon size, glow, gradient bg, inactive scale, label, plop animation)
2. Overlay accent stripes + title icon badges (all 4 sheets)
3. Featured store item (ring + label)
4. Owned badge state (inner glow + check badge)

### Medium Priority (feel improvements)
5. Board vignette + corners + footer transition line
6. Back to hub confirm polish (backdrop-blur + border)
7. Target value size bump (text-xl, font-black)

### Low Priority (cheap wins)
8. About page (mission-shell bg, logo glow, nav link restyle, title glow)

---

## Out of Scope

- Layout or architecture changes (frozen from Phase 1)
- New components or screens
- Arena HUD redesign (future phase)
- New animations beyond the hero plop
- Desktop viewport considerations
- Exercise drawer sheet content redesign
- Victory overlay redesign (already has sparkles + halos)
