# Phase E — Visual Authority / Hero Composition Pass

## Status: SPEC APPROVED

## Objective

Transform the Play Hub from a polished, coherent app into a visually authoritative game product with hero-level composition. The board becomes the sacred center; every other element serves it.

This phase is not about adding features. It is about making the existing product compositionally and visually powerful.

## Why Phase E

Phases A-D improved atmosphere, material depth, secondary screen cohesion, and reward moments. But the Play Hub still lacks:

- Hero composition with a clear focal point
- Scene authority and "wow" factor in the main board experience
- Stronger focal hierarchy between zones
- Iconic module treatment for rail, dock, and panel
- The feeling of entering a sacred board with a mission

## Target Feel

When the user opens Play Hub, the first emotional read should be:
**"I entered a sacred board where I have a mission."**

## Global Hierarchy

```
Board (sacred center, focal vignette)
  >>> Gameplay Panel (command support)
    > Piece Rail (champion roster)
      > Center Dock Action (escape to Arena)
        > Dock Side Items (persistent navigation)
```

## Execution Strategy: Outside-In

1. Board focal vignette + atmosphere intensification (scene authority first)
2. Dock architectural base + center action (composition anchoring)
3. Piece rail roster treatment (champion select)
4. Gameplay Panel internal hierarchy (command clarity)

Rationale: The focal vignette is the highest-impact change and establishes the contrast field for the entire screen. Modules are calibrated after the scene is set, avoiding recalibration.

---

## Section 1: Board Focal Vignette + Atmosphere Intensification

### Objective

The board gains authority because the surrounding world recedes, not because the board is decorated.

### Mechanism

**Board-focus overlay** — a dedicated overlay element attached to the board-stage host or a dedicated wrapper (NOT a third pseudo-element on `.atmosphere`):

- `radial-gradient(ellipse 70% 55% at 50% 42%, transparent 40%, rgba(0,0,0,0.30) 75%, rgba(0,0,0,0.50) 100%)`
- The 42% vertical center accounts for the board sitting slightly above the vertical midpoint of the composition (rail above is shorter than panel+dock below)
- Creates a natural spotlight: the board stays illuminated, the top and bottom extremes darken

**Atmosphere adjustments** (existing `.atmosphere` pseudo-elements):

- `::before` (vignette): intensify edge from `rgba(0,0,0,0.35)` to `rgba(0,0,0,0.45)`
- `::after` (bottom falloff): intensify from `rgba(6,14,28,0.25)` to `rgba(6,14,28,0.35)`
- These are incremental alpha adjustments to the existing Phase A system

**Result:**

- The board "glows" through contrast, not through decoration
- The rail above and dock below darken slightly at the extremes
- The panel remains legible (it sits in the transition zone, not the dark edge)
- `prefers-reduced-motion`: no impact (static gradients, not animations)

### Scene Unity Rule

The focal vignette must increase board dominance without making the rail, panel, or dock feel visually detached from the same scene. All elements must still feel like one unified world.

### Constraints

- Do not touch the board asset or its cells
- Do not add box-shadow or border to the board container
- Do not crush legibility of the panel or dock (alpha max ~0.50 at extremes)
- Maintain coherence with Phase A atmosphere (extension, not replacement)

### Escalation Path

If board authority is still insufficient after real-device review, test a subtle perimeter rim (`box-shadow: inset 0 0 20px rgba(0,0,0,0.15)` on the board canvas). Rules:

- Only test after real-device review
- Never combine a strong focal vignette and a strong perimeter treatment at the same time
- Prefer one elegant mechanism over two competing ones

---

## Section 2: Dock Architectural Base + Center Action

### Objective

The dock becomes the stable floor of the composition. The center action gains clear presence without becoming a hero.

### Dock Base — Passive to Architectural

**Current state:**

- Background: `rgba(255,255,255,0.08)` (nearly transparent)
- Border-top: `rgba(255,255,255,0.06)` (invisible)
- Icons: `opacity: 0.55` (dim)

**Changes to `.chesscito-dock` container:**

- Background: `var(--surface-b-plus)` → `rgba(6,14,28,0.90)` — more opaque, feels like a floor
- Border-top: `rgba(255,255,255,0.10)` — visible as the horizon line between scene and navigation

**Changes to side items (`.chesscito-dock-item > button`):**

- Opacity: `0.55` → `0.65` — legible but subordinate
- Background: maintain `rgba(255,255,255,0.08)` — do not escalate

### Dock Anchor Rule

The dock should feel like a stable floor, not a floating tray. No blur, no elevation, no carved shadows.

**`backdrop-blur`** is NOT part of the default dock treatment. It is only tested if real-device review shows the dock still feels too flat. It is an escalation option, not a default.

### Center Action — Clear Escape Point

**Changes to `.chesscito-dock-center`:**

Active state (`.is-active`):

- Scale: `scale(1.04)` to `scale(1.06)` — starting conservative, calibrate during visual review
- Background: `rgba(20,184,166,0.15)` (up from 0.12)
- Border: `rgba(20,184,166,0.25)` (up from 0.20)
- Glow: `0 0 16px rgba(20,184,166,0.14)` (up from 12px/0.10)
- No pulse, no animation loop — static presence

Inactive state (`.chesscito-dock-center:not(.is-active)`):

- Maintains subtle scale advantage over side items but visually quieter than active
- Reduced glow and teal wash to minimums
- Feels "dormant but important" — structurally present, not commanding
- Must be clearly distinguishable from active state

### Hierarchy

```
Board >>> Gameplay Panel > Center dock action (active) > Center dock action (inactive) > Side dock items
```

### Constraints

- Dock must never be visually heavier than the Gameplay Panel
- No carved shadows or panel-elevated treatment on the dock
- Center action uses teal (not warm/amber) — preserves Arena identity
- Side items do not scale — only the center does
- No warm tint on side icons

### Scene Unity Check

With the focal vignette from Section 1, the lower screen zone darkens ~0.35 alpha. The dock with 0.90 background emerges over that darkness as a defined floor. Transition: scene darkness → dock floor → safe-area.

---

## Section 3: Piece Rail Roster Treatment

### Objective

The piece rail transforms from a functional selector bar into a premium champion roster. The active piece is your selected champion; inactive pieces are your collection; locked pieces are dormant relics.

### Active Piece — Champion Showcase

**Current state:**

- Gradient background with golden border `rgba(180,160,110,0.35)`
- Warm glow: `0 0 12px rgba(200,170,100,0.12)`
- Piece image: `--treat-warm-tint`
- No scale difference from inactive pieces

**Changes:**

- Scale: `scale(1.05)` on the active tab — subtle elevation separating champion from roster
- Glow: `0 0 14px rgba(200,170,100,0.18)` (up from 12px/0.12) — more visible pedestal
- Border: `rgba(180,160,110,0.45)` (up from 0.35) — golden border more legible
- Piece image shadow: `drop-shadow(0 2px 6px rgba(0,0,0,0.5))` — piece "floats" above its pedestal
- Transition: `transform 250ms ease-out, box-shadow 250ms ease-out` — champion switch feels like a "step forward"

### Inactive Unlocked — Roster Members

**Current state:**

- `--treat-neutral-tint`: `brightness(0.75) saturate(0.7)`
- Minimal background, no visible border

**Changes:**

- Background: `rgba(255,255,255,0.04)` — barely perceptible, creates "occupied slot" feeling
- Border: `rgba(255,255,255,0.06)` (1px) — slot visible, not prominent
- Piece tint: maintain `--treat-neutral-tint` — correctly quiet
- Feel: "they are in your collection, resting"

### Locked Pieces — Silhouette Relics

**Current state:**

- Same treatment as inactive unlocked + disabled interaction
- No visual distinction between "unlocked but not selected" and "locked"

**Changes:**

- Piece image filter: `brightness(0.35) saturate(0) contrast(0.8)` — near-monochrome silhouette, much darker than unlocked
- Lock overlay: pseudo-element with centered lock SVG icon, `opacity: 0.4`, ~16px — subtle but legible
- Background: `rgba(0,0,0,0.15)` — slot feels "sealed"
- Border: none visible — does not compete for attention
- No tooltip or label — silhouette + lock communicates the state without text
- Feel: "dormant relic, not yet recruited"

### Rail Hierarchy

```
Active champion (scale + gold glow + warm tint)
  >>> Unlocked roster (slot visible, neutral tint)
    >> Locked relic (silhouette + lock, recessed)
```

### Constraints

- The full rail must never be more dominant than the board — it is a support layer
- Active piece scale (1.05) must not cause overflow in the rail container
- No loop animations (pulse, breathe) in any state — transitions on change only
- Lock icon is a subtle indicator, not a large badge or opaque overlay
- Touch targets >= 44px in all states

### Scene Unity Check

Under the focal vignette, the rail sits in the upper zone that darkens slightly. The active champion's warm glow contrasts naturally with that darkening — gains presence. Locked/inactive pieces recede further under the darkening — correct, they are background roster. The rail feels like "the champion bench looking toward the sacred board."

---

## Section 4: Gameplay Panel Internal Hierarchy

### Objective

The panel gains command authority through internal clarity, not outer weight. Typography, separation, and contrast level up.

### Mission Block — From Whisper to Order

**Current state:**

- Label: `text-[9px]` bold uppercase tracking-wide, `cyan-400/70` — too small and washed
- Target (mission): `text-sm` (14px) bold, `slate-100` — legible but not dominant
- Hint: `text-[11px]`, `cyan-100/40` — nearly invisible

**Changes:**

- Label: `text-[10px]`, maintain uppercase tracking, raise to `cyan-400/85` — more present without shouting
- Target (mission): `text-[15px]` bold, use the brightest body-readable value in the panel system — feels like the primary order
- Hint: maintain `text-[11px]`, raise to `cyan-100/55` (from /40) — legible as support, not invisible
- Spacing: `gap-0.5` to `gap-1` between label → target → hint — choose final value during visual review based on actual panel density

### Internal Hierarchy Types

- **Mission target** = primary informational focal point inside the panel
- **CTA button** = primary action focal point
- **Stats values** = secondary informational layer
- **Label / hint** = support layer

Information prominence and action prominence are parallel tracks, not a single ranked list.

### Scanning Rule

The mission block must be scannable in one glance: label (categorize), order (mission target), support (hint). If the hierarchy upgrade does not improve command readability at scan speed, it has failed.

### Internal Separators

**Current:** `border-t border-white/[0.04]` — practically invisible

**Change:** Raise to `border-white/[0.07]` — visible as separation lines without being prominent

### Stats Row — Instrument Readability

- Star/timer values: raise to `white/85` (from /75) — instrument data must read effortlessly
- Star/timer labels: maintain subordinate at ~`white/50`
- Drawer trigger: no change — already correct as secondary interactive element

### CTA Relationship

- Spacing: ensure consistent `gap` (~8px) between stats zone and CTA — neither cramped nor lost
- CTA button styling: no changes — gradient, glow, and 52px height are already correct for Phase E

### What Does NOT Change

- Container exterior: `panel-elevated` stays exactly as-is (gradient, borders, carved shadows)
- CTA button visual treatment
- Animations (typewriter)
- Wolf icon

### Constraints

- Do not scale typography beyond what is proposed — the panel is compact and vertical space is limited
- Do not add backgrounds or gradients to internal zones — hierarchy through type + opacity only
- Do not add glow or showcase treatment to the container — one showcase per viewport rule
- Panel must remain legible under the focal vignette (panel sits in the transition zone, not the dark edge)

### Scene Unity Check

Under the focal vignette, the panel sits in the lower transition zone — receives mild darkening (~0.15-0.20 alpha). The reinforced typography (brightest body-readable value, white/85) compensates for that darkening — the panel reads better, not worse. The panel feels like "the command center at the foot of the sacred board."

---

## Global Rules

### One Showcase Per Viewport

Only one surface in the Play Hub viewport may use showcase-level treatment. The board (via focal vignette) is that surface. No other element gets glow backdrops, showcase panels, or ambient radiance in the Play Hub main view.

### Reduced Motion

All changes in this spec are static treatments (gradients, opacities, scales). No new animations are introduced. Transitions on piece-rail champion switch respect `prefers-reduced-motion` by falling back to instant state change.

### Mobile-First / 390px

All treatments are designed for and tested at 390px width. Desktop is not a priority.

### Token Coherence

All new values must integrate with the existing design token system (`--surface-*`, `--shell-*`, `--treat-*`). No ad-hoc hardcoded values outside the token system.

### Escalation Paths

| Area | Default | Escalation (only after device review) |
|------|---------|---------------------------------------|
| Board framing | Focal vignette only | Subtle perimeter rim (never combined with strong vignette) |
| Dock base | Opacity + border only | `backdrop-blur-sm` (if dock still feels flat) |
| Center action scale | `scale(1.04)` start | Up to `scale(1.06)` if geometrically insufficient |

---

## Success Criteria

1. The board reads as the sacred center within 1 second of opening Play Hub
2. The dock feels like a stable floor, not a floating tray
3. The piece rail feels like a champion roster with clear active/locked/unlocked states
4. The gameplay panel reads as a command surface at scan speed
5. All elements feel like one unified scene, not isolated modules
6. The overall Play Hub feels like a premium game product, not a polished app
