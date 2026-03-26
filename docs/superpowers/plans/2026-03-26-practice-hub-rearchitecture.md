# Practice Hub Screen Re-Architecture — Implementation Spec

**Status**: Approved v2 — Ready for execution
**Date**: 2026-03-26
**Scope**: CSS, layout, constants, wiring — zero assets, zero navigation reorder

---

## 1. IMPLEMENTATION SUMMARY

1. Dock center label changes from "Arena" to "Practice"; `href` changes from `/arena` to `/`
2. Active routing wired via `usePathname()` + existing `.dock-treat-active` class
3. Utility band (Zone A2) eliminated entirely from `mission-panel.tsx`
4. "Lv {n}" badge integrated into hero-rail right side
5. HelpCircle button (→ `/about`) integrated into hero-rail right side
6. Stars pill (ExerciseDrawer trigger) relocated to stats bar as interactive chip
7. `.piece-hero` simplified: `border` + `border-radius` removed, warm glow reduced
8. Stats bar opacity raised from `white/40` → `white/60`, background from `black/13` → `black/20`
9. Dock item opacity raised from `0.45` → `0.55`
10. Board spacing tightened: `mt-2` → `mt-1`, mission label `h-12` → `h-auto py-1`

---

## 2. FILE/BLOCK LEVEL CHANGE PLAN

### 2.1 `apps/web/src/lib/content/editorial.ts`

**What changes**:
- Add new constant: `DOCK_LABELS = { practice: "Practice" } as const`
- Do NOT mutate `ARENA_COPY.title` — it's used in `/arena` page

**Why**: Dock center needs its own label independent of Arena copy.

**Priority**: P0
**Regression risk**: None — additive change, no existing references affected.

---

### 2.2 `apps/web/src/components/play-hub/persistent-dock.tsx`

**What changes**:
- Import `usePathname` from `next/navigation` (add `"use client"` directive)
- Import `DOCK_LABELS` instead of `ARENA_COPY`
- Change `href="/arena"` → `href="/"`
- Change label from `{ARENA_COPY.title}` → `{DOCK_LABELS.practice}`
- Add active state logic:
  ```tsx
  const pathname = usePathname();
  const isCenterActive = pathname === "/";
  ```
- Apply `is-active` class to dock-center when `isCenterActive`:
  - Active: current teal glow style (already exists in `.chesscito-dock-center`)
  - Inactive: reduce to match lateral item treatment (when on `/arena`)
- Wire `.dock-treat-active` on dock icon `<img>` elements using pathname matching

**Why**: Semantic routing — user must know where they are.

**Priority**: P0
**Regression risk**: Low — `"use client"` addition is the only structural change. Verify dock renders in `/arena` route too.

---

### 2.3 `apps/web/src/components/play-hub/mission-panel.tsx`

**What changes**:

**A. Remove Zone A2 (utility band) — lines 193-209**:
Delete the entire `<div>` block containing Lv label, exerciseDrawer, and moreAction.

**B. Integrate Lv badge into hero-rail zone**:
After the hero-rail `<div>`, inside the same `px-4` container, add Lv badge:
```tsx
<div className="flex items-center justify-between">
  <div className="hero-rail">
    {/* ... existing piece tabs ... */}
  </div>
  <div className="flex flex-col items-center gap-1">
    <span className="text-[11px] font-bold text-purple-400/60">Lv {level}</span>
    {moreAction}
  </div>
</div>
```
The hero-rail and the Lv+help cluster sit side by side, not stacked.

**C. Integrate stars pill into stats bar (Zone C Layer 1)**:
Move `{exerciseDrawer}` into the micro-stats bar, as the first element (left side), separated from passive data:
```tsx
<div className="mx-2 flex items-center gap-3 rounded-[10px] py-1.5 px-3"
     style={{ background: "rgba(0,0,0,0.20)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
  {/* Interactive chip — visually distinct */}
  <div className="shrink-0">{exerciseDrawer}</div>
  {/* Separator */}
  <span className="h-3 w-px bg-white/10" />
  {/* Passive stats */}
  <div className="flex flex-1 items-center justify-center gap-4">
    <span className="flex items-center gap-1 text-[10px] font-semibold text-white/60">
      <Star size={12} className="opacity-50" />
      {score}
    </span>
    <span className="text-[10px] text-white/20">&middot;</span>
    <span className="flex items-center gap-1 text-[10px] font-semibold text-white/60">
      <Timer size={12} className="opacity-50" />
      {Number(timeMs) / 1000}s
    </span>
  </div>
</div>
```

**D. Change spacing**:
- Board container: `mt-2` → `mt-1`
- Mission label: `h-12` → `h-auto py-1`

**Why**: Eliminate orphan franja, redistribute controls to their semantic zones.

**Priority**: P0 (zone elimination) + P1 (spacing)
**Regression risk**: Medium — multiple DOM moves. ExerciseDrawer Sheet must still open correctly from new position. PhaseFlash z-index unaffected (fixed positioning).

---

### 2.4 `apps/web/src/app/page.tsx`

**What changes**:
- Replace `import { MoreVertical } from "lucide-react"` → `import { HelpCircle } from "lucide-react"`
- In `moreAction` prop: change icon from `<MoreVertical>` to `<HelpCircle>`
- Change `aria-label` from `"More options"` → `"Help"`
- Ensure the Link wrapper has `min-h-[44px] min-w-[44px]` (currently `h-11 w-11` = 44px — already compliant)

**Why**: Affordance correction — this navigates to /about, not an overflow menu.

**Priority**: P0
**Regression risk**: None — icon swap only.

---

### 2.5 `apps/web/src/app/globals.css`

**What changes**:

**A. `.piece-hero` — remove border + border-radius (line 761-766)**:
```css
/* BEFORE */
.piece-hero {
  filter: var(--treat-warm-tint);
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow);
  border: 1px solid var(--treat-warm-border);
  border-radius: 8px;
}

/* AFTER */
.piece-hero {
  filter: var(--treat-warm-tint);
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow);
}
```

**B. `.piece-inactive` — remove border-radius (line 768-772)**:
```css
/* BEFORE */
.piece-inactive {
  filter: var(--treat-neutral-tint);
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo);
  border-radius: 8px;
}

/* AFTER */
.piece-inactive {
  filter: var(--treat-neutral-tint);
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo);
}
```

**C. `.piece-pressed` — remove border-radius (line 775-779)**:
```css
/* AFTER */
.piece-pressed {
  filter: brightness(0.90) saturate(0.85);
  box-shadow: var(--treat-carved-lo);
}
```

**D. Reduce warm glow token**:
```css
/* BEFORE */
--treat-warm-glow: 0 0 10px rgba(200, 170, 100, 0.15);

/* AFTER */
--treat-warm-glow: 0 0 8px rgba(200, 170, 100, 0.12);
```

**E. Dock item opacity**:
```css
/* BEFORE — line 591 */
opacity: 0.45;

/* AFTER */
opacity: 0.55;
```

**F. `.hero-rail-tab.is-inactive` opacity** (line 744):
```css
/* BEFORE */
opacity: 0.50;

/* AFTER */
opacity: 0.45;
```

**Why**: Piece state simplification + hierarchy tuning.

**Priority**: P1 (piece state) + P1 (opacity tuning)
**Regression risk**: Low — CSS-only changes. `.piece-hero` border removal also affects `<picture>` elements using that class in `mission-panel.tsx`. The `.badge-treat-owned` class (line 800) uses the same pattern with border-radius:8px — do NOT touch it, only piece classes change.

---

### 2.6 `apps/web/src/components/play-hub/exercise-drawer.tsx`

**What changes**:
- Add `min-h-[44px]` to SheetTrigger button (currently `h-[26px]` — below 44px minimum)
- Keep existing visual style (parchment pill with gold star)

**Why**: Touch target compliance.

**Priority**: P0
**Regression risk**: Low — the button grows vertically but keeps its visual style. Verify it doesn't push stats bar height too much.

---

## 3. UI CONTRACTS

### 3.1 Dock
- The dock center `href` MUST point to the current screen's route (`/`)
- The dock center label MUST read "Practice" (from `DOCK_LABELS.practice`)
- The active dock item MUST have `.dock-treat-active` on its icon
- Dock slot order MUST NOT change in this pass (5 slots, same positions)
- `ARENA_COPY.title` MUST NOT be mutated — it's used in the Arena screen

### 3.2 Hero Rail
- The hero-rail height MUST remain 60px — no growth
- Lv badge + HelpCircle sit OUTSIDE the rail, to its right, in a flex row
- The piece tabs inside the rail are unchanged
- The more/help button renders as a 44px circle with `HelpCircle` icon
- No new elements go INSIDE the `.hero-rail` pill

### 3.3 Stats Bar
- The stars pill (ExerciseDrawer trigger) sits at the LEFT of the stats bar
- A vertical separator (`h-3 w-px bg-white/10`) divides interactive from passive
- Passive stats (score, timer) sit RIGHT of the separator, centered
- Stats text color: `text-white/60` (up from `text-white/40`)
- Stats icon opacity: `opacity-50` (up from `opacity-30`)
- Stats bar background: `rgba(0,0,0,0.20)` (up from `rgba(0,0,0,0.13)`)
- The stars pill MUST keep its existing visual style (parchment pill) — do NOT flatten it

### 3.4 Selected Piece State
- `.piece-hero` MUST NOT have `border` or `border-radius`
- `.piece-hero` MUST keep `filter: var(--treat-warm-tint)` and `box-shadow` (carved + glow)
- `.piece-inactive` and `.piece-pressed` MUST NOT have `border-radius`
- The warm glow token reduces from `10px/0.15` → `8px/0.12`

### 3.5 Board Spacing
- Board container: `mt-1` (down from `mt-2`)
- Mission label: `h-auto py-1` (was `h-12` fixed)
- Board `flex-1 min-h-0` — unchanged
- Board inset shadow — unchanged

### 3.6 Touch Targets
- Every interactive element MUST have minimum 44px tap area
- ExerciseDrawer trigger: `min-h-[44px]` added
- HelpCircle link: already `h-11 w-11` (44px) — verified
- Dock items: already `2.75rem` (44px) — verified

### 3.7 Semantic Ownership
- **Hero rail zone**: piece selection + level indicator + help link (navigation aids)
- **Board zone**: game interaction only
- **Stats bar**: session data (stars progress, score, timer) — stars pill is the ONLY interactive element here
- **CTA slot**: contextual action only
- **Dock**: global navigation only

---

## 4. IMPLEMENTATION STEPS

### PR1 — Dock semantics + active routing
**Scope**: `editorial.ts` + `persistent-dock.tsx`
**Exact changes**:
- Add `DOCK_LABELS` constant to `editorial.ts`
- Add `"use client"` to `persistent-dock.tsx`
- Import `usePathname` from `next/navigation`
- Change `href="/arena"` → `href="/"`
- Change label to `{DOCK_LABELS.practice}`
- Wire pathname-based active class on dock center + dock item icons
**Out of scope**: No slot reordering, no new assets, no layout changes
**Acceptance criteria**:
- Dock center reads "Practice"
- Dock center links to `/`
- On `/`, dock center has active visual treatment
- On `/arena`, dock center does NOT have active treatment
- Arena screen still accessible via dock (center link points home, not arena — arena access remains via mission briefing and other entry points)

### PR2 — Eliminate utility band + redistribute controls
**Scope**: `mission-panel.tsx` + `page.tsx`
**Exact changes**:
- Delete Zone A2 entirely from `mission-panel.tsx`
- Restructure Zone A: hero-rail sits in a flex row with Lv+help cluster to the right
- Move `{exerciseDrawer}` to stats bar (Zone C Layer 1, left side)
- Add vertical separator between interactive chip and passive stats
- Raise stats bar opacity: text `white/60`, icons `opacity-50`, bg `black/20`
- In `page.tsx`: change `MoreVertical` → `HelpCircle`, `aria-label="Help"`
- Add `min-h-[44px]` to ExerciseDrawer trigger in `exercise-drawer.tsx`
**Out of scope**: No CSS class changes, no piece state changes
**Acceptance criteria**:
- No utility band visible between hero-rail and board
- Lv badge visible to the right of hero-rail
- HelpCircle button visible to the right of hero-rail, tapping opens /about
- Stars pill visible in stats bar, tapping opens ExerciseDrawer sheet
- Stats bar text legible (not ghosted)
- All interactive elements ≥ 44px tap target

### PR3 — Piece selector state simplification
**Scope**: `globals.css` only
**Exact changes**:
- Remove `border` and `border-radius` from `.piece-hero`
- Remove `border-radius` from `.piece-inactive` and `.piece-pressed`
- Reduce `--treat-warm-glow` from `0 0 10px rgba(200,170,100,0.15)` → `0 0 8px rgba(200,170,100,0.12)`
**Out of scope**: No `.badge-treat-*` changes, no `.dock-treat-*` changes
**Acceptance criteria**:
- Active piece shows warm tint + carved shadow, NO border box
- No visible "box inside box" effect
- Warm glow is subtler but still present
- Badge treatment classes (`.badge-treat-owned` etc.) unaffected — verify no regression

### PR4 — Opacity + spacing tuning
**Scope**: `globals.css` + `mission-panel.tsx`
**Exact changes**:
- Dock item opacity: `0.45` → `0.55`
- Inactive piece tab opacity: `0.50` → `0.45`
- Board container: `mt-2` → `mt-1`
- Mission label: `h-12` → `h-auto py-1`
**Out of scope**: No structural DOM changes
**Acceptance criteria**:
- Dock items more visible but still secondary to center
- Active/inactive piece contrast is higher (0.45 vs full opacity on active)
- Board has more vertical space
- Mission label collapses to content height

### PR5 — Visual QA in MiniPay
**Scope**: No code changes — testing only
**Exact changes**: None
**Acceptance criteria**:
- Capture screenshots of all states in MiniPay WebView (390px):
  - [ ] Idle (first visit, mission briefing)
  - [ ] Playing (piece on board, target visible)
  - [ ] Success (phase flash + badge earned)
  - [ ] Failure (phase flash + retry/shield)
  - [ ] ExerciseDrawer open (from stats bar)
  - [ ] Dock active state on `/`
  - [ ] About page reachable via HelpCircle
- Compare before/after screenshots
- File issues for any regressions

---

## 5. CSS / STYLE DECISIONS

All values are final. No "approximately" or "around".

| Property | Before | After | File | Line |
|----------|--------|-------|------|------|
| `.piece-hero` border | `1px solid var(--treat-warm-border)` | removed | globals.css | 764 |
| `.piece-hero` border-radius | `8px` | removed | globals.css | 765 |
| `.piece-inactive` border-radius | `8px` | removed | globals.css | 771 |
| `.piece-pressed` border-radius | `8px` | removed | globals.css | 778 |
| `--treat-warm-glow` | `0 0 10px rgba(200, 170, 100, 0.15)` | `0 0 8px rgba(200, 170, 100, 0.12)` | globals.css | 57 |
| Dock item `opacity` | `0.45` | `0.55` | globals.css | 591 |
| `.hero-rail-tab.is-inactive` opacity | `0.50` | `0.45` | globals.css | 744 |
| Stats bar text color | `text-white/40` | `text-white/60` | mission-panel.tsx | 230-236 |
| Stats bar icon opacity | `opacity-30` | `opacity-50` | mission-panel.tsx | 231,235 |
| Stats bar background | `rgba(0,0,0,0.13)` | `rgba(0,0,0,0.20)` | mission-panel.tsx | 229 |
| Board container margin-top | `mt-2` | `mt-1` | mission-panel.tsx | 212 |
| Mission label height | `h-12` | `h-auto py-1` | mission-panel.tsx | 177 |
| ExerciseDrawer trigger min-height | `h-[26px]` | `min-h-[44px] h-[26px]`* | exercise-drawer.tsx | 69 |
| HelpCircle link size | `h-11 w-11` (44px) | unchanged | page.tsx | 816 |

*The pill's visual height stays compact via `h-[26px]` but the tap area expands to 44px via `min-h-[44px]`. Alternatively, change to `h-11` (44px) directly if the visual expansion is acceptable.

---

## 6. ENGINEERING GUARDRAILS

1. **Do NOT mutate `ARENA_COPY.title`** — it is consumed in `apps/web/src/app/arena/page.tsx` and other Arena components. Create a new `DOCK_LABELS` constant instead.

2. **Do NOT touch the z-index stack** — PhaseFlash (z-50), ResultOverlay (z-60), BadgeEarnedPrompt (z-60), MissionBriefing (z-40), Splash (z-80) are calibrated. These changes are layout-only.

3. **Do NOT increase `.hero-rail` height** beyond 60px — Lv badge and HelpCircle go BESIDE the rail in a flex row, not inside it. If they don't fit, reduce their font size, don't grow the rail.

4. **Do NOT merge stars pill visually with passive stats** — the ExerciseDrawer trigger must remain visually distinct (parchment pill style, carved shadows, gold tint). A `w-px` separator must exist between it and the passive data.

5. **Do NOT reorder dock slots** — the 5 slots stay in their current positions. Only the center label, href, and active state change.

6. **Do NOT create new assets** — all changes are CSS, constants, and layout. If you think an asset is needed, stop and flag it.

7. **Do NOT remove `.dock-treat-active` or `.dock-treat-pressed` classes** from `globals.css` — they are "reserved" but this PR consumes them.

8. **Do NOT touch `.badge-treat-*` classes** — they share the same `border-radius: 8px` pattern as piece classes, but badge treatment is intentional and correct. Only `.piece-*` classes lose their border-radius.

---

## 7. DESIGN QA CHECKLIST

### Routing & Semantics
- [ ] Dock center reads "Practice" (not "Arena")
- [ ] Dock center links to `/` (not `/arena`)
- [ ] On `/`, dock center has active visual treatment
- [ ] On `/arena`, dock center does NOT glow as active
- [ ] User can still reach Arena (via mission briefing "or try Arena vs AI" link)

### Legibility
- [ ] Stats bar score text readable at arm's length (white/60)
- [ ] Stats bar timer text readable at arm's length (white/60)
- [ ] Lv badge text visible to the right of hero-rail
- [ ] Dock icons visible but secondary (opacity 0.55)
- [ ] Active piece clearly differentiated from inactive (warm tint vs neutral)

### Hierarchy
- [ ] Board is the dominant element (70%+ of screen)
- [ ] Hero-rail is secondary (piece selection + Lv/help)
- [ ] Stats bar is tertiary (session data)
- [ ] Dock is bottom navigation (global)
- [ ] No orphan bands or floating franjas between zones

### Piece Selector
- [ ] Active piece: warm tint + carved shadow, NO border box
- [ ] No "box inside box" effect on selected piece
- [ ] Inactive pieces at 0.45 opacity (slightly dimmer than before)
- [ ] Plop animation still fires on piece switch
- [ ] Piece label ("Rook", "Bishop", "Knight") still shows below active piece image

### Stats Bar
- [ ] Stars pill visible at LEFT of stats bar
- [ ] Stars pill looks interactive (parchment style, not flat)
- [ ] Tapping stars pill opens ExerciseDrawer sheet
- [ ] ExerciseDrawer sheet content renders correctly from new position
- [ ] Vertical separator visible between pill and passive stats
- [ ] Score and timer centered in remaining space

### Touch Targets
- [ ] ExerciseDrawer trigger ≥ 44px tap area
- [ ] HelpCircle button ≥ 44px tap area
- [ ] All dock items ≥ 44px tap area
- [ ] Each hero-rail tab ≥ 44px tap area (currently 52px height — OK)

### MiniPay Viewport
- [ ] All zones fit within 390px width
- [ ] No horizontal overflow
- [ ] Safe-area-inset-top respected on hero-rail zone
- [ ] Safe-area-inset-bottom respected on dock
- [ ] Board fills available vertical space (no wasted gaps)

### State Consistency
- [ ] Idle state: hero-rail + board + stats + dock all render
- [ ] Playing state: piece on board, target visible, stats updating
- [ ] Success state: PhaseFlash fires, badge prompt works, stats bar still visible
- [ ] Failure state: PhaseFlash fires, retry/shield CTA appears, stats bar still visible
- [ ] Replay state: "Practice mode" label below board if applicable
- [ ] Piece switch: all zones update correctly, no stale state

---

## 8. FINAL HANDOFF TABLE — Execution Decision Table

| # | Decision | Location | Change Type | Priority | Risk | Acceptance Check |
|---|----------|----------|-------------|----------|------|------------------|
| 1 | Dock label → "Practice" | `editorial.ts` | Add constant | P0 | None | Dock reads "Practice" |
| 2 | Dock href → `/` | `persistent-dock.tsx` | Change prop | P0 | Low | Link navigates to Practice Hub |
| 3 | Active routing | `persistent-dock.tsx` | Add `usePathname` + class logic | P0 | Low | Center glows on `/`, dims on `/arena` |
| 4 | Add `"use client"` | `persistent-dock.tsx` | Directive | P0 | Low | Component renders without hydration error |
| 5 | Delete utility band | `mission-panel.tsx` L193-209 | Delete DOM | P0 | Medium | No Lv/stars/more band visible |
| 6 | Lv badge → hero-rail side | `mission-panel.tsx` | Move DOM | P0 | Low | "Lv 1" visible right of rail |
| 7 | HelpCircle icon | `page.tsx` L819 | Icon swap | P0 | None | `?` circle icon, not `⋮` |
| 8 | `aria-label="Help"` | `page.tsx` L817 | Text change | P0 | None | Screen reader announces "Help" |
| 9 | Stars pill → stats bar | `mission-panel.tsx` | Move DOM | P0 | Medium | Pill in stats row, drawer opens |
| 10 | Stats bar separator | `mission-panel.tsx` | Add DOM | P0 | None | `w-px` line between chip and data |
| 11 | Stats text `white/60` | `mission-panel.tsx` L230-236 | Class change | P1 | None | Text more legible |
| 12 | Stats bg `black/20` | `mission-panel.tsx` L229 | Style change | P1 | None | Bar slightly more opaque |
| 13 | Stats icon `opacity-50` | `mission-panel.tsx` L231,235 | Class change | P1 | None | Icons more visible |
| 14 | `.piece-hero` border removed | `globals.css` L764-765 | Delete CSS | P1 | Low | No border box on active piece |
| 15 | `.piece-*` border-radius removed | `globals.css` L765,771,778 | Delete CSS | P1 | Low | No square corners on pieces |
| 16 | `--treat-warm-glow` reduced | `globals.css` L57 | Edit token | P1 | None | Subtler glow |
| 17 | Dock item opacity → 0.55 | `globals.css` L591 | Edit CSS | P1 | None | Dock items slightly more visible |
| 18 | Inactive tab opacity → 0.45 | `globals.css` L744 | Edit CSS | P1 | None | Higher active/inactive contrast |
| 19 | Board `mt-2` → `mt-1` | `mission-panel.tsx` L212 | Class change | P1 | None | More board space |
| 20 | Mission label `h-auto py-1` | `mission-panel.tsx` L177 | Class change | P1 | Low | Label collapses to content |
| 21 | ExerciseDrawer `min-h-[44px]` | `exercise-drawer.tsx` L69 | Class change | P0 | Low | Tap target ≥ 44px |
| 22 | MiniPay QA screenshots | Manual testing | Validation | P1 | None | 7 states captured, no regressions |

---

## Do Not Reopen

These topics are CLOSED for this implementation pass:

1. **Screen classification** — Practice Hub. Done.
2. **Dock slot order** — 5 slots, same positions. No reordering.
3. **Dock center label** — "Practice". Not "Play", not "Train", not "Home".
4. **Asset creation** — zero new assets. Everything is CSS/layout.
5. **Navigation architecture** — Arena stays accessible via mission briefing link. Dock center goes to `/`. No new routes.
6. **Piece selector interaction model** — tabs work the same way. Only visual treatment changes.
7. **ExerciseDrawer behavior** — same Sheet component, same trigger pattern. Only position moves.
8. **Stats bar data model** — score + timer + stars. No new data fields.
9. **`ARENA_COPY` mutation** — absolutely not. New constant instead.
10. **z-index stack** — untouched. No overlay/modal changes.
