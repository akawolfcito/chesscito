-- ═══════════════════════════════════════════════════════════════════════
-- VERIFY — Slice 2A. READ-ONLY: no escribe nada, es seguro contra prod.
--
-- Spec: docs/specs/2026-07-29-leaders-weekly-db.md (DB-18 … DB-21)
--
-- UNA SOLA CONSULTA, A PROPÓSITO
-- ------------------------------
-- El SQL Editor de Supabase muestra únicamente el ÚLTIMO result set, y los
-- meta-comandos de psql (`\echo`) ni siquiera son SQL: ahí revientan con
-- `syntax error at or near "\"`. La primera versión de este archivo usaba
-- ambos y sólo servía desde psql. Como una sola consulta, corre igual pegada
-- en Studio o con `psql -f`.
--
-- CÓMO LEERLO: si alguna fila trae `ok = false`, el deploy NO está bien.
-- Vienen ordenadas con los fallos primero.
--
-- Esto NO reemplaza al smoke (supabase/tests/leaderboard_weekly_smoke.sql),
-- que necesita insertar fixtures y por eso corre sólo en local. Acá se
-- confirma lo único que hace falta en prod: que los objetos existan y que los
-- privilegios EFECTIVOS sean los correctos.
--
-- POR QUÉ EL PRIVILEGIO EFECTIVO Y NO EL TEXTO DEL REVOKE
-- -------------------------------------------------------
-- Supabase corre `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon,
-- authenticated, service_role`, así que toda función nueva nace con un grant
-- EXPLÍCITO a esos roles además del de PUBLIC. Revocar de PUBLIC no lo toca.
-- En Slice 3 la migración decía `revoke` y `has_function_privilege('anon', …)`
-- devolvía TRUE igual. Un grep sobre el .sql pasa en verde con la función
-- expuesta; sólo la base sabe.
--
-- ⚠️ to_regPROCEDURE, no to_regPROC: el primero acepta una FIRMA, el segundo
-- sólo un nombre y devuelve NULL ante una lista de argumentos — lo que hacía
-- que las tres funciones se reportaran ausentes estando presentes.
-- ═══════════════════════════════════════════════════════════════════════

with fns(sig) as (
  values
    ('public.weekly_ranking(text, timestamptz, timestamptz)'),
    ('public.get_weekly_leaderboard(text, timestamptz, timestamptz)'),
    ('public.get_weekly_player_rank(text, text, timestamptz, timestamptz)')
),
checks as (
  -- ── Objetos ────────────────────────────────────────────────────────
  select 1 as ord, 'index score_attempts_surface_created_idx' as item,
         exists(select 1 from pg_indexes
                 where schemaname = 'public'
                   and tablename  = 'score_attempts'
                   and indexname  = 'score_attempts_surface_created_idx') as ok,
         'existe' as expected
  union all
  select 1, 'function ' || f.sig,
         to_regprocedure(f.sig) is not null,
         'existe'
    from fns f
  union all
  select 1, 'view leaderboard_weekly_full_v',
         to_regclass('public.leaderboard_weekly_full_v') is not null,
         'existe'

  -- ── EXECUTE: anon y authenticated NO; service_role SÍ ──────────────
  union all
  select 2, r.role || ' EXECUTE ' || f.sig,
         not has_function_privilege(r.role, f.sig, 'execute'),
         'sin EXECUTE'
    from fns f, (values ('anon'), ('authenticated')) r(role)
  union all
  select 2, 'service_role EXECUTE ' || f.sig,
         has_function_privilege('service_role', f.sig, 'execute'),
         'con EXECUTE'
    from fns f

  -- ── SELECT sobre la vista ──────────────────────────────────────────
  union all
  select 3, r.role || ' SELECT leaderboard_weekly_full_v',
         not has_table_privilege(r.role, 'public.leaderboard_weekly_full_v', 'select'),
         'sin SELECT'
    from (values ('anon'), ('authenticated')) r(role)
  union all
  select 3, 'service_role SELECT leaderboard_weekly_full_v',
         has_table_privilege('service_role', 'public.leaderboard_weekly_full_v', 'select'),
         'con SELECT'

  -- ── security_invoker: defensa en profundidad sobre la RLS ──────────
  union all
  select 4, 'view security_invoker=true',
         coalesce((select 'security_invoker=true' = any(c.reloptions)
                     from pg_class c
                     join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public'
                      and c.relname = 'leaderboard_weekly_full_v'), false),
         'true'

  -- ── La ventana que la vista computa AHORA ──────────────────────────
  union all
  select 5, 'week_start cae en lunes UTC ('
              || to_char(date_trunc('week', now() at time zone 'utc'), 'YYYY-MM-DD Dy')
              || ', db TimeZone=' || current_setting('TimeZone') || ')',
         to_char(date_trunc('week', now() at time zone 'utc'), 'Dy') = 'Mon',
         'Mon'
)
select
  case when ok then 'PASS' else 'FAIL' end as status,
  item,
  expected,
  ok
from checks
order by ok asc, ord asc, item asc;

-- ───────────────────────────────────────────────────────────────────────
-- Informativo, NO aserciones. Pegarlos por separado (en Studio sólo se ve
-- el último result set, así que no pueden vivir en la misma corrida).
--
--   -- La ACL cruda, para ver un grant explícito que haya sobrevivido:
--   select p.proname, p.proacl
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('weekly_ranking','get_weekly_leaderboard','get_weekly_player_rank');
--
--   -- Cuántas wallets rankean esta semana por superficie (sanity):
--   select surface, count(*) as ranked_wallets
--     from public.leaderboard_weekly_full_v group by surface order by surface;
-- ───────────────────────────────────────────────────────────────────────
