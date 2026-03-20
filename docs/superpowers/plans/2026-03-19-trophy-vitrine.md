# Trophy Vitrine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/trophies` page that displays minted Victory NFTs (personal + Hall of Fame) from onchain events.

**Architecture:** Client-side page that fetches `VictoryMinted` events via chunked `getLogs`, resolves block timestamps, and renders trophy cards in two sections (My Victories + Hall of Fame). Uses existing `ShareButton` for re-share. Dark fantasy aesthetic matching the rest of the app.

**Tech Stack:** Next.js 14 App Router, viem (getLogs), wagmi (usePublicClient, useAccount), Tailwind CSS, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-19-trophy-vitrine-design.md`

---

## File Map

| File | Responsibility | Team |
|------|----------------|------|
| `lib/game/victory-events.ts` | `VictoryEntry` type, `EVENT_SCAN_START`, `getLogsPaginated`, `fetchMyVictories`, `fetchHallOfFame`, `isVictoryConfigured`, block timestamp resolution | data-layer |
| `components/trophies/trophy-card.tsx` | Single victory card: difficulty pill, moves, time, date, optional player address, optional re-share | ui-components |
| `components/trophies/trophy-list.tsx` | Renders list of `TrophyCard`s with loading/empty states | ui-components |
| `app/trophies/layout.tsx` | Server layout with metadata export (title, description, OG) | page |
| `app/trophies/page.tsx` | Client page, integrates both sections + roadmap banner | page |
| `lib/content/editorial.ts` | Add `TROPHY_VITRINE_COPY` constant (reuses `VICTORY_CLAIM_COPY.challengeText` for share) | page |

All paths relative to `apps/web/src/`.

---

## Task 1: Data Layer — `victory-events.ts`

**Files:**
- Create: `apps/web/src/lib/game/victory-events.ts`

### Steps

- [ ] **Step 1: Create `victory-events.ts` with types and constants**

Uses `getVictoryNFTAddress` from `chains.ts` instead of reading env directly, for consistency with the rest of the codebase.

```typescript
// apps/web/src/lib/game/victory-events.ts
import type { PublicClient } from "viem";
import { parseAbiItem } from "viem";
import { getVictoryNFTAddress, getConfiguredChainId } from "@/lib/contracts/chains";

export type VictoryEntry = {
  tokenId: bigint;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number; // unix seconds, resolved from block
};

/** Known safe start block — VictoryNFT deployed 2026-03-17, no events before this. */
export const EVENT_SCAN_START = 61_250_000n;

const CHUNK_SIZE = 5_000n;

const VictoryMintedEvent = parseAbiItem(
  "event VictoryMinted(address indexed player, uint256 indexed tokenId, uint8 difficulty, uint16 totalMoves, uint32 timeMs, address indexed token, uint256 totalAmount)"
);

/** Returns the VictoryNFT address if configured, or null. Used by page to detect config errors. */
export function getVictoryAddress(): `0x${string}` | null {
  const chainId = getConfiguredChainId();
  return chainId ? getVictoryNFTAddress(chainId) : null;
}
```

- [ ] **Step 2: Implement `getLogsPaginated`**

```typescript
async function getLogsPaginated(
  client: PublicClient,
  args: {
    address: `0x${string}`;
    event: typeof VictoryMintedEvent;
    args?: { player?: `0x${string}` };
  },
  fromBlock: bigint,
  toBlock: bigint
) {
  const logs = [];
  for (let from = fromBlock; from <= toBlock; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE - 1n > toBlock ? toBlock : from + CHUNK_SIZE - 1n;
    const chunk = await client.getLogs({
      address: args.address,
      event: args.event,
      args: args.args,
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...chunk);
  }
  return logs;
}
```

- [ ] **Step 3: Implement block timestamp resolution**

```typescript
async function resolveTimestamps(
  client: PublicClient,
  blockNumbers: bigint[]
): Promise<Map<bigint, number>> {
  const unique = [...new Set(blockNumbers.map(String))].map(BigInt);
  const blocks = await Promise.all(
    unique.map((n) => client.getBlock({ blockNumber: n }))
  );
  const map = new Map<bigint, number>();
  for (const block of blocks) {
    map.set(block.number, Number(block.timestamp));
  }
  return map;
}
```

- [ ] **Step 4: Implement `logsToEntries` helper**

```typescript
function logsToEntries(
  logs: Awaited<ReturnType<typeof getLogsPaginated>>,
  timestamps: Map<bigint, number>
): VictoryEntry[] {
  return logs.map((log) => ({
    tokenId: log.args.tokenId!,
    player: log.args.player!,
    difficulty: Number(log.args.difficulty!),
    totalMoves: Number(log.args.totalMoves!),
    timeMs: Number(log.args.timeMs!),
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    timestamp: timestamps.get(log.blockNumber) ?? 0,
  }));
}

/** Sort by blockNumber desc, logIndex desc (newest first, deterministic). */
function sortNewestFirst(entries: VictoryEntry[]): VictoryEntry[] {
  return entries.sort((a, b) => {
    const blockDiff = Number(b.blockNumber - a.blockNumber);
    return blockDiff !== 0 ? blockDiff : b.logIndex - a.logIndex;
  });
}
```

- [ ] **Step 5: Implement `fetchMyVictories` and `fetchHallOfFame`**

```typescript
export async function fetchMyVictories(
  client: PublicClient,
  player: `0x${string}`
): Promise<VictoryEntry[]> {
  const address = getVictoryAddress();
  if (!address) return [];

  const latest = await client.getBlockNumber();
  const logs = await getLogsPaginated(
    client,
    { address, event: VictoryMintedEvent, args: { player } },
    EVENT_SCAN_START,
    latest
  );

  const timestamps = await resolveTimestamps(
    client,
    logs.map((l) => l.blockNumber)
  );

  return sortNewestFirst(logsToEntries(logs, timestamps));
}

export async function fetchHallOfFame(
  client: PublicClient
): Promise<VictoryEntry[]> {
  const address = getVictoryAddress();
  if (!address) return [];

  const latest = await client.getBlockNumber();
  const logs = await getLogsPaginated(
    client,
    { address, event: VictoryMintedEvent },
    EVENT_SCAN_START,
    latest
  );

  const timestamps = await resolveTimestamps(
    client,
    logs.map((l) => l.blockNumber)
  );

  return sortNewestFirst(logsToEntries(logs, timestamps)).slice(0, 10);
}
```

- [ ] **Step 6: Commit**

```bash
cd apps/web && git add src/lib/game/victory-events.ts
git commit -m "feat(trophies): add victory-events data layer with chunked getLogs (#23)"
```

---

## Task 2: UI Components — `trophy-card.tsx` + `trophy-list.tsx`

**Files:**
- Create: `apps/web/src/components/trophies/trophy-card.tsx`
- Create: `apps/web/src/components/trophies/trophy-list.tsx`

**Dependencies:** Needs `VictoryEntry` type from Task 1, but can be coded in parallel since it only uses the type import.

### Steps

- [ ] **Step 1: Create `trophy-card.tsx`**

The card follows the dark fantasy aesthetic (dark bg, subtle borders, gradients). Difficulty pill colors: Easy=emerald, Medium=amber, Hard=red. Shows: difficulty, moves, time, date. Optional: player address (for Hall of Fame), re-share button (for My Victories).

**Important:** Re-share uses `VICTORY_CLAIM_COPY.challengeText` (not a duplicate) per spec requirement.

```typescript
// apps/web/src/components/trophies/trophy-card.tsx
"use client";

import { Trophy, Clock, Footprints } from "lucide-react";
import { ShareButton } from "@/components/ui/share-button";
import { TROPHY_VITRINE_COPY, VICTORY_CLAIM_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

const DIFFICULTY_PILL: Record<number, { label: string; className: string }> = {
  1: { label: "Easy", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  2: { label: "Medium", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  3: { label: "Hard", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function formatTimeMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type Props = {
  entry: VictoryEntry;
  showPlayer?: boolean;
  showShare?: boolean;
};

export function TrophyCard({ entry, showPlayer, showShare }: Props) {
  const pill = DIFFICULTY_PILL[entry.difficulty] ?? DIFFICULTY_PILL[1];
  const victoryUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/victory/${entry.tokenId}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${pill.className}`}
          >
            {pill.label}
          </span>
          <span className="text-xs text-slate-400">#{String(entry.tokenId)}</span>
        </div>
        <span className="text-xs text-slate-500">{formatDate(entry.timestamp)}</span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-slate-300">
        <span className="flex items-center gap-1">
          <Footprints className="h-4 w-4 text-slate-500" />
          {entry.totalMoves} {TROPHY_VITRINE_COPY.movesLabel}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-slate-500" />
          {formatTimeMs(entry.timeMs)}
        </span>
      </div>

      {showPlayer && (
        <p className="mt-2 text-xs text-slate-500">
          {truncateAddress(entry.player)}
        </p>
      )}

      {showShare && (
        <div className="mt-3">
          <ShareButton
            text={VICTORY_CLAIM_COPY.challengeText(entry.totalMoves, victoryUrl)}
            url={victoryUrl}
            label={TROPHY_VITRINE_COPY.shareLabel}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `trophy-list.tsx`**

```typescript
// apps/web/src/components/trophies/trophy-list.tsx
import { TrophyCard } from "./trophy-card";
import type { VictoryEntry } from "@/lib/game/victory-events";

/** Skeleton placeholder cards for loading state. */
function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5"
        />
      ))}
    </div>
  );
}

type Props = {
  victories: VictoryEntry[] | undefined;
  loading: boolean;
  error?: string | null;
  emptyMessage: string;
  showPlayer?: boolean;
  showShare?: boolean;
  onRetry?: () => void;
};

export function TrophyList({
  victories,
  loading,
  error,
  emptyMessage,
  showPlayer,
  showShare,
  onRetry,
}: Props) {
  if (loading) return <SkeletonCards />;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
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
    <div className="space-y-3">
      {victories.map((v) => (
        <TrophyCard
          key={String(v.tokenId)}
          entry={v}
          showPlayer={showPlayer}
          showShare={showShare}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd apps/web && git add src/components/trophies/
git commit -m "feat(trophies): add TrophyCard and TrophyList components (#23)"
```

---

## Task 3: Page + Editorial — `app/trophies/` + copy

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts` (add `TROPHY_VITRINE_COPY`)
- Create: `apps/web/src/app/trophies/layout.tsx` (server metadata)
- Create: `apps/web/src/app/trophies/page.tsx` (client page)

**Dependencies:** Depends on Task 1 (fetchers + `getVictoryAddress`) and Task 2 (components). Can start with editorial.ts immediately, page can be wired once other tasks commit.

### Steps

- [ ] **Step 1: Add `TROPHY_VITRINE_COPY` to `editorial.ts`**

Append after the last export in `editorial.ts`. Note: `shareText` is **not** defined here — we reuse `VICTORY_CLAIM_COPY.challengeText` per spec.

```typescript
export const TROPHY_VITRINE_COPY = {
  pageTitle: "Trophy Vitrine",
  pageDescription: "Your onchain victories, immortalized.",
  myVictories: "My Victories",
  hallOfFame: "Hall of Fame",
  movesLabel: "moves",
  shareLabel: "Share",
  connectWallet: "Connect wallet to see your victories",
  noVictories: "No victories yet — win in the Arena to earn your first trophy",
  noGlobalVictories: "No victories recorded yet — be the first!",
  loadError: "Could not load victories — tap to retry",
  configError: "Trophies unavailable",
  roadmap: "More coming soon → Tournaments • VIP Passes • Seasonal Rewards",
  arenaLink: "Go to Arena",
} as const;
```

- [ ] **Step 2: Commit editorial copy**

```bash
cd apps/web && git add src/lib/content/editorial.ts
git commit -m "feat(trophies): add TROPHY_VITRINE_COPY to editorial (#23)"
```

- [ ] **Step 3: Create `app/trophies/layout.tsx`** (server metadata)

```typescript
// apps/web/src/app/trophies/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trophy Vitrine — Chesscito",
  description: "Your onchain victories, immortalized.",
};

export default function TrophiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 4: Create `app/trophies/page.tsx`**

Config error state is explicitly handled: when `getVictoryAddress()` returns null, both sections show "Trophies unavailable" with no retry button.

```typescript
// apps/web/src/app/trophies/page.tsx
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
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[var(--app-max-width)] flex-col px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/play-hub"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5"
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

      {/* Config error — non-retryable */}
      {!configured && (
        <p className="py-6 text-center text-sm text-slate-500">
          {TROPHY_VITRINE_COPY.configError}
        </p>
      )}

      {configured && (
        <>
          {/* Section 1: My Victories */}
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
              <Crown className="h-4 w-4 text-amber-400" />
              {TROPHY_VITRINE_COPY.myVictories}
            </h2>

            {!isConnected ? (
              <p className="py-6 text-center text-sm text-slate-500">
                {TROPHY_VITRINE_COPY.connectWallet}
              </p>
            ) : (
              <TrophyList
                victories={myVictories}
                loading={myLoading}
                error={myError}
                emptyMessage={TROPHY_VITRINE_COPY.noVictories}
                showShare
                onRetry={loadMyVictories}
              />
            )}

            {isConnected && myVictories?.length === 0 && !myLoading && !myError && (
              <Link
                href="/arena"
                className="mt-2 block text-center text-xs font-semibold text-cyan-400 underline"
              >
                {TROPHY_VITRINE_COPY.arenaLink}
              </Link>
            )}
          </section>

          {/* Section 2: Hall of Fame */}
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
              <Crown className="h-4 w-4 text-purple-400" />
              {TROPHY_VITRINE_COPY.hallOfFame}
            </h2>

            <TrophyList
              victories={hallOfFame}
              loading={hofLoading}
              error={hofError}
              emptyMessage={TROPHY_VITRINE_COPY.noGlobalVictories}
              showPlayer
              onRetry={loadHallOfFame}
            />
          </section>
        </>
      )}

      {/* Roadmap Banner */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 text-center text-xs text-purple-300">
        {TROPHY_VITRINE_COPY.roadmap}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit page**

```bash
cd apps/web && git add src/app/trophies/
git commit -m "feat(trophies): add /trophies route with My Victories + Hall of Fame (#23)"
```

- [ ] **Step 6: Verify build**

```bash
cd apps/web && npx next build
```

Expected: Build succeeds, no type errors.

---

## Teammate Assignment

| Task | Teammate | Files (no overlap) |
|------|----------|-------------------|
| Task 1: Data layer | `data-layer` | `lib/game/victory-events.ts` |
| Task 2: UI components | `ui-components` | `components/trophies/trophy-card.tsx`, `components/trophies/trophy-list.tsx` |
| Task 3: Page + editorial | `page` | `app/trophies/layout.tsx`, `app/trophies/page.tsx`, `lib/content/editorial.ts` |

All teammates work in isolated worktrees. No file conflicts between them.

**Integration order:** Tasks 1 & 2 can run fully in parallel. Task 3 depends on both (imports from them). However, since Task 3 starts with `editorial.ts` copy (Steps 1-2) and layout (Step 3) which have no dependencies, it can start immediately — the page creation (Step 4) should wait until Tasks 1 & 2 are committed and merged.
