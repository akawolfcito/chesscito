# Red Team Review — attempt-identity-score-attempts (Slice 3) — ROUND 3

**Date**: 2026-07-28
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` (round 3)
**Prior rounds**: `...-redteam-round1.md` · `...-redteam-round2.md` — all P0 and P1 from
both are **closed**.

Everything below is new and verified against code.

---

## Findings

### P0 — Must address before implementation

#### P0-1 · [security/premise] `stars_earned` is a number the CLIENT declares — and Slice 2 will rank on it. That is audit R1, reintroduced in the new column.

D8 makes `stars_earned` the quantity Slice 2 ranks on. The spec's request contract has the
client send it (`starsEarned?: number; // 0..3`), and the server validates only its range.

Slice 0 existed to end exactly this. Its whole thesis, quoted from `route.ts:22-35`, is that
a token *"authorizes WRITING, not any value"*: `player` was removed from the body, and every
remaining number is bounded server-side. The one number that could not be forged was
irrelevant to ranking (`score`, itself anchored by `MAX_SCORE_PER_LEVEL` and flattened by
dedup). This spec adds a client-declared field and then points the leaderboard at it. A
`curl` sending `starsEarned: 3` on every attempt ranks first, weekly, forever.

The mitigation the spec offers is the session budget — which D9 just raised from 25 to 100,
and which bounds *how many* rows, not *what they claim*.

**Why blocking:** it is the difference between "the weekly board is unbuildable because the
data means the wrong thing" (where we started) and "the weekly board is buildable and
trivially gameable" (where this lands). The second is worse: it ships.

**Fix, and it is cheap because both halves already exist:** send `movesUsed`, not
`starsEarned`, and **recompute server-side**.

- `computeStars(movesUsed, optimalMoves)` is pure and already lives in
  `lib/game/scoring.ts:9-16`, importable from a route handler.
- `optimalMoves` is a property of the exercise, which the server has via the catalogue
  (`currentExercise.optimalMoves` is the same value the client uses at `:1700`).

Then `stars_earned` is a **server-computed function of a bounded input and the catalogue**,
consistent by construction with the exercise it claims. `movesUsed` is still declared, so
this does not prove a human played — that is the open server-verified-progress question, and
it must not be conflated. But it moves the ranked quantity from "whatever the client says"
to "what the formula says about what the client says", which is the same standard `score`
already meets.

#### P0-2 · [data] B12 writes the sentinels `'unknown'` and `0` into NOT NULL columns of a table that never deletes — the exact thing this spec bans one section earlier

B12: absent `exerciseId`/`starsEarned` → `exercise_id = 'unknown'`, `stars_earned = 0`.

Three things make this indefensible in the same document:

1. **The spec already rejected sentinels, by name.** §Contracts removes `time_ms`'s `1000n`
   fallback because *"do not persist a sentinel into a table with no deletions"*
   (round-2 P1-4). B12 then persists two.
2. **`stars_earned = 0` is unreachable for a real attempt** — `computeStars` returns 1, 2 or
   3 and its own doc says *"0★ → no completó (reset) — no llamar esta función en ese caso"*
   (`scoring.ts:4-8, 12-15`). So the check `between 0 and 3` exists only to admit the
   sentinel, and any consumer aggregating `stars_earned` silently averages fake zeros in.
   This also answers Open Question 1: the floor is **1**.
3. **The repo already solved this, the other way.** `score_saves.surface` is nullable with no
   default precisely so unknown provenance reads as unknown:
   *"Defaulting them to 'learn' would manufacture evidence. NULL reads as pre-Slice-0,
   unknown"* (`20260729000000_..._hardening.sql:34-38`). B12 manufactures evidence.

**Why blocking:** append-only. A sentinel written during the stale-bundle window is in the
series forever, indistinguishable from data by any query that does not know to look for the
magic string.

**Fix:** make `exercise_id` and `stars_earned` **nullable**, tighten the check to
`stars_earned between 1 and 3`, and let NULL mean what it means. `attempt_id_source =
'server'` already flags the same rows, so nothing is lost.

---

### P1 — Should address

#### P1-2 · [schema] `unique (attempt_id)` is global — the repo already chose the opposite for the same problem

`score_save_nonces` is keyed `primary key (wallet, nonce)`, and the migration says why:
*"Keyed by (wallet, nonce) rather than nonce alone: two honest wallets picking the same
128-bit value must not lock each other out, and an attacker replaying a captured payload
always replays the same wallet too"* (`20260729000000:67-70`).

`score_attempts` faces the identical situation and picks the global unique. Collision odds
are negligible, but the second half of that comment is the point: with a global key, a
caller presenting **someone else's** `attempt_id` gets the replay branch — which returns that
attempt's `save_status`, `attempt_index` and `scoreSaveId`. It is a small oracle over another
wallet's activity, and it exists for no benefit.

**Fix:** `unique (wallet, attempt_id)` and look up the replay by both. Same guarantee,
scoped, and consistent with the precedent 20 lines away in the same migration file.

#### P1-3 · [validation] `exercise_id` is validated by length only, so the catalogue is not enforced

`check (length(exercise_id) between 1 and 64)` accepts any string. The ids are not
patterned or sequential — `rook-distance-1`, `rook-no-diagonal-1`, with no `rook-3` — so
nothing about the shape can be inferred, and a typo'd or renamed id is unnoticeable. The
`score_attempts_exercise_idx` then indexes noise, and Slice 4's per-exercise analysis
silently aggregates ids that never existed.

**Fix:** validate membership against the built catalogue at the endpoint (the server already
needs it for P0-1's `optimalMoves`), reject with 400 on miss, and say what happens to an
exercise id that is later retired from the catalogue — rows keep it, and the read side must
tolerate that.

#### P1-4 · [security] Raising `maxSaves` to 100 quadruples the blast radius, and the rows it now buys are the ranked ones

`session-authorization.ts:22` states the model outright: *"A stolen token is worth at most
`maxSaves` rows on one wallet."* Under Slice 0 those rows were dedup-collapsed by
`save_id` — a stolen token could not manufacture *activity*, only re-assert one score. With
`score_attempts`, each of the 100 is a distinct activity row.

The spec's own edge case notes this and mitigates it with a prohibition ("attempt counts must
not become a reward or ranking input"), which is a rule for us, not a control. Combined with
P0-1 (the ranked value is declared), 100 is not a budget increase, it is the attack surface.

**Fix:** either keep the ceiling lower and let the client re-authorize (one prompt per 100
attempts is not the same cost as one per save — the thing Slice 0.1 was built to avoid),
or land P0-1 first so that what those 100 rows can claim is bounded by the formula. Do not
ship 100 with a declared `stars_earned`.

#### P1-5 · [concurrency] Moving the consume inside the RPC inverts the lock order between the two paths that touch a session

Today: `consume_score_write_session` runs in its own transaction (`route.ts:154`), *before*
any advisory lock. In the new design the order inside one transaction is advisory lock
(step 2) → session row UPDATE (step 5). Meanwhile `/api/scores/authorize` updates session
rows taking no advisory lock at all.

That is two code paths acquiring the same two resources in different orders, which is the
textbook precondition for a deadlock. It is unlikely at current volume and it is exactly the
kind of unlikely that appears under load, as a 500 on save.

**Fix:** state the lock order as an invariant in the migration comment, and verify that no
other function updates `score_write_sessions` while holding the wallet advisory lock. If one
does, move the consume ahead of the advisory lock (it is idempotent-safe there because the
whole thing still rolls back on failure).

#### P1-6 · [observability] The endpoint loses the wallet it currently logs with

`route.ts:171-184` derives `walletHash` from the consume result and logs
`score_save_surface_mismatch` with it. With the consume moved into the RPC and the surface
check at step 3, the endpoint no longer has a wallet at the moment it must log the rejection
— the RPC returns a status, not an identity.

Minor, but it silently degrades the one log line that exists for a real multi-product bug
(audit R12). Either return the wallet hash alongside the failure status, or move that log
into the RPC and say so.

#### P1-7 · [test] The premise test still needs a wallet at its ceiling — construct it, do not assume it

The premise criterion ("a wallet at its per-level best completes the level again → zero new
`score_saves`, one new `score_attempts`") is now reachable without mounting the screen, which
was round 2's blocker. But the fixture is non-trivial: it needs a `score_saves` row at the
best score **and** a completion that produces the same cumulative `score`. Spell the setup
out in the spec, because a test that accidentally sets up a *new* best passes for the wrong
reason and certifies nothing.

---

### P2 — Nice to clarify

- **[index] `score_attempts_exercise_idx` has no query.** No spec'd read filters by
  `exercise_id`; it is for Slice 4, which is not written. Drop it or name the query.
- **[check] `score > 0` on the reconciliation column.** `score` is `max(1, totalStars) *
  POINTS_PER_STAR`, so it cannot be 0 — fine, but note that this column is now the *only*
  place the cumulative total is stored per attempt, and it is documented as
  reconciliation-only. Add the assertion that nothing reads it for ranking, so a future
  query cannot quietly reintroduce R3.
- **[semantics] "level" means "piece"** (`getLevelId(selectedPiece)`, `:1044`). It is in the
  table comment now — also put it in the ordinal's comment, since "the Nth attempt on level
  3" reads as an exercise level to everyone who has not read this spec.
- **[budget] `duplicate` consuming budget (D9) is right, but the failure mode is invisible.**
  A player who exhausts 100 in a sitting gets `session_exhausted` on their next real
  improvement, and the existing inline fallback says "retry", which will fail identically.
  Worth one line on what the player is told.
- **[ops] `score_attempt_id_absent` and the `'server'` source should be watched together**
  for the first week post-deploy; after that, both should be ~0 and B11/B12 can be removed.
  Say that out loud so the tolerance does not become permanent.

---

## Categories audited

**Contract gaps** — the reducer contract is complete and genuinely testable; `AttemptEvent`
is a closed union with one minting event, which is the right shape. Replay field provenance
is now explicit (round-2 P1-3 closed). The remaining contract hole is that the *ranked* field
is unvalidated (P0-1).

**Behavioral ambiguity** — B1–B15 are testable. B12 is the one that should not exist as
written (P0-2). The transaction order in §RPC is precise enough to implement from, which is
new this round.

**Hidden assumptions** — (1) that a client-declared `stars_earned` is trustworthy enough to
rank on (false, P0-1); (2) that `stars_earned = 0` can occur (false, `scoring.ts:12-15`);
(3) that a global `attempt_id` unique is equivalent to a per-wallet one (not per this repo's
own precedent, P1-2); (4) that lock order across the two session-touching paths is
consistent (unverified, P1-5). The nested-advisory-lock and re-entrancy assumptions are
correct and stated.

**Backward compatibility** — good. `score_saves` untouched, no backfill, additive migration,
`drop`-only rollback, and the `maxSaves` raise is compatible in the safe direction: live
25-save sessions still validate against `c.maxSaves > SCORE_SESSION_MAX_SAVES`
(`session-authorization.ts:238`), which the spec verified rather than assumed.

**Security & data** — the wallet still comes from the session row, never the body; moving the
consume into the RPC preserves that property (the RPC takes `p_token_hash`, not a wallet).
The regressions are P0-1 (declared ranked value), P1-4 (4× blast radius), P1-2 (cross-wallet
replay oracle).

**Test coverage gaps** — the reducer criteria cover every branch of the invariant, including
the two that fail on the broken lifecycle. Privilege assertions now test state rather than
migration text (round-2 P1-1 closed) and the caller scan is scoped (P1-2 closed). Missing:
the premise fixture's construction (P1-7), and a test that a foreign `attempt_id` cannot be
replayed once P1-2 is applied.

**Operational readiness** — logging covers absent ids and replays; rollback is additive and
scripted; deploy order is stated and made safe by B11. P1-6 is a small regression in an
existing log line.

---

## Verdict

**NEEDS REVISION.**

P0 findings: **2**
P1 findings: **6**
P2 findings: **5**

Round 2's blockers are closed and the design is now nearly implementable: the payload answers
both questions, the lifecycle is a pure reducer with tests that fail on the broken version,
the consume is transactional instead of refunded, and the privilege model is asserted on
state.

The two remaining P0 are the same mistake in two places — **trusting the client for a value
that outlives the request**. `stars_earned` is declared and then ranked (P0-1); the
stale-bundle sentinels are written into NOT NULL columns of a table that never forgets
(P0-2). Both are cheap now: recompute the stars from `movesUsed` with the pure function that
already exists, and let unknown be NULL the way `score_saves.surface` already does.
