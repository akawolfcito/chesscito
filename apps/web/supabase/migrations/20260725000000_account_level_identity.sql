-- Chesscito — account-level identity for analytics (pseudonymous, no wallet)
--
-- Until now the analytics unit was `session_id`, the anonymous install id from
-- localStorage. That measures a BROWSER, not a person: two devices read as two
-- users and clearing storage mints a brand-new one. With the web access gate
-- mandatory there is finally a stable identity (the Privy embedded wallet), so
-- "new / active / dormant / inactive accounts" becomes answerable.
--
-- PRIVACY — the wallet is NEVER stored. `account_ref` is
-- HMAC-SHA256(lowercased address, TELEMETRY_ACCOUNT_SECRET) computed
-- server-side in /api/telemetry and truncated to 32 hex chars (128 bits).
-- Reasons this is an HMAC with a server secret and not a plain hash:
-- the set of real addresses is enumerable, so an unkeyed SHA-256 of an address
-- is reversible by anyone with a wallet list. Without the secret the column is
-- not linkable back to a person; rotating the secret orphans old rows on
-- purpose. The raw address reaches the server transiently and is never
-- persisted or logged.
--
-- Both objects are additive and nullable: older clients that do not send an
-- address keep inserting fine, and every account-level metric degrades to
-- "unavailable" rather than wrong when the secret is unset.

alter table analytics_events
  add column if not exists account_ref text;

-- Guard: 32 lowercase hex chars, or null (no wallet / secret unset). NOT VALID
-- so the migration never scans legacy rows; new writes are checked. Guarded in
-- a DO block because Postgres has no ADD CONSTRAINT IF NOT EXISTS.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'analytics_events_account_ref_hex'
  ) then
    alter table analytics_events
      add constraint analytics_events_account_ref_hex
      check (account_ref is null or account_ref ~ '^[0-9a-f]{32}$') not valid;
  end if;
end $$;

create index if not exists idx_analytics_events_account_ref
  on analytics_events (account_ref, created_at desc);

-- Account cohort table — the account analogue of session_first_seen, and for
-- the same reason: "inactive" is not an event, it is the ABSENCE of one, so it
-- can only be derived against a denominator that outlives the 90-day
-- analytics_events prune. One row per account, fixed on first sight, never
-- rewritten (`on conflict do nothing`), so cohorts stay stable.
create table if not exists account_first_seen (
  account_ref     text primary key,
  first_seen      timestamptz not null default now(),
  first_surface   text,
  first_container text,
  first_country   text  -- ISO alpha-2 or null, same privacy rule as events
);

-- Cohort scans slice by day and by "accounts that existed before day D".
create index if not exists idx_account_first_seen_first_seen
  on account_first_seen (first_seen);

alter table account_first_seen enable row level security;
-- No policies => default-deny for anon / authenticated. Service role bypasses
-- RLS, so only server-side telemetry can read/write. Mirrors analytics_events.
