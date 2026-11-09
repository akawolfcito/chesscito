-- Chesscito — schedule the monthly analytics cleanup cron
--
-- pg_cron is a capability enabled on the PRODUCTION project through
-- Supabase (Database → Extensions → pg_cron). It is not, and cannot be,
-- created by a migration: the local migration runner connects as
-- `postgres`, which is not a superuser in the Supabase image and is not a
-- member of `supabase_admin` — CREATE EXTENSION pg_cron is refused with
-- "Must be superuser to create this extension".
--
-- So this migration guards instead of assuming. Where cron.schedule exists
-- (production) it schedules the job exactly as before. Where it does not
-- (a clean local stack) it says so and moves on, which is what lets
-- `supabase start` reach migration 29 on a fresh volume.
--
-- The guard tests the EXACT signature this file calls —
-- cron.schedule(text, text, text) — via to_regprocedure, which returns
-- NULL rather than raising when the schema is absent. It is deliberately
-- not an `exception when others`: once cron.schedule is present, a failure
-- to schedule is a real failure and must surface.
--
-- Schedule: 0 3 1 * *  →  03:00 UTC on the 1st day of every month.
-- Action: drops analytics_events rows older than 90 days via the
-- prune_analytics_events() function defined in migration
-- 20260424010000_analytics_cleanup.sql.
--
-- Idempotent: if a job with the same name already exists, unschedule
-- it first so repeated pushes don't stack duplicate crons.

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron not available (cron.schedule(text,text,text) missing) — skipping analytics cron scheduling. Enable pg_cron on the Supabase project to activate it.';
    return;
  end if;

  -- Drop the previous version of this job if present. Checked against
  -- cron.job rather than caught after the fact, so a genuine unschedule
  -- failure is not swallowed along with "it did not exist yet".
  if exists (
    select 1 from cron.job where jobname = 'prune_analytics_events_monthly'
  ) then
    perform cron.unschedule('prune_analytics_events_monthly');
  end if;

  -- Schedule the fresh version.
  perform cron.schedule(
    'prune_analytics_events_monthly',
    '0 3 1 * *',
    $sql$ select prune_analytics_events(); $sql$
  );
end;
$$;
