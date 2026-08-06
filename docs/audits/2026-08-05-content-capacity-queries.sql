-- Chesscito — consultas de la auditoria de capacidad de contenido (2026-08-05).
-- SOLO LECTURA. Ejecutadas con `set default_transaction_read_only = on`.
-- Toda wallet sale anonimizada con left(md5(wallet),8).
-- Informe: docs/audits/2026-08-05-content-capacity-audit.md

\pset pager off
\echo === session ===
select current_user, current_setting('default_transaction_read_only') as read_only;

\echo === tables of interest ===
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name in (
     'scores','score_saves','score_attempts','content_overlay','content_overlay_staging',
     'focus_day_ledger','focus_ledger_init','lite_season_passes','peones_ledger',
     'peones_balances','score_write_sessions','analytics_events','passport_cache'
   )
 order by table_name;

\echo === row counts ===
select 'scores' as t, count(*) from public.scores
union all select 'score_saves', count(*) from public.score_saves
union all select 'score_attempts', count(*) from public.score_attempts
union all select 'focus_day_ledger', count(*) from public.focus_day_ledger
union all select 'content_overlay', count(*) from public.content_overlay;

\echo === content_overlay shape ===
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'content_overlay'
 order by ordinal_position;
\pset pager off
\echo === overlay rows (no fen/explanation: content, not needed) ===
select id, kind, piece, tier, "order", disabled, stage, optimal_moves,
       updated_at::date as updated
  from public.content_overlay
 order by stage, piece, kind, "order", id;

\echo === overlay by stage/kind/disabled ===
select stage, kind, disabled, count(*)
  from public.content_overlay
 group by 1,2,3 order by 1,2,3;
\pset pager off
\echo === date ranges + distinct wallets ===
select 'scores' as src, min(created_at)::date as first, max(created_at)::date as last,
       count(distinct player) as wallets, count(*) as rows
  from public.scores
union all
select 'score_saves', min(created_at)::date, max(created_at)::date,
       count(distinct wallet), count(*)
  from public.score_saves
union all
select 'score_attempts', min(created_at)::date, max(created_at)::date,
       count(distinct wallet), count(*)
  from public.score_attempts;

\echo === score_attempts by surface / grade_status ===
select surface, grade_status, count(*), count(distinct wallet) as wallets,
       count(distinct exercise_id) as distinct_ex
  from public.score_attempts group by 1,2 order by 1,2;

\echo === attempts: exercise_id null vs present ===
select (exercise_id is null) as no_exercise_id, count(*), count(distinct wallet)
  from public.score_attempts group by 1;

\echo === distinct exercise_ids ever attempted in prod ===
select count(distinct exercise_id) from public.score_attempts where exercise_id is not null;

\echo === score distribution sanity: max score per level across score_saves ===
select level_id, count(distinct wallet) as wallets, max(score) as max_score,
       round(avg(score)) as avg_score
  from public.score_saves group by 1 order by 1;

\echo === same for legacy on-chain scores ===
select level_id, count(distinct player) as wallets, max(score) as max_score
  from public.scores group by 1 order by 1;
\pset pager off
-- Ceiling per level, from the shipped baseline catalog (exercises only, 3★ each):
--   1 rook 10, 2 bishop 9, 3 knight 10, 4 pawn 10, 5 queen 10, 6 king 10
-- => stars ceiling 177, score ceiling 17700.

\echo === 1. per-wallet permanent progress (stars from best score per level) ===
with lvl as (
  select player as wallet, level_id, max(score) as best from public.scores group by 1,2
  union all
  select wallet, level_id, max(score) from public.score_saves group by 1,2
),
best as (
  select wallet, level_id, max(best) as best from lvl group by 1,2
),
tot as (
  select wallet,
         sum(best)::int as total_score,
         sum(best)::numeric / 100 as total_stars
    from best group by 1
)
select count(*) as wallets,
       max(total_score) as max_score,
       round(max(total_stars)) as max_stars,
       round(avg(total_score)) as avg_score,
       percentile_disc(0.5) within group (order by total_score) as median_score,
       count(*) filter (where total_score >= 17700) as at_100pct,
       count(*) filter (where total_score >= 15930 and total_score < 17700) as pct_90_99,
       count(*) filter (where total_score >= 13275 and total_score < 15930) as pct_75_89,
       count(*) filter (where total_score >=  8850 and total_score < 13275) as pct_50_74,
       count(*) filter (where total_score <   8850) as under_50
  from tot;

\echo === 2. top 20 by permanent score (anonymised) ===
with lvl as (
  select player as wallet, level_id, max(score) as best from public.scores group by 1,2
  union all
  select wallet, level_id, max(score) from public.score_saves group by 1,2
),
best as (select wallet, level_id, max(best) as best from lvl group by 1,2),
tot as (select wallet, sum(best)::int as total_score from best group by 1),
act as (
  select wallet, min(created_at)::date as first_play, max(created_at)::date as last_play,
         count(*) as attempts, count(distinct created_at::date) as active_days,
         count(distinct exercise_id) filter (where exercise_id is not null) as distinct_ex
    from public.score_attempts group by 1
),
sav as (
  select wallet, min(created_at)::date as first_save, max(created_at)::date as last_save
    from public.score_saves group by 1
)
select left(md5(t.wallet),8) as tag,
       t.total_score,
       round(t.total_score/100.0)::int as stars,
       round(100.0*t.total_score/17700, 1) as pct_of_ceiling,
       coalesce(a.distinct_ex,0) as ex_seen_since_0729,
       coalesce(a.attempts,0) as attempts,
       coalesce(a.active_days,0) as active_days,
       s.first_save, coalesce(a.last_play, s.last_save) as last_activity
  from tot t
  left join act a on a.wallet = t.wallet
  left join sav s on s.wallet = t.wallet
 order by t.total_score desc, tag asc
 limit 20;

\echo === 3. stars per level for the top 10 (where the missing content is) ===
with lvl as (
  select player as wallet, level_id, max(score) as best from public.scores group by 1,2
  union all
  select wallet, level_id, max(score) from public.score_saves group by 1,2
),
best as (select wallet, level_id, max(best) as best from lvl group by 1,2),
tot as (select wallet, sum(best)::int as total_score from best group by 1),
top as (select wallet from tot order by total_score desc limit 10)
select left(md5(b.wallet),8) as tag,
       max(b.best) filter (where b.level_id=1)/100 as rook,
       max(b.best) filter (where b.level_id=2)/100 as bishop,
       max(b.best) filter (where b.level_id=3)/100 as knight,
       max(b.best) filter (where b.level_id=4)/100 as pawn,
       max(b.best) filter (where b.level_id=5)/100 as queen,
       max(b.best) filter (where b.level_id=6)/100 as king,
       sum(b.best)/100 as stars_of_177
  from best b join top on top.wallet = b.wallet
 group by 1 order by stars_of_177 desc;
\pset pager off
\echo === 4. which catalog ids have EVER been attempted in prod (74 of 78) ===
select exercise_id, count(*) as attempts, count(distinct wallet) as wallets
  from public.score_attempts where exercise_id is not null
 group by 1 order by 2 desc limit 100;

\echo === 5. distinct-exercise coverage distribution (score_attempts era only) ===
with cov as (
  select wallet, count(distinct exercise_id) as ex
    from public.score_attempts where exercise_id is not null group by 1
)
select count(*) as wallets_with_attempts,
       max(ex) as max_distinct_ex,
       round(avg(ex),1) as avg_distinct_ex,
       count(*) filter (where ex >= 78) as at_78,
       count(*) filter (where ex >= 70) as ge_70,
       count(*) filter (where ex >= 59) as ge_59,
       count(*) filter (where ex >= 40) as ge_40,
       count(*) filter (where ex < 10)  as lt_10
  from cov;

\echo === 6. repeats: attempts on an exercise the wallet already attempted ===
with ranked as (
  select wallet, exercise_id,
         row_number() over (partition by wallet, exercise_id order by created_at) as n
    from public.score_attempts where exercise_id is not null
)
select count(*) filter (where n = 1) as first_time_attempts,
       count(*) filter (where n > 1) as repeat_attempts,
       count(distinct wallet) filter (where n > 1) as wallets_repeating;

\echo === 7. per-wallet repeat ratio, top 20 by distinct coverage ===
with ranked as (
  select wallet, exercise_id, created_at,
         row_number() over (partition by wallet, exercise_id order by created_at) as n
    from public.score_attempts where exercise_id is not null
)
select left(md5(wallet),8) as tag,
       count(distinct exercise_id) as distinct_ex,
       count(*) as attempts,
       count(*) filter (where n > 1) as repeats,
       min(created_at)::date as first_day,
       max(created_at)::date as last_day,
       count(distinct created_at::date) as active_days
  from ranked group by 1
 order by distinct_ex desc, attempts desc limit 20;

\echo === 8. gate check: attempts on training_pass content (knight-tour-2/-3) ===
select exercise_id, count(*) as attempts, count(distinct wallet) as wallets
  from public.score_attempts
 where exercise_id in ('knight-tour-1','knight-tour-2','knight-tour-3')
 group by 1 order by 1;

\echo === 9. entitlements that could open the gate ===
select count(*) as season_pass_rows, count(distinct wallet) as wallets
  from public.lite_season_passes;

\echo === 10. session budget: wallets whose attempts pile up in one day ===
select attempts_in_day, count(*) as wallet_days
  from (
    select wallet, created_at::date as d, count(*) as attempts_in_day
      from public.score_attempts group by 1,2
  ) x
 where attempts_in_day >= 50
 group by 1 order by 1 desc;
\pset pager off
\echo === 6. repeats: attempts on an exercise the wallet already attempted ===
with ranked as (
  select wallet, exercise_id,
         row_number() over (partition by wallet, exercise_id order by created_at) as n
    from public.score_attempts where exercise_id is not null
)
select count(*) filter (where n = 1) as first_time_attempts,
       count(*) filter (where n > 1) as repeat_attempts,
       count(distinct wallet) filter (where n > 1) as wallets_repeating
  from ranked;

\echo === 7. per-wallet coverage + repeats, top 20 ===
with ranked as (
  select wallet, exercise_id, created_at,
         row_number() over (partition by wallet, exercise_id order by created_at) as n
    from public.score_attempts where exercise_id is not null
)
select left(md5(wallet),8) as tag,
       count(distinct exercise_id) as distinct_ex,
       count(*) as attempts,
       count(*) filter (where n > 1) as repeats,
       min(created_at)::date as first_day,
       max(created_at)::date as last_day,
       count(distinct created_at::date) as active_days
  from ranked group by 1
 order by distinct_ex desc, attempts desc limit 20;

\echo === 8. gate check: training_pass content (knight-tour-2/-3) ===
select exercise_id, count(*) as attempts, count(distinct wallet) as wallets
  from public.score_attempts
 where exercise_id like 'knight-tour%' or exercise_id like 'pawn-promotion%'
 group by 1 order by 1;

\echo === 9. entitlements ===
select count(*) as rows, count(distinct wallet) as wallets from public.lite_season_passes;

\echo === 10. attempts piled into one day (session budget = 100) ===
select attempts_in_day, count(*) as wallet_days
  from (select wallet, created_at::date as d, count(*) as attempts_in_day
          from public.score_attempts group by 1,2) x
 where attempts_in_day >= 50 group by 1 order by 1 desc;

\echo === 11. new-distinct-exercises per active day, top coverage wallets ===
with firsts as (
  select wallet, exercise_id, min(created_at)::date as first_day
    from public.score_attempts where exercise_id is not null group by 1,2
),
perday as (
  select wallet, first_day as d, count(*) as new_ex from firsts group by 1,2
),
agg as (
  select wallet,
         sum(new_ex) as total_new,
         count(*) as days_with_new,
         min(d) as first_day, max(d) as last_day,
         sum(new_ex) filter (where d >= date '2026-08-06' - 3) as new_last3,
         sum(new_ex) filter (where d >= date '2026-08-06' - 7) as new_last7
    from perday group by 1
)
select left(md5(wallet),8) as tag, total_new, days_with_new, first_day, last_day,
       coalesce(new_last3,0) as new_last3d, coalesce(new_last7,0) as new_last7d,
       round(total_new::numeric / greatest(days_with_new,1), 1) as new_per_active_day,
       78 - total_new as remaining_of_78
  from agg order by total_new desc limit 20;
\pset pager off
\echo === 12. current UTC-week weekly board (learn) ===
select left(md5(wallet),8) as tag, total_score, rank
  from public.weekly_ranking(
        'learn',
        date_trunc('week', now() at time zone 'utc') at time zone 'utc',
        (date_trunc('week', now() at time zone 'utc') + interval '7 days') at time zone 'utc')
 order by rank limit 15;

\echo === 13. weekly totals per ISO week (learn), from attempts ===
with w as (
  select date_trunc('week', created_at at time zone 'utc') as wk, wallet, level_id, max(score) as best
    from public.score_attempts where surface='learn' group by 1,2,3
), t as (
  select wk, wallet, sum(best) as total from w group by 1,2
)
select wk::date as week_start, count(*) as wallets, max(total) as max_weekly_score,
       round(100.0*max(total)/17700,1) as pct_of_weekly_ceiling
  from t group by 1 order by 1;

\echo === 14. other permanent progression rails ===
select 'peones_balances' as rail, count(*) as rows, max(balance) as max_val from public.peones_balances
union all
select 'focus_day_ledger wallets', count(distinct wallet), max(n) from (
  select wallet, count(*) as n from public.focus_day_ledger group by 1) f
union all
select 'lite_season_passes', count(*), null from public.lite_season_passes;

\echo === 15. activity spread: wallets by number of active days (attempts era) ===
select active_days, count(*) as wallets from (
  select wallet, count(distinct created_at::date) as active_days
    from public.score_attempts group by 1) x
 group by 1 order by 1;

\echo === 16. daily new-exercise throughput across ALL wallets ===
with firsts as (
  select wallet, exercise_id, min(created_at)::date as d
    from public.score_attempts where exercise_id is not null group by 1,2)
select d, count(*) as new_exercise_solves, count(distinct wallet) as wallets
  from firsts group by 1 order by 1;
