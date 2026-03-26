# Asset Treatment System — Design Spec

**Date**: 2026-03-26
**Status**: Approved
**Scope**: CSS treatment rules for all visual assets using existing art — no asset replacement

## Problem

The component skin pass introduced carved/embossed treatments and warm accents, but applied them case-by-case. Five asset categories remain inconsistent:

1. Piece icons in the hero selector (still emoji, no CSS treatment control)
2. Dock icons (no treatment at all)
3. Badge images (grayscale/glow but no carved depth)
4. Arena pieces (color filters but no depth)
5. Decorative frames (basic backdrop blur only)

The result is a visual generation gap — some components feel like the new relic direction, others don't.

## Goal

A unified Asset Treatment System that:
- Defines shared tokens for materiality and state
- Provides category-specific classes that consume those tokens
- Enforces a graduated warm containment rule (hero / semi-warm / neutral)
- Works with current PNG/WebP assets
- Does not block future SVG migration

## Decisions

- **Direction**: Hybrid architecture — shared tokens + category classes (Approach C)
- **Hero selector**: Migrate from emoji to existing `/art/pieces/` images (Direction A)
- **Warm system**: Graduated 3-tier (Direction B) — hero, semi-warm, neutral
- **Dock icons**: State-aware neutral (Direction C) — tinted base, raised active, no warm

## Priority Order

1. Piece icons (hero selector) — migration + treatment
2. Dock icons — state-aware neutral treatment
3. Badge images — graduated warm by state
4. Arena pieces — depth unification (outside carved/relic system)
5. Decorative frames — structural neutral + showcase exception

---

## Token Architecture

Two layers: **materiality** (surface texture) and **state** (warm accent level). Tokens are never mixed — a materiality token never contains warm color, a state token never contains carved depth.

### Materiality Tokens

| Token | Value | Purpose |
|---|---|---|
| `--treat-carved-hi` | `inset 0 1px 2px rgba(255,255,255,0.05)` | Top highlight — carved depth |
| `--treat-carved-lo` | `inset 0 -1px 2px rgba(0,0,0,0.25)` | Bottom shadow — carved depth |
| `--treat-depth-outer` | `0 2px 4px rgba(0,0,0,0.22)` | Lift off background (validate on device; raise to 0.26 if insufficient on textured backgrounds) |
| `--treat-neutral-tint` | `brightness(0.75) saturate(0.7)` | Desaturated cool base filter |
| `--treat-neutral-tint-active` | `brightness(1.0) saturate(0.85)` | Raised neutral for active chrome |

### State Tokens (Graduated Warm)

| Token | Value | Tier |
|---|---|---|
| `--treat-warm-glow` | `0 0 10px rgba(200,170,100,0.15)` | Hero |
| `--treat-warm-border` | `rgba(180,160,110,0.30)` | Hero |
| `--treat-warm-tint` | `sepia(0.25) saturate(1.3) brightness(1.1)` | Hero (upper bound — categories may reduce sepia/saturate if silhouette clarity requires it, without creating new tokens) |
| `--treat-semi-glow` | `0 0 6px rgba(200,170,100,0.08)` | Semi-warm |
| `--treat-semi-border` | `rgba(180,160,110,0.15)` | Semi-warm |
| `--treat-semi-tint` | `sepia(0.15) saturate(1.1) brightness(1.0)` | Semi-warm |

**Total: 11 tokens.** This is the ceiling — no new tokens without explicit justification.

### Composition Rule

Category classes compose tokens. No component uses tokens directly.

```css
/* Example: hero-tier class */
.piece-hero {
  filter: var(--treat-warm-tint);
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow);
  border: 1px solid var(--treat-warm-border);
}
```

---

## Category Classes

Pattern: `{category}-{state}`. Each class consumes tokens and adds category-specific adjustments.

### 1. Piece Icons (hero selector)

Requires migration from emoji to `/art/pieces/w-{piece}.webp` images.

| Class | Filter | Box-shadow | Border | Notes |
|---|---|---|---|---|
| `.piece-hero` | `var(--treat-warm-tint)` | `var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow)` | `1px solid var(--treat-warm-border)` | Active tab — selected piece |
| `.piece-inactive` | `var(--treat-neutral-tint)` | `var(--treat-carved-hi), var(--treat-carved-lo)` | none | Inactive tabs — recognizable, tappable |
| `.piece-pressed` | `brightness(0.90) saturate(0.85)` | `var(--treat-carved-lo)` | none | Tactile feedback — sunken (carved-hi removed) |

**Guardrail**: If `.piece-inactive` loses silhouette clarity on device, raise `brightness` up to `0.80` without adding warm or border. Floor of legibility, not ghosts.

### 2. Dock Icons (persistent navigation)

| Class | Filter | Box-shadow | Notes |
|---|---|---|---|
| `.dock-base` | `var(--treat-neutral-tint)` | `var(--treat-carved-lo)` | Default — cool, integrated |
| `.dock-active` | `var(--treat-neutral-tint-active)` | `var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-depth-outer)` | Current screen — brighter, not more decorated |
| `.dock-pressed` | `brightness(0.65) saturate(0.6)` | `var(--treat-carved-lo)` | Tactile feedback |

**Hard rule**: Dock icons never receive warm accent, not even on hover or active. Chrome stays neutral.

### 3. Badge Images

| Class | Filter | Box-shadow | Border | Notes |
|---|---|---|---|---|
| `.badge-owned` | `var(--treat-warm-tint)` | `var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow)` | `1px solid var(--treat-warm-border)` | Hero tier — earned badge |
| `.badge-claimable` | `var(--treat-semi-tint)` | `var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-semi-glow)` | `1px solid var(--treat-semi-border)` | Semi-warm — reward-adjacent |
| `.badge-locked` | `grayscale(0.85) brightness(0.55)` | `var(--treat-carved-lo)` | none | Muted — locked but not dead |

### 4. Arena Pieces

| Class | Filter | Box-shadow | Notes |
|---|---|---|---|
| `.arena-piece-white` | `sepia(0.3) saturate(1.5) brightness(1.1)` | `drop-shadow(0 2px 4px rgba(0,0,0,0.5))` | Gold tint — existing values preserved |
| `.arena-piece-black` | `hue-rotate(260deg) saturate(0.8) brightness(0.7)` | `drop-shadow(0 2px 4px rgba(0,0,0,0.5))` | Purple tint — existing values preserved |
| `.arena-piece-selected` | inherits color filter + `brightness(1.2)` | `drop-shadow(0 0 8px rgba(217,180,74,0.4))` | Selection glow — gold highlight |

**Explicit exclusion**: Arena pieces are outside the carved/relic system. They keep their own color filters for board legibility and gameplay clarity. The shared tokens do not apply here.

### 5. Decorative Frames

| Class | Filter | Box-shadow | Border | Notes |
|---|---|---|---|---|
| `.frame-structural` | `var(--treat-neutral-tint)` | `var(--treat-carved-hi), var(--treat-carved-lo)` | none | Container frame — does not stand out |
| `.frame-showcase` | none | `var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-depth-outer)` | `1px solid var(--treat-semi-border)` | Featured/showcase slots ONLY |

**Restriction**: `.frame-showcase` is only for featured/showcase slots. Prohibited in HUD, navigation, standard lists.

---

## Graduated Warm Containment Map

| Tier | Where it applies | Where it does NOT apply |
|---|---|---|
| **Hero Warm** | `piece-hero`, `badge-owned`, featured store card, trophy rank 1-3 (accent only — metadata stays neutral-readable), section labels (at lower intensity than hero objects), progress chip (as small badge object — must not eclipse hero selector active tab) | — |
| **Semi-Warm** | `badge-claimable`, `frame-showcase`, reward-adjacent overlays, selected-secondary states | Navigation, metadata, HUD, dock, standard lists, arena board |
| **Neutral** | `piece-inactive`, `piece-pressed`, `dock-base`, `dock-active`, `dock-pressed`, `badge-locked`, `arena-piece-*`, `frame-structural`, top actions, footer, metadata, all chrome | — |

**Default rule**: If a component is not listed in Hero or Semi-Warm, it is neutral. No implicit warm. Semi-warm is opt-in and requires justification (reward-adjacent, claimable, featured).

### Warm Containment Guardrails

- **Progress chip**: May use Hero Warm as small badge object, but must never visually eclipse the hero selector active tab.
- **Section labels**: Use warm at lower intensity than hero objects and featured cards. They are structure, not mini-hero headers.
- **Trophy rank 1-3**: Hero Warm applies as accent on icon/border only. Trophy metadata (date, moves, time) stays neutral-readable.
- **Semi-warm restriction**: Only for reward-adjacent, claimable, and selected-secondary states. Never on navigation chrome, metadata, or persistent HUD.

---

## Anti-Regression Rules

1. No category creates warm values outside `--treat-warm-*` and `--treat-semi-*` tokens
2. Dock icons never receive warm, even on hover/active
3. Arena pieces stay outside carved/relic — own filters for gameplay clarity
4. `frame-showcase` only in featured/showcase slots
5. New components requiring warm must be explicitly added to the containment map — no inheritance
6. `--treat-warm-tint` is the upper bound — categories may reduce but never exceed
7. Total token count stays at 11 unless a new shared primitive is genuinely needed

---

## Hero Selector Migration Plan

| Step | Change |
|---|---|
| 1 | Create `PIECE_IMAGES: Record<PieceType, string>` in `editorial.ts` mapping to `/art/pieces/w-{piece}.webp` |
| 2 | Replace emoji render in hero-rail-tab with `<Image>` using `PIECE_IMAGES[piece]` |
| 3 | Apply `.piece-hero` / `.piece-inactive` / `.piece-pressed` based on state |
| 4 | Remove `PIECE_ICONS` emoji map (dead code cleanup) |
| 5 | Validate silhouette on device — adjust `.piece-inactive` brightness if needed |

**Fallback**: If a piece image fails to load, render a neutral placeholder (piece initial letter on muted background). Never leave tabs empty or broken.

---

## SVG Replacement Roadmap (future — out of scope)

Documented as a design constraint, not an implementation task.

When PNGs are replaced with custom SVGs:
- **Tokens stay**: carved, warm, neutral tokens are format-agnostic
- **Category classes adjust**: reduce `filter` intensity (SVGs have their own color), add `fill`/`stroke` properties
- **Containment map stays**: same warm rules regardless of asset format
- **No blocking decisions**: nothing in this spec prevents SVG migration

---

## Implementation Notes

- All tokens go in `globals.css` under `:root`
- All category classes go in `globals.css` grouped by category
- Existing inline treatments in components get replaced by class application
- The hero selector migration (emoji → image) is a component change in `mission-panel.tsx` and `editorial.ts`
- Device validation is required for: `--treat-depth-outer` strength, `.piece-inactive` silhouette, `.dock-base` vs `.dock-active` contrast delta
