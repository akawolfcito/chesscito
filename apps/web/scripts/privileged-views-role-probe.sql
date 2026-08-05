-- ═════════════════════════════════════════════════════════════════
-- Role probe for the three privileged views — 2026-08-05 prod audit P0
-- ═════════════════════════════════════════════════════════════════
--
-- Proves, in a real database and with real roles, the thing a text guard
-- cannot: that `anon` and `authenticated` genuinely cannot read wallets and
-- balances, and that `service_role` genuinely still can.
--
-- It runs the BEFORE state first and asserts the hole is open, then applies
-- the migration and asserts it is closed. Asserting only the after-state
-- would pass just as happily against a database where the views never
-- existed — the probe has to watch the defect die.
--
-- Usage (local, disposable Postgres — no Supabase, no prod):
--   docker run --rm -d --name chesscito-probe \
--     -e POSTGRES_PASSWORD=probe -p 55432:5432 postgres:15
--   docker exec -i chesscito-probe psql -U postgres -v ON_ERROR_STOP=1 \
--     < apps/web/scripts/privileged-views-role-probe.sql
--   docker rm -f chesscito-probe
--
-- Against prod, run ONLY the section marked READ-ONLY PROD CHECK. The rest
-- creates and drops objects and must never touch a live database.

\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────────
-- 0. Reproduce Supabase's roles and default privileges
-- ─────────────────────────────────────────────────────────────────
-- Stock Postgres has none of this. The hole only exists because Supabase
-- ships these defaults, so a probe that omits them cannot see the defect.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- 1. Minimal base tables + the RLS the ledger migration actually wrote
-- ─────────────────────────────────────────────────────────────────

drop view if exists public.leaderboard_combined_v;
drop view if exists public.leaderboard_full_v;
drop view if exists public.peones_balances;
drop table if exists public.peones_ledger, public.scores, public.score_saves, public.passport_cache;

create table public.peones_ledger (
  wallet      text        not null,
  amount      bigint      not null,
  event_type  text        not null,
  pro_bypass  boolean     not null default false,
  created_at  timestamptz not null default now()
);

create table public.scores      (player text, level_id text, score bigint);
create table public.score_saves (wallet text, level_id text, score bigint);
create table public.passport_cache (player text, is_verified boolean);

insert into public.peones_ledger (wallet, amount, event_type) values
  ('0xaaaa000000000000000000000000000000000001', 500, 'earn'),
  ('0xbbbb000000000000000000000000000000000002', 900, 'earn');
insert into public.score_saves values
  ('0xaaaa000000000000000000000000000000000001', 'l1', 120),
  ('0xbbbb000000000000000000000000000000000002', 'l1', 340);

alter table public.peones_ledger enable row level security;

-- Verbatim intent of `20260607000000_peones_ledger_init.sql:250` — reads are
-- allowed only for the wallet in the JWT, which for an anon client is NULL.
create policy peones_ledger_own_reads
  on public.peones_ledger for select to authenticated, anon
  using (
    wallet = lower(coalesce(
      current_setting('request.jwt.claims', true)::json->>'wallet', ''))
  );

-- ─────────────────────────────────────────────────────────────────
-- 2. The views AS THEY SHIPPED — no security_invoker, no revoke
-- ─────────────────────────────────────────────────────────────────

create view public.peones_balances as
  select wallet,
         coalesce(sum(case
           when event_type in ('earn','adjustment')       then amount
           when event_type = 'rollback'                   then -amount
           when event_type = 'spend' and pro_bypass = false then -amount
           else 0 end), 0)::bigint as balance,
         max(created_at) as last_event_at,
         count(*)::bigint as event_count
    from public.peones_ledger group by wallet;

create view public.leaderboard_full_v as
  select sub.player,
         sum(sub.best_score)::bigint as total_score,
         rank() over (order by sum(sub.best_score) desc, sub.player asc)::int as rank,
         coalesce(pc.is_verified, false) as is_verified,
         bool_or(sub.level_has_onchain) as has_onchain
    from (
      select player, level_id, max(score) as best_score,
             bool_or(src_onchain) as level_has_onchain
        from (
          select player, level_id, score, true as src_onchain from public.scores
          union all
          select wallet as player, level_id, score, false from public.score_saves
        ) unified
       group by player, level_id
    ) sub
    left join public.passport_cache pc on pc.player = sub.player
   group by sub.player, pc.is_verified;

create view public.leaderboard_combined_v as
  select player, total_score, rank, is_verified, has_onchain
    from public.leaderboard_full_v order by rank asc, player asc limit 10;

-- ─────────────────────────────────────────────────────────────────
-- 3. BEFORE — the hole must be open, or the probe is not measuring it
-- ─────────────────────────────────────────────────────────────────

do $$
declare
  leaked_wallets int;
begin
  set local role anon;

  -- The RLS policy works when the table is read directly...
  if (select count(*) from public.peones_ledger) <> 0 then
    raise exception 'probe invalid: RLS on peones_ledger is not denying anon';
  end if;

  -- ...and is bypassed completely through the view.
  select count(*) into leaked_wallets from public.peones_balances;
  if leaked_wallets = 0 then
    raise exception
      'probe invalid: expected the pre-migration view to leak, saw 0 rows';
  end if;

  reset role;
  raise notice 'BEFORE  anon -> peones_balances        : % wallets LEAKED', leaked_wallets;
end $$;

do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.leaderboard_full_v;
  reset role;
  raise notice 'BEFORE  anon -> leaderboard_full_v     : % rows readable', n;
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 4. Apply the migration under test
-- ─────────────────────────────────────────────────────────────────
\ir ../supabase/migrations/20260805000000_close_public_access_to_privileged_views.sql

-- ─────────────────────────────────────────────────────────────────
-- 5. AFTER — anon and authenticated are locked out, service_role is not
-- ─────────────────────────────────────────────────────────────────

do $$
declare
  v_rel  text;
  v_role text;
  denied boolean;
begin
  foreach v_rel in array array[
    'public.peones_balances',
    'public.leaderboard_full_v',
    'public.leaderboard_combined_v'
  ] loop
    foreach v_role in array array['anon','authenticated'] loop
      -- Effective privilege, not the statement that was written.
      if has_table_privilege(v_role, v_rel, 'select') then
        raise exception 'AFTER: % still holds SELECT on %', v_role, v_rel;
      end if;

      -- And a real attempt really is refused.
      denied := false;
      begin
        execute format('set local role %I', v_role);
        execute format('select 1 from %s limit 1', v_rel);
      exception when insufficient_privilege then
        denied := true;
      end;
      reset role;
      if not denied then
        raise exception 'AFTER: % actually read % despite the revoke', v_role, v_rel;
      end if;
      raise notice 'AFTER   % -> % : DENIED', v_role, v_rel;
    end loop;
  end loop;
end $$;

do $$
declare n int;
begin
  set local role service_role;
  select count(*) into n from public.peones_balances;
  if n = 0 then raise exception 'AFTER: service_role lost the balances read'; end if;
  raise notice 'AFTER   service_role -> peones_balances : % wallets (app still works)', n;

  select count(*) into n from public.leaderboard_combined_v;
  if n = 0 then raise exception 'AFTER: service_role lost the leaderboard read'; end if;
  raise notice 'AFTER   service_role -> leaderboard_combined_v : % rows (Leaders still works)', n;
  reset role;
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 6. READ-ONLY PROD CHECK — safe to run against production
-- ─────────────────────────────────────────────────────────────────
-- Creates nothing, drops nothing, reads no user rows. Run this alone to
-- confirm the deployed state of a live database.

select
  c.relname                                              as view_name,
  pg_get_userbyid(c.relowner)                            as owner,
  coalesce(c.reloptions::text, '(none)')                 as options,
  has_table_privilege('anon',          n.nspname || '.' || c.relname, 'select') as anon_can_select,
  has_table_privilege('authenticated', n.nspname || '.' || c.relname, 'select') as auth_can_select,
  has_table_privilege('service_role',  n.nspname || '.' || c.relname, 'select') as service_can_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'v' and n.nspname = 'public'
order by c.relname;
