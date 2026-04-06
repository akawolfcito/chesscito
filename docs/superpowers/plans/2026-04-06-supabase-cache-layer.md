# Supabase Cache Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace slow blockchain RPC / Blockscout reads for leaderboard and hall of fame with Supabase queries (~5ms), adding write-through and cron sync to keep data fresh.

**Architecture:** Three-layer writes (optimistic local → write-through API → cron safety net) with Supabase as the single read source. Existing blockchain scan logic is preserved in the cron sync module but removed from the hot read path.

**Tech Stack:** Supabase (Postgres), Next.js API routes, ethers.js (cron only), Vercel Cron

**Spec:** `docs/superpowers/specs/2026-04-06-supabase-cache-layer-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/supabase/schema.sql` | Create | DDL: tables, indices, view |
| `lib/supabase/queries.ts` | Create | Typed Supabase read/write helpers |
| `app/api/cache-score/route.ts` | Create | Write-through endpoint for scores |
| `app/api/cache-victory/route.ts` | Create | Write-through endpoint for victories |
| `lib/server/sync-blockchain.ts` | Create | Cron sync logic: events → Supabase |
| `app/api/cron/sync/route.ts` | Create | Vercel cron endpoint |
| `scripts/seed-supabase.ts` | Create | One-shot historical migration |
| `vercel.json` | Create | Cron schedule config |
| `lib/server/leaderboard.ts` | Rewrite | Supabase query replaces ethers.js scan |
| `lib/server/hof.ts` | Create (rename) | Supabase query replaces Blockscout |
| `app/api/leaderboard/route.ts` | Modify | Remove cache headers, use new leaderboard.ts |
| `app/api/hall-of-fame/route.ts` | Modify | Import from hof.ts instead of hof-blockscout.ts |
| `app/api/my-victories/route.ts` | Modify | Import from hof.ts instead of hof-blockscout.ts |
| `app/page.tsx` | Modify | Add write-through call + optimistic score |
| `app/arena/page.tsx` | Modify | Add write-through call + optimistic victory |
| `components/play-hub/leaderboard-sheet.tsx` | Modify | Merge optimistic entry |
| `app/trophies/page.tsx` | Modify | Merge optimistic victory |

---

### Task 1: Schema DDL

**Files:**
- Create: `apps/web/src/lib/supabase/schema.sql`

- [ ] **Step 1: Write the schema file**

```sql
-- Chesscito: Supabase cache layer for leaderboard + hall of fame
-- Run this in the Supabase SQL Editor to create all tables, indices, and views.

-- Scores (one row per ScoreSubmitted event)
CREATE TABLE IF NOT EXISTS scores (
  id serial PRIMARY KEY,
  player text NOT NULL CHECK (player = lower(player)),
  level_id int NOT NULL,
  score int NOT NULL,
  time_ms int NOT NULL,
  tx_hash text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_player_level
  ON scores (player, level_id, score DESC);

-- Victories (one row per VictoryMinted event)
CREATE TABLE IF NOT EXISTS victories (
  id serial PRIMARY KEY,
  token_id bigint UNIQUE NOT NULL,
  player text NOT NULL CHECK (player = lower(player)),
  difficulty smallint NOT NULL,
  total_moves int NOT NULL,
  time_ms int NOT NULL,
  tx_hash text UNIQUE NOT NULL,
  minted_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_victories_player ON victories (player);

-- Passport verification cache
CREATE TABLE IF NOT EXISTS passport_cache (
  player text PRIMARY KEY CHECK (player = lower(player)),
  is_verified boolean DEFAULT false,
  checked_at timestamptz DEFAULT now()
);

-- Sync state (tracks last synced block for cron)
CREATE TABLE IF NOT EXISTS sync_state (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Leaderboard view: best score per player per level, summed, ranked
CREATE OR REPLACE VIEW leaderboard_v AS
SELECT
  sub.player,
  SUM(sub.best_score)::int AS total_score,
  RANK() OVER (ORDER BY SUM(sub.best_score) DESC, sub.player ASC)::int AS rank,
  COALESCE(pc.is_verified, false) AS is_verified
FROM (
  SELECT player, level_id, MAX(score) AS best_score
  FROM scores
  GROUP BY player, level_id
) sub
LEFT JOIN passport_cache pc ON pc.player = sub.player
GROUP BY sub.player, pc.is_verified
ORDER BY total_score DESC, sub.player ASC
LIMIT 10;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/supabase/schema.sql
git commit -m "feat(db): add Supabase schema for leaderboard cache layer"
```

---

### Task 2: Supabase Query Helpers

**Files:**
- Create: `apps/web/src/lib/supabase/queries.ts`
- Reference: `apps/web/src/lib/supabase/server.ts` (existing `getSupabaseServer()`)

- [ ] **Step 1: Create typed query helpers**

```typescript
import { getSupabaseServer } from "./server";

// -- Types ------------------------------------------------------------------

export type ScoreRow = {
  player: string;
  level_id: number;
  score: number;
  time_ms: number;
  tx_hash: string;
};

export type VictoryRow = {
  token_id: number;
  player: string;
  difficulty: number;
  total_moves: number;
  time_ms: number;
  tx_hash: string;
  minted_at: string;
};

export type LeaderboardRow = {
  rank: number;
  player: string;
  total_score: number;
  is_verified: boolean;
};

// -- Writes -----------------------------------------------------------------

export async function insertScore(row: ScoreRow): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;

  await sb.from("scores").upsert(
    {
      player: row.player.toLowerCase(),
      level_id: row.level_id,
      score: row.score,
      time_ms: row.time_ms,
      tx_hash: row.tx_hash,
    },
    { onConflict: "tx_hash", ignoreDuplicates: true },
  );
}

export async function insertVictory(row: VictoryRow): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;

  await sb.from("victories").upsert(
    {
      token_id: row.token_id,
      player: row.player.toLowerCase(),
      difficulty: row.difficulty,
      total_moves: row.total_moves,
      time_ms: row.time_ms,
      tx_hash: row.tx_hash,
      minted_at: row.minted_at,
    },
    { onConflict: "tx_hash", ignoreDuplicates: true },
  );
}

export async function upsertScoreAuthoritative(row: ScoreRow): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;

  // Cron is authoritative — overwrites any manipulated write-through data
  await sb.from("scores").upsert(
    {
      player: row.player.toLowerCase(),
      level_id: row.level_id,
      score: row.score,
      time_ms: row.time_ms,
      tx_hash: row.tx_hash,
    },
    { onConflict: "tx_hash" },
  );
}

export async function upsertVictoryAuthoritative(row: VictoryRow): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;

  await sb.from("victories").upsert(
    {
      token_id: row.token_id,
      player: row.player.toLowerCase(),
      difficulty: row.difficulty,
      total_moves: row.total_moves,
      time_ms: row.time_ms,
      tx_hash: row.tx_hash,
      minted_at: row.minted_at,
    },
    { onConflict: "tx_hash" },
  );
}

// -- Reads ------------------------------------------------------------------

export async function fetchLeaderboardFromDb(): Promise<LeaderboardRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];

  const { data, error } = await sb
    .from("leaderboard_v")
    .select("player, total_score, rank, is_verified");

  if (error || !data) return [];
  return data as LeaderboardRow[];
}

export async function fetchHallOfFame(): Promise<VictoryRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];

  const { data, error } = await sb
    .from("victories")
    .select("token_id, player, difficulty, total_moves, time_ms, tx_hash, minted_at")
    .order("minted_at", { ascending: false })
    .limit(10);

  if (error || !data) return [];
  return data as VictoryRow[];
}

export async function fetchPlayerVictories(player: string): Promise<VictoryRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];

  const { data, error } = await sb
    .from("victories")
    .select("token_id, player, difficulty, total_moves, time_ms, tx_hash, minted_at")
    .eq("player", player.toLowerCase())
    .order("minted_at", { ascending: false });

  if (error || !data) return [];
  return data as VictoryRow[];
}

// -- Sync state -------------------------------------------------------------

export async function getSyncState(key: string): Promise<string | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;

  const { data } = await sb
    .from("sync_state")
    .select("value")
    .eq("key", key)
    .single();

  return data?.value ?? null;
}

export async function setSyncState(key: string, value: string): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;

  await sb.from("sync_state").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

// -- Passport cache ---------------------------------------------------------

export async function upsertPassportCache(
  entries: { player: string; is_verified: boolean }[],
): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb || entries.length === 0) return;

  await sb.from("passport_cache").upsert(
    entries.map((e) => ({
      player: e.player.toLowerCase(),
      is_verified: e.is_verified,
      checked_at: new Date().toISOString(),
    })),
    { onConflict: "player" },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/supabase/queries.ts
git commit -m "feat(db): add typed Supabase read/write query helpers"
```

---

### Task 3: Write-Through API Routes

**Files:**
- Create: `apps/web/src/app/api/cache-score/route.ts`
- Create: `apps/web/src/app/api/cache-victory/route.ts`
- Reference: `apps/web/src/lib/server/demo-signing.ts` (for `enforceOrigin`)

- [ ] **Step 1: Create cache-score route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { insertScore } from "@/lib/supabase/queries";
import { enforceOrigin } from "@/lib/server/demo-signing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try { enforceOrigin(request); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { player, levelId, score, timeMs, txHash } = body as Record<string, unknown>;

  if (
    typeof player !== "string" || !isAddress(player) ||
    typeof levelId !== "number" || levelId < 1 || levelId > 6 ||
    typeof score !== "number" || score <= 0 ||
    typeof timeMs !== "number" || timeMs <= 0 ||
    typeof txHash !== "string" || !txHash.startsWith("0x")
  ) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  await insertScore({
    player: player.toLowerCase(),
    level_id: levelId,
    score,
    time_ms: timeMs,
    tx_hash: txHash,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create cache-victory route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { insertVictory } from "@/lib/supabase/queries";
import { enforceOrigin } from "@/lib/server/demo-signing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try { enforceOrigin(request); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { player, tokenId, difficulty, totalMoves, timeMs, txHash } = body as Record<string, unknown>;

  if (
    typeof player !== "string" || !isAddress(player) ||
    typeof tokenId !== "string" ||
    typeof difficulty !== "number" || difficulty < 1 || difficulty > 3 ||
    typeof totalMoves !== "number" || totalMoves <= 0 ||
    typeof timeMs !== "number" || timeMs <= 0 ||
    typeof txHash !== "string" || !txHash.startsWith("0x")
  ) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  await insertVictory({
    token_id: Number(tokenId),
    player: player.toLowerCase(),
    difficulty,
    total_moves: totalMoves,
    time_ms: timeMs,
    tx_hash: txHash,
    minted_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/cache-score/route.ts apps/web/src/app/api/cache-victory/route.ts
git commit -m "feat(api): add write-through cache endpoints for scores and victories"
```

---

### Task 4: Rewrite Read Path (Leaderboard + HOF)

**Files:**
- Rewrite: `apps/web/src/lib/server/leaderboard.ts`
- Create: `apps/web/src/lib/server/hof.ts`
- Modify: `apps/web/src/app/api/leaderboard/route.ts`
- Modify: `apps/web/src/app/api/hall-of-fame/route.ts`
- Modify: `apps/web/src/app/api/my-victories/route.ts`

- [ ] **Step 1: Rewrite leaderboard.ts**

Replace the entire file content:

```typescript
import { fetchLeaderboardFromDb, type LeaderboardRow as DbRow } from "@/lib/supabase/queries";

export type LeaderboardRow = {
  rank: number;
  player: string;
  score: number;
  isVerified?: boolean;
};

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const rows = await fetchLeaderboardFromDb();

  return rows.map((r) => ({
    rank: r.rank,
    player: r.player.slice(0, 6) + "..." + r.player.slice(-4),
    score: r.total_score,
    isVerified: r.is_verified,
  }));
}
```

- [ ] **Step 2: Create hof.ts**

```typescript
import {
  fetchHallOfFame as fetchHofFromDb,
  fetchPlayerVictories as fetchPlayerFromDb,
  type VictoryRow as DbVictoryRow,
} from "@/lib/supabase/queries";

export type VictoryRow = {
  tokenId: string;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  timestamp: number;
};

function toApiRow(row: DbVictoryRow): VictoryRow {
  return {
    tokenId: String(row.token_id),
    player: row.player,
    difficulty: row.difficulty,
    totalMoves: row.total_moves,
    timeMs: row.time_ms,
    timestamp: Math.floor(new Date(row.minted_at).getTime() / 1000),
  };
}

export async function getHallOfFame(): Promise<VictoryRow[]> {
  const rows = await fetchHofFromDb();
  return rows.map(toApiRow);
}

export async function getPlayerVictories(player: string): Promise<VictoryRow[]> {
  const rows = await fetchPlayerFromDb(player);
  return rows.map(toApiRow);
}
```

- [ ] **Step 3: Update API route — leaderboard**

Replace `apps/web/src/app/api/leaderboard/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { fetchLeaderboard } from "@/lib/server/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { LeaderboardRow } from "@/lib/server/leaderboard";

export async function GET() {
  try {
    const rows = await fetchLeaderboard();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Update API route — hall-of-fame**

Replace `apps/web/src/app/api/hall-of-fame/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { getHallOfFame } from "@/lib/server/hof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getHallOfFame();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch hall of fame" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Update API route — my-victories**

Replace `apps/web/src/app/api/my-victories/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { getPlayerVictories } from "@/lib/server/hof";
import { enforceOrigin } from "@/lib/server/demo-signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try { enforceOrigin(request); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const player = request.nextUrl.searchParams.get("player");

  if (!player || !isAddress(player)) {
    return NextResponse.json(
      { error: "Missing or invalid player address" },
      { status: 400 },
    );
  }

  const rows = await getPlayerVictories(player);

  return NextResponse.json(rows);
}
```

- [ ] **Step 6: Build to verify no type errors**

Run: `npm run build` from monorepo root.
Expected: clean build with no import errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/server/leaderboard.ts apps/web/src/lib/server/hof.ts \
  apps/web/src/app/api/leaderboard/route.ts \
  apps/web/src/app/api/hall-of-fame/route.ts \
  apps/web/src/app/api/my-victories/route.ts
git commit -m "feat(api): rewrite read path to use Supabase instead of RPC/Blockscout"
```

---

### Task 5: Cron Sync

**Files:**
- Create: `apps/web/src/lib/server/sync-blockchain.ts`
- Create: `apps/web/src/app/api/cron/sync/route.ts`
- Create: `apps/web/vercel.json`
- Reference: `apps/web/src/lib/contracts/scoreboard.ts` (ScoreSubmitted ABI)
- Reference: `apps/web/src/lib/contracts/victory.ts` (VictoryMinted ABI)

- [ ] **Step 1: Create sync-blockchain.ts**

```typescript
import { ethers } from "ethers";
import { decodeEventLog } from "viem";

import { scoreboardAbi } from "@/lib/contracts/scoreboard";
import { victoryAbi } from "@/lib/contracts/victory";
import { checkPassportScores } from "@/lib/server/passport";
import {
  upsertScoreAuthoritative,
  upsertVictoryAuthoritative,
  upsertPassportCache,
  fetchLeaderboardFromDb,
  getSyncState,
  setSyncState,
} from "@/lib/supabase/queries";

const RPC_URL = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const SCOREBOARD_ADDRESS = process.env.NEXT_PUBLIC_SCOREBOARD_ADDRESS ?? "";
const VICTORY_NFT_ADDRESS = process.env.NEXT_PUBLIC_VICTORY_NFT_ADDRESS ?? "";

const SCORE_SUBMITTED_TOPIC = ethers.id(
  "ScoreSubmitted(address,uint256,uint256,uint256,uint256,uint256)",
);
const VICTORY_MINTED_TOPIC = ethers.id(
  "VictoryMinted(address,uint256,uint8,uint16,uint32,address,uint256)",
);

/** Deploy block for Scoreboard contract */
const DEFAULT_FROM_BLOCK = 61_113_664;
const SYNC_KEY = "last_synced_block";
const CHUNK_SIZE = 50_000;

async function getLogsPaginated(
  provider: ethers.JsonRpcProvider,
  filter: { address: string; topics: string[]; fromBlock: number; toBlock: number },
): Promise<ethers.Log[]> {
  const allLogs: ethers.Log[] = [];
  let from = filter.fromBlock;
  while (from <= filter.toBlock) {
    const to = Math.min(from + CHUNK_SIZE - 1, filter.toBlock);
    const chunk = await provider.getLogs({ ...filter, fromBlock: from, toBlock: to });
    allLogs.push(...chunk);
    from = to + 1;
  }
  return allLogs;
}

async function syncScores(
  provider: ethers.JsonRpcProvider,
  fromBlock: number,
  toBlock: number,
): Promise<number> {
  if (!SCOREBOARD_ADDRESS) return 0;

  const logs = await getLogsPaginated(provider, {
    address: SCOREBOARD_ADDRESS,
    topics: [SCORE_SUBMITTED_TOPIC],
    fromBlock,
    toBlock,
  });

  let count = 0;
  for (const log of logs) {
    try {
      const topic1 = log.topics[1];
      const topic2 = log.topics[2];
      if (!topic1 || topic1.length < 42 || !topic2) continue;
      if (!log.data || log.data.length < 66) continue;

      const player = ethers.getAddress("0x" + topic1.slice(26));
      const levelId = Number(ethers.toBigInt(topic2));
      const score = Number(ethers.toBigInt(log.data.slice(0, 66)));
      // timeMs is the second 32-byte word in data
      const timeMs = log.data.length >= 130
        ? Number(ethers.toBigInt("0x" + log.data.slice(66, 130)))
        : 0;

      if (!Number.isSafeInteger(score) || score <= 0) continue;

      await upsertScoreAuthoritative({
        player,
        level_id: levelId,
        score,
        time_ms: timeMs,
        tx_hash: log.transactionHash,
      });
      count++;
    } catch {
      continue;
    }
  }

  return count;
}

async function syncVictories(
  provider: ethers.JsonRpcProvider,
  fromBlock: number,
  toBlock: number,
): Promise<number> {
  if (!VICTORY_NFT_ADDRESS) return 0;

  const logs = await getLogsPaginated(provider, {
    address: VICTORY_NFT_ADDRESS,
    topics: [VICTORY_MINTED_TOPIC],
    fromBlock,
    toBlock,
  });

  let count = 0;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: victoryAbi,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "VictoryMinted") continue;

      const args = decoded.args as {
        player: string;
        tokenId: bigint;
        difficulty: number;
        totalMoves: number;
        timeMs: number;
      };

      // Get block timestamp
      const block = await provider.getBlock(log.blockNumber);
      const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

      await upsertVictoryAuthoritative({
        token_id: Number(args.tokenId),
        player: args.player,
        difficulty: args.difficulty,
        total_moves: args.totalMoves,
        time_ms: args.timeMs,
        tx_hash: log.transactionHash,
        minted_at: timestamp,
      });
      count++;
    } catch {
      continue;
    }
  }

  return count;
}

async function syncPassport(): Promise<void> {
  const rows = await fetchLeaderboardFromDb();
  if (rows.length === 0) return;

  const addresses = rows.map((r) => r.player);
  const verifiedMap = await checkPassportScores(addresses);

  const entries = addresses.map((addr) => ({
    player: addr,
    is_verified: verifiedMap.get(addr) ?? false,
  }));

  await upsertPassportCache(entries);
}

export async function runSync(): Promise<{
  fromBlock: number;
  toBlock: number;
  scores: number;
  victories: number;
}> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const currentBlock = await provider.getBlockNumber();

  const lastSynced = await getSyncState(SYNC_KEY);
  const fromBlock = lastSynced ? Number(lastSynced) + 1 : DEFAULT_FROM_BLOCK;

  if (fromBlock > currentBlock) {
    return { fromBlock, toBlock: currentBlock, scores: 0, victories: 0 };
  }

  const scores = await syncScores(provider, fromBlock, currentBlock);
  const victories = await syncVictories(provider, fromBlock, currentBlock);

  await syncPassport();
  await setSyncState(SYNC_KEY, String(currentBlock));

  return { fromBlock, toBlock: currentBlock, scores, victories };
}
```

- [ ] **Step 2: Create cron route**

```typescript
import { NextRequest, NextResponse } from "next/server";

import { runSync } from "@/lib/server/sync-blockchain";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/sync] failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build` from monorepo root.
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/sync-blockchain.ts \
  apps/web/src/app/api/cron/sync/route.ts \
  apps/web/vercel.json
git commit -m "feat(cron): add blockchain sync job (every 5 min) with passport cache"
```

---

### Task 6: Seed Script (Historical Migration)

**Files:**
- Create: `apps/web/scripts/seed-supabase.ts`
- Reference: `apps/web/src/lib/server/sync-blockchain.ts` (reuses `runSync`)

- [ ] **Step 1: Create seed script**

```typescript
/**
 * One-shot migration: reads all historical on-chain events and inserts
 * them into Supabase. Idempotent — safe to re-run (ON CONFLICT).
 *
 * Usage: npx tsx apps/web/scripts/seed-supabase.ts
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CELO_RPC_URL, NEXT_PUBLIC_SCOREBOARD_ADDRESS, NEXT_PUBLIC_VICTORY_NFT_ADDRESS
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load env from apps/web/.env
config({ path: resolve(__dirname, "../.env") });

async function main() {
  // Dynamic import so env vars are loaded first
  const { runSync } = await import("../src/lib/server/sync-blockchain");

  console.log("Starting historical seed...");
  const result = await runSync();
  console.log("Seed complete:", result);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/scripts/seed-supabase.ts
git commit -m "feat(scripts): add one-shot Supabase seed for historical blockchain data"
```

---

### Task 7: Frontend Optimistic Updates — Score

**Files:**
- Modify: `apps/web/src/app/page.tsx` (handleSubmitScore, around line 557-601)
- Modify: `apps/web/src/components/play-hub/leaderboard-sheet.tsx`

- [ ] **Step 1: Add write-through + optimistic storage in page.tsx**

After the successful `handleSubmitScore` result overlay (inside the try block, after `setResultOverlay`), add:

```typescript
      // Write-through to Supabase (fire-and-forget)
      void fetch("/api/cache-score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: address,
          levelId: Number(levelId),
          score: Number(score),
          timeMs: Number(timeMs),
          txHash: txHash,
        }),
      }).catch(() => {}); // fire-and-forget

      // Optimistic entry for leaderboard
      try {
        sessionStorage.setItem(
          "chesscito:optimistic-score",
          JSON.stringify({
            player: address.toLowerCase(),
            score: Number(score),
            levelId: Number(levelId),
            ts: Date.now(),
          }),
        );
      } catch { /* storage unavailable */ }
```

- [ ] **Step 2: Merge optimistic entry in leaderboard-sheet.tsx**

Add a helper to read and merge the optimistic entry. Update the component's fetch callback to merge after API data arrives.

At the top of the file, add helper:

```typescript
const OPTIMISTIC_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getOptimisticScore(): { player: string; score: number } | null {
  try {
    const raw = sessionStorage.getItem("chesscito:optimistic-score");
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > OPTIMISTIC_TTL_MS) {
      sessionStorage.removeItem("chesscito:optimistic-score");
      return null;
    }
    return { player: entry.player, score: entry.score };
  } catch {
    return null;
  }
}

function clearOptimisticScore() {
  try { sessionStorage.removeItem("chesscito:optimistic-score"); } catch { /* ignore */ }
}
```

In `fetchLeaderboard`, after `setRows(...)`, add merge logic:

```typescript
      .then((data: unknown) => {
        const apiRows = Array.isArray(data) ? data as LeaderboardRow[] : [];
        const optimistic = getOptimisticScore();
        if (optimistic) {
          // If player already appears in API data, optimistic is confirmed — clear it
          const found = apiRows.some(
            (r) => r.player.includes(optimistic.player.slice(2, 6)),
          );
          if (found) {
            clearOptimisticScore();
            setRows(apiRows);
            return;
          }
          // Otherwise merge optimistic as unranked entry at the bottom
          const truncated = optimistic.player.slice(0, 6) + "..." + optimistic.player.slice(-4);
          setRows([
            ...apiRows,
            { rank: apiRows.length + 1, player: truncated, score: optimistic.score, isVerified: false },
          ]);
        } else {
          setRows(apiRows);
        }
      })
```

- [ ] **Step 3: Build to verify**

Run: `npm run build` from monorepo root.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/play-hub/leaderboard-sheet.tsx
git commit -m "feat(ux): add optimistic score in leaderboard + write-through cache"
```

---

### Task 8: Frontend Optimistic Updates — Victory

**Files:**
- Modify: `apps/web/src/app/arena/page.tsx` (handleClaimVictory, around line 377-384)
- Modify: `apps/web/src/app/trophies/page.tsx`

- [ ] **Step 1: Add write-through + optimistic storage in arena/page.tsx**

After `setClaimPhase("success")` inside handleClaimVictory's try block, add:

```typescript
      // Write-through to Supabase (fire-and-forget)
      void fetch("/api/cache-victory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: address,
          tokenId: extractedTokenId ? String(extractedTokenId) : "0",
          difficulty: chainDifficulty,
          totalMoves: game.moveCount,
          timeMs: game.elapsedMs,
          txHash: claimHash,
        }),
      }).catch(() => {}); // fire-and-forget

      // Optimistic entry for trophies page
      try {
        sessionStorage.setItem(
          "chesscito:optimistic-victory",
          JSON.stringify({
            tokenId: extractedTokenId ? String(extractedTokenId) : "0",
            player: address.toLowerCase(),
            difficulty: chainDifficulty,
            totalMoves: game.moveCount,
            timeMs: game.elapsedMs,
            ts: Date.now(),
          }),
        );
      } catch { /* storage unavailable */ }
```

- [ ] **Step 2: Merge optimistic entry in trophies/page.tsx**

Add helpers at the top of the file:

```typescript
const OPTIMISTIC_TTL_MS = 2 * 60 * 1000;

function getOptimisticVictory(): ApiVictoryRow | null {
  try {
    const raw = sessionStorage.getItem("chesscito:optimistic-victory");
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > OPTIMISTIC_TTL_MS) {
      sessionStorage.removeItem("chesscito:optimistic-victory");
      return null;
    }
    return {
      tokenId: entry.tokenId,
      player: entry.player,
      difficulty: entry.difficulty,
      totalMoves: entry.totalMoves,
      timeMs: entry.timeMs,
      timestamp: Math.floor(entry.ts / 1000),
    };
  } catch {
    return null;
  }
}

function clearOptimisticVictory() {
  try { sessionStorage.removeItem("chesscito:optimistic-victory"); } catch { /* ignore */ }
}
```

In `loadHallOfFame`, after `setHallOfFame(rows.map(toVictoryEntry))`, add merge:

```typescript
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic) {
        const found = entries.some((e) => e.player.toLowerCase() === optimistic.player.toLowerCase());
        if (found) {
          clearOptimisticVictory();
        } else {
          entries.unshift(toVictoryEntry(optimistic));
        }
      }
      setHallOfFame(entries);
```

Same pattern in `loadMyVictories`:

```typescript
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic && optimistic.player.toLowerCase() === address?.toLowerCase()) {
        const found = entries.some((e) => String(e.tokenId) === optimistic.tokenId);
        if (found) {
          clearOptimisticVictory();
        } else {
          entries.unshift(toVictoryEntry(optimistic));
        }
      }
      setMyVictories(entries);
```

- [ ] **Step 3: Build to verify**

Run: `npm run build` from monorepo root.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/arena/page.tsx apps/web/src/app/trophies/page.tsx
git commit -m "feat(ux): add optimistic victory in trophies + write-through cache"
```

---

### Task 9: Cleanup + Final Verification

**Files:**
- Delete: `apps/web/src/lib/server/hof-blockscout.ts`

- [ ] **Step 1: Verify no remaining imports of hof-blockscout**

Search for `hof-blockscout` across the codebase. All 3 API routes should now import from `hof.ts`.

Run: `grep -r "hof-blockscout" apps/web/src/`
Expected: no results.

- [ ] **Step 2: Delete hof-blockscout.ts**

```bash
rm apps/web/src/lib/server/hof-blockscout.ts
```

- [ ] **Step 3: Run full build + tests**

```bash
npm run build && npm run test
```

Expected: clean build, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove hof-blockscout.ts, replaced by Supabase read path"
```

---

### Task 10: Run Supabase Schema + Seed

This task is manual — requires access to Supabase dashboard.

- [ ] **Step 1: Run schema DDL in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → paste contents of `apps/web/src/lib/supabase/schema.sql` → Run.

- [ ] **Step 2: Run seed script**

```bash
npx tsx apps/web/scripts/seed-supabase.ts
```

Expected: prints `Seed complete: { fromBlock: 61113664, toBlock: <current>, scores: N, victories: N }`

- [ ] **Step 3: Verify in Supabase Table Editor**

Check that `scores`, `victories`, and `sync_state` tables have data.

- [ ] **Step 4: Set CRON_SECRET env var in Vercel**

Add `CRON_SECRET` to Vercel project environment variables. Vercel uses this to authenticate cron invocations.

---

## Spec Coverage Check

| Spec Requirement | Task |
|------------------|------|
| Schema (scores, victories, passport_cache, sync_state, leaderboard_v) | Task 1 |
| Write-through endpoints (cache-score, cache-victory) | Task 3 |
| Cron sync with DO UPDATE (authoritative) | Task 5 |
| Cron auth (CRON_SECRET) | Task 5 |
| Read path: leaderboard from Supabase | Task 4 |
| Read path: hall of fame from Supabase | Task 4 |
| Read path: my-victories from Supabase | Task 4 |
| Optimistic score + 2min TTL | Task 7 |
| Optimistic victory + 2min TTL | Task 8 |
| Historical migration (seed script) | Task 6 |
| Delete hof-blockscout.ts | Task 9 |
| vercel.json cron config | Task 5 |
| Passport cache update in cron | Task 5 |
