# Exercise Replay & Navigation Drawer — Design Spec

**Issue**: #66
**Date**: 2026-03-21
**Status**: Approved

## Problem

After completing exercises for a piece, players cannot easily replay them for practice. The current stars bar (5 tiny dots below the board) is nearly invisible and doesn't communicate that navigation is possible. Players should be able to revisit any completed exercise freely, without earning additional rewards.

## Goals

1. Make exercise navigation discoverable via a drawer/sheet panel
2. Allow replaying any completed exercise at any time
3. Show a "Practice mode" indicator during replays
4. Preserve existing reward protections (no double-counting stars, badges, or on-chain submissions)

## Non-Goals

- Visual world map (Mario-style) — tracked in #67
- Changes to scoring logic or on-chain contracts
- Adding new exercises or changing exercise order

## Design

### 1. Exercise Drawer (`ExerciseDrawer`)

A new bottom sheet component, following the same pattern as `ShopSheet`, `LeaderboardSheet`, and `BadgeSheet`.

**Trigger**: A button in the HUD zone (Zone 1 of `MissionPanel`), next to "Lv 1". Shows compact progress like `★ 9/15`. Tapping opens the drawer.

**Props interface**:
```ts
type ExerciseDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: PieceId;                    // for subtitle ("Rook", "Bishop", "Knight")
  exercises: Exercise[];             // from EXERCISES[piece]
  stars: PieceProgress["stars"];     // current stars per exercise
  activeIndex: number;               // progress.exerciseIndex
  totalStars: number;                // computed total
  onNavigate: (index: number) => void; // calls goToExercise + resetBoard
};
```

**Drawer content**:
- Title: "Exercises" with piece name subtitle (e.g., "Rook")
- List of exercises, each row showing:
  - Exercise number (1–5)
  - Type icon: derived from `exercise.isCapture` — movement (→) if falsy, capture (⚔) if true
  - Description: static mapping from exercise ID (see table below)
  - Stars earned: ★★★ / ★★☆ / ★☆☆ / not attempted
  - State indicator:
    - **Completed**: amber stars, tappable — `stars[index] > 0`
    - **Current**: cyan highlight ring, tappable — `index === activeIndex`
    - **Locked**: muted/grayed out, not tappable, shows 🔒 — `index > maxAllowed`
- Progress summary at bottom: total stars earned vs max (e.g., "9/15"), with badge threshold marker at `BADGE_THRESHOLD` (currently 10) from `lib/game/exercises.ts`

**Behavior**:
- Tapping a completed or current exercise: calls `onNavigate(index)` which closes the drawer, calls `goToExercise(index)`, and calls `resetBoard()`
- Tapping a locked exercise: no action (visually disabled)
- Navigation rule: "current" = `progress.exerciseIndex`. Allowed indices: any exercise where `stars[i] > 0`, plus `Math.min(lastCompleted + 1, EXERCISES_PER_PIECE - 1)`. This matches the existing `goToExercise` guard.

### 2. `isReplay` State

Derived boolean in `useExerciseProgress`:

```ts
isReplay = progress.stars[progress.exerciseIndex] > 0
```

Not stored — computed from existing state. True when the player navigates to an exercise they've already earned stars on.

**Hydration note**: On mount, `useExerciseProgress` initializes with `stars: [0,0,0,0,0]` (SSR-safe), then hydrates from localStorage via `useEffect`. During this tick, `isReplay` will transiently be `false`. This is the same hydration pattern used throughout the hook and is acceptable — the practice pill simply won't flash.

### 3. Practice Mode Indicator

When `isReplay === true`, show a subtle pill/badge in the board zone:
- Position: below the tutorial banner / piece hint text, above the board
- Text: "Practice mode" in cyan tint, small caps, semi-transparent
- Disappears when navigating to an unplayed exercise

### 4. Stars Bar Replacement

The current `ExerciseStarsBar` component is **removed**. The `starsBar: ReactNode` prop on `MissionPanel` is **replaced** with:
- `exerciseDrawer: ReactNode` — receives the `ExerciseDrawer` component (self-contained with trigger)
- `isReplay: boolean` — new prop for rendering the practice mode pill

Updated `MissionPanelProps`:
```ts
// Remove:
starsBar: ReactNode;
// Add:
exerciseDrawer: ReactNode;
isReplay: boolean;
```

### 5. Reward Protections

Existing code handles most replay safety. One addition needed:

- `completeExercise` uses `Math.max(prev, new)` — never overwrites a better score ✓
- `canSendOnChain` requires `!pieceCompleted` — no duplicate on-chain submissions ✓
- `badgeEarned` is derived from total stars — replaying can't inflate it ✓
- `markCompleted` is idempotent ✓
- **Badge prompt suppression** (NEW): In `handleMove` (`page.tsx`), the badge-earned prompt (`setShowBadgeEarned(true)`) fires when completing the last exercise with enough stars. On replay, this should be suppressed: add `&& !isReplay` to the badge prompt condition to avoid re-triggering the congratulations overlay.

## Components to Create

| Component | File | Purpose |
|-----------|------|---------|
| `ExerciseDrawer` | `components/play-hub/exercise-drawer.tsx` | Bottom sheet with exercise list and navigation |

## Components to Modify

| Component | File | Change |
|-----------|------|--------|
| `useExerciseProgress` | `hooks/use-exercise-progress.ts` | Expose `isReplay: boolean` (derived) |
| `MissionPanel` | `components/play-hub/mission-panel.tsx` | Replace `starsBar: ReactNode` with `exerciseDrawer: ReactNode` + `isReplay: boolean`; render practice pill |
| `PlayHubPage` | `app/page.tsx` | Replace `ExerciseStarsBar` with `ExerciseDrawer`; pass `isReplay`; add `&& !isReplay` to badge prompt; wire `onNavigate` to `goToExercise` + `resetBoard` |
| Editorial | `lib/content/editorial.ts` | Add `EXERCISE_DRAWER_COPY` and `PRACTICE_COPY` constants |

## Components to Delete

| Component | File | Reason |
|-----------|------|--------|
| `ExerciseStarsBar` | `components/play-hub/exercise-stars-bar.tsx` | Replaced by `ExerciseDrawer` |

## Exercise Descriptions

Static mapping for display in the drawer. The `isCapture` field from `Exercise` determines the type icon.

| ID | Description | Capture? |
|----|-------------|----------|
| `rook-1` | Horizontal move | No |
| `rook-2` | Vertical move | No |
| `rook-3` | Center to edge | No |
| `rook-4` | Corner capture | Yes |
| `rook-5` | Cross capture | Yes |
| `bishop-1` | Main diagonal | No |
| `bishop-2` | Anti diagonal | No |
| `bishop-3` | Short diagonal | No |
| `bishop-4` | Two-move path | No |
| `bishop-5` | Tricky route | No |
| `knight-1` | L-jump center | No |
| `knight-2` | L-jump corner | No |
| `knight-3` | Horizontal L | No |
| `knight-4` | Two jumps | No |
| `knight-5` | Long journey | No |

## UI Pattern

Follows existing sheet pattern:
```tsx
<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
  <SheetTrigger asChild>
    <button className="...">★ {totalStars}/15</button>
  </SheetTrigger>
  <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-slate-700">
    <SheetHeader>
      <SheetTitle>Exercises</SheetTitle>
      <SheetDescription>{PIECE_LABELS[piece]}</SheetDescription>
    </SheetHeader>
    {/* Exercise list rows */}
    {/* Progress summary with BADGE_THRESHOLD marker */}
  </SheetContent>
</Sheet>
```

## Testing

- Verify navigation to completed exercises works (existing `goToExercise` logic)
- Verify locked exercises cannot be selected in the drawer
- Verify `isReplay` is true only when navigating to exercises with stars > 0
- Verify practice mode pill appears/disappears correctly
- Verify scores are never downgraded on replay (`Math.max` behavior)
- Verify badge prompt does NOT re-trigger on replay of last exercise
- Verify `onNavigate` correctly calls both `goToExercise` and `resetBoard`
- Asset integrity test continues to pass
