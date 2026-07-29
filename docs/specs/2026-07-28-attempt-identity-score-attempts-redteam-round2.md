# Red Team Review — attempt-identity-score-attempts (Slice 3) — ROUND 2

**Date**: 2026-07-28
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` (revised)
**Round 1**: `2026-07-28-attempt-identity-score-attempts-redteam-round1.md` — its P0-1
(lifecycle), P0-2 (`count(*)` ordinal), P0-3 (composition) and all five P1 are **closed**.

Everything below is new, and every finding was verified against the code, not inferred.

---

## Findings

### P0 — Must address before implementation

#### P0-1 · [premise] `score` is a per-piece RUNNING TOTAL, not what the attempt scored. The row cannot answer "how did they do".

Verified:

- `exercises-screen.tsx:1045` — `score = BigInt(Math.max(1, totalStars)) * POINTS_PER_STAR_BIG`
- `:1044` — `levelId = getLevelId(selectedPiece)` — the six "levels" are the six **pieces**
- `totalStars` is the accumulated star count for the selected piece, normalised against the
  merged catalogue (`:1046-1051`), and it never decreases.

So the `score` this spec persists on every attempt row is *"stars banked on this piece so
far × 100"*. Consequences the spec does not acknowledge:

1. **The row does not describe its own attempt.** Two consecutive attempts differ only by
   the stars the second one added; an attempt that adds none carries the identical number.
   `score_attempts.score` is a running balance sampled at attempt time.
2. **Slice 2 cannot rank on it.** `MAX(score)` inside a weekly window returns the highest
   *lifetime accumulation reached* during that week — larger for veterans purely because
   they started higher. That is the audit's R3 ("the score measures inventory") surviving
   the slice that was supposed to unblock its fix, in a new table.
3. **It makes the spec's own vocabulary false.** §Goal says a row is "one completed,
   scorable attempt"; the payload says it is a snapshot of a cumulative total.

**Why blocking:** the spec's stated purpose is to make time-windowed features *buildable*.
Timestamps alone do not do that — Slice 2 needs to rank, and this column cannot carry a
ranking. Shipping it means Slice 3 closes, Slice 2 reopens with the same defect, and by then
there are rows in an append-only table encoding the wrong quantity.

**Fix — one of, decided now, not during implementation:**
- **(a) Persist the delta.** Add `stars_delta int` (or `score_delta`) = what *this* attempt
  contributed, alongside the running `score`. The engine knows it: it is the difference the
  attempt just produced. Then Slice 2 sums deltas in the window, which is genuinely "what
  they did this week", and the running total stays for reconciliation with `score_saves`.
- **(b) Persist per-exercise result instead** — `exercise_id` + stars earned on it. Richer,
  and the natural home for the Slice 4 quality fields, but a wider client contract.
- **(c) Ship timestamps only**, and state in the spec that Slice 2 must rank on *attempt
  counts / days active*, never on `score`. Cheapest, but it decides Slice 2's product
  question by omission — the exact move the round-1 review of Slice 2 said to avoid.

Recommendation: **(a)**. It is one nullable-free integer, the client already has both
numbers, and it is the only option that leaves Slice 2's product question open.

#### P0-2 · [state] The lifecycle contract names an owner but never names the DISCRIMINATOR — and the obvious candidate resets to 1 on every exercise

The spec fixes round 1's "who owns the id" (mint beside `autoSavedScoreRef`, survive the
three resubmission paths). It does not answer the question that owner now poses: **how does
the client know a new attempt began?**

Today's gate is `autoSavedScoreRef.current === localScoreNum` (`:2351`) — a dedup **by score
value**. B2 explicitly removes score-improvement as the trigger, which removes the only
discriminator the effect has. With B2 in place and no replacement:

- two attempts that add no stars produce the same `localScoreNum`, the ref matches, and the
  second one is **never submitted** — exactly the under-count the lifecycle contract exists
  to prevent, arriving through the trigger instead of through the id;
- or the ref is dropped and the effect re-fires on unrelated renders, minting per render.

The file itself points at the trap. `shieldRescueAttemptIdRef`'s comment (`:964-977`) says
it is *"deliberately separate from `useExerciseProgress`'s `attemptSeq` (which **resets to 1
on every exercise change** and is shared with other systems like `PeonesHintButton`)"*. So
the repo's existing per-attempt counter is **not unique across exercises and is shared** —
using it as the discriminator reintroduces collisions, and the one counter built to avoid
that problem (`shieldRescueAttemptIdRef`, seeded from `Date.now()`) exists precisely because
someone already hit this.

**Why blocking:** B2 is the behavior that makes the slice matter, and it deletes the
client's only trigger without specifying its replacement. Every acceptance criterion about
the RPC passes regardless.

**Fix:** specify the discriminator explicitly — a monotonic per-attempt counter owned by
this flow (the `shieldRescueAttemptIdRef` pattern: seeded from `Date.now()`, advanced once
at the *completion* transition, never on render, never on retry), and state that
`attemptSeq` must not be reused for it, with the reason.

#### P0-3 · [test] The premise criterion requires mounting a host that nothing in this repo mounts

Two criteria are written as end-to-end, "driven from the screen":
*"two consecutive exercises produce two different `attemptId`s — mounted against the real
screen with retries interleaved"* and the premise test itself.

They are the right tests. But `exercises-screen.tsx` is a ~4200-line client component
wired to wagmi, Supabase, the session client and the catalogue, and this project's own
record states the gap plainly: **no test mounts this host** — it is a known open hole,
carried since the carril-2 cluster, where the founder's eye was the evidence instead.

A criterion that no one on the team currently knows how to satisfy will be satisfied by
something else at implementation time: a test against `postScoreSave`, or against a
extracted hook, which passes on the broken lifecycle (that is exactly what round-1 P0-1
established). The spec would then ship with its two decisive criteria quietly downgraded.

**Why blocking:** these two tests are the only things standing between the correct
implementation and the silently-broken one. Their feasibility is a precondition, not a
detail.

**Fix — pick one and write it into the spec:**
- extract the attempt-id lifecycle into a pure, testable unit (a hook or reducer taking
  completion events and submission requests, returning the id to send) and assert the
  sequence there — then the "real screen" test becomes a thin smoke rather than the load
  bearer; **or**
- state that the criterion is satisfied by a `/dev` probe rendering the real flow, with a
  VR/e2e case (precedent exists: probes render the real board), and budget it; **or**
- accept the founder's eye as the evidence for those two, and say so in the spec so it is a
  decision rather than an omission.

---

### P1 — Should address

#### P1-1 · [security] Revoking `execute` from `anon`/`authenticated` does not lock down a Postgres function

Postgres grants `EXECUTE` on a new function to **`PUBLIC`** by default. `anon` and
`authenticated` inherit it through `PUBLIC`, so revoking from those two roles specifically
leaves the grant intact. The acceptance criterion as written ("`execute` on
`save_basic_score` is revoked from `anon`/`authenticated`") can pass while the function
stays callable by both.

**Fix:** `revoke execute on function public.save_basic_score(...) from public;` then grant
explicitly to `service_role`. Same treatment for `save_score_attempt`. Assert the state via
`has_function_privilege('anon', ..., 'EXECUTE')` being false, not via the text of a
`revoke` statement.

#### P1-2 · [test] The "no other caller" scan fails on day one unless it excludes tests

The criterion is *"no application file calls `save_basic_score` except `save_score_attempt`"*.
Verified current hits: `app/api/scores/save/route.ts:194` (the caller being migrated) and
**five occurrences in `app/api/scores/save/__tests__/route.test.ts` (:83, :135, :159, :170,
:256)**, plus a dozen mentions in `lib/scores/__tests__/save-basic-score-schema.test.ts`.

Define the scan's scope precisely — non-test `.ts`/`.tsx` under `src/`, excluding
`__tests__` — or the guard is deleted the first time it goes red for the wrong reason,
which is how guards die.

#### P1-3 · [contract] The replay branch returns fields it has no source for

B5 says a replay "does not call `save_basic_score`". The RPC's declared return still
includes `mode`, `freeUsed`, `balance`, `requiresPeones`, `spent` — all of which are
produced *by* `save_basic_score` today (`20260729...:179-187, 200-208`). B6 then classifies
them as "recomputed live and not stable", which is a statement about *values*, not about
*where they come from* on a path that skips their producer.

**Fix:** state it concretely — on replay the RPC computes `freeUsed`/`balance` with its own
direct selects (they are two trivial queries, already inlined in `save_basic_score`) and
returns `mode` from the stored attempt row's `save_status` context, **or** returns them as
`null` and the endpoint substitutes the always-free constants. Either is fine; leaving it
unstated means the implementer calls `save_basic_score` on the replay path after all, and
B5's "inserts nothing, touches `score_saves` not at all" quietly becomes false.

#### P1-4 · [data] `time_ms` is 1000 whenever the read happens outside `phase === "success"`

`timeMs` is `useMemo(() => { if (phase !== "success") return 1000n; ... })`
(`exercises-screen.tsx:1055-1058`), documented as *"v1: tracks last-exercise time only,
1000n fallback after board reset is safe — on-chain time is informational, not used for
scoring"*.

That reasoning held while the value was decorative. This spec persists it as a column on an
event log that Slices 4–5 will mine, next to a `check (time_ms > 0)` that makes the sentinel
indistinguishable from a real 1-second attempt. The manual retry path (`onRetrySave`) runs
after the board may have reset — so the retry of an attempt can persist `1000` for an
attempt that took a minute, on a row the spec insists is the *same* attempt as the original.

**Fix:** either capture `time_ms` at completion time together with the `attemptId` (it is
the same "one snapshot per completion" rule), or drop the column from this slice and note
why. Do not persist a sentinel into a table with no deletions.

#### P1-5 · [process] B2 is mandatory, and it is blocked by Open Question 1

B2 ("submit every completed scorable attempt") is stated as required behavior, and
§Problem says the slice has no effect without it. Open Question 1 says B2 is *blocked* on
re-sizing the 25-saves/2h session budget. A spec cannot carry a mandatory behavior whose
precondition is an unanswered question — at implementation time, either B2 ships against an
unchanged budget (and active players hit 409 `session_exhausted` on a *real* improvement),
or B2 is dropped (and the slice is inert).

**Fix:** resolve the budget in this spec. The recommendation already written there — do not
count a submission that produced no `score_saves` row — is sound and cheap: the endpoint
knows the outcome, and the session's `used_saves` increment can be conditional. Promote it
from a recommendation to a behavior with its own criterion, including the race (the budget
is spent *before* the RPC runs today, `route.ts:154`, so "refund on duplicate" is a second
write, not a skipped one — specify which).

#### P1-6 · [test] The new migration will be read by the existing migration-shape tests

`lib/scores/__tests__/save-basic-score-schema.test.ts` asserts `save_basic_score`'s
signature and "isolation guarantees" by regex over migration text (`:68, :77, :132, :203,
:225`), including patterns that match `create (or replace )? function public.save_basic_score`.
The new migration mentions `save_basic_score` (it calls it, revokes on it, re-comments it).

Check those assertions against the new file **before** writing it, and state in the spec
which of them must be updated. A red suite whose cause is a doc-shaped test is the fastest
way to get the guard weakened rather than fixed.

---

### P2 — Nice to clarify

- **[naming] "level" means "piece".** `getLevelId(selectedPiece)` (`:1044`). Every reader of
  `score_attempts.level_id` will assume exercise levels. One line in the table comment
  prevents a wrong query.
- **[semantics] Ordinal per `(wallet, surface, level_id)` is therefore per-piece**, i.e.
  "the Nth attempt this wallet made on the rook, in LEARN". That is a defensible unit — say
  it explicitly, because "level" hides it.
- **[index] `score_attempts_wallet_created_idx` is nearly redundant** with the ordinal index
  for per-wallet history queries. Keep it only if a spec'd query needs `created_at` ordering
  per wallet; three indexes on a write-path table are not free forever.
- **[ops] The retention trigger (100k rows) has no owner and no alert.** A threshold nobody
  measures is the same as no threshold. Either add it to whatever already reports on the DB,
  or state that the review is manual and who does it.
- **[slice2] First-week-empty is now a launch condition of Slice 2** and is written here.
  Make sure it lands in Slice 2's spec too; specs do not read each other.
- **[compat] Deploy order is stated (migration+endpoint, then client) but not enforced.**
  Nothing fails loudly if the client ships first — it would just send `attemptId` to an
  endpoint that ignores it, which is harmless. Worth one sentence saying so, so nobody
  gates the deploy on a false risk.

---

## Categories audited

**Contract gaps** — the union is now properly discriminated (round-1 P1-4 closed) and the
attempt fields are required exactly where they exist. The remaining hole is the replay
branch's field provenance (P1-3). No `any`/`unknown` smells. `attempt_id_source` closes the
round-1 data-ambiguity finding cleanly.

**Behavioral ambiguity** — B1, B3–B13 are testable as written. B2 is the exception in three
directions at once: its trigger is unspecified (P0-2), its precondition is an open question
(P1-5), and its payload is the wrong quantity (P0-1).

**Hidden assumptions** — (1) that `score` describes the attempt (false, P0-1); (2) that the
client can tell attempts apart after B2 removes the score gate (unspecified, P0-2); (3) that
`time_ms` is a measurement (false outside `phase === "success"`, P1-4); (4) that revoking
from two roles locks a function (false, P1-1); (5) that the screen is mountable in a test
(no precedent, P0-3). The nested-advisory-lock assumption (B9) is *correct* and now stated —
good.

**Backward compatibility** — strong. `score_saves` untouched, no backfill, additive
migration, `drop`-only rollback, old clients keep saving via B10, response shapes are
supersets. The FK omission is now justified in the text (round-1 P1-3 closed).

**Security & data** — no new PII; wallet still comes from the session row, never the body.
Write abuse bounded by session budget + IP limiter, and the spec correctly forbids building
rewards on attempt counts. The one real gap is the revoke semantics (P1-1). RLS is inherited
and inert — worth the same "cosmetic, defence in depth" note round 1 asked for; it did not
make it into the revision.

**Test coverage gaps** — the criteria list is materially better: `max`-not-`count` has a
deletion test, the replay-stability test names its fields, the two-surfaces ordinal test
exists. The blockers are feasibility (P0-3) and scope definition (P1-2, P1-6).

**Operational readiness** — logging now covers both `score_attempt_id_absent` and
`score_attempt_replayed`, the latter being the right detector for the failure this design is
most exposed to. Rollback is additive and scripted. Deploy order is stated (P2-6).

---

## Verdict

**NEEDS REVISION.**

P0 findings: **3**
P1 findings: **6**
P2 findings: **6**

Round 1's blockers are genuinely closed, and the revision is stronger in every category it
touched — the lifecycle is now a contract, the ordinal survives deletion, and the
composition with `save_basic_score` is decided.

What round 2 exposes is that the slice was reviewed against the database and not against the
client. Once you read the screen, three things change: the number being persisted is a
running total rather than an attempt result (P0-1), B2 removes the client's only way to tell
attempts apart without providing another (P0-2), and the two criteria that would catch a
broken lifecycle require test infrastructure this repo has never had (P0-3).

None of the three is expensive to fix in the spec. All three are expensive to fix in an
append-only table that ships without them.
