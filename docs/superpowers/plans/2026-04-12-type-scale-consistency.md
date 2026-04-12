# Type Scale Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all 9 arbitrary text sizes and unify to a coherent type scale with one new custom token (`text-nano`).

**Architecture:** Pure CSS class replacements across ~18 component files + 1 Tailwind config change + 1 design system doc update. No logic, state, or behavior changes.

**Tech Stack:** Tailwind CSS, Next.js TSX components

**Spec:** `docs/superpowers/specs/2026-04-12-type-scale-consistency-design.md`

---

### Task 1: Add `text-nano` token to Tailwind config

**Files:**
- Modify: `apps/web/tailwind.config.js:20-78` (inside `theme.extend`)

- [ ] **Step 1: Add fontSize extension**

In `apps/web/tailwind.config.js`, add `fontSize` inside `theme.extend` (after the `colors` block):

```js
fontSize: {
  nano: ['0.5rem', { lineHeight: '0.75rem' }],
},
```

- [ ] **Step 2: Verify config is valid**

Run: `cd apps/web && npx tailwindcss --help > /dev/null 2>&1 && echo "OK"`
Expected: OK (no parse errors)

- [ ] **Step 3: Commit**

```bash
git add apps/web/tailwind.config.js
git commit -m "style: add text-nano token to Tailwind config (#91)"
```

---

### Task 2: Replace `text-[7px]` and `text-[8px]` with `text-nano`

**Files:**
- Modify: `apps/web/src/components/play-hub/persistent-dock.tsx:36`
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:217,229`

- [ ] **Step 1: Replace in persistent-dock.tsx**

Line 36: change `text-[7px]` → `text-nano`

```tsx
// Before
<span className="game-label text-[7px] font-bold uppercase tracking-[0.12em]">
// After
<span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
```

- [ ] **Step 2: Replace in mission-panel.tsx**

Line 217: change `text-[8px]` → `text-nano`

```tsx
// Before
className="text-[8px] font-extrabold uppercase tracking-[0.15em] text-[var(--warm-label-text)]"
// After
className="text-nano font-extrabold uppercase tracking-[0.15em] text-[var(--warm-label-text)]"
```

Line 229: change `text-[7px]` → `text-nano`

```tsx
// Before
<span className="text-[7px] font-bold uppercase tracking-[0.12em] text-white/35">
// After
<span className="text-nano font-bold uppercase tracking-[0.12em] text-white/35">
```

- [ ] **Step 3: Verify no `text-[7px]` or `text-[8px]` remain**

Run: `grep -rn 'text-\[7px\]\|text-\[8px\]' apps/web/src/`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/play-hub/persistent-dock.tsx apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "style: replace text-[7px] and text-[8px] with text-nano (#91)"
```

---

### Task 3: Replace `text-[10px]` with `text-xs`

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:150`
- Modify: `apps/web/src/components/play-hub/shop-sheet.tsx:62`
- Modify: `apps/web/src/components/play-hub/badge-sheet.tsx:78`
- Modify: `apps/web/src/components/play-hub/exercise-drawer.tsx:69`
- Modify: `apps/web/src/components/trophies/trophy-card.tsx:97,101,102,117,134`

- [ ] **Step 1: Replace in mission-panel.tsx**

Line 150: change `text-[10px]` → `text-xs`

```tsx
// Before
<p className="game-label text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-400/85">
// After
<p className="game-label text-xs font-bold uppercase tracking-[0.14em] text-cyan-400/85">
```

- [ ] **Step 2: Replace in shop-sheet.tsx**

Line 62: change `text-[10px]` → `text-xs`

```tsx
// Before
text-[10px] font-bold uppercase tracking-widest
// After
text-xs font-bold uppercase tracking-widest
```

- [ ] **Step 3: Replace in badge-sheet.tsx**

Line 78: change `text-[10px]` → `text-xs`

```tsx
// Before
text-[10px] font-bold text-white
// After
text-xs font-bold text-white
```

- [ ] **Step 4: Replace in exercise-drawer.tsx**

Line 69: change `text-[10px]` → `text-xs`

```tsx
// Before
text-[10px] font-bold text-[rgba(220,200,140,0.85)]
// After
text-xs font-bold text-[rgba(220,200,140,0.85)]
```

- [ ] **Step 5: Replace all 5 occurrences in trophy-card.tsx**

Lines 97, 101, 102, 117, 134: change all `text-[10px]` → `text-xs`

Use find-and-replace across the file: `text-[10px]` → `text-xs` (all occurrences).

- [ ] **Step 6: Verify no `text-[10px]` remains**

Run: `grep -rn 'text-\[10px\]' apps/web/src/`
Expected: no output

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx apps/web/src/components/play-hub/shop-sheet.tsx apps/web/src/components/play-hub/badge-sheet.tsx apps/web/src/components/play-hub/exercise-drawer.tsx apps/web/src/components/trophies/trophy-card.tsx
git commit -m "style: replace text-[10px] with text-xs (#91)"
```

---

### Task 4: Replace `text-[11px]` with `text-xs`

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:158`
- Modify: `apps/web/src/components/play-hub/mission-briefing.tsx:70,85`
- Modify: `apps/web/src/components/play-hub/badge-sheet.tsx:252`

- [ ] **Step 1: Replace in mission-panel.tsx**

Line 158: change `text-[11px]` → `text-xs`

```tsx
// Before
className="mission-typewriter text-[11px] text-cyan-100/55"
// After
className="mission-typewriter text-xs text-cyan-100/55"
```

- [ ] **Step 2: Replace in mission-briefing.tsx**

Line 70: change `text-[11px]` → `text-xs`

```tsx
// Before
<p className="mt-1.5 text-center text-[11px] text-cyan-100/45">
// After
<p className="mt-1.5 text-center text-xs text-cyan-100/45">
```

Line 85: change `text-[11px]` → `text-xs`

```tsx
// Before
className="mt-3 block text-center text-[11px] text-cyan-300/50 underline underline-offset-4 transition-colors hover:text-cyan-200/70"
// After
className="mt-3 block text-center text-xs text-cyan-300/50 underline underline-offset-4 transition-colors hover:text-cyan-200/70"
```

- [ ] **Step 3: Replace in badge-sheet.tsx**

Line 252: change `text-[11px]` → `text-xs`

```tsx
// Before
className="mt-3 block text-center text-[11px] text-cyan-300/40 transition-colors hover:text-cyan-200/60"
// After
className="mt-3 block text-center text-xs text-cyan-300/40 transition-colors hover:text-cyan-200/60"
```

- [ ] **Step 4: Verify no `text-[11px]` remains**

Run: `grep -rn 'text-\[11px\]' apps/web/src/`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx apps/web/src/components/play-hub/mission-briefing.tsx apps/web/src/components/play-hub/badge-sheet.tsx
git commit -m "style: replace text-[11px] with text-xs (#91)"
```

---

### Task 5: Replace `text-[15px]`, `text-[20px]`, `text-[0.7rem]` in mission-panel

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:153,210,248`

- [ ] **Step 1: Replace text-[15px] → text-sm**

Line 153:

```tsx
// Before
<p key={targetLabel} className="mission-typewriter text-[15px] font-bold text-slate-50">
// After
<p key={targetLabel} className="mission-typewriter text-sm font-bold text-slate-50">
```

- [ ] **Step 2: Replace text-[20px] → text-lg**

Line 210:

```tsx
// Before
fallback.className = "text-[20px] leading-none text-slate-400";
// After
fallback.className = "text-lg leading-none text-slate-400";
```

- [ ] **Step 3: Replace text-[0.7rem] → text-xs**

Line 248:

```tsx
// Before
<p className="px-2 py-1 text-center text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/50">
// After
<p className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400/50">
```

- [ ] **Step 4: Verify no `text-[15px]`, `text-[20px]`, `text-[0.7rem]` remain**

Run: `grep -rn 'text-\[15px\]\|text-\[20px\]\|text-\[0\.7rem\]' apps/web/src/`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "style: replace text-[15px], text-[20px], text-[0.7rem] in mission-panel (#91)"
```

---

### Task 6: Replace `text-[0.6rem]` with `text-xs`

**Files:**
- Modify: `apps/web/src/components/arena/stat-card.tsx:14`
- Modify: `apps/web/src/components/arena/victory-claiming.tsx:88`
- Modify: `apps/web/src/components/play-hub/badge-sheet.tsx:103`
- Modify: `apps/web/src/components/play-hub/exercise-drawer.tsx:141,160`
- Modify: `apps/web/src/components/play-hub/invite-button.tsx:40`
- Modify: `apps/web/src/components/coach/coach-history.tsx:67,71`
- Modify: `apps/web/src/components/coach/ask-coach-button.tsx:23`
- Modify: `apps/web/src/components/coach/coach-paywall.tsx:52`

- [ ] **Step 1: Replace all `text-[0.6rem]` → `text-xs` across all files**

Use find-and-replace in each file. Change `text-[0.6rem]` → `text-xs` in every occurrence.

All 10 occurrences across 8 files:
- `stat-card.tsx:14` — 1 occurrence
- `victory-claiming.tsx:88` — 1 occurrence
- `badge-sheet.tsx:103` — 1 occurrence
- `exercise-drawer.tsx:141,160` — 2 occurrences
- `invite-button.tsx:40` — 1 occurrence
- `coach-history.tsx:67,71` — 2 occurrences
- `ask-coach-button.tsx:23` — 1 occurrence
- `coach-paywall.tsx:52` — 1 occurrence

- [ ] **Step 2: Verify no `text-[0.6rem]` remains**

Run: `grep -rn 'text-\[0\.6rem\]' apps/web/src/`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/arena/stat-card.tsx apps/web/src/components/arena/victory-claiming.tsx apps/web/src/components/play-hub/badge-sheet.tsx apps/web/src/components/play-hub/exercise-drawer.tsx apps/web/src/components/play-hub/invite-button.tsx apps/web/src/components/coach/coach-history.tsx apps/web/src/components/coach/ask-coach-button.tsx apps/web/src/components/coach/coach-paywall.tsx
git commit -m "style: replace text-[0.6rem] with text-xs (#91)"
```

---

### Task 7: Replace `text-[0.65rem]` with `text-xs`

**Files:**
- Modify: `apps/web/src/components/coach/coach-welcome.tsx:46`
- Modify: `apps/web/src/components/coach/coach-paywall.tsx:63`
- Modify: `apps/web/src/components/play-hub/badge-sheet.tsx:108`
- Modify: `apps/web/src/components/play-hub/exercise-drawer.tsx:128`
- Modify: `apps/web/src/components/play-hub/result-overlay.tsx:284,366,463`
- Modify: `apps/web/src/components/arena/victory-claiming.tsx:110`

- [ ] **Step 1: Replace all `text-[0.65rem]` → `text-xs` across all files**

Use find-and-replace in each file. Change `text-[0.65rem]` → `text-xs` in every occurrence.

All 8 occurrences across 6 files:
- `coach-welcome.tsx:46` — 1 occurrence
- `coach-paywall.tsx:63` — 1 occurrence
- `badge-sheet.tsx:108` — 1 occurrence
- `exercise-drawer.tsx:128` — 1 occurrence
- `result-overlay.tsx:284,366,463` — 3 occurrences
- `victory-claiming.tsx:110` — 1 occurrence

- [ ] **Step 2: Verify no `text-[0.65rem]` remains**

Run: `grep -rn 'text-\[0\.65rem\]' apps/web/src/`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/coach/coach-welcome.tsx apps/web/src/components/coach/coach-paywall.tsx apps/web/src/components/play-hub/badge-sheet.tsx apps/web/src/components/play-hub/exercise-drawer.tsx apps/web/src/components/play-hub/result-overlay.tsx apps/web/src/components/arena/victory-claiming.tsx
git commit -m "style: replace text-[0.65rem] with text-xs (#91)"
```

---

### Task 8: Victory titles, tracking, and inline style cleanup

**Files:**
- Modify: `apps/web/src/components/arena/victory-claim-success.tsx:78`
- Modify: `apps/web/src/app/victory/[id]/page.tsx:102`
- Modify: `apps/web/src/components/play-hub/leaderboard-sheet.tsx:141`
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:217-218`

- [ ] **Step 1: Victory title — victory-claim-success.tsx**

Line 78: change `text-2xl` → `text-3xl`

```tsx
// Before
<h2 className="fantasy-title mb-1 text-2xl font-bold text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.35)]">
// After
<h2 className="fantasy-title mb-1 text-3xl font-bold text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.35)]">
```

- [ ] **Step 2: Victory title — victory/[id]/page.tsx**

Line 102: change `text-2xl` → `text-3xl`

```tsx
// Before
<h1 className="fantasy-title mb-2 text-2xl font-bold text-emerald-300/90 drop-shadow-[0_0_12px_rgba(20,184,166,0.35)]">
// After
<h1 className="fantasy-title mb-2 text-3xl font-bold text-emerald-300/90 drop-shadow-[0_0_12px_rgba(20,184,166,0.35)]">
```

- [ ] **Step 3: Tracking — leaderboard-sheet.tsx**

Line 141: change `tracking-wide` → `tracking-widest`

```tsx
// Before
<div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-cyan-100/50">
// After
<div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 pb-1 text-xs font-medium uppercase tracking-widest text-cyan-100/50">
```

- [ ] **Step 4: Inline fontFamily — mission-panel.tsx**

Lines 217-218: replace inline `fontFamily` with `fantasy-title` class.

```tsx
// Before
<span
  className="text-nano font-extrabold uppercase tracking-[0.15em] text-[var(--warm-label-text)]"
  style={{ fontFamily: "var(--font-game-display)", textShadow: "var(--text-shadow-label)" }}
>
// After
<span
  className="fantasy-title text-nano font-extrabold uppercase tracking-[0.15em] text-[var(--warm-label-text)]"
  style={{ textShadow: "var(--text-shadow-label)" }}
>
```

Note: `text-nano` from Task 2. The `textShadow` inline stays because it uses a CSS token and has no class equivalent.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/arena/victory-claim-success.tsx apps/web/src/app/victory/\[id\]/page.tsx apps/web/src/components/play-hub/leaderboard-sheet.tsx apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "style: unify victory titles to text-3xl, fix tracking and inline font (#91)"
```

---

### Task 9: Update DESIGN_SYSTEM.md

**Files:**
- Modify: `DESIGN_SYSTEM.md:39-46`

- [ ] **Step 1: Replace typography table**

Replace the current Typography section (lines 39-46):

```markdown
## 2. Typography

| Level | Pattern |
|---|---|
| Hero title | `fantasy-title text-3xl font-bold` |
| Page title | `fantasy-title text-xl font-bold` |
| Section header | `text-xs font-semibold uppercase tracking-widest` |
| Body | `text-sm` |
| Caption / label | `text-xs` |
| Micro label | `text-nano font-bold uppercase` |

**Rule:** No arbitrary `text-[Xpx]` values. Use the scale above. If a new size is genuinely needed, add it as a named token in `tailwind.config.js` first.
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN_SYSTEM.md
git commit -m "docs: update typography section in design system (#91)"
```

---

### Task 10: Final verification and type-check

- [ ] **Step 1: Grep for any remaining arbitrary text sizes**

Run: `grep -rn 'text-\[\d\+px\]\|text-\[0\.\d\+rem\]' apps/web/src/`

Expected: no output (zero arbitrary text sizes remaining).

If any remain, go back and fix them per the mapping table in the spec.

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Final commit (if any fixups needed)**

If step 1 found stragglers, commit the fixes:

```bash
git add -A
git commit -m "style: fix remaining arbitrary text sizes (#91)"
```
