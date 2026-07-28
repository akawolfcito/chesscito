-- Verificación post-deploy. READ-ONLY: no escribe nada.
-- Correr DESPUÉS del DEPLOY.sql y ANTES del push.

-- 1. Debe existir UNA sola firma de save_basic_score, con 9 args.
--    Dos firmas = llamada ambigua en runtime = todos los saves fallan.
select 'save_basic_score' as objeto,
       count(*) as firmas,
       max(pronargs) as args,
       case when count(*) = 1 and max(pronargs) = 9 then 'OK' else 'REVISAR' end as estado
  from pg_proc where proname = 'save_basic_score';

-- 2. Las funciones de sesión existen.
select proname as objeto, 'OK' as estado
  from pg_proc
 where proname in ('authorize_score_write_session',
                   'consume_score_write_session',
                   'revoke_score_write_session',
                   'purge_expired_score_write_sessions')
 order by proname;

-- 3. La tabla de sesiones existe y la de nonces NO (fue superseded).
select 'score_write_sessions' as objeto,
       case when to_regclass('public.score_write_sessions') is not null
            then 'OK' else 'FALTA' end as estado
union all
select 'score_save_nonces (debe NO existir)',
       case when to_regclass('public.score_save_nonces') is null
            then 'OK' else 'REVISAR' end;

-- 4. score_saves.surface existe y es nullable.
select 'score_saves.surface' as objeto,
       case when is_nullable = 'YES' then 'OK (nullable)' else 'REVISAR' end as estado
  from information_schema.columns
 where table_name = 'score_saves' and column_name = 'surface';

-- 5. total_score es bigint en ambas vistas (audit R13).
select table_name as objeto,
       data_type,
       case when data_type = 'bigint' then 'OK' else 'REVISAR' end as estado
  from information_schema.columns
 where table_name in ('leaderboard_full_v', 'leaderboard_combined_v')
   and column_name = 'total_score'
 order by table_name;

-- 6. El leaderboard responde (esto es lo que ve el jugador).
select 'get_leaderboard()' as objeto, count(*) as filas, 'OK' as estado
  from public.get_leaderboard();

-- 7. Los datos existentes siguen ahí, intactos.
select 'score_saves' as objeto,
       count(*) as filas_totales,
       count(surface) as con_surface,
       count(*) - count(surface) as surface_null_esperado
  from public.score_saves;

-- 8. RLS activa en la tabla de sesiones (contiene credenciales hasheadas).
select 'RLS score_write_sessions' as objeto,
       case when relrowsecurity then 'OK' else 'REVISAR' end as estado
  from pg_class where relname = 'score_write_sessions';
