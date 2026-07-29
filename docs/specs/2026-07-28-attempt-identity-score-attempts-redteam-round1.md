# Red Team Review — attempt-identity-score-attempts (Slice 3)

**Date**: 2026-07-28
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md`

---

## Findings

### P0 — Must address before implementation

#### P0-1 · [state] B8 is prose, not a contract — and the failure it invites is SILENT UNDER-COUNTING

B8 says the `attemptId` is "minted at completion time and reused verbatim". It never says
**where that value lives, or when it is cleared**. That is the single most important
requirement in the spec and it has no owner.

The call site is `handleSubmitScore` (`components/exercises/exercises-screen.tsx:2190`),
which is the *submit*, not the *completion*. It already carries three overlapping
resubmission paths in the same component: the silent auto-save (`opts.silent`), the manual
"Retry save" (`autoSaveFailed`), and, one layer down, the session re-auth replay
(`save-client.ts:151-176`). Whatever holds the id must be stable across all three.

Now consider the implementation that any reasonable engineer reaches for — a `useRef`
minted next to `submittingScoreRef`:

- If it is **not reset when a new exercise starts**, exercise #2 submits with exercise #1's
  `attemptId`. Per B5 that is a *replay*: the RPC **inserts nothing** and returns the stored
  result. The player played twice; the table records once. The endpoint returns 200. No
  error, no log, no failing test — the table quietly says they did not play.
- If it is reset **on every render or on every submit**, the retry paths mint fresh ids and
  we double-count instead (P0-2's problem, from the other direction).

Under-counting is worse than double-counting here, because this table's entire purpose is
to answer "did they play". Getting it wrong in the conservative direction reintroduces
exactly the defect P0-1 of the Slice 2 red-team described: a veteran plays and ranks
nowhere.

**Why blocking:** the correctness of the whole slice reduces to this lifecycle, and the
spec delegates it to the implementer's taste. Tests written from the spec as-is would all
pass on the broken version, because none of them mount two consecutive exercises.

**Fix the spec must contain:**
1. Name the state and its scope explicitly — the id is a property of the *current attempt*,
   so it belongs where the attempt's score does, minted in the same place the score becomes
   final, and invalidated by the same thing that starts a new attempt (`resetBoard` /
   content change).
2. Add an acceptance criterion that is not satisfiable by the broken version:
   *"completing exercise A, then exercise B, produces two rows with different
   `attempt_id`s"* — mounted against the real screen, not against `postScoreSave` alone.
3. State the invariant in one line, in the code: **one mint per completion, N submissions
   per mint.**

#### P0-2 · [data] `attempt_index` derived from `count(*)` is a time bomb the spec plants in two separate paragraphs

B7 computes `attempt_index = count(*) where wallet and level_id, + 1`. *Non-goals* says
retention is "no TTL, no cap — revisit on measured volume".

Those two decisions are individually fine and jointly broken. The moment anything is ever
deleted from this table — the retention review the spec explicitly schedules — `count(*)+1`
starts **re-issuing ordinals already emitted**. `attempt_index` stops being an identity and
becomes a duplicate-producing counter, and every historical row that used the old value is
now ambiguous. Nothing in the schema prevents it: there is no `unique` on
`(wallet, level_id, attempt_index)`.

The same flaw appears sooner than retention if any row is ever removed by hand during an
incident — which is precisely when someone will delete rows.

**Fix:** derive from `coalesce(max(attempt_index), 0) + 1` for `(wallet, level_id)`, and add
`unique (wallet, level_id, attempt_index)` so the invariant is enforced by Postgres rather
than promised by a function body. `max` survives deletion; `count` does not. Add an index
on `(wallet, level_id)` to keep the `max` a lookup rather than a scan (also answers P2-2).

#### P0-3 · [composition] The spec never says whether `save_score_attempt` CALLS `save_basic_score` or reimplements it

B1 says the new RPC "resolves `score_saves` exactly as `save_basic_score` does today". That
sentence describes an outcome, not a mechanism, and the two available mechanisms have
opposite risk profiles:

- **Call it** — one implementation of the dedup/insert, guaranteed not to drift. Requires
  saying so, and requires stating that the nested `pg_advisory_xact_lock(hashtext(wallet))`
  is safe (it is: advisory *xact* locks are re-entrant within the same transaction, and the
  outer and inner calls hash the same wallet).
- **Copy the body** — two functions that both write `score_saves`, free to diverge on the
  next change to either. This repo already has a written rule against exactly this shape:
  `lib/leaderboard/queries.ts:117` — *"the fallback must hit the SAME source so the two
  never diverge"*.

Left unspecified, copy-paste is the path of least resistance during implementation, because
the new RPC needs `save_status` out of the middle of the old one and the old one only
returns jsonb.

**Also unspecified and load-bearing:** what happens to `save_basic_score` itself. It stays
callable with 9 args after this ships. If it does, there are two doors into `score_saves`
and only one records attempts — so any future caller that picks the old door writes a save
with no attempt, silently. Decide: keep it as the inner primitive **called only by
`save_score_attempt`**, and say so in its `comment on function`, or drop it.

**Why blocking:** it decides whether this migration creates a second write path into the
table the whole leaderboard reads.

---

### P1 — Should address

#### P1-1 · [data quality] B9's server-minted fallback poisons the historical series, permanently

B9 accepts requests with no `attemptId` by minting one server-side. Correct call for
availability. But the spec then stores those rows **indistinguishably** from client-minted
ones, in an append-only table with no deletion, that Slices 4–5 will treat as ground truth.

Concretely: the window where stale bundles exist is the deploy — which is also when live
sessions get invalidated and the `save-client.ts:151-176` re-auth replay fires most. Every
such replay from an old client writes **two attempt rows for one attempt**. Volume is
small; permanence is total, and nothing downstream can tell which rows to distrust.

**Fix:** add `attempt_id_source text not null check (attempt_id_source in ('client','server'))`.
One column, written once, and every future analysis can exclude the ambiguous rows instead
of guessing. Also lets you *measure* when the stale-client tail ends and drop B9 later.

**Rejected alternative, for the record:** deriving the id deterministically from
`save_id + timeMs` when absent. It trades over-counting for silent *under*-counting (two
genuine attempts with identical score and identical millisecond collapse into one) and is
therefore worse for this table's purpose, per P0-1's reasoning.

#### P1-2 · [premise] "Played" in this table means "played AND scored ≥ 1"

`validateScoreSaveBounds` (`save-authorization.ts:133`) rejects `score` that is not
`isPositiveInt`, i.e. **0 is rejected as `invalid_score`**, and the table's own check is
`score > 0`. So a completed attempt worth zero points never reaches the RPC and never
becomes a row (B4 makes this explicit for rejected requests).

If a player can finish an exercise with a score of 0, this table is blind to that activity
— and it is blind in a biased way: it drops the attempts of the players who are struggling,
which is exactly the population a consistency or engagement metric most needs.

**Measure it before building on it:** is 0 reachable on a completed exercise? If yes, the
spec's claim that `created_at` means "played" needs the qualifier written into the table
comment, and Slice 4 must be told. If no, say so and close it.

#### P1-3 · [schema] `save_id text not null` with no FK, justified by a pointer to "D3", which does not exist

The spec's own contract section says *"Logical pointer to `score_saves.save_id`. NOT a
foreign key: see D3."* There is no section D3 anywhere in the document. The reason for the
most surprising schema choice in the migration is a dangling reference.

Whatever the real reason is (my guess: a FK would make `score_saves` rows undeletable and
adds a lock on a hot write path), it has to be written down — otherwise the first reviewer
of the migration adds the FK "for integrity" and discovers the coupling in production.

Note the constraint is *nearly* satisfiable: at insert time inside the same transaction the
`score_saves` row either exists (duplicate) or is being inserted (saved), so a FK would in
fact hold today. That makes the omission look like an oversight rather than a decision,
which is why it needs the sentence.

#### P1-4 · [contract] `attempt?: AttemptOutcome` optional-everywhere repeats P1-1 of the Slice 2 review

The spec makes `attempt` optional "so existing callers keep type-checking", then states it
is always present on `saved`/`duplicate` and never on failures. That is a discriminated
union described in prose and encoded as an optional field — the identical smell the Slice 2
red-team flagged for `hasOnchain?: boolean`, where absent and false render the same and a
future reader cannot distinguish "no attempt recorded" from "this response shape predates
attempts".

**Fix:** put it on the success variants as required, not on the union as optional. Callers
that ignore it still compile; callers that read it get a guarantee instead of a `?.`.

#### P1-5 · [test] The acceptance list has no test that a replay returns the SAME response as the first call

B5 promises the client "sees the same outcome as the first call", and the criteria check
`replayed: true` and the stored `save_status`/`attempt_index` — but never assert the two
responses are equal. The fields most likely to drift are the ones the RPC recomputes on
every call rather than storing: `freeUsed`, `balance`, `quota`. On a replay those are read
fresh, so a save that happened in between changes them, and the client's
`recordSaveFor(...)` path sees a different payload for what the spec calls the same event.

Either assert full equality of the client-visible result, or narrow B5's promise to the
fields that are actually stable and say which ones are not.

---

### P2 — Nice to clarify

- **[rls] The `own_reads` policy is cosmetic — say so.** Copying `score_saves_own_reads`
  brings a policy keyed on `request.jwt.claims->>'wallet'`. Nothing in this app issues
  Supabase JWTs with a `wallet` claim; all access is service-role, server-side. The policy
  therefore grants nobody anything. That is fine as defence in depth, but the migration
  comment must not imply clients can read their own attempts — someone will build on it.
- **[index] `(wallet, level_id)` is missing** and is needed by P0-2's `max(attempt_index)`.
  The two spec'd indexes serve the weekly window and per-wallet history, not the write path.
- **[ops] No signal on `replayed`.** A rising replay ratio means a client bug (an id that
  stopped rotating — i.e. P0-1 happening in production). It is the single best detector for
  the failure this spec is most exposed to, and it costs one log line. Slice 0 set the
  precedent with `origin_bypass_triggered`.
- **[ops] Volume claim needs a number.** The spec says "revisit on measured volume" without
  saying what today's volume is (132 `score_saves` rows in prod) or what would trigger the
  review. Pick a threshold now — a review with no trigger never happens.
- **[slice2] The first week is empty, by design.** No backfill means the weekly board ships
  showing nothing until Monday. Correct and honest, but it is a product state someone has to
  decide the copy for, and it belongs in Slice 2's spec as a known launch condition, not as a
  surprise.
- **[naming] `game_id` is carried into the RPC signature but not into the table.** It is
  `String(score)` (`route.ts:191`) and thus fully redundant with `score`. Passing it through
  a new function signature propagates a legacy field; either drop it from
  `save_score_attempt`'s parameters or note why it is kept.

---

## Categories audited

**Contract gaps** — types are explicit; no `any`/`Record<string, any>`. The one real hole is
the optional `attempt` (P1-4). Failure modes are enumerated and mapped to status codes that
already exist. `AttemptOutcome` has no error variant, correctly: a failed attempt record
would mean a failed transaction, which is already `save_failed`.

**Behavioral ambiguity** — B1–B11 are individually testable. B8 is the exception and it is
the important one (P0-1). B5's "same outcome" is under-specified (P1-5). Concurrency is
handled the right way (unique constraint as the guard, not read-then-write), consistent
with `score_save_nonces`' PK-is-the-protection design.

**Hidden assumptions** — (1) that the advisory lock composes when nested (true, but unstated,
P0-3); (2) that every completed attempt scores ≥ 1 (unverified, P1-2); (3) that a client can
be trusted to rotate an idempotency key correctly — a trust the spec never states it is
placing, and the whole count depends on it (P0-1); (4) that `attempt_index` will never be
recomputed over a mutated table (false by the spec's own retention plan, P0-2).

**Backward compatibility** — genuinely good. `score_saves` untouched, no backfill, additive
migration, rollback is a `drop`, and old clients keep saving (B9). Response shapes are
supersets. The one compat cost is P1-1's data ambiguity, not a break.

**Security & data** — no new PII: the table holds a wallet already stored in `score_saves`
next to the same numbers. Wallet comes from the session row, never the body — the property
Slice 0 established is preserved because the endpoint is unchanged in that respect. Write
abuse is bounded by the existing session budget and IP limiter; the spec says so and, to its
credit, says not to build rewards on attempt counts until that is closed. RLS is inherited
and inert (P2-1).

**Test coverage gaps** — the "premise test" is the right test and it is present. Missing:
two-consecutive-exercises (P0-1), replay-response-equality (P1-5), and a migration-level
smoke asserting the transaction boundary by forcing an error after the attempt insert.
Precedent for SQL smoke tests exists: `supabase/tests/leaderboard_combined_smoke.sql`.

**Operational readiness** — rollback is specified and trivial. Logging is specified only for
the absent-id case; the replay signal is missing (P2-3). Deploy order matters and is not
stated: the migration must land **before** the client that sends `attemptId`, which B9's
tolerance makes safe — worth writing down as the reason B9 exists.

---

## Verdict

**NEEDS REVISION.**

P0 findings: **3**
P1 findings: **5**
P2 findings: **6**

The design is right: a separate append-only event log, no backfill, no mutation of the table
production depends on, and an idempotency key rather than a heuristic. Those choices are
sound and should not be relitigated.

What blocks it is that the two mechanisms carrying the entire correctness of the slice —
the client-side lifecycle of `attemptId` (P0-1) and the composition with `save_basic_score`
(P0-3) — are described by outcome instead of by contract, and one schema decision (P0-2)
conflicts with a retention decision made three paragraphs away. All three are cheap to fix
in the spec and expensive to fix in a table that never deletes rows.
