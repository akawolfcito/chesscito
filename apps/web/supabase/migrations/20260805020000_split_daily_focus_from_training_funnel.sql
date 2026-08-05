-- ═════════════════════════════════════════════════════════════════════════
-- Split the Daily Focus funnel out of the Training activation funnel
-- ═════════════════════════════════════════════════════════════════════════
--
-- ⛔ NOT APPLIED. Written in Session B, deliberately left unpushed. See
--    docs/handoffs/ for the exact apply steps and the post-deploy probe.
--
-- ── The defect ───────────────────────────────────────────────────────────
--
-- `stats_activation_funnel` (20260805000000) is prefix-nested by construction,
-- and for its first four steps that is correct and valuable. Its FIFTH step is
-- not:
--
--     select 5, 'daily_focus_completed',
--            (select count(*) from cohort c where c.s2 and c.s3 and c.s4 and c.s5)
--
-- The `c.s4` conjunct says: to be counted as having completed the Daily, an
-- install must ALSO have completed a training exercise. That asserts Daily
-- completions are a SUBSET of training completions. They are not. The two come
-- from disjoint emitters — `hub-daily-tile.tsx` fires `daily_tactic_completed`
-- and never a completion alias; `exercises-screen.tsx` fires `exercise_complete`
-- and never a Daily one. Production showed 426 Daily completions against 415
-- exercise completions, and that read as an instrumentation bug precisely
-- because the funnel claimed a nesting that does not exist.
--
-- The same defect ran in the OTHER direction at step 3: `daily_tactic_started`
-- fed `exercise_started`, so every Daily starter entered the training funnel
-- and then dropped at step 4, depressing training completion with people who
-- never trained. Two funnels have to be disjoint where they BRANCH, not only
-- at the leaf.
--
-- ── The fix ──────────────────────────────────────────────────────────────
--
-- Two sibling funnels sharing their first two steps:
--
--     app_opened → hub_viewed ─┬→ exercise_started → exercise_completed
--                              └→ daily_focus_started → daily_focus_completed
--
-- Neither is a stage of the other. An install may appear in both, one, or
-- neither, and no ordering between the two branches means anything.
--
-- ── Contract ─────────────────────────────────────────────────────────────
--
-- `stats_activation_funnel(text, text)`
--   SIGNATURE:  unchanged — (p_surface text, p_container text)
--   SHAPE:      unchanged — returns table (step text, sessions bigint)
--   ROWS:       5 → 4. The `daily_focus_completed` row is GONE.
--   NUMBERS:    `exercise_started` and `exercise_completed` will DROP, because
--               Daily-only installs no longer enter at step 3. That is the
--               correction, not a regression. A break in the series at the
--               deploy date is EXPECTED and must not be read as a traffic drop.
--
-- `stats_daily_focus_funnel(text, text)`  — NEW
--   Same signature and same shape, so any caller that renders one renders the
--   other with no new code path.
--
-- CONSUMERS THAT MUST MIGRATE: **none today.** `stats_activation_funnel` has
-- zero call sites in apps/web (verified 2026-08-05 by grep over src/ and
-- scripts/): /stats still computes the funnel in TypeScript via
-- `computeActivation`. Phase C, which points the aggregator at these RPCs, must
-- read `stats_daily_focus_funnel` into `PublicStats.dailyFocusFunnel` — the
-- field already exists and is already rendered.
--
-- The alias lists below mirror `CANONICAL_EVENTS` and `DAILY_FOCUS_EVENTS` in
-- src/lib/analytics/canonical-events.ts. The pairing is pinned by
-- supabase/migrations/__tests__/stats-rpc-privileges.test.ts.

-- ═════════════════════════════════════════════════════════════════════════
-- 1. stats_activation_funnel — TRAINING only, four steps
-- ═════════════════════════════════════════════════════════════════════════

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
           -- `daily_tactic_started` deliberately ABSENT: it belongs to the
           -- Daily branch below, not to a training start.
           bool_or(s.event in ('exercise_started', 'training_exercise_started',
                               'play_tactics_opened')) as s3,
           bool_or(s.event in ('exercise_completed', 'exercise_complete',
                               'training_exercise_completed',
                               'play_tactics_completed')) as s4
      from scoped s
     group by s.session_id
  ),
  cohort as (
    select * from per_install where s1
  ),
  steps as (
    select 1 as ord, 'app_opened'::text       as step,
           (select count(*) from cohort)                              as sessions
    union all
    select 2, 'hub_viewed',
           (select count(*) from cohort c where c.s2)
    union all
    select 3, 'exercise_started',
           (select count(*) from cohort c where c.s2 and c.s3)
    union all
    select 4, 'exercise_completed',
           (select count(*) from cohort c where c.s2 and c.s3 and c.s4)
  )
  select st.step, st.sessions::bigint
    from steps st
   order by st.ord
$$;

comment on function public.stats_activation_funnel(text, text) is
  'TRAINING activation over 30 rolling days: four steps, scoped to installs that emitted app_opened and prefix-nested, so sessions is non-increasing by construction. Counts distinct installs; returns no identifier. The Daily Focus branch is a SIBLING — see stats_daily_focus_funnel — and was removed from here on 2026-08-05 because a fifth step asserted Daily completions were a subset of training completions, which they are not.';

-- ═════════════════════════════════════════════════════════════════════════
-- 2. stats_daily_focus_funnel — the sibling branch
-- ═════════════════════════════════════════════════════════════════════════
-- Same cohort rule and same prefix-nesting as the training branch, over the
-- Daily's own third and fourth steps. `daily_focus_started` /
-- `daily_focus_completed` are READ names: `daily_focus_completed` is never
-- emitted by the app (handoff 2026-08-05) and is listed so a future emitter is
-- picked up without another migration. The rows that exist today arrive as
-- `daily_tactic_started` / `daily_tactic_completed`.

create or replace function public.stats_daily_focus_funnel(
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
           bool_or(s.event in ('daily_focus_started',
                               'daily_tactic_started')) as s3,
           bool_or(s.event in ('daily_focus_completed',
                               'daily_tactic_completed')) as s4
      from scoped s
     group by s.session_id
  ),
  cohort as (
    select * from per_install where s1
  ),
  steps as (
    select 1 as ord, 'app_opened'::text        as step,
           (select count(*) from cohort)                              as sessions
    union all
    select 2, 'hub_viewed',
           (select count(*) from cohort c where c.s2)
    union all
    select 3, 'daily_focus_started',
           (select count(*) from cohort c where c.s2 and c.s3)
    union all
    select 4, 'daily_focus_completed',
           (select count(*) from cohort c where c.s2 and c.s3 and c.s4)
  )
  select st.step, st.sessions::bigint
    from steps st
   order by st.ord
$$;

comment on function public.stats_daily_focus_funnel(text, text) is
  'Daily Focus activation over 30 rolling days: four steps, same cohort and nesting rules as stats_activation_funnel, branching at step 3. A SIBLING of the training funnel, never a continuation: an install may appear in both, one or neither, and no ordering between the two branches is meaningful. Counts distinct installs; returns no identifier.';

-- ═════════════════════════════════════════════════════════════════════════
-- 3. Privileges
-- ═════════════════════════════════════════════════════════════════════════
-- `create or replace` PRESERVES existing grants, so stats_activation_funnel
-- needs no re-grant — but it is restated anyway, because relying on that is
-- exactly the kind of assumption that left `anon` holding SELECT on three
-- views (postmortem 2026-08-05). Three separate revokes: revoking from PUBLIC
-- alone does NOT remove Supabase's explicit grants to anon/authenticated.
--
-- ⛔ These statements are NOT the proof. A regex over this file passes green
-- with a function still exposed. `has_function_privilege(...)` against the
-- real database is the proof — see section 5.

revoke execute on function public.stats_activation_funnel(text, text) from public;
revoke execute on function public.stats_activation_funnel(text, text) from anon;
revoke execute on function public.stats_activation_funnel(text, text) from authenticated;
grant  execute on function public.stats_activation_funnel(text, text) to service_role;

revoke execute on function public.stats_daily_focus_funnel(text, text) from public;
revoke execute on function public.stats_daily_focus_funnel(text, text) from anon;
revoke execute on function public.stats_daily_focus_funnel(text, text) from authenticated;
grant  execute on function public.stats_daily_focus_funnel(text, text) to service_role;

-- ═════════════════════════════════════════════════════════════════════════
-- 4. Self-verification — abort rather than report a green no-op
-- ═════════════════════════════════════════════════════════════════════════
-- The security migration of 2026-08-05 established the rule: a security-shaped
-- change whose success output is indistinguishable from its failure output is
-- the worst possible failure mode. This block makes the migration throw rather
-- than succeed quietly if either function stays reachable.

do $$
begin
  if has_function_privilege('anon', 'public.stats_daily_focus_funnel(text, text)', 'EXECUTE') then
    raise exception 'stats_daily_focus_funnel is still EXECUTE-able by anon';
  end if;
  if has_function_privilege('authenticated', 'public.stats_daily_focus_funnel(text, text)', 'EXECUTE') then
    raise exception 'stats_daily_focus_funnel is still EXECUTE-able by authenticated';
  end if;
  if has_function_privilege('anon', 'public.stats_activation_funnel(text, text)', 'EXECUTE') then
    raise exception 'stats_activation_funnel is still EXECUTE-able by anon';
  end if;
  if not has_function_privilege('service_role', 'public.stats_daily_focus_funnel(text, text)', 'EXECUTE') then
    raise exception 'service_role LOST execute on stats_daily_focus_funnel';
  end if;
  if not has_function_privilege('service_role', 'public.stats_activation_funnel(text, text)', 'EXECUTE') then
    raise exception 'service_role LOST execute on stats_activation_funnel';
  end if;
end
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- 5. Post-deploy probe (read-only, safe against production)
-- ═════════════════════════════════════════════════════════════════════════
--   select step, sessions from public.stats_activation_funnel();
--     -- expect exactly 4 rows, ending at exercise_completed
--   select step, sessions from public.stats_daily_focus_funnel();
--     -- expect exactly 4 rows, ending at daily_focus_completed
--   select p.proname,
--          has_function_privilege('anon',         p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
--          has_function_privilege('service_role',  p.oid, 'EXECUTE') as svc
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('stats_activation_funnel', 'stats_daily_focus_funnel');
--     -- expect anon=f, auth=f, svc=t on both
--
-- ⚠️ `supabase db query` targets the LOCAL database by default. Pass --linked
-- or the probe reports on an empty local schema and reads as a failure.

-- ═════════════════════════════════════════════════════════════════════════
-- 6. Rollback
-- ═════════════════════════════════════════════════════════════════════════
-- Nothing calls either function, so the rollback is free: drop the new one and
-- restore the five-step body. Run as one transaction:
--
--   begin;
--   drop function if exists public.stats_daily_focus_funnel(text, text);
--   -- then re-apply the `create or replace function
--   -- public.stats_activation_funnel` block from
--   -- 20260805000000_stats_aggregation_rpcs.sql verbatim (lines 173-231).
--   commit;
--
-- ⚠️ That restores the FALSE nesting. Only for reverting an incident, never as
-- a fix. If Phase C has already wired the aggregator, dropping
-- stats_daily_focus_funnel also blanks the Daily branch on /stats.
