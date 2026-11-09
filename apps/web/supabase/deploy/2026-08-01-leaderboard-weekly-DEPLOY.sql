-- ═══════════════════════════════════════════════════════════════════════
-- DEPLOY — Slice 2A: la relación semanal del leaderboard.
--
-- Spec: docs/specs/2026-07-29-leaders-weekly-db.md
--
-- QUÉ HACE: crea un índice, tres funciones y una vista. NO toca tablas, no
-- agrega columnas, no migra datos. Nada lo llama todavía — el endpoint llega
-- en 2B — así que aplicarlo no cambia ningún comportamiento observable.
--
-- SEGURO DE REPETIR. Todo es `create index if not exists` / `create or
-- replace`, y los revoke/grant son idempotentes. Correrlo dos veces no hace
-- daño.
--
-- ORDEN RESPECTO AL CÓDIGO: irrelevante en este slice, y eso es a propósito.
-- Mientras 2B no exista, ningún camino de la app llama estas funciones. Se
-- puede aplicar días antes del deploy de código.
--
-- CÓMO: aplicar VERBATIM el contenido de
--   supabase/migrations/20260801000000_leaderboard_weekly.sql
-- Este archivo no lo copia a propósito: dos copias del mismo DDL divergen en
-- el primer cambio a cualquiera de las dos, y la que corre en prod sería la
-- desactualizada.
--
--   docker run --rm -i postgres:17 psql "$POOLER_URL" \
--     -v ON_ERROR_STOP=1 \
--     < supabase/migrations/20260801000000_leaderboard_weekly.sql
--
-- (El host directo es IPv6-only; el pooler es `aws-1` en session mode —
--  `aws-0` responde "tenant or user not found".)
--
-- DESPUÉS: correr 2026-08-01-leaderboard-weekly-VERIFY.sql. No dar el deploy
-- por bueno sin eso: los revoke pueden estar escritos y el privilegio seguir
-- otorgado (pasó en Slice 3), y sólo la base puede decirlo.
-- ═══════════════════════════════════════════════════════════════════════

-- Chequeo previo: la tabla fuente tiene que existir y tener filas, o el board
-- semanal nace vacío por una razón distinta de la que se cree.
select
  to_regclass('public.score_attempts')                is not null as source_table_exists,
  (select count(*) from public.score_attempts)                    as attempt_rows,
  (select count(*) from public.score_attempts
    where created_at >= date_trunc('week', now() at time zone 'utc') at time zone 'utc')
                                                                  as rows_this_week;
