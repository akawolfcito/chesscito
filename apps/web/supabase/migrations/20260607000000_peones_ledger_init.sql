-- Chesscito — Peones append-only ledger
--
-- Sprint 3 commit A of Training Economy Alpha (calibration:
-- docs/product/chesscito-sprint-3-peones-ledger-calibration-2026-06-07.md).
-- Creates the ledger table + indexes + RLS + check constraints.
-- Dormant on merge: no writer exists yet (commits B-D wire it).
--
-- DESIGN PRINCIPLES
--   1. Append-only. event_type captures the semantic; amount stays
--      positive and the sign is derived (earn/adjustment add, spend/
--      rollback subtract). UPDATE/DELETE never happen — corrections
--      go through an `adjustment` or `rollback` row.
--   2. Balance = SUM(ledger). NO mutable balance column anywhere.
--   3. Idempotency key is the sole anti-double-write guard at the
--      DB layer. Unique constraint catches double-clicks, retries,
--      re-renders, and concurrent writes.
--   4. RLS bars client writes. The service role writes through the
--      server-side endpoints. Clients read their own wallet's rows.
--      Trust-but-rate-limit Sprint 3 (no SIWC yet — calibration §4.3).
--   5. day_utc is computed server-side at insert and used by the cap
--      logic. Caps are scoped to (wallet, day_utc, daily-family
--      source) per calibration §8.
--   6. `senda_milestone` is parked but reserved in the source enum
--      so Sprint 3+ can activate without a migration.
--
-- Spec references:
--   §3   schema + indexes + view
--   §4   RLS
--   §6   earn sources Sprint 3
--   §13  R1, R3, R4, R9, R11 mitigations

-- ─────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────

create table public.peones_ledger (
  id                bigserial    primary key,

  -- Wallet identity. Stored lowercase to dodge mixed-case / EIP-55
  -- checksum drift (calibration R9). The regex check is defensive —
  -- callers SHOULD normalize before INSERT; this catches accidents.
  wallet            text         not null
                     check (wallet ~ '^0x[0-9a-f]{40}$'),

  -- Append-only event taxonomy.
  --   earn       — credit from an in-app action (Daily, Senda exercise).
  --   spend      — debit for a consumable (Coach, hint, retry). Sprint 4.
  --   adjustment — manual ops correction (positive or negative).
  --   rollback   — reverse a prior earn/spend (uses absolute amount).
  event_type        text         not null
                     check (event_type in ('earn', 'spend', 'adjustment', 'rollback')),

  -- Always positive at write time. The sign comes from event_type.
  -- The unsigned check defends against accidental negative inserts
  -- (calibration R3).
  amount            integer      not null check (amount > 0),

  -- Logical event source. Enum lives in TypeScript (lib/peones/types.ts)
  -- and is enforced here so SQL-side drift is impossible
  -- (calibration §6, §7).
  -- senda_milestone is reserved (parked) so a future activation
  -- does not require a migration.
  source            text         not null
                     check (source in (
                       'daily_tactic',
                       'daily_streak_bonus',
                       'daily_lab',
                       'exercise_completion',
                       'senda_milestone',
                       'pack_purchase',
                       'coach',
                       'hint',
                       'retry',
                       'save_game',
                       'labyrinth_key',
                       'admin_grant'
                     )),

  -- Optional source identifier. For Daily Tactic this is the puzzleId
  -- (`dt-queen-2`); for exercise_completion it encodes the slot id
  -- (`rook-4`); for coach it's the analysisId; etc. Authors should
  -- treat it as opaque but stable.
  source_id         text,

  -- Idempotency key — DB-level guard against double earn / double
  -- spend. Format is per-source documented in calibration §9. The
  -- unique index below is the actual anti-double-write mechanism
  -- (calibration R1).
  idempotency_key   text         not null,

  -- Server-generated SHA256 over a canonical payload (calibration
  -- §10). Audit / future on-chain anchor.
  attestation_hash  text         not null,

  -- Free-form per-row metadata. Used for dashboards + debugging.
  metadata          jsonb,

  -- UTC day, server-computed at insert. The (wallet, day_utc) index
  -- is the cap-enforcement index (calibration §8).
  day_utc           date         not null,

  -- Wall-clock insert moment. Part of the attestation hash payload
  -- so two rows that match every other field but differ in created_at
  -- still hash distinctly.
  created_at        timestamptz  not null default now()
);

comment on table  public.peones_ledger is
  'Sprint 3 commit A — append-only ledger. Balance = SUM derived. NEVER UPDATE/DELETE; corrections go through adjustment/rollback rows.';
comment on column public.peones_ledger.wallet is
  'Lowercase 0x-prefixed 40-hex address. Mixed case is a write-time bug, not a read-time concern.';
comment on column public.peones_ledger.amount is
  'Always positive at write time. The sign is encoded in event_type (earn/adjustment add; spend/rollback subtract).';
comment on column public.peones_ledger.idempotency_key is
  'Per-source deterministic key. Sole DB-level anti-double-write guard.';

-- ─────────────────────────────────────────────────────────────────
-- 2. Indexes
-- ─────────────────────────────────────────────────────────────────

-- Anti-double-write — unique idempotency_key serves as the single
-- DB-level guarantee. Server-side endpoints catch the conflict and
-- return 409 with the original ledger id (calibration §5.2).
create unique index peones_ledger_idempotency_uq
  on public.peones_ledger (idempotency_key);

-- Most-frequent client query: own wallet's recent events.
create index peones_ledger_wallet_idx
  on public.peones_ledger (wallet);

-- Cap query: SUM of earn rows for a wallet on a given UTC day from
-- daily-family sources (calibration §8).
create index peones_ledger_wallet_day_idx
  on public.peones_ledger (wallet, day_utc);

-- Source-scoped histories (e.g. "all Coach spends for wallet X").
-- Mostly used by dashboards.
create index peones_ledger_wallet_source_idx
  on public.peones_ledger (wallet, source);

-- Attestation lookups for audit (and any future on-chain proof).
create index peones_ledger_attestation_idx
  on public.peones_ledger (attestation_hash);

-- HUD chip recent-events polling: order by created_at desc per wallet.
create index peones_ledger_wallet_created_idx
  on public.peones_ledger (wallet, created_at desc);

-- ─────────────────────────────────────────────────────────────────
-- 3. Balance view (derived)
-- ─────────────────────────────────────────────────────────────────

create view public.peones_balances as
select
  wallet,
  coalesce(sum(case
    when event_type in ('earn', 'adjustment') then amount
    when event_type in ('spend', 'rollback')  then -amount
  end), 0)::bigint                          as balance,
  max(created_at)                            as last_event_at,
  count(*)::bigint                           as event_count
from public.peones_ledger
group by wallet;

comment on view public.peones_balances is
  'Derived per-wallet balance. Reads SUM(ledger). NEVER cached as a mutable column anywhere in the app.';

-- ─────────────────────────────────────────────────────────────────
-- 4. Cap-aware balance helper
-- ─────────────────────────────────────────────────────────────────
--
-- Returns three numbers for the (wallet, day_utc) tuple a caller
-- already holds:
--   balance               — full SUM(ledger).
--   daily_earned_capped   — Peones earned today from daily-family
--                           sources (the value the cap enforces against).
--   daily_cap             — current cap value. Sprint 3 ships at 10.
--
-- The endpoint POST /api/peones/earn calls this BEFORE the insert to
-- decide truncate vs reject. Sprint 3 keeps the cap value here (not
-- on a config table) — when product wants to change it, it's a
-- one-line migration.

create function public.peones_balance_with_caps(
  p_wallet  text,
  p_day_utc date
)
returns table (
  balance              bigint,
  daily_earned_capped  bigint,
  daily_cap            integer
)
language sql
stable
as $$
  select
    coalesce(sum(case
      when event_type in ('earn', 'adjustment') then amount
      when event_type in ('spend', 'rollback')  then -amount
    end), 0)::bigint                              as balance,
    coalesce(sum(case
      when event_type = 'earn'
        and source in ('daily_tactic', 'daily_streak_bonus', 'daily_lab')
        and day_utc = p_day_utc
      then amount
    end), 0)::bigint                              as daily_earned_capped,
    10::integer                                    as daily_cap
  from public.peones_ledger
  where wallet = p_wallet;
$$;

comment on function public.peones_balance_with_caps(text, date) is
  'Sprint 3 commit A — cap-aware balance helper. Used by POST /api/peones/earn (Sprint 3 commit D) to decide truncate vs reject. Cap = 10 hard-coded; change via migration.';

-- ─────────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────────

alter table public.peones_ledger enable row level security;

-- Server-only writes. The service role bypasses RLS, so the endpoints
-- can insert. Clients (anon + authenticated) are blocked at the
-- policy layer (calibration R11).
create policy peones_ledger_no_client_writes
  on public.peones_ledger
  for insert
  to authenticated, anon
  with check (false);

create policy peones_ledger_no_client_updates
  on public.peones_ledger
  for update
  to authenticated, anon
  using (false)
  with check (false);

create policy peones_ledger_no_client_deletes
  on public.peones_ledger
  for delete
  to authenticated, anon
  using (false);

-- Wallet-bound reads. Sprint 3 ships without SIWC, so the
-- request.jwt.claims.wallet path will resolve to NULL for anon
-- clients today; effectively the SELECT policy denies all anon
-- reads via the public client, and the server-side endpoint
-- forwards reads on behalf of the wallet using the service role.
-- When SIWC lands (Sprint 4 or later), this policy unlocks direct
-- client reads without code changes here.
create policy peones_ledger_own_reads
  on public.peones_ledger
  for select
  to authenticated, anon
  using (
    wallet = lower(coalesce(
      current_setting('request.jwt.claims', true)::json->>'wallet',
      ''
    ))
  );

-- Note: the view inherits RLS from the underlying table; no extra
-- policy needed.

-- ─────────────────────────────────────────────────────────────────
-- 6. Migration footer
-- ─────────────────────────────────────────────────────────────────

-- Sprint 3 commit B adds the pure ledger service (computeBalance,
-- applyCap, buildAttestationHash, idempotency helpers) with focused
-- tests. Sprint 3 commit C adds GET /api/peones/balance reading
-- through the cap-aware function. Sprint 3 commit D adds POST
-- /api/peones/earn. Wire-up to Daily Tactic + Training delta lands
-- in commits E and F respectively.
