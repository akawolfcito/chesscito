# Badge Collection Sheet — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the "Claim Badge" action button with a "Badges" sheet showing all 3 badge states (claimed/claimable/locked) with inline claim action.

**Architecture:** New BadgeSheet component using existing Sheet UI primitive. Reads on-chain hasClaimedBadge for 3 levelIds via useReadContracts (batched). Star progress read from localStorage. Claim action delegates to existing handleClaimBadge in page.tsx.

**Tech Stack:** Next.js 14, Tailwind CSS, wagmi useReadContracts, shadcn Sheet

---

### Task 1: Editorial Copy + Error Handling

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`
- Modify: `apps/web/src/lib/errors.ts`

**Step 1: Add badge sheet copy to editorial.ts**

Add after existing exports:

```typescript
export const BADGE_SHEET_COPY = {
  title: "Your Badges",
  subtitle: "Collect all three to master the board",
  owned: "Owned",
  claimBadge: "Claim Badge",
  claiming: "Claiming...",
  locked: (needed: number) => `Need ${needed} more ★ to unlock`,
  notStarted: "Complete exercises to start",
} as const;
```

**Step 2: Handle BadgeAlreadyClaimed in errors.ts**

In `classifyTxError`, add a check for the "BadgeAlreadyClaimed" revert reason. The error message from the contract contains "BadgeAlreadyClaimed" or "already claimed". Add before the generic fallback:

```typescript
if (message.includes("BadgeAlreadyClaimed") || message.includes("already claimed")) {
  return "You already own this badge!";
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts apps/web/src/lib/errors.ts
git commit -m "feat(badges): add badge sheet copy and BadgeAlreadyClaimed error handling"
```

---

### Task 2: BadgeSheet Component

**Files:**
- Create: `apps/web/src/components/play-hub/badge-sheet.tsx`

**Context:** This follows the same pattern as `shop-sheet.tsx` and `leaderboard-sheet.tsx`. Uses the shadcn Sheet primitive. Reads localStorage directly for star progress of all 3 pieces.

**Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BADGE_SHEET_COPY, PIECE_LABELS } from "@/lib/content/editorial";
import { BADGE_THRESHOLD } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

const PIECES: PieceId[] = ["rook", "bishop", "knight"];

const BADGE_ART: Record<PieceId, string> = {
  rook: "/art/piece-rook.png",
  bishop: "/art/piece-bishop.png",
  knight: "/art/piece-knight.png",
};

type BadgeState = "claimed" | "claimable" | "locked";

type BadgeInfo = {
  piece: PieceId;
  state: BadgeState;
  totalStars: number;
  maxStars: number;
};

function readStarsFromStorage(piece: PieceId): number[] {
  if (typeof window === "undefined") return [0, 0, 0, 0, 0];
  try {
    const raw = localStorage.getItem(`chesscito:progress:${piece}`);
    if (!raw) return [0, 0, 0, 0, 0];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.stars) ? parsed.stars : [0, 0, 0, 0, 0];
  } catch {
    return [0, 0, 0, 0, 0];
  }
}

function BadgeCard({
  badge,
  onClaim,
  isClaimBusy,
}: {
  badge: BadgeInfo;
  onClaim: () => void;
  isClaimBusy: boolean;
}) {
  const label = PIECE_LABELS[badge.piece];
  const title = `${label} Ascendant`;
  const isClaimed = badge.state === "claimed";
  const isClaimable = badge.state === "claimable";
  const isLocked = badge.state === "locked";
  const needed = Math.max(0, BADGE_THRESHOLD - badge.totalStars);

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl px-3 py-3 transition",
        isClaimed
          ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
          : isClaimable
            ? "bg-cyan-500/10 ring-1 ring-cyan-400/30"
            : "bg-slate-800/30",
      ].join(" ")}
    >
      {/* Badge image */}
      <picture className={`h-12 w-12 shrink-0 ${isLocked ? "grayscale opacity-40" : ""}`}>
        <source srcSet={BADGE_ART[badge.piece].replace(".png", ".avif")} type="image/avif" />
        <source srcSet={BADGE_ART[badge.piece].replace(".png", ".webp")} type="image/webp" />
        <img
          src={BADGE_ART[badge.piece]}
          alt={title}
          className="h-full w-full object-contain"
        />
      </picture>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-cyan-50">{title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {/* Mini progress bar */}
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isClaimed ? "bg-emerald-400" : "bg-amber-400"
              }`}
              style={{ width: `${(badge.totalStars / badge.maxStars) * 100}%` }}
            />
          </div>
          <span className="text-[0.6rem] font-semibold text-cyan-100/50 tabular-nums">
            {badge.totalStars}/{badge.maxStars}
          </span>
        </div>
        {isLocked ? (
          <p className="mt-0.5 text-[0.65rem] text-cyan-100/40">
            {badge.totalStars === 0 ? BADGE_SHEET_COPY.notStarted : BADGE_SHEET_COPY.locked(needed)}
          </p>
        ) : null}
      </div>

      {/* Action / Status */}
      <div className="shrink-0">
        {isClaimed ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <span aria-hidden="true">✓</span> {BADGE_SHEET_COPY.owned}
          </span>
        ) : isClaimable ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={isClaimBusy}
            className="rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
          >
            {isClaimBusy ? BADGE_SHEET_COPY.claiming : BADGE_SHEET_COPY.claimBadge}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type BadgeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badgesClaimed: Record<PieceId, boolean | undefined>;
  onClaim: (piece: PieceId) => void;
  isClaimBusy: boolean;
  showNotification: boolean;
};

export function BadgeSheet({
  open,
  onOpenChange,
  badgesClaimed,
  onClaim,
  isClaimBusy,
  showNotification,
}: BadgeSheetProps) {
  // Read star progress from localStorage on mount/open
  const [starsByPiece, setStarsByPiece] = useState<Record<PieceId, number[]>>({
    rook: [0, 0, 0, 0, 0],
    bishop: [0, 0, 0, 0, 0],
    knight: [0, 0, 0, 0, 0],
  });

  useEffect(() => {
    if (!open) return;
    setStarsByPiece({
      rook: readStarsFromStorage("rook"),
      bishop: readStarsFromStorage("bishop"),
      knight: readStarsFromStorage("knight"),
    });
  }, [open]);

  const badges: BadgeInfo[] = PIECES.map((piece) => {
    const stars = starsByPiece[piece];
    const totalStars = stars.reduce((sum, s) => sum + s, 0);
    const maxStars = stars.length * 3;
    const claimed = Boolean(badgesClaimed[piece]);
    const earned = totalStars >= BADGE_THRESHOLD;

    return {
      piece,
      state: claimed ? "claimed" : earned ? "claimable" : "locked",
      totalStars,
      maxStars,
    };
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Badges"
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-cyan-100/70 transition"
        >
          <picture className="h-full w-full">
            <source srcSet="/art/badge-chesscito.avif" type="image/avif" />
            <source srcSet="/art/badge-chesscito.webp" type="image/webp" />
            <img src="/art/badge-chesscito.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5" />
          </picture>
          {showNotification ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">{BADGE_SHEET_COPY.title}</SheetTitle>
          <SheetDescription className="text-cyan-100/75">{BADGE_SHEET_COPY.subtitle}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {badges.map((badge) => (
            <BadgeCard
              key={badge.piece}
              badge={badge}
              onClaim={() => onClaim(badge.piece)}
              isClaimBusy={isClaimBusy}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/play-hub/badge-sheet.tsx
git commit -m "feat(badges): create BadgeSheet collection component"
```

---

### Task 3: Wire BadgeSheet into Page + Read All 3 Badge States

**Files:**
- Modify: `apps/web/src/app/play-hub/page.tsx`

**Context:** Currently the page reads `hasClaimedBadge` for only the selected piece. We need to read all 3 and pass them to BadgeSheet. Also need to add badge sheet open state and update handleClaimBadge to accept a piece parameter.

**Step 1: Add imports**

Add to the imports at the top:
```typescript
import { BadgeSheet } from "@/components/play-hub/badge-sheet";
```

**Step 2: Add badge reads for all 3 levels**

Replace the single `hasClaimedBadge` useReadContract with a batched read using `useReadContracts`:

```typescript
// Read hasClaimedBadge for all 3 pieces
const { data: allBadgesClaimed, refetch: refetchAllBadges } = useReadContracts({
  contracts: [1n, 2n, 3n].map((lid) => ({
    address: badgesAddress ?? undefined,
    abi: badgesAbi,
    functionName: "hasClaimedBadge" as const,
    args: address ? [address, lid] : undefined,
    chainId,
  })),
  query: {
    enabled: Boolean(address && badgesAddress),
  },
});

const badgesClaimed = {
  rook: allBadgesClaimed?.[0]?.result as boolean | undefined,
  bishop: allBadgesClaimed?.[1]?.result as boolean | undefined,
  knight: allBadgesClaimed?.[2]?.result as boolean | undefined,
};

// Keep backward compat: hasClaimedBadge for the currently selected piece
const hasClaimedBadge = badgesClaimed[selectedPiece];
```

Remove the old single `useReadContract` for `hasClaimedBadge` and its `refetchClaimedBadge`. Replace `refetchClaimedBadge` calls with `refetchAllBadges`.

**Step 3: Add badge sheet state**

```typescript
const [badgeSheetOpen, setBadgeSheetOpen] = useState(false);
```

**Step 4: Update handleClaimBadge to accept a piece parameter**

The function currently uses `levelId` from the selected piece. Update it to accept an optional piece parameter:

```typescript
async function handleClaimBadge(piece?: "rook" | "bishop" | "knight") {
  const claimLevelId = piece ? getLevelId(piece) : levelId;
  // ... rest uses claimLevelId instead of levelId
```

And update `refetchClaimedBadge()` calls to `refetchAllBadges()`.

**Step 5: Add `anyBadgeClaimable` computed value**

```typescript
const anyBadgeClaimable = (["rook", "bishop", "knight"] as const).some((piece) => {
  if (badgesClaimed[piece]) return false;
  // Read stars from localStorage
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(`chesscito:progress:${piece}`) : null;
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const total = Array.isArray(parsed.stars) ? parsed.stars.reduce((s: number, v: number) => s + v, 0) : 0;
    return total >= 10;
  } catch { return false; }
});
```

**Step 6: Replace badge ActionBtn with BadgeSheet in the JSX**

In the `OnChainActionsPanel` render, remove the badge `ActionBtn` and replace with BadgeSheet passed as a prop (similar to how shopControl/leaderboardControl work).

Add a new prop like `badgeControl` to OnChainActionsPanel, or render BadgeSheet directly in the action bar.

The simplest approach: pass BadgeSheet as the `badgeControl` prop to OnChainActionsPanel (new prop), rendered alongside shopControl/leaderboardControl.

**Step 7: Commit**

```bash
git add apps/web/src/app/play-hub/page.tsx
git commit -m "feat(badges): wire BadgeSheet with batched on-chain reads for all 3 levels"
```

---

### Task 4: Update OnChainActionsPanel to Accept Badge Sheet

**Files:**
- Modify: `apps/web/src/components/play-hub/onchain-actions-panel.tsx`

**Step 1: Replace the inline badge ActionBtn with a `badgeControl` ReactNode prop**

Add `badgeControl: ReactNode` to `OnChainActionsPanelProps`.

Remove the badge `ActionBtn` from the JSX and replace with `{badgeControl}`.

Remove the `canClaim`, `isClaimBusy`, `onClaim` props since badge claiming is now handled by BadgeSheet.

**Step 2: Commit**

```bash
git add apps/web/src/components/play-hub/onchain-actions-panel.tsx
git commit -m "refactor(actions): replace badge ActionBtn with badgeControl slot"
```

---

### Task 5: Integration Test + Polish

**Step 1: Build verification**

```bash
pnpm --filter web build
```

**Step 2: Visual check at 390px viewport**

- Open badge sheet → see all 3 pieces with correct states
- Claimed badge shows green checkmark + "Owned"
- Locked badges show grayscale + progress
- Notification dot appears when a badge is claimable
- Claim button works inside the sheet

**Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix(badges): integration polish for badge sheet"
```
