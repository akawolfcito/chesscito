-- Chesscito — Analytics event dimensions (additive, backward-compatible)
--
-- Adds low-cardinality dimension columns to analytics_events so a SINGLE
-- event model answers "who / where / from where / which surface / which
-- container / which build" without a second pipeline or a second dashboard.
-- See docs/specs/2026-07-23-observability-lote-1-spec.md.
--
-- ALL columns are nullable: pre-existing rows keep NULL, and older clients
-- that do not send dimensions keep inserting fine. No rename of session_id
-- (its semantics are "anonymous install id" — documented in
-- lib/analytics/identity.ts). visit_id is added for once-per-visit / per-visit
-- funnels; it is high-cardinality and intentionally NOT indexed.
--
-- Privacy: `country` is ISO-3166-1 alpha-2 ONLY, resolved server-side from the
-- edge geo header. NO full IP, city, region, postal code, lat/long is ever
-- stored (see /api/telemetry). `source` / `campaign` are allow-listed +
-- sanitized server-side; raw referrer / URL is never persisted.

alter table analytics_events
  add column if not exists surface     text,  -- 'learn' | 'play' | 'full'
  add column if not exists container   text,  -- 'minipay' | 'browser'
  add column if not exists locale      text,  -- 'en' | 'es' | ...
  add column if not exists country     text,  -- ISO alpha-2, upper, or null
  add column if not exists source      text,  -- canonical allow-list
  add column if not exists campaign    text,  -- sanitized, allow-list, or null
  add column if not exists app_version text,  -- build sha (7 chars) or 'dev'
  add column if not exists visit_id    text;  -- per-visit id (NOT indexed)

-- Defensive guard on the country dimension. NOT VALID so the migration never
-- scans / rejects legacy NULL rows; new writes are checked. NULL always passes
-- (dimension unknown is allowed). Guarded in a DO block because Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS — this keeps the migration re-runnable.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'analytics_events_country_iso2'
  ) then
    alter table analytics_events
      add constraint analytics_events_country_iso2
      check (country is null or country ~ '^[A-Z]{2}$') not valid;
  end if;
end $$;

-- Indexes only for the dimensions the /stats MVP actually filters on.
-- (event, created_at) already exists from the base migration.
create index if not exists idx_analytics_events_surface
  on analytics_events (surface, created_at desc);
create index if not exists idx_analytics_events_container
  on analytics_events (container, created_at desc);
create index if not exists idx_analytics_events_country
  on analytics_events (country, created_at desc);
