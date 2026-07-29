-- Slice 2A — weekly leaderboard behavioural smoke.
--
-- Spec: docs/specs/2026-07-29-leaders-weekly-db.md (DB-1 … DB-22).
--
-- The vitest guard (src/lib/scores/__tests__/leaderboard-weekly-schema.test.ts)
-- reads the migration as TEXT and can only prove the properties are still
-- written down. THIS file proves the ones only a running Postgres can answer:
-- that MAX-per-level really is the total, that the half-open bound really
-- excludes week_end, that `anon` really cannot execute, and that the fallback
-- view really computes the same window on a non-UTC server.
--
-- Run:
--   supabase start                 # from apps/web (Docker)
--   supabase db reset              # applies all migrations incl. this slice
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
--        -f supabase/tests/leaderboard_weekly_smoke.sql
--
-- Or, with no local psql binary:
--   docker exec -i supabase_db_web psql -U postgres -d postgres \
--     < supabase/tests/leaderboard_weekly_smoke.sql
--
-- The whole script runs in ONE transaction and ROLLBACKs at the end, so it is
-- repeatable and never persists smoke rows. A failed assertion RAISEs and
-- aborts; success prints 'LEADERBOARD WEEKLY SMOKE — ALL PASSED'.
--
-- NOT COVERED HERE: DB-23, true concurrency. Two sessions racing a read against
-- inserts cannot be expressed in one psql connection — that is
-- `leaderboard_weekly_concurrency.sql`, a pgbench fixture, per the precedent set
-- by `score_attempts_same_attempt_concurrency.sql`.

begin;

-- ─────────────────────────────────────────────────────────────────
-- Fixture helper. pg_temp so it dies with the transaction.
-- ─────────────────────────────────────────────────────────────────
create function pg_temp.att(
  p_wallet  text,
  p_surface text,
  p_level   int,
  p_score   int,
  p_at      timestamptz,
  p_status  text default 'saved'
) returns void language plpgsql as $fn$
declare
  v_idx int;
begin
  select coalesce(max(attempt_index), 0) + 1 into v_idx
    from public.score_attempts
   where wallet = p_wallet and surface = p_surface and level_id = p_level;

  insert into public.score_attempts (
    attempt_id, wallet, surface, level_id,
    grade_status, score, time_ms, save_status, save_id,
    attempt_index, attempt_id_source, created_at
  ) values (
    md5(random()::text || clock_timestamp()::text),
    p_wallet, p_surface, p_level,
    'ungraded', p_score, 1000, p_status,
    lower(p_wallet || ':' || p_level::text || ':' || p_score::text),
    v_idx, 'server', p_at
  );
end $fn$;

-- ─────────────────────────────────────────────────────────────────
-- 1. Ranking semantics — DB-1 … DB-9 (surface 'learn')
-- ─────────────────────────────────────────────────────────────────
do $$
declare
  w_start timestamptz := date_trunc('week', timestamptz '2026-07-29 12:00:00+00');
  w_end   timestamptz;
  w1 text := '0x' || repeat('1', 40);   -- MAX per level, sum across levels
  w2 text := '0x' || repeat('2', 40);   -- only out-of-window play
  w3 text := '0x' || repeat('3', 40);   -- attempt exactly at week_start
  w4 text := '0x' || repeat('4', 40);   -- attempt exactly at week_end
  w5 text := '0x' || repeat('5', 40);   -- duplicate re-achievement
  w6 text := '0x' || repeat('6', 40);   -- ties with w5 on total
  w7 text := '0x' || repeat('7', 40);   -- single attempt, no multiplier
  v_total int;
  v_rank  int;
  v_rows  int;
  r5      int;
  r6      int;
begin
  w_end := w_start + interval '7 days';

  -- w1: level 1 → 100, then 250, then 180 (later and LOWER).
  --     level 2 → 50.  Expected total: 250 + 50 = 300.
  perform pg_temp.att(w1, 'learn', 1, 100, w_start + interval '1 hour');
  perform pg_temp.att(w1, 'learn', 1, 250, w_start + interval '2 hours');
  perform pg_temp.att(w1, 'learn', 1, 180, w_start + interval '3 hours');
  perform pg_temp.att(w1, 'learn', 2,  50, w_start + interval '4 hours');
  -- A far better run, one day BEFORE the window. Must not count.
  perform pg_temp.att(w1, 'learn', 1, 900, w_start - interval '1 day');

  -- w2: everything outside the window.
  perform pg_temp.att(w2, 'learn', 1, 500, w_start - interval '2 days');
  perform pg_temp.att(w2, 'learn', 1, 500, w_end   + interval '2 days');

  -- w3 / w4: the half-open boundary.
  perform pg_temp.att(w3, 'learn', 1, 70, w_start);
  perform pg_temp.att(w4, 'learn', 1, 70, w_end);

  -- w5: reaches 100 early, re-achieves the SAME 100 later as a duplicate.
  -- w6: reaches 100 in between. If achieved_at were taken from the LAST row (or
  -- from the first attempt on the level regardless of score), w6 would outrank
  -- w5. Correct behaviour: w5 got there first, so w5 ranks higher.
  perform pg_temp.att(w5, 'learn', 1, 100, w_start + interval '1 hour');
  perform pg_temp.att(w6, 'learn', 1, 100, w_start + interval '2 hours');
  perform pg_temp.att(w5, 'learn', 1, 100, w_start + interval '3 hours', 'duplicate');

  -- w7: exactly one attempt.
  perform pg_temp.att(w7, 'learn', 1, 250, w_start + interval '5 hours');

  -- ── DB-1 / DB-3 / DB-4: MAX per level, summed, later-lower ignored ──
  select total_score into v_total
    from public.weekly_ranking('learn', w_start, w_end) where wallet = w1;
  if v_total is distinct from 300 then
    raise exception 'DB-1/3/4 FAILED: expected total 300 for w1, got %', v_total;
  end if;

  -- ── DB-2: a higher attempt outside the window does not count ──
  -- Already proven by the 900 above: it would have made the total 950.
  if v_total = 950 then
    raise exception 'DB-2 FAILED: out-of-window attempt counted';
  end if;

  -- ── DB-5: no in-window attempts ⇒ no row from either function ──
  select count(*) into v_rows
    from public.weekly_ranking('learn', w_start, w_end) where wallet = w2;
  if v_rows <> 0 then
    raise exception 'DB-5 FAILED: w2 has % rows, expected 0', v_rows;
  end if;
  select count(*) into v_rows
    from public.get_weekly_player_rank(w2, 'learn', w_start, w_end);
  if v_rows <> 0 then
    raise exception 'DB-5 FAILED: get_weekly_player_rank returned % rows for w2', v_rows;
  end if;

  -- ── DB-6: week_start IN, week_end OUT ──
  select count(*) into v_rows
    from public.weekly_ranking('learn', w_start, w_end) where wallet = w3;
  if v_rows <> 1 then
    raise exception 'DB-6 FAILED: attempt at week_start excluded';
  end if;
  select count(*) into v_rows
    from public.weekly_ranking('learn', w_start, w_end) where wallet = w4;
  if v_rows <> 0 then
    raise exception 'DB-6 FAILED: attempt at week_end included';
  end if;

  -- ── DB-7 / DB-9: tie broken by who got there FIRST ──
  select rank into r5 from public.weekly_ranking('learn', w_start, w_end) where wallet = w5;
  select rank into r6 from public.weekly_ranking('learn', w_start, w_end) where wallet = w6;
  if r5 is null or r6 is null then
    raise exception 'DB-7 FAILED: tied wallets missing from the ranking';
  end if;
  if r5 >= r6 then
    raise exception 'DB-7/9 FAILED: w5 reached 100 first but ranks % vs w6 %', r5, r6;
  end if;

  -- ── DB-9: the duplicate cannot raise the total above the best ──
  select total_score into v_total
    from public.weekly_ranking('learn', w_start, w_end) where wallet = w5;
  if v_total is distinct from 100 then
    raise exception 'DB-9 FAILED: duplicate inflated the total to %', v_total;
  end if;

  -- ── DB-8: no multiplier ──
  select total_score into v_total
    from public.weekly_ranking('learn', w_start, w_end) where wallet = w7;
  if v_total is distinct from 250 then
    raise exception 'DB-8 FAILED: expected 250 (no x100), got %', v_total;
  end if;

  raise notice 'DB-1 … DB-9 passed';
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 2. Cut, uncut player rank, agreement — DB-10 … DB-12 (surface 'play')
-- ─────────────────────────────────────────────────────────────────
do $$
declare
  w_start timestamptz := date_trunc('week', timestamptz '2026-07-29 12:00:00+00');
  w_end   timestamptz;
  v_rows  int;
  v_rank  int;
  v_rank2 int;
  w_11    text;
  i       int;
begin
  w_end := w_start + interval '7 days';

  -- 12 wallets, strictly descending totals: 1200, 1100 … 100.
  for i in 1..12 loop
    perform pg_temp.att(
      '0x' || lpad(to_hex(3735928559 + i), 40, '0'),
      'play', 1, (13 - i) * 100, w_start + (i || ' minutes')::interval);
  end loop;
  w_11 := '0x' || lpad(to_hex(3735928559 + 11), 40, '0');   -- total 200 → rank 11

  -- ── DB-10: the board is cut at 10 ──
  select count(*) into v_rows from public.get_weekly_leaderboard('play', w_start, w_end);
  if v_rows <> 10 then
    raise exception 'DB-10 FAILED: board returned % rows, expected 10', v_rows;
  end if;

  -- ── DB-11: the player rank is computed over the UNCUT set ──
  select rank into v_rank
    from public.get_weekly_player_rank(w_11, 'play', w_start, w_end);
  if v_rank is distinct from 11 then
    raise exception 'DB-11 FAILED: 11th wallet got rank %, expected 11', v_rank;
  end if;
  -- …and is genuinely absent from the cut board.
  select count(*) into v_rows
    from public.get_weekly_leaderboard('play', w_start, w_end) where wallet = w_11;
  if v_rows <> 0 then
    raise exception 'DB-11 FAILED: rank-11 wallet appeared in the top-10 board';
  end if;

  -- ── DB-12: both functions agree for a wallet present in both ──
  select rank into v_rank
    from public.get_weekly_leaderboard('play', w_start, w_end) order by rank limit 1;
  select rank into v_rank2
    from public.get_weekly_player_rank(
      (select wallet from public.get_weekly_leaderboard('play', w_start, w_end) order by rank limit 1),
      'play', w_start, w_end);
  if v_rank is distinct from v_rank2 then
    raise exception 'DB-12 FAILED: board says rank %, player rank says %', v_rank, v_rank2;
  end if;

  raise notice 'DB-10 … DB-12 passed';
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 3. Surface isolation and source selection — DB-13 … DB-17
-- ─────────────────────────────────────────────────────────────────
do $$
declare
  w_start timestamptz := date_trunc('week', timestamptz '2026-07-29 12:00:00+00');
  w_end   timestamptz;
  w_both  text := '0x' || repeat('b', 40);   -- plays BOTH surfaces
  w_learn text := '0x' || repeat('c', 40);   -- learn only
  w_play  text := '0x' || repeat('d', 40);   -- play only
  w_chain text := '0x' || repeat('e', 40);   -- on-chain only, no attempts
  v_learn int;
  v_play  int;
  v_rows  int;
begin
  w_end := w_start + interval '7 days';

  perform pg_temp.att(w_both,  'learn', 3, 400, w_start + interval '1 hour');
  perform pg_temp.att(w_both,  'play',  3,  60, w_start + interval '1 hour');
  perform pg_temp.att(w_learn, 'learn', 4, 310, w_start + interval '1 hour');
  perform pg_temp.att(w_play,  'play',  4,  55, w_start + interval '1 hour');

  -- On-chain only: rows in BOTH legacy sources, none in score_attempts.
  insert into public.scores (player, level_id, score, time_ms, tx_hash)
  values (w_chain, 1, 9999, 1000, '0xsmoke_weekly_chain');
  insert into public.score_saves
    (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent)
  values (w_chain || ':1:gw', w_chain, 1, 9999, 1000, 'gw', 'free', 0);

  -- ── DB-13: a play-only wallet never appears on the learn board ──
  select count(*) into v_rows
    from public.weekly_ranking('learn', w_start, w_end) where wallet = w_play;
  if v_rows <> 0 then
    raise exception 'DB-13 FAILED: play-only wallet leaked into learn';
  end if;

  -- ── DB-14: a learn-only wallet never appears on the play board ──
  select count(*) into v_rows
    from public.weekly_ranking('play', w_start, w_end) where wallet = w_learn;
  if v_rows <> 0 then
    raise exception 'DB-14 FAILED: learn-only wallet leaked into play';
  end if;

  -- ── DB-15 / DB-16: one wallet, two independent totals ──
  select total_score into v_learn
    from public.weekly_ranking('learn', w_start, w_end) where wallet = w_both;
  select total_score into v_play
    from public.weekly_ranking('play', w_start, w_end) where wallet = w_both;
  if v_learn is distinct from 400 then
    raise exception 'DB-16 FAILED: learn total is %, expected 400 (play must not add)', v_learn;
  end if;
  if v_play is distinct from 60 then
    raise exception 'DB-16 FAILED: play total is %, expected 60 (learn must not add)', v_play;
  end if;
  if v_learn = v_play then
    raise exception 'DB-15 FAILED: the two surfaces produced the same total';
  end if;

  -- ── DB-17: on-chain-only play is not weekly play ──
  select count(*) into v_rows
    from public.weekly_ranking('learn', w_start, w_end) where wallet = w_chain;
  if v_rows <> 0 then
    raise exception 'DB-17 FAILED: a wallet with only scores/score_saves rows ranked weekly';
  end if;

  raise notice 'DB-13 … DB-17 passed';
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 4. Privileges and structure — DB-18 … DB-21
-- ─────────────────────────────────────────────────────────────────
do $$
declare
  fns text[] := array[
    'public.weekly_ranking(text, timestamptz, timestamptz)',
    'public.get_weekly_leaderboard(text, timestamptz, timestamptz)',
    'public.get_weekly_player_rank(text, text, timestamptz, timestamptz)'
  ];
  f    text;
  role text;
  v_ok boolean;
  v_opts text[];
begin
  -- ── DB-18: effective EXECUTE, not the text of the revoke ──
  -- Supabase's default privileges grant EXECUTE explicitly to anon and
  -- authenticated on every new function, so a revoke from PUBLIC alone leaves
  -- them holding it. Only the catalogue can answer this.
  foreach f in array fns loop
    foreach role in array array['anon', 'authenticated'] loop
      if has_function_privilege(role, f, 'execute') then
        raise exception 'DB-18 FAILED: % can still EXECUTE %', role, f;
      end if;
    end loop;
    if not has_function_privilege('service_role', f, 'execute') then
      raise exception 'DB-18 FAILED: service_role cannot EXECUTE %', f;
    end if;
  end loop;

  -- ── DB-19: the view is not readable by client roles ──
  foreach role in array array['anon', 'authenticated'] loop
    if has_table_privilege(role, 'public.leaderboard_weekly_full_v', 'select') then
      raise exception 'DB-19 FAILED: % can SELECT the fallback view', role;
    end if;
  end loop;
  if not has_table_privilege('service_role', 'public.leaderboard_weekly_full_v', 'select') then
    raise exception 'DB-19 FAILED: service_role cannot SELECT the fallback view';
  end if;

  -- ── DB-20: security_invoker, so a future accidental grant still hits RLS ──
  select c.reloptions into v_opts
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'leaderboard_weekly_full_v';
  if v_opts is null or not ('security_invoker=true' = any(v_opts)) then
    raise exception 'DB-20 FAILED: view reloptions are %, expected security_invoker=true', v_opts;
  end if;

  -- ── DB-21: the composite index exists ──
  select exists(
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename  = 'score_attempts'
       and indexname  = 'score_attempts_surface_created_idx'
  ) into v_ok;
  if not v_ok then
    raise exception 'DB-21 FAILED: score_attempts_surface_created_idx is missing';
  end if;

  raise notice 'DB-18 … DB-21 passed';
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 5. The fallback view computes the same window off UTC — DB-22
-- ─────────────────────────────────────────────────────────────────
do $$
declare
  w_now  text := '0x' || repeat('a', 40);
  pinned_utc  timestamptz;
  pinned_kir  timestamptz;
  naive_utc   timestamptz;
  naive_kir   timestamptz;
  v_rows_utc  int;
  v_rows_kir  int;
begin
  -- A wallet that played in the CURRENT week: the view takes no parameters.
  perform pg_temp.att(w_now, 'learn', 5, 123, now());

  perform set_config('TimeZone', 'UTC', true);
  pinned_utc := date_trunc('week', now() at time zone 'utc') at time zone 'utc';
  naive_utc  := date_trunc('week', now() at time zone 'utc')::timestamptz;
  select count(*) into v_rows_utc
    from public.leaderboard_weekly_full_v
   where surface = 'learn' and wallet = w_now;

  perform set_config('TimeZone', 'Pacific/Kiritimati', true);   -- UTC+14
  pinned_kir := date_trunc('week', now() at time zone 'utc') at time zone 'utc';
  naive_kir  := date_trunc('week', now() at time zone 'utc')::timestamptz;
  select count(*) into v_rows_kir
    from public.leaderboard_weekly_full_v
   where surface = 'learn' and wallet = w_now;

  perform set_config('TimeZone', 'UTC', true);

  -- The test has teeth only if the UNPINNED form really does drift.
  if naive_utc = naive_kir then
    raise exception
      'DB-22 INCONCLUSIVE: the naive cast did not drift, so this test proves nothing';
  end if;

  if pinned_utc is distinct from pinned_kir then
    raise exception 'DB-22 FAILED: pinned window differs — % vs %', pinned_utc, pinned_kir;
  end if;

  if v_rows_utc <> 1 or v_rows_kir <> 1 then
    raise exception 'DB-22 FAILED: view rows differ by session timezone — % vs %',
      v_rows_utc, v_rows_kir;
  end if;

  raise notice 'DB-22 passed';
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 6. The relation exposes no has_onchain, and names identity `wallet`
-- ─────────────────────────────────────────────────────────────────
do $$
declare
  v_cols text[];
begin
  select array_agg(a.attname order by a.attnum) into v_cols
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'public' and c.relname = 'leaderboard_weekly_full_v';

  if 'has_onchain' = any(v_cols) then
    raise exception 'ASYMMETRY FAILED: the weekly relation exposes has_onchain';
  end if;
  if not ('wallet' = any(v_cols)) then
    raise exception 'CONTRACT FAILED: identity column is not named wallet — %', v_cols;
  end if;
  if 'player' = any(v_cols) then
    raise exception 'CONTRACT FAILED: the weekly relation must not expose `player` — %', v_cols;
  end if;

  raise notice 'contract columns passed';
end $$;

rollback;

\echo 'LEADERBOARD WEEKLY SMOKE — ALL PASSED'
