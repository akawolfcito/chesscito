# Red Team Review — leaders-weekly-window (Slice 2, v2)

**Date**: 2026-07-29
**Spec under review**: `docs/specs/2026-07-29-leaders-weekly-window-v2.md`
**Rounds**: 1 (against r1) · 2 (against r2) · **3 (split integrity review — top of file)**
**Reviewer mindset**: hostile QA + senior engineer
**Bias declared**: v1 of this spec was killed by a P0 that every acceptance criterion would
have passed. Each round assumes that class of failure is present again until proven otherwise.
Round 2 additionally assumes the *fixes* introduced new defects — they had.

---

## Round 3 — split integrity review

Not a third adversarial pass: the four gates the split had to clear, plus what checking them
turned up.

### Gate 1 — own scope and definition of done

| Slice | Scope boundary | Own DoD |
|---|---|---|
| 2A DB | Postgres only; explicitly "no TypeScript in this slice" | Migration applies to a fresh DB *and* on top of prod's schema; SQL smoke covering DB-1…DB-23; privileges verified live and recorded in the header; DEPLOY/VERIFY/ROLLBACK scripts |
| 2B API | Server TS only; "no component file touched"; must not read the feature flag | 16 ACs green; the four all-time symbols byte-identical; `tsc` clean |
| 2C UI | One component + copy; "no server file, route or SQL" | 18 ACs green; flag-unset output unchanged from `main`; both bundles; `content:audit` clean |

Pass. Each DoD is checkable without reading the other two files.

### Gate 2 — no dependency on unspecified future work

Checked in the risky direction — *backwards*, since each slice ships alone:

- **2A alone** is inert: nothing calls the RPCs, and the view is revoked from every client role.
  A merged-and-idle 2A changes no behavior.
- **2B alone** is reachable only by hand-crafting `?window=weekly`. The UI never sends it, so the
  player-visible surface is unchanged. 2B's DoD says so explicitly.
- **2C alone** cannot be merged before 2B — it consumes `LeaderboardResponse` — and its flag
  defaults OFF, so even merged-and-idle it renders today's sheet.

Pass, with one thing made explicit rather than assumed: **2A fails silently** on a mixed-case
wallet or an out-of-range surface (zero rows, no error). Both children now say so — 2A under
"Contract provided", 2B under "Contract received" as *its* responsibility. A silent-failure
handoff that only one side knows about is how a slice boundary leaks.

### Gate 3 — all ACs preserved

**One defect found, in this reviewer's own matrix.** The first version of the parent's
traceability table claimed "two ACs added" and totalled 57 against a 54-AC baseline — arithmetic
that does not close. Recounting per slice (23 + 16 + 18) against r2.1's nine groups (2+9+3+2+8+3+8
+13+6 = 54) showed **three** additions, not two: `UI-14` (no weekly row renders the on-chain seal)
had been created and then omitted from the count. Corrected, with a `Subtotal moved = 54` row so
the arithmetic is visible rather than asserted.

Worth naming as the finding it is: an AC matrix whose numbers do not reconcile is the exact
artefact meant to prove nothing was lost. It cannot do that job while its own total is unchecked.

Post-fix: 54 moved (each to exactly one child, no duplicates), 3 added, 1 reworded (`DB-21`, the
index plan → existence check + manual `explain`), 0 dropped.

### Gate 4 — declared inbound contract

- 2A: "None. This is the first slice" — then lists the existing prod objects it reads, with the
  constraints that matter (`wallet` lowercase-only, `surface` not null, RLS deny-all).
- 2B: the two RPC signatures, the exact return shape, the `wallet`-not-`player` naming, the absent
  `has_onchain`, and the two properties it must uphold because SQL will not.
- 2C: the `LeaderboardResponse` type, the absent `hasOnchain`, `player: null` as normal, and the
  possible 500.

Pass. Each child restates the shape it receives without redefining it, and points at the parent
for D1–D5.

### Round 3 verdict

**✅ All three children READY.** TDD order 2A → 2B → 2C. One matrix arithmetic defect found and
fixed; no scope gaps, no unspecified dependencies, no lost criteria.

---

## Round 2 — findings against r2

Two P0, both **introduced by r1's fixes**, both closed in r2.1. Four P1, all folded in.

### P0 — closed in r2.1

**[R2-P0-1] Reusing `toApiRow` would have emitted `hasOnchain: false` on every weekly row.**
`lib/server/leaderboard.ts:36` writes `hasOnchain: r.has_onchain ?? false`. A weekly row has
no such column, so the coalesce produces a **present** field asserting "this player has no
on-chain score" — precisely the claim §Deliberate asymmetry exists to prevent ("the marker is
not off, it is *not applicable*"). Behavior 4 says *absent*.
**Why it was blocking**: `false` satisfies every falsy assertion. `expect(row.hasOnchain).toBeFalsy()`
passes, `expect(row.hasOnchain).toBe(false)` passes, and the r2 AC as written
("never returns `hasOnchain`") would have been implemented as one of those. Only
`"hasOnchain" in row` catches it. Second defect in the same reuse: `weekly_ranking` returns the
identity column as `wallet` while `toApiRow` reads `r.player`, so `deriveRowId(undefined)`.
**Closed by**: a dedicated `toWeeklyApiRow`, plus an AC that names the `in`-operator assertion
and forbids the falsy check.

**[R2-P0-2] r2's own optimistic-clear rule compared two unrelated numbers.**
r2 said the entry is cleared when a response contains the own row with
`score >= optimistic.score`. But `optimistic.score` is one exercise's value while
`LeaderboardRow.score` is a per-player **total** (`Σ MAX(score) by level`). Both are `number`,
so the comparison type-checks, reads as obviously correct, and is meaningless — the same
failure this codebase has already recorded once ("two `number` metrics of opposite meaning are
reused without error and lie").
**Why it was blocking**: worse than the bug it was meant to fix. The component *already*
solves the double-append correctly by comparing `rowId`
(`leaderboard-sheet.tsx:102-108`) — r2 replaced a working signal with a broken one while
claiming to harden it.
**Closed by**: reverting to the `rowId`-presence check, with the reasoning written down and an
AC forbidding any `optimistic.score` ↔ `row.score` comparison.

### P1 — folded into r2.1

- **[R2-P1-1] Handler ordering makes the 500 leak into legacy requests.** Resolving
  `requireDeploymentSurface()` at the top of the handler — the natural way to write it — makes
  an unset mode return 500 for `/api/leaderboard` with no params, breaking the
  byte-for-byte backward compatibility the spec calls non-negotiable. The r2 AC covered the
  symptom; the contract now states the ordering.
- **[R2-P1-2] The fallback view's window silently shifts on a non-UTC server.**
  `now() at time zone 'utc'` yields a `timestamp` *without* time zone; passing it to a
  `timestamptz` parameter casts it through the database's `TimeZone` setting. A second
  `at time zone 'utc'` pins it. Invisible to any test running on a UTC database — which is all
  of them.
- **[R2-P1-3] `achieved_at` cannot be computed in one pass.** `min(created_at) filter (where
  score = max(score))` nests aggregates and is invalid; the plausible-looking fallback,
  `min(created_at)` grouped by `(wallet, level_id)`, compiles and credits the player's *first
  attempt on the level* — including a bad one — instead of the first time they reached their
  best. It changes tiebreak order without changing any total, so no AC about scores would catch
  it. The two-step shape is now spelled out.
- **[R2-P1-4] "The plan uses the index" is not a testable AC.** A pinned query plan flakes on
  the first statistics change. Split into an existence check plus a manual `explain` during
  migration verification.

### P2 — noted, not blocking

- **[R2-P2-1]** The optimistic row is appended with `rank: apiRows.length + 1`
  (`leaderboard-sheet.tsx:112`). With a top-10 cut on all-time, that reads as rank 11 for a
  player who may be anywhere. Pre-existing, all-time-only, unchanged by this slice.
- **[R2-P2-2]** `weekly_ranking` is `stable`, so `get_weekly_player_rank` computes the full
  ranking and then filters one row. Correct and simple; if the wallet count ever makes that
  expensive, the fix is a `partition`-free CTE, not an index.
- **[R2-P2-3]** Nothing states whether a weekly RPC failure logs distinguishably from an
  all-time one. Both currently land in the same generic `[leaderboard] error` line
  (`api/leaderboard/route.ts:25`).

### Round 2 verdict

**✅ READY for `/tdd`** — 0 open P0, 0 open P1. Spec is at r2.1.

The two P0 found this round were artefacts of r1's fixes, which is the expected outcome of
re-reviewing after a revision rather than a reason to distrust the result: both were found by
reading the code the spec would touch (`leaderboard.ts:28-42`,
`leaderboard-sheet.tsx:88-122`), not by reasoning about the prose.

Unchanged and re-confirmed across both rounds: the formula (D1), the half-open UTC week, the
surface split (D2), the off-chain asymmetry, and the UI state table.

---

## Round 1 — findings against r1 (historical)

All five closed in r2. Kept for the record.

**[P0-1] Wallet case: `score_attempts.wallet` is lowercase-only, and r1 never normalised
`player`.** The column carries `check (wallet ~ '^0x[0-9a-f]{40}$')`
(`20260731000000_score_attempts.sql:38`) — lowercase hex only. `toApiRow` lowercases *after*
the query (`lib/server/leaderboard.ts:29`), and the sheet sends the wagmi address raw:
`` `/api/leaderboard?player=${address}` `` (`leaderboard-sheet.tsx:128`), which is EIP-55
**checksummed**. So `?player=0xAbC…` matched zero rows and answered `player: null` — a
*specified, valid* state in weekly, making the bug indistinguishable from correct behavior, and
undetectable in tests whose fixtures are forced lowercase by the table constraint. v1's failure
mode wearing a new hat. **Closed**: server-side lowercasing + a checksummed-address AC.

**[P0-2] No row limit on the weekly board.** All-time cuts at 10
(`20260611120000_leaderboard_onchain_flag_player_rank.sql:52`); r1 defined neither a cut nor
the relationship between the cut list and `get_weekly_player_rank`, which exists precisely for
players outside it (QA G4 2026-06-11). **Closed**: top 10, player rank over the uncut set, AC
for rank 11+.

**[P0-3] No kill switch on a change that alters the default view of a live surface.** D3 makes
weekly what everyone lands on, from a table one day old. Slice 3 shipped behind
`NEXT_PUBLIC_ATTEMPT_LANE_ENABLED` for this reason. **Closed**:
`NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`, default OFF, endpoint still probeable, rollout + rollback
written down.

**[P0-4] `resolveDeploymentSurface()` fails open to `learn`.** With
`NEXT_PUBLIC_CHESSCITO_MODE` unset (`lib/scores/deployment-surface.ts:23-30`), a Play
deployment would render **Learn's** weekly board — correctly ranked, correctly labelled, wholly
wrong. Self-consistent on the write path, not on the read path. r1 called this
"unrepresentable" when it was merely undetectable. **Closed**: `requireDeploymentSurface()`,
500 on anything not explicitly `learn`/`play`/`full`.

**[P0-5] The attempt-lane dependency was unstated.** With
`NEXT_PUBLIC_ATTEMPT_LANE_ENABLED` off, weekly is permanently empty and looks like nobody
played, while all-time keeps working. The read path cannot observe the write flag, so this is an
ordering rule between two flags, not a runtime check. **Closed**: §Operational dependencies.

**P1s (all closed in r2)**: no `(surface, created_at)` index; the optimistic row's lifecycle
left dangling; three copies of the ranking expression instead of one relation; missing ACs for
rollover, surface-filtered fallback and duplicate attempts; `hasFetched` being a single ref that
cannot express per-tab state; `total_achieved_at`'s perverse corner unacknowledged.

**P2s (all closed or accepted)**: `surface` now required on weekly; `?window=` empty ⇒ 400
stated; `force-dynamic` pinned; the window-independence of `is_verified` documented so nobody
"fixes" it.

## Categories audited (both rounds)

**Contract gaps** — No `any`/`unknown`. `player: null`, absent-vs-false `hasOnchain`, and the
`wallet`→`rowId` derivation are all explicit. Error paths: 400 (bad window), 500 (unresolved
surface), plus the existing generic 500. Clean.

**Behavioral ambiguity** — 18 behaviors, each with a trigger. Out-of-order tab responses and
week rollover are both specified. Remaining gap is cosmetic (R2-P2-3, log distinguishability).

**Hidden assumptions** — Verified, not assumed: `score_attempts.score` is the same quantity as
`score_saves.score` (both are `p_score` in one call,
`20260731000000_score_attempts.sql:267,299`); `date_trunc('week', …)` is Monday; the attempt
lane's flag is invisible to the read path.

**Backward compatibility** — Legacy shapes asserted byte-for-byte, no table DDL, no backfill,
all-time untouched, and the handler-ordering trap that would have broken it is now named.

**Security & data** — Wallets never leave the server (`rowId`/`variant`; `walletShort` only on
the caller's own row). The view is revoked from `anon`/`authenticated` **and** created
`security_invoker = true`, because a view is otherwise owner-run and bypasses
`score_attempts`' deny-all RLS. Privilege verification is specified against a live database
(`has_function_privilege`/`proacl`), never by grepping the migration — the lesson Slice 3
learned the hard way.

**Test coverage gaps** — Every behavior now has at least one AC. The ACs that matter most are
the ones written to defeat a plausible wrong implementation: `in`-operator for `hasOnchain`,
a checksummed address, rank 11+, a non-UTC database, both flag states.

**Operational readiness** — Kill switch with a rollout order and a rollback that touches no
data; index shipped with the migration; the two other env dependencies and their redeploy
requirement stated up front.
