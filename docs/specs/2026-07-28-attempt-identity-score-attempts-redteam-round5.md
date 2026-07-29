# Red Team Review — attempt-identity-score-attempts (Slice 3) — ROUND 5

**Date**: 2026-07-28
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` (round 5)
**Prior rounds**: `-round1` · `-round2` · `-round3` · `-round4` — all P0 and P1 closed.

Round 4's three P0 are closed by decision and by inventory: every grader family is in scope,
the Daily boundary is stated, and the grader table is verified line by line rather than
assumed. The measurement union, `grade_status`, and admitting a real 0 are all correct and
should not be reopened.

This round attacks the one thing round 4 created: **D16's mounting table**.

---

## Findings

### P0 — Must address before implementation

#### P0-1 · [architecture] Three of the seven mount points are components that do not have the data the event requires

The adapter needs `exerciseId`, `levelId`, `score`, `timeMs` and the measurement. The spec
mounts it at:

- `safe-path-board.tsx:215`
- `diagonal-run-board.tsx:181`
- `queens-board.tsx:173`

Those are presentational boards. They hold their own run state — `moves`, `placed`,
`level.optimalMoves` — and nothing else. `score` is `max(1, totalStars) * POINTS_PER_STAR`
computed in `exercises-screen.tsx:1045` from the *piece's* accumulated stars; `levelId` is
`getLevelId(selectedPiece)` at `:1044`. Neither exists inside a board, and a board has no
business knowing a wallet's cumulative score.

So the mounting table as written is not implementable at three of its seven rows. The
implementer will do one of two things, both bad: thread `score`/`levelId` props down into the
boards (coupling presentational components to the save path), or mount "close enough" in the
screen and lose the family's real measurement — which silently reverts those families to
ungraded, the exact outcome D15 was chosen to prevent.

**Fix:** boards emit **only their measurement**, upward. `onCompleted(measurement:
AttemptMeasurement)` is the entire board-side contract; the host owns the completion event
and fills in `exerciseId`, `levelId`, `score` and `timeMs`. Rewrite the mounting table as
*measurement source* → *event owner*, with the owner always being the host that already has
the score.

#### P0-2 · [duplication] Two rows of the mounting table describe the same completion — one attempt would emit two events

`exercises-screen.tsx:3146` grades with `labyrinthStars(m, activeLabyrinth.optimalMoves)`,
and `safe-path-board.tsx:215` / `diagonal-run-board.tsx:181` grade with `labyrinthStars` too.
The spec lists **both** the screen-level site and the board-level sites, and assigns
`diagonal-run` to two rows explicitly (`:3146` "labyrinth / diagonal-run" and
`diagonal-run-board.tsx:181` "diagonal-run").

If both fire, one completed Safe Path or Diagonal Run mints two `attemptId`s and writes two
rows for one attempt. That is the **over-count** failure mode — the mirror of the under-count
that rounds 1 and 2 spent three iterations closing — and it lands in the same table, forever,
inflating exactly the activity counts Slice 2 will read.

Nothing in the spec says which site owns which family. The reducer cannot save us: two
distinct `completed` events are indistinguishable from two genuine attempts, by design.

**Fix:** make ownership exclusive and assert it. One family → one owner, stated in the table,
plus a test that a single simulated completion of each family produces **exactly one** event
(count it, do not merely assert it is non-zero). The existing guard criterion checks that no
transition is *missing* an adapter call; it needs its twin — that no transition emits twice.

---

### P1 — Should address

#### P1-1 · [scope] Knight's Tour still ends up outside performance ranking — D15 does not deliver what it was chosen for, and the cause is not scope

D15 was picked so no carril-2 family would carry NULL stars "by scope decision". But Knight's
Tour is `starless: true` (`content-stars.ts:9-24`), a *product* decision predating this spec:
`resolveCoverageStars` deliberately returns `awardsStars: false, stars: 0`, "preserving
coverage records while producing no display or ledger stars".

The spec handles it correctly (`grade_status = 'starless'`, stars NULL) — and then
§Out-of-scope tells Slice 2 to exclude `starless` rows from performance rankings. Net result:
Knight's Tour play counts as activity and never as performance, which is what option (b) of
round 4 would have produced for the whole carril.

That is not a defect, but it is a promise D15 cannot keep, and the founder chose (a) partly
to avoid it. It should be surfaced as a decision — *is a starless family's coverage worth
ranking on its own axis?* — not left as a consequence discovered later.

#### P1-2 · [validation] `MAX_MOVES_FACTOR = 10`, floor 60, is invented — and it is meaningless for four of the seven families

The spec bounds `movesUsed` by `10 × optimalMoves` with a floor of 60, "asserted against the
built catalogue". Three problems:

1. It is not derived from anything measured — it is a round number with a justification
   attached, which is what round 4's P1-2 asked to stop.
2. `optimalMoves` does not mean "moves" in four buckets: for `queens` it is *the queens the
   player places*, for `knightTour` it is the *reachable ceiling* (`catalog.ts:98-110`). Ten
   times a queen count is not a move bound.
3. The families whose measurement is `failures` or `coverage` never carry `movesUsed`, so the
   bound simply does not apply — yet the spec presents it as the measurement bound.

**Fix:** bound **per measurement kind**, each derived from its own quantity: `moves` from the
catalogue's move optimum, `coverage` from the exercise's ceiling (already required to match),
`failures` from a stated saturation argument (`promotionRunStars` saturates at 2). Assert each
against the catalogue.

#### P1-3 · [safety] A `/dev` probe could start writing real attempts

`components/dev/diagonal-run-spike.tsx:183` grades with `labyrinthStars` and is a **copied
fork** of the Diagonal Run board — two implementations with nothing keeping them in sync. If
the adapter lands on the shared board (P0-1's fix) the fork stays inert, but the next probe
that renders a *real* board inherits the write path, and `/dev` routes exist precisely to
reach states the UI cannot.

**Fix:** state that the completion adapter is inert on `/dev` surfaces, and add the guard —
probes render boards, not save paths.

#### P1-4 · [test] The "no Daily writes here" criterion is a source scan, and source scans decay

D17's boundary is asserted by scanning `daily-tactic-slot.tsx` and `hub-daily-tile.tsx` for a
reference to the adapter or `postScoreSave`. That catches today's two files and nothing else:
a third Daily surface, or an indirection through a shared hook, passes the scan while writing
rows.

**Fix:** assert the boundary where it is structural — the adapter takes a `family` from a
closed union that has no Daily member, so a Daily caller cannot construct a valid event. Then
the scan is a nicety rather than the guarantee.

#### P1-5 · [contract] `measure_ceiling` is validated against the catalogue, but the catalogue's ceiling is not stable for `knightTour`

Rule 4 says a client-supplied `ceiling` "must equal the catalogue's for that exercise".
For `knightTour` the catalogue's `optimalMoves` is documented as the **reachable ceiling
(squares − 1)** and as an *upper bound*, not an exact value — unlike `queens`, whose ceiling
"is EXACT rather than an upper bound: it comes from a solver" (`catalog.ts:98-109`).

An equality check against a value the catalogue itself describes as approximate will reject
honest submissions the day the bound is recomputed. Use the catalogue's value **as the
authority** — ignore the client's and persist the catalogue's — rather than comparing them.

#### P1-6 · [ops] Open Question 1 is a blocking dependency, not a question

"Does the Promotion Run completion path expose `failures` at the completion transition?"
decides whether the pawn — one of the six signature games and the one whose grader is most
different — can be graded at all. If the count lives only inside the run's internal state, the
adapter for that family cannot be written, and Promotion Run silently falls back to
`ungraded`, which D15 forbids.

Answer it before TDD. It is a read of one file.

---

### P2 — Nice to clarify

- **[schema] `measure_value` for `coverage` needs a name.** It holds `reached`, while
  `measure_ceiling` holds the ceiling. Fine, but the column comment must say so — `value`
  next to `ceiling` reads as "score out of ceiling" to a future querier.
- **[semantics] `grade_status = 'ungraded'` now has two producers**: a legacy bundle with no
  measurement, and (if P0-1 is mishandled) a family whose measurement was lost. Only the
  first is legitimate; a monitor on `ungraded` rows from `attempt_id_source = 'client'` would
  catch the second immediately.
- **[perf] Two uniques and two coherence checks per insert**, inside the advisory lock.
  Irrelevant at 132 rows; note it for the retention review, which currently looks only at row
  count.
- **[docs] `catalog.ts:120-122` is now known to mislead.** The spec neutralises it in prose
  and in a test comment. Better: fix the comment in the same commit, so the trap stops
  existing rather than being documented.
- **[slice2] "A wallet can have a Focus Day with zero attempt rows, and attempt rows with no
  Focus Day"** is exactly right and is the single most important sentence for whoever writes
  Slice 2. It should be repeated in Slice 2's spec verbatim, not referenced.

---

## Categories audited

**Contract gaps** — the measurement union removes the shape collision round 4 flagged; each
kind accepts only its input and a mismatch is a 400. `grade_status` gives `stars_earned` a
single explanation and the two coherence constraints make the illegal states unrepresentable
in the table, not merely discouraged. Remaining gap: bounds are stated per-field rather than
per-kind (P1-2).

**Behavioral ambiguity** — B1–B17 are testable. The ambiguity is entirely in D16's table:
which site owns which family (P0-2) and whether the listed sites *can* own anything (P0-1).

**Hidden assumptions** — (1) that boards can produce a complete completion event (false,
P0-1); (2) that listing a site once per family is the same as assigning ownership (false,
P0-2); (3) that `10 × optimalMoves` is a bound for every family (false, P1-2); (4) that the
tour's catalogue ceiling is exact (false, P1-5). The grader inventory itself is verified and
holds — including the two traps it documents (promotion-run's misleading comment, and 0 as a
real outcome).

**Backward compatibility** — unchanged and still strong: `score_saves` untouched, no backfill,
additive migration, `drop`-only rollback, legacy bundles degrade to `ungraded` rather than
failing, and the `maxSaves` raise is compatible in the safe direction and correctly coupled to
grading.

**Security & data** — the ranked value is server-computed from a bounded, kind-checked
measurement and the catalogue; `level_id` cannot be spoofed; `unique (wallet, attempt_id)`
closes the cross-wallet oracle; privileges are asserted on state; the consume is transactional.
New surface this round: `/dev` probes (P1-3).

**Test coverage gaps** — per-family adapter tests and the "nothing missing" guard are
specified; their twin, "nothing emitted twice", is not (P0-2). The premise fixture is now
mechanism-based (repeat a 3★ exercise so `netStars` is 0) and asserts the unchanged count
first, which is the right order.

**Operational readiness** — logging covers absent ids, unknown fields, ungraded rows and
replays; rollback is additive; deploy order is safe by construction; the lock-order invariant
has a guard. `walletHash` survives on the failure path.

---

## Verdict

**NEEDS REVISION.**

P0 findings: **2**
P1 findings: **6**
P2 findings: **5**

Everything about the data model, the trust model and the grading contract is finished. The
grader inventory is the strongest artefact in the document — it is verified against seven
buckets, and it catches two traps a careful implementer would otherwise walk into (a
catalogue comment that names the wrong grader for the pawn, and two graders that legitimately
return 0 into a column that would have rejected it).

What is unfinished is the one thing round 4 added: D16's mounting table enumerates sites
instead of assigning ownership, and three of those sites are components that structurally
cannot produce the event. Both P0 are the same fix — boards emit measurements, one host owns
each family's completion event, and a test counts events per completion rather than asserting
they exist. Neither touches the schema.
