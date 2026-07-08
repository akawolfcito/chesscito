-- Chesscito — SaveScore off-chain is ALWAYS FREE (MiniPay Delivery Lote 2)
--
-- Founder decision 2026-07-08: off-chain basic save must never cost Peones.
-- Persisting a score/progress is normal app behaviour, not a purchase, so the
-- `save_game` sink is NEVER executed for a basic save. Saving works even with a
-- 0 Peones balance. The on-chain proof (voluntary, gas-only) is the only
-- value action — it lives entirely outside this RPC and is untouched.
--
-- Applied forward via CREATE OR REPLACE; earlier migrations
-- (20260609000000_score_saves_init.sql, 20260610020000_savescore_quota_
-- recalibration.sql) are NOT edited. The function body is byte-identical to the
-- recalibration EXCEPT the PAID branch is removed:
--   - no public.peones_spend call (sink `save_game` never fires)
--   - no P0001 catch, no `insufficient_peones` return
--   - every save inserts mode='free', peones_spent=0
-- `score_saves.mode` still permits 'peones' for historical rows (that CHECK is
-- unchanged); we simply stop writing new 'peones' rows from basic saves.
--
-- Coach / hint / shield sinks are separate spend targets and keep charging.
-- p_attestation_hash stays in the signature for call-site compatibility but is
-- no longer used (the free path never attested a spend).

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
  v_wallet     text;
  v_used       int;
  v_balance    bigint;
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
      'requiresPeones', false,
      'spent', v_dup_spent,
      'balance', v_balance,
      'scoreSaveId', p_save_id
    );
  end if;

  -- 2. ALWAYS-FREE path — no quota gate, no balance touched, no sink. Off-chain
  --    persistence is unconditionally free.
  insert into public.score_saves
    (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent, metadata)
  values
    (p_save_id, v_wallet, p_level_id, p_score, p_time_ms, p_game_id, 'free', 0, p_metadata);

  v_used := (select count(*) from public.score_saves where wallet = v_wallet);
  v_balance := coalesce(
    (select balance from public.peones_balances where wallet = v_wallet), 0);

  return jsonb_build_object(
    'status', 'saved',
    'mode', 'free',
    'freeUsed', v_used,
    'requiresPeones', false,
    'spent', 0,
    'balance', v_balance,
    'scoreSaveId', p_save_id
  );
end;
$$;

comment on function public.save_basic_score(text, text, int, int, int, text, text, jsonb) is
  'SaveScore basic atomic RPC. advisory-lock per wallet -> dedup -> ALWAYS-FREE insert (mode=free, peones_spent=0). Never calls peones_spend; the save_game sink never fires for basic saves. Works at 0 balance. Off-chain persistence is unconditionally free (MiniPay Lote 2, 2026-07-08).';
