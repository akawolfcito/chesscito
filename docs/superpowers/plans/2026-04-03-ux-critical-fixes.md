# UX Critical Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 critical UX findings: score label, globalTotal confusion, victory page context, claim navigation safety, and 2 hardcoded design tokens.

**Architecture:** 6 independent surgical fixes across editorial.ts (copy), mission-panel (HUD), result-overlay (post-submit), victory page (share), victory-claiming (safety), trophies (tokens). Each fix can be committed independently.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, CSS custom properties.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `apps/web/src/lib/content/editorial.ts` | Add `SCORE_UNIT`, remove `globalTotalLabel`, add `tagline`, add `claimingInProgress` |
| Modify | `apps/web/src/components/play-hub/mission-panel.tsx` | Add "pts" label to score display |
| Modify | `apps/web/src/components/play-hub/result-overlay.tsx` | Remove globalTotal rendering + prop |
| Modify | `apps/web/src/app/page.tsx` | Remove globalTotal computation + passing |
| Modify | `apps/web/src/app/victory/[id]/page.tsx` | Add tagline for share context |
| Modify | `apps/web/src/components/arena/victory-claiming.tsx` | Disable back button during claim |
| Modify | `apps/web/src/app/trophies/page.tsx` | Replace hardcoded `#0a2a3f` with token |
| Modify | `apps/web/src/components/trophies/trophy-card.tsx` | Replace inline gradient with CSS var |
| Modify | `apps/web/src/app/globals.css` | Add `--trophy-card-bg` token |

---

### Task 1: Score label + editorial copy updates

All editorial.ts changes in one task to avoid multiple edits to the same file.

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:134-137`

- [ ] **Step 1: Add SCORE_UNIT, tagline, and claimingInProgress to editorial.ts**

In `apps/web/src/lib/content/editorial.ts`, add after the existing exports (e.g., after line 64, before `RESULT_OVERLAY_COPY`):

```ts
export const SCORE_UNIT = "pts";
```

In `VICTORY_PAGE_COPY` (line 256), add `tagline`:

```ts
export const VICTORY_PAGE_COPY = {
  tagline: "Learn chess moves, earn on-chain — a Celo MiniPay game",
  challengeLine: "Can you beat this?",
  acceptChallenge: "Accept Challenge",
  backToHub: "Back to Hub",
  metaCheckmate: (moves: number) => `Checkmate in ${moves} moves`,
  metaChallenge: (id: string) => `Can you beat that? Victory #${id} claimed onchain.`,
  metaFallback: "Can you beat this? Play Chesscito on Celo.",
} as const;
```

Find `VICTORY_CLAIM_COPY` and add `claimingInProgress`:

Search for `VICTORY_CLAIM_COPY` in editorial.ts. Add:
```ts
claimingInProgress: "Claiming in progress...",
```

Remove `globalTotalLabel` from `RESULT_OVERLAY_COPY.score` (line 73):

```ts
// Before
score: {
  title: "Score Recorded!",
  subtitle: "Your score is now recorded on the blockchain.",
  globalTotalLabel: (total: number) => `Total: ${total.toLocaleString()} pts`,
},

// After
score: {
  title: "Score Recorded!",
  subtitle: "Your score is now recorded on the blockchain.",
},
```

- [ ] **Step 2: Add "pts" label to mission-panel.tsx**

In `apps/web/src/components/play-hub/mission-panel.tsx`, add the import at the top:

```ts
import { SCORE_UNIT } from "@/lib/content/editorial";
```

Then change line 136 from:

```tsx
{score}
```

To:

```tsx
{score} <span className="text-white/40">{SCORE_UNIT}</span>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npm run test`

Expected: All tests pass. No tests directly reference `globalTotalLabel` or `SCORE_UNIT`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "fix(ux): add score unit label, tagline, claiming copy, remove globalTotalLabel

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2: Remove globalTotal from result overlay and page.tsx

**Files:**
- Modify: `apps/web/src/components/play-hub/result-overlay.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Remove globalTotal from ResultOverlayProps**

In `apps/web/src/components/play-hub/result-overlay.tsx`, remove line 23:

```ts
// Remove this line:
globalTotal?: number;
```

The Props type becomes:

```ts
type ResultOverlayProps = {
  variant: Variant;
  pieceType?: PieceKey;
  itemLabel?: string;
  txHash?: string;
  celoscanHref?: string;
  errorMessage?: string;
  onDismiss: () => void;
  onRetry?: () => void;
  totalStars?: number;
};
```

- [ ] **Step 2: Remove globalTotal rendering block**

In the same file, remove lines 229-234:

```tsx
// Remove this entire block:
{/* Global total (score variant only) */}
{!isError && variant === "score" && globalTotal != null && globalTotal > 0 ? (
  <p className="text-sm font-semibold text-cyan-100/60">
    {RESULT_OVERLAY_COPY.score.globalTotalLabel(globalTotal)}
  </p>
) : null}
```

Also remove `globalTotal` from the function parameter destructuring (search for where props are destructured — it should be in the component function signature).

- [ ] **Step 3: Remove globalTotal from page.tsx (4 locations)**

In `apps/web/src/app/page.tsx`:

**Location 1 — State type (line 134):** Remove `globalTotal?: number;` from the `resultOverlay` state type:

```ts
// Before
const [resultOverlay, setResultOverlay] = useState<{
  variant: "badge" | "score" | "shop" | "error";
  txHash?: string;
  errorMessage?: string;
  retryAction?: () => void;
  globalTotal?: number;
} | null>(null);

// After
const [resultOverlay, setResultOverlay] = useState<{
  variant: "badge" | "score" | "shop" | "error";
  txHash?: string;
  errorMessage?: string;
  retryAction?: () => void;
} | null>(null);
```

**Location 2 — useMemo computation (lines 232-247):** Remove the entire `globalTotal` useMemo:

```ts
// Remove this entire block:
const globalTotal = useMemo(() => {
  if (typeof window === "undefined") return 0;
  const pieces = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;
  let sum = 0;
  for (const p of pieces) {
    try {
      const raw = localStorage.getItem(`chesscito:progress:${p}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { stars?: number[] };
      if (Array.isArray(parsed.stars)) {
        for (const s of parsed.stars) sum += (typeof s === "number" ? s : 0);
      }
    } catch { continue; }
  }
  return sum * POINTS_PER_STAR_NUM;
}, [totalStars]); // recalc when current piece stars change
```

Also remove `const POINTS_PER_STAR_NUM = 100;` (line 229) — it was only used by `globalTotal`.

**Location 3 — setResultOverlay call (line 613):** Remove `globalTotal,` from the object:

```ts
// Before
setResultOverlay({
  variant: "score",
  txHash,
  globalTotal,
});

// After
setResultOverlay({
  variant: "score",
  txHash,
});
```

**Location 4 — ResultOverlay prop (line 910):** Remove `globalTotal={resultOverlay.globalTotal}`:

```tsx
// Before
<ResultOverlay
  variant={resultOverlay.variant}
  pieceType={selectedPiece}
  itemLabel={selectedItem?.label}
  txHash={resultOverlay.txHash}
  celoscanHref={resultOverlay.txHash ? txLink(chainId, resultOverlay.txHash) : undefined}
  errorMessage={resultOverlay.errorMessage}
  totalStars={totalStars}
  globalTotal={resultOverlay.globalTotal}
  onDismiss={() => setResultOverlay(null)}
  onRetry={resultOverlay.retryAction}
/>

// After
<ResultOverlay
  variant={resultOverlay.variant}
  pieceType={selectedPiece}
  itemLabel={selectedItem?.label}
  txHash={resultOverlay.txHash}
  celoscanHref={resultOverlay.txHash ? txLink(chainId, resultOverlay.txHash) : undefined}
  errorMessage={resultOverlay.errorMessage}
  totalStars={totalStars}
  onDismiss={() => setResultOverlay(null)}
  onRetry={resultOverlay.retryAction}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No errors. TypeScript will catch any remaining references to `globalTotal`.

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npm run test`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/play-hub/result-overlay.tsx apps/web/src/app/page.tsx
git commit -m "fix(ux): remove misleading globalTotal from post-submit overlay

The overlay now only confirms the per-piece score that was submitted on-chain.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3: Victory share page tagline

**Files:**
- Modify: `apps/web/src/app/victory/[id]/page.tsx:105-116`

- [ ] **Step 1: Add tagline and adjust spacing**

In `apps/web/src/app/victory/[id]/page.tsx`, add the import:

```ts
import { VICTORY_PAGE_COPY } from "@/lib/content/editorial";
```

(Check if this import already exists — it likely does since `VICTORY_PAGE_COPY` is already used on lines 101, 115, 123, 130.)

Change the stats div margin from `mb-6` to `mb-3` (line 105):

```tsx
// Before
<div className="mb-6 flex gap-3 text-sm text-cyan-100/50">

// After
<div className="mb-3 flex gap-3 text-sm text-cyan-100/50">
```

Then add the tagline after the stats div closing `</div>` (after line 111) and before the challenge line `<p>` (line 113):

```tsx
{/* Tagline for new visitors */}
<p className="mb-4 text-center text-xs text-cyan-100/40">
  {VICTORY_PAGE_COPY.tagline}
</p>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/victory/\\[id\\]/page.tsx
git commit -m "fix(ux): add Chesscito tagline to victory share page

Visitors from social shares now see what the app is about.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4: Disable "Back to Hub" during active claim

**Files:**
- Modify: `apps/web/src/components/arena/victory-claiming.tsx:113-121`

- [ ] **Step 1: Verify parent error handling**

Read `apps/web/src/app/arena/page.tsx` and confirm that when a claim fails, `claimPhase` is set to `"error"` (line 402), which causes `ArenaEndState` to render `VictoryClaimError` instead of `VictoryClaiming`. This means `VictoryClaiming` is unmounted on error — the user can never get stuck with a disabled button.

Expected: Line 402 shows `setClaimPhase("error")`. The `ArenaEndState` switch (in `arena-end-state.tsx:82-84`) only renders `VictoryClaiming` when `claimPhase === "claiming"`.

- [ ] **Step 2: Update the import and button**

`VICTORY_CLAIM_COPY` is already imported in `victory-claiming.tsx` (line 3). No import changes needed.

Replace lines 113-121:

```tsx
// Before
<Button
  type="button"
  variant="game-text"
  size="game-sm"
  onClick={onBackToHub}
  className="mt-2 text-xs"
>
  {ARENA_COPY.backToHub}
</Button>

// After
<Button
  type="button"
  variant="game-text"
  size="game-sm"
  onClick={onBackToHub}
  disabled={claimStep !== "done"}
  className="mt-2 text-xs"
>
  {claimStep === "done" ? ARENA_COPY.backToHub : VICTORY_CLAIM_COPY.claimingInProgress}
</Button>
```

Note: `claimStep` never reaches `"done"` while `VictoryClaiming` is mounted (the parent unmounts it on success/error), so the button will always be disabled while this component is visible. This is the intended behavior — the user must wait for the transaction to complete.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/arena/victory-claiming.tsx
git commit -m "fix(ux): disable back-to-hub during active NFT claim transaction

Prevents users from abandoning a claim mid-flight.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5: Trophies design token fixes

**Files:**
- Modify: `apps/web/src/app/globals.css` — add `--trophy-card-bg`
- Modify: `apps/web/src/app/trophies/page.tsx:98` — replace `#0a2a3f`
- Modify: `apps/web/src/components/trophies/trophy-card.tsx:75` — use CSS var

- [ ] **Step 1: Add --trophy-card-bg token to globals.css**

In `apps/web/src/app/globals.css`, find the `:root` block with other `--surface-*` and `--panel-*` tokens (around lines 30-50). Add:

```css
--trophy-card-bg: linear-gradient(180deg, rgba(16,12,8,0.90) 0%, rgba(10,8,6,0.85) 100%);
```

- [ ] **Step 2: Replace hardcoded gradient in trophies/page.tsx**

In `apps/web/src/app/trophies/page.tsx:98`, replace:

```tsx
// Before
<div className="absolute inset-0 bg-gradient-to-b from-[#0a2a3f] to-transparent opacity-35 rounded-t-3xl" />

// After
<div className="absolute inset-0 bg-gradient-to-b from-[var(--surface-frosted-solid)] to-transparent opacity-35 rounded-t-3xl" />
```

- [ ] **Step 3: Replace inline gradient in trophy-card.tsx**

In `apps/web/src/components/trophies/trophy-card.tsx:75`, replace:

```tsx
// Before
style={{ background: "linear-gradient(180deg, rgba(16,12,8,0.90) 0%, rgba(10,8,6,0.85) 100%)" }}

// After
style={{ background: "var(--trophy-card-bg)" }}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npm run test`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/trophies/page.tsx apps/web/src/components/trophies/trophy-card.tsx
git commit -m "fix(trophies): replace hardcoded colors with design tokens

Wolfcito 🐾 @akawolfcito"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd apps/web && npm run test`

Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `cd apps/web && npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify all changes in git log**

Run: `git log --oneline -5`

Expected: 5 new commits (Tasks 1-5).
