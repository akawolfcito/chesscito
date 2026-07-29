-- ═══════════════════════════════════════════════════════════════════════
-- VERIFY — Slice 2A. READ-ONLY: no escribe nada, es seguro contra prod.
--
-- Spec: docs/specs/2026-07-29-leaders-weekly-db.md (DB-18 … DB-21)
--
-- Esto NO reemplaza al smoke (supabase/tests/leaderboard_weekly_smoke.sql),
-- que necesita insertar fixtures y por eso corre sólo en local. Lo que este
-- archivo verifica es lo único que hay que confirmar en prod: que los objetos
-- existan y que los privilegios EFECTIVOS sean los correctos.
--
-- POR QUÉ MIRAR EL PRIVILEGIO EFECTIVO Y NO EL TEXTO DEL REVOKE
-- -------------------------------------------------------------
-- Supabase corre `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon,
-- authenticated, service_role`, así que toda función nueva nace con un grant
-- EXPLÍCITO a esos roles además del de PUBLIC. Revocar de PUBLIC no lo toca.
-- En Slice 3 la migración decía `revoke` y `has_function_privilege('anon', …)`
-- devolvía TRUE igual. Un grep sobre el .sql pasa en verde con la función
-- expuesta; sólo la base sabe.
-- ═══════════════════════════════════════════════════════════════════════

\echo '── 1. Objetos creados ────────────────────────────────────────────'

select
  to_regproc('public.weekly_ranking(text, timestamptz, timestamptz)')                  is not null as fn_weekly_ranking,
  to_regproc('public.get_weekly_leaderboard(text, timestamptz, timestamptz)')          is not null as fn_board,
  to_regproc('public.get_weekly_player_rank(text, text, timestamptz, timestamptz)')    is not null as fn_player_rank,
  to_regclass('public.leaderboard_weekly_full_v')                                      is not null as view_fallback,
  exists(select 1 from pg_indexes
          where schemaname = 'public'
            and tablename  = 'score_attempts'
            and indexname  = 'score_attempts_surface_created_idx')                     as idx_surface_created;

\echo '── 2. Privilegios efectivos — TODO debe ser false salvo service_role ─'

select
  f.sig,
  has_function_privilege('anon',          f.sig, 'execute') as anon_execute,
  has_function_privilege('authenticated', f.sig, 'execute') as authenticated_execute,
  has_function_privilege('service_role',  f.sig, 'execute') as service_role_execute
from (values
  ('public.weekly_ranking(text, timestamptz, timestamptz)'),
  ('public.get_weekly_leaderboard(text, timestamptz, timestamptz)'),
  ('public.get_weekly_player_rank(text, text, timestamptz, timestamptz)')
) f(sig);

\echo '── 3. La ACL cruda, para ver el grant explícito si quedó ──────────'

select p.proname, p.proacl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('weekly_ranking', 'get_weekly_leaderboard', 'get_weekly_player_rank');

\echo '── 4. La vista: no legible por clientes, y security_invoker ───────'

select
  has_table_privilege('anon',          'public.leaderboard_weekly_full_v', 'select') as anon_select,
  has_table_privilege('authenticated', 'public.leaderboard_weekly_full_v', 'select') as authenticated_select,
  has_table_privilege('service_role',  'public.leaderboard_weekly_full_v', 'select') as service_role_select,
  (select 'security_invoker=true' = any(c.reloptions)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'leaderboard_weekly_full_v')          as security_invoker;

\echo '── 5. La ventana que la vista computa AHORA (debe ser lunes UTC) ──'

select
  date_trunc('week', now() at time zone 'utc') at time zone 'utc'                     as week_start,
  to_char(date_trunc('week', now() at time zone 'utc'), 'Dy')                         as week_start_dow,
  current_setting('TimeZone')                                                         as db_timezone;

\echo '── 6. Filas semanales por superficie (sanity, no aserción) ────────'

select surface, count(*) as ranked_wallets
  from public.leaderboard_weekly_full_v
 group by surface
 order by surface;
