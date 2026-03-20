# Trophy Vitrine UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign /trophies page with compact 2-row cards, clean dark background, Hall of Fame prestige accents, and proper loading states.

**Architecture:** Modify 4 existing files — editorial copy, TrophyCard, TrophyList, and the trophies page. No new files. Card gets a `variant` prop to switch between "my-victory" (with share icon) and "hall-of-fame" (with rank + address). Page splits into hero zone (with art) and list zone (dark bg).

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons, Next.js App Router

**Spec:** `docs/superpowers/specs/2026-03-20-trophy-vitrine-ux-redesign.md`

---

### Task 1: Add editorial copy for loading state and share toast

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts:270-284`

- [ ] **Step 1: Add new strings to TROPHY_VITRINE_COPY**

Add `loadingText` and `copiedToast` to the existing constant:

```typescript
export const TROPHY_VITRINE_COPY = {
  pageTitle: "Trophy Vitrine",
  pageDescription: "Your onchain victories, immortalized.",
  myVictories: "My Victories",
  hallOfFame: "Hall of Fame",
  movesLabel: "moves",
  shareLabel: "Share",
  loadingText: "Loading victories...",
  copiedToast: "Link copied!",
  connectWallet: "Connect wallet to see your victories",
  noVictories: "No victories yet — win in the Arena to earn your first trophy",
  noGlobalVictories: "No victories recorded yet — be the first!",
  loadError: "Could not load victories — tap to retry",
  configError: "Trophies unavailable",
  roadmap: "More coming soon → Tournaments • VIP Passes • Seasonal Rewards",
  arenaLink: "Go to Arena",
} as const;
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
git commit -m "feat(trophies): add loading and toast copy strings"
```

---

### Task 2: Redesign TrophyCard — compact 2-row layout

**Files:**
- Modify: `apps/web/src/components/trophies/trophy-card.tsx`

This is the core visual change. The card goes from ~140px tall to 72-84px. Two variants: `"victory"` (share icon) and `"hall-of-fame"` (rank number + address).

- [ ] **Step 1: Rewrite TrophyCard with compact layout**

Replace the full content of `trophy-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Trophy, Clock, Footprints, Share2 } from "lucide-react";
import { TROPHY_VITRINE_COPY, VICTORY_CLAIM_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

const DIFFICULTY_CHIP: Record<number, { label: string; className: string }> = {
  1: { label: "Easy", className: "bg-emerald-500/20 text-emerald-400" },
  2: { label: "Medium", className: "bg-amber-500/20 text-amber-400" },
  3: { label: "Hard", className: "bg-red-500/20 text-red-400" },
};

/** Top-3 Hall of Fame accent borders */
const RANK_ACCENT: Record<number, string> = {
  1: "border-amber-400/30 shadow-[0_0_8px_rgba(251,191,36,0.1)]",
  2: "border-slate-300/30 shadow-[0_0_8px_rgba(203,213,225,0.1)]",
  3: "border-orange-600/30 shadow-[0_0_8px_rgba(234,88,12,0.1)]",
};

function formatTimeMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(unix: number): string {
  if (unix <= 0) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type Props = {
  entry: VictoryEntry;
  variant: "victory" | "hall-of-fame";
  rank?: number;
};

export function TrophyCard({ entry, variant, rank }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const chip = DIFFICULTY_CHIP[entry.difficulty] ?? DIFFICULTY_CHIP[1];
  const isHoF = variant === "hall-of-fame";
  const accentClass = rank && rank <= 3 ? RANK_ACCENT[rank] : "border-white/[0.08]";

  const victoryUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/victory/${entry.tokenId}`;

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          text: VICTORY_CLAIM_COPY.challengeText(entry.totalMoves, victoryUrl),
          url: victoryUrl,
        });
        return;
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(victoryUrl);
      setToast(TROPHY_VITRINE_COPY.copiedToast);
      setTimeout(() => setToast(null), 2000);
    } catch { /* silent */ }
  }

  return (
    <div
      className={[
        "rounded-xl border bg-[#121c2f] px-3 py-2.5",
        accentClass,
      ].join(" ")}
    >
      {/* Fila 1: icon/rank + chip + tokenId + date */}
      <div className="flex items-center gap-2">
        {isHoF && rank ? (
          <span className="text-sm font-bold text-slate-100 w-5 text-center">
            {rank}
          </span>
        ) : (
          <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold leading-none ${chip.className}`}
        >
          {chip.label}
        </span>
        <span className="text-[0.65rem] text-slate-500">#{String(entry.tokenId)}</span>
        <span className="ml-auto text-[0.65rem] text-slate-500">{formatDate(entry.timestamp)}</span>
      </div>

      {/* Fila 2: stats + action slot */}
      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Footprints className="h-3.5 w-3.5" />
          {entry.totalMoves} {TROPHY_VITRINE_COPY.movesLabel}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatTimeMs(entry.timeMs)}
        </span>

        {/* Action slot — share icon (victory) or address (hall-of-fame) */}
        <span className="ml-auto">
          {isHoF ? (
            <span className="text-[0.65rem] text-slate-500">
              {truncateAddress(entry.player)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label={TROPHY_VITRINE_COPY.shareLabel}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-cyan-100/50 transition hover:bg-white/5 active:scale-90"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <p className="mt-1 text-center text-[0.6rem] font-semibold text-emerald-400 animate-in fade-in duration-200">
          {toast}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: may show errors in `trophy-list.tsx` because props changed (showPlayer/showShare removed, variant/rank added). That's expected — fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/trophies/trophy-card.tsx
git commit -m "feat(trophies): compact 2-row TrophyCard with variant prop"
```

---

### Task 3: Update TrophyList — loading text + variant prop

**Files:**
- Modify: `apps/web/src/components/trophies/trophy-list.tsx`

- [ ] **Step 1: Rewrite TrophyList with loading text and variant support**

Replace the full content of `trophy-list.tsx`:

```tsx
import { TrophyCard } from "./trophy-card";
import { TROPHY_VITRINE_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

function SkeletonCards() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-xl border border-white/[0.08] bg-[#121c2f]"
        />
      ))}
      <p className="pt-1 text-center text-xs text-slate-500">
        {TROPHY_VITRINE_COPY.loadingText}
      </p>
    </div>
  );
}

type Props = {
  victories: VictoryEntry[] | undefined;
  loading: boolean;
  error?: string | null;
  emptyMessage: string;
  variant: "victory" | "hall-of-fame";
  onRetry?: () => void;
};

export function TrophyList({
  victories,
  loading,
  error,
  emptyMessage,
  variant,
  onRetry,
}: Props) {
  if (loading) return <SkeletonCards />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
        <p className="text-sm text-red-400">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-red-300 underline"
          >
            Tap to retry
          </button>
        )}
      </div>
    );
  }

  if (!victories || victories.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-2">
      {victories.map((v, i) => (
        <TrophyCard
          key={String(v.tokenId)}
          entry={v}
          variant={variant}
          rank={variant === "hall-of-fame" ? i + 1 : undefined}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: may show errors in `page.tsx` because old props (showPlayer/showShare) are still passed. Fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/trophies/trophy-list.tsx
git commit -m "feat(trophies): TrophyList with loading text and variant prop"
```

---

### Task 4: Redesign trophies page — hero + dark list zones

**Files:**
- Modify: `apps/web/src/app/trophies/page.tsx`

- [ ] **Step 1: Rewrite page with hero/list zone split**

Replace the full content of `page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { Crown, ArrowLeft } from "lucide-react";
import { TrophyList } from "@/components/trophies/trophy-list";
import {
  fetchMyVictories,
  fetchHallOfFame,
  getVictoryAddress,
} from "@/lib/game/victory-events";
import { TROPHY_VITRINE_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

export default function TrophiesPage() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  const [myVictories, setMyVictories] = useState<VictoryEntry[]>();
  const [hallOfFame, setHallOfFame] = useState<VictoryEntry[]>();
  const [myLoading, setMyLoading] = useState(false);
  const [hofLoading, setHofLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);
  const [hofError, setHofError] = useState<string | null>(null);

  const configured = getVictoryAddress() !== null;

  const loadHallOfFame = useCallback(async () => {
    if (!client || !configured) {
      setHofLoading(false);
      return;
    }
    setHofLoading(true);
    setHofError(null);
    try {
      const data = await fetchHallOfFame(client);
      setHallOfFame(data);
    } catch {
      setHofError(TROPHY_VITRINE_COPY.loadError);
    } finally {
      setHofLoading(false);
    }
  }, [client, configured]);

  const loadMyVictories = useCallback(async () => {
    if (!client || !address || !configured) return;
    setMyLoading(true);
    setMyError(null);
    try {
      const data = await fetchMyVictories(client, address);
      setMyVictories(data);
    } catch {
      setMyError(TROPHY_VITRINE_COPY.loadError);
    } finally {
      setMyLoading(false);
    }
  }, [client, address, configured]);

  useEffect(() => {
    void loadHallOfFame();
  }, [loadHallOfFame]);

  useEffect(() => {
    if (isConnected && address) {
      void loadMyVictories();
    }
  }, [isConnected, address, loadMyVictories]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[var(--app-max-width)] flex-col bg-[#0a1424]">
      {/* Hero zone — art background, max 200px */}
      <div className="relative flex items-end px-4 pb-4 pt-6" style={{ minHeight: 160, maxHeight: 200 }}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a2a3f] to-[#0a1424] opacity-80" />
        <div className="relative z-10 flex items-center gap-3">
          <Link
            href="/play-hub"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">
              {TROPHY_VITRINE_COPY.pageTitle}
            </h1>
            <p className="text-xs text-slate-400">
              {TROPHY_VITRINE_COPY.pageDescription}
            </p>
          </div>
        </div>
      </div>

      {/* List zone — clean dark background */}
      <div className="flex-1 px-4 pb-8">
        {!configured && (
          <p className="py-6 text-center text-sm text-slate-500">
            {TROPHY_VITRINE_COPY.configError}
          </p>
        )}

        {configured && (
          <>
            {/* My Victories */}
            <section className="mb-6">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                {TROPHY_VITRINE_COPY.myVictories}
              </h2>

              {!isConnected ? (
                <p className="py-4 text-center text-sm text-slate-500">
                  {TROPHY_VITRINE_COPY.connectWallet}
                </p>
              ) : (
                <TrophyList
                  victories={myVictories}
                  loading={myLoading}
                  error={myError}
                  emptyMessage={TROPHY_VITRINE_COPY.noVictories}
                  variant="victory"
                  onRetry={loadMyVictories}
                />
              )}

              {isConnected && myVictories?.length === 0 && !myLoading && !myError && (
                <Link
                  href="/arena"
                  className="mt-1 block text-center text-xs font-semibold text-cyan-400 underline"
                >
                  {TROPHY_VITRINE_COPY.arenaLink}
                </Link>
              )}
            </section>

            {/* Hall of Fame */}
            <section className="mb-6">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                <Crown className="h-3.5 w-3.5 text-purple-400" />
                {TROPHY_VITRINE_COPY.hallOfFame}
              </h2>

              <TrophyList
                victories={hallOfFame}
                loading={hofLoading}
                error={hofError}
                emptyMessage={TROPHY_VITRINE_COPY.noGlobalVictories}
                variant="hall-of-fame"
                onRetry={loadHallOfFame}
              />
            </section>
          </>
        )}

        {/* Roadmap Banner */}
        <div className="mt-auto rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 text-center text-xs text-purple-300">
          {TROPHY_VITRINE_COPY.roadmap}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors. All old props (showPlayer, showShare) removed, new variant prop used.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter web test`
Expected: all 19 tests pass (none of these files have unit tests, so no breakage expected)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/trophies/page.tsx
git commit -m "feat(trophies): hero + dark list layout with compact cards"
```

---

### Task 5: Visual QA and final cleanup

- [ ] **Step 1: Check dev server renders correctly**

Open `http://localhost:3000/trophies` in Chrome DevTools at 390x844 viewport. Verify:
- Hero zone: dark gradient, title + back button, max ~200px tall
- Cards: compact 2-row, ~72-84px tall, 6-7 visible per screen
- My Victories: trophy icon + share icon in action slot
- Hall of Fame: rank number replaces trophy, top 3 have accent borders
- Loading: skeletons + "Loading victories..." text
- Background: clean dark `#0a1424`, no illustration behind list

- [ ] **Step 2: Full build check**

Run: `pnpm --filter web build`
Expected: build succeeds with no new errors

- [ ] **Step 3: Final commit with all files if any tweaks were needed**

```bash
git add -A
git commit -m "style(trophies): visual QA adjustments"
```

Only if tweaks were needed. If everything passed, skip this step.

---

### Summary of changes

| File | Before | After |
|------|--------|-------|
| `editorial.ts` | No loading/toast strings | `loadingText`, `copiedToast` added |
| `trophy-card.tsx` | 140px tall, full Share button, glassmorphism | 72-84px, 2-row, share icon, `#121c2f` bg, rank/accent for HoF |
| `trophy-list.tsx` | Skeleton only, showPlayer/showShare props | Skeleton + text, `variant` prop, `rank` passed to HoF |
| `page.tsx` | Single zone with illustrated bg | Hero zone (gradient) + list zone (dark `#0a1424`) |
