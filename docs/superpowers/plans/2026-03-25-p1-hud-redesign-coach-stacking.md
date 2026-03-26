# P1 HUD Redesign + Coach Overlay Stacking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild play-hub HUD as a centered hero selector with 4-zone layout, and fix coach/victory overlay stacking in arena.

**Architecture:** MissionPanel component restructured into 4 zones (hero selector, utility band, board, 2-layer footer). CSS classes in globals.css replace current `.hud-bar` styles. Arena page adds visibility toggle for end-state when coach is active.

**Tech Stack:** React, TypeScript, Tailwind CSS, Next.js 14 App Router

**Spec:** `docs/superpowers/specs/2026-03-25-p1-hud-redesign-coach-stacking-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/web/src/components/play-hub/mission-panel.tsx` | **Rewrite** | 4-zone layout: hero selector, utility band, board stage, 2-layer footer |
| `apps/web/src/components/play-hub/exercise-drawer.tsx` | **Modify** | Trigger button restyled to utility-tier stars chip |
| `apps/web/src/app/globals.css` | **Modify** | Remove old `.hud-bar` styles, add new hero/utility/footer CSS classes |
| `apps/web/src/app/arena/page.tsx` | **Modify** | Add `hideEndState` visibility toggle based on `coachPhase` |
| `apps/web/src/app/page.tsx` | **No changes** | Props passed to MissionPanel remain the same — data flow unchanged |

---

### Task 1: Coach Overlay Stacking Fix

**Files:**
- Modify: `apps/web/src/app/arena/page.tsx:494-515`

This is the smallest, most isolated change. Ship it first.

- [ ] **Step 1: Add visibility toggle to ArenaEndState wrapper**

In `apps/web/src/app/arena/page.tsx`, find the end-state rendering block (around line 494):

```tsx
{isEndState && (
  <ArenaEndState
```

Replace it with a visibility-toggled wrapper:

```tsx
{isEndState && (
  <div
    className={`transition-opacity duration-200 ${
      coachPhase !== "idle"
        ? "opacity-0 pointer-events-none"
        : "opacity-100 pointer-events-auto"
    }`}
  >
    <ArenaEndState
      status={game.status}
      isPlayerWin={isPlayerWin}
      onPlayAgain={handlePlayAgain}
      onBackToHub={handleBackToHub}
      claimPhase={claimPhase}
      shareStatus={shareStatus}
      claimData={claimData}
      onClaimVictory={canClaim ? () => void handleClaimVictory() : undefined}
      claimPrice={claimPriceLabel}
      claimError={
        claimPhase === "error" && !isConnected
          ? "Wallet disconnected — reconnect to try again"
          : claimError
      }
      moves={game.moveCount}
      elapsedMs={game.elapsedMs}
      difficulty={game.difficulty}
      onAskCoach={coachPhase === "idle" ? handleAskCoach : undefined}
    />
  </div>
)}
```

- [ ] **Step 2: Verify the fix manually**

Run: `cd apps/web && pnpm dev`

Test flow:
1. Go to `/arena`, start a game, play to completion (win or lose)
2. Victory/loss screen appears — verify it's visible
3. Tap "Ask Coach" — verify victory screen fades out, coach overlay shows alone (no double darkening)
4. Close coach (X button) — verify victory screen fades back in
5. Open coach again → tap "Play Again" — verify navigates to difficulty selector, no victory flash

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/arena/page.tsx
git commit -m "fix: hide victory overlay when coach is active to prevent double-stacking"
```

---

### Task 2: Strip Old HUD Bar CSS

**Files:**
- Modify: `apps/web/src/app/globals.css`

Remove old styles before writing new ones to avoid collisions.

- [ ] **Step 1: Remove `.hud-bar` class**

In `apps/web/src/app/globals.css`, find and delete the `.hud-bar` block (around line 658):

```css
  .hud-bar {
    background: rgba(2, 12, 24, 0.45);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 16px;
    padding: 6px 12px;
  }
```

Delete the entire block. The hero selector will have no container background — pieces float on the game bg.

- [ ] **Step 2: Remove `.chesscito-hud-strip` and related classes**

Delete these class blocks from globals.css:
- `.chesscito-hud-strip` (the full stats bar — being replaced by micro-stats inline)
- `.chesscito-hud-item`
- `.chesscito-hud-icon`
- `.chesscito-hud-value`
- `.chesscito-hud-target`
- `.chesscito-hud-divider`

These will be replaced by Tailwind utility classes directly in the component.

- [ ] **Step 3: Remove `.piece-hint` class**

Delete the `.piece-hint` block (around line 525). The tutorial text now renders in the hero block's mission-label slot, styled with Tailwind.

- [ ] **Step 4: Verify build still compiles**

Run: `cd apps/web && pnpm build`

Expected: Build succeeds. The MissionPanel component still references `hud-bar` class in JSX, but with no CSS it just becomes unstyled — that's fine, Task 3 rewrites the JSX.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "refactor: remove old HUD bar and stats strip CSS classes"
```

---

### Task 3: Rewrite MissionPanel — Hero Selector + Utility Band (Zone A + A2)

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx`

This task rewrites Zones A and A2 only. Footer (Zone C) is Task 4.

- [ ] **Step 1: Rewrite the top section JSX**

Replace everything from `{/* Zone 1: Floating HUD */}` through the closing `</div>` of that zone (lines 107-143) with the new hero selector and utility band:

```tsx
{/* Zone A: Hero Selector — centered piece + mission target */}
<div className="shrink-0 px-4 pt-[max(env(safe-area-inset-top),12px)]">
  {/* Piece selector row — centered */}
  <div className="flex items-center justify-center gap-2">
    {pieces.map((piece) => {
      const isActive = selectedPiece === piece.key;
      const icon = PIECE_ICONS[piece.key as keyof typeof PIECE_ICONS];
      return (
        <button
          key={piece.key}
          type="button"
          disabled={!piece.enabled}
          onClick={() => onSelectPiece(piece.key)}
          className={`relative flex flex-col items-center justify-center rounded-full transition-all ${
            isActive
              ? "h-16 w-16 border-2 border-cyan-400/45 bg-cyan-500/[0.12] shadow-[0_0_16px_rgba(34,211,238,0.20)]"
              : "h-9 w-9 border border-white/[0.06] opacity-30 disabled:opacity-20"
          }`}
          aria-label={piece.label}
        >
          <span className={isActive ? "text-2xl drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-lg"}>
            {icon}
          </span>
          {isActive && (
            <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-cyan-200">
              {piece.label}
            </span>
          )}
          {!piece.enabled && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/10 bg-slate-600/80 text-[7px]">
              &#128274;
            </span>
          )}
        </button>
      );
    })}
  </div>

  {/* Mission label slot — target OR tutorial (mutually exclusive) */}
  <div className="mt-2 text-center">
    {pieceHint ? (
      <p className="text-[11px] font-medium text-cyan-200/50">{pieceHint}</p>
    ) : (
      <>
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-400/35">
          Move to
        </p>
        <p className="text-lg font-extrabold text-cyan-400/90 drop-shadow-[0_0_12px_rgba(34,211,238,0.20)]">
          {targetLabel}
        </p>
      </>
    )}
  </div>
</div>

{/* Zone A2: Utility Band — Lv + stars + more */}
<div className="flex shrink-0 items-center justify-between px-4 h-7">
  <span className="text-[11px] font-bold text-purple-400/50">
    Lv {level}
  </span>
  <div className="flex items-center gap-1.5">
    {exerciseDrawer}
    {moreAction}
  </div>
</div>
```

- [ ] **Step 2: Verify the hero selector renders**

Run: `cd apps/web && pnpm dev`

Open `http://localhost:3000` on a 390px viewport. Verify:
- Active piece is large and centered with cyan glow
- Inactive pieces are small and muted on either side
- Mission target shows below as "MOVE TO" / "e5" in two lines
- Utility band sits below with Lv on left, stars+more on right
- No dark container background behind pieces

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "feat: hero selector + utility band (zones A/A2) per game UI spec"
```

---

### Task 4: Rewrite MissionPanel — Board Stage + Footer (Zone B + C)

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx`

- [ ] **Step 1: Rewrite the board stage (Zone B)**

Replace the current Zone 2 block (lines ~145-155 after Task 3 edits) with:

```tsx
{/* Zone B: Board Stage — flex-1, maximum space */}
<div className="min-h-0 flex-1 px-1 mt-2">
  {board}
  {isReplay && (
    <p className="px-2 py-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/50">
      {PRACTICE_COPY.label}
    </p>
  )}
</div>
```

Note: `pieceHint` rendering moved to hero block (Task 3). Board zone no longer renders it. Padding is `px-1` (4px). `mt-2` provides 8px gap from utility band.

- [ ] **Step 2: Rewrite the footer (Zone C) — 2 layers**

Replace the current Zone 3 footer block with:

```tsx
{/* Zone C: Footer — micro-stats + CTA merged, then dock */}
<div className="chesscito-footer shrink-0">
  {/* Layer 1: Micro-stats + CTA (merged) */}
  <div className="flex items-center justify-center gap-4 pt-2 pb-1.5">
    <span className="flex items-center gap-1 text-[10px] font-semibold text-white/35">
      <Star size={12} className="opacity-25" />
      {score}
    </span>
    <span className="text-[10px] text-white/15">&middot;</span>
    <span className="flex items-center gap-1 text-[10px] font-semibold text-white/35">
      <Timer size={12} className="opacity-25" />
      {Number(timeMs) / 1000}s
    </span>
  </div>
  <div className="px-3 pb-1.5">
    {contextualAction}
  </div>

  {/* Layer 2: Dock (navigation) */}
  {persistentDock}
</div>
```

- [ ] **Step 3: Remove the `Crosshair` import**

At the top of `mission-panel.tsx`, update the lucide import — remove `Crosshair` since the target is no longer in the footer:

```tsx
import { Star, Timer } from "lucide-react";
```

- [ ] **Step 4: Verify the full layout**

Run: `cd apps/web && pnpm dev`

Open `http://localhost:3000` on a 390px viewport. Verify:
- Board fills all available space between utility band and footer
- Footer shows micro-stats (score dot timer) in tiny muted text
- CTA button is below stats, full-width, the only bright element in footer
- Dock is below CTA, silent and muted
- No crosshair/target in footer (it's in the hero block)
- Total footer is noticeably shorter than before (2 layers not 3)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "feat: 2-layer footer + board stage (zones B/C) per game UI spec"
```

---

### Task 5: Restyle Exercise Drawer Trigger to Utility Tier

**Files:**
- Modify: `apps/web/src/components/play-hub/exercise-drawer.tsx:63-74`

The trigger button currently uses `h-11` (44px) with HUD-bar styling. It needs to shrink to utility tier.

- [ ] **Step 1: Update SheetTrigger button styles**

In `exercise-drawer.tsx`, find the `SheetTrigger` button (around line 65-73) and replace its className:

```tsx
<SheetTrigger asChild>
  <button
    type="button"
    aria-label="Exercises"
    className="flex h-6 items-center gap-1 rounded-full border border-amber-400/15 bg-transparent px-2.5 text-[10px] font-bold text-amber-400/60 transition hover:bg-amber-400/5"
  >
    <Star size={10} className="fill-amber-400 text-amber-400" />
    <span className="tabular-nums">{totalStars}/{maxStars}</span>
  </button>
</SheetTrigger>
```

Changes: `h-11` → `h-6` (24px), `border-white/10 bg-white/5` → `border-amber-400/15 bg-transparent`, `text-xs text-cyan-200/80` → `text-[10px] text-amber-400/60`, Star size `12` → `10`.

- [ ] **Step 2: Verify drawer trigger in utility band**

Run: `cd apps/web && pnpm dev`

Verify on 390px viewport:
- Stars chip is small (24px height), amber-tinted, almost invisible
- Tapping it still opens the exercise drawer sheet
- Drawer sheet content is unchanged

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/play-hub/exercise-drawer.tsx
git commit -m "style: restyle exercise drawer trigger to utility-tier chip"
```

---

### Task 6: Footer CSS Updates + Dock Opacity

**Files:**
- Modify: `apps/web/src/app/globals.css`

Update the remaining footer/dock CSS classes to match spec.

- [ ] **Step 1: Update `.chesscito-footer` class**

Find `.chesscito-footer` in globals.css and replace with:

```css
  .chesscito-footer {
    background: rgba(2, 12, 24, 0.6);
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
```

Remove `backdrop-filter`, `border-radius` and the rounded top corners if present. Footer background is flat, separated by a subtle border only.

- [ ] **Step 2: Lower dock item opacity**

Find `.chesscito-dock-item > button` and `.chesscito-dock-item > [role="button"]` and add:

```css
  .chesscito-dock-item > button,
  .chesscito-dock-item > [role="button"] {
    width: 2.75rem !important;
    height: 2.75rem !important;
    border-radius: 14px !important;
    opacity: 0.30;
    transition: opacity 0.15s;
  }

  .chesscito-dock-item > button:active,
  .chesscito-dock-item > [role="button"]:active {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(160, 205, 225, 0.15);
    opacity: 0.60;
  }
```

- [ ] **Step 3: Verify footer and dock styling**

Run: `cd apps/web && pnpm dev`

Verify on 390px viewport:
- Footer has flat dark bg with thin top border, no blur
- Dock items are visually muted (opacity 0.3)
- Tapping a dock item briefly brightens it
- Arena center link retains its teal glow

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style: update footer and dock CSS to match game UI spec"
```

---

### Task 7: CTA Button Styling

**Files:**
- Modify: `apps/web/src/app/page.tsx` (the ContextualActionSlot component, wherever it renders the CTA button)

The CTA button needs to be the only bright element in the footer: 48px, full-width, cyan gradient, rounded.

- [ ] **Step 1: Find ContextualActionSlot and update CTA styles**

Search for `ContextualActionSlot` in `apps/web/src/app/page.tsx` or its definition file. Update the primary CTA button className to:

```tsx
className="flex h-12 w-full items-center justify-center rounded-[14px] bg-gradient-to-r from-cyan-500 to-cyan-600 text-[13px] font-bold uppercase tracking-wide text-white shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all active:scale-[0.98]"
```

Key values: `h-12` (48px), `rounded-[14px]`, cyan gradient, shadow glow, uppercase text.

- [ ] **Step 2: Verify CTA rendering**

Run: `cd apps/web && pnpm dev`

Verify on 390px viewport:
- CTA is full-width, 48px tall, cyan gradient
- It's the only glowing element in the footer
- Text is uppercase, bold, readable
- Tap feedback: subtle scale down

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "style: CTA button as sole footer dominant per game UI spec"
```

---

### Task 8: Validation Variants

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx`
- Modify: `apps/web/src/app/globals.css` (if board padding changes)

Test the 4 A/B variants from the spec and lock in final values.

- [ ] **Step 1: Test hero gap — `mt-2` (8px) vs `mt-2.5` (10px)**

In mission-panel.tsx, the mission label `<div>` below the piece selector has `mt-2`. Try `mt-2.5` and compare on device. Pick the one that feels more compact without losing clarity. Update the value.

- [ ] **Step 2: Test target glow — `cyan/20%` vs `cyan/12%`**

In mission-panel.tsx, the target value `<p>` has `drop-shadow-[0_0_12px_rgba(34,211,238,0.20)]`. If the target competes visually with the hero piece glow, reduce to `drop-shadow-[0_0_12px_rgba(34,211,238,0.12)]`. Update the value.

- [ ] **Step 3: Test CTA radius — `rounded-[14px]` vs `rounded-[16px]`**

In the CTA button, try `rounded-[16px]` and compare. Pick the one that feels more premium. Update the value.

- [ ] **Step 4: Test board padding — `px-1` (4px) vs `px-1.5` (6px)**

In mission-panel.tsx, the board zone has `px-1`. Try `px-1.5` and compare. Pick the balance between edge-to-edge and breathing. Update the value.

- [ ] **Step 5: Commit final values**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx apps/web/src/app/globals.css
git commit -m "style: lock in validation variant values (gap, glow, radius, padding)"
```

---

### Task 9: Final Visual QA

No code changes — purely verification.

- [ ] **Step 1: Full play-hub flow test on 390px viewport**

1. Load `/` — verify hero selector centered, active piece at 64px with glow
2. Tap inactive piece — verify it becomes hero, previous shrinks
3. Verify mission target shows "MOVE TO / e5" below hero
4. Start exercise — verify board fills space, tutorial text replaces target in same slot
5. Complete exercise — verify phase flash, stats update
6. Check utility band: Lv, stars chip, more button all present and tiny
7. Check footer: micro-stats muted, CTA bright, dock silent

- [ ] **Step 2: Full arena coach flow test**

1. Go to `/arena`, play to completion
2. Victory screen appears — verify visible
3. Tap "Ask Coach" — victory fades out, coach shows alone
4. Close coach — victory fades back in
5. Open coach again → "Play Again" — navigates directly, no victory flash

- [ ] **Step 3: Edge cases**

1. Locked piece shows lock badge
2. Practice/replay label still shows below board
3. Exercise drawer opens from stars chip
4. All dock items work (badge, shop, arena, leaderboard, invite)

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: visual QA adjustments from final review"
```
