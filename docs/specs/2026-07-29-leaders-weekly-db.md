# Spec — leaders-weekly · Slice 2A: DB

**Date**: 2026-07-29
**Status**: ✅ READY for `/tdd` — first of three, no upstream dependency
**Parent**: `2026-07-29-leaders-weekly-window-v2.md` — the source of truth for D1–D5, the week
definition, the off-chain asymmetry and the traceability matrix. This file does not restate
them; it implements them.
**TDD order**: **DB (this) → API → UI**

## Scope

Everything that lives in Postgres, and nothing else:

1. Index `score_attempts_surface_created_idx`.
2. `weekly_ranking(p_surface, p_week_start, p_week_end)` — the single ranking relation.
3. `get_weekly_leaderboard(...)` — top-10 cut.
4. `get_weekly_player_rank(p_player, ...)` — one wallet, ranked over the uncut set.
5. `leaderboard_weekly_full_v` — the fallback view (`security_invoker = true`).
6. Grants and revokes for all of the above.
7. SQL smokes: privileges against a live database, non-UTC timezone, index existence,
   concurrency.

## Not in scope

- Any TypeScript. No `week-window.ts`, no route, no mapper — Slice 2B.
- Touching `score_attempts`, `score_saves`, `scores` or the all-time relations. This migration
  is **additive**: no table DDL, no columns, no backfill.
- The all-time path (`leaderboard_full_v`, `leaderboard_combined_v`, `get_leaderboard`,
  `get_player_rank`) — untouched.

## Contract received

None. This is the first slice; it depends only on what already exists in prod:

- `public.score_attempts` (`20260731000000_score_attempts.sql`) — one row per completed
  attempt. Columns this slice reads: `wallet` (lowercase-only,
  `check (wallet ~ '^0x[0-9a-f]{40}$')`), `surface` (`not null check in ('learn','play')`),
  `level_id` (`not null`, 1–6), `score` (`not null check (score > 0)`), `created_at`
  (`not null default now()`). RLS: deny-all for `anon`/`authenticated`.
- `public.passport_cache` — for `is_verified`, exactly as `leaderboard_full_v` uses it.

## Contract provided to Slice 2B (API)

```sql
-- Both RPCs return the same row shape. `wallet` is the identity column
-- (NOT `player` — the all-time relations use `player`, this one does not).
returns table (
  wallet      text,     -- lowercase, as stored
  total_score int,      -- Σ MAX(score) per level, NO multiplier
  rank        int,      -- over the uncut set in both functions
  is_verified boolean   -- from passport_cache, window-independent by design
)
-- has_onchain is NOT a column here. Absent, not false. (Parent §asymmetry.)

get_weekly_leaderboard(p_surface text, p_week_start timestamptz, p_week_end timestamptz)
get_weekly_player_rank(p_player text, p_surface text, p_week_start timestamptz, p_week_end timestamptz)

-- Fallback view, same columns plus a leading `surface` for .eq() filtering.
-- Always the CURRENT UTC week; takes no parameters.
leaderboard_weekly_full_v (surface, wallet, total_score, rank, is_verified)
```

The caller passes an **already-lowercased** `p_player` and an **explicitly resolved**
`p_surface`. Neither function normalises or defaults: a mixed-case wallet matches nothing and a
bad surface returns zero rows, both silently. Guarding that is 2B's job, specified there.

## Design

### The window and the surface are parameters

Never `now()` inside a function, and never an env read. A boundary test asks for any week and
any surface without moving the database clock. The **only** place `now()` appears is the
fallback view.

### One relation, three consumers

```sql
create index if not exists score_attempts_surface_created_idx
  on public.score_attempts (surface, created_at desc);

create function public.weekly_ranking(p_surface    text,
                                      p_week_start timestamptz,
                                      p_week_end   timestamptz)
  returns table (wallet text, total_score int, rank int, is_verified boolean)
  language sql stable;

create function public.get_weekly_leaderboard(p_surface text, p_week_start timestamptz, p_week_end timestamptz)
  -- select * from weekly_ranking(...) order by rank limit 10

create function public.get_weekly_player_rank(p_player text, p_surface text, p_week_start timestamptz, p_week_end timestamptz)
  -- select * from weekly_ranking(...) where wallet = p_player

create view public.leaderboard_weekly_full_v with (security_invoker = true) as
  select s.surface, r.*
  from (values ('learn'), ('play')) s(surface)
  cross join lateral public.weekly_ranking(
    s.surface,
    date_trunc('week', now() at time zone 'utc') at time zone 'utc',
    (date_trunc('week', now() at time zone 'utc') + interval '7 days') at time zone 'utc'
  ) r;
```

Three copies of one window function would drift on the first change, and the symptom is a
footer rank that disagrees with the list. The cut and the single-wallet lookup are both
`select … from weekly_ranking(...)`.

**The index**: the aggregate filters `surface = ? AND created_at >= ? AND created_at < ?`. The
existing `score_attempts_created_idx (created_at desc)` would force a per-row surface filter —
degrading exactly as the feature succeeds.

**The trailing `at time zone 'utc'` is load-bearing.** `now() at time zone 'utc'` yields a
`timestamp` *without* time zone; handing it to a `timestamptz` parameter casts it through the
database's `TimeZone` setting, so on a non-UTC server the whole window shifts. A test on a UTC
database cannot see this — hence AC DB-22.

### Ranking expression

```sql
rank() over (
  order by total_score       desc,
           total_achieved_at asc,   -- R4: who got there first
           wallet            asc    -- last resort, keeps rank deterministic
)
```

per wallet, over rows with the given `surface` and `created_at >= p_week_start and created_at
< p_week_end`:

```text
best_score(level)  = max(score)                      per (wallet, level_id)
achieved_at(level) = min(created_at) among the rows whose score = best_score(level)
total_score        = sum(best_score(level))          -- no multiplier (parent, scale note)
total_achieved_at  = max(achieved_at(level))         -- when the total was completed
```

`total_achieved_at` is not returned; it exists only to order rows.

**`achieved_at` needs two levels of aggregation.** `min(created_at) filter (where score =
max(score))` nests aggregates and is invalid. The shape is: aggregate to
`(wallet, level_id, best_score)`, then join back to the attempts and take
`min(created_at) where score = best_score`. A one-pass `min(created_at)` grouped by
`(wallet, level_id)` **compiles and is wrong** — it credits the player's first attempt on the
level, including a bad one. It changes tiebreak order without changing any total, so no
score-shaped assertion catches it.

### Privileges

Both revokes are required and each alone is useless: Postgres grants EXECUTE to PUBLIC by
default, **and** Supabase's default privileges also grant explicitly to
`anon`/`authenticated`.

```sql
revoke execute on function public.weekly_ranking(text, timestamptz, timestamptz)               from public, anon, authenticated;
revoke execute on function public.get_weekly_leaderboard(text, timestamptz, timestamptz)       from public, anon, authenticated;
revoke execute on function public.get_weekly_player_rank(text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke select   on public.leaderboard_weekly_full_v                                            from public, anon, authenticated;

grant execute on function public.weekly_ranking(text, timestamptz, timestamptz)               to service_role;
grant execute on function public.get_weekly_leaderboard(text, timestamptz, timestamptz)       to service_role;
grant execute on function public.get_weekly_player_rank(text, text, timestamptz, timestamptz) to service_role;
grant select   on public.leaderboard_weekly_full_v                                            to service_role;
```

`security_invoker = true` is defence in depth, not the control: without it the view runs as its
**owner** and bypasses `score_attempts`' deny-all RLS, so a readable view would expose an
aggregate of every wallet's play history. The revoke is the control; the flag means a future
accidental grant still hits RLS.

Verification is by `has_function_privilege` / `pg_proc.proacl` **against a live database**,
never by grepping the migration — a text guard passes green with the function exposed.

## Acceptance criteria

Ranking (parent D1)
- [ ] **DB-1** Several attempts on the same level in the week: only the highest counts.
- [ ] **DB-2** A higher attempt outside the week does not count.
- [ ] **DB-3** Attempts on different levels sum.
- [ ] **DB-4** A later, lower attempt does not reduce the total.
- [ ] **DB-5** A wallet with no attempts this week yields no row from either function.
- [ ] **DB-6** An attempt at `p_week_start` exactly is IN; one at `p_week_end` exactly is OUT.
- [ ] **DB-7** Two tied wallets are ordered by earlier `total_achieved_at`, then `wallet ASC`.
- [ ] **DB-8** No multiplier: a single 250-point attempt yields `total_score = 250`.
- [ ] **DB-9** A `duplicate` attempt (`save_status = 'duplicate'`) counts toward presence and
      cannot raise the total above the best it duplicates; `achieved_at` credits the *first*
      time that best was reached, not the first attempt on the level.

Cut and player rank
- [ ] **DB-10** `get_weekly_leaderboard` returns at most 10 rows with 11+ ranked wallets.
- [ ] **DB-11** `get_weekly_player_rank` returns `rank = 11` for the 11th wallet — i.e. it
      ranks over the uncut set.
- [ ] **DB-12** Both functions report the same rank for a wallet present in both, over one
      fixture set.

Surface split (parent D2)
- [ ] **DB-13** `p_surface = 'learn'` never returns a wallet whose only attempts are `play`.
- [ ] **DB-14** `p_surface = 'play'` never returns a wallet whose only attempts are `learn`.
- [ ] **DB-15** One wallet with attempts on both surfaces gets different totals/ranks per call.
- [ ] **DB-16** Totals are computed only from the requested surface's attempts.
- [ ] **DB-17** A wallet whose only play this week was on-chain (rows in `scores` /
      `score_saves`, none in `score_attempts`) does not appear at all.

Privileges and structure
- [ ] **DB-18** `has_function_privilege('anon', …)` and `('authenticated', …)` are FALSE for
      all three functions, checked against a live database.
- [ ] **DB-19** `anon` and `authenticated` cannot `select` from `leaderboard_weekly_full_v`.
- [ ] **DB-20** The view's `reloptions` include `security_invoker=true`.
- [ ] **DB-21** `score_attempts_surface_created_idx` exists in `pg_indexes`. Its use is checked
      once by hand with `explain` during migration verification — a pinned query plan is a flake
      waiting for the first statistics change, so it is not asserted in a test.
- [ ] **DB-22** With the session `TimeZone` set to a non-UTC value,
      `leaderboard_weekly_full_v` returns the same window as a UTC session.
- [ ] **DB-23** Concurrency: N attempts inserted during a weekly read produce no duplicate and
      no missing rank (real Postgres, per the Slice 0 precedent).

## Two test layers, not one

Added during TDD (2026-07-29, founder-approved). It changes no decision and no contract; it
closes a hole in this slice's own verification.

**CI has no Postgres.** A slice whose only test is a SQL smoke merges with a green pipeline that
verified nothing. Both layers are required, and each is honest about what it cannot claim:

| Layer | Runs | Proves | Cannot prove |
|---|---|---|---|
| `src/lib/scores/__tests__/leaderboard-weekly-schema.test.ts` | CI, every PR | The signatures, the three revokes + grants, `security_invoker=true`, the index, and that the two RPCs read `weekly_ranking` instead of carrying their own copy of the window function — all still *written down* | Any runtime behavior. A migration can say `revoke` and the privilege still be granted (Slice 3 learned this against a live database) |
| `supabase/tests/leaderboard_weekly_smoke.sql` | Local Docker Postgres | DB-1 … DB-23 | Nothing runs it in CI, so it cannot stop a drifting PR |

The text guard **must strip `--` comments before any order or presence assertion**: prose that
names a function counts as a match, and that is how the first draft of the Slice 3 guard failed
(`score-attempts-schema.test.ts:46-54`).

## Definition of done

- One migration file, additive, applied cleanly to a fresh database **and** on top of prod's
  current schema.
- A vitest text guard as described above — the only layer CI runs.
- A SQL smoke under `apps/web/supabase/tests/` covering DB-1 … DB-23, following the shape of
  `score_attempts_smoke.sql`: one transaction, `rollback` at the end, `raise exception` on any
  violation. It must additionally set a non-UTC `TimeZone` (DB-22), assert effective privileges
  (DB-18/19), compare the top-10 cut against the uncut player rank (DB-10/11/12), assert the RPC
  and the view agree, and assert `has_onchain` is absent from the relation.
- Concurrency (DB-23) follows the existing precedent: a pgbench fixture alongside the smoke, like
  `score_attempts_same_attempt_concurrency.sql` — two sessions cannot be expressed in one psql
  connection.
- The first green comes from **local** Postgres. Prod is reserved for the read-only privilege
  verification at rollout.
- DB-18/19/20 verified against a live Supabase and the result recorded in the migration's
  header comment — the Slice 3 lesson: only the database can answer this.
- `DEPLOY` / `VERIFY` / `ROLLBACK` scripts under `apps/web/supabase/deploy/`, matching the
  existing `2026-07-30-score-write-path-*` convention. Rollback drops the three functions, the
  view and the index; it touches no data, because this slice writes none.
- No TypeScript changed in this slice.
