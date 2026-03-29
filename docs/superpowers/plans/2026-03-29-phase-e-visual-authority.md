# Phase E — Visual Authority / Hero Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Play Hub into a visually authoritative game product where the board is the sacred center and every element serves it.

**Architecture:** Outside-In approach — establish scene authority first (focal vignette), then anchor the composition (dock), then refine support modules (piece rail, gameplay panel). All changes are CSS-only with minimal JSX adjustments. No new features, no logic changes.

**Tech Stack:** Tailwind CSS, CSS custom properties, globals.css, lucide-react (Lock icon already available)

**Spec:** `docs/superpowers/specs/2026-03-29-phase-e-visual-authority-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/app/globals.css` | Modify | Atmosphere intensification, board-focus overlay, dock base, hero-rail roster, locked piece treatment |
| `apps/web/src/components/play-hub/mission-panel.tsx` | Modify | Board stage wrapper class, mission block typography, stats row contrast, hero-rail lock overlay JSX |
| `apps/web/src/components/play-hub/persistent-dock.tsx` | Modify | Center action scale class |
| `apps/web/src/components/play-hub/gameplay-panel.tsx` | Modify | Divider opacity upgrade |

---

### Task 1: Board Focal Vignette + Atmosphere Intensification

**Files:**
- Modify: `apps/web/src/app/globals.css:537-569` (atmosphere rules)
- Modify: `apps/web/src/app/globals.css:333-347` (board stage CSS)
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:227-230` (board stage wrapper)

- [ ] **Step 1: Add `.board-stage-focus` overlay class in globals.css**

Add after the existing `.atmosphere > *` rule (after line 569):

```css
/* ── Board focal overlay (Phase E) ── */
.board-stage-focus {
  position: relative;
}

.board-stage-focus::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(
    ellipse 70% 55% at 50% 42%,
    transparent 40%,
    rgba(0, 0, 0, 0.30) 75%,
    rgba(0, 0, 0, 0.50) 100%
  );
}

.board-stage-focus > * {
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 2: Intensify existing atmosphere pseudo-elements**

In `.atmosphere::before` (line 548), change:
```css
/* Before */
rgba(0, 0, 0, 0.35) 100%
/* After */
rgba(0, 0, 0, 0.45) 100%
```

In `.atmosphere::after` (line 560), change:
```css
/* Before */
linear-gradient(to bottom, transparent 0%, rgba(6, 14, 28, 0.15) 55%, rgba(6, 14, 28, 0.25) 100%),
linear-gradient(to bottom, transparent 70%, rgba(6, 14, 28, 0.30) 100%);
/* After */
linear-gradient(to bottom, transparent 0%, rgba(6, 14, 28, 0.20) 55%, rgba(6, 14, 28, 0.35) 100%),
linear-gradient(to bottom, transparent 70%, rgba(6, 14, 28, 0.35) 100%);
```

- [ ] **Step 3: Apply `.board-stage-focus` to the board wrapper in mission-panel.tsx**

In `mission-panel.tsx` line 228, the board stage outer div:

```tsx
{/* Before */}
<div className="min-h-0 flex-1 mx-2">

{/* After */}
<div className="board-stage-focus min-h-0 flex-1 mx-2">
```

- [ ] **Step 4: Visual verification**

Run: `cd apps/web && pnpm dev`

Open `http://localhost:3000/play-hub` in a 390px viewport.

Verify:
- The board area is visually brighter than the surrounding scene (by contrast, not by glow)
- The top rail zone and bottom dock zone are slightly darker at the extremes
- The gameplay panel text is still legible
- The board does not feel artificially brighter than its own art — it should feel naturally prominent
- The scene feels unified, not like the board is cut out

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "style: board focal vignette + atmosphere intensification (Phase E)"
```

---

### Task 2: Dock Architectural Base + Center Action

**Files:**
- Modify: `apps/web/src/app/globals.css:776-858` (dock CSS rules)
- Modify: `apps/web/src/components/play-hub/persistent-dock.tsx:36-37` (center action class)

- [ ] **Step 1: Upgrade dock container background and border**

In `.chesscito-dock` (line 776), change:

```css
/* Before */
.chesscito-dock {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px 8px 4px;
  border-top: 1px solid var(--shell-border);
}

/* After */
.chesscito-dock {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px 8px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(6, 14, 28, 0.90);
}
```

- [ ] **Step 2: Raise side item opacity**

In `.chesscito-dock-item > button` rule (line ~793), change:

```css
/* Before */
opacity: 0.55;

/* After */
opacity: 0.65;
```

- [ ] **Step 3: Upgrade center action active state**

In `.chesscito-dock-center.is-active` (line ~840), change:

```css
/* Before */
.chesscito-dock-center.is-active {
  background: rgba(20, 184, 166, 0.12);
  border-color: rgba(20, 184, 166, 0.2);
  color: rgba(160, 225, 220, 0.8);
  box-shadow: 0 0 12px rgba(20, 184, 166, 0.1);
}

/* After */
.chesscito-dock-center.is-active {
  background: rgba(20, 184, 166, 0.15);
  border-color: rgba(20, 184, 166, 0.25);
  color: rgba(160, 225, 220, 0.8);
  box-shadow: 0 0 16px rgba(20, 184, 166, 0.14);
  transform: scale(1.04);
}
```

- [ ] **Step 4: Add inactive center action subtle scale**

Add a new rule after `.chesscito-dock-center.is-active` block:

```css
/* Center action: structurally present even when inactive */
.chesscito-dock-center:not(.is-active) {
  transform: scale(1.01);
}
```

- [ ] **Step 5: Ensure center :active state accounts for scale**

In `.chesscito-dock-center:active` (line ~851), update:

```css
/* Before */
.chesscito-dock-center:active {
  background: rgba(20, 184, 166, 0.2);
  box-shadow: 0 0 16px rgba(20, 184, 166, 0.2);
}

/* After */
.chesscito-dock-center:active {
  background: rgba(20, 184, 166, 0.2);
  box-shadow: 0 0 16px rgba(20, 184, 166, 0.2);
  transform: scale(0.98);
}
```

- [ ] **Step 6: Visual verification**

Open `http://localhost:3000/play-hub` in 390px viewport.

Verify:
- The dock feels like a solid floor, not a floating tray
- The top border is visible as a horizon line between scene and navigation
- Side icons are legible but subordinate
- The center action (Swords icon) is slightly larger and more present than side items
- When on `/arena`, the center action teal glow is clearly resolved
- When NOT on `/arena`, the center action is dormant but structurally present
- The dock is visually lighter than the gameplay panel above it
- Press feedback works correctly on all items

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/play-hub/persistent-dock.tsx
git commit -m "style: dock architectural base + center action presence (Phase E)"
```

---

### Task 3: Piece Rail Roster Treatment

**Files:**
- Modify: `apps/web/src/app/globals.css:975-1072` (hero-rail + piece treatment CSS)
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:170-220` (hero-rail JSX)

- [ ] **Step 1: Upgrade active tab to champion showcase**

In `.hero-rail-tab.is-active` (line ~1005), change:

```css
/* Before */
.hero-rail-tab.is-active {
  background: linear-gradient(180deg, rgba(20, 28, 45, 0.95) 0%, rgba(8, 14, 28, 0.90) 100%);
  border-color: rgba(180, 160, 110, 0.35);
  box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.06), inset 0 -2px 4px rgba(0, 0, 0, 0.4), 0 0 12px rgba(200, 170, 100, 0.12);
}

/* After */
.hero-rail-tab.is-active {
  background: linear-gradient(180deg, rgba(20, 28, 45, 0.95) 0%, rgba(8, 14, 28, 0.90) 100%);
  border-color: rgba(180, 160, 110, 0.45);
  box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.06), inset 0 -2px 4px rgba(0, 0, 0, 0.4), 0 0 14px rgba(200, 170, 100, 0.18);
  transform: scale(1.05);
}
```

- [ ] **Step 2: Add champion transition to base tab**

In `.hero-rail-tab` (line ~990), add `transform` to the existing transition:

```css
/* Before */
transition: opacity 150ms ease-out, border-color 150ms ease-out, background 150ms ease-out, box-shadow 150ms ease-out;

/* After */
transition: opacity 150ms ease-out, border-color 150ms ease-out, background 150ms ease-out, box-shadow 250ms ease-out, transform 250ms ease-out;
```

Also add reduced motion override after the `.hero-rail-tab` block:

```css
@media (prefers-reduced-motion: reduce) {
  .hero-rail-tab {
    transition: none;
  }
}
```

- [ ] **Step 3: Upgrade inactive unlocked tabs to roster slots**

In `.hero-rail-tab.is-inactive` (line ~1015), change:

```css
/* Before */
.hero-rail-tab.is-inactive {
  opacity: 0.45;
  border-color: rgba(255, 255, 255, 0.04);
  background: rgba(255, 255, 255, 0.02);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.03), inset 0 -1px 2px rgba(0, 0, 0, 0.2);
}

/* After */
.hero-rail-tab.is-inactive {
  opacity: 0.45;
  border-color: rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.03), inset 0 -1px 2px rgba(0, 0, 0, 0.2);
}
```

- [ ] **Step 4: Add locked piece silhouette treatment**

Add new CSS rules after `.hero-rail-tab.is-inactive:active` block:

```css
/* ── Locked piece relic treatment (Phase E) ── */
.hero-rail-tab.is-locked {
  opacity: 0.35;
  border-color: transparent;
  background: rgba(0, 0, 0, 0.15);
  box-shadow: none;
  cursor: default;
}

.hero-rail-tab.is-locked .piece-locked {
  filter: brightness(0.35) saturate(0) contrast(0.8);
}

.hero-rail-tab.is-locked .lock-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.hero-rail-tab.is-locked .lock-indicator svg {
  opacity: 0.4;
  color: rgba(186, 230, 253, 0.5);
}
```

- [ ] **Step 5: Add piece-hero drop-shadow for float effect**

In `.piece-hero` (line ~1048), change:

```css
/* Before */
.piece-hero {
  filter: var(--treat-warm-tint);
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow);
}

/* After */
.piece-hero {
  filter: var(--treat-warm-tint) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow);
}
```

- [ ] **Step 6: Update hero-rail JSX to support locked state**

In `mission-panel.tsx`, update the hero-rail `map` (around line 175-214). Replace the current button rendering:

```tsx
{pieces.map((piece) => {
  const isActive = selectedPiece === piece.key;
  const isLocked = !piece.enabled;
  const src = PIECE_IMAGES[piece.key as keyof typeof PIECE_IMAGES];
  return (
    <button
      key={piece.key}
      type="button"
      disabled={isLocked}
      onClick={() => onSelectPiece(piece.key)}
      className={`hero-rail-tab ${isActive ? "is-active" : isLocked ? "is-locked" : "is-inactive"}`}
      aria-label={piece.label}
    >
      <picture
        className={[
          "h-7 w-7 shrink-0",
          isActive
            ? `piece-hero ${plopping ? "animate-[hero-plop_300ms_cubic-bezier(0.34,1.56,0.64,1)]" : ""}`
            : isLocked
              ? "piece-locked"
              : "piece-inactive",
        ].join(" ")}
      >
        <source srcSet={`${src}.avif`} type="image/avif" />
        <source srcSet={`${src}.webp`} type="image/webp" />
        <img
          src={`${src}.png`}
          alt={piece.label}
          className="h-full w-full object-contain"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            const fallback = document.createElement("span");
            fallback.textContent = piece.label[0];
            fallback.className = "text-[20px] leading-none text-slate-400";
            target.parentElement?.appendChild(fallback);
          }}
        />
      </picture>
      {isActive && (
        <span className="text-[8px] font-extrabold uppercase tracking-[0.15em] text-[rgba(220,200,150,0.9)]">
          {piece.label}
        </span>
      )}
      {isLocked && (
        <span className="lock-indicator">
          <Lock size={14} />
        </span>
      )}
    </button>
  );
})}
```

Note: `Lock` must be imported from lucide-react. Add to the existing import line in mission-panel.tsx:

```tsx
import { Lock } from "lucide-react";
```

Check if `Star` and `Timer` are already imported from lucide-react in this file — if so, add `Lock` to that import.

- [ ] **Step 7: Visual verification**

Open `http://localhost:3000/play-hub` in 390px viewport.

Verify:
- The active piece tab is visibly elevated (scale + stronger glow) — feels like a champion
- The champion switch transition is smooth (250ms ease-out)
- Inactive unlocked tabs have subtle slot borders — feel like resting roster members
- Locked tabs are clearly different: dark silhouette + small lock icon + sealed background
- The active piece image has a float shadow — sits above its pedestal
- The rail does NOT feel more dominant than the board
- Touch targets remain >= 44px
- `prefers-reduced-motion` falls back to instant state change (no transition)
- The rail overflow is not broken by the scale(1.05) on active tab

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "style: piece rail roster treatment with champion showcase (Phase E)"
```

---

### Task 4: Gameplay Panel Internal Hierarchy

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:142-162` (mission block typography)
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:124-140` (stats row contrast)
- Modify: `apps/web/src/components/play-hub/gameplay-panel.tsx:28-35` (divider opacity)

- [ ] **Step 1: Upgrade mission block typography**

In `mission-panel.tsx`, update the mission content block (around line 142-162):

```tsx
const missionContent = (
  <div className="flex items-center gap-3">
    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-400/85">
        {MISSION_BRIEFING_COPY.label}
      </p>
      <p key={targetLabel} className="mission-typewriter text-[15px] font-bold text-slate-50">
        {isCapture
          ? <>Move your {PIECE_LABELS[selectedPiece as keyof typeof PIECE_LABELS]} to <span className="text-rose-400">CAPTURE</span></>
          : `Move your ${PIECE_LABELS[selectedPiece as keyof typeof PIECE_LABELS]} to ${targetLabel}`}
      </p>
      <p key={`hint-${targetLabel}`} className="mission-typewriter text-[11px] text-cyan-100/55" style={{ animationDelay: "1s" }}>
        {MISSION_BRIEFING_COPY.moveHint[selectedPiece as keyof typeof MISSION_BRIEFING_COPY.moveHint]}
      </p>
    </div>
    <picture className="h-12 w-12 shrink-0">
      <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
      <img src="/art/favicon-wolf.png" alt="" aria-hidden="true" className="h-full w-full object-contain drop-shadow-[0_0_8px_rgba(103,232,249,0.3)]" />
    </picture>
  </div>
);
```

Changes from original:
- Wrapper div: added `flex flex-col gap-0.5` for consistent vertical spacing
- Label: `text-[9px]` → `text-[10px]`, `text-cyan-400/70` → `text-cyan-400/85`
- Target: `text-sm` → `text-[15px]`, `text-slate-100` → `text-slate-50`
- Hint: `text-cyan-100/40` → `text-cyan-100/55`

- [ ] **Step 2: Upgrade stats row contrast**

In `mission-panel.tsx`, update the stats content block (around line 124-140):

```tsx
const statsContent = (
  <div className="flex items-center gap-3">
    <div className="shrink-0">{exerciseDrawer}</div>
    <span className="h-4 w-px bg-white/[0.08]" />
    <div className="flex flex-1 items-center justify-center gap-4">
      <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-white/85">
        <Star size={14} className="opacity-65" />
        {score}
      </span>
      <span className="text-xs text-white/15">&middot;</span>
      <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-white/85">
        <Timer size={14} className="opacity-65" />
        {Number(timeMs) / 1000}s
      </span>
    </div>
  </div>
);
```

Changes from original:
- Star/timer values: `text-white/75` → `text-white/85`

- [ ] **Step 3: Upgrade divider opacity in gameplay-panel.tsx**

In `gameplay-panel.tsx`, update both divider elements. Change the inline style:

```tsx
{/* Before */}
<div
  className="h-px"
  style={{ background: "var(--shell-divider)" }}
/>

{/* After */}
<div
  className="h-px"
  style={{ background: "rgba(255, 255, 255, 0.07)" }}
/>
```

Apply this change to both dividers in the component (between mission/stats and between stats/action).

- [ ] **Step 4: Visual verification**

Open `http://localhost:3000/play-hub` in 390px viewport.

Verify:
- Mission label ("MISSION") is more visible than before but still categorizing, not shouting
- Mission target text is clearly the primary informational focal point — scans in one glance
- Hint text is readable as support copy, not invisible
- The mission block reads as: label (categorize) → order (mission target) → support (hint)
- Stats values (star count, timer) read effortlessly without squinting
- Dividers between panel zones are subtly visible — not invisible, not prominent
- The CTA button remains the primary action focal point — unchanged
- The panel does NOT feel heavier than the board — same external weight, better internal clarity
- Panel remains fully legible under the focal vignette darkening

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx apps/web/src/components/play-hub/gameplay-panel.tsx
git commit -m "style: gameplay panel internal hierarchy refinement (Phase E)"
```

---

### Task 5: Integration Review + Final Commit

**Files:**
- None new — this is a visual review task

- [ ] **Step 1: Full composition review**

Open `http://localhost:3000/play-hub` in 390px viewport.

Review the complete composition against the spec success criteria:
1. The board reads as the sacred center within 1 second of opening
2. The dock feels like a stable floor, not a floating tray
3. The piece rail feels like a champion roster with clear active/locked/unlocked states
4. The gameplay panel reads as a command surface at scan speed
5. All elements feel like one unified scene, not isolated modules
6. Play Hub feels visually intentional, focal, and memorable

- [ ] **Step 2: Scene unity check**

Verify that:
- The vignette darkening does NOT make the rail, panel, or dock feel detached from the scene
- The board does NOT feel artificially brighter than its own art language
- The hierarchy reads clearly: Board >>> Panel > Rail > Center Dock > Side Dock
- No element competes with the board for visual dominance

- [ ] **Step 3: Navigate between routes**

Test transitions:
- `/play-hub` → dock center action is NOT active (dormant but present)
- `/arena` → dock center action is active (teal glow + scale)
- Return to `/play-hub` → verify all Phase E treatments render correctly after navigation

- [ ] **Step 4: Run visual snapshot tests**

```bash
cd apps/web && pnpm test:e2e:visual
```

Update snapshots if the visual changes are intentional (they will be — Phase E changes the Play Hub appearance).

```bash
cd apps/web && pnpm exec playwright test e2e/visual-snapshot.spec.ts --update-snapshots
```

- [ ] **Step 5: Commit updated snapshots**

```bash
git add apps/web/e2e/visual-snapshot.spec.ts-snapshots/
git commit -m "test: update visual snapshots for Phase E visual authority"
```

- [ ] **Step 6: Run full e2e suite**

```bash
cd apps/web && pnpm test:e2e
```

Expected: all tests pass (no functional changes were made).

- [ ] **Step 7: Run build check**

```bash
cd apps/web && pnpm build
```

Expected: successful build with no errors.
