# Red Team Review — leaders-weekly-window (Slice 2)

**Date**: 2026-07-27
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `docs/specs/2026-07-27-leaders-weekly-window.md`

---

## Findings

### P0 — Must address before implementation

#### P0-1 · [premise] `created_at` does not mean "played this week". The whole slice is built on a timestamp that means something else.

**Evidence, verified in code (not inferred):**

- `apps/web/src/app/api/scores/save/route.ts:191-192` —
  `const gameId = String(score); const saveId = deriveScoreSaveId(wallet, levelId, gameId);`
- `apps/web/supabase/migrations/20260609000000_score_saves_init.sql:54` —
  `save_id text not null unique`
- `apps/web/src/lib/scores/save-client.ts:123-127` states the intent outright:
  *"re-saving the same score is idempotent (`duplicate`), a higher score is a fresh row"*.

So a row in `score_saves` exists **once per `(wallet, level_id, score)` ever achieved**,
and `created_at` is *the first time that exact score was reached on that level* — not
when the player played, and not when they last played.

**Three consequences that break the feature's stated goal:**

1. **A player at their ceiling can never appear in the weekly board again.** Once they
   have banked their best score on each of the 6 levels, no further play produces a row
   (every result is either lower — a new row only if that exact lower value was never
   scored before — or equal — `duplicate`, no row). They play all week and rank nowhere.
   The weekly board would systematically show *newcomers only*.
2. **The ranking is non-monotonic in skill.** Repeating your personal best writes
   nothing, so it does not enter the window. Scoring *worse* than your best, at a value
   you never happened to hit before, **does** write a row and **does** enter the window.
   Playing better can score you zero for the week while playing worse scores you points.
3. **R3 survives the fix meant to kill it.** The audit's complaint is that the score
   measures inventory. Windowing it by `created_at` measures *newly acquired inventory*
   — still inventory, now with a structural penalty for having acquired it earlier.
   The weekly board is a proxy for "how new are you".

**Why blocking:** the spec's Goal ("recent play is what ranks") is not achievable from
this table as written. Every acceptance criterion about the window would pass while the
feature fails at its purpose — the worst possible outcome, because tests would certify it.

**This inverts the slice order.** Slice 3 (attempt identity — a row per attempt, with
`attemptIndex`/`hintsUsed`) is not a follow-up to Slice 2; it is its **precondition**.
The audit already called Slice 3 "the only structural hole"; this finding says the hole
is load-bearing for Slice 2.

**Options, cheapest first — needs a founder decision, not an engineering pick:**

- **(a) Rename the feature to what the data supports.** The tab becomes *"New this
  week"* — new personal bests set since Monday. Honest, ships as specified, and is
  genuinely interesting for players still climbing. Does **not** fix R3, and still
  leaves veterans permanently absent.
- **(b) Do Slice 3 first**, then Slice 2 on top. Add a per-attempt row (append-only,
  `save_id` gains an attempt component), which makes `created_at` mean "played". This is
  the only option where the weekly board means what the spec says. Cost: touches the
  write path closed three commits ago, and changes row volume from bounded (≤ 6 ×
  distinct scores) to unbounded (one per attempt) — needs a retention answer.
- **(c) Build weekly on a different signal entirely** — `focus_day_ledger` already
  records "this wallet was active on this UTC date" and is server-authored. A weekly
  board of *days shown up* measures consistency, not inventory, and needs no write-path
  change. It is a different product than a score ranking, and it collides conceptually
  with Focus Days 21-in-30.

**Recommendation: (b), or (a) explicitly labelled as a stopgap.** Shipping (a) while
*calling* it a weekly performance ranking is the one outcome to avoid.

#### P0-2 · [scope] The rankable catalogue is 6 levels, not 59 exercises — the ceiling in P0-1 is reached fast.

`score_saves.level_id int not null check (level_id between 1 and 6)`
(`20260609000000_score_saves_init.sql:60`).

The spec talks about the catalogue being finite as the *reason* ties are the expected
state, but never states how small it is. Six levels means the "player at their ceiling"
of P0-1 is not a distant edge case — it is the expected end state of any engaged
player, reachable in a handful of sessions. Whatever option is picked for P0-1 must be
evaluated against 6, not against 59.

**Before implementing, measure it** against the 132 production rows: how many distinct
wallets have rows in the last 7 / 30 days, and what fraction of wallets have already hit
their per-level max. If the answer is "almost all of them", option (a) is not viable
either.

---

### P1 — Should address

#### P1-1 · [contract] `hasOnchain?: boolean` cannot express "not applicable"

In the weekly window the spec says the field is always absent. But `LeaderboardRow`
declares it optional, and today's client reads `row.hasOnchain &&` (leaderboard-sheet
`:339`) — absent and `false` render identically. A future reader cannot distinguish "we
know this player has no on-chain score" from "this window does not model on-chain at
all", and will eventually write a migration or a stat on that confusion.

**Fix:** discriminate the row by window in the type, so weekly rows have no such field
to misread:

```ts
type WeeklyRow  = Omit<LeaderboardRow, "hasOnchain">;
type AllTimeRow = LeaderboardRow;
type LeaderboardResponse =
  | { window: "weekly";  rows: WeeklyRow[];  player: WeeklyRow | null;  weekStart: string; weekEnd: string }
  | { window: "alltime"; rows: AllTimeRow[]; player: AllTimeRow | null };
```

This also makes `weekStart`/`weekEnd` non-optional exactly where they exist, instead of
optional everywhere and present sometimes.

#### P1-2 · [divergence] The fallback view computes its own week — two definitions of "now"

The spec passes the window as an RPC parameter (good: testable) but has the fallback
view derive the current week internally via `date_trunc`. That is **two independent
definitions of the same window** in the same request path, which is precisely what the
existing rule in `queries.ts:117` ("the fallback must hit the SAME source so the two
never diverge") exists to prevent. At 23:59:59 Sunday the RPC and the fallback can
disagree about which week you are in.

**Fix:** the fallback must select from a view that takes the same bounds — i.e. filter
in the query (`.gte("created_at", start).lt("created_at", end)`), not inside the view.

#### P1-3 · [state] `hasFetched` is a single ref; two tabs need two

`leaderboard-sheet.tsx:86` has one `hasFetched` ref and one `rows`/`ownRow`/`error`
state. Behavior 8 ("already-fetched tabs render from state without a refetch") requires
per-window state. Implemented naively, switching tabs will show the previous window's
rows under the new window's header for one frame — a wrong leaderboard, briefly, which
players screenshot.

**Fix:** key the cache by window; render the empty/loading state for a window that has
no data yet rather than the other window's rows.

#### P1-4 · [state] The optimistic row is a footgun in weekly

`getOptimisticScore()` (`:29`) appends a synthetic row when the player's row is missing
from the response. In weekly, missing is the *normal* state (Behavior 6), so the
optimistic entry would fabricate a rank for exactly the players the CTA footer is meant
to address. The spec says weekly ignores it — that needs an explicit test, because
`applyRows` is shared by both windows and the natural refactor keeps it shared.

#### P1-5 · [tiebreak] `MAX(achieved_at)` interacts badly with P0-1's dedup

Given the dedup, a player's `total_achieved_at` is the timestamp of their most recent
*new* best. Two players tied on total are ordered by who completed their set first —
which the spec argues is fair. But under P0-1 the set is "scores never before achieved",
so the tiebreaker inherits the same distortion: a veteran who re-earns nothing has no
`achieved_at` in the window at all. The tiebreaker is only as meaningful as the fix
chosen for P0-1; do not implement it before that decision.

---

### P2 — Nice to clarify

- **[sql] `date_trunc('week', …)` and session TimeZone.** On a `timestamptz`,
  `date_trunc` truncates in the session's time zone. `date_trunc('week', now() at time
  zone 'utc')` yields a `timestamp` (no zone) — comparing it to a `timestamptz` column
  re-introduces the session zone. Write the bound explicitly as UTC and assert it in the
  migration's own smoke test (there is precedent: `supabase/tests/leaderboard_combined_smoke.sql`).
- **[ux] Score drops when switching tabs, with no explanation.** Weekly excludes
  on-chain scores (deliberate asymmetry). A player whose scores are largely on-chain
  sees a much smaller number in the default tab and no reason why. The spec documents
  the asymmetry for us; it says nothing about explaining it to them.
- **[ux] No reset countdown** — listed as an open question in the spec. Worth resolving
  before build, since "weekly" is meaningless to a player who cannot see when it ends.
- **[perf] No index supports the weekly filter on its own.**
  `idx_score_saves_surface_created` is `(surface, created_at desc)` — leading column
  `surface`, which the weekly query does not filter on. At 132 rows this is irrelevant;
  it will not stay 132 rows if P0-1 is fixed via option (b), which multiplies row count
  by attempts. Note it now.
- **[ops] No rollback note.** The migration is additive (new view + 2 functions), so
  rollback is a `drop`. Slice 0 shipped DEPLOY/VERIFY/ROLLBACK scripts and the order
  `SQL → VERIFY → push`; Slice 2 should follow the same pattern rather than reinvent it.

---

## Categories audited

**Contract gaps** — `LeaderboardWindow` is a closed union and validated (400 on unknown,
good). `hasOnchain` optionality is the one real hole (P1-1). No `any`/`unknown` smells.
Error modes: the spec covers RPC failure and fetch failure; it does not define what the
client shows when *one* tab errors and the other is fine (P1-3 territory).

**Behavioral ambiguity** — Behavior 9 says all-time is "marked stale and refetches on
next activation" but no state models staleness; that is an invented field the spec does
not declare. Behavior 10 (week rollover mid-session) is well specified.

**Hidden assumptions** — the load-bearing one is P0-1. Second: the spec assumes
`created_at` is populated by the DB default; verified true (`not null default now()`).
Third: it assumes Postgres weeks start Monday; true, but zone-sensitive (P2).

**Backward compatibility** — genuinely preserved: no-param and `?player=` shapes are
byte-identical, and the criteria assert it. Additive migration, no data mutation, no
backfill. Good.

**Security & data** — no new PII surface: `player` still never leaves the server except
as the caller's own `walletShort`. No new write path. The deliberate off-chain-only
choice *improves* the security posture. No rate limit is specified for the new query
shape, but it is a read of a bounded view.

**Test coverage gaps** — the criteria are testable and boundary cases are covered
(`week_start` in / `week_end` out). Missing: a test that a **veteran who plays all week
produces no weekly rows** — i.e. a test that would have caught P0-1. Any spec revision
must include that case, precisely because it is the failure the current design hides.

**Operational readiness** — no logging specified for weekly RPC failures (Slice 0 logs
`origin_bypass_triggered`; same treatment warranted). Rollback trivially a `drop`, but
should ship as a script (P2).

---

## Verdict

**NEEDS REVISION.**

P0 findings: **2**
P1 findings: **5**
P2 findings: **5**

P0-1 is not a detail to patch during implementation — it decides whether this feature is
built at all, built under a different name, or built after Slice 3. The spec is
internally coherent and its criteria would all pass; that is exactly why it must not go
to `/tdd` before the founder picks (a), (b), or (c).

Everything below P0 is ordinary spec work and can be folded into the revision once the
premise is settled.
