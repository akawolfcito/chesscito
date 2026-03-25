# Header Button Fix + HoF Blockscout Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invisible header "more" button and rewrite the Hall of Rooks backend to use Blockscout API instead of RPC incremental scan.

**Architecture:** Two independent fixes. (1) Swap `MoreHorizontal` → `MoreVertical` with pill background in the play-hub HUD. (2) Replace `hof-index.ts` (RPC chunked scan + Redis sorted sets) with `hof-blockscout.ts` (single Blockscout API fetch + Redis string cache with 60s TTL). API route contracts unchanged — trophies page needs zero changes.

**Tech Stack:** Next.js 14, lucide-react, viem (decodeEventLog), Upstash Redis, Celo Blockscout API

**Spec:** `docs/superpowers/specs/2026-03-24-header-and-hof-fixes-design.md`

---

### Task 1: Fix header more button

**Files:**
- Modify: `apps/web/src/app/page.tsx:4` (import)
- Modify: `apps/web/src/app/page.tsx:789-797` (JSX)

- [ ] **Step 1: Update import**

In `apps/web/src/app/page.tsx` line 4, change:
```typescript
import { MoreHorizontal } from "lucide-react";
```
to:
```typescript
import { MoreVertical } from "lucide-react";
```

- [ ] **Step 2: Update JSX**

Replace the `moreAction` prop (lines 789-797) from:
```tsx
moreAction={
  <Link
    href="/about"
    className="flex h-11 w-11 items-center justify-center text-cyan-300/50 transition hover:text-cyan-50"
    aria-label="More options"
  >
    <MoreHorizontal size={18} />
  </Link>
}
```
to:
```tsx
moreAction={
  <Link
    href="/about"
    className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-cyan-500/10 text-cyan-300/80 transition hover:text-cyan-50"
    aria-label="More options"
  >
    <MoreVertical size={20} strokeWidth={2.5} />
  </Link>
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean, no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "fix: header more button visibility — vertical dots + pill bg"
```

---

### Task 2: Create `hof-blockscout.ts` — Blockscout fetch + decode + cache

**Files:**
- Create: `apps/web/src/lib/server/hof-blockscout.ts`

**Context:**
- Blockscout endpoint: `https://celo.blockscout.com/api?module=logs&action=getLogs&address={CONTRACT}&fromBlock=61250000&toBlock=latest`
- Response is an array of log objects with `topics`, `data`, `timeStamp`, `blockNumber`, `transactionHash`, `logIndex`
- `topics[0]` = event signature hash, `topics[1]` = player (indexed), `topics[2]` = tokenId (indexed), `topics[3]` = token (indexed)
- `data` = abi-encoded (difficulty, totalMoves, timeMs, totalAmount)
- Decode using viem's `decodeEventLog` with the ABI from `lib/contracts/victory.ts`
- Cache in Redis as JSON strings with 60s TTL
- If Blockscout or Redis fail, degrade gracefully

- [ ] **Step 1: Write the module**

Create `apps/web/src/lib/server/hof-blockscout.ts`:

```typescript
import { Redis } from "@upstash/redis";
import { decodeEventLog } from "viem";

import { victoryAbi } from "@/lib/contracts/victory";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VICTORY_NFT = process.env.NEXT_PUBLIC_VICTORY_NFT_ADDRESS ?? "";
const BLOCKSCOUT_API = "https://celo.blockscout.com/api";
/** VictoryNFT deployed 2026-03-17 — no events before this block. */
const FROM_BLOCK = 61_250_000;
const FETCH_TIMEOUT_MS = 5_000;
const CACHE_TTL_S = 60;

const CACHE_KEYS = {
  all: "hof:v2:all",
  player: (addr: string) => `hof:v2:player:${addr.toLowerCase()}`,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VictoryRow = {
  tokenId: string;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  timestamp: number;
};

type BlockscoutLog = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  timeStamp: string;
  transactionHash: string;
  logIndex: string;
};

type BlockscoutResponse = {
  status: string;
  message: string;
  result: BlockscoutLog[];
};

// ---------------------------------------------------------------------------
// Blockscout fetch + decode
// ---------------------------------------------------------------------------

function decodeVictoryLog(log: BlockscoutLog): VictoryRow | null {
  try {
    const decoded = decodeEventLog({
      abi: victoryAbi,
      data: log.data as `0x${string}`,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
    });

    if (decoded.eventName !== "VictoryMinted") return null;

    const args = decoded.args as {
      player: string;
      tokenId: bigint;
      difficulty: number;
      totalMoves: number;
      timeMs: number;
    };

    return {
      tokenId: args.tokenId.toString(),
      player: args.player,
      difficulty: args.difficulty,
      totalMoves: args.totalMoves,
      timeMs: args.timeMs,
      timestamp: Number(log.timeStamp),
    };
  } catch {
    return null;
  }
}

export async function fetchAllVictories(): Promise<VictoryRow[]> {
  if (!VICTORY_NFT) return [];

  const url = new URL(BLOCKSCOUT_API);
  url.searchParams.set("module", "logs");
  url.searchParams.set("action", "getLogs");
  url.searchParams.set("address", VICTORY_NFT);
  url.searchParams.set("fromBlock", String(FROM_BLOCK));
  url.searchParams.set("toBlock", "latest");

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as BlockscoutResponse;

  if (json.status !== "1" || !Array.isArray(json.result)) return [];

  const rows: VictoryRow[] = [];
  for (const log of json.result) {
    const row = decodeVictoryLog(log);
    if (row) rows.push(row);
  }

  // Sort by timestamp descending (most recent first)
  rows.sort((a, b) => b.timestamp - a.timestamp);

  return rows;
}

// ---------------------------------------------------------------------------
// Redis-cached reads
// ---------------------------------------------------------------------------

function makeRedis(): Redis {
  return Redis.fromEnv();
}

async function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const redis = makeRedis();
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;

    const fresh = await fetcher();
    // Fire-and-forget cache write
    redis.set(key, JSON.stringify(fresh), { ex: CACHE_TTL_S }).catch(() => {});
    return fresh;
  } catch {
    // Redis down — fetch directly
    return fetcher();
  }
}

export async function getHallOfFame(): Promise<VictoryRow[]> {
  return cachedGet(CACHE_KEYS.all, async () => {
    const all = await fetchAllVictories();
    return all.slice(0, 10);
  });
}

export async function getPlayerVictories(
  player: string,
): Promise<VictoryRow[]> {
  return cachedGet(CACHE_KEYS.player(player), async () => {
    const all = await fetchAllVictories();
    return all.filter(
      (v) => v.player.toLowerCase() === player.toLowerCase(),
    );
  });
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/server/hof-blockscout.ts
git commit -m "feat: hof-blockscout module — Blockscout API fetch + Redis cache"
```

---

### Task 3: Rewrite API routes to use hof-blockscout

**Files:**
- Modify: `apps/web/src/app/api/hall-of-fame/route.ts`
- Modify: `apps/web/src/app/api/my-victories/route.ts`

- [ ] **Step 1: Rewrite hall-of-fame route**

Replace `apps/web/src/app/api/hall-of-fame/route.ts` entirely:

```typescript
import { NextResponse } from "next/server";

import { getHallOfFame } from "@/lib/server/hof-blockscout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getHallOfFame();

  return NextResponse.json(rows, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=120",
    },
  });
}
```

- [ ] **Step 2: Rewrite my-victories route**

Replace `apps/web/src/app/api/my-victories/route.ts` entirely:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { getPlayerVictories } from "@/lib/server/hof-blockscout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const player = request.nextUrl.searchParams.get("player");

  if (!player || !isAddress(player)) {
    return NextResponse.json(
      { error: "Missing or invalid player address" },
      { status: 400 },
    );
  }

  const rows = await getPlayerVictories(player);

  return NextResponse.json(rows, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  });
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/hall-of-fame/route.ts apps/web/src/app/api/my-victories/route.ts
git commit -m "refactor: rewrite HoF API routes to use Blockscout"
```

---

### Task 4: Delete dead code

**Files:**
- Delete: `apps/web/src/lib/server/hof-index.ts`
- Delete: `apps/web/scripts/backfill-hof.ts`
- Modify: `apps/web/src/lib/coach/redis-keys.ts` (remove HOF_KEYS)

- [ ] **Step 1: Delete hof-index.ts**

```bash
rm apps/web/src/lib/server/hof-index.ts
```

- [ ] **Step 2: Delete backfill-hof.ts**

```bash
rm apps/web/scripts/backfill-hof.ts
```

- [ ] **Step 3: Remove HOF_KEYS from redis-keys.ts**

In `apps/web/src/lib/coach/redis-keys.ts`, remove lines 12-17 (the entire `HOF_KEYS` export):

```typescript
export const HOF_KEYS = {
  lastBlock: "hof:lastBlock",
  entries: "hof:entries",
  player: (address: string) => `hof:player:${address.toLowerCase()}`,
  refreshLock: "hof:refresh:lock",
} as const;
```

The file should only contain the `REDIS_KEYS` export after this change.

- [ ] **Step 4: Check for remaining imports of deleted code**

Run: `cd apps/web && grep -r "hof-index\|backfill-hof\|HOF_KEYS" src/ scripts/ --include="*.ts" --include="*.tsx"`
Expected: no results

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Check if backfill script is referenced in package.json**

Run: `grep -r "backfill" apps/web/package.json`
If found, remove the script entry.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/server/hof-index.ts apps/web/scripts/backfill-hof.ts apps/web/src/lib/coach/redis-keys.ts apps/web/package.json
git commit -m "refactor: remove dead HoF incremental scan code"
```

---

### Task 5: Smoke test — verify /trophies loads

- [ ] **Step 1: Start dev server**

Run: `cd apps/web && pnpm dev`

- [ ] **Step 2: Test hall-of-fame endpoint**

Run: `curl -s http://localhost:3000/api/hall-of-fame | head -c 500`
Expected: JSON array (may be empty `[]` or contain victory rows). Must NOT return an error or timeout.

- [ ] **Step 3: Test my-victories endpoint**

Run: `curl -s "http://localhost:3000/api/my-victories?player=0x0000000000000000000000000000000000000000" | head -c 500`
Expected: `[]` (no victories for zero address)

- [ ] **Step 4: Test invalid player param**

Run: `curl -s "http://localhost:3000/api/my-victories?player=invalid"`
Expected: `{"error":"Missing or invalid player address"}` with 400 status

- [ ] **Step 5: Stop dev server**

Stop the dev server (Ctrl+C).

- [ ] **Step 6: Final build check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean

- [ ] **Step 7: Commit (if any fixes were needed)**

Only if smoke tests revealed issues that needed fixing.
