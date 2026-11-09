-- Chesscito — Phase A: the eight /stats aggregation RPCs.
--
-- Plan:  docs/plans/2026-08-04-stats-consolidation-execution-plan.md (Phase A)
-- Audit: docs/audits/2026-08-04-public-stats-accuracy-audit.md (§9, §13, §15)
--
-- WHY THIS EXISTS
-- ---------------
-- Every windowed number on /stats was derived in JavaScript from rows fetched
-- through PostgREST, and PostgREST caps every read at 1,000 rows. An explicit
-- `.range(0, 9999)` does NOT raise that cap — measured against production:
--
--     Range: 0-9999    → 206 · 1000 rows · Content-Range 0-999/3066
--     Range: 1000-2999 → 206 · 1000 rows · Content-Range 1000-1999/3066
--
-- Every capped read was ordered `created_at desc`, so the cut was not a sample:
-- it was the NEWEST PREFIX. The 1,000 newest events span 14.9 minutes, and the
-- page published that quarter of an hour under labels reading "7 days" and
-- "30 days" — 46 sessions against a real 3,928.
--
-- A `count(distinct …)` is the database's job. These eight functions move every
-- such count into PostgreSQL, where the population is the population.
--
-- ADDITIVE AND UNCALLED. No table DDL, no columns, no index, no backfill, and
-- no consumer: the aggregator in apps/web is NOT changed in this phase. The
-- rollback is `drop function` on all eight (see the footer) and costs nothing.
--
-- ── THE TWO PARAMETERS ────────────────────────────────────────────────────
--
-- Every function takes `p_surface text default null` and
-- `p_container text default null`, and NULL means "no filter" — never the
-- string 'all'. The caller's allow-list (lib/stats/filters.ts) collapses an
-- unknown value to `all`; `all` is then sent as NULL. Encoding "no filter" as a
-- magic string would put a sentinel inside a column comparison, where a real
-- surface named 'all' would silently take over.
--
-- ⚠️ 18,688 of the last 30 days' rows (15.5%) carry `surface` NULL and the same
-- rows carry `container` NULL. A non-NULL filter EXCLUDES them. That is correct
-- — they cannot be attributed — but it means the filtered views do not sum to
-- the unfiltered one, and the page must say so where it states the number.
--
-- ── IDENTITY, AND WHAT IS NEVER RETURNED ─────────────────────────────────
--
-- Not one of these functions returns a `session_id`, an `account_ref`, a wallet
-- or any other identifier. They return counts, a country code, a date and a
-- funnel step name. Rows are read only to be grouped away.
--
-- `session_id` is an anonymous INSTALL id that persists across visits (217 of
-- them span up to 8 visits — see the p95 audit), so it is never called a
-- "session" in any contract built on top of these. `account_ref` is a keyed
-- pseudonym (HMAC of the address with a server secret); the address itself is
-- never stored anywhere.
--
-- NULL and empty identifiers are excluded everywhere. `analytics_events.
-- session_id` is `not null` in the schema, so the guard is defensive rather
-- than load-bearing — but `''` is not excluded by the schema and would form its
-- own phantom install.
--
-- ── UTC, AND THE CAST THAT SILENTLY MOVES A WINDOW ───────────────────────
--
-- `now() at time zone 'utc'` yields a timestamp WITHOUT time zone. Feeding that
-- back into a timestamptz comparison casts it through the DATABASE's TimeZone
-- setting, so on a non-UTC server the whole window shifts by the offset. Every
-- calendar boundary below is therefore pinned back with a second
-- `at time zone 'utc'`, exactly as 20260801000000_leaderboard_weekly.sql
-- documents. A test running on a UTC database cannot see the difference.
--
-- Two window shapes appear, and they are not interchangeable:
--   · ROLLING  — `created_at >= now() - interval 'N days'`. Used for the 7d/30d
--                headline counts and for "new accounts, last 7 days".
--   · CALENDAR — UTC day arithmetic. Used for "arrived today", for retention
--                cohorts, for the lifecycle bands and for the daily trend,
--                because all four are stated in whole days.
--
-- ── SECURITY DEFINER, AND WHY ONE REVOKE IS NOT ENOUGH ───────────────────
--
-- All eight are SECURITY DEFINER with `set search_path = public`, so they read
-- the RLS-denied telemetry tables regardless of the caller's role. That makes
-- the privilege list the ONLY thing standing between these aggregates and
-- anybody holding the anon key, so each function is revoked from THREE roles:
--
--   1. Postgres grants EXECUTE on every new function to PUBLIC by default.
--      Revoking from anon/authenticated alone leaves them holding it via
--      PUBLIC.
--   2. Supabase ships `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON
--      FUNCTIONS TO anon, authenticated, service_role`, so every new function
--      ALSO receives an EXPLICIT grant to those two roles, which a revoke from
--      PUBLIC does not touch.
--
-- This was found against a live Supabase, not by review: a migration that
-- revoked from PUBLIC only still returned TRUE for
-- `has_function_privilege('anon', …, 'EXECUTE')`. A regex over this file passes
-- green with the function exposed — only the database can answer. That is what
-- scripts/ops/verify-stats-rpcs.ts is for.

-- ═════════════════════════════════════════════════════════════════════════
-- 1. stats_install_counts — the three headline install numbers, plus one
--    deliberately approximate row count
-- ═════════════════════════════════════════════════════════════════════════
-- `app_opens_rows_30d` counts ROWS, not entities, and is the only figure here
-- that inherits the 8.6% exact-duplicate rate measured over 24h (same event,
-- same created_at). It is returned anyway because "how many opens" is a real
-- question — but it must be labelled approximate wherever it is rendered, and
-- it must never be compared against `app_open_sessions_30d` as if the gap were
-- repeat usage.
--
-- One scan answers all four: the 7-day figure is a FILTER over the same 30-day
-- pass rather than a second read.

create or replace function public.stats_install_counts(
  p_surface   text default null,
  p_container text default null
)
returns table (
  sessions_7d            bigint,
  sessions_30d           bigint,
  app_opens_rows_30d     bigint,
  app_open_sessions_30d  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(distinct e.session_id)
      filter (where e.created_at >= now() - interval '7 days')::bigint,
    count(distinct e.session_id)::bigint,
    count(*) filter (where e.event = 'app_opened')::bigint,
    count(distinct e.session_id)
      filter (where e.event = 'app_opened')::bigint
    from public.analytics_events e
   where e.created_at >= now() - interval '30 days'
     and e.session_id is not null
     and e.session_id <> ''
     and (p_surface   is null or e.surface   = p_surface)
     and (p_container is null or e.container = p_container)
$$;

comment on function public.stats_install_counts(text, text) is
  'Phase A. Distinct installs (session_id) active in the last 7 and 30 rolling days, plus app_opened rows and app_opened installs over 30 days, for the optional surface/container slice (NULL = no filter). app_opens_rows_30d counts ROWS and is APPROXIMATE: it inherits the 8.6% exact-duplicate rate; the other three count distinct entities and are exact.';

-- ═════════════════════════════════════════════════════════════════════════
-- 2. stats_activation_funnel — monotone BY CONSTRUCTION
-- ═════════════════════════════════════════════════════════════════════════
-- The page shipped `App opened 37 < Hub viewed 41`, which is not a funnel. The
-- truncation explains that particular pair, but the shape was fragile anyway:
-- computeActivation counts each step INDEPENDENTLY, so any session that emits a
-- later step without its predecessor lifts a lower rung above a higher one.
--
-- ⚠️ THIS DIFFERS FROM THE JS IT REPLACES, on purpose. Two changes:
--
--   1. The cohort is the set of installs that emitted `app_opened` in the
--      window. Nothing outside it is counted at any step.
--   2. Steps are PREFIX-NESTED: an install counted at step k must have emitted
--      every step from 1 to k. "Reached exercise_completed" therefore means
--      "opened the app, saw the hub, started an exercise and completed one",
--      not "happens to have a completion row".
--
-- Together those make `sessions` non-increasing down the list as an algebraic
-- property of the query, not as a hope about the data — a drop between two
-- steps is always a real drop and never a mix artifact. The cost is that the
-- numbers are LOWER than an independent per-step count: an install whose
-- `hub_viewed` never landed drops out of every step below it. That is the
-- correct trade for a funnel; independent counts are five unrelated numbers
-- printed in a column.
--
-- The alias lists mirror CANONICAL_EVENTS in lib/analytics/canonical-events.ts.
-- They are spelled out rather than joined against a table because the catalog
-- has ~120 historical names and the mapping is a READ-time decision that the
-- TypeScript module owns; if a new alias is registered there it must be added
-- here too, and the shape test in src/lib/stats/__tests__ pins that pairing.

create or replace function public.stats_activation_funnel(
  p_surface   text default null,
  p_container text default null
)
returns table (
  step     text,
  sessions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select e.session_id, e.event
      from public.analytics_events e
     where e.created_at >= now() - interval '30 days'
       and e.session_id is not null
       and e.session_id <> ''
       and (p_surface   is null or e.surface   = p_surface)
       and (p_container is null or e.container = p_container)
  ),
  per_install as (
    select s.session_id,
           bool_or(s.event = 'app_opened') as s1,
           bool_or(s.event in ('hub_viewed', 'hub_view', 'play_hub_view')) as s2,
           bool_or(s.event in ('exercise_started', 'training_exercise_started',
                               'daily_tactic_started', 'play_tactics_opened')) as s3,
           bool_or(s.event in ('exercise_completed', 'exercise_complete',
                               'training_exercise_completed',
                               'play_tactics_completed')) as s4,
           bool_or(s.event in ('daily_focus_completed',
                               'daily_tactic_completed')) as s5
      from scoped s
     group by s.session_id
  ),
  cohort as (
    select * from per_install where s1
  ),
  steps as (
    select 1 as ord, 'app_opened'::text            as step,
           (select count(*) from cohort)                                        as sessions
    union all
    select 2, 'hub_viewed',
           (select count(*) from cohort c where c.s2)
    union all
    select 3, 'exercise_started',
           (select count(*) from cohort c where c.s2 and c.s3)
    union all
    select 4, 'exercise_completed',
           (select count(*) from cohort c where c.s2 and c.s3 and c.s4)
    union all
    select 5, 'daily_focus_completed',
           (select count(*) from cohort c where c.s2 and c.s3 and c.s4 and c.s5)
  )
  select st.step, st.sessions::bigint
    from steps st
   order by st.ord
$$;

comment on function public.stats_activation_funnel(text, text) is
  'Phase A. Five-step activation funnel over 30 rolling days, in order, scoped to the installs that emitted app_opened AND prefix-nested, so `sessions` is non-increasing by construction. Counts distinct installs; returns no identifier. Deliberately lower than an independent per-step count — see the migration header.';

-- ═════════════════════════════════════════════════════════════════════════
-- 3. stats_access_funnel — the door, with its existing scoping preserved
-- ═════════════════════════════════════════════════════════════════════════
-- Unlike activation, this one keeps EXACTLY the scoping computeAccessFunnel
-- already has: the cohort is every install that fired `web_access_gate_viewed`,
-- and each later step counts cohort members that emitted that step,
-- INDEPENDENTLY — not prefix-nested. The scoping is what matters here and it is
-- load-bearing: MiniPay never mounts the gate, so without it those installs
-- would land on `first_exercise_completed` having never appeared at
-- `gate_viewed`, and the last step would exceed the first.
--
-- `failed_sessions` is a FUNNEL-LEVEL counter, and the SAME value is repeated
-- on all five rows. It is friction, not loss: one install can fail a login and
-- then succeed, so it is never subtracted from any step and must never be
-- summed down the column.

create or replace function public.stats_access_funnel(
  p_surface   text default null,
  p_container text default null
)
returns table (
  step            text,
  sessions        bigint,
  failed_sessions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select e.session_id, e.event
      from public.analytics_events e
     where e.created_at >= now() - interval '30 days'
       and e.session_id is not null
       and e.session_id <> ''
       and (p_surface   is null or e.surface   = p_surface)
       and (p_container is null or e.container = p_container)
  ),
  per_install as (
    select s.session_id,
           bool_or(s.event = 'web_access_gate_viewed') as gate,
           bool_or(s.event = 'web_login_started')      as login_started,
           bool_or(s.event = 'web_login_succeeded')    as login_succeeded,
           bool_or(s.event = 'web_wallet_ready')       as wallet_ready,
           bool_or(s.event in ('exercise_completed', 'exercise_complete',
                               'training_exercise_completed',
                               'play_tactics_completed')) as first_completed,
           bool_or(s.event = 'web_login_failed')       as failed
      from scoped s
     group by s.session_id
  ),
  cohort as (
    select * from per_install where gate
  ),
  failures as (
    select count(*) as n from cohort c where c.failed
  ),
  steps as (
    select 1 as ord, 'gate_viewed'::text as step,
           (select count(*) from cohort) as sessions
    union all
    select 2, 'login_started',
           (select count(*) from cohort c where c.login_started)
    union all
    select 3, 'login_succeeded',
           (select count(*) from cohort c where c.login_succeeded)
    union all
    select 4, 'wallet_ready',
           (select count(*) from cohort c where c.wallet_ready)
    union all
    select 5, 'first_exercise_completed',
           (select count(*) from cohort c where c.first_completed)
  )
  select st.step, st.sessions::bigint, f.n::bigint
    from steps st
   cross join failures f
   order by st.ord
$$;

comment on function public.stats_access_funnel(text, text) is
  'Phase A. Five-step access funnel over 30 rolling days, in order, scoped to the installs that saw the gate — the existing computeAccessFunnel rule, moved to SQL unchanged. Steps are independent within the cohort, NOT prefix-nested. failed_sessions is one funnel-level counter repeated on every row: friction beside the funnel, never subtracted and never summed.';

-- ═════════════════════════════════════════════════════════════════════════
-- 4. stats_top_countries
-- ═════════════════════════════════════════════════════════════════════════
-- Ordering is total, not just by count: ties break on the country code so two
-- calls a second apart cannot swap two rows and read as movement. The published
-- ranking was not merely scaled down by the truncation — it was REORDERED
-- (Kenya is 3rd with 281 installs and the page printed it 8th with 1), which is
-- why a stable order is part of the contract rather than a nicety.
--
-- `country` is ISO-3166-1 alpha-2 and nothing finer: no IP, city, region or
-- coordinates are stored at all. NULL and empty are excluded from the ranking
-- rather than bucketed as "unknown" — an unknown-origin bar would dwarf every
-- real country (15.5% of rows carry no dimensions) and say nothing.

create or replace function public.stats_top_countries(
  p_surface   text default null,
  p_container text default null
)
returns table (
  country  text,
  sessions bigint
)
language sql
stable
security definer
set search_path = public
-- ⚠️ MEASURED, not guessed. See §8bis of the Phase A review.
--
-- Without this, the FILTERED reads spill to disk while the unfiltered one does
-- not — the opposite of what anyone testing the default view would expect:
--
--     surface=play      → external merge, 2,232 kB on disk
--     container=minipay → external merge, 3,264 kB on disk
--     no filter         → no sort at all
--
-- The mechanism: with no filter the planner enters through
-- `idx_analytics_events_country`, which is ALREADY ordered by country, so the
-- group aggregate needs no sort. Under a surface/container filter it enters
-- through that dimension's index instead and must sort by country to group —
-- and that sort exceeds the server default of 3,500 kB.
--
-- At 8MB both become in-memory quicksorts. Re-measured against production:
--
--     surface=play      2,248 kB Disk → 6,050 kB Memory · 172 → 167 ms
--     container=minipay 3,280 kB Disk → 7,422 kB Memory · 276 → 276 ms
--
-- ⚠️ DO NOT READ THE DISK FIGURE AS THE MEMORY REQUIREMENT. A sort needs far
-- more room in memory than the same data occupies packed on disk: the 3,280 kB
-- spill needs 7,422 kB of work_mem, 2.3x. `container=minipay` therefore sits at
-- 91% of this 8MB — it clears today and it is NOT comfortable. If that combo
-- spills again as traffic grows, the next step is a covering index, not a
-- bigger number here.
--
-- Scoped to THIS function on purpose: not a global work_mem change, not a new
-- index, and not a rewritten query.
set work_mem = '8MB'
as $$
  select e.country, count(distinct e.session_id)::bigint as sessions
    from public.analytics_events e
   where e.created_at >= now() - interval '30 days'
     and e.session_id is not null
     and e.session_id <> ''
     and e.country is not null
     and e.country <> ''
     and (p_surface   is null or e.surface   = p_surface)
     and (p_container is null or e.container = p_container)
   group by e.country
   order by sessions desc, e.country asc
   limit 8
$$;

comment on function public.stats_top_countries(text, text) is
  'Phase A. Top 8 countries by distinct installs over 30 rolling days, ordered by installs desc then country asc so the order is total and stable. NULL/empty country excluded from the ranking.';

-- ═════════════════════════════════════════════════════════════════════════
-- 5. stats_retention — D1, D7 and week 3
-- ═════════════════════════════════════════════════════════════════════════
-- Cohorts come from `session_first_seen`, which is deliberately excluded from
-- the 90-day analytics prune: day 0 has to outlive the events it is measured
-- against. A cohort is every install old enough to have HAD its day-N chance
-- and recent enough to still mean something:
--
--   d1     · first_seen aged 1–8 UTC days   · returned = an event on day  0+1
--   d7     · first_seen aged 7–14 UTC days  · returned = an event on day  0+7
--   week3  · first_seen aged 21–28 UTC days · returned = ANY event, days 0+15…0+21
--
-- `week3` breaks the exact-day pattern deliberately and the field is named for
-- that. Exact-day-21 answers "did they happen to open the app on one specific
-- Tuesday", which at this volume reads as ~0 and says nothing about habit. A
-- window answers what the product actually asks: three weeks in, still here.
--
-- ALL THREE BUCKETS ARE ALWAYS RETURNED, cohort 0 included — hence the LEFT
-- JOIN. A bucket that vanishes when its cohort is empty is indistinguishable
-- from a bucket that was never computed, and the page renders a missing bucket
-- and a zero bucket differently on purpose.
--
-- The cohort is FILTERED by first_surface/first_container: it is a cohort, and
-- "installs born into Learn" is the population the filtered view is about.
-- (Contrast the trend below, where the same table is a birthday LOOKUP and must
-- not be filtered.)

create or replace function public.stats_retention(
  p_surface   text default null,
  p_container text default null
)
returns table (
  bucket   text,
  returned bigint,
  cohort   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with act as (
    select distinct
           e.session_id,
           (e.created_at at time zone 'utc')::date as day
      from public.analytics_events e
     where e.created_at >= now() - interval '30 days'
       and e.session_id is not null
       and e.session_id <> ''
       and (p_surface   is null or e.surface   = p_surface)
       and (p_container is null or e.container = p_container)
  ),
  fs as (
    select f.session_id,
           (f.first_seen at time zone 'utc')::date as born_day,
           ((now() at time zone 'utc')::date
              - (f.first_seen at time zone 'utc')::date) as age_days
      from public.session_first_seen f
     where f.session_id is not null
       and f.session_id <> ''
       and (p_surface   is null or f.first_surface   = p_surface)
       and (p_container is null or f.first_container = p_container)
  ),
  buckets (ord, bucket, from_off, to_off, min_age, max_age) as (
    values (1, 'd1',     1, 1,  1,  8),
           (2, 'd7',     7, 7,  7, 14),
           (3, 'week3', 15, 21, 21, 28)
  )
  select b.bucket,
         count(*) filter (where r.came_back)::bigint as returned,
         count(fs.session_id)::bigint                as cohort
    from buckets b
    left join fs
      on fs.age_days between b.min_age and b.max_age
    left join lateral (
      select exists (
        select 1
          from act a
         where a.session_id = fs.session_id
           and a.day between fs.born_day + b.from_off
                         and fs.born_day + b.to_off
      ) as came_back
    ) r on true
   group by b.ord, b.bucket
   order by b.ord
$$;

comment on function public.stats_retention(text, text) is
  'Phase A. D1/D7/week-3 retention over UTC calendar days: returned + cohort per bucket, never a rate. All three buckets are always returned, cohort 0 included. week3 is a WINDOW (days 15-21 after install), not an exact day — see the migration header.';

-- ═════════════════════════════════════════════════════════════════════════
-- 6. stats_account_lifecycle — the partition that must close
-- ═════════════════════════════════════════════════════════════════════════
-- "Inactive" is not an event, it is the ABSENCE of one, so it exists only
-- against a denominator that outlives the event window. That denominator is
-- `account_first_seen`. Without it the page invented `Inactive 962` against a
-- real 0 — not a skewed number, an INVERTED one, because it crossed a capped
-- list of 1,000 accounts with a capped 15-minute event scan and called
-- everything it did not find in the intersection "gone".
--
-- INVARIANT, checkable in SQL and pinned by the verifier:
--
--     active_7d + dormant + inactive = known
--
-- The three branches are mutually exclusive and exhaustive over every account
-- in the (filtered) denominator, so the block can never describe more or fewer
-- people than exist. `resurrected_7d` is a SUBSET of active_7d and is NOT part
-- of the partition — never add it in.
--
-- BANDS ARE EXACT ROLLING WINDOWS over each account's LAST event:
--
--     last_seen >= t - 7d                        → active_7d
--     t - 30d <= last_seen < t - 7d              → dormant
--     last_seen < t - 30d, or no event at all    → inactive
--
-- The boundaries are half-open and they interlock: `>=` on the lower edge of
-- each band and `<` on the upper, so an event landing EXACTLY on t - 7d is
-- active and one microsecond earlier is dormant. There is no seam and no
-- overlap, which is what makes the partition an identity rather than a
-- coincidence.
--
-- ⚠️ An earlier draft used UTC calendar-day ages (`age <= 7` / `8..29`),
-- mirroring the shipped computeAccountLifecycle. It was rejected: `age <= 7`
-- means "an event on one of the last EIGHT calendar days", so a card labelled
-- "Active (7d)" would have been counting eight. The label and the contract now
-- say the same thing, and the reference parity query expresses these same
-- rolling windows independently.
--
-- ── ONE CLOCK, READ ONCE ─────────────────────────────────────────────────
--
-- `t` comes from a single-row `clock` CTE that every branch cross joins. Even
-- though `now()` is the transaction timestamp and is therefore already stable
-- within one statement, pinning it once makes the guarantee STRUCTURAL: nobody
-- reading this can wonder whether the 7-day edge and the 30-day edge were
-- measured from the same instant, and nobody refactoring it can accidentally
-- introduce a second, drifting reference.
--
-- `inactive` has a declared ceiling: the activity scan is bounded to 30 days,
-- so an account gone for a year and one gone for 31 days both arrive with no
-- `last_seen` and land in the same bucket. Both literal branches are written
-- out anyway — they are the contract as stated — and the label must declare
-- that ceiling wherever it is rendered.
--
-- new_today is the UTC CALENDAR day; new_7d is a ROLLING 7-day window and the
-- label has to say "last 7 days", never "this week" — the product already means
-- "UTC week from Monday" by "week" in Leaders Weekly, and two definitions of
-- one word in one product is a defect even when both are computed correctly.

create or replace function public.stats_account_lifecycle(
  p_surface   text default null,
  p_container text default null
)
returns table (
  known          bigint,
  new_today      bigint,
  new_7d         bigint,
  active_7d      bigint,
  dormant        bigint,
  inactive       bigint,
  resurrected_7d bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with clock as (
    -- The ONE evaluation instant. Every edge below is measured from `t`.
    select now() as t
  ),
  accounts as (
    select a.account_ref,
           a.first_seen
      from public.account_first_seen a
     where a.account_ref is not null
       and a.account_ref <> ''
       and (p_surface   is null or a.first_surface   = p_surface)
       and (p_container is null or a.first_container = p_container)
  ),
  activity as (
    select e.account_ref,
           max(e.created_at) as last_seen,
           -- The silence a resurrection has to have crossed: any event in the
           -- band BELOW active, i.e. the dormant window. Same half-open edges.
           bool_or(e.created_at >= c.t - interval '30 days'
                   and e.created_at < c.t - interval '7 days') as seen_in_gap
      from public.analytics_events e
     cross join clock c
     where e.created_at >= c.t - interval '30 days'
       and e.account_ref is not null
       and e.account_ref <> ''
       and (p_surface   is null or e.surface   = p_surface)
       and (p_container is null or e.container = p_container)
     group by e.account_ref
  ),
  joined as (
    select ac.first_seen,
           av.last_seen,
           coalesce(av.seen_in_gap, false) as seen_in_gap
      from accounts ac
      left join activity av on av.account_ref = ac.account_ref
  )
  select
    count(*)::bigint as known,
    count(*) filter (
      where j.first_seen >= (date_trunc('day', c.t at time zone 'utc')
                               at time zone 'utc')
    )::bigint as new_today,
    count(*) filter (
      where j.first_seen >= c.t - interval '7 days'
    )::bigint as new_7d,
    -- The three bands. Half-open and interlocking: `>=` lower, `<` upper, so
    -- an event exactly on an edge belongs to exactly one band.
    count(*) filter (
      where j.last_seen >= c.t - interval '7 days'
    )::bigint as active_7d,
    count(*) filter (
      where j.last_seen >= c.t - interval '30 days'
        and j.last_seen <  c.t - interval '7 days'
    )::bigint as dormant,
    count(*) filter (
      where j.last_seen is null
         or j.last_seen < c.t - interval '30 days'
    )::bigint as inactive,
    -- A subset of active_7d, never a fourth bucket: back inside the 7-day
    -- window after a real silence, and old enough that the silence was
    -- absence rather than "did not exist yet".
    count(*) filter (
      where j.last_seen >= c.t - interval '7 days'
        and not j.seen_in_gap
        and j.first_seen < c.t - interval '7 days'
    )::bigint as resurrected_7d
    from joined j
   cross join clock c
$$;

comment on function public.stats_account_lifecycle(text, text) is
  'Phase A. Account denominator and its activity partition. active_7d + dormant + inactive = known by construction; resurrected_7d is a SUBSET of active_7d and is not part of the partition. Bands are EXACT ROLLING windows over each account''s last event, half-open and interlocking: last_seen >= t-7d is active, t-30d <= last_seen < t-7d is dormant, earlier-or-never is inactive, all measured from ONE clock CTE. new_today is the UTC calendar day; new_7d is a rolling 7-day window and must be labelled "last 7 days", never "this week". inactive means "no event in 30 days" — its ceiling must be declared where it is rendered.';

-- ═════════════════════════════════════════════════════════════════════════
-- 7. stats_habit_depth
-- ═════════════════════════════════════════════════════════════════════════
-- No single retention rate measures a habit: D1 and D7 are two snapshots and an
-- install can pass both while showing up twice. Counting DISTINCT ACTIVE UTC
-- DAYS per install answers the question the product actually asks, and the
-- thresholds end at the 21 the product promises.
--
-- Buckets are CUMULATIVE — the 7+ bucket is a subset of the 3+ bucket — so
-- `installs` is non-increasing down the list and the column must never be
-- summed. `cohort` (installs with any activity in the window) and
-- `median_active_days` are per-call scalars repeated on all five rows, for the
-- same reason `failed_sessions` is above: they are the block's denominator and
-- its centre, not per-bucket facts.
--
-- The median is `percentile_disc(0.5)` — a real observed value, the same
-- discipline the launch monitor uses for its p95 after a top-N sample once
-- produced a false RED. On an even-sized cohort it takes the lower of the two
-- middles rather than averaging them, so the number is always a day-count some
-- install actually had.

create or replace function public.stats_habit_depth(
  p_surface   text default null,
  p_container text default null
)
returns table (
  min_days           int,
  installs           bigint,
  cohort             bigint,
  median_active_days int
)
language sql
stable
security definer
set search_path = public
-- ⚠️ MEASURED, not guessed. See §8bis of the Phase A review.
--
-- `surface=play` spilled to disk: external merge, 3,456 kB. The
-- `count(distinct <UTC day>)` per install forces a sort of the whole filtered
-- set, and that sort exceeds the server default of 3,500 kB.
--
-- At 8MB it becomes an in-memory quicksort. Re-measured against production:
--
--     surface=play      3,456 kB Disk → 6,642 kB Memory · 125 → 133 ms
--
-- The ~8 ms it costs is the sort no longer being spread across disk writes;
-- it is noise at this scale and the disk I/O is gone. Note the same 1.9x
-- ratio between the spilled size and the memory needed — see the note on
-- stats_top_countries.
--
-- Same discipline as stats_top_countries: scoped to this function, no global
-- change, no index, no rewritten query.
set work_mem = '8MB'
as $$
  with per_install as (
    select e.session_id,
           count(distinct (e.created_at at time zone 'utc')::date) as active_days
      from public.analytics_events e
     where e.created_at >= now() - interval '30 days'
       and e.session_id is not null
       and e.session_id <> ''
       and (p_surface   is null or e.surface   = p_surface)
       and (p_container is null or e.container = p_container)
     group by e.session_id
  ),
  summary as (
    select count(*)::bigint as cohort,
           coalesce(
             percentile_disc(0.5) within group (order by p.active_days), 0
           )::int as median_active_days
      from per_install p
  ),
  thresholds (ord, min_days) as (
    values (1, 1), (2, 3), (3, 7), (4, 14), (5, 21)
  )
  select t.min_days,
         (select count(*) from per_install p where p.active_days >= t.min_days)::bigint,
         s.cohort,
         s.median_active_days
    from thresholds t
   cross join summary s
   order by t.ord
$$;

comment on function public.stats_habit_depth(text, text) is
  'Phase A. Distinct active UTC days per install over 30 rolling days, as five CUMULATIVE bands (1/3/7/14/21+) — installs is non-increasing and the column must never be summed. cohort and median_active_days are per-call scalars repeated on every row. Median is percentile_disc, so it is a day-count some install actually had; 0 when the cohort is empty.';

-- ═════════════════════════════════════════════════════════════════════════
-- 8. stats_activity_trend — exactly 30 dense rows
-- ═════════════════════════════════════════════════════════════════════════
-- The day spine is generated, not derived from the data, so a day with no
-- traffic comes through as a zero row instead of a hole. Exactly 30 rows,
-- oldest first, always — a chart consumer can index by position, and a gap can
-- never be mistaken for a missing series.
--
-- new/returning are derived from the SAME active set rather than counted
-- independently, so `new_installs + returning_installs = sessions` on every row
-- and the chart cannot contradict its own total.
--
-- ⚠️ `session_first_seen` IS NOT FILTERED HERE, and that is deliberate. In
-- stats_retention the same table selects a COHORT, so the surface filter
-- belongs. Here it is a birthday LOOKUP: an install born under Play and active
-- today under Learn is not "new" on the Learn chart just because its birth row
-- fell outside the filter. Filtering the lookup would recount old installs as
-- new — which is exactly the shape of the defect that made the published chart
-- read 100% new, 0% returning.
--
-- Progress-save mints are NOT in this function. They come from `victories` via
-- an exact head count that was never affected by the ceiling, they carry no
-- surface/container dimension, and folding an unfiltered on-chain series into a
-- filtered telemetry function would make one row mean two different windows.

create or replace function public.stats_activity_trend(
  p_surface   text default null,
  p_container text default null
)
returns table (
  day                date,
  sessions           bigint,
  new_installs       bigint,
  returning_installs bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select d::date as day
      from generate_series(
             (now() at time zone 'utc')::date - 29,
             (now() at time zone 'utc')::date,
             interval '1 day'
           ) d
  ),
  act as (
    select distinct
           e.session_id,
           (e.created_at at time zone 'utc')::date as day
      from public.analytics_events e
     where e.created_at >= (((now() at time zone 'utc')::date - 29)
                              at time zone 'utc')
       and e.session_id is not null
       and e.session_id <> ''
       and (p_surface   is null or e.surface   = p_surface)
       and (p_container is null or e.container = p_container)
  ),
  born as (
    select f.session_id,
           (f.first_seen at time zone 'utc')::date as born_day
      from public.session_first_seen f
     where f.session_id is not null
       and f.session_id <> ''
  )
  select d.day,
         count(a.session_id)::bigint as sessions,
         count(a.session_id) filter (where b.born_day = d.day)::bigint
           as new_installs,
         (count(a.session_id)
            - count(a.session_id) filter (where b.born_day = d.day))::bigint
           as returning_installs
    from days d
    left join act  a on a.day = d.day
    left join born b on b.session_id = a.session_id
   group by d.day
   order by d.day
$$;

comment on function public.stats_activity_trend(text, text) is
  'Phase A. Exactly 30 dense rows, one per UTC day, oldest first, zeros included. new_installs + returning_installs = sessions on every row by construction. session_first_seen is used UNFILTERED as a birthday lookup — see the migration header. Progress-save mints are deliberately not here.';

-- ═════════════════════════════════════════════════════════════════════════
-- 9. Privileges — three REVOKEs per function, and why each one is required
-- ═════════════════════════════════════════════════════════════════════════
-- Written as three separate statements per function rather than one
-- `from public, anon, authenticated` list, so that a missing role is visible as
-- a missing LINE. All eight are SECURITY DEFINER over RLS-denied telemetry:
-- a single forgotten revoke hands aggregate behavioural data to anybody holding
-- the anon key.
--
-- service_role is granted explicitly. It already holds EXECUTE through
-- Supabase's default privileges, so the grant is redundant TODAY — it is here
-- so the intended reader is stated in the migration rather than inherited from
-- a platform default that can change.
--
-- ⛔ These statements are NOT the proof. A regex over this file passes green
-- with a function still exposed. `has_function_privilege('anon', …, 'EXECUTE')`
-- against the real database is the proof: scripts/ops/verify-stats-rpcs.ts.

revoke execute on function public.stats_install_counts(text, text) from public;
revoke execute on function public.stats_install_counts(text, text) from anon;
revoke execute on function public.stats_install_counts(text, text) from authenticated;
grant  execute on function public.stats_install_counts(text, text) to service_role;

revoke execute on function public.stats_activation_funnel(text, text) from public;
revoke execute on function public.stats_activation_funnel(text, text) from anon;
revoke execute on function public.stats_activation_funnel(text, text) from authenticated;
grant  execute on function public.stats_activation_funnel(text, text) to service_role;

revoke execute on function public.stats_access_funnel(text, text) from public;
revoke execute on function public.stats_access_funnel(text, text) from anon;
revoke execute on function public.stats_access_funnel(text, text) from authenticated;
grant  execute on function public.stats_access_funnel(text, text) to service_role;

revoke execute on function public.stats_top_countries(text, text) from public;
revoke execute on function public.stats_top_countries(text, text) from anon;
revoke execute on function public.stats_top_countries(text, text) from authenticated;
grant  execute on function public.stats_top_countries(text, text) to service_role;

revoke execute on function public.stats_retention(text, text) from public;
revoke execute on function public.stats_retention(text, text) from anon;
revoke execute on function public.stats_retention(text, text) from authenticated;
grant  execute on function public.stats_retention(text, text) to service_role;

revoke execute on function public.stats_account_lifecycle(text, text) from public;
revoke execute on function public.stats_account_lifecycle(text, text) from anon;
revoke execute on function public.stats_account_lifecycle(text, text) from authenticated;
grant  execute on function public.stats_account_lifecycle(text, text) to service_role;

revoke execute on function public.stats_habit_depth(text, text) from public;
revoke execute on function public.stats_habit_depth(text, text) from anon;
revoke execute on function public.stats_habit_depth(text, text) from authenticated;
grant  execute on function public.stats_habit_depth(text, text) to service_role;

revoke execute on function public.stats_activity_trend(text, text) from public;
revoke execute on function public.stats_activity_trend(text, text) from anon;
revoke execute on function public.stats_activity_trend(text, text) from authenticated;
grant  execute on function public.stats_activity_trend(text, text) to service_role;

-- ═════════════════════════════════════════════════════════════════════════
-- 10. Rollback
-- ═════════════════════════════════════════════════════════════════════════
-- Nothing calls these: the aggregator in apps/web is untouched in this phase,
-- so dropping all eight returns the database to its previous state with no
-- consumer to break and no data to restore. Run as one transaction:
--
--   begin;
--   drop function if exists public.stats_install_counts(text, text);
--   drop function if exists public.stats_activation_funnel(text, text);
--   drop function if exists public.stats_access_funnel(text, text);
--   drop function if exists public.stats_top_countries(text, text);
--   drop function if exists public.stats_retention(text, text);
--   drop function if exists public.stats_account_lifecycle(text, text);
--   drop function if exists public.stats_habit_depth(text, text);
--   drop function if exists public.stats_activity_trend(text, text);
--   commit;
--
-- ⚠️ Once Phase C points the aggregator at these, a drop is no longer free: the
-- page degrades to em-dashes for every block above. The zero-cost window is
-- exactly this phase.
