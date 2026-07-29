-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK — Slice 2A: la relación semanal del leaderboard.
--
-- NO BORRA DATOS. Este slice no escribe ninguna fila: son un índice, tres
-- funciones y una vista, todo derivado de `score_attempts`. Revertirlo no
-- puede perder nada, y por eso el rollback del feature completo (parent
-- §Rollout) es apagar el flag, no correr esto.
--
-- CUÁNDO CORRERLO DE VERDAD: casi nunca. Los objetos son inertes mientras 2B
-- no exista, y cuando exista, el kill switch de 2C apaga la UI sin tocar la
-- base. Esto es para el caso en que el DDL mismo sea el problema — un plan
-- degradado por el índice nuevo, por ejemplo.
--
-- ⚠️ EL ORDEN IMPORTA SI 2B YA ESTÁ EN PROD: revertir el CÓDIGO primero.
--    Al revés, `/api/leaderboard?window=weekly` llama una función que ya no
--    existe y devuelve 500. La ruta all-time no se ve afectada: no toca
--    ninguno de estos objetos.
-- ═══════════════════════════════════════════════════════════════════════

begin;

set local lock_timeout = '5s';

-- La vista primero: depende de weekly_ranking y el drop fallaría después.
drop view if exists public.leaderboard_weekly_full_v;

drop function if exists public.get_weekly_player_rank(text, text, timestamptz, timestamptz);
drop function if exists public.get_weekly_leaderboard(text, timestamptz, timestamptz);
drop function if exists public.weekly_ranking(text, timestamptz, timestamptz);

-- El índice se va al final y por separado: es lo único con costo real de
-- recreación (un rebuild sobre score_attempts) y lo único que un rollback
-- podría querer conservar. Si se está revirtiendo por un plan degradado, este
-- es el statement que importa; si se revierte por otra cosa, se puede dejar.
drop index if exists public.score_attempts_surface_created_idx;

commit;

-- Verificación post-rollback: todo debe dar false.
select
  to_regproc('public.weekly_ranking(text, timestamptz, timestamptz)')               is not null as fn_weekly_ranking,
  to_regproc('public.get_weekly_leaderboard(text, timestamptz, timestamptz)')       is not null as fn_board,
  to_regproc('public.get_weekly_player_rank(text, text, timestamptz, timestamptz)') is not null as fn_player_rank,
  to_regclass('public.leaderboard_weekly_full_v')                                   is not null as view_fallback,
  exists(select 1 from pg_indexes
          where schemaname = 'public'
            and tablename  = 'score_attempts'
            and indexname  = 'score_attempts_surface_created_idx')                  as idx_surface_created;

-- Y que la tabla fuente siga intacta: este slice nunca la tocó.
select count(*) as score_attempts_rows_untouched from public.score_attempts;
