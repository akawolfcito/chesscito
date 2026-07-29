# Spec — leaders-weekly-window (Slice 2) · PARENT

**Date**: 2026-07-29
**Status**: ✅ Decisions closed. Implementation lives in three child specs, all READY.
**Role**: this file is the **decision record and traceability index**. It owns D1–D5, the week
definition, the off-chain asymmetry, the rollout and the AC matrix. It contains no
implementation detail — the children do, and they reference back here rather than restating.
**Supersedes**: `2026-07-27-leaders-weekly-window.md` (⛔ BLOCKED). That file stays as the record
of why v1 could not be built; do not implement from it.
**Unblocked by**: Slice 3 — `score_attempts` (`20260731000000_score_attempts.sql`), live in prod
since 2026-07-29.
**Red-team**: `2026-07-29-leaders-weekly-window-v2-redteam.md` (2 full rounds + a split
integrity review)

## The three slices

| # | Spec | Owns | Status |
|---|---|---|---|
| 2A | `2026-07-29-leaders-weekly-db.md` | Index, `weekly_ranking`, both RPCs, fallback view, grants, SQL smokes | READY — no upstream dependency |
| 2B | `2026-07-29-leaders-weekly-api.md` | Week module, `requireDeploymentSurface`, wallet lowercasing, weekly mapper, route + shapes, RPC→view fallback, legacy compat | READY — after 2A |
| 2C | `2026-07-29-leaders-weekly-ui.md` | Kill switch, tabs, per-tab state, post-hydration preference, empty/CTA/error states, rollover, optimistic row | READY — after 2B |

**TDD order: 2A → 2B → 2C.** Each child declares the contract it receives from the previous one
and the contract it provides to the next, so no slice depends on unspecified future work.

Handoffs in one line each:

- **2A → 2B**: two RPCs and a view returning `(wallet, total_score, rank, is_verified)` — no
  `has_onchain` column, identity column named `wallet`. 2A fails **silently** on a mixed-case
  wallet or a bad surface; guarding both is 2B's job.
- **2B → 2C**: `LeaderboardResponse` (`window`, `rows` top-10, `player` over the uncut set,
  `weekStart`/`weekEnd`/`surface` on weekly). `hasOnchain` **absent** on weekly rows; `player:
  null` is normal; a weekly request can answer 500.

## Operational dependencies

| Dependency | Consequence if absent |
|---|---|
| **`NEXT_PUBLIC_ATTEMPT_LANE_ENABLED`** (default ON) | The weekly board is **entirely derived** from `score_attempts`. With the attempt lane off, no rows are written, so weekly goes permanently empty while all-time keeps working — an empty board that looks like "nobody played". **Weekly must not be enabled while the attempt lane is off.** This is an ordering rule between two flags, not a runtime check: the write flag lives on the write path and the read path cannot observe it. |
| **`NEXT_PUBLIC_CHESSCITO_MODE`** (`learn` \| `play` \| `full`) | The weekly read path **fails closed** (D5). Unset ⇒ 500, never a board. |
| **`NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`** (default OFF) | The feature's own kill switch (D4). |

All three are `NEXT_PUBLIC_*`: they need a **redeploy** to take effect, and they must be set on
**both** projects (learn and play).

## Problem

Leaders is a single all-time ranking: `Σ (best score per level)` over the union of `scores`
(on-chain) + `score_saves` (off-chain), ordered `total_score DESC, player ASC`
(`leaderboard_full_v`). Two defects, both measured in
`docs/product/2026-07-27-score-and-leaders-audit.md`:

- **R3 — the score measures inventory, not performance.** It is a function of one variable: how
  many exercises you have ever saved. The catalogue is finite (6 levels), so a player who joined
  today cannot reach the head of the table no matter how well they play — the veterans have
  already banked it.
- **R4 — the real tiebreaker is the wallet address.** A finite catalogue makes ties the
  *expected* state, so `player ASC` is what actually orders the top. The head of Leaders is, in
  practice, an alphabetical list of hex strings.

A weekly window fixes both without inventing a new metric: it resets the denominator so recent
play is what ranks, and it gives the tiebreaker a meaning (who got there first).

**Why v1 was blocked, and what changed.** v1 read `score_saves`, whose `save_id` is
`wallet:levelId:score` and UNIQUE — one row per *distinct score ever achieved*. There,
`created_at` means "first time that exact score was reached", not "played this week": a player at
their ceiling never writes another row, repeating a personal best writes nothing, and scoring
*worse* can write a row. Every acceptance criterion in v1 would have passed while the feature
failed its goal. `score_attempts` writes **one row per completed attempt**, including attempts
that improve nothing, so `created_at` there does mean "played". That is the only change that
matters — but it changes the source of every query.

## Goal

Leaders shows a **weekly ranking by default**, computed from `score_attempts` and scoped to the
deployment's own surface, with the all-time ranking still reachable from a tab.

## Decisions (founder, 2026-07-29) — the source of truth

| # | Decision | Consequence |
|---|---|---|
| **D1** | Total = `Σ MAX(score) GROUP BY level_id`, over attempts inside the week | Measures mastery, not volume. A worse later attempt cannot lower the total; a second attempt on the same level does not double-count. Implemented in 2A. |
| **D2** | Weekly filters by the **deployment's** surface | Learn and Play are separate competitive universes. Resolved server-side; a client-supplied value is never trusted. 2A filters, 2B resolves. |
| **D3** | The sheet opens on **weekly**, always | No `N`-rows threshold. A thin first week is honest. A manually chosen tab may persist per device. 2C. |
| **D4** | `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`, **default OFF** | OFF ⇒ the sheet is byte-identical to today (all-time only, no tabs). ON ⇒ tabs, weekly default. The **endpoint honours `?window=weekly` regardless of the flag**, so prod can be smoke-tested before anyone sees it. 2C owns the flag; 2B must not read it. |
| **D5** | The weekly read path **fails closed** on an unresolved surface | No silent fallback to `learn`. `NEXT_PUBLIC_CHESSCITO_MODE` must be explicitly `learn`, `play` or `full`; anything else ⇒ **500**, and the client renders the error state, never a board. 2B throws, 2C renders. |

**Scale correction.** v1's prose said `Σ (best per level) × 100`. That is wrong:
`leaderboard_full_v` computes `SUM(sub.best_score)::int` with no multiplier
(`20260611120000_leaderboard_onchain_flag_player_rank.sql:23`), and `score_attempts.score` is
`int not null check (score > 0)` — already in points, never normalised to 0..1. **Weekly applies
no multiplier**, so weekly and all-time totals are in the same unit.

## Non-goals

- **Not** hardening `/api/sign-score` or `/api/cache-score`. They keep the R1 defect (see
  §Deliberate asymmetry). Slice 2 does not grow to cover them.
- **Not** changing the all-time ranking. Its source, formula, tiebreak and `has_onchain` seal are
  untouched.
- **Not** stars-based ranking. `stars_earned` is recorded but is NULL for starless buckets
  (Knight's Tour, D15) — ranking on it would silently exclude a whole game.
- **Not** rewards, prizes, or season resets tied to the weekly window.
- **Not** the Hall of Fame. `components/play/play-leaders-sheet.tsx` reads `/api/hall-of-fame`
  (victory NFTs) and is unrelated despite the name.
- **Not** a weekly view over `score_saves` or `scores`. Weekly reads `score_attempts` only.

## Deliberate asymmetry — weekly is off-chain only

The weekly table reads **`score_attempts` only**. The all-time table keeps the union of `scores`
+ `score_saves` and keeps the `has_onchain` seal.

**Why** (founder, 2026-07-27, unchanged): the off-chain rail now requires a server-issued,
signature-authorized, revocable write session (Slice 0), and every attempt row is written inside
`save_score_attempt` with the wallet taken from the session row — never from a parameter. The
on-chain rail has no such gate: `/api/sign-score` signs any `levelId` it is asked to, and
`/api/cache-score` still takes `player` from the body. Gas cost slows abuse; it does not close
it. A new ranking must not be born carrying the defect Slice 0 removed.

**Consequences, accepted:**

- The weekly tab shows **no on-chain seal** on any row. The marker is not "off", it is *not
  applicable* to that window. It is **absent** from the payload, not `false` — a present `false`
  makes exactly the claim this section forbids.
- The two tabs are not arithmetically comparable — for two reasons: weekly excludes on-chain
  scores, and weekly is surface-scoped while all-time is not.
- This is **temporary**. When the proof rail is hardened, weekly can absorb `scores`.

## Week definition

One shared calendar window, UTC, no per-player timezone and no rolling window:

```text
week_start = Monday 00:00:00 UTC
week_end   = the following Monday 00:00:00 UTC   (exclusive)

included ⟺ created_at >= week_start AND created_at < week_end
```

Half-open on purpose: an attempt written at exactly `00:00:00.000` on Monday belongs to the new
week and to exactly one week. The UI may localize how the date is *displayed*; the computation
and the reset stay in UTC.

## Cross-cutting edge cases

Slice-local edge cases live in the children. These three belong to no single slice:

- **The first week is thin by construction.** `score_attempts` began writing 2026-07-29, so the
  board only knows play from that date. No backfill: `score_saves` cannot answer "played this
  week", which is the whole reason v1 was blocked. 2C renders it, 2A produces it, neither is
  wrong.
- **`total_achieved_at`'s perverse corner, accepted.** Because it is `max` over the levels in the
  total, a player who adds a level *without changing their total* pushes their own timestamp later
  and can lose a tie they previously won. Reaching a new level's best almost always changes the
  total, so the corner needs an exact tie plus a zero-delta addition. Left as-is: "when you
  finished assembling this total" is the honest reading, and a `min` would instead reward whoever
  started earliest and then stopped.
- **`is_verified` is window-independent.** It comes from `passport_cache`, is wallet-scoped, and
  is the one field on a weekly row that is not about this week. That is correct — do not "fix" it
  later.

## Traceability matrix

r2.1 had **54** acceptance criteria. Each lives in **exactly one** child; the split added 3, for
**57** total: 23 DB (`DB-1…DB-23`), 16 API (`API-1…API-16`), 18 UI (`UI-1…UI-18`).

| r2.1 AC group | Count | Moved to | IDs |
|---|---|---|---|
| Week module | 2 | 2B (pure TS) | API-1 … API-2 |
| Ranking (D1) | 9 | 2A (SQL) | DB-1 … DB-9 |
| Cut and player rank | 3 | 2A (SQL) | DB-10 … DB-12 |
| Wallet case | 2 | 2B (normalisation happens in TS) | API-3 … API-4 |
| Surface split — SQL half | 4 | 2A | DB-13 … DB-16 |
| Surface split — resolution half | 4 | 2B | API-5 … API-8 |
| Kill switch — endpoint half | 1 | 2B | API-9 |
| Kill switch — UI half | 2 | 2C | UI-1 … UI-2 |
| API shapes and compat | 7 | 2B | API-10 … API-16 |
| Weekly excludes on-chain-only wallets | 1 | 2A (source selection) | DB-17 |
| Database privileges and structure | 6 | 2A | DB-18 … DB-23 |
| UI tabs, state, rendering | 13 | 2C | UI-3 … UI-11, UI-15 |
| UI optimistic row | 3 | 2C | UI-16 … UI-18 |
| **Subtotal moved** | **54** | | |

**Three ACs added during the split** — each covers a rendering claim that r2.1 asserted only on
the server side, so none replaces a moved criterion:

- **UI-12** — rank 11+ *renders* in the footer while the list shows 10. `DB-11` proves the SQL
  ranks over the uncut set; nothing proved the component displays it.
- **UI-13** — a 500 renders the error state. D5's UI half was described in r2.1's state table but
  had no criterion.
- **UI-14** — no weekly row renders the on-chain seal. `API-12` proves the field is absent from
  the payload; nothing proved the component does not paint the seal from something else.

**One AC reworded, not dropped**: r2.1's "the weekly aggregate's plan uses the index" became
`DB-21` — existence in `pg_indexes` plus a manual `explain` during migration verification. A
pinned query plan is a flake waiting for the first statistics change.

## Rollout

1. **2A** — migration (index + `weekly_ranking` + two RPCs + view + grants). Verify privileges
   against the live database and record the result in the migration header.
2. **2B** — endpoint. Reachable only by calling `?window=weekly` directly; nothing in the UI
   changes.
3. **2C** — UI with `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` **unset** (OFF). Still nothing changes
   for players.
4. Confirm `NEXT_PUBLIC_ATTEMPT_LANE_ENABLED` is ON and `NEXT_PUBLIC_CHESSCITO_MODE` is
   explicitly set on **both** projects. Weekly must not be enabled while the attempt lane is off.
5. Probe both deployments' `?window=weekly` after a full UTC week of attempt data.
6. Flip the flag on both projects and **redeploy** (`NEXT_PUBLIC_*` are build-time).

**Rollback**: unset the flag and redeploy. This feature writes no data, so there is nothing to
undo in the database; 2A's rollback script drops the three functions, the view and the index.

## Out of scope / future

- Hardening the on-chain rail, after which weekly could absorb `scores` and gain the seal.
- Season/monthly windows — `weekly_ranking` already takes an arbitrary window.
- Rewards tied to weekly placement.
- A visible reset countdown (`weekStart`/`weekEnd` are already in the response).
- Surface-scoping the all-time tab.

## Revision log

**r1 (2026-07-29)** — first rewrite over `score_attempts`. Red-team round 1: 4 P0 + 1 unstated
dependency, 6 P1.

**r2** — closed all of them: wallet lowercasing, top-10 cut with uncut player rank,
`NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`, fail-closed surface resolution, attempt-lane dependency
declared; plus the `(surface, created_at)` index, the single `weekly_ranking` relation, per-tab
fetch state, the optimistic-row lifecycle, the missing ACs, `force-dynamic`, and
`security_invoker = true`.

**r2.1** — red-team round 2 found two P0 *introduced by r2's own fixes*, both closed: `toApiRow`
would have emitted `hasOnchain: false` on weekly rows (a present field making the exact claim the
asymmetry forbids) and returns its identity column under a different name → weekly gets its own
mapper; and r2's optimistic-clear rule compared a single exercise's score against a per-player
total → reverted to the `rowId`-presence check already in the component. Plus four round-2 P1s:
resolve the surface *inside* the weekly branch, the fallback view's second `at time zone 'utc'`,
`achieved_at`'s two-level aggregation, and the index AC.

**r3 (split)** — the spec had reached 695 lines, past the point where one spec is one deliverable.
Split into 2A/2B/2C with per-slice contracts and this traceability matrix. Formula, week
definition, surface split, off-chain asymmetry and the UI state table are unchanged from r2.1 —
the split moved text, it did not renegotiate anything.

## Open questions

- **Does the weekly tab need a visible reset countdown?** Cheap to add, but it is a product call,
  and the Focus Days card already taught that three numbers in one row at 390px is a layout risk.
- **`/arena?sheet=leaderboard` will show a Play-only weekly board.** That follows from D2 and is
  believed correct, but Arena has never had a board that excluded Learn play — worth one look
  before flipping the flag.
- **Should the all-time tab eventually be surface-scoped too?** Leaving it mixed means the two tabs
  differ in two dimensions at once (time *and* population). Deliberate for now.
