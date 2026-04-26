# UX Critical Fixes — Design Spec

**Date**: 2026-04-03
**Status**: Draft
**Scope**: 6 surgical fixes across play-hub, arena, victory, and trophies screens

## Goal

Fix 6 critical UX findings from the 2026-04-03 audit. Each fix is independent and minimal.

---

## Fix 1: Score label in HUD bar

**Problem**: `mission-panel.tsx:136` shows `★ 300` with no unit. User doesn't know what the number means.

**Fix**: Append "pts" after the score number.

**Before**: `★ 300`
**After**: `★ 300 pts`

**File**: `apps/web/src/components/play-hub/mission-panel.tsx:136`

Add `scoreUnit: "pts"` to `editorial.ts` (project convention: all user-facing copy in editorial.ts).

Change:
```tsx
// Before
{score}

// After
{score} <span className="text-white/40">{SCORE_UNIT}</span>
```

**Files**:
- `apps/web/src/lib/content/editorial.ts` — add `SCORE_UNIT` constant
- `apps/web/src/components/play-hub/mission-panel.tsx:136` — use `SCORE_UNIT`

---

## Fix 2: Remove globalTotal from post-submit overlay

**Problem**: `result-overlay.tsx:230-234` shows "Total: 3800 pts" (sum of ALL pieces) after submitting a per-piece score (e.g., 1500). User thinks 3800 was submitted.

**Fix**: Remove the globalTotal line entirely from the score variant. The overlay should only confirm what was submitted.

**Files** (all cleanup locations):
- `apps/web/src/components/play-hub/result-overlay.tsx:230-234` — remove the globalTotal rendering block
- `apps/web/src/components/play-hub/result-overlay.tsx:23` — remove `globalTotal` from `ResultOverlayProps` type
- `apps/web/src/app/page.tsx:134` — remove `globalTotal` from `resultOverlay` state type
- `apps/web/src/app/page.tsx:232-245` — remove the `globalTotal` useMemo computation (dead code after removal)
- `apps/web/src/app/page.tsx:613` — remove `globalTotal` from `setResultOverlay` call
- `apps/web/src/app/page.tsx:910` — remove `globalTotal={resultOverlay.globalTotal}` prop
- `apps/web/src/lib/content/editorial.ts:73` — remove `globalTotalLabel` from `RESULT_OVERLAY_COPY.score`

The subtitle "Your score is now recorded on the blockchain." is sufficient confirmation.

---

## Fix 3: Victory share page context

**Problem**: `victory/[id]/page.tsx:89-135` has no explanation of what Chesscito is. A visitor from a social share has zero context.

**Fix**: Add a tagline below the title in `VICTORY_PAGE_COPY`:

```ts
tagline: "Learn chess moves, earn on-chain — a Celo MiniPay game",
```

Render it between the stats row and the challenge line. Reduce stats `mb-6` to `mb-3` to avoid excessive spacing with the new tagline's own `mb-4`.

```tsx
<p className="mb-4 text-center text-xs text-cyan-100/40">
  {VICTORY_PAGE_COPY.tagline}
</p>
```

**Files**:
- `apps/web/src/lib/content/editorial.ts` — add `tagline` to `VICTORY_PAGE_COPY`
- `apps/web/src/app/victory/[id]/page.tsx:105` — reduce stats div `mb-6` to `mb-3`
- `apps/web/src/app/victory/[id]/page.tsx:111-113` — render tagline between stats and challenge line

---

## Fix 4: Disable "Back to Hub" during active claim

**Problem**: `victory-claiming.tsx:117` allows navigation during active NFT claim transaction. User can abandon tx mid-flight.

**Fix**: Disable the "Back to Hub" button when `claimStep` is `"signing"` or `"confirming"` (i.e., not `"done"`).

**File**: `apps/web/src/components/arena/victory-claiming.tsx:115-121`

Change:
```tsx
// Before
<Button variant="game-text" size="game-sm" onClick={onBackToHub} className="mt-2 text-xs">
  {ARENA_COPY.backToHub}
</Button>

// After
<Button
  variant="game-text"
  size="game-sm"
  onClick={onBackToHub}
  disabled={claimStep !== "done"}
  className="mt-2 text-xs"
>
  {claimStep === "done" ? ARENA_COPY.backToHub : VICTORY_MINT_COPY.claimingInProgress}
</Button>
```

Add `claimingInProgress: "Claiming in progress..."` to `VICTORY_MINT_COPY` in `editorial.ts` (this component already imports from that constant).

**Error handling safety**: Verify that the parent (`arena/page.tsx`) transitions `claimStep` away from `"signing"/"confirming"` on error — either by unmounting `VictoryClaiming` (switching to error view) or by setting `claimStep` to `"done"`. If neither happens, the user would be stuck with a disabled button. The implementor must verify this parent behavior before committing.

---

## Fix 5: Trophies header hardcoded gradient

**Problem**: `trophies/page.tsx:96` uses hardcoded `#0a2a3f`.

**Fix**: Replace with `var(--surface-frosted-solid)` which is `#0a1424` — the closest token. If the visual difference is too noticeable, create a dedicated `--trophy-header-bg` token.

**File**: `apps/web/src/app/trophies/page.tsx:96`

---

## Fix 6: Trophy card hardcoded gradient

**Problem**: `trophy-card.tsx:75` uses inline `background: linear-gradient(180deg, rgba(16,12,8,0.90) 0%, rgba(10,8,6,0.85) 100%)`.

**Fix**: Extract the warm gradient into a CSS custom property `--trophy-card-bg` in `globals.css` and reference it via `background: var(--trophy-card-bg)`. Do NOT use the `panel-elevated` class directly — it adds border, border-radius, box-shadow, and a `::after` pseudo-element that would conflict with the card's existing styles (border from `accentClass`, `rounded-xl`, etc.).

**Files**:
- `apps/web/src/app/globals.css` — add `--trophy-card-bg: linear-gradient(180deg, rgba(16,12,8,0.90) 0%, rgba(10,8,6,0.85) 100%)`
- `apps/web/src/components/trophies/trophy-card.tsx:75` — replace inline `style={{ background: ... }}` with `style={{ background: "var(--trophy-card-bg)" }}`

---

## What does NOT change

- Score calculation logic (per-piece, per-level) — unchanged
- Leaderboard calculation — unchanged  
- On-chain submission values — unchanged
- Any other component not listed above

## Testing

- Visual: verify each fix on 390px mobile viewport
- Functional: verify "Back to Hub" is disabled during mock claim flow
- Regression: verify existing tests pass (`npm run test`)
