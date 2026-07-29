# Red Team Review — attempt-identity-score-attempts (Slice 3) — ROUND 7

**Date**: 2026-07-28
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` (round 7)
**Prior rounds**: `-round1` … `-round6` — all P0 and P1 closed.

Round 6's two P0 are answered with mechanisms, as required: a latch in the assemblers keyed on
a canonical completion key, and an outbox the board lifecycle cannot reach. Both are the right
shape. This round checked whether the two mechanisms actually hold where they run.

---

## Findings

### P0 — Must address before implementation

#### P0-1 · [exactly-once] The latch's key rotates for four families and is unverified for three

D19 states that `runKey` is *"the value React already uses as the board's `key`… which rotates
precisely when a new attempt begins"*. Verified in `resetBoard()`:

- `:1518` — `setBoardKey(previous => previous + 1)` → carril-1 exercises and the generic
  labyrinth rotate. ✅
- `:1527` — `setSafePathResetKey(...)`, with the comment *"Safe Path keys off its own id, not
  boardKey, so the bump above never reaches it"*. ✅
- `:1539` — `setPromotionRunResetKey(...)`. ✅

**`labyrinthKey` is not touched by `resetBoard`.** It is the run key for the other three
families — Diagonal Run (`:3672`), Knight's Tour (`:3686`) and N-Queens (`:3696`) — and it
only advances elsewhere (content requests). So for exactly those three, the spec's claim that
the key "rotates when a new attempt begins" is **not established by the code it cites**.

There is a plausible reason it still works: those three boards have no `resetKey` prop, so
their only reset *is* the remount driven by `labyrinthKey`, which means a second completion
cannot occur without a rotation. If that is true, the latch is safe. But it is an argument
about board internals — precisely the kind of reasoning D19 was written to stop relying on —
and it is doing load-bearing work for three of the seven families.

The failure mode if it is wrong is the worst one available: the latch stays closed, the second
completion emits **nothing**, and the table under-counts silently with a 200 on the wire and no
log.

**Fix:** do not infer it. Either (a) have `resetBoard` bump `labyrinthKey` too, so one call
rotates every run key and the invariant is one line instead of three arguments; or (b) key the
latch on a value the assembler controls — a counter the assembler itself bumps on
`attempt_started`-equivalent transitions — and stop borrowing React keys. (a) is cheaper; (b)
is more honest. Either way, add the criterion that **each family's key rotates on the path
that starts its next attempt**, asserted per family rather than assumed once.

#### P0-2 · [at-least-once] The outbox is in memory, and this app's normal exit is closing the app

D20 promises a completed attempt survives "resetBoard, exercise change and network failure
until the server confirms *that* attempt". The mechanism delivers exactly that — within the
life of the page. §Out-of-scope then says the quiet part: *"the queue is in memory. A reload
with unsent attempts loses them."*

For this product that is not a corner case. The delivery surface is MiniPay, where closing the
app mid-session is ordinary behaviour, and this repo already shipped a fix for that exact
lifecycle: the score **session** had to be persisted because closing MiniPay dropped it and
re-prompted for a signature (`87e35e35`, verified on device). The same event now drops
attempts instead — and unlike the signature, nothing tells the player or the server that
anything was lost.

The exposure is concentrated where it hurts most: an attempt is only in the outbox while a POST
is pending or failing, which is exactly when the network is bad — the same condition under
which a player closes the app.

**Why blocking:** "at-least-once" that evaporates on the platform's normal exit is not
at-least-once, and the whole slice exists so the server stops missing play it never heard
about. Shipping the guarantee with a hole this shaped means the first honest measurement of
"did they play" is still an undercount, just a smaller one.

**Fix:** persist the outbox, with the precedent already in the codebase — the score session is
persisted for this same reason. Drain on mount before minting anything new. Keep the cap. If
persistence is genuinely deferred, then D20's wording must be narrowed to "survives within a
session" and the residual loss stated as a known, measured gap, not a footnote in
out-of-scope.

---

### P1 — Should address

#### P1-1 · [state] Queueing without a wallet contradicts the definition of "played"

The edge case says: *"No wallet connected — `canSubmitAttempt` false. Attempts still queue;
they are sent if a wallet connects while they are within the cap."* Two problems.

First, it contradicts the definition two lines later — *"'Played' still means 'played with a
wallet'"* — because a queued attempt made with no wallet does get attributed to whichever
wallet connects afterwards. On a shared device that is the wrong wallet.

Second, the snapshot carries `score` (a cumulative total) and `timeMs` captured minutes or
hours earlier; on connect, N stale POSTs fire at once, each consuming budget, each writing
`created_at = now` for play that happened before.

**Fix:** do not enqueue without a wallet. `completed` with no wallet is dropped and logged —
consistent with D4's stance that this table records a *bounded* kind of activity, not
everything.

#### P1-2 · [ops] `submission_failed` has no backoff, so a persistent failure becomes a hot loop

The reducer keeps the snapshot and clears `inFlight`; the effect keys on
`nextSubmission?.attemptId`, which is unchanged; so the effect re-fires immediately and the
same POST is retried as fast as the network can fail. Against a 500 or an offline device this
is a spin.

Note it interacts with the budget: a retry of the same `attemptId` is a replay and consumes 0
(B5/step 4), so the spin is free server-side — but it is not free on the client's battery or
the log volume.

**Fix:** a minimal backoff on `submission_failed` (attempt count on the snapshot, or a
`retryAfter` in state), plus a stated cap after which the attempt is dropped with a log.

#### P1-3 · [semantics] Dropping the oldest on overflow is a silent data-loss policy inside an at-least-once guarantee

The cap is right; the policy needs an argument the spec does not make. Dropping the **oldest**
maximises recency, which is a reasonable product choice, but it means the attempts lost are the
ones that have been failing longest — i.e. the ones most likely to represent a real outage
rather than a blip.

State the reasoning, and make the log actionable: `score_attempt_outbox_overflow` should carry
how long the dropped attempt had been queued, since that number is the only signal that the
drop happened during an outage rather than a burst.

#### P1-4 · [contract] `canSubmitAttempt` is now `canSaveScore` verbatim

Round 6 defined it as `canSaveScore && pending !== null`; round 7 correctly split availability
out, leaving `const canSubmitAttempt = canSaveScore;` — an alias with no added meaning. An
alias that equals its source invites someone to "simplify" it back, undoing D18's whole point.

**Fix:** either drop the alias and use `canSaveScore` with a comment naming it as the write
gate, or give it the meaning the name implies (wallet **and** session validity, which is what
D18 describes and what `canSaveScore` does not check — it tests chain and address, not whether
a write session can be minted).

#### P1-5 · [test] The exactly-once criteria never exercise two assemblers in one session

Every latch criterion drives one assembler. The single shared `emittedCompletionRef` is
justified by the boards being mutually exclusive (`:3670-3733` is one ternary chain) — true,
but the exercise flow lives in the `else` branch and shares the same ref. A test that completes
an exercise, navigates to a labyrinth, and completes that, is the one that proves a single ref
is safe across the boundary.

#### P1-6 · [ops] `/dev` inertness now depends on a provider that does not exist yet

Round 7 replaced the unmechanised claim with *"the assemblers dispatch through a context
provider that the `/dev` probe routes do not mount"*. That is a real mechanism, but it is a new
architectural dependency introduced in one sentence: every assembler now needs the provider in
its tree, and a probe that renders `exercises-screen` (rather than a board) would need to keep
*not* mounting it.

Say who provides it and where, and assert the probe behaviour rather than the provider's
absence — the observable property is "completing a level on `/dev` writes nothing".

---

### P2 — Nice to clarify

- **[naming] `runKey` is four different variables.** The spec's table lists them per family;
  make it a single derived helper (`completionKeyFor(family)`) so the mapping lives in code
  rather than in the spec's prose.
- **[test] "The reducer has no reset event, asserted structurally on the `AttemptEvent`
  union"** is a good criterion and unusual — it tests an absence. Keep it; it is the only thing
  preventing a future reintroduction of the round-6 defect.
- **[docs] The carril-2 coupling is now stated at both ends** (`:3149`, `:3168` referenced from
  the edge case). Also add the reverse pointer in the code comment, so someone changing the
  ledger rule sees that a spec depends on it.
- **[perf] The outbox drains one at a time** (`selectNextSubmission` returns null while
  in-flight). After an outage of N attempts that is N sequential round trips; fine at N ≤ 20,
  worth noting next to the cap.
- **[compat] Persisting the outbox (P0-2's fix) needs a version tag** in whatever key it uses,
  or a shape change in Slice 4 will read stale snapshots and POST malformed bodies.

---

## Categories audited

**Contract gaps** — the event union, the outbox state and the two-gate split are complete. The
one contract smell left is an alias that adds nothing (P1-4).

**Behavioral ambiguity** — B1–B19 are testable. The ambiguity is no longer in what happens but
in where the guarantees stop: the latch's key for three families (P0-1) and the outbox's
lifetime (P0-2).

**Hidden assumptions** — (1) that every family's run key rotates on `resetBoard` (false for
`labyrinthKey`, P0-1); (2) that a page's lifetime bounds an attempt's lifetime (false on
MiniPay, P0-2); (3) that queueing without a wallet is harmless (false, P1-1); (4) that a failed
submission will be retried at a sane rate (unspecified, P1-2). The Promotion Run analysis, the
assembler table and the grader inventory remain verified and unchanged.

**Backward compatibility** — untouched and strong. Schema frozen, D1–D17 intact, no backfill,
additive migration, `drop`-only rollback, legacy bundles degrade to `ungraded`.

**Security & data** — settled since round 4. Server-computed stars from a kind-checked
measurement, canonical `level_id`, per-wallet attempt ids, transactional consume, privileges
asserted on state. P1-1 is the only new exposure and it is a correctness/attribution issue
rather than an attack.

**Test coverage gaps** — the double-call and clear-before-send tests are present and are the
right ones. Missing: per-family key rotation (P0-1), a persistence/reload case (P0-2), and the
cross-assembler shared-ref case (P1-5).

**Operational readiness** — logging covers replays, absent ids, unknown fields and overflow.
Missing: retry pacing (P1-2) and an actionable overflow payload (P1-3).

---

## Verdict

**NEEDS REVISION.**

P0 findings: **2**
P1 findings: **6**
P2 findings: **5**

The mechanisms are correct in design and this is the closest the spec has been to
implementable. The latch is in the right place, the outbox decouples delivery from the board,
`submission_settled` removes only its own attempt, and a retry provably cannot become a second
row because the server treats the re-sent id as a replay.

Both remaining P0 are about **where each mechanism's guarantee stops**, and both are one
change each. Exactly-once rests on run keys that `resetBoard` rotates for four families and
does not touch for three — bump `labyrinthKey` there, or own the counter in the assembler.
At-least-once rests on a queue that dies when the app closes, on a platform where closing the
app is how sessions normally end, and where this repo already had to persist the score session
for the same reason. Persist the outbox, or narrow D20 to what it actually delivers.
