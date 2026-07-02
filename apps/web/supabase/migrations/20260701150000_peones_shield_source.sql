-- Chesscito — Peones shield source
--
-- 2026-07-01. Adds `shield` as a valid value of `peones_ledger.source`.
-- Backs the Peones-spend fallback for Retry Shield (Phase 1
-- consolidation, docs/superpowers/specs/2026-07-01-coach-shield-peones-
-- consumables-phase1-design.md) — mirrors the `coach` spend source's
-- shape, but a shield rescue is NOT a naturally idempotent artifact the
-- way a cached Coach analysis is, so the endpoint additionally holds a
-- one-row-one-grant SETNX guard in Redis (see /api/shields/spend) on
-- top of this ledger row. This migration only adds the source value;
-- it is not subject to the daily-family cap (not an earn), so
-- PEONES_DAILY_CAP_SOURCES and peones_balance_with_caps are unchanged.

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
    'admin_grant',
    'shield'
  ));
