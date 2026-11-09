-- Chesscito — Peones economy recalibration: daily cap (Slice C1)
--
-- Founder decision 2026-06-10 (docs/product/2026-06-10-savescore-share-
-- leaderboard-economy-proposal.md §5): the economy is too generous and
-- training earn scales uncapped with content. Two changes here, applied
-- forward via CREATE OR REPLACE (the original
-- 20260607000000_peones_ledger_init.sql is NOT edited):
--
--   1. Daily cap 10 → 6.
--   2. `exercise_completion` joins the capped daily-source set, so
--      training-exercise earn now counts toward (and is bounded by) the
--      same daily ceiling as the daily-family sources. Previously it was
--      uncapped.
--
-- Keep in lockstep with PEONES_DAILY_CAP + PEONES_DAILY_CAP_SOURCES in
-- src/lib/peones/types.ts (schema-sync.test.ts guards the match).
--
-- Pure read helper; no data mutation, no DROP, no table ALTER.

create or replace function public.peones_balance_with_caps(
  p_wallet  text,
  p_day_utc date
)
returns table (
  balance              bigint,
  daily_earned_capped  bigint,
  daily_cap            integer
)
language sql
stable
as $$
  select
    coalesce(sum(case
      when event_type in ('earn', 'adjustment') then amount
      when event_type in ('spend', 'rollback')  then -amount
    end), 0)::bigint                              as balance,
    coalesce(sum(case
      when event_type = 'earn'
        and source in ('daily_tactic', 'daily_streak_bonus', 'daily_lab', 'exercise_completion')
        and day_utc = p_day_utc
      then amount
    end), 0)::bigint                              as daily_earned_capped,
    6::integer                                     as daily_cap
  from public.peones_ledger
  where wallet = p_wallet;
$$;

comment on function public.peones_balance_with_caps(text, date) is
  'Cap-aware balance helper. Economy recalibration 2026-06-10: cap 10->6, exercise_completion now counted toward the daily cap. Change via migration; keep in lockstep with PEONES_DAILY_CAP(_SOURCES).';
