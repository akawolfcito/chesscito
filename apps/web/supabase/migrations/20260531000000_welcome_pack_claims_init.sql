-- Chesscito — Welcome Pack claims ledger
--
-- Commit 1 of 10 (spec _bmad-output/planning-artifacts/ux-shield-rescue-and-
-- welcome-pack-2026-05-31.md). Creates the table + indexes + RLS. Dormant on
-- merge: no writer exists yet (commit 2 adds POST /api/welcome-pack/claim),
-- no reader (commit 2 adds GET /api/welcome-pack/status).
--
-- Purpose: server-side ledger that enforces "one Welcome Pack per wallet
-- address" semantics for the fail-rescue Welcome Pack discoverability flow.
-- Client-side localStorage cache is UI snappiness only; this table is the
-- single source of truth.
--
-- Why server-side ledger and not localStorage:
--   - localStorage is trivially bypassed (incognito, new browser, clear cache)
--   - browser fingerprinting has unacceptable false positives on shared NAT
--   - wallet address is the canonical identity in MiniPay + Celo, and the
--     wagmi signature flow already proves the claim is by the wallet's owner
--
-- Spec references:
--   §2  binding decision #1 — server-side ledger keyed by wallet
--   §5.1 schema (this file)
--   §5.2 endpoint contract (commit 2)
--   §5.4 Phase 2 rate limiting (uses ip_hash index, deferred)

create table public.welcome_pack_claims (
  -- Identity. Lowercase 0x address; CHECK enforces normalization so
  -- /api/welcome-pack/claim cannot drift from the canonical form, and
  -- 0xABC vs 0xabc cannot both claim.
  wallet_address   text         not null primary key
    check (wallet_address = lower(wallet_address)),

  -- Time. claimed_at is set on INSERT and never refreshed. No expiration
  -- column by design: Welcome Pack is "once per wallet, forever". If a
  -- future product change introduces seasonal re-claims, that should be a
  -- separate table (welcome_pack_seasons) — not a refresh on this row.
  claimed_at       timestamptz  not null default now(),

  -- Defense in depth. ip_hash is SHA-256(ip || CLAIM_IP_HASH_SALT) per
  -- §5.2. Used by Phase 2 rate limiter (5 claims/hour per ip_hash) to
  -- slow wallet farms without false-positiving shared NAT users by IP
  -- alone. Nullable because Phase 1 inserts may not have IP context
  -- (e.g. during local dev or if behind a proxy where the IP wasn't
  -- forwarded). Server-side rate limit code will skip rows with NULL.
  ip_hash          text,

  -- Replay protection inputs. signature + message are stored so that:
  --   1. We can prove (in post-incident audit) that the claim was made
  --      by the wallet's owner, not by an attacker who forged the
  --      wallet_address field.
  --   2. We have the canonical message that was signed, including the
  --      timestamp, so replay attacks across the ±5min window can be
  --      reconstructed during forensics.
  -- Both are NOT NULL because the endpoint refuses to insert without
  -- a verified signature (§5.2 endpoint logic step 4).
  signature        text         not null,
  message          text         not null,

  -- Telemetry context. Nullable — we don't want a missing UA to block
  -- a legitimate claim. Useful for analyzing claim distribution by app
  -- version (e.g. detecting if a buggy version is failing to claim).
  app_version      text,
  user_agent_hash  text
);

-- Hot-path lookup #1: existence check by wallet. PRIMARY KEY already
-- provides this index; documenting for clarity. ON CONFLICT (wallet_address)
-- DO NOTHING uses this for idempotent claim retries.

-- Hot-path lookup #2: recent-claims timeline for ops/observability
-- ("how many people claimed today?"). Sparse use, but cheap.
create index welcome_pack_claims_claimed_at_idx
  on public.welcome_pack_claims (claimed_at desc);

-- Phase 2 rate limiting: count claims by ip_hash within a sliding window.
-- Composite index supports (ip_hash, claimed_at desc) range scans.
-- Partial index excludes NULL ip_hash rows from index bloat.
create index welcome_pack_claims_ip_hash_idx
  on public.welcome_pack_claims (ip_hash, claimed_at desc)
  where ip_hash is not null;

-- Defense-in-depth: even if SUPABASE_SERVICE_ROLE_KEY leaked OR an anon
-- key were ever exposed client-side, RLS would block direct table access.
-- All legit access is via /api/welcome-pack/* endpoints with service role.
alter table public.welcome_pack_claims enable row level security;

create policy "service_role full access"
  on public.welcome_pack_claims for all
  to service_role using (true) with check (true);

-- No anon/authenticated policy exists by design: clients only access via
-- /api/welcome-pack/* endpoints. If a future surface needs direct read,
-- add a targeted policy then — don't widen this one.

-- Comment block for psql \d+ output and future maintainers.
comment on table public.welcome_pack_claims is
  'Welcome Pack claim ledger. One row per wallet that has claimed the '
  'starter pack (3 shields). Insertion is idempotent via ON CONFLICT '
  '(wallet_address) DO NOTHING. See spec ux-shield-rescue-and-welcome-'
  'pack-2026-05-31.md §5.';

comment on column public.welcome_pack_claims.wallet_address is
  'Lowercase 0x address. CHECK enforces normalization.';

comment on column public.welcome_pack_claims.ip_hash is
  'SHA-256(ip || CLAIM_IP_HASH_SALT). Phase 2 rate limit input. Nullable.';

comment on column public.welcome_pack_claims.signature is
  'EIP-191 personal_sign over message field. Verified server-side at claim time.';

comment on column public.welcome_pack_claims.message is
  'Canonical signed message including ±5min-window ISO timestamp for replay defense.';
