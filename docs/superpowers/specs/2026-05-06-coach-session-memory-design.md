# Coach Session Memory — Design Spec

> **Date:** 2026-05-06 (red-team patched same day)
> **Author:** Wolfcito + agent (brainstorm session + adversarial review)
> **Status:** Approved design — patched against red-team findings, pending implementation plan
> **Closes:** Etapa 2 of bundle PRO v1 plan; redeems `PRO_COPY.perksRoadmap[0]` ("Personalized coaching plan from match history")
> **Red-team report:** `docs/reviews/coach-session-memory-redteam-2026-05-06.md` — 23 findings (8 P0 / 10 P1 / 5 P2), all resolved inline below.

---

## 1. Context & motivation

The Coach (`/api/coach/analyze`) ships today as a one-shot analyzer: each request produces a standalone analysis without recall of prior games. The infrastructure for longitudinal coaching exists in skeletal form — `PlayerSummary` is fetched from Redis (`coach:summary:${wallet}`) and inlined into the prompt — but no synthesis pipeline populates it from past analyses, and Redis storage is ephemeral (30-day TTL).

PRO bundle v1 (commit `bfe0e88`, 2026-05-05) publicly promised "Personalized coaching plan from match history" as the lead `perksRoadmap` item. This spec turns that promise into a shippable feature gated to PRO subscribers, layered onto the existing Coach path with minimal blast radius.

The feature manifest: when a PRO subscriber requests a Coach analysis, the LLM receives a **history digest** of their last ~20 games — top recurring **weakness areas** computed from a small canonical tag taxonomy (~6 labels in v1). When the same weakness area shows up in the new game, the Coach calls it out by name and count — *"weak king safety has appeared in 4 of your last 8 games."* Free tier remains unchanged (existing skeletal summary block).

**Note on dropped scope (red-team P1-10):** v1 does NOT match concrete mistakes by exact `(moveNumber, played)` — chess rarely repeats both axes across games (different opponents → different positions → different move numbers for the same idea). The "third time you played Bxh7" framing was the marketing dream; in practice it would fire near-zero. Tag-level recurrence ("weak king safety appeared 4×") fires reliably and is still concrete. v2 can layer concrete-move recall on top once we have real wallet data showing what does repeat.

## 2. Non-goals (explicit out-of-scope)

The following are excluded from v1 to keep scope shippable. Each is tracked for future consideration.

- **Concrete-move recall (recurring `(moveNumber, played)` matching)** — dropped from v1 per red-team P1-10; chess move numbers + SAN almost never repeat exactly across games. v2 may layer on top via `(weakness_tag + opening_phase)` hybrid match once we have real wallet data.
- **Vector embeddings / semantic similarity** — out of scope for v1; would only matter when v2 needs "structurally similar positions" matching.
- **Rich weakness-tag taxonomy** — v1 ships 6 fixed labels via deterministic keyword/positional rules (red-team P1-1). ML-derived tags from a labeled corpus is a separate v2 project.
- **Materialized `coach_player_summaries` table** — replaced by on-read aggregation (decision 6 in §3).
- **Cross-device sync UI** — wallet IS the identity; no extra surface needed.
- **Historical replay / comparative views** — `/coach/history` keeps showing the list as today; no diff/compare features.
- **Multi-language analysis storage** — everything stays English-only, matching today.
- **Real-time updates / websockets** — `<CoachPanel>` reads `historyMeta` from the `analyze` response payload, no live observers.
- **Admin dashboards** — telemetry stays at the existing `coach_pro_bypass_used` event; no new analytics panels.
- **Free-tier writes to Supabase** — only PRO writes through. Free path stays Redis-only.
- **Backfill depth >20 games** — capped to match aggregate depth and Redis 30-day reality.
- **Column-level encryption** — wallet is already public on-chain; the rest is behavioral data not warranting beyond-default encryption.
- **PRO downgrade special-case logic** — `proStatus.active` is read live each request; no degradation path to maintain.

## 3. Resolved design decisions

Eight decisions, all confirmed during the brainstorm:

| # | Question | Decision |
|---|---|---|
| 1 | What does "personalized" mean for v1? | **Contextual references** — Coach calls out recurring patterns inside each new analysis. No separate study-plan UI. |
| 2 | Where does match history live? | **Supabase durable record + Redis cache** (write-through). Redis stays the hot path for idempotency + 30-day cache; Supabase is the long-term store. |
| 3 | How is history synthesized into the prompt? | **PlayerSummary digest + top-3 recurring weakness tags** (not concrete moves — see §1 note + red-team P1-10). |
| 4 | Free vs PRO gating semantics | **Free retains existing skeletal summary; PRO gets the full augmented prompt** with the recurring-mistakes block. Clean delta visible only to PRO. |
| 5 | Privacy / retention policy | **1-year rolling TTL** + delete-by-self endpoint (signed message) + privacy copy update. Retention not coupled to PRO status. |
| 6 | When is the aggregate computed? | **On-read at the start of each PRO `analyze`** — no materialized table. SELECT last 20, aggregate in memory (~50ms; LLM call is 2-30s, so latency is invisible). |
| 7 | Does the user know history is being used? | **Microcopy footer in `<CoachPanel>`** ("Reviewing 14 past games · manage history") + delete UI in `/coach/history`. No modal, no consent flow. |
| 8 | First PRO analyze: what history is used? | **One-shot Redis→Supabase backfill** triggered at first PRO `analyze` per wallet. Idempotent via composite PK + Redis lock + count gate. |

## 4. Architecture

```
                     POST /api/coach/analyze
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ /api/coach/analyze  (existing, augmented)                │
│                                                          │
│  1. enforceOrigin / rateLimit / credits      (unchanged) │
│  2. proStatus = isProActive(wallet)          (unchanged) │
│  3. IF pro: backfillRedisToSupabase(wallet)  ◄── NEW     │
│  4. IF pro: history = aggregateHistory(wallet) ◄── NEW   │
│  5. prompt = buildCoachPrompt(game, ..., history?)       │
│                                              ◄── augmented│
│  6. LLM call                                  (unchanged) │
│  7. Write-through:                                       │
│       Redis (existing keys, unchanged)                   │
│       Supabase coach_analyses INSERT  ◄── NEW (PRO-only) │
└──────────────────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
┌────────────────┐              ┌──────────────────┐
│ Upstash Redis  │              │ Supabase         │
│ (30d cache,    │              │ coach_analyses   │
│  idempotency,  │              │ (1y TTL, RLS,    │
│  hot path,     │              │  PRO writes)     │
│  unchanged)    │              │                  │
└────────────────┘              └──────────────────┘
                                       ▲
                                       │
                       DELETE /api/coach/history (NEW DELETE method)
                       GET    /api/coach/history (existing)
                       GET    /api/cron/coach-purge (NEW, daily)
```

**Properties:**

- Free path executes the existing flow with no Supabase touch.
- PRO path layers backfill, aggregate, persist as additive steps — all fail-soft.
- Redis remains the source of truth for idempotency and rate limits; Supabase is the durable record for PRO history only.
- Single durable store eliminates dual-reader complexity at the cost of forward-only persistence (acceptable: backfill seeds the first PRO request).

## 5. Schema

```sql
create table public.coach_analyses (
  -- Identity (composite PK; ON CONFLICT DO NOTHING in writes — see §6.1)
  wallet         text         not null,    -- lowercase 0x address
  game_id        uuid         not null,
  primary key (wallet, game_id),

  -- Time
  created_at     timestamptz  not null default now(),
  -- 1-year rolling retention. Cron purges in capped batches (§8.1).
  expires_at     timestamptz  not null default (now() + interval '1 year'),

  -- Response shape (red-team P1-5 — kind column makes intent loud and
  -- supports adding BasicCoachResponse rows in v2 without a migration)
  kind           text         not null default 'full' check (kind in ('full','quick')),

  -- Game context (denormalized for prompt building without joins)
  difficulty     text         not null check (difficulty in ('easy','medium','hard')),
  result         text         not null check (result    in ('win','lose','draw','resigned')),
  total_moves    int          not null,

  -- Coach response payload — these are NOT NULL only when kind='full'.
  -- Schema-level check enforces it; v1 code only inserts kind='full'.
  summary_text   text         not null,
  mistakes       jsonb        not null default '[]',  -- Array<Mistake>
  lessons        jsonb        not null default '[]',  -- string[]
  praise         jsonb        not null default '[]',  -- string[]

  -- v1 canonical taxonomy (red-team P1-1): 6 deterministic labels.
  -- Empty array is a valid value when no mistake explanation matched
  -- the keyword/positional rules.
  weakness_tags  text[]       not null default '{}'
);

create index coach_analyses_wallet_recent_idx
  on public.coach_analyses (wallet, created_at desc);

-- Cron purge query (§8.1) walks this index in batches to avoid
-- table-level locks on backlog catch-up.
create index coach_analyses_expires_idx
  on public.coach_analyses (expires_at);

alter table public.coach_analyses enable row level security;
create policy "service_role full access"
  on public.coach_analyses for all
  to service_role using (true) with check (true);
-- No anon/authenticated policy: clients only access via server endpoints.
```

**Notes:**

- `weakness_tags` is computed post-LLM via `extractWeaknessTags(mistakes, totalMoves, result)`. v1 taxonomy is fixed at 6 labels (red-team P1-1):
  - `hanging-piece` — `mistake.explanation` matches `/\b(hung|undefended|free capture|left.*unprotected)\b/i`
  - `missed-tactic` — matches `/\b(missed|overlooked).*(fork|pin|skewer|tactic|combination)\b/i`
  - `weak-king-safety` — matches `/\b(king (exposed|unsafe|weak)|open file near king|attack on the king)\b/i`
  - `weak-pawn-structure` — matches `/\b(doubled pawns?|isolated pawn|pawn weakness|backward pawn)\b/i`
  - `opening-blunder` — positional: `mistake.moveNumber <= 12 && mistakes.length >= 2` for that game
  - `endgame-conversion` — positional: `mistake.moveNumber >= 30 && result in ('lose','draw')`
- `mistakes` jsonb retains the full `Mistake[]` shape (`moveNumber`, `played`, `better`, `explanation`) for future v2 features and surface-level rendering. v1 prompt augmentation does NOT use exact `(moveNumber, played)` matching.
- `expires_at` is set at insert and never refreshed. Backfill (§7) sets it explicitly to `analysis.createdAt + 1y` rather than the table default to honor the privacy notice "365 days from creation" (red-team P1-6).
- Rows are inserted via `INSERT … ON CONFLICT DO NOTHING` (§6.1, red-team P1-9) so concurrent-device writes don't silently overwrite tag sets.

## 6. Data flow

### 6.1 Write path (`/api/coach/analyze`, success branch)

Existing Redis writes are unchanged. New PRO write-through after the existing `Promise.all` block:

```ts
if (proStatus.active && normalized.data.kind === "full") {
  try {
    // Tag extraction is fail-soft INSIDE persistAnalysis (red-team
    // P1-7) — a tag-derivation throw must not silently drop a row
    // that a paying user generated. Default tags to [] on throw.
    await persistAnalysis(wallet, {
      gameId,
      difficulty: gameRecord.difficulty,
      result: validation.computedResult,
      totalMoves: gameRecord.totalMoves,
      response: normalized.data,
    });
  } catch (err) {
    log.warn({ event: "coach_persist_failed", wallet_hash: hashWallet(wallet), err: String(err) });
    // Continue — do not fail the analysis the user already paid for.
  }
}
```

`persistAnalysis` issues `INSERT … ON CONFLICT DO NOTHING` on the `(wallet, game_id)` PK (red-team P1-9). Concurrent multi-device writes for the same game pick the first-arrived tag set; subsequent writes are no-ops rather than overwrites. After insert, it fires a bounded cleanup query when the wallet's row count exceeds a soft cap of 200 (red-team P1-2):

```sql
delete from coach_analyses
 where wallet = $1
   and game_id not in (
     select game_id from coach_analyses
      where wallet = $1
      order by created_at desc
      limit 200
   );
```

This caps a single high-volume wallet's footprint at ~1 MB regardless of activity (200 rows × ~5 KB).

### 6.2 Read path (start of `analyze`, before LLM call)

Inserted between `proStatus` and `buildCoachPrompt`:

```ts
let history: HistoryDigest | null = null;
if (proStatus.active) {
  await backfillRedisToSupabase(wallet); // returns immediately if already done
  history = await aggregateHistory(wallet); // null if no rows
}

const prompt = buildCoachPrompt(
  gameRecord.moves,
  validation.computedResult,
  gameRecord.difficulty,
  playerSummary, // existing free-tier skeletal summary, unchanged
  history,       // NEW; undefined for free
);
```

### 6.3 Prompt augmentation (`buildCoachPrompt`)

Free path: unchanged. Snapshot of the current `summaryBlock` is preserved verbatim in tests.

PRO path appends, after the existing `summaryBlock` and before the `RESULT_HINTS`. The block is **capped at 600 characters** (red-team P1-3) — `buildCoachPrompt` truncates with an ellipsis if the rendered block exceeds the budget so a verbose tag set can't push the prompt past the LLM context window.

```
Player history (last 20 games): ${digest.gamesPlayed} games.
Recent results: W:${digest.recentResults.win} L:${digest.recentResults.lose} D:${digest.recentResults.draw}.
Recurring weakness areas: ${digest.topWeaknessTags.slice(0,3).map(t => `${t.tag} (×${t.count})`).join(", ")}.

When analyzing this game, if any of the above weakness areas appear,
call them out by name — e.g., "you've shown weak king safety in 4 of
your last 8 games." Tie the call-out to the count above. Do not
fabricate a pattern that isn't in the data.
```

**Conditional rendering rules:**

- If `digest === null` (PRO user, zero rows after backfill): augmentation block omitted entirely — no `0 games played` stub.
- If `digest.topWeaknessTags` is empty (rows exist but no tag-extraction matched any explanation, e.g., 6-label taxonomy whiffed): the "Recurring weakness areas:" line is omitted but the gamesPlayed/results header stays. The "When analyzing…" callout is still rendered but framed as opportunistic ("if you spot a recurring pattern across this game and prior context, name it").

(Red-team P1-10 dropped concrete-move recurrence from v1; only tag-level recurrence ships.)

### 6.4 Response payload

The `analyze` route response gains an optional `historyMeta` field for PRO clients:

```ts
type AnalyzeResponse = {
  status: "ready";
  response: CoachResponse;
  proActive?: true;
  historyMeta?: {
    gamesPlayed: number; // depth of digest used; 0 = no history yet
  };
};
```

Free responses do not include `historyMeta`. Client uses presence-check.

### 6.5 Failure modes

| Failure | Behavior |
|---|---|
| Supabase write fails | Log warn, return success. Next read picks up older history. |
| Supabase read fails | Log warn, fall through to free-tier prompt. Better degraded analysis than 500. |
| `aggregateHistory` returns empty | Skip augmentation block in prompt; respond with `historyMeta.gamesPlayed: 0`. |
| `extractWeaknessTags` throws | Insert row with `weakness_tags = []`; log a separate `coach_tag_extraction_failed` warning so the row is preserved (red-team P1-7). |
| Backfill fails | Log warn, continue. Subsequent `/analyze` re-attempts (still idempotent via PK + lock). |
| Concurrent `/analyze` for same wallet (cross-device) | Backfill polls up to 3s waiting for a held lock (§7); on timeout it gives up but the request still proceeds with whatever rows are present. Aggregate may return null on the second call — augmentation block omitted but analysis succeeds. |
| Concurrent `/analyze` for same `gameId` | Composite PK + ON CONFLICT DO NOTHING (§6.1, red-team P1-9): first writer wins, subsequent writers skip the insert without overwriting tag sets. |
| OpenAI 429 / network error | Existing `/analyze` try/catch returns 502 / failed; new PRO write-through path is reached only on success branch, so no changes here. |

## 7. Backfill

```ts
// lib/coach/backfill.ts
const BACKFILL_LOCK_TTL_S = 60;
const BACKFILL_POLL_INTERVAL_MS = 500;
const BACKFILL_POLL_MAX_ATTEMPTS = 6;   // 3s total — under p99 LLM latency
const BACKFILL_DEPTH = 20;

async function backfillRedisToSupabase(wallet: string): Promise<{ copied: number; waited: boolean }> {
  // Try to acquire the lock. On contention, poll until the holder
  // finishes or we time out (red-team P0-5: avoid concurrent /analyze
  // serving augmentation-less prompts to PRO users on the second
  // call). 3s budget is invisible alongside the 2-30s LLM call.
  let acquired = await redis.set(
    REDIS_KEYS.backfillClaim(wallet),
    Date.now(),
    { nx: true, ex: BACKFILL_LOCK_TTL_S },
  );
  let waited = false;
  if (!acquired) {
    waited = true;
    for (let i = 0; i < BACKFILL_POLL_MAX_ATTEMPTS; i++) {
      await sleep(BACKFILL_POLL_INTERVAL_MS);
      const stillHeld = await redis.get(REDIS_KEYS.backfillClaim(wallet));
      if (!stillHeld) {
        // Holder finished — they may have populated Supabase. Re-run
        // the count gate; if the holder succeeded, we exit clean.
        return { copied: 0, waited: true };
      }
    }
    // Holder still working after 3s; let this request fall through
    // to aggregateHistory (which may return null). Augmentation block
    // omits per §6.5 row 6.
    log.warn({
      event: "coach_backfill_lock_timeout",
      wallet_hash: hashWallet(wallet),
    });
    return { copied: 0, waited: true };
  }

  const { count } = await supabase
    .from("coach_analyses")
    .select("*", { count: "exact", head: true })
    .eq("wallet", wallet);
  if ((count ?? 0) > 0) return { copied: 0, waited };

  const gameIds = await redis.lrange(REDIS_KEYS.analysisList(wallet), 0, BACKFILL_DEPTH - 1);
  if (gameIds.length === 0) return { copied: 0, waited };

  const rows: CoachAnalysisRow[] = [];
  for (const gameId of gameIds) {
    const analysis = await redis.get<CoachAnalysisRecord>(REDIS_KEYS.analysis(wallet, gameId));
    const game     = await redis.get<GameRecord>(REDIS_KEYS.game(wallet, gameId));
    if (!analysis || !game || analysis.response.kind !== "full") continue;

    let tags: string[] = [];
    try {
      tags = extractWeaknessTags(analysis.response.mistakes, game.totalMoves, game.result);
    } catch (err) {
      log.warn({
        event: "coach_tag_extraction_failed",
        wallet_hash: hashWallet(wallet),
        phase: "backfill",
        err: String(err),
      });
      // Continue with empty tags — preserve the row (P1-7).
    }

    // expires_at = original analysis creation + 1y (red-team P1-6).
    // Honors the privacy notice "365 days from creation" without
    // backdating-leakage on free-tier history copied at upgrade.
    const expiresIso = new Date(analysis.createdAt + 365 * 24 * 60 * 60 * 1000).toISOString();

    rows.push({
      wallet,
      game_id: gameId,
      created_at: new Date(analysis.createdAt).toISOString(),
      expires_at: expiresIso,
      kind: "full",
      difficulty: game.difficulty,
      result: game.result,
      total_moves: game.totalMoves,
      summary_text: analysis.response.summary,
      mistakes: analysis.response.mistakes,
      lessons: analysis.response.lessons,
      praise: analysis.response.praise,
      weakness_tags: tags,
    });
  }

  if (rows.length > 0) {
    // ON CONFLICT DO NOTHING — first wins (red-team P1-9). Even though
    // Supabase was empty per the count gate above, two parallel
    // backfills could both pass the gate before either inserts.
    await supabase.from("coach_analyses").insert(rows, { defaultToNull: false }).onConflict("wallet,game_id").ignoreDuplicates();
  }
  return { copied: rows.length, waited };
}
```

**Properties:**

- **Idempotent.** Composite PK `(wallet, game_id)` + Redis 60s claim lock + Supabase `count > 0` gate + INSERT…ON CONFLICT DO NOTHING.
- **Race-safe** (red-team P0-5). On lock contention the second request waits up to 3s for the holder; if held longer, request proceeds — augmentation may be skipped on that single call but no data is lost or corrupted.
- **Fail-soft.** Wrapped in try/catch at the route level; backfill errors don't block the analysis. Tag-extraction throws don't drop the row (P1-7).
- **Bounded.** Max 20 rows × ~5KB ≈ 100KB single insert.
- **TTL faithful** (red-team P1-6). Backfilled rows carry `expires_at = original_created_at + 1y`, not `now + 1y`, so the privacy notice "365 days from creation" stays accurate.
- **One-time per wallet.** `count > 0` gate + ON CONFLICT DO NOTHING prevent re-runs even if user cancels and re-subscribes PRO.

## 8. Privacy, retention, deletion

### 8.1 Cron purge

```ts
// app/api/cron/coach-purge/route.ts
const PURGE_BATCH_SIZE = 5_000;
const PURGE_LOCK_TTL_S = 600;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Redis advisory lock — protects against concurrent runs (manual
  // workflow_dispatch during a scheduled run; red-team P0-6).
  const acquired = await redis.set(
    "coach:cron:purge",
    Date.now(),
    { nx: true, ex: PURGE_LOCK_TTL_S },
  );
  if (!acquired) {
    return Response.json({ skipped: true, reason: "another run in progress" });
  }

  let totalDeleted = 0;
  try {
    // Delete in capped batches to avoid table-level locks on backlog
    // catch-up. Loop until a batch returns < BATCH_SIZE rows.
    for (let pass = 0; pass < 20; pass++) {
      const { data, error } = await supabase
        .from("coach_analyses")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true })
        .limit(PURGE_BATCH_SIZE)
        .select("game_id");
      if (error) {
        log.error({ event: "coach_purge_failed", err: error.message, pass, total_so_far: totalDeleted });
        return Response.json({ error: "purge failed", deleted_before_failure: totalDeleted }, { status: 500 });
      }
      const rows = data?.length ?? 0;
      totalDeleted += rows;
      if (rows < PURGE_BATCH_SIZE) break;
    }
    log.info({ event: "coach_purge_complete", rows_deleted: totalDeleted });
    return Response.json({ rows_deleted: totalDeleted });
  } finally {
    await redis.del("coach:cron:purge");
  }
}
```

Reuses `CRON_SECRET` and the existing GitHub Actions cron worker. Schedule: daily at 03:00 UTC. The workflow file gains `concurrency: { group: cron-coach-purge, cancel-in-progress: false }` for belt-and-suspenders against simultaneous runs (red-team P0-6).

### 8.2 Delete-by-self endpoint

`DELETE /api/coach/history` — server-side verified, replay-resistant, address-bound.

```ts
// Message format (red-team P0-1: chain + domain binding to prevent
// message-confusion across other Chesscito signed surfaces).
const DELETE_MESSAGE = (nonce: string, issuedIso: string) =>
  `Delete my Coach history
Domain: chesscito.app
Chain: 42220
Nonce: ${nonce}
Issued: ${issuedIso}`;

const NONCE_TTL_S = 300;
const NONCE_RE = /^[0-9a-f]{32}$/i;
const ISO_AGE_LIMIT_MS = 5 * 60 * 1000;

export async function DELETE(req: Request) {
  enforceOrigin(req);
  await enforceRateLimit(getRequestIp(req));

  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");

  const { walletAddress, signature, nonce, issuedIso } = body as {
    walletAddress?: string; signature?: string; nonce?: string; issuedIso?: string;
  };

  if (!walletAddress || !isAddress(walletAddress)) return badRequest("Invalid wallet");
  if (!signature || !signature.startsWith("0x"))   return badRequest("Invalid signature");
  if (!nonce     || !NONCE_RE.test(nonce))         return badRequest("Invalid nonce");
  if (!issuedIso)                                  return badRequest("Missing issuedIso");

  // Freshness window
  const issuedAtMs = Date.parse(issuedIso);
  if (!Number.isFinite(issuedAtMs))                                    return new Response("Invalid issuedIso", { status: 400 });
  if (Math.abs(Date.now() - issuedAtMs) > ISO_AGE_LIMIT_MS)            return new Response("Message expired", { status: 410 });

  // Replay defense (red-team P0-1) — claim the nonce atomically.
  // Replays within the 5-min window collide on this SETNX.
  const nonceKey = `coach:delete-nonce:${nonce}`;
  const claimed = await redis.set(nonceKey, walletAddress.toLowerCase(), { nx: true, ex: NONCE_TTL_S });
  if (!claimed) return new Response("Nonce already used", { status: 409 });

  // Recover address from the signed message and require an exact
  // match against the body-supplied wallet (red-team P0-8) — otherwise
  // an attacker can sign with wallet A but pass B in the body and
  // wipe B's history. Use viem's recoverMessageAddress.
  const message = DELETE_MESSAGE(nonce, issuedIso);
  let recovered: `0x${string}`;
  try {
    recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
  } catch {
    return new Response("Bad signature", { status: 401 });
  }
  if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
    return new Response("Address mismatch", { status: 403 });
  }

  // ALL deletes key off the recovered address — never the body field.
  const wallet = recovered.toLowerCase();

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error({ event: "coach_delete_supabase_unavailable", wallet_hash: hashWallet(wallet) });
    return new Response("Service unavailable", { status: 503 });
  }

  const [supaRes, redisRes] = await Promise.all([
    supabase.from("coach_analyses").delete({ count: "exact" }).eq("wallet", wallet),
    (async () => {
      const ids = await redis.lrange(REDIS_KEYS.analysisList(wallet), 0, -1);
      const keys = [REDIS_KEYS.analysisList(wallet), ...ids.map(id => REDIS_KEYS.analysis(wallet, id))];
      return keys.length ? redis.del(...keys) : 0;
    })(),
  ]);

  log.info({
    event: "coach_history_deleted",
    wallet_hash: hashWallet(wallet),
    supabase_rows: supaRes.count ?? 0,
    redis_keys_deleted: redisRes,                       // red-team P2-2: count, not array
  });
  return Response.json({ deleted: true, supabase_rows: supaRes.count ?? 0 });
}
```

**Error codes** (red-team P0-1 explicit documentation):

| Status | Cause |
|---|---|
| 400 | Bad JSON / wallet / signature / nonce shape |
| 401 | Signature recovery failed |
| 403 | Recovered address ≠ body walletAddress |
| 409 | Nonce already used (replay) |
| 410 | Message older than 5 minutes |
| 503 | Supabase server client unavailable |

**Note on `recoverMessageAddress` introduction:** this is the codebase's first use of viem's message-recovery primitive — `lib/server/demo-signing.ts` uses ethers, but new auth surfaces (red-team verified `grep -r src/` returned 0 hits for `verifyMessage`) standardize on viem to match the wallet client stack already in `wagmi.ts`. The implementation plan must add a brief module comment documenting the choice.

### 8.3 Privacy copy

Privacy page lives at `apps/web/src/app/privacy/page.tsx` (red-team P0-4 — corrected from `/legal/privacy/`). All user-facing copy lives in `lib/content/editorial.ts` per CLAUDE.md project rules ("`editorial.ts` — single source of truth for ALL user-facing copy"). Add a `PRIVACY_COACH_COPY` constant there:

```ts
// editorial.ts
export const PRIVACY_COACH_COPY = {
  heading: "Coach Match History (Chesscito PRO)",
  para1:
    "Active PRO subscribers have their game analyses stored to provide personalized coaching across sessions. We retain match analyses for 365 days from creation, after which they are automatically deleted. Free tier users' analyses live only in our 30-day cache and are never persisted long-term.",
  para2Title: "Your control:",
  para2:
    "You can delete all stored Coach history at any time via your wallet from the Coach history page, regardless of PRO status. Deletion is permanent and immediate.",
  para3Title: "What's stored:",
  para3:
    "Wallet address (lowercase), game ID, timestamps, your move list, and the AI-generated coaching response (summary, mistakes, lessons, praise). No personal identifiers beyond the wallet address.",
  // Red-team P2-5 — disclose lost-key recourse path explicitly.
  para4Title: "Lost wallet access:",
  para4:
    "Deletion requires control of the wallet that owns the analyses. If you lose access, contact support@chesscito.app for an out-of-band deletion request. We will require proof of original ownership.",
} as const;
```

The privacy `page.tsx` imports the constant and renders the section. No new file in `lib/content/`.

### 8.4 Wallet hashing for logs

`hashWallet(wallet) = sha256(wallet + LOG_SALT).slice(0, 16)` — 64-bit prefix (red-team P1-8 raised the prefix from 12 → 16 chars).

`LOG_SALT` is treated as a **secret** (rotated quarterly via runbook, never committed, never `NEXT_PUBLIC_*`). Without the salt, an attacker with log read access cannot reverse-rainbow-table known wallets. Documentation lives in `docs/runbooks/log-salt-rotation.md` to be written during implementation. The "stable but non-reversible" guarantee depends on salt secrecy — note this caveat in `lib/server/logger.ts` next to the helper.

## 9. UI changes

### 9.1 `<CoachPanel>` footer

`<CoachPanel>`'s current props (verified — red-team P0-3) do NOT include `proActive` / `historyMeta`. The implementation plan must thread both new fields:

```ts
// components/coach/coach-panel.tsx — Props additions
type Props = {
  /* ...existing props (response, difficulty, totalMoves, elapsedMs,
     credits, onPlayAgain, onBackToHub, onViewHistory)... */
  proActive?: boolean;                          // NEW
  historyMeta?: { gamesPlayed: number };        // NEW
};
```

The values originate in `/api/coach/analyze` response (§6.4) and flow through `arena/page.tsx` (the parent that consumes the analyze response — also added to §10 module map). Footer renders only when both are present:

```tsx
{proActive && historyMeta && (
  <p data-testid="coach-history-footer" className="mt-3 text-nano text-center text-white/55">
    {historyMeta.gamesPlayed === 0
      ? COACH_COPY.historyFooter.building
      : COACH_COPY.historyFooter.reviewing(historyMeta.gamesPlayed)}
    {" · "}
    <Link href="/coach/history" className="underline underline-offset-2">
      {COACH_COPY.historyFooter.manageLabel}
    </Link>
  </p>
)}
```

### 9.2 `/coach/history` page (NEW route)

Red-team P0-2 verified: `/coach/history` page route does NOT currently exist. `<CoachHistory>` is rendered inline inside `arena/page.tsx`. v1 ships a NEW route at `apps/web/src/app/coach/history/page.tsx` so the footer link in §9.1 has a target. The route reuses the existing `<CoachHistory>` component (which already reads from `/api/coach/history`) and adds the delete surface:

```tsx
// app/coach/history/page.tsx (NEW)
"use client";
import { CoachHistory } from "@/components/coach/coach-history";
import { CoachHistoryDeletePanel } from "@/components/coach/coach-history-delete-panel";

export default function CoachHistoryPage() {
  return (
    <main className="mx-auto max-w-[var(--app-max-width,390px)] px-4 py-6">
      <CoachHistory />
      <CoachHistoryDeletePanel />
    </main>
  );
}
```

`<CoachHistoryDeletePanel>` is a NEW component (§10 module map):

```tsx
// components/coach/coach-history-delete-panel.tsx (NEW)
export function CoachHistoryDeletePanel() {
  const { rowCount, isLoading } = useCoachHistoryCount();   // GET /api/coach/history → length
  const [confirmOpen, setConfirmOpen] = useState(false);
  // ...delete state machine...

  // Red-team P0-7 — disable button when there is nothing to delete,
  // and use neutral toast text on success ("All Coach data cleared
  // from our records") so we never imply a positive action that
  // didn't happen.
  const hasHistory = (rowCount ?? 0) > 0;

  return (
    <section className="mt-8 border-t border-white/10 pt-4">
      <h3 className="text-sm font-bold text-rose-200">{COACH_COPY.historyDelete.title}</h3>
      <p className="mt-1 text-xs text-white/65">{COACH_COPY.historyDelete.body}</p>
      <Button
        variant="game-danger"
        size="game-sm"
        onClick={() => setConfirmOpen(true)}
        disabled={isLoading || !hasHistory}
        className="mt-3"
      >
        {COACH_COPY.historyDelete.cta}
      </Button>
      {confirmOpen && (
        <ConfirmDeleteSheet
          onConfirm={signAndDelete}
          onCancel={() => setConfirmOpen(false)}
          isWorking={isDeleting}
        />
      )}
    </section>
  );
}
```

**`<ConfirmDeleteSheet>`** (red-team P2-1) — explicitly built atop the existing `<Sheet>` primitive in `components/ui/sheet.tsx`. The codebase has no `<Dialog>` (verified), so the §14 OQ is removed. Color tier: rose (per design system tokens, never `red-*`).

### 9.3 Editorial constants (`COACH_COPY` additions)

```ts
historyFooter: {
  building: "Building your history…",
  reviewing: (n: number) => `Reviewing ${n} past ${n === 1 ? "game" : "games"}`,
  manageLabel: "manage history",
},
historyDelete: {
  title: "Delete all your Coach history",
  body:
    "Permanently removes every stored analysis from our records. This action cannot be undone. Your active PRO pass is unaffected.",
  cta: "Delete history",
  confirmTitle: "Delete all history?",
  confirmBody:
    "This will permanently remove all your past Coach analyses and weakness tracking. Your next analysis will start fresh.",
  confirmAccept: "Yes, delete everything",
  confirmCancel: "Keep my history",
  // Red-team P0-1: chain + domain bound message format. Keep in
  // lockstep with DELETE_MESSAGE in app/api/coach/history/route.ts.
  signMessage: (nonce: string, iso: string) =>
    `Delete my Coach history
Domain: chesscito.app
Chain: 42220
Nonce: ${nonce}
Issued: ${iso}`,
  // Red-team P0-7: neutral, never claims a positive action that
  // may not have happened (delete may run on 0-row state during
  // race windows even with the disabled-button guard).
  successToast: "All Coach data cleared from our records",
  errorToast: "Could not delete — please retry",
},
```

### 9.4 No changes (carried with caveat)

- `<ProSheet>` — `perksRoadmap[0]` already promises this feature since commit `bfe0e88`. When this feature ships, **move the item from `perksRoadmap` → `perksActive`** as part of the rollout commit (§13 step 5). No new UI, just an array edit.
  - **Red-team P2-3 caveat:** silently moving the array entry won't give existing PRO users a "newly active" affordance — they may not notice the chip flipped from SOON to active. Implementation plan adds a one-shot `<Banner>` callout inside `<CoachPanel>` on first PRO analyze post-deploy (`localStorage` flag, `chesscito:coach-history-callout-seen`). Banner copy lives in `COACH_COPY.featureBanner`. Out of scope for this spec to design the banner micro-copy.
- `<ArenaHud>` / `<ArenaEndState>` — the promise is fulfilled inside `<CoachPanel>` which already mounts post-checkmate via `coachPhase`. No additional signposting beyond the in-match hint shipped in commit `6491614`.

## 10. New / modified module map

(Reconciled against red-team P0-2/P0-3/P0-4 — paths verified against current codebase commit `8f0f708`.)

| Path | Status | Purpose |
|---|---|---|
| `apps/web/src/lib/coach/weakness-tags.ts` | NEW | `extractWeaknessTags(mistakes, totalMoves, result)` + 6-label v1 taxonomy + tests |
| `apps/web/src/lib/coach/history-digest.ts` | NEW | `aggregateHistory(wallet)` — Supabase read + in-memory aggregation |
| `apps/web/src/lib/coach/persistence.ts` | NEW | `persistAnalysis(wallet, payload)` — INSERT…ON CONFLICT DO NOTHING + row-cap delete |
| `apps/web/src/lib/coach/backfill.ts` | NEW | `backfillRedisToSupabase(wallet)` — race-safe with poll-and-wait |
| `apps/web/src/lib/coach/types.ts` | MODIFIED | Add `HistoryDigest`, `CoachAnalysisRow`, `WeaknessTag` union |
| `apps/web/src/lib/coach/prompt-template.ts` | MODIFIED | Accept `history?: HistoryDigest`, append capped PRO block |
| `apps/web/src/lib/coach/redis-keys.ts` | MODIFIED | Add `backfillClaim(wallet)` + `deleteNonce(nonce)` keys |
| `apps/web/src/lib/server/logger.ts` | MODIFIED | Add `hashWallet()` helper + `LOG_SALT` secrecy comment |
| `apps/web/src/app/api/coach/analyze/route.ts` | MODIFIED | Wire backfill + aggregate + persist; emit `historyMeta` in response |
| `apps/web/src/app/api/coach/history/route.ts` | MODIFIED | Add DELETE method (nonce-store + chain/domain-bound + recovered-address-bound) |
| `apps/web/src/app/api/cron/coach-purge/route.ts` | NEW | Daily TTL purge with batched LIMIT + advisory lock + error branch |
| `apps/web/src/app/coach/history/page.tsx` | NEW | Page route (§9.2 — fixes red-team P0-2: footer link target) |
| `apps/web/src/app/arena/page.tsx` | MODIFIED | Thread `historyMeta` from analyze response into `<CoachPanel>` (red-team P0-3) |
| `apps/web/src/app/privacy/page.tsx` | MODIFIED | Render `PRIVACY_COACH_COPY` section (red-team P0-4: correct path; was `/legal/privacy/`) |
| `apps/web/src/lib/content/editorial.ts` | MODIFIED | `COACH_COPY.historyFooter` + `historyDelete` + `featureBanner`; `PRIVACY_COACH_COPY` (red-team P0-4: SSOT, not a separate `legal-copy.ts`) |
| `apps/web/src/components/coach/coach-panel.tsx` | MODIFIED | New `proActive`/`historyMeta` props; render footer + first-time banner |
| `apps/web/src/components/coach/coach-history-delete-panel.tsx` | NEW | Delete UI with row-count gate + sign + DELETE call |
| `apps/web/src/components/coach/confirm-delete-sheet.tsx` | NEW | Built atop existing `<Sheet>` primitive (red-team P2-1: no `<Dialog>` exists) |
| `apps/web/src/lib/coach/use-coach-history-count.ts` | NEW | Hook: `GET /api/coach/history` → row count (drives delete-button enable state) |
| Supabase migration `coach_analyses_init.sql` | NEW | Table + indexes + RLS + check constraints |
| `.github/workflows/cron-cache-sync.yml` | MODIFIED | Add `coach-purge` schedule + `concurrency: { group: cron-coach-purge, cancel-in-progress: false }` |
| `docs/runbooks/log-salt-rotation.md` | NEW | Quarterly rotation procedure (red-team P1-8) |

(Removed from module map: `lib/content/legal-copy.ts` — does not exist and would violate `editorial.ts` SSOT rule. `confirm-delete-modal.tsx` renamed → `confirm-delete-sheet.tsx` to make the primitive choice loud.)

## 11. Testing strategy

### Unit tests (no DB, no network)

- `lib/coach/__tests__/weakness-tags.test.ts` — `extractWeaknessTags()` cases per canonical label.
- `lib/coach/__tests__/history-digest.test.ts` — pure function: rows → digest. Edge: empty rows → null, all-rows-with-`weakness_tags=[]` → digest with empty `topWeaknessTags`. Verifies the 600-char prompt-block truncation in `buildCoachPrompt` (red-team P1-3).
- `lib/coach/__tests__/prompt-template.test.ts` — free path snapshot unchanged; PRO path with digest snapshot; PRO with `history=null` falls back to free path verbatim.

### Route handler tests (Supabase + Redis mocked)

- `app/api/coach/analyze/__tests__/route.test.ts` (extend) — PRO path triggers `persistAnalysis`; free skips it; Supabase write failure logs warn + still returns success; PRO path calls `aggregateHistory`.
- `lib/coach/__tests__/persistence.test.ts` — verifies SELECT shape (wallet eq, ORDER BY DESC, LIMIT 20) and UPSERT onConflict.
- `lib/coach/__tests__/backfill.test.ts` — idempotency lock, count gate, broken-record dedupe, composite-key upsert.
- `app/api/coach/history/__tests__/route.test.ts` (extend) — DELETE rejects bad signature, expired message, mismatched address; success deletes Supabase + Redis; logs hashed wallet.
- `app/api/cron/coach-purge/__tests__/route.test.ts` — rejects without bearer, deletes only `expires_at < now()`, returns count.

### Component tests

- `components/coach/__tests__/coach-panel.test.tsx` (extend) — footer renders when `proActive && historyMeta`; "Building your history…" when `gamesPlayed === 0`; pluralization correct; hidden for free; manage link href correct.
- `components/coach/__tests__/coach-history.test.tsx` (extend) — delete section renders; modal cancel → no API; modal confirm → sign → DELETE → success toast; error path → error toast.

### E2E

Out of scope for v1. Existing 26 baseline E2E failures take priority. Manual smoke walkthrough captured in the implementation handoff: free → buy PRO → analyze game 1 → analyze game 2 → confirm references appear in game 2 analysis.

### Coverage target

≥85% line coverage on the new modules (`weakness-tags`, `history-digest`, `persistence`, `backfill`).

## 12. Telemetry

Existing pattern (structured JSON via `lib/server/logger.ts`) extended with these events:

| Event | Where | Fields |
|---|---|---|
| `coach_persist_failed` | analyze route, write-through catch | `wallet_hash`, `game_id`, `err` |
| `coach_tag_extraction_failed` | persistAnalysis + backfill | `wallet_hash`, `phase` (`live`/`backfill`), `err` |
| `coach_history_aggregated` | analyze route, after aggregateHistory | `wallet_hash`, `pro_active`, `depth`, `top_tags_count` |
| `coach_backfill_completed` | backfill, on insert | `wallet_hash`, `copied`, `waited` |
| `coach_backfill_lock_timeout` | backfill, on poll exhaustion | `wallet_hash` |
| `coach_history_deleted` | DELETE handler, success | `wallet_hash`, `supabase_rows`, `redis_keys_deleted` |
| `coach_delete_supabase_unavailable` | DELETE handler | `wallet_hash` |
| `coach_purge_complete` | cron handler | `rows_deleted` |
| `coach_purge_failed` | cron handler error branch | `err`, `pass`, `total_so_far` |

No raw wallet addresses leave the server. `wallet_hash = sha256(wallet + LOG_SALT).slice(0, 16)` (red-team P1-8: 16-char prefix; `LOG_SALT` secrecy is contractual). Field names are intentionally explicit — `redis_keys_deleted: number` (not `redis_keys`) so the implementer cannot accidentally log the raw key strings, which contain the wallet (red-team P2-2).

## 13. Rollout & rollback

### Rollout sequence

1. **DB migration** — apply `coach_analyses` table + indexes + RLS + check constraints to Supabase staging, then prod. Idempotent SQL via `create table if not exists`.
2. **Library + route changes** — ship behind no flag; PRO is already a hard gate at the route level. Free behavior is bit-identical to today. Includes: weakness-tags taxonomy, persistence, backfill, history-digest, prompt augmentation, `analyze` route wiring, DELETE method on `/api/coach/history`, `hashWallet` helper.
3. **Cron registration** — add `coach-purge` schedule + concurrency-group config to GH Actions workflow. First run: ~24h after merge.
4. **UI** — `<CoachPanel>` props + footer + first-run banner; new `/coach/history` page route with `<CoachHistoryDeletePanel>` + `<ConfirmDeleteSheet>`; `arena/page.tsx` plumbing of `historyMeta`; `/privacy` page renders new `PRIVACY_COACH_COPY` block. Ship as a single PR.
5. **`PRO_COPY` array swap + featureBanner enable** — move "Personalized coaching plan from match history" from `perksRoadmap` → `perksActive` AND set the `COACH_COPY.featureBanner` strings live (both as the final commit). The banner is shown until the user dismisses it (localStorage flag `chesscito:coach-history-callout-seen`), giving existing PRO users the "newly active" affordance the silent array swap would lack (red-team P2-3).

### Rollback

- DB: rollback is `drop table coach_analyses`. Redis cache is unaffected; free path keeps working.
- Code: revert the route augmentation; the prompt template falls back to the free path automatically.
- UI: revert the array swap + footer/delete commits.
- Public-facing copy: `perksActive` would temporarily over-promise. The handoff doc captures the rollback playbook so the array swap can be reverted in <5 minutes.

### Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Supabase write latency adds to `/analyze` p95 | Low | Write happens after LLM resolves; user already waited 2-30s. Supabase write ~50ms. |
| LLM hallucinates fake recurring patterns despite prompt instruction | Med | Explicit instruction "Do not fabricate a pattern that isn't in the data." Smoke-test with 5 real wallets; if frequent, tighten via structured-output JSON schema constraint. |
| Backfill races at first concurrent `/analyze` from same wallet | Low | Redis lock + 3s poll-and-wait + `count > 0` gate + ON CONFLICT DO NOTHING make double-writes impossible (red-team P0-5 mitigation). |
| Privacy copy under-discovers | Low | Footer link in `<CoachPanel>` + new `/coach/history` page surface deletion 2 taps away. Privacy page accessible from existing site footer. |
| `expires_at` cron misses a day | Low | TTL is rolling 1y — a missed day adds 1 day to retention. Cron is concurrency-locked + batched (red-team P0-6) so backlog catch-up is bounded. |
| Weakness taxonomy too narrow (6 labels) | Med | v1 ships explicit deferred-scope acceptance: explanations that don't match any rule yield `weakness_tags = []` and the row still inserts. v2 work-stream tracked separately to expand. |
| LLM token amplification — PRO requests cost more | Low | Augmentation block capped at 600 chars (red-team P1-3). Truncation is hard-coded in `buildCoachPrompt`. |
| High-volume PRO user fills the table | Low | Soft cap of 200 rows per wallet enforced post-insert (red-team P1-2). |
| Replay attack on delete-by-self endpoint | Low | Server-side nonce store with `nx, ex=300` makes replays collide; chain + domain binding prevents message confusion across other signed surfaces (red-team P0-1). |
| Caller-spoofed wallet on delete | Low | `recoverMessageAddress` strict-equals body wallet; deletes key off recovered address (red-team P0-8). |
| `LOG_SALT` leak compromises wallet pseudonymity in logs | Low | Salt is a server-side secret with quarterly rotation runbook (red-team P1-8). 16-char hash prefix raises brute-force cost. |
| Cron unbounded delete blocks the table on backlog | Low | Capped at 5 000 rows per pass with explicit pagination loop + advisory lock (red-team P0-6). |
| Concurrent same-`gameId` writes overwrite each other's tags | Low | INSERT ON CONFLICT DO NOTHING — first writer wins (red-team P1-9). |
| Recurring-pattern claim ("3rd time you played Bxh7") never fires | (was Med) | **Mitigated by scope cut**: v1 only does tag-level recurrence ("weak king safety in 4 of 8 games"), which fires reliably. Concrete-move recall pushed to v2 with hybrid `(tag + opening_phase)` matching after real data is collected (red-team P1-10). |

## 14. Open questions for implementation

These are intentionally deferred to the implementation plan — none of them block plan generation:

- **Banner micro-copy for `<CoachPanel>` first-run callout** — design + write `COACH_COPY.featureBanner` strings during implementation (P2-3 follow-up). Out of spec scope.
- **Supabase client null-handling pattern** — `getSupabaseServer()` returns `null` on missing env (verified: `lib/supabase/server.ts`). Implementation plan must explicitly handle the null branch in `persistAnalysis`, `aggregateHistory`, and the DELETE/cron routes (each chooses between fail-soft skip vs. 503 response — see §6.5 + §8.2).
- **Soft-cap row-cleanup query timing** — fire post-insert synchronously, or via `waitUntil` (Vercel function) so it doesn't add to user-perceived latency. Pick during implementation; both are correct.
- **Smoke-test corpus for taxonomy validation** — collect 20-30 real `mistake.explanation` strings from current Redis state during implementation; verify each gets a tag from the 6-label set or document the gap.

(Red-team-resolved opens — no longer pending: `lib/content/legal-copy.ts` location, `<Sheet>` vs `<Dialog>`, `verifyMessage` vs `recoverMessageAddress`, `coach/history` route existence, `<CoachPanel>` props plumbing.)

---

## 15. Red-team mitigation index

Cross-reference for the implementation plan — each finding maps to its resolution location in this spec.

| ID | Resolution location |
|---|---|
| P0-1 (replay defense) | §8.2 — server nonce store + chain/domain binding + 5 explicit error codes |
| P0-2 (`/coach/history` 404) | §9.2 + §10 — new `app/coach/history/page.tsx` route |
| P0-3 (`<CoachPanel>` props) | §9.1 props block + §10 (`coach-panel.tsx` MODIFIED + `arena/page.tsx` MODIFIED) |
| P0-4 (paths + SSOT) | §8.3 — `app/privacy/page.tsx` + `PRIVACY_COACH_COPY` in `editorial.ts`; §10 drops `legal-copy.ts` |
| P0-5 (backfill race) | §7 — poll-and-wait up to 3s, plus `aggregateHistory` returning null is acceptable in §6.5 |
| P0-6 (cron unbounded + concurrency) | §8.1 — batched LIMIT + advisory lock + error branch + GH Actions concurrency group |
| P0-7 (delete UX honesty) | §9.2 — disabled button when 0 rows + neutral toast in §9.3 |
| P0-8 (recovered-vs-body) | §8.2 — strict address comparison + key all deletes off recovered address |
| P1-1 (taxonomy) | §5 — explicit 6-label v1 set + §2 deferral note |
| P1-2 (UPSERT amplification) | §6.1 — soft cap of 200 rows per wallet via post-insert delete |
| P1-3 (token amplification) | §6.3 — 600-char block cap with truncation in `buildCoachPrompt` |
| P1-4 (`historyDepth` leftover) | §6.4 + §6.5 unified to `gamesPlayed` |
| P1-5 (`kind="quick"` forward compat) | §5 — `kind` column with `check (kind in ('full','quick'))` |
| P1-6 (backfill TTL drift) | §7 — `expires_at = createdAt + 1y` set explicitly |
| P1-7 (tag-extract throw drops row) | §7 backfill + §6.1 write path + §6.5 — try/catch defaults to `[]` and preserves row |
| P1-8 (log salt) | §8.4 — 16-char prefix + secrecy contract + rotation runbook |
| P1-9 (concurrent same `gameId`) | §6.1 + §7 — INSERT…ON CONFLICT DO NOTHING |
| P1-10 (concrete-move recall) | §1 + §2 + §3 + §6.3 — feature dropped from v1; tag-level only |
| P2-1 (modal primitive) | §9.2 — `<ConfirmDeleteSheet>` built atop existing `<Sheet>` |
| P2-2 (telemetry field) | §12 — `redis_keys_deleted: number` (count, not array) |
| P2-3 (silent perks swap) | §9.4 + §13 — one-shot first-run banner via `COACH_COPY.featureBanner` |
| P2-4 (cron error branch) | §8.1 — try/catch returns 500 on Supabase delete error |
| P2-5 (lost-key recourse) | §8.3 — `PRIVACY_COACH_COPY.para4` discloses out-of-band path |

---

**Sign-off:** Design approved 2026-05-06 in brainstorming session. Adversarial red-team review applied 2026-05-06 (23 findings; all resolved inline). Ready for `superpowers:writing-plans` skill to produce the implementation plan.
