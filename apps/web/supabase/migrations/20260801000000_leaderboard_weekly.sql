-- Chesscito — Slice 2A: the weekly leaderboard relation.
--
-- Spec: docs/specs/2026-07-29-leaders-weekly-db.md
-- Parent (decisions D1–D5): docs/specs/2026-07-29-leaders-weekly-window-v2.md
--
-- WHY THIS READS score_attempts AND NOT score_saves
-- -------------------------------------------------
-- `score_saves` holds ONE row per (wallet, level, distinct score), so its
-- `created_at` means "first time that exact score was reached", not "played
-- this week". A player at their ceiling never writes another row and repeating
-- a personal best writes nothing. Every acceptance criterion of a weekly board
-- built on it would pass while the board failed its purpose — that is why the
-- 2026-07-27 version of this spec was blocked. `score_attempts` records the
-- PLAY, one row per completed attempt, so a time window over it means what it
-- says.
--
-- ADDITIVE ONLY. No table DDL, no columns, no backfill, and the all-time
-- relations (`leaderboard_full_v`, its top-10 cut and their RPCs) are not
-- touched: weekly and all-time answer different questions and neither replaces
-- the other.
--
-- WEEKLY CARRIES NO ON-CHAIN SEAL (parent, "deliberate asymmetry")
-- ---------------------------------------------------------------
-- There is deliberately no `has_onchain` column here. Absent, not false: a
-- present `false` would assert "this player has no on-chain score", which is a
-- claim this relation has no basis to make. The off-chain rail is gated by a
-- server-issued, revocable write session; the on-chain rail is not, and a new
-- ranking must not be born carrying the defect Slice 0 removed.
--
-- THE IDENTITY COLUMN IS `wallet`, NOT `player`
-- ---------------------------------------------
-- The all-time relations call it `player` because they union `scores` (which
-- uses that name). This one reads `score_attempts` only, so it keeps that
-- table's name. The API mapper must not be shared between the two — reading
-- `r.player` here yields NULL and derives a rowId from undefined.

-- ─────────────────────────────────────────────────────────────────
-- 1. The index the weekly aggregate needs
-- ─────────────────────────────────────────────────────────────────
-- The existing `score_attempts_created_idx (created_at desc)` would force a
-- per-row surface filter, degrading exactly as the feature succeeds.

create index if not exists score_attempts_surface_created_idx
  on public.score_attempts (surface, created_at desc);

-- ─────────────────────────────────────────────────────────────────
-- 2. weekly_ranking — THE single ranking relation
-- ─────────────────────────────────────────────────────────────────
-- The window and the surface are PARAMETERS, never `now()` and never an env
-- read, so a boundary test can ask for any week without moving the database
-- clock. The only place `now()` appears in this migration is the fallback view.
--
-- Both RPCs below SELECT FROM this function rather than carrying their own copy
-- of the window function. Three copies of one `rank() over` drift on the first
-- change, and the symptom is a footer rank that disagrees with the list.
--
-- WHY `achieved_at` TAKES TWO PASSES
-- ----------------------------------
-- It is the earliest `created_at` among the rows that TIE the level's best.
-- `min(created_at) filter (where score = max(score))` nests aggregates and is
-- invalid; the plausible-looking `min(created_at) group by (wallet, level_id)`
-- compiles and is WRONG — it credits the player's first attempt on the level,
-- including a bad one. Hence `best` and then a join back to `attempts`.
-- It changes tiebreak order without changing any total, so no score-shaped
-- assertion would catch the mistake.

create or replace function public.weekly_ranking(
  p_surface    text,
  p_week_start timestamptz,
  p_week_end   timestamptz
)
returns table (
  wallet      text,
  total_score int,
  rank        int,
  is_verified boolean
)
language sql
stable
as $$
  with attempts as (
    select a.wallet, a.level_id, a.score, a.created_at
      from public.score_attempts a
     where a.surface = p_surface
       and a.created_at >= p_week_start
       and a.created_at <  p_week_end
  ),
  best as (
    select at2.wallet, at2.level_id, max(at2.score) as best_score
      from attempts at2
     group by at2.wallet, at2.level_id
  ),
  achieved as (
    select b.wallet,
           b.level_id,
           b.best_score,
           min(a2.created_at) as achieved_at
      from best b
      join attempts a2
        on a2.wallet   = b.wallet
       and a2.level_id = b.level_id
       and a2.score    = b.best_score
     group by b.wallet, b.level_id, b.best_score
  ),
  totals as (
    select ac.wallet,
           sum(ac.best_score)::int as total_score,
           max(ac.achieved_at)     as total_achieved_at
      from achieved ac
     group by ac.wallet
  )
  select t.wallet,
         t.total_score,
         rank() over (
           order by t.total_score       desc,
                    t.total_achieved_at asc,
                    t.wallet            asc
         )::int as rank,
         coalesce(pc.is_verified, false) as is_verified
    from totals t
    left join public.passport_cache pc on pc.player = t.wallet
$$;

comment on function public.weekly_ranking(text, timestamptz, timestamptz) is
  'Slice 2A. The single weekly ranking relation: per wallet, sum of MAX(score) per level over score_attempts inside the half-open [p_week_start, p_week_end) window on ONE surface, ranked by total desc, then by when the total was completed (R4: who got there first), then wallet. No multiplier and no has_onchain — see the migration header.';

-- ─────────────────────────────────────────────────────────────────
-- 3. The two read paths — a cut board, and one uncut wallet
-- ─────────────────────────────────────────────────────────────────
-- The cut matches all-time's top 10. `get_weekly_player_rank` deliberately does
-- NOT cut: a player outside the top 10 must still see their real rank in the
-- footer (QA G4 2026-06-11), which is the whole reason it exists.

create or replace function public.get_weekly_leaderboard(
  p_surface    text,
  p_week_start timestamptz,
  p_week_end   timestamptz
)
returns table (
  wallet      text,
  total_score int,
  rank        int,
  is_verified boolean
)
language sql
stable
as $$
  select r.wallet, r.total_score, r.rank, r.is_verified
    from public.weekly_ranking(p_surface, p_week_start, p_week_end) r
   order by r.rank asc, r.wallet asc
   limit 10
$$;

comment on function public.get_weekly_leaderboard(text, timestamptz, timestamptz) is
  'Slice 2A. Top-10 cut of weekly_ranking, matching the all-time board. Ranks come from the UNCUT relation, so they stay comparable with get_weekly_player_rank.';

create or replace function public.get_weekly_player_rank(
  p_player     text,
  p_surface    text,
  p_week_start timestamptz,
  p_week_end   timestamptz
)
returns table (
  wallet      text,
  total_score int,
  rank        int,
  is_verified boolean
)
language sql
stable
as $$
  select r.wallet, r.total_score, r.rank, r.is_verified
    from public.weekly_ranking(p_surface, p_week_start, p_week_end) r
   where r.wallet = p_player
$$;

comment on function public.get_weekly_player_rank(text, text, timestamptz, timestamptz) is
  'Slice 2A. One wallet, ranked over the UNCUT set, so rank 11+ is visible in the footer while absent from the board. Takes p_player ALREADY LOWERCASED: score_attempts.wallet is check-constrained to lowercase hex, so a checksummed address matches zero rows and returns no row — indistinguishable from "did not play this week". Normalising is the caller''s job (Slice 2B).';

-- ─────────────────────────────────────────────────────────────────
-- 4. leaderboard_weekly_full_v — the fallback path only
-- ─────────────────────────────────────────────────────────────────
-- Mirrors the existing RPC-then-view pattern in src/lib/supabase/queries.ts.
-- Always the CURRENT UTC week, and it exposes `surface` as a column so the TS
-- fallback filters with .eq("surface", …) instead of needing a parameter a view
-- cannot take.
--
-- THE TRAILING `at time zone 'utc'` IS LOAD-BEARING
-- -------------------------------------------------
-- `now() at time zone 'utc'` yields a timestamp WITHOUT time zone. Handing that
-- to a timestamptz parameter casts it through the database's TimeZone setting,
-- so on a non-UTC server the whole window silently shifts. The second
-- conversion pins it back. A test running on a UTC database cannot see this,
-- which is why the smoke sets a non-UTC TimeZone and asserts the unpinned form
-- really does drift before asserting the pinned one does not.
--
-- `security_invoker = true` is defence in depth, NOT the control. The control is
-- the revoke below. Without the flag a view runs as its OWNER and bypasses
-- score_attempts' deny-all RLS entirely, so a future accidental grant would
-- expose an aggregate of every wallet's play history.

create or replace view public.leaderboard_weekly_full_v
  with (security_invoker = true) as
  select s.surface, r.wallet, r.total_score, r.rank, r.is_verified
    from (values ('learn'::text), ('play'::text)) s(surface)
    cross join lateral public.weekly_ranking(
      s.surface,
      date_trunc('week', now() at time zone 'utc') at time zone 'utc',
      (date_trunc('week', now() at time zone 'utc') + interval '7 days') at time zone 'utc'
    ) r;

comment on view public.leaderboard_weekly_full_v is
  'Slice 2A. Fallback for the weekly RPCs, current UTC week only, both surfaces with `surface` as a filterable column. Not a client-facing relation: revoked from anon/authenticated and security_invoker so RLS still applies if that ever changes.';

-- ─────────────────────────────────────────────────────────────────
-- 5. Privileges
-- ─────────────────────────────────────────────────────────────────
-- BOTH REVOKES ARE REQUIRED, and each one alone is useless:
--
--   1. Postgres grants EXECUTE on every new function to PUBLIC by default, so
--      revoking from anon/authenticated alone leaves them holding it through
--      PUBLIC.
--   2. Supabase ships `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON
--      FUNCTIONS TO anon, authenticated, service_role`, so every new function
--      ALSO gets an EXPLICIT grant to those two roles, which a revoke from
--      PUBLIC does not touch.
--
-- Slice 3 found this against a live Supabase, not by review: the migration
-- revoked from PUBLIC only and `has_function_privilege('anon', ...)` still came
-- back TRUE. A text guard cannot see it — only the database can, which is why
-- the smoke asserts the effective privilege rather than the statement.

revoke execute on function public.weekly_ranking(text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.get_weekly_leaderboard(text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.get_weekly_player_rank(text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke select
  on public.leaderboard_weekly_full_v
  from public, anon, authenticated;

grant execute on function public.weekly_ranking(text, timestamptz, timestamptz)
  to service_role;
grant execute on function public.get_weekly_leaderboard(text, timestamptz, timestamptz)
  to service_role;
grant execute on function public.get_weekly_player_rank(text, text, timestamptz, timestamptz)
  to service_role;
grant select
  on public.leaderboard_weekly_full_v
  to service_role;
