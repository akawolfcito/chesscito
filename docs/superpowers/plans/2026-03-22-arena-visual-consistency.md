# Arena Visual Consistency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Arena screen with the Play Hub's design language — same world, same material tokens, same interaction patterns.

**Architecture:** Five CSS/component changes: (1) swap background art, (2) move resign to HUD bar, (3) frosted circle back buttons, (4) frosted container for difficulty selector, (5) normalize lose-state + promotion overlay tokens.

**Tech Stack:** Tailwind CSS, Lucide React, Next.js 14 App Router

---

### Task 1: Swap Arena background to Play Hub world art

Replace the badge hall background with the game background used everywhere else. Increase overlay opacity from 0.62 to 0.72 for readability over the busier art.

**Files:**
- Modify: `apps/web/src/app/globals.css:390-418`

- [ ] **Step 1: Change `.arena-bg::before` background-image**

In `globals.css`, replace lines 401-404:

```css
/* BEFORE */
background-image: image-set(
  url("/art/bg-badges-chesscito.avif") type("image/avif"),
  url("/art/bg-badges-chesscito.webp") type("image/webp"),
  url("/art/bg-badges-chesscito.png") type("image/png")
);

/* AFTER */
background-image: var(--playhub-game-bg);
```

- [ ] **Step 2: Update overlay opacity**

In `.arena-bg::after`, change:
```css
/* BEFORE */
background: rgba(6, 14, 24, 0.62);

/* AFTER */
background: rgba(6, 14, 24, 0.72);
```

- [ ] **Step 3: Update CSS comment**

Change the section comment from `/* ── Arena background (badges hall) ── */` to `/* ── Arena background ── */`.

- [ ] **Step 4: Verify visually**

Run: `pnpm --filter web dev`
Open `http://localhost:3000/arena` — confirm the Play Hub forest background shows through the darker overlay.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style(arena): swap background to Play Hub world art (#62)"
```

---

### Task 2: Move resign button into HUD bar

Remove the standalone resign bar below the board. Add resign as a compact icon button on the right side of `ArenaHud`. Apply visual hierarchy: back = neutral (`text-white/70`), resign = low-emphasis destructive (`text-white/35`).

**Files:**
- Modify: `apps/web/src/components/arena/arena-hud.tsx`
- Modify: `apps/web/src/app/arena/page.tsx:288-338`

- [ ] **Step 1: Add `onResign` prop and resign button to ArenaHud**

Replace the full content of `arena-hud.tsx`:

```tsx
"use client";

import { ArrowLeft, Brain, Flag } from "lucide-react";
import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaDifficulty } from "@/lib/game/types";

type Props = {
  difficulty: ArenaDifficulty;
  isThinking: boolean;
  onBack: () => void;
  onResign?: () => void;
  isEndState?: boolean;
};

const DOT_COLOR: Record<ArenaDifficulty, string> = {
  easy: "bg-emerald-400",
  medium: "bg-amber-400",
  hard: "bg-rose-400",
};

export function ArenaHud({ difficulty, isThinking, onBack, onResign, isEndState }: Props) {
  return (
    <div className="hud-bar mx-2 mt-2 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:text-white"
        aria-label={ARENA_COPY.backToHub}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${DOT_COLOR[difficulty]}`} />
        <span className="font-semibold uppercase tracking-widest text-xs text-white/80">
          {ARENA_COPY.difficulty[difficulty]}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isThinking && (
          <span className="flex items-center gap-1.5 animate-pulse text-amber-300/90 tracking-wide text-xs">
            <Brain className="h-3.5 w-3.5" />
            {ARENA_COPY.aiThinking}
          </span>
        )}
        {onResign && !isEndState && (
          <button
            type="button"
            onClick={onResign}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/35 transition-colors hover:text-rose-400"
            aria-label={ARENA_COPY.resign}
          >
            <Flag className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update arena page — pass onResign, remove standalone bar**

In `apps/web/src/app/arena/page.tsx`, update the `ArenaHud` usage (around line 292):

```tsx
<ArenaHud
  difficulty={game.difficulty}
  isThinking={game.isThinking}
  onBack={game.reset}
  onResign={game.resign}
  isEndState={isEndState}
/>
```

Then remove the standalone actions bar (lines 328-338):
```tsx
// DELETE this entire block:
{!isEndState && !game.errorMessage && (
  <div className="flex items-center justify-center px-4 py-3">
    <button ... >
      <Flag size={14} ... /> {ARENA_COPY.resign}
    </button>
  </div>
)}
```

Also remove the `Flag` import from arena page since it's no longer used there.

- [ ] **Step 3: Verify**

Run: `pnpm --filter web dev`
Open Arena, start a game — confirm resign icon appears in HUD bar (right side), no button below the board.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/arena/arena-hud.tsx apps/web/src/app/arena/page.tsx
git commit -m "style(arena): move resign to HUD bar, frosted back button (#62)"
```

---

### Task 3: Frosted container for difficulty selector

Wrap the selector content in a frosted glass card. Update the back link to use the frosted circle pattern.

**Files:**
- Modify: `apps/web/src/components/arena/difficulty-selector.tsx`

- [ ] **Step 1: Update DifficultySelector**

Replace the full content of `difficulty-selector.tsx`:

```tsx
"use client";

import { ArrowLeft, Play } from "lucide-react";
import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaDifficulty } from "@/lib/game/types";

type Props = {
  selected: ArenaDifficulty;
  onSelect: (d: ArenaDifficulty) => void;
  onStart: () => void;
  onBack: () => void;
};

const LEVELS: { key: ArenaDifficulty; dot: string }[] = [
  { key: "easy", dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" },
  { key: "medium", dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" },
  { key: "hard", dot: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]" },
];

export function DifficultySelector({ selected, onSelect, onStart, onBack }: Props) {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-8">
      <div className="w-full max-w-[320px] rounded-3xl border border-white/[0.08] bg-[#0a1424]/92 px-6 pb-6 pt-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(20,184,166,0.08)]">
        <div className="flex flex-col items-center gap-2 mb-5">
          <h1 className="fantasy-title text-3xl font-bold text-white drop-shadow-[0_0_12px_rgba(103,232,249,0.3)]">
            {ARENA_COPY.title}
          </h1>
          <p className="text-sm text-cyan-200/50">{ARENA_COPY.subtitle}</p>
        </div>

        <div className="flex flex-col gap-2.5 mb-4">
          {LEVELS.map(({ key, dot }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={[
                "flex items-center gap-3.5 rounded-2xl px-5 py-3.5 text-left transition-all",
                selected === key
                  ? "bg-white/12 ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(103,232,249,0.1)]"
                  : "bg-white/5 hover:bg-white/8",
              ].join(" ")}
            >
              <span className={`h-3 w-3 shrink-0 rounded-full ${dot}`} />
              <div>
                <span className="font-semibold text-white">
                  {ARENA_COPY.difficulty[key]}
                </span>
                <p className="text-xs text-white/45 leading-relaxed">
                  {ARENA_COPY.difficultyDesc[key]}
                </p>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 py-3.5 font-bold text-white shadow-[0_0_24px_rgba(34,211,238,0.25)] transition-all hover:shadow-[0_0_32px_rgba(34,211,238,0.4)] active:scale-[0.97]"
        >
          <Play size={18} className="inline -mt-0.5" fill="currentColor" /> {ARENA_COPY.startMatch}
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-white/35 transition-colors hover:text-white/55"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ArrowLeft className="h-3.5 w-3.5" />
        </span>
        {ARENA_COPY.backToHub}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update arena page to pass onBack to DifficultySelector**

In `apps/web/src/app/arena/page.tsx`, update the difficulty selector rendering (around line 274):

```tsx
<DifficultySelector
  selected={game.difficulty}
  onSelect={game.setDifficulty}
  onStart={game.startGame}
  onBack={handleBackToHub}
/>
```

- [ ] **Step 3: Verify visually**

Open Arena at `http://localhost:3000/arena` — difficulty selector should appear inside a frosted glass card with the forest background visible behind it.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/arena/difficulty-selector.tsx apps/web/src/app/arena/page.tsx
git commit -m "style(arena): frosted container for difficulty selector (#62)"
```

---

### Task 4: Normalize lose-state card tokens

The lose-state card in `arena-end-state.tsx` uses slightly different tokens. Normalize to match the shared frosted panel pattern.

**Files:**
- Modify: `apps/web/src/components/arena/arena-end-state.tsx:117`

- [ ] **Step 1: Update lose-state card classes**

In `arena-end-state.tsx`, line 117, replace:

```tsx
// BEFORE
<div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-[#0b1628]/90 px-8 py-8 backdrop-blur-xl shadow-[0_0_40px_rgba(251,113,133,0.1)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

// AFTER
<div className="flex flex-col items-center gap-6 rounded-3xl border border-white/[0.08] bg-[#0a1424]/92 px-8 py-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(251,113,133,0.08)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
```

Changes: `border-white/10` → `border-white/[0.08]`, `bg-[#0b1628]/90` → `bg-[#0a1424]/92`, `backdrop-blur-xl` → `backdrop-blur-2xl`, shadow intensity normalized.

**Audit note:** `victory-celebration.tsx`, `victory-claiming.tsx`, `victory-claim-success.tsx`, and `victory-claim-error.tsx` were verified and already use the canonical frosted tokens — no changes needed.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/arena/arena-end-state.tsx
git commit -m "style(arena): normalize lose-state card to shared frosted tokens (#62)"
```

---

### Task 5: Normalize promotion overlay

Apply frosted compact treatment (same material, `rounded-2xl` not `rounded-3xl`) to the promotion piece picker.

**Files:**
- Modify: `apps/web/src/components/arena/promotion-overlay.tsx:35`

- [ ] **Step 1: Update promotion overlay container**

In `promotion-overlay.tsx`, line 35, replace:

```tsx
// BEFORE
className="flex flex-col items-center gap-3 rounded-2xl bg-slate-800/95 p-5"

// AFTER
className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0a1424]/92 p-5 backdrop-blur-2xl"
```

- [ ] **Step 2: Verify visually**

Start a game, advance a pawn to the last rank — promotion overlay should appear with the frosted glass treatment, consistent with the rest of the Arena.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/arena/promotion-overlay.tsx
git commit -m "style(arena): frosted compact treatment for promotion overlay (#62)"
```

---

### Task 6: Final build verification

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 2: Full build**

Run: `pnpm --filter web build`
Expected: build succeeds.

- [ ] **Step 3: Visual smoke test at 390px viewport**

Open Arena in Chrome DevTools at 390px width. Walk through:
1. Difficulty selector — frosted card visible
2. Start game — resign icon in HUD bar, no button below board
3. Board — no visual changes
4. End game — lose-state card with normalized tokens

- [ ] **Step 4: Push**

```bash
git push origin main
```
