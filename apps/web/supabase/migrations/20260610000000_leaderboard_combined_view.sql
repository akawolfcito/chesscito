-- Chesscito — SaveScore off-chain (basic): combined leaderboard view
--
-- Slice 4 of the SaveScore off-chain/Peones cluster (spec:
-- docs/specs/savescore-offchain-peones.md §Leaderboard integration;
-- founder decision 2026-06-10 — "Baseline IF NOT EXISTS").
--
-- The leaderboard already reads from the DB, not the chain. Slice 1
-- moved the basic save off-chain into `score_saves`. This slice surfaces
-- those saves in the normal leaderboard WITHOUT altering the legacy
-- `leaderboard_v` (which has no versioned baseline DDL — it lives only in
-- src/lib/supabase/schema.sql, applied via the hosted SQL editor).
--
-- Approach (spec §Leaderboard integration):
--   * NEW view `leaderboard_combined_v` unions the legacy on-chain
--     `scores` with the off-chain `score_saves`, aggregating per player.
--   * `get_leaderboard()` is re-pointed at the combined view so the RPC
--     and the TS fallback (queries.ts) never diverge (P1
--     leaderboard-view-undefined).
--   * `is_verified` stays a per-player attribute sourced from
--     `passport_cache` (COALESCE …, false). Pure off-chain players are
--     absent from passport_cache and therefore surface unverified —
--     satisfying "is_verified=false for all score_saves rows" while
--     preserving the legacy passport semantics.
--
-- SELF-CONTAINED BASELINE (founder decision 2026-06-10): the combined
-- view depends on `scores` + `passport_cache`, which exist on hosted
-- (schema.sql) but NOT in versioned migrations / a fresh local DB. We
-- materialise a minimal baseline with CREATE TABLE IF NOT EXISTS — a
-- no-op on hosted (never ALTERs an existing table), and the minimal
-- shape the view needs on a clean `supabase db reset`. NO DROP, NO
-- destructive ALTER, NO data mutation, `leaderboard_v` untouched.

-- ─────────────────────────────────────────────────────────────────
-- 1. Minimal baseline for the view's dependencies (idempotent)
-- ─────────────────────────────────────────────────────────────────
-- Mirrors the canonical shapes in src/lib/supabase/schema.sql. On hosted
-- these tables already exist, so IF NOT EXISTS makes this a no-op.

create table if not exists public.scores (
  id         serial primary key,
  player     text not null check (player = lower(player)),
  level_id   int  not null,
  score      int  not null,
  time_ms    int  not null,
  tx_hash    text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.passport_cache (
  player      text primary key check (player = lower(player)),
  is_verified boolean default false,
  checked_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2. Combined leaderboard view
-- ─────────────────────────────────────────────────────────────────
-- Mirrors the legacy `leaderboard_v` aggregation exactly, only the inner
-- source set is widened: best score per (player, level) is now taken
-- across BOTH `scores` (on-chain) and `score_saves` (off-chain). Both
-- sources are lowercase-constrained at write time, so `player`/`wallet`
-- align without extra normalisation.

create or replace view public.leaderboard_combined_v as
SELECT
  sub.player,
  SUM(sub.best_score)::int AS total_score,
  RANK() OVER (ORDER BY SUM(sub.best_score) DESC, sub.player ASC)::int AS rank,
  COALESCE(pc.is_verified, false) AS is_verified
FROM (
  SELECT player, level_id, MAX(score) AS best_score
  FROM (
    SELECT player, level_id, score FROM public.scores
    UNION ALL
    SELECT wallet AS player, level_id, score FROM public.score_saves
  ) unified
  GROUP BY player, level_id
) sub
LEFT JOIN public.passport_cache pc ON pc.player = sub.player
GROUP BY sub.player, pc.is_verified
ORDER BY total_score DESC, sub.player ASC
LIMIT 10;

comment on view public.leaderboard_combined_v is
  'Slice 4 combined leaderboard. UNION ALL of legacy on-chain `scores` + off-chain `score_saves`, best per (player,level), summed per player, ranked, top 10. is_verified from passport_cache (false for off-chain-only players). Single source of truth for get_leaderboard() + the TS fallback.';

-- ─────────────────────────────────────────────────────────────────
-- 3. Re-point get_leaderboard() at the combined view
-- ─────────────────────────────────────────────────────────────────
-- Same response shape as the legacy RPC (player, total_score, rank,
-- is_verified) so no caller changes. Reading from the view keeps the RPC
-- and the queries.ts fallback on one source — closes the P1
-- leaderboard-view-undefined divergence.

create or replace function public.get_leaderboard()
returns table (
  player       text,
  total_score  int,
  rank         int,
  is_verified  boolean
)
language sql stable
as $$
  SELECT player, total_score, rank, is_verified
  FROM public.leaderboard_combined_v;
$$;

comment on function public.get_leaderboard() is
  'Slice 4: reads from leaderboard_combined_v (scores + score_saves). Legacy 4-column shape preserved. Single source of truth shared with the TS fallback in queries.ts.';
