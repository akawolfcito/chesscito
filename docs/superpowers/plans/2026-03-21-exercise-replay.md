# Exercise Replay & Navigation Drawer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow players to replay completed exercises via a discoverable drawer, with practice mode indicator and red-team bug fixes.

**Architecture:** Fix `useExerciseProgress` hook (stale closure, validation), create `ExerciseDrawer` bottom sheet following existing Sheet pattern, update `MissionPanel` props, wire navigation with timer cancellation in `PlayHubPage`.

**Tech Stack:** React 18, Next.js 14 App Router, Radix UI Sheet, node:test, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-21-exercise-replay-design.md`
**Red team:** `docs/reviews/red-team-2026-03-21.md`

---

### Task 1: Fix `useExerciseProgress` — stale closure + validation + `isReplay`

Fixes RT-1, RT-5 from red team and adds `isReplay` derivation.

**Files:**
- Modify: `apps/web/src/hooks/use-exercise-progress.ts`

- [ ] **Step 1: Fix stale `optimalMoves` closure in `completeExercise` (RT-1)**

Replace the `completeExercise` callback to derive `optimalMoves` from `prev.exerciseIndex` inside the updater:

```ts
// use-exercise-progress.ts — replace lines 66-82
const completeExercise = useCallback(
  (movesUsed: number) => {
    setProgress((prev) => {
      const exercise = EXERCISES[piece][prev.exerciseIndex];
      const stars = computeStars(movesUsed, exercise.optimalMoves);
      const newStars = [...prev.stars] as PieceProgress["stars"];
      newStars[prev.exerciseIndex] = Math.max(
        newStars[prev.exerciseIndex],
        stars
      ) as 0 | 1 | 2 | 3;

      const next: PieceProgress = { ...prev, stars: newStars };
      saveProgress(next);
      return next;
    });
  },
  [piece]
);
```

- [ ] **Step 2: Add star value validation in `loadProgress` (RT-5)**

Add per-value validation after the existing array length check:

```ts
// use-exercise-progress.ts — inside loadProgress, after line 28
const validStars = parsed.stars.every(
  (s: unknown) => typeof s === "number" && s >= 0 && s <= 3
);
if (!validStars) {
  return { piece, exerciseIndex: 0, stars: [...EMPTY_STARS] };
}
```

- [ ] **Step 3: Expose `isReplay` in the return value**

Add derived `isReplay` and return it:

```ts
// use-exercise-progress.ts — after line 64
const isReplay = progress.stars[progress.exerciseIndex] > 0;

// In the return object, add:
isReplay,
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Run existing tests**

Run: `cd apps/web && npm test`
Expected: all tests pass (server + game + og + assets)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/use-exercise-progress.ts
git commit -m "fix(progress): stale closure, star validation, expose isReplay (RT-1, RT-5)"
```

---

### Task 2: Add editorial constants

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`

- [ ] **Step 1: Add `EXERCISE_DRAWER_COPY` and `PRACTICE_COPY` constants**

Append to `editorial.ts`:

```ts
export const EXERCISE_DRAWER_COPY = {
  title: "Exercises",
  progressLabel: (earned: number, max: number) => `${earned}/${max}`,
  badgeThresholdHint: (threshold: number) => `Badge at ${threshold} stars`,
  locked: "Locked",
} as const;

export const EXERCISE_DESCRIPTIONS: Record<string, string> = {
  "rook-1": "Horizontal move",
  "rook-2": "Vertical move",
  "rook-3": "Center to edge",
  "rook-4": "Corner capture",
  "rook-5": "Cross capture",
  "bishop-1": "Main diagonal",
  "bishop-2": "Anti diagonal",
  "bishop-3": "Short diagonal",
  "bishop-4": "Two-move path",
  "bishop-5": "Tricky route",
  "knight-1": "L-jump center",
  "knight-2": "L-jump corner",
  "knight-3": "Horizontal L",
  "knight-4": "Two jumps",
  "knight-5": "Long journey",
};

export const PRACTICE_COPY = {
  label: "Practice mode",
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
git commit -m "feat(editorial): add exercise drawer and practice mode copy"
```

---

### Task 3: Create `ExerciseDrawer` component

**Files:**
- Create: `apps/web/src/components/play-hub/exercise-drawer.tsx`

- [ ] **Step 1: Create the component**

Follow the same pattern as `ShopSheet` (Radix Sheet, `open`/`onOpenChange` controlled, trigger inside component):

```tsx
import { Lock, Swords, MoveRight, Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Exercise, PieceId, PieceProgress } from "@/lib/game/types";
import { BADGE_THRESHOLD, EXERCISES_PER_PIECE } from "@/lib/game/exercises";
import {
  EXERCISE_DRAWER_COPY,
  EXERCISE_DESCRIPTIONS,
  PIECE_LABELS,
} from "@/lib/content/editorial";

type ExerciseDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: PieceId;
  exercises: Exercise[];
  stars: PieceProgress["stars"];
  activeIndex: number;
  totalStars: number;
  onNavigate: (index: number) => void;
};

function StarDisplay({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          size={12}
          className={i <= count ? "fill-amber-400 text-amber-400" : "text-slate-600"}
        />
      ))}
    </span>
  );
}

export function ExerciseDrawer({
  open,
  onOpenChange,
  piece,
  exercises,
  stars,
  activeIndex,
  totalStars,
  onNavigate,
}: ExerciseDrawerProps) {
  const maxStars = exercises.length * 3;
  const lastCompleted = stars.reduce((acc, s, i) => (s > 0 ? i : acc), -1);
  const maxAllowed = Math.min(lastCompleted + 1, EXERCISES_PER_PIECE - 1);

  function handleSelect(index: number) {
    if (index > maxAllowed) return;
    onOpenChange(false);
    onNavigate(index);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Exercises"
          className="flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-1 text-[0.65rem] font-semibold text-cyan-200/80 transition hover:bg-cyan-500/20"
        >
          <Star size={10} className="fill-amber-400 text-amber-400" />
          <span className="tabular-nums">{totalStars}/{maxStars}</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">
            {EXERCISE_DRAWER_COPY.title}
          </SheetTitle>
          <SheetDescription className="text-cyan-100/75">
            {PIECE_LABELS[piece]}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {exercises.map((exercise, index) => {
            const isActive = index === activeIndex;
            const isDone = stars[index] > 0;
            const isLocked = index > maxAllowed;
            const description = EXERCISE_DESCRIPTIONS[exercise.id] ?? `Exercise ${index + 1}`;

            return (
              <button
                key={exercise.id}
                type="button"
                disabled={isLocked}
                onClick={() => handleSelect(index)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  isActive
                    ? "bg-cyan-500/15 ring-1 ring-cyan-400/40"
                    : isDone
                      ? "bg-slate-800/40 hover:bg-slate-800/60"
                      : "bg-slate-800/20",
                  isLocked ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
              >
                {/* Exercise number */}
                <span
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isActive
                      ? "bg-cyan-500/30 text-cyan-200"
                      : isDone
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-slate-700/50 text-slate-500",
                  ].join(" ")}
                >
                  {isLocked ? <Lock size={12} /> : index + 1}
                </span>

                {/* Description + type */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isLocked ? "text-slate-500" : "text-slate-100"}`}>
                    {description}
                  </p>
                  <p className="flex items-center gap-1 text-[0.65rem] text-slate-400">
                    {exercise.isCapture ? (
                      <><Swords size={10} /> Capture</>
                    ) : (
                      <><MoveRight size={10} /> Movement</>
                    )}
                  </p>
                </div>

                {/* Stars */}
                {isDone ? (
                  <StarDisplay count={stars[index]} />
                ) : isLocked ? (
                  <span className="text-[0.6rem] text-slate-600">{EXERCISE_DRAWER_COPY.locked}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Progress summary */}
        <div className="mt-4 space-y-1.5">
          <div className="relative h-2 overflow-hidden rounded-full bg-slate-800/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
              style={{ width: `${(totalStars / maxStars) * 100}%` }}
            />
            <div
              className="absolute top-0 h-full w-0.5 bg-cyan-400/50"
              style={{ left: `${(BADGE_THRESHOLD / maxStars) * 100}%` }}
            />
          </div>
          <p className="text-center text-[0.6rem] text-cyan-100/40">
            {EXERCISE_DRAWER_COPY.badgeThresholdHint(BADGE_THRESHOLD)}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/play-hub/exercise-drawer.tsx
git commit -m "feat(drawer): create ExerciseDrawer bottom sheet component"
```

---

### Task 4: Update `MissionPanel` — replace `starsBar` with `exerciseDrawer` + `isReplay`

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx`

- [ ] **Step 1: Update `MissionPanelProps` — replace `starsBar` with `exerciseDrawer` + `isReplay`**

In the type definition, replace:
```ts
// Remove:
starsBar: ReactNode;
// Add:
exerciseDrawer: ReactNode;
isReplay: boolean;
```

- [ ] **Step 2: Update the component destructuring and rendering**

In the function signature, replace `starsBar` with `exerciseDrawer, isReplay`.

In Zone 1 (HUD bar), add the drawer trigger next to the "Lv" label:
```tsx
// Replace the Lv span and surrounding area (lines 124-126) with:
<div className="ml-auto flex items-center gap-2">
  {exerciseDrawer}
  <span className="shrink-0 text-xs text-cyan-300/70 tracking-[0.14em] uppercase">
    Lv {level}
  </span>
</div>
```

In Zone 2 (board area), replace `starsBar` with practice pill:
```tsx
// Replace line 135 (<div className="px-2">{starsBar}</div>) with:
{isReplay ? (
  <p className="px-2 py-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/50">
    {PRACTICE_COPY.label}
  </p>
) : null}
```

Add import for `PRACTICE_COPY`:
```ts
import { PHASE_FLASH_COPY, PRACTICE_COPY } from "@/lib/content/editorial";
```

- [ ] **Step 3: Commit (typecheck will break until Task 5 updates page.tsx — do NOT push yet)**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "refactor(mission-panel): replace starsBar with exerciseDrawer + isReplay"
```

---

### Task 5: Wire everything in `PlayHubPage` + red team fixes

Fixes RT-2, RT-3, RT-4, RT-6, badge prompt suppression.

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Update imports and state**

Remove line 15: `import { ExerciseStarsBar } from "@/components/play-hub/exercise-stars-bar";`

Add new imports:
```ts
import { ExerciseDrawer } from "@/components/play-hub/exercise-drawer";
import { EXERCISES } from "@/lib/game/exercises";
```

Add state for drawer (after existing `useState` declarations):
```ts
const [exerciseDrawerOpen, setExerciseDrawerOpen] = useState(false);
```

- [ ] **Step 2: Add `handleExerciseNavigate` function (RT-2, RT-3)**

Add after `handleUseShield`:
```ts
function handleExerciseNavigate(index: number) {
  if (autoResetTimer.current) clearTimeout(autoResetTimer.current);
  goToExercise(index);
  resetBoard();
}
```

- [ ] **Step 3: Fix `handleMove` — badge prompt suppression + unify star computation (RT-4)**

`isReplay` is already destructured from the hook in Step 5.

In `handleMove` (around lines 419-428), **replace the entire `if (isLastExercise)` block** — remove the old `computeStars(movesCount, currentExercise.optimalMoves)` line and replace with:
```ts
// Replace lines 419-428 entirely:
if (isLastExercise && !isReplay) {
  const exercise = EXERCISES[selectedPiece][progress.exerciseIndex];
  const newStars = computeStars(movesCount, exercise.optimalMoves);
  const prevStarValue = progress.stars[progress.exerciseIndex];
  const starDelta = Math.max(0, newStars - prevStarValue);
  const newTotal = totalStars + starDelta;

  if (newTotal >= BADGE_THRESHOLD && !hasClaimedBadge) {
    setShowBadgeEarned(true);
    return;
  }
}
```

Note: `BADGE_THRESHOLD` is already imported on line 46 from `@/lib/game/exercises`.

- [ ] **Step 4: Clean dead code in `handleBadgeEarnedDismiss` (RT-6)**

Replace `handleBadgeEarnedDismiss`:
```ts
function handleBadgeEarnedDismiss() {
  setShowBadgeEarned(false);
  autoResetTimer.current = setTimeout(() => {
    if (nextPiece && pieceCompleted) {
      setSelectedPiece(nextPiece);
      resetBoard();
    } else {
      resetBoard();
    }
  }, 500);
}
```

- [ ] **Step 5: Replace `ExerciseStarsBar` with `ExerciseDrawer` in the JSX**

In the `MissionPanel` props, replace `starsBar={...}` with:
```tsx
exerciseDrawer={
  <ExerciseDrawer
    open={exerciseDrawerOpen}
    onOpenChange={setExerciseDrawerOpen}
    piece={selectedPiece}
    exercises={EXERCISES[selectedPiece]}
    stars={progress.stars}
    activeIndex={progress.exerciseIndex}
    totalStars={totalStars}
    onNavigate={handleExerciseNavigate}
  />
}
isReplay={isReplay}
```

Add `isReplay` to the hook destructuring:
```ts
const {
  progress,
  currentExercise,
  isLastExercise,
  totalStars,
  badgeEarned,
  pieceCompleted,
  isReplay,       // NEW
  completeExercise,
  advanceExercise,
  goToExercise,
  markCompleted,
} = useExerciseProgress(selectedPiece);
```

- [ ] **Step 6: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Run all tests**

Run: `cd apps/web && npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(replay): wire ExerciseDrawer, fix timer/badge/star bugs (RT-2,3,4,6)"
```

---

### Task 6: Delete `ExerciseStarsBar`

**Files:**
- Delete: `apps/web/src/components/play-hub/exercise-stars-bar.tsx`

- [ ] **Step 1: Delete the file with `git rm`**

```bash
git rm apps/web/src/components/play-hub/exercise-stars-bar.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "exercise-stars-bar\|ExerciseStarsBar" apps/web/src/`
Expected: no matches

- [ ] **Step 3: Verify typecheck + tests**

Run: `cd apps/web && npx tsc --noEmit && npm test`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete ExerciseStarsBar (replaced by ExerciseDrawer)"
```

---

### Task 7: Final verification + build

- [ ] **Step 1: Run full test suite**

Run: `cd apps/web && npm test`
Expected: all tests pass (server + game + og + assets)

- [ ] **Step 2: Build the app**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: build succeeds

- [ ] **Step 3: Push all commits**

```bash
git push -u origin main
```
