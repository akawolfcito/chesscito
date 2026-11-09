-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK DE EMERGENCIA — solo si hay que volver al código anterior.
--
-- ⚠️ EL ORDEN IMPORTA: correr ESTO **ANTES** de revertir el código.
--    Al revés, el código viejo llama una firma que no existe y TODOS los
--    saves fallan con 500.
--
-- NO borra datos. `surface` y `score_write_sessions` se dejan en pie a
-- propósito: son aditivos, no molestan al código viejo, y borrarlos
-- destruiría la provenance de las filas escritas durante el deploy.
-- ═══════════════════════════════════════════════════════════════════════

begin;

set local lock_timeout = '5s';

-- Restaurar la firma de 8 args que el código anterior llama.
-- (Cuerpo idéntico al de 20260708120000_savescore_always_free.sql.)
drop function if exists public.save_basic_score(text,text,int,int,int,text,text,jsonb,text);
drop function if exists public.save_basic_score(text,text,int,int,int,text,text,jsonb);

create function public.save_basic_score(
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
  perform pg_advisory_xact_lock(hashtext(v_wallet));

  select mode, peones_spent into v_dup_mode, v_dup_spent
    from public.score_saves where save_id = p_save_id;

  if found then
    v_used := (select count(*) from public.score_saves where wallet = v_wallet);
    v_balance := coalesce(
      (select balance from public.peones_balances where wallet = v_wallet), 0);
    return jsonb_build_object(
      'status', 'duplicate', 'mode', v_dup_mode, 'freeUsed', v_used,
      'requiresPeones', false, 'spent', v_dup_spent, 'balance', v_balance,
      'scoreSaveId', p_save_id);
  end if;

  insert into public.score_saves
    (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent, metadata)
  values
    (p_save_id, v_wallet, p_level_id, p_score, p_time_ms, p_game_id, 'free', 0, p_metadata);

  v_used := (select count(*) from public.score_saves where wallet = v_wallet);
  v_balance := coalesce(
    (select balance from public.peones_balances where wallet = v_wallet), 0);

  return jsonb_build_object(
    'status', 'saved', 'mode', 'free', 'freeUsed', v_used,
    'requiresPeones', false, 'spent', 0, 'balance', v_balance,
    'scoreSaveId', p_save_id);
end $$;

notify pgrst, 'reload schema';

commit;

-- Las vistas bigint NO se revierten: son compatibles hacia atrás y revertirlas
-- reintroduce el bug de overflow (audit R13) que tumba Leaders para todos.
