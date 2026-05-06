-- Chesscito — Coach session memory: durable analysis store
--
-- PR 1 of 5 (spec docs/superpowers/specs/2026-05-06-coach-session-memory-design.md).
-- Creates the table + indexes + RLS + check constraints. Dormant on merge:
-- no writer exists yet (PR 2 adds persistAnalysis), no reader (PR 3 adds
-- aggregateHistory + analyze route wiring).
--
-- Free-tier Coach behavior is unaffected: free path stays Redis-only.
-- PRO writes (PR 3+) target this table via the service role; clients never
-- read or write directly — the only public access path is the server-side
-- /api/coach/* endpoints.
--
-- Spec references:
--   §5    table shape, indexes, RLS
--   §15   red-team mitigations P1-1, P1-5, P1-6, P1-9
--   §13   PR 1 — "Zero behavior change at runtime"

create table public.coach_analyses (
  -- Identity. Composite PK + ON CONFLICT DO NOTHING (PR 2 writer) gives
  -- first-wins semantics across concurrent multi-device writes (P1-9).
  wallet         text         not null,           -- lowercase 0x address
  game_id        uuid         not null,
  primary key (wallet, game_id),

  -- Time. expires_at is set per-row at insert (NOT refreshed) — PR 3
  -- backfill explicitly sets it to source.createdAt + 1y to honor the
  -- privacy notice "365 days from creation" (P1-6).
  created_at     timestamptz  not null default now(),
  expires_at     timestamptz  not null default (now() + interval '1 year'),

  -- Response shape. v1 only inserts kind='full'. The 'quick' value is
  -- reserved for v2 BasicCoachResponse rows; it ships with the constraint
  -- so future migrations don't need to touch this column (P1-5).
  kind           text         not null default 'full' check (kind in ('full','quick')),

  -- Game context (denormalized so prompt building doesn't need a join).
  difficulty     text         not null check (difficulty in ('easy','medium','hard')),
  -- Result check is the schema-side enforcement of CoachGameResult.
  -- All persist sites must call toCoachGameResult() before INSERT so this
  -- check cannot drift from TS-side enums (spec §5 + §10).
  result         text         not null check (result    in ('win','lose','draw','resigned')),
  total_moves    int          not null,

  -- Coach response payload. NOT NULL only when kind='full' — v1 code only
  -- inserts kind='full', so the NOT NULL columns are always satisfied.
  summary_text   text         not null,
  mistakes       jsonb        not null default '[]',  -- Array<Mistake>
  lessons        jsonb        not null default '[]',  -- string[]
  praise         jsonb        not null default '[]',  -- string[]

  -- v1 canonical taxonomy: 6 deterministic labels (P1-1). An empty array
  -- is a valid value when no mistake explanation matched the keyword/
  -- positional rules — the row is still preserved (P1-7).
  weakness_tags  text[]       not null default '{}'
);

-- Hot-path lookup: aggregate the last N rows for a wallet.
create index coach_analyses_wallet_recent_idx
  on public.coach_analyses (wallet, created_at desc);

-- Cron purge walks this index in batches of 5_000 (PR 5 cron handler)
-- to avoid table-level locks on backlog catch-up.
create index coach_analyses_expires_idx
  on public.coach_analyses (expires_at);

-- Defense-in-depth: even if SUPABASE_SERVICE_ROLE_KEY leaked OR an anon
-- key were ever exposed client-side, RLS would block direct table access.
-- All legit access is via service-role server endpoints.
alter table public.coach_analyses enable row level security;

create policy "service_role full access"
  on public.coach_analyses for all
  to service_role using (true) with check (true);

-- No anon/authenticated policy exists by design: clients only access via
-- /api/coach/* endpoints. If a future surface needs direct read, add a
-- targeted policy then — don't widen this one.
