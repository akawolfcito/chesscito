-- Chesscito — Peones Economy V1 (docs/economy/peones-v1-policy.md)
--
-- 2026-07-21. Forward-only CREATE OR REPLACE of the cap-aware balance
-- helper. No DROP, no ALTER, no data mutation, no ledger row is touched.
-- Historical rows keep every source and event_type they were written
-- with; only the derivation changes.
--
-- ─────────────────────────────────────────────────────────────────
-- FIX 1 (the bug) — PRO bypass no longer subtracts from balance
-- ─────────────────────────────────────────────────────────────────
--
-- `peones_balance_with_caps` is the helper BOTH read paths use:
-- GET /api/peones/balance (the HUD chip + the spendable balance the
-- user sees) and POST /api/peones/earn. Since Sprint 4 it was supposed
-- to exclude PRO-bypassed spend rows from the balance, exactly like the
-- `peones_balances` view and the `peones_spend` RPC do:
--
--     when event_type = 'spend' and pro_bypass = false then -amount
--
-- Two later migrations re-created the function from an older body and
-- silently dropped that clause:
--
--     20260610010000_peones_daily_cap_recalibration.sql   (cap 10 -> 6)
--     20260611010000_peones_labyrinth_completion_source.sql (+labyrinth)
--
-- Both wrote `when event_type in ('spend','rollback') then -amount`,
-- which charges a PRO user for spends they were forgiven. The result is
-- a THREE-WAY divergence on the same wallet: `peones_spend` refuses to
-- go below zero and reports one balance, `peones_balances` reports the
-- same one, and this helper — the one the HUD reads — reports a lower
-- one, drifting further down with every bypassed Coach/Hint call. A PRO
-- subscriber sees their balance drop while paying nothing, and can see
-- a negative number that no spend ever caused.
--
-- Restored below. The three definitions now agree by construction; the
-- TS twin `computeLedgerBalance` was fixed in the same commit.
--
-- ─────────────────────────────────────────────────────────────────
-- FIX 2 (policy) — daily free-earn cap 6 -> 3
-- ─────────────────────────────────────────────────────────────────
--
-- Economy V1 shrinks the recurring free sources to +1/day (Daily
-- Tactic) plus +1 per milestone of five NEW exercises; labyrinths and
-- ludic games pay nothing. A cap of 6 was sized for the old +3 Daily
-- and the per-exercise faucet, both gone.
--
-- The daily-source list is UNCHANGED on purpose. `daily_lab`,
-- `daily_streak_bonus` and `labyrinth_completion` are rejected by the
-- earn endpoint now, so they cannot produce new rows — but keeping them
-- counted means any row written earlier the same UTC day still consumes
-- headroom instead of silently un-capping. Keep in lockstep with
-- PEONES_DAILY_CAP + PEONES_DAILY_CAP_SOURCES in src/lib/peones/types.ts
-- (schema-sync.test.ts guards the match against THIS file).
--
-- KNOWN, DELIBERATELY DEFERRED: the cap is read then applied in two
-- steps by the endpoint, so two concurrent earns can both observe the
-- same headroom and both credit. Bounded by the per-source idempotency
-- keys (one Daily per day, one row per milestone tier), so the worst
-- case is small and self-limiting. A transactional rewrite is out of
-- scope for this commit — see the policy doc's deferred-risks list.

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
      when event_type in ('earn', 'adjustment')        then amount
      when event_type = 'rollback'                      then -amount
      when event_type = 'spend' and pro_bypass = false  then -amount
      else 0
    end), 0)::bigint                              as balance,
    coalesce(sum(case
      when event_type = 'earn'
        and source in ('daily_tactic', 'daily_streak_bonus', 'daily_lab', 'exercise_completion', 'labyrinth_completion')
        and day_utc = p_day_utc
      then amount
    end), 0)::bigint                              as daily_earned_capped,
    3::integer                                     as daily_cap
  from public.peones_ledger
  where wallet = p_wallet;
$$;

comment on function public.peones_balance_with_caps(text, date) is
  'Economy V1 (2026-07-21): restores the pro_bypass exclusion dropped by the 2026-06-10 and 2026-06-11 replacements (a bypassed spend must NOT reduce balance -- matches peones_balances and peones_spend), and lowers the daily free-earn cap 6->3. Change via migration; keep in lockstep with PEONES_DAILY_CAP(_SOURCES).';
