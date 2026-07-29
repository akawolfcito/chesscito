-- pgbench fixture for a non-production database only.
--
-- Slice 2A — DB-23: reads of the weekly board while attempts are landing.
--
-- ⚠️ THIS FIXTURE WRITES AND DOES NOT ROLL BACK. Every client inserts a real
-- `score_attempts` row on a fresh random wallet. Run it against a disposable
-- database — never prod, never a database whose contents matter.
--
-- WHAT IS ACTUALLY AT RISK HERE
-- -----------------------------
-- `weekly_ranking` is a single `stable` SQL statement, so one call sees one
-- snapshot and the ranking it computes is internally consistent by
-- construction. That is the point: this fixture is a REGRESSION guard on that
-- property, not a hunt for a bug that exists today. The day someone makes the
-- function `volatile`, splits it into two statements, or moves the cut into a
-- second round trip, a read can straddle two snapshots — and the symptom is a
-- board where one wallet appears twice or the ranks do not start at 1. Under
-- load, that shows up as a flicker nobody can reproduce.
--
-- WHY NOT "no duplicate rank"
-- ---------------------------
-- `rank()` gives tied wallets the SAME rank on purpose, so equal ranks are
-- legal and asserting their absence would fail on an honest tie. The two
-- invariants below hold regardless of ties.
--
-- Run with 8 clients against a disposable Supabase test database:
--
--   pgbench -n -c 8 -j 8 -t 25 -f this-file "$SUPABASE_TEST_DATABASE_URL"
--
-- Any raised exception aborts that client and pgbench reports it. A clean run
-- means every read saw a coherent board while 200 attempts landed underneath.

\set r random(1, 2147483647)

insert into public.score_attempts (
  attempt_id, wallet, surface, level_id,
  grade_status, score, time_ms, save_status, save_id,
  attempt_index, attempt_id_source
) values (
  md5(random()::text || clock_timestamp()::text),
  '0x' || lpad(to_hex(:r), 40, '0'),
  'learn',
  1 + (:r % 6),
  'ungraded',
  1 + (:r % 500),
  1000,
  'saved',
  'concurrency-fixture',
  1,
  'server'
);

do $$
declare
  w_start timestamptz := date_trunc('week', now() at time zone 'utc') at time zone 'utc';
  v_rows     int;
  v_wallets  int;
  v_min_rank int;
begin
  select count(*), count(distinct wallet), min(rank)
    into v_rows, v_wallets, v_min_rank
    from public.get_weekly_leaderboard('learn', w_start, w_start + interval '7 days');

  -- 1. One wallet, one row. A read that straddled two snapshots could emit the
  --    same wallet twice.
  if v_rows <> v_wallets then
    raise exception
      'DB-23 FAILED: % rows but only % distinct wallets in one read', v_rows, v_wallets;
  end if;

  -- 2. A non-empty board starts at rank 1. A cut applied to a ranking computed
  --    against a different snapshot could return rows 2..11.
  if v_rows > 0 and v_min_rank <> 1 then
    raise exception 'DB-23 FAILED: board starts at rank %, expected 1', v_min_rank;
  end if;
end $$;
