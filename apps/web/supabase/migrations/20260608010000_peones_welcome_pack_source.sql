-- Chesscito — Peones welcome pack source
--
-- Sprint 4 commit J (2026-06-08). Adds `welcome_pack` as a valid
-- value of `peones_ledger.source`. The welcome pack seeds 1 free
-- Peón per wallet on first balance read so first-time users have
-- moneda to spend on a Hint immediately (pedagogical onboarding —
-- "ya tengo Peones, gastémoslos" beats "earn first, spend later").
--
-- One-shot per wallet ever: the idempotency key
-- `welcome_pack:{wallet}` collides on retry via the unique index
-- from commit A, so deleting + re-inserting the seed is impossible
-- (and append-only semantics make deletion impossible anyway).
--
-- This source is NOT subject to the daily-family cap (it's a
-- one-time grant, not a recurring earn). PEONES_DAILY_CAP_SOURCES
-- stays unchanged.

alter table public.peones_ledger
  drop constraint peones_ledger_source_check;

alter table public.peones_ledger
  add constraint peones_ledger_source_check
  check (source in (
    'daily_tactic',
    'daily_streak_bonus',
    'daily_lab',
    'exercise_completion',
    'senda_milestone',
    'pack_purchase',
    'coach',
    'hint',
    'retry',
    'save_game',
    'labyrinth_key',
    'admin_grant',
    'welcome_pack'
  ));
