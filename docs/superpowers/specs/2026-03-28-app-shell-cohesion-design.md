# App Shell Cohesion — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Approach:** Shell Architecture Refactor (phased)

## Objective

Define the macro visual and structural system that unifies the main Chesscito play shell — header, board, mission card, stats, CTA, bottom nav, and the vertical rhythm between them — so they read as one coherent game product surface.

---

## 1. Core Shell Problem

The shell currently has **4 structural fractures**:

1. **3 uncoordinated surface dialects** — board uses `border-white/[0.04]` + inset shadow, footer uses `surface-c-heavy` + `border-top` cyan, mission card uses gradient + carved shadow. Each region invented its own visual language independently.

2. **No spacing system** — header has `px-4`, board `px-1 mt-1`, mission card `mx-2 mt-1`, footer has its own padding. Margins are ad-hoc per component with no shared tokens.

3. **Fragmented lower module** — mission card, stats row, CTA, and dock are 4 stacked elements with independent treatments. There is no composition grouping gameplay-related UI vs. navigation-related UI.

4. **Header without belonging** — Zone A is transparent, borderless, surfaceless. It floats over the background as overlay UI, not as part of the game product.

**Result:** the shell reads as layered overlapping UI, not as a unified game surface.

---

## 2. Macro Layout Principle

**"Nucleus-orbit"** — the board is the center of gravity of the shell. Everything else orbits it with proximity and weight proportional to its functional relationship with active gameplay.

**4 regions, 4 weight classes:**

| Region | Function | Weight | Position |
|--------|----------|--------|----------|
| Header rail | Piece selection, context | Subtle (lightest) | Top orbit |
| Board | Core play surface | Dominant (heaviest) | Nucleus |
| GameplayPanel | Mission + stats + action | Secondary | Bottom orbit (close) |
| Dock | Persistent navigation | Light | Bottom edge (distant) |

**Governing rule:** visual distance (gap size, surface opacity, material presence) grows with functional distance from active gameplay.

**Structural rule:** the dock remains structurally separate from the GameplayPanel. It belongs to the same shell family but serves a different function (navigation vs. gameplay meta-action).

---

## 3. Region-by-Region Cohesion Rules

### Shared token family

Minimal tokens, hierarchy by weight — family resemblance, not sameness.

```css
--shell-radius:   /* 12px or 16px — audit during Phase 1 */
--shell-border:   rgba(255, 255, 255, 0.06);
--shell-divider:  rgba(255, 255, 255, 0.04);
--shell-gap-xs:   4px;   /* near-board orbit */
--shell-gap-sm:   8px;   /* peripheral orbit */
```

### Header rail (weight: subtle)

- No background surface — stays transparent
- Bottom anchor: flexible treatment — `border-bottom: 1px solid var(--shell-border)`, gradient fade (`from-transparent via-white/[0.06] to-transparent`), or combination. Final treatment chosen by what reads best in MiniPay WebView during implementation.
- Horizontal margins align with board column (`mx-2`)
- No box-shadow, no carved treatment
- Piece selector items may use `var(--shell-border)` for individual frames to echo the family
- Reads as "first rail of the shell system," not an independent block

### Board (weight: dominant)

- Keeps contained identity: `border-radius: var(--shell-radius)`, `border: 1px solid var(--shell-border)`
- Retains inset shadow (carved-hi + carved-lo) — this is what makes it the heaviest surface
- Horizontal margin: `mx-2` (aligned with all other regions)
- Only region that gets depth treatment (inset shadow + subtle teal tint)
- Canvas keeps `width: min(100%, 23.5rem)` centered — board is narrower than siblings, reinforcing its contained nucleus identity

### GameplayPanel (weight: secondary)

- New single container: `border-radius: var(--shell-radius)`, `border: 1px solid var(--shell-border)`
- Background: `var(--surface-c-light)` (~0.55 opacity) — lighter than current footer's `surface-c-heavy`
- No inset shadow — lighter than board, weight hierarchy preserved
- Internal divisions use `border-bottom: 1px solid var(--shell-divider)` between mission/stats/action
- Horizontal margin: `mx-2`

### Dock (weight: light)

- Structurally separate from GameplayPanel — always a sibling, never a child
- Same `var(--shell-border)` for `border-top` — same token family
- Container is edge-to-edge (no `mx-2`), but internal dock content aligns with the `mx-2` content column via padding
- Background: lighter than GameplayPanel — transparent or `surface-c-light` at reduced opacity
- `var(--shell-radius)` applies to individual dock items, not to the dock container itself

---

## 4. Lower-Panel Composition Model

The current footer (Zone C) is a flat 3-layer stack: stats trigger + CTA + dock. The mission card lives outside it, between board and footer. This creates the fragmented reading.

### New model — GameplayPanel + Dock separation

```
┌─────────────────────────────┐
│  GameplayPanel              │  ← single container, radius, border
│  ┌───────────────────────┐  │
│  │ Mission slot           │  │  ← mission objective (moved from Zone B)
│  ├───────────────────────┤  │  ← internal divider (--shell-divider)
│  │ Stats slot             │  │  ← compact horizontal meta row
│  ├───────────────────────┤  │  ← internal divider
│  │ Action slot            │  │  ← single primary CTA
│  └───────────────────────┘  │
└─────────────────────────────┘
         --shell-gap-sm (8px)
┌─────────────────────────────┐
│  Dock                       │  ← separate nav, border-top, lighter
└─────────────────────────────┘
```

### Composition rules

- `<GameplayPanel>` is a new component with 3 named slots: `mission`, `stats`, `action`
- Each slot renders its content; the panel owns the container surface and internal dividers
- Empty slots collapse — no empty rows rendered
- **Stats slot:** compact horizontal meta row (progress chip + score + time). Designed to expand gracefully if future stats (timer, move counter) are added — row wraps or gains a second line, never overflows.
- **Action slot:** renders exactly one primary CTA. `getContextAction()` resolves priority upstream. No equal-weight CTA competition inside the slot. A subtle secondary support element (e.g., shield count badge) is acceptable alongside the primary action but must not compete for visual dominance.
- Mission card DOM moves from between board and footer into the mission slot
- The gradient divider between mission card and old footer is removed — replaced by panel's internal dividers
- Dock remains a sibling of GameplayPanel, not a child

### Placement rule (system-level)

- Gameplay-affecting UI belongs inside GameplayPanel
- Persistent navigation belongs in Dock
- Do not create new in-between containers

---

## 5. Header / Nav Integration Rules

Header rail and dock are the two shell extremes — top and bottom. They frame the nucleus-orbit system. They must read as belonging to the same world without competing with the board or GameplayPanel.

### Header rail

- Anchoring: flexible — may be solved as `border-bottom`, gradient rail, or combination. Decided during implementation based on MiniPay WebView rendering.
- Horizontal alignment: content area aligns with board column (same `mx-2` gutter)
- Vertical gap to board: `var(--shell-gap-xs)`
- No background, no box-shadow — lightest region
- Piece selector item frames may echo `var(--shell-border)` for family consistency

### Dock

- Structurally separate from GameplayPanel — always a sibling, never a child
- `border-top: 1px solid var(--shell-border)` — same border token as the rest of the shell
- Container is edge-to-edge (no `mx-2`), but internal dock item rhythm aligns with the `mx-2` content column through internal padding
- Background: lighter than GameplayPanel
- Dock items consume `var(--shell-border)` from the token — no hardcoded duplicate values

### Shared integration rules

- Header and dock never use inset shadows (reserved for board = dominant weight)
- Both use `var(--shell-border)` for any visible borders
- Neither introduces a new surface color outside the `--surface-*` scale
- New shell-level controls go in header rail or dock by function — not in a new container between them

---

## 6. Spacing and Containment Rules

### Token system

| Token | Value | Usage |
|-------|-------|-------|
| `--shell-gap-xs` | `4px` | Board orbit: header→board, board→GameplayPanel |
| `--shell-gap-sm` | `8px` | Peripheral: GameplayPanel→dock |
| `--shell-radius` | `12px` or `16px` (audit in Phase 1) | All shell containers: board, GameplayPanel |
| `--shell-border` | `rgba(255, 255, 255, 0.06)` | All region borders, dividers |
| `--shell-divider` | `rgba(255, 255, 255, 0.04)` | Internal dividers within GameplayPanel |

### Horizontal containment

- All regions except dock: `mx-2` (8px gutters)
- Dock: edge-to-edge container, internal padding produces visual alignment with `mx-2` column
- Board canvas: `width: min(100%, 23.5rem)` centered within the `mx-2` column
- No region uses `px-4` or `px-1` for shell-level margins — those values are internal to components only

### Vertical containment

- Shell is a flex column: `flex flex-col h-[100dvh]`
- Board zone: `flex-1 min-h-0` (fills available space)
- Header rail and dock: `shrink-0`
- GameplayPanel: `shrink-0` — defined height based on content, never competes with board for space
- Gaps between regions use margin tokens, never padding on the parent

### Containment constraint

- All 4 regions (header, board, GameplayPanel, dock) are direct children of the shell flex column
- No intermediate wrapper divs between regions for spacing
- Spacing is handled by tokens on the regions themselves

---

## 7. P0 Implementation Recommendation

Phased rollout — 6 commits, file-by-file, MiniPay-safe, independently deployable.

### Phase 1 — Shell token system
**Files:** `globals.css`
- Add `--shell-gap-xs`, `--shell-gap-sm`, `--shell-radius`, `--shell-border`, `--shell-divider` to `:root`
- Audit current radii (`rounded-xl` = 12px, `rounded-2xl` = 16px, CTA buttons, board) to decide `--shell-radius`
- No intentional visual change yet — tokens defined but not consumed

### Phase 2 — GameplayPanel component
**Files:** new `components/play-hub/gameplay-panel.tsx`
- 3 named slots: `mission`, `stats`, `action`
- Container consumes `--shell-radius`, `--shell-border`, `--surface-c-light`
- Internal dividers use `--shell-divider`
- Stats slot: compact horizontal meta row, designed to expand gracefully
- Action slot: one primary CTA, no equal-weight competition
- Empty slots collapse

### Phase 3 — Move mission card into GameplayPanel
**Files:** `mission-panel.tsx`
- Mission card DOM moves from between board and footer into GameplayPanel's mission slot
- Remove gradient divider between mission card and old footer
- Mission card loses standalone container styling — GameplayPanel provides containment
- Regression check: mission text and wolf icon render correctly

### Phase 4 — Consolidate stats + CTA into GameplayPanel
**Files:** `mission-panel.tsx`
- Stats row (exercise drawer trigger + score + time) moves into stats slot
- ContextualActionSlot moves into action slot
- Old Zone C footer wrapper becomes: GameplayPanel + Dock
- Remove `chesscito-footer` background/border from wrapper — each child owns its surface
- Regression check: all CTA states still function (submit, retry, shield, badge, wallet, network)

### Phase 5 — Anchor the header rail
**Files:** `mission-panel.tsx`, `globals.css`
- Add bottom anchor (border or gradient — pick what reads best in MiniPay)
- Align horizontal margins to `mx-2` (from `px-4`)
- Set gap to board: `var(--shell-gap-xs)`
- Piece selector frames echo `var(--shell-border)` if not already aligned

### Phase 6 — Unify spacing + dock alignment
**Files:** `mission-panel.tsx`, `persistent-dock.tsx`, `globals.css`
- Replace all ad-hoc inter-region margins with token gaps
- Board wrapper: `mx-2` (from `px-1`)
- GameplayPanel→dock gap: `var(--shell-gap-sm)`
- Dock: container stays edge-to-edge, internal content rhythm aligns with `mx-2` column through padding
- Dock surface: lighter than GameplayPanel, `border-top` uses `var(--shell-border)`
- Final pass: remove any hardcoded values that duplicate token definitions

**Each phase is one commit, independently deployable, visually verifiable in MiniPay.**

---

## 8. Anti-Patterns to Avoid

1. **No color pass disguised as cohesion.** This spec solves structure, containment, and spacing. Changing colors or gradients without fixing composition is not cohesion.

2. **No monolithic lower card.** GameplayPanel and Dock are separate containers. Do not merge them into one continuous surface. Different function = different container.

3. **No intermediate wrapper divs.** All 4 regions are direct children of the shell flex column. No `<div className="lower-section">` wrapping GameplayPanel + Dock together.

4. **No matched surfaces.** Regions share a token family, not identical treatments. Board is heavier than GameplayPanel, GameplayPanel is heavier than Dock. If they all look the same, the weight hierarchy has failed.

5. **No icon/piece polish in this pass.** Do not drift into swapping icons, adjusting piece art, adding FX, or visual micro-detail. That belongs to Visual Polish Layer (P2).

6. **No Background Pack work.** This spec prepares clean layer boundaries for Background Pack. It does not implement background switching, contextual backgrounds, or background-related logic.

7. **No equal-weight CTA competition.** The action slot renders one primary action. A subtle secondary support element is acceptable alongside it but must not compete for visual dominance. `getContextAction()` resolves priority upstream.

8. **No new in-between containers (future expansion rule).** When future UI needs a home: gameplay-affecting UI goes inside GameplayPanel, persistent navigation goes in Dock. Do not create a third container between them.

9. **No hardcoded token duplicates.** Once a token exists (`--shell-border`, `--shell-gap-xs`), every region must consume the token. No `rgba(255,255,255,0.06)` alongside `var(--shell-border)`.
