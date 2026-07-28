# Spec — attempt-identity-score-attempts (Slice 3)

**Date**: 2026-07-28
**Status**: **CLOSED at v7 — approved for `/tdd`** (founder, 2026-07-28). D1–D20 are frozen.
Round 7's two P0 are carried as **blocking implementation debt**, below; reopen the spec (v8)
only if writing the tests surfaces a real incompatibility with D1–D20.
**Audit**: `docs/product/2026-07-27-score-and-leaders-audit.md` §8 (Slice 3)
**Reviews**: `-redteam-round1` … `-round6`
**Unblocks**: Slice 2 (`2026-07-27-leaders-weekly-window.md`, verdict NEEDS REVISION)

---

## Problem

`score_saves` holds one row per `(wallet, level_id, score)` ever achieved (`save_id` UNIQUE,
`20260609000000_score_saves_init.sql:54`). Re-achieving a score returns `duplicate` and writes
nothing, so **`created_at` does not mean "played"**. That is what stopped Slice 2.

Two verified client facts complete the picture:

- **The trigger requires improvement** — the auto-save effect gates on
  `scorePendingNew = canSaveScore && totalStars >= 1 && localScoreNum > lastSavedScore`
  (`exercises-screen.tsx:1318`, effect `:2350`). A player at their ceiling never POSTs.
- **Carril 2 never fed the score at all** — labyrinth-family stars go to the daily ledger, not
  to `pieceStars`: *"Labyrinth stars stay OUT of `pieceStars` … only the ledger sees them"*
  (`:3168`), *"They feed no score"* (`:3149`). Since `score = max(1, totalStars) *
  POINTS_PER_STAR` (`:1045`) reads `pieceStars`, carril-2 play has **never reached the server
  in any form**.

One row must separately answer *did they play* (`created_at`) and *how did it go*
(`exercise_id` + raw measurement + server-computed `stars_earned`).

## Goal

Ship `score_attempts` — an append-only log where one row is one completed, scorable,
authenticated attempt of the training system that feeds per-piece progress — with delivery
guaranteed by mechanism: **exactly one event per completion, and no completed attempt lost
before it is sent.**

## Founder decisions — settled, do not relitigate

| # | Decision |
| --- | --- |
| D1 | New table `score_attempts`. `score_saves` untouched: event log vs aggregate/snapshot. |
| D2 | One row per valid request reaching the RPC, **including `duplicate`**. |
| D3 | No TTL, no cap. Append-only. Retention revisited on measured volume. |
| D4 | `score = 0` stays rejected. |
| D5 | `attempt_index` per `(wallet, surface, level_id)`, `coalesce(max(...),0)+1`, unique. |
| D6 | `save_score_attempt` **calls** `save_basic_score`; never reimplements it. |
| D7 | Rollback additive. Never mutate or backfill `score_saves`. |
| D8 | Persist the attempt's own result. `score` is reconciliation-only. |
| D9 | `duplicate` consumes budget. Session 100 saves / 2h, shipped only with D12. |
| D10 | The consume is **atomic** with new-attemptId detection/insert. No refund. |
| D11 | The lifecycle is a **pure reducer**; decisive tests must not mount the screen. |
| D12 | The client never sends stars. It sends a **raw measurement**; the server grades. |
| D13 | Unknown is NULL, never a sentinel. |
| D14 | `unique (wallet, attempt_id)`; replay lookup by wallet + attempt_id. |
| D15 | All grader families in scope. Knight's Tour stays out of performance ranking by `starless: true` — an explicit product exclusion. |
| D16 | **Three host assemblers, zero board emissions.** |
| D17 | The Daily is explicitly out; `focus_day_ledger` owns it. |
| D18 | `canSubmitAttempt` and `canOfferScoreSaveUI` are separate. Writing never requires an improvement. |
| D19 | **Exactly-once is a latch in the assemblers**, keyed by a canonical completion key — not `reached`, not board internals, not a parallel counter. |
| D20 | **At-least-once is an outbox.** A completed attempt survives `resetBoard`, exercise change and network failure until the server confirms *that* attempt. |

Schema and D1–D17 are frozen; round 7 changes client mechanics only.

---

## Contracts (SDD)

### Grader inventory — verified, not assumed

`optimalMoves` means a different thing per bucket (`catalog.ts:98-128`), so it is never passed
generically.

| Bucket / kind | Grader | Raw measurement | Range |
| --- | --- | --- | --- |
| `exercises` / `exercise` | `computeStars(movesUsed, optimalMoves)` `scoring.ts:9` | `movesUsed` | 1–3 |
| `labyrinths` / `labyrinth` | `labyrinthStars(moves, optimal)` `exercises.ts:228` | `movesUsed` | **0**–3 |
| `diagonalRun` / `diagonal-run` | `labyrinthStars` | `movesUsed` | **0**–3 |
| `safePath` / `safe-path` | `labyrinthStars` (arrival) | `movesUsed` | **0**–3 |
| `promotionRun` / `promotion-run` | `promotionRunStars(failures)` `promotion-run.ts:73` | **`failures`** | 1–3 |
| `queens` / `queens` | `tourStars(placed, ceiling)` `tour-score.ts:35` | `placed` + `ceiling` | **0**–3 |
| `knightTour` / `knight-tour` | `resolveCoverageStars({ starless: true })` `content-stars.ts:11` | `visited` + `ceiling` | **starless** |

1. **Promotion Run grades failures, not moves** — *"The route's length was never the
   difficulty. Not dying on the way is"* (founder 2026-07-16, `promotion-run.ts:60-61`).
   ⚠️ `catalog.ts:120-122` says promotion-run *"feeds `labyrinthStars`"*; that sentence is
   about how `optimalMoves` is **solved**, not how the player is graded. The dispatch follows
   this table, and the misleading comment is corrected in the same commit.
2. **0 stars is a real, earned outcome** — `labyrinthStars` above `optimal + 4`, `tourStars`
   below the 80% pass line. A `check between 1 and 3` would abort the insert **and the whole
   transaction** for an honest low run.
3. **Knight's Tour is `starless` by product decision** (D15).

`endgameStars` has no consumer and no bucket; out of scope.

### The two gates (D18)

Verified: `canSaveScore = address && isConnected && isCorrectChain && levelId > 0n`
(`:1295-1296`) — it never looked at score or stars, and `handleSubmitScore` already gates on it
(`:2205`). The improvement requirement lives only in `scorePendingNew` (`:1318`), which drives
the auto-save effect (`:2350`) and the results sheet, where it is passed under the misleading
prop name `canSaveScore={scorePendingNew}` (`:3476`).

```ts
/** May we WRITE? Wallet/session only — never an improvement. */
const canSubmitAttempt = canSaveScore;
/** Is there something to send right now? */
const nextSubmission = selectNextSubmission(lifecycle);
/** May we OFFER the score-save UI? Unchanged semantics. */
const canOfferScoreSaveUI = scorePendingNew;
```

Permission and availability are separate values (round-6 P2-1). The results-sheet prop is
renamed `canOfferScoreSave`. Rule: **a completed carril-2 attempt POSTs even though the
cumulative score did not move and `score_saves` will answer `duplicate`.**

### Measurement — a discriminated union, never a pair of numbers

```ts
// lib/scores/attempt-measurement.ts
export type AttemptMeasurement =
  | { kind: "moves";    movesUsed: number }
  | { kind: "failures"; failures: number }
  | { kind: "coverage"; reached: number; ceiling: number };

export type GradeResult =
  | { ok: true;  grade: "graded";   starsEarned: 0 | 1 | 2 | 3 }
  | { ok: true;  grade: "starless"; starsEarned: null }
  | { ok: false; reason: "unknown_exercise" | "level_mismatch"
                       | "measurement_kind_mismatch" | "measurement_out_of_range" };

export function gradeAttempt(
  input: { exerciseId: string; levelId: number; measurement: AttemptMeasurement },
  catalog: BuiltCatalog,
): GradeResult;
```

1. `exerciseId` must exist in the server-built catalogue (`buildCatalog`, `catalog.ts:161`) —
   membership, not shape; ids are neither patterned nor sequential.
2. The bucket determines kind, grader **and accepted measurement kind**. A `promotion-run` id
   with `{ kind: "moves" }` → `measurement_kind_mismatch` (400), never a fallback grade.
3. The exercise's canonical piece must map to the declared `levelId` (`getLevelId`,
   `scoreboard.ts:40`); the persisted `level_id` is the catalogue's.
4. Bounds per measurement kind (round-6 P1-1):
   - `moves` — `[1, MOVES_CEILING(e)]` with `MOVES_CEILING(e) = max(60, 8 × e.optimalMoves)`.
     The `8×` covers a player who wanders; the floor of 60 covers short-optimal exercises
     where `8×` would be tighter than a plausible completion. Applies **only** to the four
     move-graded buckets: `exercise`, `labyrinth`, `diagonal-run`, `safe-path`. Asserted
     against the built catalogue: for every exercise in those buckets,
     `MOVES_CEILING(e) ≥ 60` and `≥ 8 × e.optimalMoves`.
   - `failures` — `[0, 99]`; `promotionRunStars` saturates at 2, so the bound rejects only
     absurdity.
   - `coverage` — `reached ∈ [0, ceiling]`, and **the catalogue's ceiling is authoritative**:
     the client's value is ignored, not compared (the tour's ceiling is documented as an upper
     bound, not exact).
5. Grade with the mapped pure grader. No formula is written in this slice.

### The lifecycle — an outbox, not a slot (D20)

```ts
// lib/scores/attempt-lifecycle.ts
export type AttemptSnapshot = {
  attemptId: string;                 // 32 lowercase hex
  exerciseId: string;
  measurement: AttemptMeasurement;
  timeMs: number;                    // captured at completion, no sentinel
  levelId: number;
  score: number;                     // cumulative snapshot, reconciliation only
};

export type AttemptEvent =
  | { type: "completed"; snapshot: Omit<AttemptSnapshot, "attemptId"> }
  | { type: "submission_started"; attemptId: string }
  | { type: "submission_settled"; attemptId: string }
  | { type: "submission_failed";  attemptId: string };

export type AttemptLifecycleState = {
  /** FIFO of minted attempts the server has not confirmed. */
  outbox: AttemptSnapshot[];
  /** The attemptId currently being POSTed, if any. */
  inFlight: string | null;
};

export function attemptLifecycleReducer(
  state: AttemptLifecycleState, event: AttemptEvent, mint?: () => string,
): AttemptLifecycleState;

/** The next snapshot to POST, or null while one is in flight / the outbox is empty. */
export function selectNextSubmission(s: AttemptLifecycleState): AttemptSnapshot | null;
```

Rules:

- `completed` mints a **new** `attemptId` and **enqueues** — on every completion, including
  ones that add no stars and ones whose cumulative `score` is unchanged.
- `submission_started` sets `inFlight`; `selectNextSubmission` returns null until it clears, so
  one POST is in flight at a time.
- `submission_settled` removes **that** `attemptId` and only that one, wherever it sits in the
  queue, and clears `inFlight`.
- `submission_failed` clears `inFlight` and **keeps** the snapshot, so a retry re-sends the
  same `attemptId` — which the server already treats as a replay (B6).
- **There is no `attempt_started` event.** The reducer does not observe `resetBoard`, exercise
  change or piece change at all: the submission lifecycle is fully decoupled from the board's
  visual lifecycle. This is the mechanism for D20 — no reset path can reach an unsent attempt
  because none of them talk to the reducer.
- Repeated renders emit no events, so they cannot mint.
- `attemptSeq` from `useExerciseProgress` must **not** be the discriminator: it resets to 1 on
  every exercise change and is shared with other systems (`:964-977`).

The outbox is capped at **20** snapshots. On overflow the **oldest** is dropped and
`score_attempt_outbox_overflow` is logged — a bounded queue in a client that may be offline is
a requirement, and dropping the oldest keeps the most recent play. The cap is far above the
session's realistic burst; reaching it means the server has been unreachable for a long time.

The auto-save effect keys on `nextSubmission?.attemptId` instead of `localScoreNum`, so it
fires once per minted attempt rather than once per distinct score.

### Exactly-once — a latch in the assemblers (D19)

Round 6 established that `if (!reached) return` (`:3142`) cannot dedupe: three of the four
families that route through `handleLabyrinthMove` call it as `onComplete` with the target
position passed **literally** (`:3674-3676`, `:3712-3714`, `:2928-2931`), so `reached` is true
by construction. The only shared guard, `isLocked` (`:3741`), goes to the generic `Board`
alone.

The latch therefore lives in the assemblers and nowhere else:

```ts
/** Canonical identity of ONE logical completion. */
type CompletionKey = `${string}:${string}`;   // `${contentId}:${runKey}`
const emittedCompletionRef = useRef<CompletionKey | null>(null);

function emitCompletion(key: CompletionKey, snapshot: Omit<AttemptSnapshot, "attemptId">) {
  if (emittedCompletionRef.current === key) return;   // same completion, second call
  emittedCompletionRef.current = key;
  dispatchLifecycle({ type: "completed", snapshot });
}
```

`runKey` is **the value React already uses as the board's `key`** — `labyrinthKey`,
`safePathResetKey`, `promotionRunResetKey`, `boardKey` — which rotates precisely when a new
attempt begins (that is what remounts the board). So a new completion rotates the key and the
latch reopens; the same completion invoked twice does not. No parallel counter is introduced.

One ref suffices for all three assemblers: the boards are mutually exclusive by construction
(`:3670-3733` is a single ternary chain), so only one family can be completing at a time.

Boards are explicitly **permitted** to call `onComplete` more than once (round-6 P1-3). The
guarantee is owned by the assembler, which makes it testable in one place instead of trusted
across five components.

### The three host assemblers (D16)

All three already exist, own the grading decision, and hold everything a snapshot needs.
**Boards emit nothing** and no board prop changes.

| Assembler | Families | Measurement, already in hand | Completion key |
| --- | --- | --- | --- |
| exercise completion `:1700-1705` | exercise | `movesCount` | `${currentExercise.id}:${boardKey}` |
| `handleLabyrinthMove` `:3111` | labyrinth · diagonal-run · safe-path · promotion-run | `grading ? { kind:"failures", failures: grading.metric } : { kind:"moves", movesUsed: movesCount }` (`:3143`) | `${activeContent.id}:${runKey}` |
| `handleCoverageComplete` `:3207` | knight-tour · queens | `{ kind:"coverage", reached: covered, ceiling }` | `${activeCoverage.id}:${labyrinthKey}` |

Promotion Run needs **no new callback**: `promotionRunFailures` is a host ref, incremented at
`:2861` (caught) and `:2901` (wrong crown), read at `:2926` immediately before reset, and
already passed into `handleLabyrinthMove` as
`{ metric: failures, starsFor: promotionRunStars }` (`:2928-2931`).

`/dev` inertness (round-6 P1-5) is mechanical, not asserted: the assemblers dispatch through a
context provider that the `/dev` probe routes do not mount, so on those routes
`dispatchLifecycle` is a no-op. Probes render boards; they do not acquire a write path.

### Request / response

```ts
type ScoreSaveRequestBody = {
  levelId: number;      // 1..6, cross-checked against the catalogue
  score: number;        // 1..MAX_SCORE_PER_LEVEL (0 rejected — D4)
  timeMs: number;       // 1..3_600_000
  attemptId?: string;   // /^[0-9a-f]{32}$/ — optional for wire compat only (B12)
  exerciseId?: string;
  measurement?: AttemptMeasurement;
};

export type AttemptOutcome = {
  attemptId: string; attemptIndex: number; replayed: boolean;
  starsEarned: number | null; gradeStatus: "graded" | "starless" | "ungraded";
};

export type BasicScoreSaveResult =
  | { status: "saved";     mode: "free"; quota: ScoreSaveQuota; attempt: AttemptOutcome }
  | { status: "duplicate"; quota: ScoreSaveQuota;               attempt: AttemptOutcome }
  | { status: "invalid";      reason: string }
  | { status: "rate_limited"; retryAfterMs: number }
  | { status: "error";        reason: string };
```

Unknown body fields are ignored uniformly and logged (`score_save_unknown_fields`).

### Table (frozen since round 6)

```sql
create table public.score_attempts (
  id            bigint generated always as identity primary key,
  attempt_id    text        not null,
  wallet        text        not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  surface       text        not null check (surface in ('learn','play')),
  level_id      int         not null check (level_id between 1 and 6),  -- canonical, = piece
  exercise_id   text        null check (exercise_id is null or length(exercise_id) between 1 and 64),

  measure_kind    text null check (measure_kind is null or measure_kind in ('moves','failures','coverage')),
  measure_value   int  null check (measure_value is null or measure_value >= 0),   -- moves | failures | reached
  measure_ceiling int  null check (measure_ceiling is null or measure_ceiling > 0),-- coverage only

  grade_status  text        not null check (grade_status in ('graded','starless','ungraded')),
  stars_earned  int         null check (stars_earned is null or stars_earned between 0 and 3),

  score         int         not null check (score > 0),   -- cumulative, reconciliation only
  time_ms       int         not null check (time_ms > 0),
  save_status   text        not null check (save_status in ('saved','duplicate')),
  save_id       text        not null,                     -- logical pointer, not a FK
  attempt_index int         not null check (attempt_index > 0),
  attempt_id_source text    not null check (attempt_id_source in ('client','server')),
  created_at    timestamptz not null default now(),

  unique (wallet, attempt_id),
  unique (wallet, surface, level_id, attempt_index),

  constraint score_attempts_grade_coherent check (
    (grade_status = 'graded' and stars_earned is not null) or
    (grade_status in ('starless','ungraded') and stars_earned is null)
  ),
  constraint score_attempts_measure_coherent check (
    (measure_kind is null and measure_value is null and measure_ceiling is null) or
    (measure_kind in ('moves','failures') and measure_value is not null and measure_ceiling is null) or
    (measure_kind = 'coverage' and measure_value is not null and measure_ceiling is not null)
  )
);

create index score_attempts_created_idx on public.score_attempts (created_at desc);
create index score_attempts_ordinal_idx
  on public.score_attempts (wallet, surface, level_id, attempt_index desc);
```

`unique (wallet, attempt_id)` matches `score_save_nonces`' `primary key (wallet, nonce)` and
its stated reason (`20260729000000:67-70`); it also removes the cross-wallet replay oracle.
`save_id` is deliberately not a FK. Column comments state that `measure_value` holds moves,
failures **or** `reached` depending on `measure_kind`, and that the Daily is not in this table.

### RPC — one transaction, consume included (frozen since round 6)

```text
save_score_attempt(
  p_token_hash text, p_attempt_id text, p_attempt_id_source text,
  p_level_id int, p_score int, p_time_ms int, p_exercise_id text,
  p_measure_kind text, p_measure_value int, p_measure_ceiling int,
  p_grade_status text, p_stars_earned int, p_deployment_surface text
) returns jsonb
```

1. Resolve the session by `p_token_hash` → wallet, surface, state. Failure → that status
   **with the wallet hash**, so the endpoint keeps its logging identity.
2. `pg_advisory_xact_lock(hashtext(wallet))`.
3. Surface mismatch → `surface_mismatch`, with the wallet hash.
4. Replay by `(wallet, p_attempt_id)` → stored values, `replayed: true`, **consumes 0**.
5. Consume one save via `consume_score_write_session`; `exhausted` → rollback, nothing spent.
6. `save_basic_score(...)` (D6); `p_game_id` = `String(score)`.
7. `attempt_index := coalesce(max(attempt_index),0)+1`; insert.
8. Return the union of the save result and the attempt outcome.

Any failure after step 4 rolls everything back, so "rejected → consumes 0" is a property of
the transaction, not a refund. Lock order is an invariant: the advisory lock precedes any
`score_write_sessions` UPDATE, and `/api/scores/authorize` must never take the wallet advisory
lock — enforced by a test scanning for `pg_advisory`. Replay provenance: `status`/
`scoreSaveId`/`stars_earned`/`grade_status` from the stored row; `mode` constant `'free'`;
`freeUsed`/`balance` from the same two direct selects `save_basic_score` uses.

Privileges — Postgres grants `EXECUTE` to `PUBLIC` by default, so revoking from
`anon`/`authenticated` alone changes nothing:

```sql
revoke execute on function public.save_basic_score(...)   from public;
revoke execute on function public.save_score_attempt(...) from public;
grant  execute on function public.save_score_attempt(...) to service_role;
grant  execute on function public.save_basic_score(...)   to service_role;
```

`SCORE_SESSION_MAX_SAVES` 25 → **100**, in the same change as grading. TTL already 2h. Raising
the ceiling keeps live 25-save sessions valid (`session-authorization.ts:238`).

---

## Behavior

1. New attemptId, valid request → one attempt row, the normal `score_saves` resolution, one
   budget unit, one transaction.
2. **Every completion emits exactly one `completed` event**, from one of the three assemblers,
   regardless of whether the cumulative score moved. A second call for the same completion key
   emits nothing (D19).
3. **A carril-2 completion POSTs with an unchanged `score`**, so `save_id` re-derives
   identically and `score_saves` answers `duplicate`: zero new `score_saves` rows, one new
   `score_attempts` row. Normal, not an error.
4. **A completed attempt survives the board** (D20). `resetBoard`, exercise change, piece
   change and navigation do not touch the outbox; the reducer never observes them.
5. **A failed POST keeps its snapshot.** The retry re-sends the same `attemptId`, which the
   server answers as a replay — so a retry can never become a second attempt.
6. **`submission_settled` removes only its own `attemptId`.** A queued attempt B is unaffected
   by A settling.
7. `duplicate` consumes one budget unit.
8. Rejected requests write nothing and consume nothing — 403 origin, 429 rate limit, 401 dead
   token, 400 bounds, 400 unknown exercise, 400 level mismatch, 400 measurement-kind mismatch,
   400 out-of-range measurement, 400 surface mismatch, 503 store down.
9. A **foreign** `attempt_id` is not a replay: looked up by `(wallet, attempt_id)` it finds no
   row and never returns another wallet's data.
10. Replay stability — stable: `status`, `attemptId`, `attemptIndex`, `scoreSaveId`,
    `starsEarned`, `gradeStatus`. Not stable: `freeUsed`, `balance`, `quota`.
11. `attempt_index` = `max(...)+1` per `(wallet, surface, level_id)` inside the advisory lock.
12. Nested advisory lock is safe: both calls take the same xact lock on the same wallet hash;
    xact locks are re-entrant in one transaction.
13. `stars_earned` is server-computed by the grader the **catalogue bucket** selects. Knight's
    Tour → `starless`, NULL. A labyrinth over `optimal + 4` → `graded`, 0.
14. Absent `attemptId` → the server mints one, `attempt_id_source = 'server'`, logs
    `score_attempt_id_absent`. Makes the deploy order safe (migration + endpoint first).
15. Absent `exerciseId`/`measurement` → those columns NULL, `grade_status = 'ungraded'`.
16. `replayed: true` is logged (`score_attempt_replayed`); outbox overflow is logged.
17. **The Daily writes nothing here** (D17); the `family` union has no Daily member, so a
    Daily caller cannot construct a valid event.
18. **`/dev` probes write nothing**: the dispatch context is not mounted on those routes.
19. Response shapes stay supersets; a client ignoring `attempt` behaves as today.

---

## Edge cases

- **Ceiling player replays a 3★ exercise** — `netStars` 0, `score` unchanged, `duplicate`, one
  attempt row with `stars_earned = 3`.
- **Any carril-2 completion** — `score` unchanged **by today's rule** (`:3149`, `:3168`,
  deliberate: labyrinth stars feed the ledger, not `pieceStars`), so every carril-2 row is
  `duplicate`. If that rule is ever revisited, carril-2 submissions start producing `saved`
  rows and this expectation inverts — the coupling is stated at both ends (round-6 P1-6).
- **Completion then immediate auto-reset** (`:2844`, `:2880`) — the attempt is already in the
  outbox; the reset cannot reach it.
- **Two completions queued while offline** — both sent, one each, in order, once the network
  returns. Neither is merged.
- **Outbox at 20** — the oldest is dropped and logged. Only reachable after a long outage.
- **Knight's Tour** — always `starless`; activity, never performance (D15).
- **A run below the tour pass line or a labyrinth over `optimal + 4`** — `graded`, 0. The check
  admits 0 precisely so this insert cannot abort the transaction.
- **Budget exhausted mid-session** → `session_exhausted`; nothing written, nothing spent, and
  the snapshot stays in the outbox for a later retry.
- **No wallet connected** — `canSubmitAttempt` false. Attempts still queue; they are sent if a
  wallet connects while they are within the cap. "Played" still means "played with a wallet",
  because nothing is written until one exists.
- **Abuse** — a stolen token buys row count on its own wallet only; with D12 it cannot inflate
  `stars_earned`.

---

## Acceptance criteria

Exactly-once (D19) — the tests that fail on the round-6 arrangement:

- [ ] **Calling the same assembler twice with the same completion key → 1 event, 1
      `attemptId`, 1 POST.** Covered for `handleLabyrinthMove` (labyrinth), for
      `handleCoverageComplete` (coverage) and for the Promotion Run path.
- [ ] Two **different** completions (rotated `runKey`) → 2 events with different `attemptId`s.
- [ ] A board calling `onComplete` three times produces one event — boards are allowed to be
      noisy; the assembler is not.
- [ ] The latch is keyed on the content id **and** the run key: replaying the *same* content
      after a remount emits again.
- [ ] No assembler relies on `reached` or on any board's internal phase for dedup — asserted by
      calling with a non-target position and with the target position and observing the latch,
      not the guard.

At-least-once (D20):

- [ ] **completion → immediate reset before the effect runs → the attempt is still sent.**
- [ ] Completion A pending + reset + completion B → A and B are each sent exactly once.
- [ ] A retry of A creates no third attempt: the same `attemptId` is re-sent and the server
      answers `replayed: true`.
- [ ] `submission_settled(A)` does not remove B.
- [ ] A network error keeps A in the outbox and clears `inFlight`, so the next drain retries it.
- [ ] `selectNextSubmission` returns null while one POST is in flight.
- [ ] The outbox caps at 20, drops the oldest, and logs the overflow.
- [ ] The reducer has **no** event for reset/exercise change — asserted structurally on the
      `AttemptEvent` union, so no future wiring can reintroduce one.

Gates (D18):

- [ ] `canSubmitAttempt` is true for a carril-2 completion with an unchanged score.
- [ ] `canOfferScoreSaveUI` is false in that same state — the two disagree, on purpose.
- [ ] The auto-save effect keys on `nextSubmission?.attemptId`, not `localScoreNum`.
- [ ] The results-sheet prop is renamed and no longer named `canSaveScore` while carrying
      `scorePendingNew`.
- [ ] Completing a carril-2 level renders the same `LabyrinthCompleteOverlay` content as before
      this slice (round-6 P1-4).

Grading:

- [ ] Rejects an unknown `exerciseId` and a `levelId` contradicting the catalogue; persists the
      catalogue's `level_id`.
- [ ] A `promotion-run` id with `{ kind: "moves" }` → `measurement_kind_mismatch`.
- [ ] **Promotion Run grades `failures`** — asserted against `promotionRunStars`, explicitly not
      `labyrinthStars`, with a comment naming `catalog.ts:120-122` as the misleading line.
- [ ] `labyrinthStars`/`tourStars` results of **0** persist as `graded` / 0.
- [ ] Knight's Tour → `starless`, NULL stars.
- [ ] The coverage ceiling comes from the catalogue; a client-supplied one is ignored.
- [ ] `MOVES_CEILING(e) = max(60, 8 × e.optimalMoves)` asserted over every exercise in the four
      move-graded buckets.
- [ ] Table-driven across all seven buckets with a real catalogue id each.
- [ ] No board file imports the dispatch — scanned over **every** `*-board.tsx` in
      `components/exercises/`, not an enumerated subset (round-6 P1-2).

Migration / RPC / endpoint (frozen; still required):

- [ ] Table, both uniques, both coherence constraints, two indexes; `stars_earned` accepts NULL
      and 0–3, rejects 4; `graded` with NULL rejected; `starless` with non-NULL rejected.
- [ ] RLS enabled; `score_saves` neither altered nor written; re-appliable; rollback drops table
      + function only.
- [ ] First-seen id → one row, one budget unit; repeated id → no insert, no `save_basic_score`,
      budget unchanged; foreign id returns no other wallet's data.
- [ ] `surface_mismatch` / `session_exhausted` leave no row and no spend (asserted on
      `used_saves`); an error after the insert leaves neither row nor spend.
- [ ] `attempt_index` per `(wallet, surface, level_id)` across two surfaces; `max`-based, so
      deleting the top row does not re-issue its ordinal.
- [ ] `has_function_privilege('anon', ..., 'EXECUTE')` false for both functions and for
      `authenticated`; lock-order guard scans for `pg_advisory`.
- [ ] The route no longer calls `consumeScoreWriteSession`; unknown fields ignored + logged;
      `score_save_surface_mismatch` still logged **with `walletHash`**.
- [ ] No Daily path reaches the dispatch or `postScoreSave`.
- [ ] The "no other caller" scan covers non-test `src/**`, excluding `__tests__`
      (`route.test.ts` mentions `save_basic_score` at :83, :135, :159, :170, :256).
- [ ] `save-basic-score-schema.test.ts` still passes; its regexes (:68, :77, :132, :203, :225)
      reviewed against the new migration **before** it is written.
- [ ] `SCORE_SESSION_MAX_SAVES = 100` in the same commit as grading.

The two premise tests — never to be weakened:

- [ ] **Carril 1, ceiling player.** Seed a `score_saves` row at the wallet's best for
      `level_id = L`. Complete an exercise of that piece **already at 3★**, so `netStars` is 0
      and `save_id` re-derives identically. Assert in order: `score_saves` count **unchanged**
      (a setup that made a new best fails here), exactly one new `score_attempts` row,
      `save_status = 'duplicate'`, `grade_status = 'graded'`, `stars_earned = 3`.
- [ ] **Carril 2, immutable score.** Complete a Safe Path level. Assert the POST happened, the
      cumulative `score` was unchanged, `score_saves` gained **zero** rows, and `score_attempts`
      gained **exactly one** row with `measure_kind = 'moves'` and a graded star count.

---

## Out of scope / future

- **The Daily** (D17). Slice 2 must not read `score_attempts` as a catalogue of all Focus Days:
  **a wallet can have a Focus Day with zero attempt rows, and attempt rows with no Focus Day.**
  Repeat that sentence verbatim in Slice 2's spec.
- **Remaining quality fields** — `hints_used`, `optimal_moves`, `tier`. Slice 4.
- **`endgameStars`** — no producer today.
- **Failed / abandoned / zero-score attempts** (D4).
- **Outbox persistence across reloads** — the queue is in memory. A reload with unsent attempts
  loses them; persisting it is a Slice 4 question, and the cap makes the exposure small.
- **Slice 2 on this table** — weekly reads `created_at` for "played" and `stars_earned` for
  "how it went", excluding `starless` and `ungraded` rows from performance rankings. No
  backfill, so the first week is empty until the first Monday after deploy.
- **Retention** — manual review when `score_attempts` passes 100k rows.

## Blocking implementation debt (round-7 red team)

Both must be closed **inside** this slice, before it ships. They are carried here rather than
in a v8 because neither changes the schema or D1–D20 — each is one mechanism, and both are best
verified by the tests that cover them. Full analysis:
`2026-07-28-attempt-identity-score-attempts-redteam.md`.

**DEBT-1 · The latch's run key is unverified for three families.** `resetBoard()` rotates
`boardKey` (`:1518`), `safePathResetKey` (`:1527`) and `promotionRunResetKey` (`:1539`) — it
does **not** touch `labyrinthKey`, the run key of Diagonal Run, Knight's Tour and N-Queens.
Those three boards have no `resetKey`, so their only reset is the remount `labyrinthKey`
drives, which probably makes the latch safe — but that is an argument about board internals,
which D19 exists to stop relying on. Failure mode: latch stays closed, the second completion
emits nothing, silent under-count with a 200 on the wire.
Fix: bump `labyrinthKey` in `resetBoard` too, **or** give the assembler its own counter.
Required test: **per family**, assert the key rotates on the path that starts its next attempt.

**DEBT-2 · The outbox is in memory; the platform's normal exit is closing the app.** D20's
guarantee holds only for the life of the page. On MiniPay, closing mid-session is ordinary, and
this repo already had to persist the score session for exactly that reason (`87e35e35`, device-
verified). The exposure concentrates where it hurts: a snapshot sits in the outbox only while a
POST is pending or failing — i.e. when the network is bad, which is when the app gets closed.
Fix: persist the outbox (same precedent as the session), drain on mount before minting, keep
the cap, and version the storage key. **Or** narrow D20 in writing to "survives within a
session" and state the residual loss as measured, not as a footnote.
Required test: a reload with unsent attempts still delivers them exactly once.

## Open questions

None blocking. Round 6's two open questions are resolved by mechanism rather than by answer:
the coverage handler's fire-once behaviour no longer matters once the assembler latches (D19),
and the results sheet keeps `scorePendingNew` under its own name with an explicit criterion
that carril-2 rendering is unchanged.
