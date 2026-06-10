-- Chesscito — SaveScore free quota recalibration (Slice C3)
--
-- Founder decision 2026-06-10: FREE_SCORE_SAVE_LIMIT 5 → 3. With the
-- tighter daily earn cap (Slice C1) and flat training reward (Slice C2),
-- 3 free saves make the 4th save a real decision without being punitive.
--
-- Applied forward via CREATE OR REPLACE; the original
-- 20260609000000_score_saves_init.sql is NOT edited. The function body is
-- byte-identical to the original EXCEPT c_free_limit (5 → 3). Keep in
-- lockstep with FREE_SCORE_SAVE_LIMIT in src/lib/scores/save-service.ts.

create or replace function public.save_basic_score(
  p_save_id          text,
  p_wallet           text,
  p_level_id         int,
  p_score            int,
  p_time_ms          int,
  p_game_id          text,
  p_attestation_hash text,
  p_metadata         jsonb default null
)
returns jsonb
language plpgsql
volatile
as $$
declare
  -- Calibration constants. Change via migration only.
  c_free_limit constant int := 3;   -- FREE_SCORE_SAVE_LIMIT (was 5)
  c_cost       constant int := 1;   -- SCORE_SAVE_COST_PEONES

  v_wallet     text;
  v_used       int;
  v_remaining  int;
  v_requires   boolean;
  v_balance    bigint;
  v_idem       text;
  v_new_bal    bigint;
  v_dup_mode   text;
  v_dup_spent  int;
begin
  v_wallet := lower(p_wallet);

  -- 0. Serialise every save for this wallet within the transaction.
  perform pg_advisory_xact_lock(hashtext(lower(p_wallet)));

  -- 1. Dedup. The UNIQUE on save_id is the hard guard.
  select mode, peones_spent into v_dup_mode, v_dup_spent
    from public.score_saves
   where save_id = p_save_id;

  if found then
    v_used := (select count(*) from public.score_saves where wallet = v_wallet);
    v_balance := coalesce(
      (select balance from public.peones_balances where wallet = v_wallet), 0);
    return jsonb_build_object(
      'status', 'duplicate',
      'mode', v_dup_mode,
      'freeUsed', v_used,
      'freeLimit', c_free_limit,
      'freeRemaining', greatest(0, c_free_limit - v_used),
      'requiresPeones', v_used >= c_free_limit,
      'spent', v_dup_spent,
      'balance', v_balance,
      'scoreSaveId', p_save_id
    );
  end if;

  -- 2. Per-wallet quota count.
  v_used := (select count(*) from public.score_saves where wallet = v_wallet);
  v_requires := v_used >= c_free_limit;

  if not v_requires then
    -- 3. FREE path — no balance touched.
    insert into public.score_saves
      (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent, metadata)
    values
      (p_save_id, v_wallet, p_level_id, p_score, p_time_ms, p_game_id, 'free', 0, p_metadata);

    v_used := v_used + 1;
    v_balance := coalesce(
      (select balance from public.peones_balances where wallet = v_wallet), 0);
    return jsonb_build_object(
      'status', 'saved',
      'mode', 'free',
      'freeUsed', v_used,
      'freeLimit', c_free_limit,
      'freeRemaining', greatest(0, c_free_limit - v_used),
      'requiresPeones', v_used >= c_free_limit,
      'spent', 0,
      'balance', v_balance,
      'scoreSaveId', p_save_id
    );
  end if;

  -- 4. PAID path — reuse peones_spend (never raw ledger insert).
  v_idem := 'spend:save_game:' || p_save_id;

  begin
    select new_balance
      into v_new_bal
      from public.peones_spend(
        v_wallet, c_cost, 'save_game', p_save_id, v_idem, p_attestation_hash, p_metadata, false
      );
  exception
    when sqlstate 'P0001' then
      -- insufficient_balance — no score_saves row, no extra debit.
      v_balance := coalesce(
        (select balance from public.peones_balances where wallet = v_wallet), 0);
      return jsonb_build_object(
        'status', 'insufficient_peones',
        'mode', null,
        'freeUsed', v_used,
        'freeLimit', c_free_limit,
        'freeRemaining', 0,
        'requiresPeones', true,
        'spent', 0,
        'balance', v_balance,
        'required', c_cost,
        'scoreSaveId', p_save_id
      );
  end;

  -- Spend succeeded → persist the paid save in the same transaction.
  insert into public.score_saves
    (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent, metadata)
  values
    (p_save_id, v_wallet, p_level_id, p_score, p_time_ms, p_game_id, 'peones', c_cost, p_metadata);

  v_used := v_used + 1;
  return jsonb_build_object(
    'status', 'saved',
    'mode', 'peones',
    'freeUsed', v_used,
    'freeLimit', c_free_limit,
    'freeRemaining', 0,
    'requiresPeones', true,
    'spent', c_cost,
    'balance', v_new_bal,
    'scoreSaveId', p_save_id
  );
end;
$$;

comment on function public.save_basic_score(text, text, int, int, int, text, text, jsonb) is
  'SaveScore basic atomic RPC. advisory-lock per wallet -> dedup -> quota count -> free (<3) or peones_spend reuse (>=3). One transaction; P0001 insufficient rolls the spend back and inserts no row. FREE_SCORE_SAVE_LIMIT=3, SCORE_SAVE_COST_PEONES=1 (recalibrated 2026-06-10) — change via migration.';
