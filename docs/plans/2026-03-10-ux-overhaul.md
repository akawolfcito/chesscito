# UX Overhaul: Floating HUD Layout — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the play-hub from 6 stacked vertical blocks into 3 visual zones (floating HUD, hero board, bottom dock) so the UI feels spacious and layered.

**Architecture:** Pure CSS/JSX restructuring. MissionPanel becomes a 3-zone flex layout. Board loses its border wrapper and gets more vertical space. Stars bar becomes an inline progress strip flush to the board. Stats + actions merge into a single frosted-glass bottom dock. No logic, API, or state changes.

**Tech Stack:** Next.js 14, Tailwind CSS, custom CSS in globals.css

---

### Task 1: CSS Foundation — Remove Visual Noise, Add Dock Styles

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Context:** The current CSS has `.playhub-game-stage` with a border + dark gradient bg, `.chesscito-stats-bar` as a heavy grid with borders, and `.mission-chip` on every unselected piece button. These layers compete visually. We need to strip them and add a frosted-glass dock style.

**Step 1: Simplify `.playhub-game-stage`**

Remove the border, background gradient, and box-shadow. It becomes a simple height container:

```css
/* BEFORE (lines 284-292): */
.playhub-game-stage {
  position: relative;
  border-radius: 28px;
  border: 1px solid rgba(103, 232, 249, 0.2);
  overflow: hidden;
  height: 100%;
  background: linear-gradient(180deg, rgba(2, 8, 24, 0.42) 0%, rgba(2, 10, 20, 0.72) 100%);
  box-shadow: 0 24px 56px rgba(2, 12, 22, 0.55);
}

/* AFTER: */
.playhub-game-stage {
  position: relative;
  overflow: hidden;
  height: 100%;
}
```

**Step 2: Simplify `.chesscito-stats-bar`**

Replace the heavy grid with a flex row, no background/border:

```css
/* BEFORE (lines 441-457): heavy grid with borders/shadows */

/* AFTER: */
.chesscito-stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 0;
  padding: 0 4px;
}
```

**Step 3: Remove stats item dividers and heavy padding**

```css
/* BEFORE (lines 459-470): */
.chesscito-stats-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 11px 8px;
  min-height: 48px;
}

.chesscito-stats-item + .chesscito-stats-item {
  border-left: 1px solid rgba(140, 200, 240, 0.14);
}

/* AFTER: */
.chesscito-stats-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0;
}

.chesscito-stats-item + .chesscito-stats-item {
  border-left: none;
}
```

**Step 4: Add new `.chesscito-dock` class**

Add after the stats classes (after line 490):

```css
.chesscito-dock {
  background: rgba(2, 12, 24, 0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
  border-radius: 20px 20px 0 0;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
}
```

**Step 5: Add `.hud-bar` class for the top floating pill**

Add after `.chesscito-dock`:

```css
.hud-bar {
  background: rgba(2, 12, 24, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 6px 12px;
}
```

**Step 6: Verify visually**

Run: `pnpm dev` (should already be running)
Open http://localhost:3000/play-hub on 390px viewport.
Expected: Board stage loses its border/shadow. Stats bar looks broken (no bg). This is expected — Task 2 fixes the layout.

**Step 7: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style(css): strip visual noise and add dock/hud foundation classes"
```

---

### Task 2: MissionPanel — 3-Zone Layout

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx`

**Context:** Currently MissionPanel is a flex-col with 6 children all separated by `mt-2`. We restructure into: Zone 1 (HUD bar at top), Zone 2 (board fills center), Zone 3 (dock at bottom with stats + actions). The component API stays identical.

**Step 1: Replace the entire JSX return of `MissionPanel`**

The current return (lines 98-160) becomes:

```tsx
export function MissionPanel({
  selectedPiece,
  onSelectPiece,
  pieces,
  phase,
  score,
  timeMs,
  level,
  board,
  starsBar,
  actionPanel,
}: MissionPanelProps) {
  return (
    <section className="mission-shell flex h-[100dvh] flex-col overflow-hidden">
      {/* Zone 1: Floating HUD — piece selector + level */}
      <div className="shrink-0 px-3 pt-2 pb-1">
        <div className="hud-bar flex items-center gap-1">
          {pieces.map((piece) => (
            <button
              key={piece.key}
              type="button"
              disabled={!piece.enabled}
              onClick={() => onSelectPiece(piece.key)}
              className={`relative h-8 px-3 text-xs font-semibold uppercase tracking-[0.16em] transition disabled:opacity-40 ${
                selectedPiece === piece.key
                  ? "text-cyan-50"
                  : "text-cyan-200/50"
              }`}
            >
              {piece.label}
              {selectedPiece === piece.key ? (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(103,232,249,0.6)]" />
              ) : null}
            </button>
          ))}
          <span className="ml-auto shrink-0 text-xs text-cyan-300/70 tracking-[0.14em] uppercase">
            Lv {level}
          </span>
        </div>
      </div>

      {/* Zone 2: Board Stage — hero, fills all remaining space */}
      <div className="min-h-0 flex-1 px-1">
        {board}
        {/* Progress bar flush below board */}
        <div className="px-2">{starsBar}</div>
      </div>

      {/* Zone 3: Bottom Dock — stats + actions */}
      <div className="chesscito-dock shrink-0">
        {/* Stats row */}
        <div className="chesscito-stats-bar mb-2">
          <div className="chesscito-stats-item">
            <span className="chesscito-stats-label">SCORE</span>
            <span className="chesscito-stats-value">{score}</span>
          </div>
          <div className="chesscito-stats-item">
            <span className="chesscito-stats-label">TIME</span>
            <span className="chesscito-stats-value">{Number(timeMs) / 1000}s</span>
          </div>
          <div className="chesscito-stats-item">
            <span className="chesscito-stats-label">TARGET</span>
            <span className="chesscito-stats-value">h1</span>
          </div>
        </div>

        {/* Action buttons */}
        {actionPanel}
      </div>

      {/* Fullscreen phase flash — auto-fades */}
      <PhaseFlash phase={phase} />
    </section>
  );
}
```

Key changes:
- Removed `px-3 pb-3 pt-2` from section (dock handles its own padding)
- Zone 1: `hud-bar` replaces individual `mission-chip` buttons — text-only with underline indicator
- Zone 2: board + starsBar grouped together, no `mt-2` gap
- Zone 3: single `.chesscito-dock` wraps stats + actions
- Removed `SELECTED_PIECE_ART` constant and background-image styling (no longer used on buttons)

**Step 2: Clean up unused imports/constants**

Remove the `SELECTED_PIECE_ART` constant (lines 25-29) since we no longer use background images on piece selector buttons.

**Step 3: Verify visually**

Open http://localhost:3000/play-hub at 390px viewport.
Expected:
- Top: translucent pill bar with piece names + underline on selected
- Center: board fills most of the screen
- Bottom: frosted dock with stats row + action buttons
- Background scene visible throughout (no per-section bgs blocking it)

**Step 4: Commit**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "style(layout): restructure MissionPanel into 3-zone floating HUD layout"
```

---

### Task 3: ExerciseStarsBar — Inline Progress Strip

**Files:**
- Modify: `apps/web/src/components/play-hub/exercise-stars-bar.tsx`

**Context:** Currently the stars bar has a progress bar + a row of exercise buttons with text. This takes vertical space. We want a single-row compact strip: thin progress bar with numbered dot markers on it. Total height should be ~24px.

**Step 1: Replace the entire component JSX**

```tsx
type ExerciseStarsBarProps = {
  stars: [number, number, number, number, number];
  activeIndex: number;
  onSelect?: (index: number) => void;
};

export function ExerciseStarsBar({
  stars,
  activeIndex,
  onSelect,
}: ExerciseStarsBarProps) {
  const totalEarned = stars.reduce((sum, s) => sum + s, 0);
  const maxStars = stars.length * 3;

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Exercise dot markers */}
      <div className="flex items-center gap-1">
        {stars.map((exerciseStars, index) => {
          const isActive = index === activeIndex;
          const isDone = exerciseStars > 0;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect?.(index)}
              className={[
                "flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-bold transition",
                isActive
                  ? "bg-cyan-500/30 text-cyan-200 ring-1 ring-cyan-400/60"
                  : isDone
                    ? "text-amber-400/80"
                    : "text-cyan-400/40",
              ].join(" ")}
              aria-label={`Trial ${index + 1}: ${exerciseStars} star${exerciseStars !== 1 ? "s" : ""}`}
            >
              {isDone ? "★" : index + 1}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
          style={{ width: `${(totalEarned / maxStars) * 100}%` }}
        />
        {/* Threshold marker at 10/15 */}
        <div
          className="absolute top-0 h-full w-px bg-cyan-400/40"
          style={{ left: `${(10 / maxStars) * 100}%` }}
        />
      </div>

      {/* Score count */}
      <span className="text-[0.6rem] font-semibold text-cyan-100/40 tabular-nums">
        {totalEarned}/{maxStars}
      </span>
    </div>
  );
}
```

Key changes:
- Single row layout (`flex items-center`) instead of two stacked rows
- Exercise markers are tiny 20px circles (number or star)
- Progress bar is thinner (h-1.5 = 6px) and fills remaining space
- Total height ~24px vs previous ~52px
- Same component API, no prop changes

**Step 2: Verify visually**

Expected: Compact single-line strip between board and dock. Dots on left, thin bar in middle, count on right.

**Step 3: Commit**

```bash
git add apps/web/src/components/play-hub/exercise-stars-bar.tsx
git commit -m "style(stars): compact inline progress strip with dot markers"
```

---

### Task 4: OnChainActionsPanel — Dock-Ready Layout

**Files:**
- Modify: `apps/web/src/components/play-hub/onchain-actions-panel.tsx`

**Context:** The action panel is now rendered inside the `.chesscito-dock`. The buttons need wider spacing and no individual backgrounds on default-variant buttons (let the dock bg show through). Primary buttons keep their subtle highlight.

**Step 1: Update ActionBtn default variant**

Change the className in ActionBtn (line 45-49):

```tsx
/* BEFORE: */
className={`relative flex h-16 flex-1 flex-col items-center justify-center rounded-2xl transition disabled:opacity-35 ${
  variant === "primary"
    ? "bg-cyan-400/20 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.35)]"
    : "mission-chip text-cyan-100/80"
}`}

/* AFTER: */
className={`relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl transition disabled:opacity-35 ${
  variant === "primary"
    ? "bg-cyan-400/15 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.25)]"
    : "text-cyan-100/70"
}`}
```

Changes:
- `h-16 flex-1` → `h-14 w-14 shrink-0` (fixed square size, not stretchy)
- Default variant: removed `mission-chip` (no bg/border), just text color
- Primary: slightly more subtle (0.15 / 0.25 instead of 0.20 / 0.35)

**Step 2: Update the action bar container**

Change the flex container (line 117):

```tsx
/* BEFORE: */
<div className="flex gap-2">

/* AFTER: */
<div className="flex items-center justify-around">
```

Changes: `gap-2` → `justify-around` for even distribution across dock width.

**Step 3: Verify visually**

Expected: Action icons spread evenly across the dock. No individual backgrounds on reset/shop/leaderboard buttons. Badge and score buttons have subtle cyan tint. Notification dots still visible.

**Step 4: Commit**

```bash
git add apps/web/src/components/play-hub/onchain-actions-panel.tsx
git commit -m "style(actions): dock-ready layout with even spacing and cleaner buttons"
```

---

### Task 5: Board — Remove Stage Wrapper Chrome

**Files:**
- Modify: `apps/web/src/components/board.tsx`

**Context:** The Board component wraps itself in `.playhub-stage-shell > .playhub-game-stage > .playhub-game-grid > .playhub-board-canvas`. We already stripped the CSS on `.playhub-game-stage` in Task 1, but we can also simplify the grid padding to give the board more room.

**Step 1: Reduce `.playhub-game-grid` padding**

In `globals.css`, change line 438:

```css
/* BEFORE: */
.playhub-game-grid {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  width: 100%;
  padding: 1.4rem 0.7rem 0.7rem;
}

/* AFTER: */
.playhub-game-grid {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  width: 100%;
  padding: 0.5rem 0.2rem 0;
}
```

Less padding = more board visible.

**Step 2: Verify visually**

Expected: Board image fills more of the available space. No border around the stage. Piece, targets, and highlights still work correctly.

**Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style(board): reduce grid padding for larger board display"
```

---

### Task 6: Final Visual Tuning Pass

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx` (if needed)

**Context:** After all structural changes, do a final visual review at 390px viewport. Check for:

1. **Dock shadow** — visible separation from board area?
2. **HUD bar** — readable over the background scene?
3. **Board size** — noticeably bigger than before?
4. **Progress strip** — visible but not dominant?
5. **Action button touch targets** — at least 44px?
6. **Safe area** — dock padding at bottom for home-bar phones?

**Step 1: Visual review and micro-adjustments**

Open the app at 390×844 viewport (MiniPay size). Walk through:
- Select each piece type
- Complete an exercise
- Check PhaseFlash overlay
- Check notification dots
- Open shop/leaderboard sheets

Fix any spacing/opacity/size issues found.

**Step 2: Commit any adjustments**

```bash
git add -u
git commit -m "style(layout): final visual tuning for floating HUD layout"
```
