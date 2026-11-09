-- Chesscito — paridad de RLS con producción (backfill del baseline)
--
-- WHY. `20260419000000_rls_enable.sql` es un placeholder VACÍO: dice que el RLS
-- se activó "across user-facing tables" el 2026-04-19, sin ejecutar una sola
-- sentencia. En hosted se aplicó a mano y ahí está; en las migraciones nunca
-- entró. Resultado medido el 2026-08-06 sobre un local recién reconstruido:
--
--   prod: 21 de 21 tablas de `public` con RLS
--   local (sólo migraciones): 18 de 21
--
-- Las tres que faltan son las de este archivo. Con los GRANT que Supabase
-- aplica por default privileges (ALL a anon/authenticated sobre `public`), una
-- tabla sin RLS queda legible y escribible con la anon key.
--
-- ⚠️ El caso más grave es `analytics_events`, porque su propia migración
-- (20260424000000) AFIRMA la propiedad que no implementa:
--
--     "Writes go through /api/telemetry (service role) so RLS stays
--      default-deny for anon."
--
-- El comentario describe la intención; el SQL nunca corrió el `enable row
-- level security`. Prod está bien porque se activó por fuera. Cualquier
-- entorno reconstruido desde migraciones, no: expone 216k filas de telemetría
-- —incluido `country`— a la anon key. Un comentario no es un control.
--
-- Esta migración es idempotente y en hosted es un no-op: `enable row level
-- security` sobre una tabla que ya lo tiene no falla ni cambia nada.
--
-- Formas tomadas del dump de prod del 2026-08-06, no de `src/lib/supabase/schema.sql`
-- (ese archivo no menciona RLS). Ver `20260806000000_victories_sync_state_baseline.sql`,
-- que cierra la otra mitad del mismo baseline.

-- ─────────────────────────────────────────────────────────────────
-- 1. analytics_events — deny total salvo service_role
-- ─────────────────────────────────────────────────────────────────
-- Sin policies => default-deny para anon / authenticated. Escribe
-- /api/telemetry con service_role, que saltea RLS. Es exactamente lo que
-- prod tiene: RLS activo y cero policies.

alter table public.analytics_events enable row level security;

-- ─────────────────────────────────────────────────────────────────
-- 2. passport_cache — deny total salvo service_role
-- ─────────────────────────────────────────────────────────────────
-- Cache de verificación de Passport por wallet. En prod: RLS activo, cero
-- policies. Se lee y escribe sólo del lado del servidor.

alter table public.passport_cache enable row level security;

-- ─────────────────────────────────────────────────────────────────
-- 3. scores — lectura pública, escritura sólo del indexer
-- ─────────────────────────────────────────────────────────────────
-- Una fila por evento ScoreSubmitted on-chain: es el leaderboard, visible sin
-- wallet. Misma postura que `victories`: SELECT abierto, escritura reservada
-- al service_role. La policy se recrea con drop-then-create porque
-- `create policy` no admite `if not exists` (mismo patrón que
-- 20260729000000 / 20260730000000 / 20260731000000).

alter table public.scores enable row level security;

drop policy if exists scores_select_public on public.scores;
create policy scores_select_public
  on public.scores for select using (true);
