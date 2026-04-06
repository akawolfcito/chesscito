# Supabase Cache Layer for Leaderboard + Hall of Fame

**Date:** 2026-04-06
**Status:** Approved
**Problem:** Leaderboard and Hall of Fame load slowly because they scan blockchain events on every request (ethers.js RPC for scores, Blockscout API for victories). A single user submitting a score waits 30+ seconds to see themselves in the leaderboard.

## Architecture

Three-layer write strategy with Supabase as the single read source:

1. **Optimistic (frontend)** — after tx confirmation in wallet, insert into local React state. UI shows the player immediately. Cleans up if Supabase doesn't confirm on next fetch.
2. **Write-through (API)** — after `waitForTransactionReceipt`, frontend calls `POST /api/cache-score` or `POST /api/cache-victory` with tx data. API route inserts into Supabase.
3. **Cron safety net (every 5 min)** — reads new on-chain events since `last_synced_block`, inserts with `ON CONFLICT (tx_hash) DO UPDATE` (cron is authoritative — overwrites any manipulated write-through data), updates passport verification cache.

Read path: all API routes query Supabase directly (~5ms). No blockchain RPC, no Blockscout, no Redis.

## Schema

### `scores`

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| player | text | NOT NULL, CHECK (player = lower(player)) |
| level_id | int | NOT NULL, 1-6 |
| score | int | NOT NULL |
| time_ms | int | NOT NULL |
| tx_hash | text | UNIQUE, NOT NULL |
| created_at | timestamptz | DEFAULT now() |

Indices: `(player, level_id, score DESC)`, `(tx_hash)` (implicit from UNIQUE)

### `victories`

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| token_id | bigint | UNIQUE, NOT NULL |
| player | text | NOT NULL, CHECK (player = lower(player)) |
| difficulty | smallint | NOT NULL, 1-3 |
| total_moves | int | NOT NULL |
| time_ms | int | NOT NULL |
| tx_hash | text | UNIQUE, NOT NULL |
| minted_at | timestamptz | NOT NULL |

Indices: `(player)`, `(token_id)` (implicit), `(tx_hash)` (implicit)

### `passport_cache`

| Column | Type | Constraints |
|--------|------|-------------|
| player | text | PRIMARY KEY, CHECK (player = lower(player)) |
| is_verified | boolean | DEFAULT false |
| checked_at | timestamptz | DEFAULT now() |

### `sync_state`

| Column | Type | Constraints |
|--------|------|-------------|
| key | text | PRIMARY KEY |
| value | text | NOT NULL |
| updated_at | timestamptz | DEFAULT now() |

Stores `last_synced_block` for the cron to know where to resume.

### `leaderboard_v` (Postgres view)

```sql
CREATE OR REPLACE VIEW leaderboard_v AS
SELECT
  sub.player,
  SUM(sub.best_score)::int AS total_score,
  RANK() OVER (ORDER BY SUM(sub.best_score) DESC) AS rank,
  pc.is_verified
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

## Write-Through Endpoints

### `POST /api/cache-score`

Called by frontend after successful `submitScoreSigned` tx receipt.

**Body:**
```json
{
  "player": "0x...",
  "levelId": 1,
  "score": 300,
  "timeMs": 4500,
  "txHash": "0x..."
}
```

**Logic:**
1. Validate fields (address format, levelId 1-6, score > 0)
2. Normalize player to lowercase
3. Insert into `scores` with `ON CONFLICT (tx_hash) DO NOTHING`
4. Return 200 (fire-and-forget from frontend perspective)

### `POST /api/cache-victory`

Called by frontend after successful `mintSigned` tx receipt.

**Body:**
```json
{
  "player": "0x...",
  "tokenId": "47",
  "difficulty": 2,
  "totalMoves": 24,
  "timeMs": 180000,
  "txHash": "0x..."
}
```

**Logic:**
1. Validate fields
2. Normalize player to lowercase
3. Insert into `victories` with `ON CONFLICT (tx_hash) DO NOTHING`
4. Return 200

Both endpoints use `enforceOrigin()` for basic protection. No additional auth needed — the data is public on-chain anyway. Write-through inserts with `DO NOTHING` (fast, optimistic). The cron is the authoritative writer — it uses `DO UPDATE` to overwrite any manipulated data within the 5-minute window.

## Cron Sync

**Endpoint:** `GET /api/cron/sync`
**Schedule:** Every 5 minutes (`*/5 * * * *` in vercel.json)
**Authorization:** Vercel injects `Authorization: Bearer <CRON_SECRET>`. Validate with `request.headers.get('authorization') === \`Bearer ${process.env.CRON_SECRET}\``.

**Logic:**
1. Read `last_synced_block` from `sync_state` (default: deploy block)
2. Fetch `ScoreSubmitted` events from `last_synced_block + 1` to `latest` via ethers.js
3. Fetch `VictoryMinted` events in same range via ethers.js
4. Batch insert scores with `ON CONFLICT (tx_hash) DO UPDATE SET score=EXCLUDED.score, time_ms=EXCLUDED.time_ms` (authoritative overwrite); victories with same pattern
5. Update `passport_cache` for top-10 leaderboard players
6. Write new `last_synced_block` to `sync_state`

Uses the same Celo RPC as the current implementation (`CELO_RPC_URL`).

## Frontend Optimistic Updates

### Score Submission (page.tsx)

After `handleSubmitScore` succeeds:
1. Fire-and-forget `POST /api/cache-score` with tx data
2. Store optimistic entry in sessionStorage: `chesscito:optimistic-score`
3. LeaderboardSheet merges optimistic entry with API data on render
4. On next API fetch, if the score appears in Supabase data, clear optimistic entry
5. TTL guard: discard optimistic entry if older than 2 minutes (covers write-through failure)

### Victory Claim (arena/page.tsx)

After `handleClaimVictory` succeeds:
1. Fire-and-forget `POST /api/cache-victory` with tx data
2. Store optimistic entry in sessionStorage: `chesscito:optimistic-victory`
3. Trophies page merges optimistic entry on render
4. On next API fetch, clear if present in Supabase data
5. TTL guard: discard optimistic entry if older than 2 minutes

## Read Path Changes

### `GET /api/leaderboard`

Before: ethers.js → scan all ScoreSubmitted events → parse → aggregate → passport check
After: `SELECT * FROM leaderboard_v` → return JSON

### `GET /api/hall-of-fame`

Before: Blockscout API → decode logs → Redis cache (60s TTL)
After: `SELECT * FROM victories ORDER BY minted_at DESC LIMIT 10`

### `GET /api/my-victories`

Before: Blockscout API (shared cache) → filter by player
After: `SELECT * FROM victories WHERE player = $1 ORDER BY minted_at DESC`

## Files

### New
- `lib/supabase/schema.sql` — DDL
- `app/api/cache-score/route.ts` — write-through for scores
- `app/api/cache-victory/route.ts` — write-through for victories
- `lib/server/sync-blockchain.ts` — cron sync logic
- `app/api/cron/sync/route.ts` — Vercel cron endpoint
- `scripts/seed-supabase.ts` — one-shot historical migration

### Modify
- `lib/server/leaderboard.ts` — replace ethers.js scan with Supabase query
- `lib/server/hof-blockscout.ts` — replace Blockscout with Supabase query (rename to `hof.ts`)
- `app/api/leaderboard/route.ts` — remove cache headers
- `app/api/hall-of-fame/route.ts` — simplify to Supabase query
- `app/api/my-victories/route.ts` — simplify to Supabase query
- `app/page.tsx` — post-submit: call cache-score + optimistic state
- `app/arena/page.tsx` — post-claim: call cache-victory + optimistic state
- `components/play-hub/leaderboard-sheet.tsx` — merge optimistic entry
- `vercel.json` — add cron schedule

### Delete (after migration verified)
- `lib/server/hof-blockscout.ts` — replaced
- Upstash Redis dependency (if unused elsewhere)

## Migration

One-shot script `scripts/seed-supabase.ts`:
1. Reuses existing `fetchLeaderboard()` logic to read all `ScoreSubmitted` events
2. Reuses existing `fetchAllVictories()` logic to read all `VictoryMinted` events
3. Batch inserts into Supabase scores and victories tables
4. Sets `last_synced_block` in `sync_state` to current block
5. Run once manually before deploying the new read path

## What This Does NOT Change

- Smart contracts — no changes
- Score submission flow — same tx, same signature, just adds cache-score call after
- Victory claim flow — same tx, same signature, just adds cache-victory call after
- Supabase remains derived data only — blockchain is still source of truth
- Coach system — unrelated, keeps using Supabase independently
