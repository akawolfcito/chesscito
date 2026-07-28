# Red Team Review — attempt-identity-score-attempts (Slice 3) — ROUND 4

**Date**: 2026-07-28
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` (round 4)
**Prior rounds**: `-round1.md` · `-round2.md` · `-round3.md` — all P0 and P1 closed.

Round 3's two P0 are genuinely dead: `stars_earned` is server-computed from `movesUsed` and
the catalogue, and unknown is NULL instead of a sentinel. This round measured the thing round
3's Open Question 1 asked about, and the answer is the finding.

---

## Findings

### P0 — Must address before implementation

#### P0-1 · [scope] The reducer is mounted on ONE of the three completion paths that live in the same component

The spec mounts the lifecycle at `exercises-screen.tsx:1700-1705`. That is the carril-1
exercise completion. The same file grades **two other kinds of completion**, each with its own
transition and its own grader:

- `:1668, :1700, :1728` — `computeStars(movesCount, currentExercise.optimalMoves)`
- `:3146` — `labyrinthStars(m, activeLabyrinth.optimalMoves)`
- `:3211` — `resolveCoverageStars({ … })`

And the signature games grade inside their own boards: `queens-board.tsx:173`
(`tourStars(placed, CEILING)`), `safe-path-board.tsx:215` and `diagonal-run-board.tsx:181`
(`labyrinthStars`).

All of them feed the same `totalStars` → the same `score` → the same `handleSubmitScore`.
So today a finished labyrinth *does* raise the score and *does* trigger the auto-save. Under
this spec, it stops producing anything: the reducer never sees a `completed` event on that
path, so `pending` is null and nothing is submitted.

**The result is a net regression.** Before the slice, carril-2 play at least moved
`score_saves` when it raised the total. After it, carril-2 play emits **no POST at all** —
the table that exists to answer "did they play" would be blind to half the product (the six
signature games are the carril-2 deliverable, one per piece).

**Why blocking:** the spec's Goal is "one submission per completed attempt", and it wires one
of at least three completion sites. Every reducer test passes — they test the reducer.

**Fix:** enumerate the completion transitions and mount the reducer at each, or state
explicitly that Slice 3 covers carril-1 exercises only and that carril-2 activity is
knowingly out of scope (and then rename what the table claims to measure). The first is
right; the second is at least honest.

#### P0-2 · [product] `stars_earned` will be NULL for the entire carril 2 — the half of the catalogue that Slice 2 most wants to rank

Round 3's Open Question 1 asked which kinds `computeStars` grades. Measured: `computeStars`
grades **carril-1 exercises and the Daily** and nothing else. Labyrinths, Safe Path, Diagonal
Run, Knight's Tour, N-Queens and Promotion Run each use a different function, with a
different input — `tourStars(visited, reachable)`, `promotionRunStars(failures)` (which
counts **failures, not moves**), `resolveCoverageStars(…)`.

The spec's own D13-derived rule then applies: those attempts carry NULL stars, and D13 tells
Slice 2 to exclude NULL-star rows from any performance ranking. Put together, the weekly
performance board would rank carril-1 exercises only, while the player's week was mostly
signature games.

That is not a bug in the spec's logic — it is the logic working. It is a **product decision
being made by omission**, which is exactly what the round-1 review of Slice 2 warned against
when it rejected option (c).

**Why blocking:** the founder chose D8 ("persist the attempt's own result") specifically so
Slice 2 could rank on how it went. Delivering that for one carril and NULL for the other
changes what Slice 2 can be, and the founder should decide it with the number in front of
them, not discover it when the board looks thin.

**Fix — pick one, explicitly:**
- **(a)** Bring the per-kind graders into Slice 3. They are all pure functions that already
  exist; the cost is the raw measurement per kind in the request (`visited`,
  `failures`, coverage inputs) and one dispatch on the exercise's `kind`.
- **(b)** Ship Slice 3 carril-1-only, and have Slice 2 rank on carril-1 performance while
  counting carril-2 as activity — stated in both specs, not implied.
- **(c)** Ship Slice 3 as activity-only (`created_at` + counts, no `stars_earned`), and let
  Slice 4 add all grading at once.

Recommendation: **(a)** if the request shape can carry a per-kind measurement without
ballooning; otherwise **(b)** with the split written into Slice 2's spec.

#### P0-3 · [scope] The Daily — the activity the product itself defines as "you showed up" — produces no attempt row

`computeStars` is called by `daily-tactic-slot.tsx:119` and `hub-daily-tile.tsx:174`. Neither
path goes through `handleSubmitScore`, so no `score_saves` row and no attempt row is written
for a completed Daily.

This is load-bearing because of what the Daily *is* in this product: the Daily is the only
thing that lights the day for the streak, and Focus Days are counted server-side from it. A
table whose stated meaning is "played" that cannot see the canonical daily play is going to
be joined against `focus_day_ledger` by someone, and the two will disagree — one says the
wallet was active, the other has no row.

**Why blocking:** it is a definition problem, not a coverage gap. Either the table means
"completed a scorable exercise attempt in the exercises screen" — in which case say that,
because it is not what "played" means to anyone else — or the Daily belongs in it.

**Fix:** state the boundary in the spec and in the table comment, and if the Daily is
excluded, say what the relationship to `focus_day_ledger` is so the next person does not
join them.

---

### P1 — Should address

#### P1-1 · [types] `computeStars` and `labyrinthStars` are both `(number, number) => number` with different meanings

`computeStars(movesUsed, optimalMoves)` (`scoring.ts:9`) and `labyrinthStars(moves, optimal)`
(`exercises.ts:228`) are structurally identical and semantically different, and
`tourStars(visited, reachable)` shares the shape while inverting the direction — more is
better. A dispatch keyed on `kind` that falls through to the wrong branch produces a
plausible number and no error.

This repo has been bitten by exactly this before: two `number` metrics of opposite sense
reused without a type error, handing out 3★ to everyone with nobody reporting it.

**Fix:** if P0-2 lands option (a), do not dispatch on `kind` with a shared numeric input.
Give each grader a nominal input type (`{ kind: "moves"; movesUsed } | { kind: "tour";
visited } | { kind: "promotion"; failures }`) so a mis-dispatch is a compile error rather
than a wrong star count.

#### P1-2 · [contract] `MAX_ATTEMPT_MOVES` is invented but never valued

The spec bounds `movesUsed` by `MAX_ATTEMPT_MOVES`, "sized to the largest catalogue
exercise". No number, no derivation, and the catalogue's `optimalMoves` is not a bound on
moves *used* — a player can wander. Too tight rejects honest attempts (silently losing the
row); too loose is not a bound.

**Fix:** derive it, do not guess: `max(optimalMoves) * k` with a stated `k`, or a flat
constant justified by the worst observed attempt. Assert it against the built catalogue so it
cannot drift below a real exercise.

#### P1-3 · [compat] B14 (reject a body containing `starsEarned`) introduces a strict-field policy the endpoint does not have

Today the handler reads three fields and ignores everything else (`route.ts:135-143`).
B14 makes one unknown field a 400 while every other unknown field stays ignored — an
inconsistency that will read as a bug to the next maintainer, and a 400 that a stale client
cannot fix by retrying.

The intent is right (silently dropping a field the caller believes is honoured is worse). But
no shipped client has ever sent `starsEarned`, so the failure mode it guards against is a
*future* client written against a stale spec.

**Fix:** log and ignore, or reject *all* unknown fields consistently. Do not special-case one
name.

#### P1-4 · [state] `submittedAt` is in the reducer state but no rule reads it

`AttemptLifecycleState.submittedAt` is declared as "guards submit-once, retry-as-often", yet
none of the reducer rules or acceptance criteria mention it, and `selectPendingSubmission`
takes only `pending`. Either it drives the "submit once" guard — in which case its transitions
belong in the rules and in a test — or it is vestigial and invites a second, divergent guard
next to `submittingScoreRef`.

#### P1-5 · [ops] The lock-order invariant is stated but nothing enforces it

The spec says `/api/scores/authorize` "must never acquire the wallet advisory lock". That is
the right invariant and it is a comment. The cheapest enforcement is a test that greps the
session-touching functions for `pg_advisory` — same style as the "no other caller" scan the
spec already accepts.

#### P1-6 · [test] The premise fixture assumes a completion can reproduce the same cumulative score

The fixture requires a completion "whose result yields the same cumulative `score`" so
`save_id` re-derives identically. That holds only if the completion adds no *net* stars —
which is true for a repeat of an already-perfect exercise (`withBestStars` / `netStars`
keep the best), but the spec asserts the outcome rather than the mechanism.

**Fix:** state the mechanism in the fixture — "repeat an exercise already at 3★, so
`netStars` is 0 and the cumulative total is unchanged" — so a future refactor of the star
ledger fails this test loudly instead of quietly making it set up a new best.

---

### P2 — Nice to clarify

- **[schema] `level_id` is canonical but `score` is not.** The spec fixes `level_id` to the
  catalogue's piece while `score` remains the client's cumulative number. It is
  reconciliation-only, but it is also `not null` and unbounded except by
  `MAX_SCORE_PER_LEVEL`. Note that a wrong `score` corrupts only reconciliation, so nobody
  builds an alert on it.
- **[naming] `save_status` vs `status`.** The RPC returns `status` and the column is
  `save_status`; the replay branch maps one to the other. Fine, but name it in the comment —
  two names for one value across a transaction boundary is how a mapping gets inverted.
- **[docs] Round-3's Open Question 1 is now answered** (`computeStars` = carril 1 + Daily).
  Fold the answer into the spec instead of leaving the question open, or the next reader
  re-measures it.
- **[ops] `attempt_id_source = 'server'` and NULL results now overlap in meaning.** A row can
  be `client`-sourced and still have NULL stars (ungraded kind). One filter no longer
  isolates degraded rows — document the two reasons separately.
- **[perf] Two uniques plus two indexes on a write-path table.** `unique (wallet,
  attempt_id)` and `unique (wallet, surface, level_id, attempt_index)` are both enforced per
  insert, inside the advisory lock. Fine at this volume; note it so the retention review
  looks at write cost, not only row count.

---

## Categories audited

**Contract gaps** — the request no longer accepts the ranked value, `level_id` is canonical,
and the grading module has an explicit failure union. Holes: an unvalued bound (P1-2), an
unread state field (P1-4), and a shape-collision risk if per-kind grading lands (P1-1).

**Behavioral ambiguity** — B1–B16 are testable and the transaction order is precise enough to
implement from. B12's NULL branch is where the ambiguity moved: "ungraded kind" and "stale
bundle" now produce identical rows for different reasons (P2-4).

**Hidden assumptions** — (1) that `:1700-1705` is *the* completion transition (false, P0-1);
(2) that `computeStars` covers enough of the catalogue for D8 to mean what it promises
(false, P0-2); (3) that the Daily is out of scope (undecided, P0-3); (4) that `movesUsed` is
the raw measurement for every kind (false — `promotionRunStars` counts failures). The
lock-order and re-entrancy assumptions are correct and now stated.

**Backward compatibility** — strong. `score_saves` untouched, no backfill, additive
migration, `drop`-only rollback, `maxSaves` raise verified compatible in the safe direction,
and the raise is correctly coupled to the grading change (D9/D12). B14 is the one new strict
behavior and it is inconsistent with the handler's existing tolerance (P1-3).

**Security & data** — this is the round where it got right. The ranked value is
server-computed from a bounded input and the catalogue; `level_id` cannot be spoofed;
`unique (wallet, attempt_id)` closes the cross-wallet oracle and matches the
`score_save_nonces` precedent; privileges are asserted on state; the consume is transactional
rather than refunded. A stolen token now buys row count only.

**Test coverage gaps** — the reducer criteria kill both lifecycle failure modes, the grading
criteria include a real carril-2 id, and the premise fixture is constructed rather than
assumed. Missing: any test for the completion paths P0-1 leaves unwired, and the lock-order
guard (P1-5).

**Operational readiness** — logging covers absent ids, NULL results and replays; rollback is
additive and scripted; deploy order is safe by construction. The `walletHash` regression from
round 3 is fixed by returning it with the failure status.

---

## Verdict

**NEEDS REVISION.**

P0 findings: **3**
P1 findings: **6**
P2 findings: **5**

The data model is done. Rounds 1–3 closed everything about the table, the transaction, the
identity and the trust model, and none of it needs to be reopened: server-computed stars,
NULL-not-sentinel, per-wallet attempt ids, transactional consume, asserted privileges.

What round 4 exposes is a scope error, not a design error. The spec was written against the
carril-1 exercise flow and treats it as the whole game. Measured: there are at least three
completion transitions in the one component the reducer mounts into, five grading functions
across the catalogue, and one more flow (the Daily) that the product itself treats as the
definition of having played. Until the spec says which of those it covers — and the founder
agrees with that boundary — `score_attempts` cannot honestly claim to record "played".

That is one decision (P0-2's a/b/c) plus two boundary statements (P0-1, P0-3). None of them
change the schema.
