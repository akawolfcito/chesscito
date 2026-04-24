-- Chesscito — analytics_events rolling 90-day window
--
-- Guarantees the free-tier Supabase DB never fills from unbounded
-- analytics growth. Old rows past 90 days are pruned; anything useful
-- about pre-90d user behavior should be rolled up into a separate
-- aggregates table before it expires (not implemented yet).
--
-- Schedule via Supabase Database → Cron Jobs:
--   name: prune_analytics_events_monthly
--   schedule: 0 3 1 * *   (1st of each month, 03:00 UTC)
--   sql: SELECT prune_analytics_events();

create or replace function prune_analytics_events()
returns int as $$
declare
  deleted_count int;
begin
  delete from analytics_events
  where created_at < now() - interval '90 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql security definer;

-- Tight privileges: only the service role can invoke the prune
-- function. anon and authenticated roles should not even know it
-- exists.
revoke all on function prune_analytics_events() from public;
revoke all on function prune_analytics_events() from anon;
revoke all on function prune_analytics_events() from authenticated;
