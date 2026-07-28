# Red Team Review — attempt-identity-score-attempts (Slice 3) — ROUND 6

**Date**: 2026-07-28
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` (round 6)
**Prior rounds**: `-round1` … `-round5` — all P0 and P1 closed.

Round 5's two P0 are closed the right way: boards emit nothing, three host assemblers own
every family, Promotion Run needs no new callback because the host already holds `failures`,
and the two gates are separated with the improvement requirement removed from the write path.
The assembler table was verified against the JSX and is **correct** — Diagonal Run `:3674`
and Safe Path `:3712` both route to `handleLabyrinthMove`, Knight's Tour `:3690` and N-Queens
`:3699` to `handleCoverageComplete`, Promotion Run `:3728` through the picker to
`handlePromotionPick`.

What this round found is that the *reason* the spec gives for exactly-once does not hold for
most of those families.

---

## Findings

### P0 — Must address before implementation

#### P0-1 · [exactly-once] The `if (!reached) return` guard is inert for three of the four families that route through `handleLabyrinthMove`

The spec's exactly-once argument is: *"the emit point sits after the reached/complete check …
`handleLabyrinthMove` runs on every move but returns early unless `reached` (`:3142`), so the
pre-check region is never an emit site."*

That is true only for the **generic labyrinth**, which is wired as `onMove`
(`:3742` — `onMove={activeLabyrinth ? handleLabyrinthMove : handleMove}`) and therefore does
fire on every move.

The other three call it as `onComplete`, and the host passes the target position **literally**:

- `:3674-3676` — `onComplete={(moves) => handleLabyrinthMove(activeDiagonalRun.targetPos, moves)}`
- `:3712-3714` — `onComplete={(moves) => handleLabyrinthMove(activeSafePath.targetPos, moves)}`
- `:2928-2931` — `handleLabyrinthMove(activePromotionRun.targetPos, promotionPick.moves, …)`

Since the position argument **is** `targetPos`, `reached` is `true` by construction. The guard
can never filter anything for those three. Every invocation is an emit, and the only thing
preventing a second one is each board's own internal completion state — `phase === "won"` in
`diagonal-run-board.tsx:181`, `phase === "done"` in `safe-path-board.tsx:215`, and, for the
pawn, the picker being cleared in `handlePromotionPick`.

So exactly-once is currently enforced by **four independent, uncoordinated mechanisms**, and
the spec attributes it to a fifth that does not apply. Worse, the one shared guard that does
exist — `isLocked={… : labyrinthCompleted !== null}` (`:3741`) — is passed **only to the
generic `Board`**; the four specialised boards never receive it.

**Why blocking:** the spec's own acceptance criterion ("a single simulated completion of each
family produces exactly 1 event") would pass, because a test calls the handler once. The
double-emission risk lives in the re-entrant paths a unit test does not reproduce, and this
table never deletes rows.

**Fix:** put the latch in the assembler, not in the callers. `handleLabyrinthMove` and
`handleCoverageComplete` each need an explicit "this completion has already been emitted"
guard keyed on the active content id — the same shape as `autoSavedScoreRef`, which already
exists for exactly this purpose one flow over. Then add a criterion that calls each
assembler **twice** with the same completion and asserts **one** event, which is the test that
fails on today's arrangement.

#### P0-2 · [state] `attempt_started` can destroy a `pending` snapshot before it is ever submitted

The reducer clears `pending` on `attempt_started`, and the spec's rule is *"a submission
already in flight is unaffected"*. That covers the request that has left. It says nothing
about the window between minting and the auto-save effect running — and in this component
that window is real and routinely crossed automatically:

`resetBoard()` is called from roughly twenty sites, several of them on timers immediately
after a completion or failure (`:2844`, `:2880`, `:1889`, `:1916`, `:1925`, `:1931`, …), and
the failure path auto-resets whenever the player has no rescue context
(`hasRescueContext` false → `holdForTap(() => handleRetryApplied("auto_reset"))`).

The effect that submits is a React effect keyed on `pending?.attemptId`. If a reset lands in
the same commit — or the effect is skipped because `isSubmitBusy` was true at that moment —
`pending` becomes null and the attempt is **silently lost**. No error, no log, no row. That is
the under-count failure mode this spec spent rounds 1 and 2 eliminating, re-entering through
the clear instead of through the mint.

**Fix:** `pending` must not be the only reference to an unsent attempt. Either
`attempt_started` moves an unsent snapshot into a small outbox the effect drains, or the
reducer refuses to clear a snapshot that has not been handed to a submission. Add a test:
`completed` → `attempt_started` **before** any submission → the attempt is still submitted
exactly once.

---

### P1 — Should address

#### P1-1 · [validation] `MOVES_CEILING(optimalMoves)` still has no value

Round 5 asked for a derived bound; round 6 replaced `10 × optimalMoves` with
`MOVES_CEILING(optimalMoves)`, described as "derived from the catalogue's move optimum and
asserted against the built catalogue". That is the shape of an answer, not one. Nothing in the
spec says what the function is, and "assert it against the catalogue" cannot be written until
it exists.

It also still carries round 5's scope error in miniature: it applies only to buckets whose
`optimalMoves` is a move count, which the spec now says, but the reader is left to work out
which those are (exercise, labyrinth, diagonal-run, safe-path — not queens, not knight-tour,
and not promotion-run, whose measurement is failures).

**Fix:** state the function and the constant, name the four buckets it applies to, and make
the catalogue assertion concrete (`for every exercise in those buckets, MOVES_CEILING(e) >
worst plausible completion`).

#### P1-2 · [test] The "no board imports the adapter" scan omits the Promotion Run board

The criterion scans `safe-path-board.tsx`, `diagonal-run-board.tsx` and `queens-board.tsx`.
`promotion-run-board.tsx` exists (16.4K, same directory) and `knight-tour-board` is wired at
`:3685` — neither is in the list. A guard that names files by hand will always be one file
behind; scan the directory for board components instead of enumerating three of five.

#### P1-3 · [architecture] The exactly-once guarantee has no single owner, and the spec does not say who it is

Related to P0-1 but distinct: after the fix, four boards and two assemblers all participate in
"one event per completion". The spec should name the owner explicitly — the assembler — and
state that boards are permitted to call `onComplete` more than once. That inverts the
dependency: instead of trusting five components to be well behaved, the two assemblers become
idempotent, which is testable in one place.

#### P1-4 · [ui] The carril-2 results state is asserted nowhere

D18 deliberately makes `canSubmitAttempt` true while `canOfferScoreSaveUI` is false, so a
player finishing Safe Path writes an attempt and is offered no save affordance. The spec's
Open Question 2 asks whether the sheet reads the POST result — that is the right question and
it is unanswered, but there is a second one it does not ask: `LabyrinthCompleteOverlay` is
what renders for these families, and nothing in the criteria asserts that the new POST does
not change what it shows (it already takes `awardsStars`, `isNewBest`, `previousBest`).

Add one criterion: completing a carril-2 level renders the same overlay content before and
after this slice.

#### P1-5 · [ops] `/dev` inertness is stated but unmechanised

"The assemblers are inert on dev surfaces" (B17) has no mechanism. `/dev` probes render real
boards on purpose, and `diagonal-run-spike.tsx:183` is a copied fork that grades with
`labyrinthStars`. Say **how** inertness is achieved — a context flag the probes set, or the
absence of a wallet on those routes making `canSubmitAttempt` false — and assert it.

#### P1-6 · [semantics] "Carril 2 will never create a `score_saves` row" is stated as a fact but depends on a behaviour that could change

B3 and the edge case both assert that carril-2 rows are always `duplicate` because carril-2
stars never reach `pieceStars` (`:3149`, `:3168`). That is true today and it is a *rule
someone chose*, not an invariant of the system — the comment at `:3165-3168` explains that
labyrinth stars feed the daily ledger deliberately.

If that rule is ever revisited (a plausible product change: "labyrinths should count toward
the piece"), carril-2 submissions start producing `saved` rows and the spec's stated
expectation silently inverts. Phrase it as "today, and by this rule" with a pointer to the
comment, so the coupling is visible from both ends.

---

### P2 — Nice to clarify

- **[naming] `canSubmitAttempt` includes "there is something to submit".** It is what was
  asked for, but the name reads as a permission while the value is permission ∧ availability.
  `hasSubmittableAttempt` says what it is.
- **[schema] `measure_value` overloading is now documented** in a column comment; also add it
  to the `grade_status` comment, since the two are read together.
- **[test] The two premise tests are the strongest criteria in the document** — carril 1 at
  the ceiling and carril 2 with an immutable score. Consider marking them as the ones that
  must never be weakened, because both are exactly the tests that a shortcut would delete.
- **[docs] `catalog.ts:120-122` is corrected in the same commit** — good. Also fix the tour's
  "upper bound" language if the coverage ceiling is now authoritative, so the next reader does
  not re-derive P1-5 of round 5.
- **[ops] Open Question 1 (does `handleCoverageComplete` fire once per run?) is now
  answerable**: its own comment claims it, and the boards gate on internal phase. After P0-1's
  latch it stops mattering, which is the better resolution than answering it.

---

## Categories audited

**Contract gaps** — the measurement union, `grade_status`, the coherence constraints and the
two-gate split are complete and internally consistent. The remaining gap is a bound that is
named but not defined (P1-1).

**Behavioral ambiguity** — B1–B18 are testable. The ambiguity is concentrated in the lifetime
of an unsent `pending` (P0-2) and in who guarantees single emission (P0-1, P1-3).

**Hidden assumptions** — (1) that `if (!reached) return` gates every `handleLabyrinthMove`
caller (false for three of four, P0-1); (2) that a cleared `pending` was always already sent
(false, P0-2); (3) that carril 2 will always dedup (true today, by a rule, P1-6). The
Promotion Run analysis is verified end to end and holds: the failures ref is host-owned,
incremented at `:2861`/`:2901`, read at `:2926`, and already flows into the assembler.

**Backward compatibility** — unchanged and strong. `score_saves` untouched, no backfill,
additive migration, `drop`-only rollback, legacy bundles degrade to `ungraded`, old clients
keep saving, and the `maxSaves` raise stays coupled to grading.

**Security & data** — settled since round 4 and untouched here: server-computed stars from a
kind-checked measurement, canonical `level_id`, per-wallet attempt ids, transactional consume,
privileges asserted on state. New surface is operational rather than adversarial (P1-5).

**Test coverage gaps** — the criteria now include per-family exactly-once, the 0-emission
boundary, Promotion Run's measurement kind, and both premise tests. Missing: the double-call
test that would catch P0-1, the clear-before-send test for P0-2, and the overlay-unchanged
assertion (P1-4).

**Operational readiness** — logging, rollback, deploy order, lock-order guard and the
`walletHash` path are all specified. `/dev` inertness is the one claim without a mechanism.

---

## Verdict

**NEEDS REVISION.**

P0 findings: **2**
P1 findings: **6**
P2 findings: **5**

The architecture is right and, for the first time, the wiring has been read rather than
assumed: three assemblers, no board emissions, the pawn's failures already in the host's hand,
and a clean split between writing an attempt and offering a save. None of that should be
reopened.

Both P0 are the same class of defect and both are cheap: **exactly-once and at-least-once are
each asserted by an argument rather than by a mechanism.** The `reached` guard cannot dedupe
three of the four families that route through it, because the caller passes the target
position literally; and a `pending` snapshot can be cleared by any of ~20 `resetBoard()` sites
before the effect that submits it ever runs. Put the latch in the assembler, give the unsent
snapshot somewhere to wait, and add the two tests that fail today — a double call that must
produce one event, and a clear-before-send that must still produce one.
