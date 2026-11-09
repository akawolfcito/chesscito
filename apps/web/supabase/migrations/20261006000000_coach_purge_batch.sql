-- PostgREST >=13 limits the returned representation, not the DELETE itself.
-- Keep the purge bounded in SQL and match rows by the complete primary key.
begin;

create or replace function public.purge_expired_coach_analyses()
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  with expired as (
    select wallet, game_id
    from public.coach_analyses
    where expires_at < now()
    order by expires_at, wallet, game_id
    limit 5000
    for update skip locked
  ), deleted as (
    delete from public.coach_analyses as analyses
    using expired
    where analyses.wallet = expired.wallet
      and analyses.game_id = expired.game_id
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.purge_expired_coach_analyses() from public, anon, authenticated;
grant execute on function public.purge_expired_coach_analyses() to service_role;
notify pgrst, 'reload schema';

commit;
