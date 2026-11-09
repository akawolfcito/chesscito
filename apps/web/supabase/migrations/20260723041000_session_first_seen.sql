-- Chesscito — session_first_seen cohort table
--
-- Retention (D1/D7, designed to reach D30 with NO further migration) needs a
-- per-anonymous-id "day 0" that OUTLIVES the 90-day analytics_events prune.
-- This table is intentionally excluded from prune_analytics_events(): one row
-- per install, fixed on the first visit, never rewritten.
--
-- Idempotent: `on conflict (session_id) do nothing` — only the first visit
-- fixes the cohort (first_seen + first-touch attribution). Later visits do NOT
-- overwrite it, so D1/D7/D30 cohorts stay stable.
--
-- session_id here is the anonymous install id (lib/analytics/identity.ts),
-- matching analytics_events.session_id. No wallet / PII. Writes go through the
-- service role (/api/telemetry); RLS stays default-deny for anon.

create table if not exists session_first_seen (
  session_id      text primary key,
  first_seen      timestamptz not null default now(),
  first_surface   text,
  first_container text,
  first_country   text,  -- ISO alpha-2 or null (same privacy rule as events)
  first_source    text
);

-- Cohort scans slice by day: "installs whose first_seen was on day D".
create index if not exists idx_session_first_seen_first_seen
  on session_first_seen (first_seen);

alter table session_first_seen enable row level security;
-- No policies => default-deny for anon / authenticated. Service role bypasses
-- RLS, so only server-side telemetry can read/write. Mirrors analytics_events.
