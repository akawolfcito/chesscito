# Spec — leaders-weekly · Slice 2B: API

**Date**: 2026-07-29
**Status**: ✅ READY for `/tdd` — **after** Slice 2A (DB) is merged
**Parent**: `2026-07-29-leaders-weekly-window-v2.md` — the source of truth for D1–D5, the week
definition, the off-chain asymmetry and the traceability matrix.
**Depends on**: `2026-07-29-leaders-weekly-db.md` (the two RPCs and the fallback view must
exist; §Contract received restates their shape, it does not redefine it).
**TDD order**: DB → **API (this)** → UI

## Scope

1. `src/lib/leaderboard/week-window.ts` — pure `currentWeekWindow(now)`.
2. `requireDeploymentSurface()` in `src/lib/scores/deployment-surface.ts` — read path,
   fail-closed.
3. Wallet lowercasing before the query.
4. `toWeeklyApiRow` — a weekly-only row mapper.
5. `fetchWeeklyLeaderboard` / `fetchWeeklyPlayerRank` in `src/lib/server/leaderboard.ts`.
6. `src/lib/supabase/queries.ts` — the weekly RPC-then-view fallback.
7. `src/app/api/leaderboard/route.ts` — the `window` parameter, the response shapes, the 400 and
   the 500.

## Not in scope

- Any component or copy. The sheet, the tabs, the flag's UI effect — Slice 2C.
- `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`. **The route ignores it entirely** (parent D4): the flag
  gates the UI so prod can be probed before rollout. This slice must not read it.
- Changing the all-time path. `fetchLeaderboard`, `fetchPlayerRank`, `toApiRow` and
  `resolveDeploymentSurface` keep their current behavior byte-for-byte.
- Any SQL. If a query needs a shape the DB slice did not provide, that is a 2A bug, not a 2B
  workaround.

## Contract received (from Slice 2A)

```sql
get_weekly_leaderboard(p_surface text, p_week_start timestamptz, p_week_end timestamptz)
get_weekly_player_rank(p_player text, p_surface text, p_week_start timestamptz, p_week_end timestamptz)
-- both → (wallet text, total_score int, rank int, is_verified boolean)

leaderboard_weekly_full_v (surface, wallet, total_score, rank, is_verified)
-- current UTC week only, no parameters, filter with .eq("surface", …)
```

Two properties of that contract are **this slice's responsibility to uphold**, because the SQL
fails silently on both:

- `p_player` must arrive **lowercased**. A mixed-case wallet matches zero rows.
- `p_surface` must arrive **explicitly resolved**. A bad value returns zero rows.

The identity column is `wallet`, not `player`, and there is **no** `has_onchain` column.

## Contract provided to Slice 2C (UI)

```ts
export type LeaderboardWindow = "weekly" | "alltime";

export type LeaderboardResponse = {
  window: LeaderboardWindow;
  rows: LeaderboardRow[];            // top 10
  player: LeaderboardRow | null;     // ranked over the UNCUT set; null = no play this window
  weekStart?: string;                // weekly only, ISO 8601 UTC
  weekEnd?: string;                  // weekly only, ISO 8601 UTC
  surface?: ScoreSaveSurface;        // REQUIRED on weekly, absent on alltime
};
```

`LeaderboardRow` keeps its current shape. On a weekly row, `hasOnchain` is **absent** — the
property is not present at all, so `"hasOnchain" in row === false`.

| Request | Response |
|---|---|
| `/api/leaderboard` | `LeaderboardRow[]` — legacy array, unchanged |
| `/api/leaderboard?player=0x…` | `{ rows, player }` — unchanged |
| `/api/leaderboard?window=weekly[&player=…]` | `LeaderboardResponse` |
| `/api/leaderboard?window=alltime[&player=…]` | `LeaderboardResponse` |
| `?window=<anything else>`, including `?window=` | `400` |
| `?window=weekly` with an unresolved surface | `500` |

## Design

### Week module — `src/lib/leaderboard/week-window.ts`

```ts
/** Half-open UTC week window. `end` is exclusive. */
export type WeekWindow = { start: Date; end: Date };

/** Pure. No clock access — `now` is always injected, so boundary cases are
 *  testable without mocking time in Postgres or in the runner. */
export function currentWeekWindow(now: Date): WeekWindow;
```

`start` = Monday 00:00:00.000 UTC at or before `now`; `end` = `start` + 7 days. See the parent
for why the interval is half-open.

### Surface resolution — fail-closed (parent D5)

```ts
/** Thrown when the deployment does not declare which product it is. */
export class UnresolvedSurfaceError extends Error {}

/** Existing helper. UNCHANGED — the WRITE path keeps its `learn` fallback,
 *  which is self-consistent there (rows are written and read as `learn`). */
export function resolveDeploymentSurface(): ScoreSaveSurface;

/** New. READ path only. Accepts an EXPLICIT `learn`, `play` or `full`
 *  (internal, documented to mean `learn`). Anything else — unset, empty,
 *  a typo — throws. */
export function requireDeploymentSurface(): ScoreSaveSurface;
```

A silent `learn` fallback on the read path would render **Learn's** board to Play players:
correctly ranked, correctly labelled, wholly wrong. Reads the env at **call** time, like every
other gate in this codebase.

**`requireDeploymentSurface()` is called inside the weekly branch, never at the top of the
handler.** Resolving it before branching on `window` is the natural way to write the handler and
it would make an unset mode return 500 for the *legacy* requests too — breaking the backward
compatibility this slice treats as non-negotiable.

### Wallet lowercasing

`score_attempts.wallet` is `check (wallet ~ '^0x[0-9a-f]{40}$')` — lowercase only. The sheet
sends the wagmi address raw (`leaderboard-sheet.tsx:128`), and wagmi's `address` is EIP-55
**checksummed**. Un-normalised, `?player=0xAbC…` matches zero rows and the endpoint answers
`player: null` — a *specified, valid* state here (parent behavior 9), so the bug is
indistinguishable from correct behavior and invisible to fixtures, which the table constraint
forces lowercase. `fetchWeeklyPlayerRank` lowercases **before** the query.

### Weekly row mapper — `toApiRow` cannot be reused

Two independent reasons, both at `lib/server/leaderboard.ts:28-42`:

1. It writes `hasOnchain: r.has_onchain ?? false`. A weekly row has no such column, so the
   coalesce emits a **present** field claiming "this player has no on-chain score" — exactly the
   claim the parent's asymmetry forbids. And `false` passes every falsy assertion.
2. It reads `r.player`, while the weekly relations return `wallet`. A silent `undefined` would
   flow into `deriveRowId`.

```ts
/** Weekly rows only. Same rowId/variant/walletShort derivations as toApiRow
 *  (wallets never leave the server), isVerified preserved, and hasOnchain
 *  NEVER assigned — absent, not false. */
function toWeeklyApiRow(r: WeeklyDbRow, opts?: { own?: boolean }): LeaderboardRow;
```

### Fallback — `queries.ts`

Mirrors the existing RPC-then-view pattern (`queries.ts:114-150`): try the RPC, and on error
read `leaderboard_weekly_full_v` **filtered by the same surface**. The view is always the
current week, so the fallback is only valid for a current-week request — which is the only kind
the route makes.

### Route

Stays `export const dynamic = "force-dynamic"`. It must not become cacheable: a CDN-cached
weekly board would keep serving last week after the Monday reset.

`window` handling: absent → legacy all-time path, untouched. `"weekly"` / `"alltime"` →
`LeaderboardResponse`. Anything else, including the empty string, → 400 (never a silent
fallback to all-time, which would hide a client typo behind a plausible board).

## Acceptance criteria

Week module
- [ ] **API-1** `currentWeekWindow` returns Monday 00:00:00.000 UTC for: a Monday at 00:00:00, a
      Monday at 23:59:59, a Sunday at 23:59:59 (→ previous Monday), across a year boundary, and
      during a DST change in a non-UTC local timezone.
- [ ] **API-2** `currentWeekWindow(now).end` is exactly 7 days after `.start`.

Wallet case
- [ ] **API-3** A **checksummed** EIP-55 address returns the player's real row, identical to the
      one a lowercase address returns.
- [ ] **API-4** A mixed-case address does not silently produce `player: null`.

Surface resolution (parent D2, D5)
- [ ] **API-5** A `surface` query parameter is ignored — the response `surface` always equals the
      deployment's.
- [ ] **API-6** `NEXT_PUBLIC_CHESSCITO_MODE` unset ⇒ `?window=weekly` answers **500**, while
      `/api/leaderboard` and `?player=` still answer 200.
- [ ] **API-7** An unrecognised mode value ⇒ 500, not a `learn` board.
- [ ] **API-8** `full` ⇒ a `learn`-scoped board, and the response says `surface: "learn"`.

Endpoint
- [ ] **API-9** With `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` OFF (and unset),
      `GET /api/leaderboard?window=weekly` still returns a `LeaderboardResponse`.
- [ ] **API-10** `GET /api/leaderboard` (no params) returns the identical body it returned before
      this slice — asserted against the legacy array shape.
- [ ] **API-11** `GET /api/leaderboard?player=0x…` still returns `{rows, player}`.
- [ ] **API-12** `?window=weekly` never returns `hasOnchain` on any row, even for a player with
      rows in `scores` — asserted with `"hasOnchain" in row === false`, **not** with a falsy
      check, which `false` would pass.
- [ ] **API-13** `?window=alltime` returns `has_onchain` unchanged and applies no surface filter.
- [ ] **API-14** `?window=` (empty) and `?window=monthly` both return 400.
- [ ] **API-15** The weekly RPC failing falls back to the view **filtered by the same surface**,
      producing the same rows and the same ranks.
- [ ] **API-16** The route still exports `dynamic = "force-dynamic"`.

## Definition of done

- All 16 ACs green, written before the implementation.
- No component file touched.
- `toApiRow`, `fetchLeaderboard`, `fetchPlayerRank` and `resolveDeploymentSurface` are
  byte-identical to their pre-slice versions; API-10/11/13 are the guards that prove it.
- The route reads no feature flag.
- `pnpm exec tsc --noEmit` clean.
