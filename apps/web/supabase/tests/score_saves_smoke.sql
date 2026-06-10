-- SaveScore off-chain — Slice 1 behavioural smoke.
--
-- Runs the 6 core cases of save_basic_score against a LIVE Postgres
-- (local supabase / Docker). Text-based schema drift is covered by the
-- vitest guard (src/lib/scores/__tests__/save-basic-score-schema.test.ts);
-- THIS file proves the runtime behaviour the guard cannot.
--
-- Run:
--   supabase start                 # from apps/web (Docker)
--   supabase db reset              # applies all migrations incl. this slice
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
--        -f supabase/tests/score_saves_smoke.sql
--
-- The whole script runs in ONE transaction and ROLLBACKs at the end,
-- so it is repeatable and never persists smoke rows. A failed assertion
-- RAISEs and aborts; success prints 'SCORE_SAVES SMOKE — ALL PASSED'.

begin;

do $$
declare
  w_a    text := '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  w_b    text := '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  r      jsonb;
  v_cnt  int;
  v_bal  bigint;
  v_scores_before bigint;
  v_scores_after  bigint;
  i      int;
begin
  -- Baseline: how many rows the legacy `scores` table holds (must not
  -- change — the RPC must never touch it). Guard against the table not
  -- existing in a bare local DB.
  begin
    execute 'select count(*) from public.scores' into v_scores_before;
  exception when undefined_table then
    v_scores_before := -1;  -- legacy table absent locally; isolation still holds
  end;

  -- ── Case 1: 5 free saves for wallet A ────────────────────────────
  for i in 1..5 loop
    r := public.save_basic_score(
      'A:1:game-' || i, w_a, 1, 100 + i, 5000, 'game-' || i, 'att-a-' || i, null);
    if r->>'status' <> 'saved' or r->>'mode' <> 'free' then
      raise exception 'Case1 save % expected saved/free, got %', i, r;
    end if;
  end loop;
  v_cnt := (select count(*) from public.score_saves where wallet = w_a);
  if v_cnt <> 5 then raise exception 'Case1 expected 5 rows, got %', v_cnt; end if;
  if (r->>'freeRemaining')::int <> 0 or (r->>'requiresPeones')::boolean <> true then
    raise exception 'Case1 5th save should exhaust the quota, got %', r;
  end if;

  -- ── Case 2: 6th save, balance 0 → insufficient, NO new row ───────
  r := public.save_basic_score('A:1:game-6', w_a, 1, 200, 5000, 'game-6', 'att-a-6', null);
  if r->>'status' <> 'insufficient_peones' then
    raise exception 'Case2 expected insufficient_peones, got %', r;
  end if;
  v_cnt := (select count(*) from public.score_saves where wallet = w_a);
  if v_cnt <> 5 then raise exception 'Case2 must NOT insert a row, count=%', v_cnt; end if;

  -- ── Case 3: fund 2 Peones, 6th save → paid, 1 spent ─────────────
  insert into public.peones_ledger
    (wallet, event_type, amount, source, source_id, idempotency_key, attestation_hash, day_utc)
  values
    (w_a, 'earn', 2, 'admin_grant', 'smoke', 'smoke:earn:a', 'att-earn-a',
     (now() at time zone 'utc')::date);

  r := public.save_basic_score('A:1:game-6', w_a, 1, 200, 5000, 'game-6', 'att-a-6', null);
  if r->>'status' <> 'saved' or r->>'mode' <> 'peones' or (r->>'spent')::int <> 1 then
    raise exception 'Case3 expected saved/peones/spent=1, got %', r;
  end if;
  if (r->>'balance')::bigint <> 1 then
    raise exception 'Case3 expected balance 1 after spend, got %', r->>'balance';
  end if;
  v_cnt := (select count(*) from public.score_saves where wallet = w_a);
  if v_cnt <> 6 then raise exception 'Case3 expected 6 rows, got %', v_cnt; end if;

  -- ── Case 4: replay same save_id → duplicate, no 2nd row/charge ──
  r := public.save_basic_score('A:1:game-6', w_a, 1, 200, 5000, 'game-6', 'att-a-6', null);
  if r->>'status' <> 'duplicate' then raise exception 'Case4 expected duplicate, got %', r; end if;
  v_cnt := (select count(*) from public.score_saves where wallet = w_a);
  if v_cnt <> 6 then raise exception 'Case4 must NOT add a row, count=%', v_cnt; end if;
  v_bal := coalesce((select balance from public.peones_balances where wallet = w_a), 0);
  if v_bal <> 1 then raise exception 'Case4 must NOT double-charge, balance=%', v_bal; end if;

  -- ── Case 5: fresh wallet B first save → free ────────────────────
  r := public.save_basic_score('B:2:game-x', w_b, 2, 300, 4000, 'game-x', 'att-b-1', null);
  if r->>'status' <> 'saved' or r->>'mode' <> 'free' or (r->>'freeUsed')::int <> 1 then
    raise exception 'Case5 expected saved/free/freeUsed=1, got %', r;
  end if;

  -- ── Case 6: legacy `scores` table untouched ─────────────────────
  if v_scores_before >= 0 then
    select count(*) into v_scores_after from public.scores;
    if v_scores_after <> v_scores_before then
      raise exception 'Case6 legacy scores changed: % -> %', v_scores_before, v_scores_after;
    end if;
  end if;

  raise notice 'SCORE_SAVES SMOKE — ALL PASSED';
end $$;

rollback;
