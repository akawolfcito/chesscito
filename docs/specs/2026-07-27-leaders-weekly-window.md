# Spec — leaders-weekly-window (Slice 2)

**Date**: 2026-07-27
**Status**: ⛔ BLOCKED — do not send to `/tdd`
**Audit**: `docs/product/2026-07-27-score-and-leaders-audit.md` (R3, R4)
**Depends on**: Slice 0 (`d7691e31`, `ab1170af`, `87e35e35`) — the hardened write path.
**Blocked by**: **Slice 3 (attempt identity)**, per red-team P0-1 + founder decision
2026-07-27.

> **Why this spec is blocked.** `save_id` is `wallet:levelId:score` and UNIQUE
> (`api/scores/save/route.ts:191`), so `score_saves` holds one row per *distinct score
> ever achieved* and `created_at` means "first time that exact score was reached" — not
> "played this week". A player at their ceiling (there are **6** levels) never writes
> another row, and repeating a personal best writes nothing while scoring *worse* can
> write a row. Every acceptance criterion below would pass while the feature failed its
> goal. Full reasoning: `2026-07-27-leaders-weekly-window-redteam.md` P0-1/P0-2.
>
> **Decision (founder, 2026-07-27): build Slice 3 first**, so a row exists per attempt
> and `created_at` means "played". Then revise this spec on top of it — the window
> definition, the tiebreak semantics, the off-chain-only asymmetry and the UI states
> below all survive that change; what changes is the source rows they read.

## Problem

Leaders today is a single all-time ranking: `Σ (best score per level) × 100`, over the
union of `scores` (on-chain) and `score_saves` (off-chain), ordered
`total_score DESC, player ASC`. Two consequences, both measured in the audit:

- **R3 — the score measures inventory, not performance.** It is a function of one
  variable: how many exercises you have ever saved. A player who joined today cannot
  reach the head of the table no matter how well they play, because the catalogue is
  finite and the veterans have already banked it.
- **R4 — the real tiebreaker is the wallet address.** Because a finite catalogue makes
  ties the *expected* state rather than the exception, `player ASC` is what actually
  orders the top of the board. The head of Leaders is, in practice, an alphabetical
  list of hex strings.

A weekly window fixes both without inventing new metrics: it resets the denominator so
recent play is what ranks, and it gives the tiebreaker a meaning (who got there first).

## Goal

Leaders shows a **weekly ranking by default**, computed from the hardened off-chain
write path, with the all-time ranking still reachable from a selector.

## Non-goals

- **Not** hardening `/api/sign-score` or `/api/cache-score`. They keep the R1 defect
  (see §Deliberate asymmetry). Slice 2 does not grow to cover them.
- **Not** changing the score *formula*. `Σ (best per level) × 100` stays. Only the time
  range and the tiebreaker change.
- **Not** attempt identity (`attemptIndex`, `hintsUsed`) — that is Slice 3.
- **Not** rewards, prizes, or season resets tied to the weekly window.
- **Not** per-surface split (learn vs play). `surface` is recorded but the aggregate
  still mixes both (R12 mitigated, not closed).

## Deliberate asymmetry — weekly is off-chain only

The weekly table reads **`score_saves` only**. The all-time table keeps the current
union of `scores` + `score_saves` and keeps the `has_onchain` seal.

**Why** (founder, 2026-07-27): the off-chain rail now requires a server-issued,
signature-authorized, revocable write session (Slice 0). The on-chain rail does not —
`/api/sign-score` signs any `levelId` it is asked to, and `/api/cache-score` still takes
`player` from the body. Gas cost slows abuse; it does not close it. A new ranking must
not be born carrying the defect we just spent a slice removing.

**Consequences, accepted:**
- The weekly tab shows **no on-chain seal** on any row. The marker is not "off", it is
  *not applicable* to that window.
- The two tabs are not arithmetically comparable. A player's weekly total is not a
  subset of their all-time total when any of their scores came through the contract.
- This is **temporary**. When the proof rail is hardened, weekly absorbs `scores` and
  the seal appears. Until then it is documented here, not discovered later.

## Week definition

One shared calendar window, UTC, no per-player timezone and no rolling window:

```
week_start = Monday 00:00:00 UTC
week_end   = the following Monday 00:00:00 UTC   (exclusive)

included ⟺ created_at >= week_start AND created_at < week_end
```

Half-open on purpose: a save written at exactly `00:00:00.000` on Monday belongs to the
new week and to exactly one week. The UI may localize how the date is *displayed*; the
computation and the reset stay in UTC.

## Contracts (SDD)

### Pure week module — `src/lib/leaderboard/week-window.ts`

```ts
/** Half-open UTC week window. `end` is exclusive. */
export type WeekWindow = {
  /** Monday 00:00:00.000 UTC, at or before `now`. */
  start: Date;
  /** The following Monday 00:00:00.000 UTC. Exclusive bound. */
  end: Date;
};

/** Pure. No clock access — `now` is always injected, so boundary cases are
 *  testable without mocking time in Postgres or in the test runner. */
export function currentWeekWindow(now: Date): WeekWindow;
```

### API surface

```ts
/** Which ranking a request wants. Absent = "alltime" for backward
 *  compatibility: the pre-Slice-2 endpoint had no param and returned
 *  the all-time board. */
export type LeaderboardWindow = "weekly" | "alltime";

/** Unchanged for alltime. In weekly, `hasOnchain` is ALWAYS absent —
 *  see "Deliberate asymmetry". */
export type LeaderboardRow = {
  rank: number;
  rowId: string;
  variant: AvatarVariant;
  score: number;
  isVerified?: boolean;
  hasOnchain?: boolean;
  walletShort?: string;
};

export type LeaderboardResponse = {
  window: LeaderboardWindow;
  rows: LeaderboardRow[];
  /** The caller's own row, or null when they have no rows IN THIS WINDOW.
   *  Null in weekly is the normal state for someone who has not played
   *  since Monday — it is not an error and not a zero. */
  player: LeaderboardRow | null;
  /** Only on weekly. ISO 8601 UTC. Lets the client label the window and
   *  know when the board resets without re-deriving the week itself. */
  weekStart?: string;
  weekEnd?: string;
};
```

`GET /api/leaderboard` request shapes:

| Request | Response |
|---|---|
| `/api/leaderboard` | `LeaderboardRow[]` — **legacy array, unchanged** |
| `/api/leaderboard?player=0x…` | `{ rows, player }` — unchanged |
| `/api/leaderboard?window=weekly` | `LeaderboardResponse` |
| `/api/leaderboard?window=weekly&player=0x…` | `LeaderboardResponse` with `player` |
| `/api/leaderboard?window=alltime[&player=…]` | `LeaderboardResponse` |

Legacy shapes are preserved byte-for-byte: a client that never sends `window` cannot
tell Slice 2 shipped.

### SQL — additive migration

No table changes, no columns, no backfill. `score_saves.created_at` already exists and
is `not null default now()`. What is added:

```sql
create view public.leaderboard_weekly_full_v  -- parameterless: current UTC week
create function public.get_weekly_leaderboard(p_week_start timestamptz,
                                              p_week_end   timestamptz)
create function public.get_weekly_player_rank(p_player     text,
                                              p_week_start timestamptz,
                                              p_week_end   timestamptz)
```

The window is a **parameter**, not `now()` inside the function, so a boundary test can
ask for any week without moving the database clock. The view exists only as the
fallback path (mirroring `queries.ts`'s existing RPC-then-view pattern) and computes the
current week via `date_trunc('week', now() at time zone 'utc')`, which in Postgres is
Monday.

Ranking expression:

```sql
rank() over (
  order by total_score desc,
           total_achieved_at asc,   -- R4: who got there first
           player asc               -- last resort, keeps rank deterministic
)
```

where, per player:

```
best_score(level)       = max(score)                        over that player+level, in window
achieved_at(level)      = min(created_at) among rows whose score = best_score(level)
total_score             = sum(best_score(level))
total_achieved_at       = max(achieved_at(level))           -- the moment the total was completed
```

`total_achieved_at` is the instant the player *finished assembling* their total, so
between two equal totals the earlier one wins. `min(created_at)` at the level step means
that re-saving the same best score later does not push a player down.

## Behavior

1. Given a request without `window`, when the endpoint responds, then the body is the
   pre-Slice-2 shape (array, or `{rows, player}`) computed all-time — unchanged.
2. Given `window=weekly`, when the endpoint responds, then rows are ranked over
   `score_saves` rows with `created_at` in the current UTC week only.
3. Given `window=weekly`, then no row carries `hasOnchain`, regardless of the player
   having on-chain scores.
4. Given `window=alltime`, then the ranking is the current union of `scores` +
   `score_saves`, with `has_onchain` intact.
5. Given two players tied on `total_score` in the weekly window, when ranked, then the
   one whose `total_achieved_at` is earlier ranks higher.
6. Given a player with no `score_saves` in the current week, when they request weekly
   with `player=`, then `player` is `null` (not a zero-score row, not a last place).
7. Given the sheet opens, when no tab was chosen, then the **weekly** tab is active.
8. Given the player switches tabs, when the other tab has not been fetched yet, then it
   fetches once; already-fetched tabs render from state without a refetch.
9. Given a successful score save while the sheet is open (`refreshTrigger`), when the
   active tab is weekly, then weekly refetches; the all-time tab is marked stale and
   refetches on next activation.
10. Given the week rolls over while a client is open, when the next fetch returns a
    different `weekStart`, then the client replaces its rows rather than merging.
11. Given a save is written at `week_end` exactly, then it belongs to the NEXT week
    (half-open interval).
12. Given the weekly RPC errors, when the fallback view is queried, then it must read
    the same source, so the two can never diverge (existing rule, `queries.ts:117`).

## UI states and transitions

Per CLAUDE.md, every state is enumerated with its transition.

| State | Weekly tab | All-time tab |
|---|---|---|
| Loading, first open | skeleton (existing) | skeleton |
| Loaded, rows > 0 | ranked list; hero band shows champion + count | unchanged from today |
| Loaded, rows = 0 (fresh Monday) | empty state: no champion; hero shows `heroEmptyHeadline`/`heroEmptyHint` | today's empty state |
| Fetch error | error + retry (existing), scoped to the tab that failed | idem |
| Own row exists in window | pinned `YOUR RANK` footer (existing) | unchanged |
| **Own row absent in window** | footer becomes a **CTA**, no rank | n/a — all-time keeps today's behavior |
| Wallet not connected | no footer (no `player` param sent) | unchanged |
| Save-on-chain pending | CTA footer variant (existing `canSaveOnChain`) — **all-time tab only**, since weekly has no on-chain concept | unchanged |

**Footer CTA (weekly, no activity this week).** Keeps the same height as the rank
footer so switching tabs does not jump the layout. Taps into the existing training
flow (same destination as the empty-state button). Copy:

```
EN:  PLAY TO JOIN THIS WEEK
     Complete an exercise to enter the weekly ranking.
ES:  JUEGA PARA ENTRAR ESTA SEMANA
     Completa un ejercicio para aparecer en el ranking semanal.
```

**Transitions:**
- weekly → all-time: tab click. Fetches once, then cached in component state.
- no-activity → ranked: after a save lands, `refreshTrigger` fires; the CTA footer is
  replaced by the rank footer in the same render pass.
- week rollover with the sheet open: `weekStart` changes → rows replaced, own row
  becomes `null`, footer falls back to the CTA.

## Edge cases

- **Tie on both score and `total_achieved_at`** (same millisecond): falls through to
  `player ASC`. Vanishingly rare, but `rank()` must stay deterministic across calls or
  pagination would flicker.
- **`created_at` NULL**: impossible in `score_saves` (`not null default now()`), so a
  NULL row cannot silently vanish from the window. Verified against
  `20260609000000_score_saves_init.sql`. No defensive coalesce — inventing a timestamp
  would manufacture provenance, the same reasoning that left `surface` nullable.
- **Pre-Slice-0 rows** (132 rows, `surface = NULL`): they are old enough that they fall
  outside the current week and simply do not appear in weekly. They keep counting
  all-time. No backfill.
- **Optimistic row** (`chesscito:optimistic-score`, sessionStorage): today it is appended
  when the player's row is missing from the response. In weekly that heuristic is wrong —
  an absent own row is the *expected* state, so a stale optimistic entry would fabricate
  a rank. Weekly ignores the optimistic row; all-time keeps today's behavior.
- **Clock skew between app server and Postgres**: the window is computed in TS and passed
  as a parameter, so one clock decides. The fallback view computes its own `now()` — a
  divergence there is bounded by seconds and only at the boundary.
- **Empty week for everyone** (Monday 00:01): weekly returns zero rows. The hero band
  must not render a champion; `rows.length === 0` already drives that.
- **Score of 0**: not writable (`score > 0` enforced server-side), so a 0-point row
  cannot enter the ranking.
- **`bigint` totals**: weekly sums are strictly smaller than all-time, so R13's overflow
  cannot be reintroduced. The RPC still returns `bigint` for shape consistency.

## Acceptance criteria

- [ ] `currentWeekWindow` returns Monday 00:00:00.000 UTC for: a Monday at 00:00:00, a
      Monday at 23:59:59, a Sunday at 23:59:59 (→ previous Monday), and across a
      year boundary and a DST change in a non-UTC local timezone.
- [ ] `currentWeekWindow(now).end` is exactly 7 days after `.start`.
- [ ] `GET /api/leaderboard` (no params) returns the identical body it returned before
      Slice 2 — asserted against the legacy array shape.
- [ ] `GET /api/leaderboard?player=0x…` still returns `{rows, player}`.
- [ ] `?window=weekly` ranks only rows inside the current UTC week.
- [ ] A save at `week_start` exactly is IN; a save at `week_end` exactly is OUT.
- [ ] `?window=weekly` never returns `hasOnchain` on any row, even for a player with
      rows in `scores`.
- [ ] `?window=alltime` returns `has_onchain` unchanged.
- [ ] Two tied players are ordered by earlier `total_achieved_at`.
- [ ] Re-saving the same best score later does NOT lower a player's rank.
- [ ] A player with no saves this week gets `player: null` in weekly and a real row in
      alltime.
- [ ] `?window=` with an unknown value is rejected (400) rather than silently treated
      as alltime.
- [ ] The sheet opens on the weekly tab.
- [ ] Switching tabs fetches the other window once; switching back does not refetch.
- [ ] With no weekly activity, the footer renders the CTA (EN + ES copy asserted) and
      not a rank.
- [ ] The CTA footer and the rank footer have the same height (no layout jump).
- [ ] `refreshTrigger` refetches the active tab.
- [ ] The weekly RPC failing falls back to a view reading the same source.
- [ ] Concurrency: N saves landing during a weekly read do not produce a duplicate or
      missing rank (tested against real Postgres, per the Slice 0 precedent).

## Out of scope / future

- Hardening the on-chain rail, after which weekly absorbs `scores` and gains the seal.
- Per-surface leaderboards (`surface` is already recorded).
- Season/monthly windows — the same parameterized RPC would serve them.
- Rewards tied to weekly placement.

## Open questions

- **Does the weekly tab need a visible reset countdown?** `weekStart`/`weekEnd` are in
  the response, so it is cheap. Not specified because it is a product call, and the
  Focus Days card already taught that three numbers in one row at 390px is a layout risk.
- **Does `/arena?sheet=leaderboard` default to weekly too?** Assumed yes (same
  component), flagged because Arena is Play and weekly mixes both surfaces.
