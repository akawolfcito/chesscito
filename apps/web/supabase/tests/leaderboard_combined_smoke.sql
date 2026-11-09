-- SaveScore off-chain — Slice 4 behavioural smoke.
--
-- Proves the runtime behaviour of `leaderboard_combined_v` + the
-- re-pointed `get_leaderboard()` against a LIVE Postgres (local
-- supabase / Docker). Text-based schema drift is covered by the vitest
-- guard (src/lib/scores/__tests__/leaderboard-combined-schema.test.ts);
-- THIS file proves what the guard cannot:
--   * legacy on-chain `scores` AND off-chain `score_saves` both surface;
--   * best (MAX) score per (player, level) across BOTH sources;
--   * totals summed per player, ranked desc;
--   * is_verified sourced from passport_cache (off-chain-only = false);
--   * get_leaderboard() returns exactly what the view returns.
--
-- Run:
--   supabase start                 # from apps/web (Docker)
--   supabase db reset              # applies all migrations incl. this slice
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
--        -f supabase/tests/leaderboard_combined_smoke.sql
--
-- The whole script runs in ONE transaction and ROLLBACKs at the end, so
-- it is repeatable and never persists smoke rows. A failed assertion
-- RAISEs and aborts; success prints 'LEADERBOARD COMBINED SMOKE — ALL PASSED'.
--
-- NOTE: this smoke assumes an EMPTY scores/score_saves (fresh db reset).
-- The combined view is LIMIT 10; the fixtures below are the only rows so
-- ranks are deterministic. The legacy `leaderboard_v` is intentionally
-- NOT asserted here — it has no versioned baseline (lives only in
-- src/lib/supabase/schema.sql); its isolation is the vitest guard's job.

begin;

do $$
declare
  -- On-chain only, passport-verified.
  w_a   text := '0xaaaa0000000000000000000000000000000000aa';
  -- Off-chain only (score_saves), NOT in passport_cache → unverified.
  w_b   text := '0xbbbb0000000000000000000000000000000000bb';
  -- BOTH sources on the same level → MAX must win; unverified.
  w_c   text := '0xcccc0000000000000000000000000000000000cc';

  v_total   int;
  v_rank    int;
  v_ver     boolean;
  v_rows    int;
  v_rpc_rows int;
begin
  -- ── Fixtures ─────────────────────────────────────────────────────
  -- Player A (on-chain): level1=100, level2=50 → total 150, verified.
  insert into public.scores (player, level_id, score, time_ms, tx_hash)
  values
    (w_a, 1, 100, 5000, '0xsmoke_a_l1'),
    (w_a, 2,  50, 6000, '0xsmoke_a_l2');
  insert into public.passport_cache (player, is_verified)
  values (w_a, true);

  -- Player B (off-chain): level1=200 → total 200, unverified.
  insert into public.score_saves
    (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent)
  values
    (w_b || ':1:gB', w_b, 1, 200, 7000, 'gB', 'free', 0);

  -- Player C (both, level1): on-chain 80 vs off-chain 120 → MAX 120.
  insert into public.scores (player, level_id, score, time_ms, tx_hash)
  values (w_c, 1, 80, 8000, '0xsmoke_c_l1');
  insert into public.score_saves
    (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent)
  values (w_c || ':1:gC', w_c, 1, 120, 8100, 'gC', 'free', 0);

  -- ── Case 1: all three players present ────────────────────────────
  v_rows := (select count(*) from public.leaderboard_combined_v
             where player in (w_a, w_b, w_c));
  if v_rows <> 3 then
    raise exception 'Case1 expected 3 combined rows, got %', v_rows;
  end if;

  -- ── Case 2: Player A totals on-chain levels, stays verified ──────
  select total_score, rank, is_verified into v_total, v_rank, v_ver
    from public.leaderboard_combined_v where player = w_a;
  if v_total <> 150 then raise exception 'Case2 A total expected 150, got %', v_total; end if;
  if v_ver is not true then raise exception 'Case2 A expected verified=true, got %', v_ver; end if;

  -- ── Case 3: Player B off-chain surfaces, unverified ──────────────
  select total_score, is_verified into v_total, v_ver
    from public.leaderboard_combined_v where player = w_b;
  if v_total <> 200 then raise exception 'Case3 B total expected 200, got %', v_total; end if;
  if v_ver is not false then raise exception 'Case3 B expected verified=false, got %', v_ver; end if;

  -- ── Case 4: Player C — MAX across sources on the shared level ────
  select total_score, is_verified into v_total, v_ver
    from public.leaderboard_combined_v where player = w_c;
  if v_total <> 120 then raise exception 'Case4 C expected MAX=120, got %', v_total; end if;
  if v_ver is not false then raise exception 'Case4 C expected verified=false, got %', v_ver; end if;

  -- ── Case 5: ranking order B(200) > A(150) > C(120) ───────────────
  select rank into v_rank from public.leaderboard_combined_v where player = w_b;
  if v_rank <> 1 then raise exception 'Case5 B expected rank 1, got %', v_rank; end if;
  select rank into v_rank from public.leaderboard_combined_v where player = w_a;
  if v_rank <> 2 then raise exception 'Case5 A expected rank 2, got %', v_rank; end if;
  select rank into v_rank from public.leaderboard_combined_v where player = w_c;
  if v_rank <> 3 then raise exception 'Case5 C expected rank 3, got %', v_rank; end if;

  -- ── Case 6: get_leaderboard() === the view (single source) ───────
  v_rpc_rows := (select count(*) from public.get_leaderboard()
                 where player in (w_a, w_b, w_c));
  if v_rpc_rows <> 3 then
    raise exception 'Case6 get_leaderboard expected 3 rows, got %', v_rpc_rows;
  end if;
  -- Cross-check one tuple end to end.
  select total_score, rank, is_verified into v_total, v_rank, v_ver
    from public.get_leaderboard() where player = w_b;
  if v_total <> 200 or v_rank <> 1 or v_ver is not false then
    raise exception 'Case6 get_leaderboard B mismatch: total=% rank=% ver=%',
      v_total, v_rank, v_ver;
  end if;

  raise notice 'LEADERBOARD COMBINED SMOKE — ALL PASSED';
end;
$$;

rollback;
