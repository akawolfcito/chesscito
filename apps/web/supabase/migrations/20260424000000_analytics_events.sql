-- Chesscito — Analytics events telemetry
--
-- Anonymous event stream for product decisions: which share tile gets
-- tapped, which modals are opened, which dock items are used, how the
-- share-with-image flow performs. No PII, no wallet addresses, only
-- an opaque session_id generated client-side + the event name + a
-- jsonb payload with non-sensitive props.
--
-- Writes go through /api/telemetry (service role) so RLS stays default-
-- deny for anon. Reads are dev-only from the Supabase dashboard or a
-- signed-in admin session.

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null,
  event text not null,
  props jsonb
);

-- Ordered scans: "what happened in this session?" and "what events
-- spiked in the last hour?" are the two most common lookups.
create index idx_analytics_events_created_at on analytics_events(created_at desc);
create index idx_analytics_events_session on analytics_events(session_id, created_at desc);
create index idx_analytics_events_event on analytics_events(event, created_at desc);
