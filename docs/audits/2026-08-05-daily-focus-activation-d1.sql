-- ═══════════════════════════════════════════════════════════════════════
-- Is Daily Focus a better unit of activation than exercise completion?
-- Reproducible cohort → D1 query.  2026-08-05
-- ═══════════════════════════════════════════════════════════════════════
--
-- Answers one question: for a single cohort day, which activation state
-- predicts coming back tomorrow. Read-only. Touches nothing.
--
--   Run:  psql "$SUPABASE_SESSION_URL" -v cohort_day="'2026-08-04'" \
--           -f docs/audits/2026-08-05-daily-focus-activation-d1.sql
--
-- ───────────────────────────────────────────────────────────────────────
-- FIVE THINGS THE INSTRUMENTATION ACTUALLY DOES, verified in code before
-- this query was written. Each one changes how the output must be read.
-- ───────────────────────────────────────────────────────────────────────
--
-- 1. `daily_focus_completed` IS NEVER EMITTED. It is a read-time canonical
--    name (`lib/analytics/canonical-events.ts:30`). The app writes
--    `daily_tactic_completed` (`lib/daily/telemetry.ts:97`). Querying the
--    canonical name against the raw table returns zero rows, silently.
--
-- 2. 426 Daily completions vs 415 exercise completions IS LEGITIMATE, not
--    an instrumentation inconsistency. The two come from disjoint code
--    paths: `daily_tactic_completed` fires on the Daily surfaces
--    (`hub-daily-tile.tsx:245`, `daily-tactic-slot.tsx:178`) and
--    `exercise_complete` fires in the training screen
--    (`exercises-screen.tsx:1824`). Finishing the Daily does NOT emit an
--    exercise completion. They are overlapping populations, not nested.
--
-- 3. THEREFORE `ACTIVATION_FUNNEL` IS MIS-ORDERED. `canonical-events.ts:36`
--    declares app_opened → hub_viewed → exercise_started →
--    exercise_completed → daily_focus_completed, which asserts that Daily
--    completions are a subset of exercise completions. They are not, and
--    that is exactly why 426 > 415 looks like a bug. Groups 3 and 4 below
--    are therefore defined as SIBLINGS, not as consecutive funnel steps.
--
-- 4. `session_id` IS A PERSISTENT PER-INSTALL ID, despite the name. It
--    lives in localStorage and never rotates (`lib/analytics/identity.ts:34`),
--    which is what makes D1 measurable at all. `visit_id` is the per-visit
--    one (sessionStorage). Caveat that cannot be corrected here: clearing
--    storage or reinstalling mints a fresh id, so a returning player with
--    wiped storage counts as a new install and depresses D1.
--
-- 5. `peones_balance_viewed` IS NOT A DELIBERATE ACTION. It fires from a
--    `useEffect` when the HUD chip's balance fetch resolves
--    (`peones-balance-chip.tsx:164-174`) — no tap, no intent, and the
--    player need not even look at it. It is excluded from every group
--    below and must not be read as reward-seeking. Because it resolves
--    late it is frequently the LAST event before abandonment, which is a
--    property of its timing, not of the player's motive.
--
-- ───────────────────────────────────────────────────────────────────────
-- DEFINITIONS
-- ───────────────────────────────────────────────────────────────────────
-- Cohort        : installs whose FIRST-EVER event falls on :cohort_day.
--                 Anchoring on first-ever (not "was active that day")
--                 keeps returning players out of a new-user D1 number.
-- Day boundary  : UTC. `created_at` is timestamptz; the app never writes a
--                 local-time day key. Stated explicitly because a cohort
--                 sliced in a different zone is a different cohort.
-- Returned (D1) : at least one event in [cohort_day + 1, cohort_day + 2)
--                 UTC. A calendar-next-day rule, NOT a rolling 24h one —
--                 someone who plays at 23:50 and again at 00:10 counts as
--                 returned. This is the looser of the two definitions and
--                 is the one that matches "volvió al día siguiente".
-- Groups        : mutually exclusive, assigned by the DEEPEST state the
--                 install reached on the cohort day.

\set ON_ERROR_STOP on
\if :{?cohort_day} \else \set cohort_day '2026-08-04' \endif

-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 1 — the answer
-- ═══════════════════════════════════════════════════════════════════════

with bounds as (
  select
    (:'cohort_day')::date                          as d0,
    (:'cohort_day')::timestamptz                   as t_start,
    (:'cohort_day')::timestamptz + interval '1 day' as t_end,
    (:'cohort_day')::timestamptz + interval '1 day' as r_start,
    (:'cohort_day')::timestamptz + interval '2 day' as r_end
),

-- Alias sets, kept identical to `lib/analytics/canonical-events.ts`. If
-- that file gains an alias, add it here or the funnel silently undercounts.
alias as (
  select
    array['hub_viewed','hub_view','play_hub_view']                                    as hub,
    array['exercise_started','training_exercise_started','daily_tactic_started',
          'play_tactics_opened']                                                      as started,
    array['exercise_completed','exercise_complete','training_exercise_completed',
          'play_tactics_completed']                                                   as completed,
    array['daily_focus_completed','daily_tactic_completed']                           as daily,
    -- Descriptive only, never a funnel step.
    array['pro_purchase_confirmed']                                                   as bought
),

-- First-ever activity per install, so the cohort excludes returning players.
first_seen as (
  select session_id, min(created_at) as first_at
    from analytics_events
   where session_id <> ''
   group by session_id
),

cohort as (
  select fs.session_id
    from first_seen fs, bounds b
   where fs.first_at >= b.t_start
     and fs.first_at <  b.t_end
),

-- What each cohort install did ON the cohort day.
day0 as (
  select
    c.session_id,
    bool_or(e.event = any(a.hub))       as saw_hub,
    bool_or(e.event = any(a.started))   as started_exercise,
    bool_or(e.event = any(a.completed)) as completed_exercise,
    bool_or(e.event = any(a.daily))     as completed_daily,
    bool_or(e.event = any(a.bought))    as bought
  from cohort c
  join analytics_events e on e.session_id = c.session_id
  cross join bounds b
  cross join alias a
  where e.created_at >= b.t_start and e.created_at < b.t_end
  group by c.session_id
),

returned as (
  select distinct e.session_id
    from analytics_events e, bounds b
   where e.created_at >= b.r_start and e.created_at < b.r_end
),

-- Deepest state reached. Groups 3 and 4 are SIBLINGS (see note 3 above):
-- an install that did both lands in 4, and group 3 is explicitly
-- "completed an exercise but never the Daily".
labelled as (
  select
    d.session_id,
    case
      when d.completed_daily                        then '4. daily focus completed'
      when d.completed_exercise                     then '3. exercise completed, no daily'
      when d.started_exercise                       then '2. exercise started, none completed'
      when d.saw_hub                                then '1. hub viewed, never started'
      else                                               '0. opened, never reached hub'
    end as grp,
    d.bought,
    (r.session_id is not null) as came_back
  from day0 d
  left join returned r on r.session_id = d.session_id
)

select
  grp                                                          as "group",
  count(*)                                                     as installs,
  round(100.0 * count(*) / sum(count(*)) over (), 1)           as "share_%",
  count(*) filter (where came_back)                            as returned_d1,
  round(100.0 * count(*) filter (where came_back)
        / nullif(count(*), 0), 1)                              as "d1_%"
from labelled
group by grp

union all

select
  'TOTAL (cohort)', count(*), 100.0,
  count(*) filter (where came_back),
  round(100.0 * count(*) filter (where came_back) / nullif(count(*), 0), 1)
from labelled

union all

-- Group 6 — descriptive only. Deliberately OUTSIDE the mutually exclusive
-- set: buyers already appear in whichever group they earned, and counting
-- them as a step would double-count them.
select
  '6. buyers (descriptive, overlaps above)', count(*),
  round(100.0 * count(*) / (select nullif(count(*),0) from labelled), 1),
  count(*) filter (where came_back),
  round(100.0 * count(*) filter (where came_back) / nullif(count(*), 0), 1)
from labelled where bought

order by 1;

-- GROUP 5 ("completed the Daily AND saw the closing/reward") IS NOT
-- AVAILABLE. There is no reliable event for it. `daily_streak_updated` is
-- emitted from the same block as the completion itself
-- (`lib/daily/telemetry.ts:118`), so it measures the completion a second
-- time, not whether the closing screen was seen. Reporting it as group 5
-- would fabricate a distinction. Instrumenting a real one is Fase 5 work.


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 2 — instrumentation checks. Run these BEFORE trusting section 1.
-- ═══════════════════════════════════════════════════════════════════════

-- 2a. Which raw names actually carry the volume, and does the canonical
--     name appear at all? Expect `daily_focus_completed` = 0 rows.
-- Each section re-declares its own window: a CTE does not survive the
-- statement it was declared in.
select
  e.event                                  as raw_event,
  count(*)                                 as rows,
  count(distinct e.session_id)             as installs
from analytics_events e
where e.created_at >= (:'cohort_day')::timestamptz
  and e.created_at <  (:'cohort_day')::timestamptz + interval '1 day'
  and e.event in (
    'hub_viewed','hub_view','play_hub_view',
    'exercise_started','training_exercise_started','daily_tactic_started','play_tactics_opened',
    'exercise_completed','exercise_complete','training_exercise_completed','play_tactics_completed',
    'daily_focus_completed','daily_tactic_completed',
    'peones_balance_viewed','hub_tour_finish'
  )
group by e.event
order by rows desc;

-- 2b. Duplicate emissions per install. A funnel that counts ROWS instead of
--     DISTINCT installs is wrong by exactly this much. Anything with a high
--     max is a de-dup bug worth its own ticket.
select
  e.event,
  count(*)                                            as rows,
  count(distinct e.session_id)                        as installs,
  round(count(*)::numeric / nullif(count(distinct e.session_id),0), 2) as per_install,
  max(c.n)                                            as worst_install
from analytics_events e
join lateral (
  select count(*) as n from analytics_events x
   where x.session_id = e.session_id and x.event = e.event
     and x.created_at >= (:'cohort_day')::timestamptz
     and x.created_at <  (:'cohort_day')::timestamptz + interval '1 day'
) c on true
where e.created_at >= (:'cohort_day')::timestamptz
  and e.created_at <  (:'cohort_day')::timestamptz + interval '1 day'
  and e.event in ('daily_tactic_completed','exercise_complete','exercise_completed',
                  'peones_balance_viewed','hub_tour_finish')
group by e.event
order by per_install desc;

-- 2c. The 426-vs-415 question, settled with the actual overlap. If the two
--     sets were nested, `daily_only` would be 0. It will not be.
with w as (
  select (:'cohort_day')::timestamptz as t0,
         (:'cohort_day')::timestamptz + interval '1 day' as t1
),
per as (
  select
    session_id,
    bool_or(event in ('daily_focus_completed','daily_tactic_completed')) as daily,
    bool_or(event in ('exercise_completed','exercise_complete',
                      'training_exercise_completed','play_tactics_completed')) as ex
  from analytics_events, w
  where created_at >= w.t0 and created_at < w.t1
  group by session_id
)
select
  count(*) filter (where daily and not ex) as daily_only,
  count(*) filter (where ex and not daily) as exercise_only,
  count(*) filter (where daily and ex)     as both,
  count(*) filter (where daily)            as daily_total,
  count(*) filter (where ex)               as exercise_total
from per;

-- 2d. Cohort-boundary sensitivity. If D1 swings materially across these,
--     the headline number is an artifact of where the day was cut and must
--     be reported with the window, not alone.
select
  shift                                                        as boundary_shift_hours,
  count(*)                                                     as cohort_size,
  count(*) filter (where came_back)                            as returned,
  round(100.0*count(*) filter (where came_back)/nullif(count(*),0),1) as "d1_%"
from (
  select s.shift, fs.session_id,
    exists (
      select 1 from analytics_events r
       where r.session_id = fs.session_id
         and r.created_at >= (:'cohort_day')::timestamptz + (s.shift||' hours')::interval + interval '1 day'
         and r.created_at <  (:'cohort_day')::timestamptz + (s.shift||' hours')::interval + interval '2 day'
    ) as came_back
  from (values (-6),(-3),(0),(3),(6)) s(shift)
  join (
    select session_id, min(created_at) as first_at
      from analytics_events where session_id <> '' group by session_id
  ) fs
    on fs.first_at >= (:'cohort_day')::timestamptz + (s.shift||' hours')::interval
   and fs.first_at <  (:'cohort_day')::timestamptz + (s.shift||' hours')::interval + interval '1 day'
) t
group by shift order by shift;

-- 2e. Legacy / unmapped events with real volume. Anything here that means
--     "started" or "completed" and is missing from canonical-events.ts is
--     silently draining the funnel.
select event, count(*) as rows, count(distinct session_id) as installs
from analytics_events
where created_at >= (:'cohort_day')::timestamptz
  and created_at <  (:'cohort_day')::timestamptz + interval '1 day'
  and event not in (
    'hub_viewed','hub_view','play_hub_view',
    'exercise_started','training_exercise_started','daily_tactic_started','play_tactics_opened',
    'exercise_completed','exercise_complete','training_exercise_completed','play_tactics_completed',
    'daily_focus_completed','daily_tactic_completed','app_opened'
  )
group by event
having count(distinct session_id) > 50
order by installs desc
limit 40;
