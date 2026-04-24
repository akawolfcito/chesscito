-- Chesscito — schedule the monthly analytics cleanup cron
--
-- Relies on pg_cron being enabled via the Supabase dashboard
-- (Database → Extensions → pg_cron). Once enabled the extension
-- exposes the `cron.schedule` function used below.
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
  -- Unschedule the previous version of this job if present — ignore
  -- if it doesn't exist yet (first apply).
  begin
    perform cron.unschedule('prune_analytics_events_monthly');
  exception when others then
    null;
  end;

  -- Schedule the fresh version.
  perform cron.schedule(
    'prune_analytics_events_monthly',
    '0 3 1 * *',
    $sql$ select prune_analytics_events(); $sql$
  );
end;
$$;
