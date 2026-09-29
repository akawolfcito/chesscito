# Phase 1 — Disk IO containment and root-cause confirmation

## Findings before this change

### First-seen write amplification

`apps/web/src/app/api/telemetry/route.ts` is the only writer of
`session_first_seen` and `account_first_seen`. It inserts all accepted events
into `analytics_events`, writes `session_first_seen` only for `app_opened`, and
writes `account_first_seen` for every accepted event carrying a connected
wallet.

The route already deduplicated each *request* with Maps. That does not contain
the observed amplification because the browser normally flushes after five
seconds of inactivity and a flush may contain one event. Every such
wallet-bearing request therefore issued `account_first_seen INSERT ... ON
CONFLICT DO NOTHING`, even when the account had been confirmed long ago. This
explains the near 1:1 statement count with `analytics_events`; it does not
change the cohort definition.

This phase adds a bounded, process-local, success-only registry and an
in-flight registry. A confirmed account/session skips another conflict write in
the same warm runtime; concurrent requests share one write. A database error,
process restart, or bounded eviction causes a later idempotent retry. Thus the
database remains the authority and the first observed values remain immutable.

### Stats request and cache architecture

The only application caller of the eight aggregation RPCs is
`apps/landing/src/lib/stats/aggregator.ts`. The historical in-process Next
loader has a 900-second stale-while-revalidate cache and process-local
single-flight (`snapshot.ts`), but it is not the public production path during
containment.

`apps/landing/src/app/stats/page.tsx` reads only the durable all/all Redis
snapshot; browser refreshes, locale changes, and ignored filters do not query
Supabase. `POST /api/internal/stats/refresh` is the sole production RPC path.
It uses a Redis NX lease, so simultaneous refresh requests coalesce across
instances. During the incident it intentionally invokes only the five
non-emergency RPCs; `install_counts`, `top_countries`, and `habit_depth` stay
marked unavailable rather than reintroducing documented temporary-file spills.

This phase aligns the durable snapshot refresh cadence and cooldown with the
900-second freshness target. It does not enable the three expensive RPCs, alter
their SQL, or alter their formulas/schema.

## Changed files and invariants

- `apps/web/src/app/api/telemetry/route.ts`: bounded confirmed/in-flight
  first-seen registries.
- `apps/web/src/app/api/telemetry/__tests__/route.test.ts`: repeated-event and
  first-value regression coverage.
- `apps/landing/src/lib/stats/persisted-snapshot.ts`: 15-minute refresh gate.
- `.github/workflows/cron-stats-snapshot-refresh.yml`: 15-minute refresh
  schedule.

No rewards, score writes, leaderboard behavior, wallet identity, retention
definitions, stats formulas, event names/payloads, or blockchain behavior are
changed. The cache is best-effort only: cold starts and separate instances can
still issue an idempotent first-seen conflict write. Eliminating those requires
a shared identity cache or a database-side design and is deliberately out of
scope.

## Telemetry emitter map — Phase 2 candidates only

| Event | Source and trigger | Pairing/frequency | Product use and Phase 2 assessment |
| --- | --- | --- | --- |
| `peones_balance_viewed` | `lib/peones/telemetry.ts`, called from the balance-chip success effect | One per `(surface,balance)` per tab session; remounts were previously a source of duplicates | Visibility signal; existing module guard means inspect remaining cross-tab/session volume before removal. |
| `arena_mount` | `app/[locale]/arena/page.tsx` mount-only effect | Once per Arena mount | Debugs fresh-entry/recovery; paired with reset only when `fresh=1`, not deterministically for all mounts. |
| `arena_fresh_reset_fired` | same file, `fresh=1` effect | Once per fresh entry | It is deterministically paired with `arena_mount` for `fresh=1`; exact equal aggregate counts imply current traffic was overwhelmingly fresh-entry, not that the code always pairs them. Candidate to consolidate after dashboard review. |
| `exercise_complete` | `components/exercises/exercises-screen.tsx` after solved exercise | Once per screen completion | Legacy/current completion funnel signal. It can accompany the hook's training completion for the same solve. Candidate for canonicalization, not removal yet. |
| `training_exercise_completed` | `hooks/use-exercise-progress.ts` state update | Once per recorded attempt | Baseline training/replay analytics; paired with `training_stars_earned` only when total stars increase. |
| `training_stars_earned` | same hook when `delta > 0` | Zero or one per completion | Progress measurement; independent event by design. Candidate to fold into completion only after consumers are audited. |
| `score_save_free` / `sweep_result` | `lib/scores/save-telemetry.ts` result mapper / exercise-progress sweep branch | One save result; sweep result only for sweep exercises | Save/quota analytics and replay experiment respectively; both can follow completion but are not duplicates by definition. |
| `game_persist_attempt` | Arena `runPersist` before POST `/api/games` | One per persistence attempt, including user retry | Pairs with outcome for every non-aborted request; needed to calculate persistence reliability. Keep until dashboards confirm a single outcome event can replace it. |
| `game_persist_outcome` | Arena success/failure/cancelled paths | One outcome after each non-aborted attempt; user-dismissed is separate terminal state | Same reliability funnel. 1371/1362 is consistent with aborted/unresolved attempts; verify by `game_id`, no semantics change now. |
| `score_save_deferred` | score result mapper when reason is `session_required`, called at exercise completion | One per completion/save attempt while no signing session exists | Not a transport retry loop: the save stays local and retries on a later completion. 25.59/session indicates repeated deferred completion attempts; candidate for session/action dedupe after product review. |
| `badge_claim_tx` | `use-badge-sheet-state.ts` and legacy `exercises-screen.tsx` claim flows | Start plus one terminal stage, with legacy flow also reporting broadcast | Transaction-stage telemetry, so several events may represent one real claim. Two active emitters are the strongest Phase 2 duplication candidate; audit which host is reachable before consolidation. |

## Production measurement procedure

1. Leave the telemetry kill switch enabled until a fresh browser bundle is
   verified; do not infer this from old-tab requests.
2. Capture two read-only `pg_stat_statements` snapshots over a fixed 15-minute
   window, grouped by the normalized `analytics_events`, `account_first_seen`,
   `session_first_seen`, and every `stats_*` statement. Record call deltas,
   `shared_blks_dirtied`, `shared_blks_written`, `temp_blks_read`,
   `temp_blks_written`, and mean execution time.
3. Confirm `/stats` browser refreshes cause Redis reads only. Trigger exactly
   one authorized refresh and verify the next call receives the cooldown/lock
   response; never run concurrent manual refreshes as a load test.
4. After telemetry is intentionally re-enabled on a fresh deployment, repeat
   the 15-minute delta window. Expect analytics rows to remain product-driven,
   while first-seen calls fall toward new identities plus cold-instance misses,
   rather than tracking every analytics row.
5. Compare the Supabase Disk IO Budget slope over matched traffic windows. Do
   not attribute accumulated lifetime counters to this deployment; use deltas.
