# Coach Session Memory — Design Spec

> **Date:** 2026-05-06
> **Author:** Wolfcito + agent (brainstorm session)
> **Status:** Approved design — pending implementation plan
> **Closes:** Etapa 2 of bundle PRO v1 plan; redeems `PRO_COPY.perksRoadmap[0]` ("Personalized coaching plan from match history")

---

## 1. Context & motivation

The Coach (`/api/coach/analyze`) ships today as a one-shot analyzer: each request produces a standalone analysis without recall of prior games. The infrastructure for longitudinal coaching exists in skeletal form — `PlayerSummary` is fetched from Redis (`coach:summary:${wallet}`) and inlined into the prompt — but no synthesis pipeline populates it from past analyses, and Redis storage is ephemeral (30-day TTL).

PRO bundle v1 (commit `bfe0e88`, 2026-05-05) publicly promised "Personalized coaching plan from match history" as the lead `perksRoadmap` item. This spec turns that promise into a shippable feature gated to PRO subscribers, layered onto the existing Coach path with minimal blast radius.

The feature manifest: when a PRO subscriber requests a Coach analysis, the LLM receives a **history digest** of their last ~20 games (top recurring weakness areas + the top-2 most frequent concrete mistakes by `moveNumber` + `played`). When patterns reappear in the new game, the Coach calls them out specifically — *"third time you played Bxh7 sacrifice without calculating the king escape"*. Free tier remains unchanged (existing skeletal summary block).

## 2. Non-goals (explicit out-of-scope)

The following are excluded from v1 to keep scope shippable. Each is tracked for future consideration.

- **Vector embeddings / semantic similarity** — `recurringMistakes` are detected via exact `(moveNumber, played)` match. Embeddings would only matter when v2 needs "structurally similar positions" matching.
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
| 3 | How is history synthesized into the prompt? | **PlayerSummary digest + top-2 recurring concrete mistakes** with `moveNumber` and `played`. |
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
  -- Identity (composite PK ensures idempotent backfill + write-through)
  wallet         text         not null,    -- lowercase 0x address
  game_id        uuid         not null,
  primary key (wallet, game_id),

  -- Time
  created_at     timestamptz  not null default now(),
  -- 1-year rolling retention. Cron purges WHERE expires_at < now().
  expires_at     timestamptz  not null default (now() + interval '1 year'),

  -- Game context (denormalized for prompt building without joins)
  difficulty     text         not null check (difficulty in ('easy','medium','hard')),
  result         text         not null check (result    in ('win','lose','draw','resigned')),
  total_moves    int          not null,

  -- Coach response payload (CoachResponse, kind=full path only)
  summary_text   text         not null,
  mistakes       jsonb        not null,    -- Array<Mistake>
  lessons        jsonb        not null,    -- string[]
  praise         jsonb        not null,    -- string[]

  -- Indexed extraction for fast aggregate
  weakness_tags  text[]       not null default '{}'
);

create index coach_analyses_wallet_recent_idx
  on public.coach_analyses (wallet, created_at desc);

create index coach_analyses_expires_idx
  on public.coach_analyses (expires_at);

alter table public.coach_analyses enable row level security;
create policy "service_role full access"
  on public.coach_analyses for all
  to service_role using (true) with check (true);
-- No anon/authenticated policy: clients only access via server endpoints.
```

**Notes:**

- `weakness_tags` is extracted post-LLM via `extractWeaknessTags(mistakes)`. Maps `mistake.explanation` to canonical labels from a finite set (~20 labels) defined in `lib/coach/weakness-tags.ts`.
- `mistakes` jsonb retains the full `Mistake[]` shape (`moveNumber`, `played`, `better`, `explanation`) so the aggregate can compute `recurringMistakes` by `(moveNumber, played)`.
- `expires_at` is set at insert and never refreshed — referencing an old analysis in a new prompt does not extend its TTL.

## 6. Data flow

### 6.1 Write path (`/api/coach/analyze`, success branch)

Existing Redis writes are unchanged. New PRO write-through after the existing `Promise.all` block:

```ts
if (proStatus.active && normalized.data.kind === "full") {
  try {
    const tags = extractWeaknessTags(normalized.data.mistakes);
    await persistAnalysis(wallet, {
      gameId,
      difficulty: gameRecord.difficulty,
      result: validation.computedResult,
      totalMoves: gameRecord.totalMoves,
      response: normalized.data,
      weaknessTags: tags,
    });
  } catch (err) {
    log.warn({ event: "coach_persist_failed", err: String(err) });
    // Continue — do not fail the analysis the user already paid for.
  }
}
```

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

PRO path appends, after the existing `summaryBlock` and before the `RESULT_HINTS`:

```
Player history (last 20 games): ${digest.gamesPlayed} games.
Recent results: W:${digest.recentResults.win} L:${digest.recentResults.lose} D:${digest.recentResults.draw}.
Recurring weakness areas: ${digest.topWeaknessTags.slice(0,3).map(t => `${t.tag} (×${t.count})`).join(", ")}.
Recurring concrete mistakes:
${digest.recurringMistakes.slice(0,2).map(m => `  - move ${m.moveNumber}: ${m.played} (×${m.count})`).join("\n")}

When analyzing this game, if any of the above patterns reappear, call
that out explicitly — e.g., "this is the third time you played Bxh7
sacrifice without calculating the king escape." Be specific and tie it
to the recurring count above. Do not fabricate a pattern that isn't in
the data.
```

If `digest === null` (PRO user with zero history rows after backfill), the augmentation block is omitted entirely — no `0 games played` stub.

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
| `aggregateHistory` returns empty | Skip augmentation block in prompt; respond with `historyMeta.historyDepth: 0`. |
| `extractWeaknessTags` throws | Skip persistence (don't insert with empty tags). Log warn. |
| Backfill fails | Log warn, continue. Subsequent `/analyze` re-attempts (still idempotent via PK + lock). |

## 7. Backfill

```ts
// lib/coach/backfill.ts
async function backfillRedisToSupabase(wallet: string): Promise<{ copied: number }> {
  const acquired = await redis.set(
    REDIS_KEYS.backfillClaim(wallet),
    Date.now(),
    { nx: true, ex: 60 },
  );
  if (!acquired) return { copied: 0 };

  const { count } = await supabase
    .from("coach_analyses")
    .select("*", { count: "exact", head: true })
    .eq("wallet", wallet);
  if ((count ?? 0) > 0) return { copied: 0 };

  const gameIds = await redis.lrange(REDIS_KEYS.analysisList(wallet), 0, 19);
  if (gameIds.length === 0) return { copied: 0 };

  const rows: CoachAnalysisRow[] = [];
  for (const gameId of gameIds) {
    const analysis = await redis.get<CoachAnalysisRecord>(REDIS_KEYS.analysis(wallet, gameId));
    const game     = await redis.get<GameRecord>(REDIS_KEYS.game(wallet, gameId));
    if (!analysis || !game || analysis.response.kind !== "full") continue;

    const tags = extractWeaknessTags(analysis.response.mistakes);
    rows.push({
      wallet,
      game_id: gameId,
      created_at: new Date(analysis.createdAt).toISOString(),
      // expires_at uses default (now + 1y) — rolling window starts at upgrade,
      // not at original analysis date. Free users had no Supabase footprint.
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
    await supabase.from("coach_analyses").upsert(rows, { onConflict: "wallet,game_id" });
  }
  return { copied: rows.length };
}
```

**Properties:**

- **Idempotent.** Composite PK `(wallet, game_id)` + Redis 60s claim lock + Supabase `count > 0` gate.
- **Fail-soft.** Wrapped in try/catch at the route level; backfill errors don't block the analysis.
- **Bounded.** Max 20 rows × ~5KB ≈ 100KB single insert.
- **One-time per wallet.** `count > 0` gate prevents re-runs even if user cancels and re-subscribes PRO.

## 8. Privacy, retention, deletion

### 8.1 Cron purge

```ts
// app/api/cron/coach-purge/route.ts
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { count } = await supabase
    .from("coach_analyses")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString());
  log.info({ event: "coach_purge_complete", rows_deleted: count });
  return Response.json({ rows_deleted: count });
}
```

Reuses `CRON_SECRET` and the existing GitHub Actions cron worker. Schedule: daily at 03:00 UTC.

### 8.2 Delete-by-self endpoint

`DELETE /api/coach/history` — wallet signs `"Delete my Coach history\nNonce: {nonce}\nIssued: {ISO}"`. Server verifies via viem `verifyMessage`, rejects if signature mismatched or message older than 5 minutes, then deletes the wallet's rows in Supabase + flushes its Redis keys.

### 8.3 Privacy copy

Append to `apps/web/src/app/legal/privacy/page.tsx`:

> **Coach Match History (Chesscito PRO)**
>
> Active PRO subscribers have their game analyses stored to provide personalized coaching across sessions. We retain match analyses for **365 days** from creation, after which they are automatically deleted. Free tier users' analyses live only in our 30-day cache and are never persisted long-term.
>
> **Your control:** You can delete all stored Coach history at any time via your wallet from the Coach panel, regardless of PRO status. Deletion is permanent and immediate.
>
> **What's stored:** wallet address (lowercase), game ID, timestamps, your move list, and the AI-generated coaching response (summary, mistakes, lessons, praise). No personal identifiers beyond the wallet address.

Editorial constants live in `lib/content/legal-copy.ts` (or wherever the rest of the legal copy lives — confirm during implementation).

### 8.4 Wallet hashing for logs

`hashWallet(wallet) = sha256(wallet + LOG_SALT).slice(0, 12)` — stable but non-reversible, mirrors the redaction pattern in `lib/server/logger.ts`.

## 9. UI changes

### 9.1 `<CoachPanel>` footer

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

### 9.2 `/coach/history` delete surface

Section appended to `<CoachHistory>`:

```tsx
<section className="mt-8 border-t border-white/10 pt-4">
  <h3 className="text-sm font-bold text-rose-200">{COACH_COPY.historyDelete.title}</h3>
  <p className="mt-1 text-xs text-white/65">{COACH_COPY.historyDelete.body}</p>
  <Button variant="game-danger" size="game-sm" onClick={openConfirm} className="mt-3">
    {COACH_COPY.historyDelete.cta}
  </Button>
  {confirmOpen && (
    <ConfirmDeleteModal
      onConfirm={signAndDelete}
      onCancel={closeConfirm}
      isWorking={isDeleting}
    />
  )}
</section>
```

`<ConfirmDeleteModal>` reuses the existing `<Sheet>` or `<Dialog>` primitive in `components/ui/`. Color tier: rose (per design system tokens, never `red-*`).

### 9.3 Editorial constants (`COACH_COPY` additions)

```ts
historyFooter: {
  building: "Building your history…",
  reviewing: (n: number) => `Reviewing ${n} past ${n === 1 ? "game" : "games"}`,
  manageLabel: "manage history",
},
historyDelete: {
  title: "Delete all your Coach history",
  body: "Permanently removes every stored analysis from our records. This action cannot be undone. Your active PRO pass is unaffected.",
  cta: "Delete history",
  confirmTitle: "Delete all history?",
  confirmBody: "This will permanently remove all your past Coach analyses and weakness tracking. Your next analysis will start fresh.",
  confirmAccept: "Yes, delete everything",
  confirmCancel: "Keep my history",
  signMessage: (nonce: string, iso: string) =>
    `Delete my Coach history\nNonce: ${nonce}\nIssued: ${iso}`,
  successToast: "History deleted",
  errorToast: "Could not delete — please retry",
},
```

### 9.4 No changes

- `<ProSheet>` — `perksRoadmap[0]` already promises this feature since `bfe0e88`. When this feature ships, **move the item from `perksRoadmap` → `perksActive`** as part of the rollout commit. No new UI, just an array edit.
- `<ArenaHud>` / `<ArenaEndState>` — the promise is fulfilled inside `<CoachPanel>` which already mounts post-checkmate via `coachPhase`. No additional signposting beyond the in-match hint shipped in commit `6491614`.

## 10. New / modified module map

| Path | Status | Purpose |
|---|---|---|
| `lib/coach/weakness-tags.ts` | NEW | `extractWeaknessTags(mistakes)` + canonical tag set |
| `lib/coach/history-digest.ts` | NEW | `aggregateHistory(wallet)` pure function (rows → digest) |
| `lib/coach/persistence.ts` | NEW | `persistAnalysis(wallet, payload)` + Supabase client wiring |
| `lib/coach/backfill.ts` | NEW | `backfillRedisToSupabase(wallet)` |
| `lib/coach/types.ts` | MODIFIED | Add `HistoryDigest`, `CoachAnalysisRow` types |
| `lib/coach/prompt-template.ts` | MODIFIED | Accept `history?: HistoryDigest` param, append PRO block |
| `lib/coach/redis-keys.ts` | MODIFIED | Add `backfillClaim(wallet)` key |
| `app/api/coach/analyze/route.ts` | MODIFIED | Wire backfill + aggregate + persist |
| `app/api/coach/history/route.ts` | MODIFIED | Add DELETE method (signed) |
| `app/api/cron/coach-purge/route.ts` | NEW | Daily TTL purge |
| `lib/content/editorial.ts` | MODIFIED | `COACH_COPY.historyFooter` + `historyDelete` |
| `lib/content/legal-copy.ts` | MODIFIED | Coach section in privacy copy |
| `components/coach/coach-panel.tsx` | MODIFIED | Render footer when `proActive && historyMeta` |
| `components/coach/coach-history.tsx` | MODIFIED | Delete section + confirm modal |
| `components/coach/confirm-delete-modal.tsx` | NEW | Wraps existing Dialog/Sheet primitive |
| Supabase migration | NEW | `coach_analyses` table + indexes + RLS |
| `.github/workflows/cron.yml` | MODIFIED | Add `coach-purge` daily schedule |

## 11. Testing strategy

### Unit tests (no DB, no network)

- `lib/coach/__tests__/weakness-tags.test.ts` — `extractWeaknessTags()` cases per canonical label.
- `lib/coach/__tests__/history-digest.test.ts` — pure function: rows → digest. Edge: empty rows → null, <3 rows → digest with empty `recurringMistakes`.
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
| `coach_history_aggregated` | analyze route, after aggregateHistory | `wallet_hash`, `pro_active`, `depth`, `top_tags_count` |
| `coach_backfill_completed` | backfill, on insert | `wallet_hash`, `copied` |
| `coach_history_deleted` | DELETE handler, success | `wallet_hash`, `supabase_rows`, `redis_keys` |
| `coach_purge_complete` | cron handler | `rows_deleted` |

No raw wallet addresses leave the server. `wallet_hash = sha256(wallet + LOG_SALT).slice(0, 12)`.

## 13. Rollout & rollback

### Rollout sequence

1. **DB migration** — apply `coach_analyses` table + indexes + RLS to Supabase staging, then prod. Idempotent SQL via `create table if not exists`.
2. **Library + route changes** — ship behind no flag; PRO is already a hard gate at the route level. Free behavior is bit-identical to today.
3. **Cron registration** — add `coach-purge` to GH Actions workflow. First run: ~24h after merge.
4. **UI** — `<CoachPanel>` footer + `/coach/history` delete section ship together.
5. **`PRO_COPY` array swap** — move "Personalized coaching plan from match history" from `perksRoadmap` → `perksActive` as the final commit.

### Rollback

- DB: rollback is `drop table coach_analyses`. Redis cache is unaffected; free path keeps working.
- Code: revert the route augmentation; the prompt template falls back to the free path automatically.
- UI: revert the array swap + footer/delete commits.
- Public-facing copy: `perksActive` would temporarily over-promise. The handoff doc captures the rollback playbook so the array swap can be reverted in <5 minutes.

### Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Supabase write latency adds to `/analyze` p95 | Low | Write happens after LLM resolves; user already waited 2-30s. Supabase write ~50ms. |
| LLM hallucinates fake recurring patterns despite prompt instruction | Med | Explicit instruction "Do not fabricate a pattern that isn't in the data." Fallback: smoke-test with 5 real wallets; if hallucinations frequent, tighten with structured-output JSON schema constraint. |
| Backfill races at first concurrent `/analyze` from same wallet | Low | Redis 60s claim lock + Supabase `count > 0` gate make double-writes impossible. |
| Privacy copy under-discovers | Low | Footer link in `<CoachPanel>` makes deletion 1 click away. Privacy page surfaced from footer/about/legal. |
| `expires_at` cron misses a day | Low | TTL is rolling 1y — a missed day adds 1 day to retention, not a violation. Re-run is idempotent. |
| `weakness_tags` taxonomy too narrow | Med | Initial set ~20 labels covers 95%+ of typical beginner mistakes. New tags can be added without migration. |

## 14. Open questions for implementation

These are deferred to the implementation plan, not the design:

- Exact location of `lib/content/legal-copy.ts` vs inline in `legal/privacy/page.tsx` — confirm during implementation.
- `<ConfirmDeleteModal>` — choose between `<Sheet>` and `<Dialog>` based on what fits the page best (current `/coach/history` styling).
- Supabase client wiring for the new module — reuse existing `lib/supabase/server.ts` or sibling import path. Confirm module shape with a single read of that file.
- Tag taxonomy — finalize the ~20-label set during implementation by reviewing 30-50 real `mistake.explanation` strings from current Redis history.

---

**Sign-off:** Design approved 2026-05-06 in brainstorming session. Ready for `superpowers:writing-plans` skill to produce the implementation plan.
