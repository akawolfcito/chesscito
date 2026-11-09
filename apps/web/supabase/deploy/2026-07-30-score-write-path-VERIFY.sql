-- Verificación post-deploy. READ-ONLY: no escribe nada.
-- Correr DESPUÉS del DEPLOY.sql y ANTES del push.
--
-- UNA sola consulta a propósito: el SQL Editor de Supabase muestra únicamente
-- el resultado del ÚLTIMO statement cuando corrés varios, así que una lista de
-- SELECTs sueltos deja 10 de 11 chequeos invisibles y da una falsa sensación de
-- "todo OK". Todo va por UNION ALL para que la tabla se vea completa.
--
-- Criterio: la columna `estado` debe decir OK en las 11 filas.

select * from (

  -- 1. UNA sola firma de save_basic_score, con 9 args.
  --    Dos firmas = llamada ambigua en runtime = todos los saves fallan.
  select 1 as n,
         'save_basic_score' as objeto,
         count(*) || ' firma(s), ' || coalesce(max(pronargs)::text, '-') || ' args' as valor,
         case when count(*) = 1 and max(pronargs) = 9 then 'OK' else '** REVISAR **' end as estado
    from pg_proc where proname = 'save_basic_score'

  -- 2. Las cuatro funciones de sesión existen.
  union all
  select 2,
         'funciones de sesión',
         count(*) || ' de 4',
         case when count(*) = 4 then 'OK' else '** REVISAR **' end
    from pg_proc
   where proname in ('authorize_score_write_session',
                     'consume_score_write_session',
                     'revoke_score_write_session',
                     'purge_expired_score_write_sessions')

  -- 3. La tabla de sesiones existe.
  union all
  select 3,
         'tabla score_write_sessions',
         coalesce(to_regclass('public.score_write_sessions')::text, '(no existe)'),
         case when to_regclass('public.score_write_sessions') is not null
              then 'OK' else '** FALTA **' end

  -- 4. La de nonces NO existe (fue superseded por las sesiones).
  union all
  select 4,
         'score_save_nonces (debe NO existir)',
         coalesce(to_regclass('public.score_save_nonces')::text, '(no existe)'),
         case when to_regclass('public.score_save_nonces') is null
              then 'OK' else '** REVISAR **' end

  -- 5. RLS activa: la tabla guarda hashes de credenciales.
  union all
  select 5,
         'RLS en score_write_sessions',
         case when relrowsecurity then 'habilitada' else 'DESHABILITADA' end,
         case when relrowsecurity then 'OK' else '** REVISAR **' end
    from pg_class where relname = 'score_write_sessions'

  -- 6. score_saves.surface existe y es nullable.
  union all
  select 6,
         'score_saves.surface',
         data_type || ', nullable=' || is_nullable,
         case when is_nullable = 'YES' then 'OK' else '** REVISAR **' end
    from information_schema.columns
   where table_name = 'score_saves' and column_name = 'surface'

  -- 7-8. total_score en bigint en ambas vistas (audit R13: el ::int
  --      desbordaba y hacía raise a la vista entera, tumbando Leaders).
  union all
  select case when table_name = 'leaderboard_full_v' then 7 else 8 end,
         table_name || '.total_score',
         data_type,
         case when data_type = 'bigint' then 'OK' else '** REVISAR **' end
    from information_schema.columns
   where table_name in ('leaderboard_full_v', 'leaderboard_combined_v')
     and column_name = 'total_score'

  -- 9. El leaderboard responde. Esto es lo que ve el jugador.
  union all
  select 9,
         'get_leaderboard() responde',
         count(*) || ' filas',
         'OK'
    from public.get_leaderboard()

  -- 10. Los datos existentes siguen ahí. `surface` en NULL es lo ESPERADO:
  --     son filas escritas por código que no sabía de superficies, y NULL
  --     significa "provenance desconocida", no una suposición.
  union all
  select 10,
         'score_saves intactas',
         count(*) || ' filas, ' || count(surface) || ' con surface, '
                 || (count(*) - count(surface)) || ' en NULL (esperado)',
         'OK'
    from public.score_saves

  -- 11. Sesiones de escritura. Antes del push debería ser 0: nadie firmó aún.
  union all
  select 11,
         'sesiones de escritura',
         count(*) || ' filas',
         'OK'
    from public.score_write_sessions

) t order by n;
