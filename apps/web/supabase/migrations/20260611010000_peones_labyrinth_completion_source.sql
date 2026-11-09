-- Chesscito — Peones labyrinth completion source (Training Path Slice 4)
--
-- 2026-06-11. Adds `labyrinth_completion` as a valid value of
-- `peones_ledger.source` and folds it into the daily-capped source set
-- of `peones_balance_with_caps`. Reward rule (client + earn route):
-- flat +1 Peón on the FIRST completion of a catalog labyrinth
-- (bestBefore == null), wallet-only, idempotency key
-- `labyrinth_completion:{wallet}:{piece}:{labyrinthId}` — the wallet
-- lives inside the key because peones_ledger_idempotency_uq is GLOBAL.
--
-- Lifetime supply is bounded by the catalog (18 labyrinths today), and
-- the daily cap (6) bounds the per-day rate. No farming surface:
-- improving a best never earns again.
--
-- Forward-only: CREATE OR REPLACE + constraint swap. The applied
-- migrations are NOT edited. Keep in lockstep with
-- PEONES_DAILY_CAP(_SOURCES) in src/lib/peones/types.ts
-- (schema-sync.test.ts guards the match).

alter table public.peones_ledger
  drop constraint peones_ledger_source_check;

alter table public.peones_ledger
  add constraint peones_ledger_source_check
  check (source in (
    'daily_tactic',
    'daily_streak_bonus',
    'daily_lab',
    'exercise_completion',
    'labyrinth_completion',
    'senda_milestone',
    'pack_purchase',
    'welcome_pack',
    'coach',
    'hint',
    'retry',
    'save_game',
    'labyrinth_key',
    'admin_grant'
  ));

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
        and source in ('daily_tactic', 'daily_streak_bonus', 'daily_lab', 'exercise_completion', 'labyrinth_completion')
        and day_utc = p_day_utc
      then amount
    end), 0)::bigint                              as daily_earned_capped,
    6::integer                                     as daily_cap
  from public.peones_ledger
  where wallet = p_wallet;
$$;

comment on function public.peones_balance_with_caps(text, date) is
  'Cap-aware balance helper. Training Path Slice 4 (2026-06-11): labyrinth_completion joins the capped daily-source set (cap stays 6). Change via migration; keep in lockstep with PEONES_DAILY_CAP(_SOURCES).';
