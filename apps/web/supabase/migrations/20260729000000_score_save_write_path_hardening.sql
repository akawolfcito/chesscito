-- Chesscito — Slice 0: close the score write path
--
-- Audit: docs/product/2026-07-27-score-and-leaders-audit.md (R1 critical,
--        R12 surface mixing, R13 aggregate overflow).
--
-- Ships four things, all additive or type-widening. NO data mutation, NO
-- DROP of a table, NO change to the leaderboard FORMULA (that is Slice 2+).
--
--   1. `score_saves.surface` — which deployment produced the row. Learn and
--      Play share ONE Supabase project (founder confirmed 2026-07-27), so
--      until now the two products' rows were indistinguishable.
--   2. `score_save_nonces` — one-shot replay guard. Persisted, not in-memory:
--      process memory resets on every redeploy, which is not protection.
--   3. `save_basic_score` gains `p_surface` so the value lands atomically with
--      the row it describes.
--   4. `total_score` widened int -> bigint across the leaderboard views and
--      RPCs. `score` is a Postgres `int` (max 2_147_483_647); six levels
--      summed can exceed it, and `SUM(...)::int` overflowing does not skew a
--      row, it makes the WHOLE view raise — a one-request outage of Leaders.
--
-- WHY `mode` COULD NOT BE REUSED AS THE SURFACE DIMENSION
-- ------------------------------------------------------
-- `mode` is `check (mode in ('free','peones'))` — it records how the save was
-- PAID FOR, not where it came from. Since 20260708120000_savescore_always_free
-- the RPC writes it hardcoded as 'free', but the column is NOT vestigial: local
-- data still carries legacy 'peones' rows from before that change. So it is a
-- live payment dimension with two real values, and overloading it would both
-- conflate payment with provenance AND break the day a paid tier returns.
-- A new column is the honest answer.

-- ─────────────────────────────────────────────────────────────────
-- 1. Surface dimension on score_saves
-- ─────────────────────────────────────────────────────────────────
-- NULLABLE ON PURPOSE, with no default. Rows written before this migration
-- came from an endpoint that did not record provenance, and we genuinely do
-- not know which deployment produced them. Defaulting them to 'learn' would
-- manufacture evidence. NULL reads as "pre-Slice-0, unknown" and any future
-- per-surface aggregate must decide explicitly what to do with it.

alter table public.score_saves
  add column if not exists surface text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'score_saves_surface_check'
  ) then
    alter table public.score_saves
      add constraint score_saves_surface_check
      check (surface is null or surface in ('learn', 'play'));
  end if;
end $$;

comment on column public.score_saves.surface is
  'Deployment that produced the row: learn | play. NULL = written before Slice 0 (2026-07-29), provenance genuinely unknown — never backfill it with a guess. Server-validated against the deployment mode; the client cannot pick it unilaterally.';

create index if not exists idx_score_saves_surface_created
  on public.score_saves (surface, created_at desc);

-- ─────────────────────────────────────────────────────────────────
-- 2. Replay guard — one-shot nonces
-- ─────────────────────────────────────────────────────────────────
-- The PRIMARY KEY *is* the protection: the endpoint inserts before it writes
-- the score, and a unique violation means "already used". No read-then-write
-- check, so two concurrent replays cannot both pass.
--
-- Keyed by (wallet, nonce) rather than nonce alone: two honest wallets picking
-- the same 128-bit value must not lock each other out, and an attacker replaying
-- a captured payload always replays the same wallet too.

create table if not exists public.score_save_nonces (
  wallet     text        not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  nonce      text        not null check (nonce ~ '^[0-9a-f]{32}$'),
  -- Mirrors the signed payload's expiry so a purge job can reclaim rows
  -- without having to re-parse anything.
  expires_at timestamptz not null,
  used_at    timestamptz not null default now(),

  primary key (wallet, nonce)
);

comment on table public.score_save_nonces is
  'Slice 0 replay guard for POST /api/scores/save. A row here means "this signed authorization was already spent". Insert-on-use; the PK conflict IS the rejection. Rows are safe to purge once expires_at has passed.';

create index if not exists idx_score_save_nonces_expires
  on public.score_save_nonces (expires_at);

alter table public.score_save_nonces enable row level security;

-- Service role only. A client that could read this table could enumerate
-- another wallet's activity; one that could delete from it could replay.
drop policy if exists "deny_all_direct_client_access" on public.score_save_nonces;
create policy "deny_all_direct_client_access"
  on public.score_save_nonces
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Reclaim helper. Deliberately NOT scheduled in this migration: adding a cron
-- job is a separate operational decision. Left callable so the follow-up is a
-- one-line schedule, not a new function.
create or replace function public.purge_expired_score_save_nonces()
returns integer
language plpgsql
volatile
as $$
declare
  v_deleted integer;
begin
  delete from public.score_save_nonces where expires_at < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

comment on function public.purge_expired_score_save_nonces() is
  'Deletes spent score-save nonces past their expiry. Not scheduled — call from a cron when nonce volume justifies it.';

-- ─────────────────────────────────────────────────────────────────
-- 3. save_basic_score gains p_surface
-- ─────────────────────────────────────────────────────────────────
-- DROP + CREATE, not CREATE OR REPLACE: adding a parameter produces an
-- OVERLOAD, and an 8-arg named call would then match both signatures
-- ambiguously and fail at runtime. Dropping the old one first keeps exactly
-- one resolvable function.
--
-- Body is otherwise IDENTICAL to 20260708120000_savescore_always_free: still
-- always-free, still advisory-locked per wallet, still dedup-by-save_id. The
-- only behavioural change is that `surface` is persisted with the insert, in
-- the same transaction, so a row can never exist without its provenance.

-- Both signatures are dropped: the 8-arg original, and the 9-arg one in case
-- this migration is re-applied. Leaving either behind makes an 8-arg named
-- call ambiguous (the 9th param has a default), which fails at CALL time —
-- the worst place to discover it.
drop function if exists public.save_basic_score(text, text, int, int, int, text, text, jsonb);
drop function if exists public.save_basic_score(text, text, int, int, int, text, text, jsonb, text);

create function public.save_basic_score(
  p_save_id          text,
  p_wallet           text,
  p_level_id         int,
  p_score            int,
  p_time_ms          int,
  p_game_id          text,
  p_attestation_hash text,
  p_metadata         jsonb default null,
  p_surface          text  default null
)
returns jsonb
language plpgsql
volatile
as $$
declare
  v_wallet     text;
  v_used       int;
  v_balance    bigint;
  v_dup_mode   text;
  v_dup_spent  int;
begin
  v_wallet := lower(p_wallet);

  if p_surface is not null and p_surface not in ('learn', 'play') then
    raise exception 'invalid surface: %', p_surface using errcode = '22023';
  end if;

  -- 0. Serialise every save for this wallet within the transaction.
  perform pg_advisory_xact_lock(hashtext(v_wallet));

  -- 1. Dedup. The UNIQUE on save_id is the hard guard.
  select mode, peones_spent into v_dup_mode, v_dup_spent
    from public.score_saves
   where save_id = p_save_id;

  if found then
    v_used := (select count(*) from public.score_saves where wallet = v_wallet);
    v_balance := coalesce(
      (select balance from public.peones_balances where wallet = v_wallet), 0);
    return jsonb_build_object(
      'status', 'duplicate',
      'mode', v_dup_mode,
      'freeUsed', v_used,
      'requiresPeones', false,
      'spent', v_dup_spent,
      'balance', v_balance,
      'scoreSaveId', p_save_id
    );
  end if;

  -- 2. ALWAYS-FREE path — no quota gate, no balance touched, no sink.
  insert into public.score_saves
    (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent, metadata, surface)
  values
    (p_save_id, v_wallet, p_level_id, p_score, p_time_ms, p_game_id, 'free', 0, p_metadata, p_surface);

  v_used := (select count(*) from public.score_saves where wallet = v_wallet);
  v_balance := coalesce(
    (select balance from public.peones_balances where wallet = v_wallet), 0);

  return jsonb_build_object(
    'status', 'saved',
    'mode', 'free',
    'freeUsed', v_used,
    'requiresPeones', false,
    'spent', 0,
    'balance', v_balance,
    'scoreSaveId', p_save_id
  );
end $$;

comment on function public.save_basic_score(text, text, int, int, int, text, text, jsonb, text) is
  'SaveScore basic atomic RPC. advisory-lock per wallet -> dedup -> ALWAYS-FREE insert (mode=free, peones_spent=0), now persisting `surface` in the same transaction (Slice 0, 2026-07-29). Never calls peones_spend. Works at 0 balance.';

-- ─────────────────────────────────────────────────────────────────
-- 4. Overflow: total_score int -> bigint (audit R13)
-- ─────────────────────────────────────────────────────────────────
-- `SUM(sub.best_score)::int` overflows once the summed bests pass 2^31-1.
-- The failure mode is not a wrong number, it is `integer out of range` raised
-- by the VIEW — which takes /api/leaderboard to a 500 for every player at
-- once. `rank` stays int: there will never be 2 billion ranked players.
--
-- Column order and names are unchanged, so `queries.ts` (which selects them
-- by name) needs no change. JSON serialises bigint as a plain number.
--
-- CREATE OR REPLACE VIEW cannot widen an existing column's type ("cannot
-- change data type of view column"), so the two views are DROPped first, in
-- dependency order: the functions read the views, and combined_v reads full_v.
-- Nothing here touches a TABLE, so no data is at risk.

drop function if exists public.get_leaderboard();
drop function if exists public.get_player_rank(text);
drop view if exists public.leaderboard_combined_v;
drop view if exists public.leaderboard_full_v;

create view public.leaderboard_full_v as
SELECT
  sub.player,
  SUM(sub.best_score)::bigint AS total_score,
  RANK() OVER (ORDER BY SUM(sub.best_score) DESC, sub.player ASC)::int AS rank,
  COALESCE(pc.is_verified, false) AS is_verified,
  BOOL_OR(sub.level_has_onchain) AS has_onchain
FROM (
  SELECT player, level_id, MAX(score) AS best_score,
         BOOL_OR(src_onchain) AS level_has_onchain
  FROM (
    SELECT player, level_id, score, true AS src_onchain
    FROM public.scores
    UNION ALL
    SELECT wallet AS player, level_id, score, false AS src_onchain
    FROM public.score_saves
  ) unified
  GROUP BY player, level_id
) sub
LEFT JOIN public.passport_cache pc ON pc.player = sub.player
GROUP BY sub.player, pc.is_verified;

comment on view public.leaderboard_full_v is
  'Unlimited combined ranking (scores + score_saves, best per player+level, summed). total_score is BIGINT since 2026-07-29 (Slice 0 / audit R13): the previous ::int cast made the whole view raise on overflow, taking Leaders down for everyone. has_onchain = player has at least one row in the on-chain scores table.';

create view public.leaderboard_combined_v as
SELECT player, total_score, rank, is_verified, has_onchain
FROM public.leaderboard_full_v
ORDER BY rank ASC, player ASC
LIMIT 10;

comment on view public.leaderboard_combined_v is
  'Top-10 cut of leaderboard_full_v. total_score BIGINT since 2026-07-29. Single source of truth for get_leaderboard() + the TS fallback.';

-- Both functions were dropped above (they depend on the views). Return type
-- also changes int -> bigint, so a REPLACE would be rejected regardless.
create function public.get_leaderboard()
returns table (
  player       text,
  total_score  bigint,
  rank         int,
  is_verified  boolean,
  has_onchain  boolean
)
language sql stable
as $$
  SELECT player, total_score, rank, is_verified, has_onchain
  FROM public.leaderboard_combined_v;
$$;

comment on function public.get_leaderboard() is
  '5-column shape; total_score widened to bigint 2026-07-29 (audit R13). Reads leaderboard_combined_v; shared source with the TS fallback in queries.ts.';

create function public.get_player_rank(p_player text)
returns table (
  player       text,
  total_score  bigint,
  rank         int,
  is_verified  boolean,
  has_onchain  boolean
)
language sql stable
as $$
  SELECT player, total_score, rank, is_verified, has_onchain
  FROM public.leaderboard_full_v
  WHERE player = lower(p_player);
$$;

comment on function public.get_player_rank(text) is
  'The player''s own combined-leaderboard row with its real rank over the FULL ranking, visible even outside the top-10 cut. total_score bigint since 2026-07-29.';
