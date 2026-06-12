-- Chesscito — Leaderboard: on-chain marker + always-visible player rank
--
-- Founder QA round 2026-06-11 (surface redistribution spec §4b follow-up):
--   1. Rows whose player has at least one ON-CHAIN score (legacy
--      `scores` table, Scoreboard contract write-through) carry a
--      `has_onchain` flag so the UI can mark them.
--   2. `get_player_rank(wallet)` returns the caller's own row with its
--      REAL rank computed over the FULL ranking (the top-10 LIMIT made
--      players outside the cut invisible — QA G4).
--
-- Approach: extract the unlimited ranking into `leaderboard_full_v`;
-- `leaderboard_combined_v` becomes its top-10 cut (same columns +
-- has_onchain appended — CREATE OR REPLACE VIEW allows appending).
-- `get_leaderboard()` changes return shape (5 cols) → DROP + CREATE.
-- No table DDL, no data mutation, `leaderboard_v` untouched.

-- ─────────────────────────────────────────────────────────────────
-- 1. Full (unlimited) combined ranking with the on-chain flag
-- ─────────────────────────────────────────────────────────────────
create or replace view public.leaderboard_full_v as
SELECT
  sub.player,
  SUM(sub.best_score)::int AS total_score,
  RANK() OVER (ORDER BY SUM(sub.best_score) DESC, sub.player ASC)::int AS rank,
  COALESCE(pc.is_verified, false) AS is_verified,
  BOOL_OR(sub.level_has_onchain) AS has_onchain
FROM (
  SELECT player, level_id, MAX(score) AS best_score,
         BOOL_OR(src_onchain) AS level_has_onchain
  FROM (
    SELECT player, level_id, score, true AS src_onchain
    FROM public.scores
    UNION ALL
    SELECT wallet AS player, level_id, score, false AS src_onchain
    FROM public.score_saves
  ) unified
  GROUP BY player, level_id
) sub
LEFT JOIN public.passport_cache pc ON pc.player = sub.player
GROUP BY sub.player, pc.is_verified;

comment on view public.leaderboard_full_v is
  'Unlimited combined ranking (scores + score_saves, best per player+level, summed). has_onchain = player has at least one row in the on-chain scores table. Source for leaderboard_combined_v (top-10 cut) and get_player_rank().';

-- ─────────────────────────────────────────────────────────────────
-- 2. Top-10 view becomes a cut of the full ranking (+ has_onchain)
-- ─────────────────────────────────────────────────────────────────
create or replace view public.leaderboard_combined_v as
SELECT player, total_score, rank, is_verified, has_onchain
FROM public.leaderboard_full_v
ORDER BY rank ASC, player ASC
LIMIT 10;

comment on view public.leaderboard_combined_v is
  'Top-10 cut of leaderboard_full_v. has_onchain appended 2026-06-11 (on-chain marker, QA round). Single source of truth for get_leaderboard() + the TS fallback.';

-- ─────────────────────────────────────────────────────────────────
-- 3. get_leaderboard() — new 5-column shape (DROP: return type change)
-- ─────────────────────────────────────────────────────────────────
drop function if exists public.get_leaderboard();

create function public.get_leaderboard()
returns table (
  player       text,
  total_score  int,
  rank         int,
  is_verified  boolean,
  has_onchain  boolean
)
language sql stable
as $$
  SELECT player, total_score, rank, is_verified, has_onchain
  FROM public.leaderboard_combined_v;
$$;

comment on function public.get_leaderboard() is
  '5-column shape (has_onchain appended 2026-06-11). Reads leaderboard_combined_v; shared source with the TS fallback in queries.ts.';

-- ─────────────────────────────────────────────────────────────────
-- 4. get_player_rank(wallet) — the caller''s own row, real rank
-- ─────────────────────────────────────────────────────────────────
create or replace function public.get_player_rank(p_player text)
returns table (
  player       text,
  total_score  int,
  rank         int,
  is_verified  boolean,
  has_onchain  boolean
)
language sql stable
as $$
  SELECT player, total_score, rank, is_verified, has_onchain
  FROM public.leaderboard_full_v
  WHERE player = lower(p_player);
$$;

comment on function public.get_player_rank(text) is
  'QA G4 2026-06-11: the player''s own combined-leaderboard row with its real rank over the FULL ranking, visible even outside the top-10 cut. Empty result = player has no saves yet.';
