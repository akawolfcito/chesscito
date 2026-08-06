-- Chesscito — victories + sync_state baseline (backfill de drift)
--
-- WHY. Estas dos tablas viven en producción pero NINGUNA migración las crea.
-- Se aplicaron a mano desde `src/lib/supabase/schema.sql` el 2026-04-06, y las
-- tres migraciones baseline de esa fecha (20260406000000, 20260406010000,
-- 20260419000000) son placeholders vacíos: registran el hecho sin reproducir
-- el DDL.
--
-- CONSECUENCIA, verificada el 2026-08-06: un `supabase db reset` limpio arma un
-- entorno SIN ellas, y restaurar un dump de prod falla en tres sentencias
-- (`victories`, `victories_id_seq`, `sync_state`). El código que las lee
-- —`lib/server/sync-blockchain.ts` (el indexer que las escribe), las rutas
-- `/api/hall-of-fame` y `/api/my-victories`, `lib/stats/onchain.ts`— revienta
-- SÓLO en local, donde el síntoma parece un bug de aplicación y no de entorno.
--
-- Es el mismo movimiento que `20260610000000_leaderboard_combined_view.sql`
-- ya hizo para las otras dos tablas de schema.sql (`scores`, `passport_cache`):
-- espejar la forma canónica con `if not exists`, de modo que en hosted sea un
-- no-op y en local reconstruya lo que falta.
--
-- ⚠️ Las formas de acá se verificaron contra un dump de prod del 2026-08-06,
-- NO contra schema.sql. El RLS y la policy de lectura pública de `victories`
-- existen en hosted y NO están en schema.sql — copiarlo de ahí habría dejado
-- el local más abierto que producción.
--
-- Los GRANT a anon/authenticated/service_role no se escriben acá: Supabase los
-- aplica solo por default privileges sobre `public` (misma razón por la que
-- ninguna otra migración del repo los declara).

-- ─────────────────────────────────────────────────────────────────
-- 1. victories — una fila por evento VictoryMinted
-- ─────────────────────────────────────────────────────────────────
-- `serial` reproduce exactamente lo que hay en hosted: la secuencia
-- `victories_id_seq` como integer, con OWNED BY sobre la columna.
-- Los nombres de constraint que genera esta forma (victories_pkey,
-- victories_token_id_key, victories_tx_hash_key, victories_player_check)
-- coinciden uno a uno con los del dump de prod.

create table if not exists public.victories (
  id          serial primary key,
  token_id    bigint unique not null,
  player      text not null check (player = lower(player)),
  difficulty  smallint not null,
  total_moves int not null,
  time_ms     int not null,
  tx_hash     text unique not null,
  minted_at   timestamptz not null
);

create index if not exists idx_victories_player
  on public.victories (player);

alter table public.victories enable row level security;

-- Lectura pública: los trofeos son el muro de la fama, visible sin wallet.
-- Escribe sólo el indexer con service_role, que saltea RLS.
drop policy if exists victories_select_public on public.victories;
create policy victories_select_public
  on public.victories for select using (true);

-- ─────────────────────────────────────────────────────────────────
-- 2. sync_state — cursor del indexer (último bloque sincronizado)
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.sync_state (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

alter table public.sync_state enable row level security;
-- Sin policies => default-deny para anon / authenticated. Sólo el service role
-- (que saltea RLS) mueve el cursor. Coincide con hosted, donde tampoco hay
-- ninguna policy sobre esta tabla.
