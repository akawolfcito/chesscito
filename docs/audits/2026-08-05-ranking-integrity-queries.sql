-- Chesscito — consultas de A1 + integridad de ranking (2026-08-05).
-- SOLO LECTURA (`set default_transaction_read_only = on`). Wallets anonimizadas.
-- Informe: docs/audits/2026-08-05-session-limit-and-ranking-integrity.md

\pset pager off
\echo === analytics_events shape ===
select column_name, data_type
  from information_schema.columns
 where table_schema='public' and table_name='analytics_events'
 order by ordinal_position;

\echo === volume + range ===
select count(*) as rows, min(created_at)::date as first, max(created_at)::date as last
  from public.analytics_events;

\echo === score_write_sessions shape ===
select column_name, data_type
  from information_schema.columns
 where table_schema='public' and table_name='score_write_sessions'
 order by ordinal_position;
\pset pager off
-- The 8 extreme wallets = those with >= 40 distinct exercise_id in score_attempts.

\echo === B1. write sessions per wallet (extremes) ===
with ext as (
  select wallet from public.score_attempts where exercise_id is not null
   group by 1 having count(distinct exercise_id) >= 40
)
select left(md5(s.wallet),8) as tag,
       count(*) as sessions,
       min(s.max_saves) as max_saves,
       sum(s.used_saves) as used_total,
       count(*) filter (where s.used_saves >= s.max_saves) as exhausted_sessions,
       count(distinct s.surface) as surfaces,
       min(s.created_at) as first_session,
       max(s.created_at) as last_session
  from public.score_write_sessions s join ext on ext.wallet = s.wallet
 group by 1 order by used_total desc;

\echo === B2. cadence: seconds between consecutive attempts (extremes) ===
with ext as (
  select wallet from public.score_attempts where exercise_id is not null
   group by 1 having count(distinct exercise_id) >= 40
),
gaps as (
  select a.wallet,
         extract(epoch from a.created_at
                 - lag(a.created_at) over (partition by a.wallet order by a.created_at)) as gap_s
    from public.score_attempts a join ext on ext.wallet = a.wallet
)
select left(md5(wallet),8) as tag,
       count(gap_s) as gaps,
       round(min(gap_s)::numeric,1) as min_s,
       round(percentile_cont(0.5) within group (order by gap_s)::numeric,1) as median_s,
       round(avg(gap_s)::numeric,1) as avg_s,
       round(max(gap_s)::numeric,1) as max_s,
       count(*) filter (where gap_s < 3) as gaps_under_3s,
       round(extract(epoch from max(created_at)-min(created_at))/60) as span_min
  from (select a.*, extract(epoch from a.created_at
             - lag(a.created_at) over (partition by a.wallet order by a.created_at)) as gap_s
          from public.score_attempts a join ext on ext.wallet = a.wallet) g
 group by 1 order by span_min;

\echo === B3. reported solve time (time_ms) — plausibility ===
with ext as (
  select wallet from public.score_attempts where exercise_id is not null
   group by 1 having count(distinct exercise_id) >= 40
)
select left(md5(a.wallet),8) as tag,
       count(*) as attempts,
       min(a.time_ms) as min_ms,
       round(percentile_cont(0.5) within group (order by a.time_ms)) as median_ms,
       max(a.time_ms) as max_ms,
       count(*) filter (where a.time_ms = 1000) as exactly_1000ms
  from public.score_attempts a join ext on ext.wallet = a.wallet
 group by 1 order by median_ms;

\echo === B4. score regression (localStorage wipe detector) ===
-- Within one wallet+level, a LATER attempt reporting a LOWER piece total means
-- local progress was reset (the total is derived from localStorage stars).
with seq as (
  select wallet, level_id, created_at, score,
         max(score) over (partition by wallet, level_id
                          order by created_at
                          rows between unbounded preceding and 1 preceding) as prev_max
    from public.score_attempts
)
select left(md5(wallet),8) as tag,
       count(*) filter (where prev_max is not null and score < prev_max) as regressions,
       count(distinct level_id) filter (where prev_max is not null and score < prev_max) as levels_affected
  from seq group by 1 having count(*) filter (where prev_max is not null and score < prev_max) > 0
 order by regressions desc limit 20;

\echo === B5. surface / id source / grade mix (extremes) ===
with ext as (
  select wallet from public.score_attempts where exercise_id is not null
   group by 1 having count(distinct exercise_id) >= 40
)
select left(md5(a.wallet),8) as tag,
       count(*) filter (where a.surface='learn') as learn,
       count(*) filter (where a.surface='play') as play,
       count(*) filter (where a.attempt_id_source='client') as src_client,
       count(*) filter (where a.attempt_id_source='server') as src_server,
       count(*) filter (where a.grade_status='ungraded') as ungraded,
       count(*) filter (where a.save_status='saved') as saved,
       count(*) filter (where a.save_status='duplicate') as dup
  from public.score_attempts a join ext on ext.wallet = a.wallet
 group by 1 order by tag;

\echo === B6. item 12 — sessions that hit their budget, all wallets ===
select max_saves, count(*) as sessions,
       count(*) filter (where used_saves >= max_saves) as exhausted,
       count(distinct wallet) as wallets
  from public.score_write_sessions group by 1 order by 1;

\echo === B7. hourly shape of the burst days (all wallets) ===
select created_at::date as d,
       extract(hour from created_at at time zone 'utc')::int as utc_hour,
       count(*) as attempts, count(distinct wallet) as wallets
  from public.score_attempts
 where created_at >= date '2026-08-03'
 group by 1,2 order by 1,2;
\pset pager off
\echo === B4b. are the "regressions" a lane artifact? (grade_status of the regressing row) ===
with seq as (
  select wallet, level_id, created_at, score, grade_status, attempt_id_source,
         max(score) over (partition by wallet, level_id
                          order by created_at
                          rows between unbounded preceding and 1 preceding) as prev_max
    from public.score_attempts
)
select grade_status, attempt_id_source,
       count(*) filter (where prev_max is not null and score < prev_max) as regressing_rows,
       count(*) filter (where prev_max is not null) as comparable_rows,
       round(100.0 * count(*) filter (where prev_max is not null and score < prev_max)
             / nullif(count(*) filter (where prev_max is not null),0), 1) as pct
  from seq group by 1,2 order by regressing_rows desc;

\echo === B4c. size of the drop — a wipe is a big drop, a lane race is one step ===
with seq as (
  select wallet, level_id, created_at, score, grade_status,
         max(score) over (partition by wallet, level_id
                          order by created_at
                          rows between unbounded preceding and 1 preceding) as prev_max
    from public.score_attempts
)
select (prev_max - score) as drop_points, count(*) as rows
  from seq where prev_max is not null and score < prev_max
 group by 1 order by 1 limit 20;

\echo === B4d. did any wallet ever drop back to the FLOOR (100 = zero stars)? ===
with seq as (
  select wallet, level_id, created_at, score,
         max(score) over (partition by wallet, level_id
                          order by created_at
                          rows between unbounded preceding and 1 preceding) as prev_max
    from public.score_attempts
)
select count(*) as hard_resets, count(distinct wallet) as wallets
  from seq where prev_max is not null and score = 100 and prev_max > 500;

\echo === B5b. is `ungraded` really the piece-total save lane? (score vs stars) ===
select grade_status,
       count(*) as rows,
       count(*) filter (where score % 100 = 0) as multiples_of_100,
       min(score) as min_score, max(score) as max_score
  from public.score_attempts group by 1 order by 1;

\echo === C1. scores ABOVE the legitimate per-level ceiling (rook/knight/pawn/queen/king 3000, bishop 2700) ===
select 'score_saves' as src, level_id, count(*) as rows, count(distinct wallet) as wallets,
       max(score) as max_score
  from public.score_saves
 where (level_id = 2 and score > 2700) or (level_id <> 2 and score > 3000)
 group by 1,2
union all
select 'score_attempts', level_id, count(*), count(distinct wallet), max(score)
  from public.score_attempts
 where (level_id = 2 and score > 2700) or (level_id <> 2 and score > 3000)
 group by 1,2
union all
select 'scores(onchain)', level_id, count(*), count(distinct player), max(score)
  from public.scores
 where (level_id = 2 and score > 2700) or (level_id <> 2 and score > 3000)
 group by 1,2
 order by 1,2;

\echo === C2. non-multiples of 100 anywhere ===
select 'score_saves' as src, count(*) filter (where score % 100 <> 0) as non_multiples, count(*) as total
  from public.score_saves
union all select 'score_attempts', count(*) filter (where score % 100 <> 0), count(*) from public.score_attempts
union all select 'scores(onchain)', count(*) filter (where score % 100 <> 0), count(*) from public.scores;

\echo === C3. how many score_saves rows would a per-level ceiling invalidate ===
select level_id,
       count(*) as rows,
       count(*) filter (where score > case when level_id=2 then 2700 else 3000 end) as over_ceiling,
       count(distinct wallet) filter (where score > case when level_id=2 then 2700 else 3000 end) as wallets_over
  from public.score_saves group by 1 order by 1;
