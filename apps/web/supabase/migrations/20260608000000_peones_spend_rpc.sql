-- Chesscito — Peones atomic spend RPC
--
-- Sprint 4 commit B of Training Economy Alpha (calibration:
-- docs/product/chesscito-sprint-4-peones-spend-compendio-tx-calibration-2026-06-08.md).
--
-- Ships:
--   1. `pro_bypass` boolean column on peones_ledger — distinguishes
--      a spend row that was forgiven by PRO bypass (debited = 0) from
--      a real debit row. Rows with pro_bypass = true are still recorded
--      (audit trail + quota tracking) but DO NOT subtract from balance.
--   2. peones_balances view + peones_balance_with_caps function
--      updated to exclude pro_bypass spend rows from balance derivation.
--   3. `peones_spend` RPC — the atomic spend primitive. Sprint 4
--      commit C wires the endpoint POST /api/peones/spend through this
--      function. NO endpoint / NO UI / NO surface ships in this commit.
--
-- DESIGN PRINCIPLES (calibration §9.2)
--
--   Order of execution inside the RPC is fixed (founder sign-off
--   2026-06-08):
--
--     1. Idempotency check. If idempotency_key exists, return the
--        existing row as duplicate=true. **Idempotent retries succeed
--        even if the CURRENT balance no longer reaches the original
--        debit** — the original spend already happened and is
--        immutable; the client must see the same result it saw the
--        first time.
--
--     2. PRO bypass / quota evaluation if the caller passes
--        p_apply_pro_bypass = true. When applied: debited = 0, the
--        balance check is skipped, the row is inserted with
--        pro_bypass = true.
--
--     3. Balance check ONLY when debited > 0. A FOR UPDATE lock on
--        the wallet's rows serializes concurrent spends. If
--        balance < amount → RAISE 'insufficient_balance' (errcode
--        P0001). Without this lock two concurrent calls can both see
--        the same balance and both debit it (calibration §9 race).
--
--     4. Insert the append-only row with event_type='spend',
--        amount > 0 (always; the CHECK constraint is preserved),
--        pro_bypass flag, attestation hash, and metadata.
--
-- Spec references:
--   §4   spend endpoint contract (Sprint 4)
--   §9.1 idempotency key formats
--   §9.2 atomic spend RPC

-- ─────────────────────────────────────────────────────────────────
-- 1. pro_bypass column
-- ─────────────────────────────────────────────────────────────────

alter table public.peones_ledger
  add column pro_bypass boolean not null default false;

comment on column public.peones_ledger.pro_bypass is
  'Sprint 4 — true when this spend row was forgiven by PRO bypass. The row is recorded for audit + daily quota tracking but does not subtract from balance.';

-- Index for daily PRO quota queries: "how many bypass rows did this
-- wallet consume for target X today?" Sprint 4 commit G uses this
-- to enforce the daily quota matrix (calibration §6).
create index peones_ledger_pro_bypass_quota_idx
  on public.peones_ledger (wallet, source, day_utc)
  where pro_bypass = true;

-- ─────────────────────────────────────────────────────────────────
-- 2. Balance view — exclude pro_bypass spend rows
-- ─────────────────────────────────────────────────────────────────

-- Postgres requires DROP before changing return column types via
-- CREATE OR REPLACE on views; bigint shapes stay identical so a
-- plain replace is sufficient here.
create or replace view public.peones_balances as
select
  wallet,
  coalesce(sum(case
    when event_type in ('earn', 'adjustment')              then amount
    when event_type = 'rollback'                            then -amount
    when event_type = 'spend' and pro_bypass = false        then -amount
    else 0
  end), 0)::bigint                          as balance,
  max(created_at)                            as last_event_at,
  count(*)::bigint                           as event_count
from public.peones_ledger
group by wallet;

comment on view public.peones_balances is
  'Sprint 4 — derived per-wallet balance. SUM(ledger) excluding pro_bypass spend rows. NEVER cached as a mutable column anywhere in the app.';

-- ─────────────────────────────────────────────────────────────────
-- 3. Cap-aware balance helper — same exclusion
-- ─────────────────────────────────────────────────────────────────
--
-- daily_earned_capped is unchanged in semantics (only event_type='earn'
-- contributes), but balance derivation needs the pro_bypass exclusion
-- for consistency with the view.

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
        and source in ('daily_tactic', 'daily_streak_bonus', 'daily_lab')
        and day_utc = p_day_utc
      then amount
    end), 0)::bigint                              as daily_earned_capped,
    10::integer                                    as daily_cap
  from public.peones_ledger
  where wallet = p_wallet;
$$;

comment on function public.peones_balance_with_caps(text, date) is
  'Sprint 4 — cap-aware balance helper. Excludes pro_bypass spend from balance derivation. Cap = 10 hard-coded; change via migration.';

-- ─────────────────────────────────────────────────────────────────
-- 4. peones_spend — atomic spend RPC
-- ─────────────────────────────────────────────────────────────────
--
-- Returns five fields per row:
--   ledger_id           — id of the inserted row (or the idempotent hit)
--   debited             — amount actually subtracted from balance
--                          (0 when pro_bypass applied)
--   new_balance         — balance after this call (or current balance
--                          on idempotent hit)
--   duplicate           — true when idempotency hit returned the
--                          existing row instead of inserting
--   pro_bypass_applied  — true when PRO bypass was the reason
--                          debited = 0
--
-- Errors (raised via RAISE EXCEPTION with errcode):
--   P0001 'insufficient_balance' — debited > 0 and current balance
--                                   < requested amount

create function public.peones_spend(
  p_wallet            text,
  p_amount            integer,
  p_target            text,
  p_target_id         text,
  p_idempotency_key   text,
  p_attestation_hash  text,
  p_metadata          jsonb,
  p_apply_pro_bypass  boolean default false
)
returns table (
  ledger_id            bigint,
  debited              integer,
  new_balance          bigint,
  duplicate            boolean,
  pro_bypass_applied   boolean
)
language plpgsql
volatile
as $$
declare
  v_normalized_wallet text;
  v_existing_id       bigint;
  v_existing_amount   integer;
  v_existing_bypass   boolean;
  v_current_balance   bigint;
  v_new_id            bigint;
  v_actual_debit      integer;
  v_bypass_applied    boolean;
begin
  -- Defensive: collapse wallet case at the SQL boundary too. The
  -- service helper normalises before calling, but a thin extra guard
  -- here keeps the function safe to use from psql / dashboards.
  v_normalized_wallet := lower(p_wallet);

  -- 1. Idempotency check FIRST. The unique index on idempotency_key
  --    guarantees at most one row per key; if it exists we return it
  --    verbatim. Retries succeed even if current balance is now
  --    below the original debit.
  select id, amount, pro_bypass
    into v_existing_id, v_existing_amount, v_existing_bypass
    from public.peones_ledger
   where idempotency_key = p_idempotency_key;

  if found then
    select coalesce(sum(case
        when event_type in ('earn','adjustment')           then amount
        when event_type = 'rollback'                        then -amount
        when event_type = 'spend' and pro_bypass = false    then -amount
        else 0
      end), 0)::bigint
      into v_current_balance
      from public.peones_ledger
     where wallet = v_normalized_wallet;

    ledger_id := v_existing_id;
    debited := case when v_existing_bypass then 0 else v_existing_amount end;
    new_balance := v_current_balance;
    duplicate := true;
    pro_bypass_applied := v_existing_bypass;
    return next;
    return;
  end if;

  -- 2. PRO bypass / quota evaluation. The caller (Sprint 4 commit G
  --    endpoint resolver) decides whether bypass applies; the RPC
  --    just executes the decision atomically.
  v_bypass_applied := coalesce(p_apply_pro_bypass, false);
  v_actual_debit   := case when v_bypass_applied then 0 else p_amount end;

  -- 3. Balance check ONLY when debited > 0. Serialise concurrent
  --    spends on the same wallet via FOR UPDATE.
  if v_actual_debit > 0 then
    perform 1
      from public.peones_ledger
     where wallet = v_normalized_wallet
       for update;

    select coalesce(sum(case
        when event_type in ('earn','adjustment')           then amount
        when event_type = 'rollback'                        then -amount
        when event_type = 'spend' and pro_bypass = false    then -amount
        else 0
      end), 0)::bigint
      into v_current_balance
      from public.peones_ledger
     where wallet = v_normalized_wallet;

    if v_current_balance < v_actual_debit then
      raise exception 'insufficient_balance' using errcode = 'P0001';
    end if;
  end if;

  -- 4. Insert the append-only row. amount stays > 0 (preserves the
  --    CHECK constraint from Sprint 3); pro_bypass distinguishes
  --    whether the row counts in balance derivation.
  insert into public.peones_ledger (
    wallet, event_type, amount, source, source_id,
    idempotency_key, attestation_hash, metadata,
    day_utc, pro_bypass
  ) values (
    v_normalized_wallet,
    'spend',
    p_amount,
    p_target,
    p_target_id,
    p_idempotency_key,
    p_attestation_hash,
    p_metadata,
    (now() at time zone 'utc')::date,
    v_bypass_applied
  )
  returning id into v_new_id;

  -- Recompute balance post-insert for the return payload.
  select coalesce(sum(case
      when event_type in ('earn','adjustment')           then amount
      when event_type = 'rollback'                        then -amount
      when event_type = 'spend' and pro_bypass = false    then -amount
      else 0
    end), 0)::bigint
    into v_current_balance
    from public.peones_ledger
   where wallet = v_normalized_wallet;

  ledger_id := v_new_id;
  debited := v_actual_debit;
  new_balance := v_current_balance;
  duplicate := false;
  pro_bypass_applied := v_bypass_applied;
  return next;
  return;
end;
$$;

comment on function public.peones_spend(text, integer, text, text, text, text, jsonb, boolean) is
  'Sprint 4 commit B — atomic spend RPC. Order: idempotency → PRO bypass → balance check (if debited > 0) → insert. Never permits negative balance. Idempotent retries return success regardless of current balance.';

-- ─────────────────────────────────────────────────────────────────
-- 5. Migration footer
-- ─────────────────────────────────────────────────────────────────

-- Sprint 4 commit C will wire `POST /api/peones/spend` through this
-- RPC. Commit D ships the client helper + telemetry hooks. Commit E
-- wires the first surface (Hint button). NO endpoint or UI surface
-- ships in this commit.
