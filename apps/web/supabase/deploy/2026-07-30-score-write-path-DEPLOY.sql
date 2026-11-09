-- ═══════════════════════════════════════════════════════════════════
-- Chesscito — deploy del write path de scores (Slice 0 + 0.1)
-- Commits: d7691e31 + ab1170af
--
-- CORRER ESTO **ANTES** DEL PUSH. El codigo nuevo llama funciones que
-- todavia no existen; el codigo viejo SI funciona contra este esquema
-- (verificado: una llamada de 8 args resuelve contra la de 9 y escribe
-- surface NULL), asi que la ventana entre SQL y deploy es segura.
--
-- Todo en UNA transaccion: si algo falla, no queda a medias.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- Si otra query tiene tomada una de las vistas, fallar rapido en vez de
-- colgar la app esperando el ACCESS EXCLUSIVE del drop view.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── Migracion 1/2 ─────────────────────────────────────────────────
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

-- ── Migracion 2/2 ─────────────────────────────────────────────────
-- Chesscito — Slice 0.1: score write sessions
--
-- Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
--
-- Slice 0 required an EIP-191 signature per save. That closed impersonation
-- but the off-chain save is a silent effect firing on every star improvement,
-- so it meant a wallet prompt after nearly every exercise. This migration
-- backs the replacement:
--
--     one signature -> one server-issued session -> N silent saves
--
-- Authorship is unchanged. What changes is granularity: the wallet proves
-- possession once, and the server hands back a bearer token scoped to that
-- wallet, that surface, a short window, and a bounded number of writes.
--
-- ONE TABLE, TWO LIFECYCLE STAGES
-- -------------------------------
-- A row is born as a pending CHALLENGE (token_hash IS NULL) and becomes an
-- active SESSION when the signature is verified (token_hash set). This is not
-- two concepts sharing a table for convenience: it is one object — same
-- session_id, same terms, same wallet — observed before and after the player
-- agrees to it. Splitting it would mean copying every term across on authorize
-- and inventing a rule for what happens if the copy half-fails.
--
-- The single-use property of the challenge is the conditional UPDATE in
-- `authorize_score_write_session` (WHERE token_hash IS NULL), not a delete.
--
-- SUPERSEDES `score_save_nonces` (20260729000000). That table existed only to
-- make a per-save signature single-use. There is no per-save signature any
-- more, nothing ever wrote to it outside local dev, and the code path is gone
-- in this same commit — so it is dropped rather than left as a table nobody
-- can explain in six months.

-- ─────────────────────────────────────────────────────────────────
-- 1. Sessions table
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.score_write_sessions (
  session_id           text        primary key check (session_id ~ '^[0-9a-f]{32}$'),

  wallet               text        not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  surface              text        not null check (surface in ('learn', 'play')),

  -- SHA-256 of the raw bearer token. The raw value is returned to the client
  -- exactly once and never stored: a dump of this table must not yield a
  -- usable credential. NULL while the row is still an unsigned challenge.
  token_hash           text        unique,

  issued_at            timestamptz not null,
  -- When the SESSION stops working. Signed by the player (it is in the
  -- message), so they know how long they are authorizing.
  expires_at           timestamptz not null,
  -- When the CHALLENGE goes stale. Deliberately NOT in the signed message:
  -- this is server policy about signature freshness, not a term the player
  -- agrees to.
  challenge_expires_at timestamptz not null,

  max_saves            int         not null check (max_saves > 0),
  used_saves           int         not null default 0 check (used_saves >= 0),

  authorized_at        timestamptz,
  revoked_at           timestamptz,
  created_at           timestamptz not null default now(),

  -- Belt AND braces. The atomic consume below already refuses to cross the
  -- limit; this makes it impossible to cross it by ANY path, including a
  -- future hand-written UPDATE in the SQL editor.
  constraint score_write_sessions_within_limit check (used_saves <= max_saves)
);

comment on table public.score_write_sessions is
  'Slice 0.1 (2026-07-30). Bounded write capability bought with one EIP-191 signature. A row starts as a pending challenge (token_hash NULL) and becomes an active session on authorize. Stores only the SHA-256 of the bearer token — never the token.';

-- The read path: every save looks a session up by token hash.
create index if not exists idx_score_write_sessions_token
  on public.score_write_sessions (token_hash)
  where token_hash is not null;

-- Reclaim + operational lookups.
create index if not exists idx_score_write_sessions_expires
  on public.score_write_sessions (expires_at);
create index if not exists idx_score_write_sessions_wallet
  on public.score_write_sessions (wallet, surface);

alter table public.score_write_sessions enable row level security;

-- Service role only. A client that could read this table could enumerate live
-- sessions; one that could UPDATE it could raise its own max_saves.
drop policy if exists "deny_all_direct_client_access" on public.score_write_sessions;
create policy "deny_all_direct_client_access"
  on public.score_write_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ─────────────────────────────────────────────────────────────────
-- 2. Authorize — consume the challenge exactly once
-- ─────────────────────────────────────────────────────────────────
-- The single-use guarantee is `WHERE token_hash IS NULL` inside the UPDATE.
-- Two concurrent authorizes of the same challenge: the first takes the row
-- lock and sets token_hash, the second re-evaluates the predicate after the
-- lock is released, matches nothing, and returns not_pending. No read-then-
-- write window exists.
--
-- The wallet and surface are checked against the STORED row, not taken from
-- the caller: a signature over a made-up message with a generous max_saves
-- cannot mint a session, because the terms that count are the ones the server
-- wrote at challenge time.

create or replace function public.authorize_score_write_session(
  p_session_id  text,
  p_wallet      text,
  p_surface     text,
  p_token_hash  text
)
returns jsonb
language plpgsql
volatile
as $$
declare
  v_row public.score_write_sessions%rowtype;
begin
  update public.score_write_sessions
     set token_hash    = p_token_hash,
         authorized_at = now()
   where session_id           = p_session_id
     and token_hash           is null
     and revoked_at           is null
     and wallet               = lower(p_wallet)
     and surface              = p_surface
     and challenge_expires_at > now()
  returning * into v_row;

  if found then
    return jsonb_build_object(
      'status',    'authorized',
      'sessionId', v_row.session_id,
      'expiresAt', to_char(v_row.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'maxSaves',  v_row.max_saves,
      'usedSaves', v_row.used_saves
    );
  end if;

  -- Classification is best-effort and deliberately AFTER the attempt: it only
  -- shapes the error message, so it must never gate the atomic path.
  select * into v_row from public.score_write_sessions where session_id = p_session_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_row.token_hash is not null then
    return jsonb_build_object('status', 'already_used');
  end if;
  if v_row.challenge_expires_at <= now() then
    return jsonb_build_object('status', 'challenge_expired');
  end if;
  -- Wallet or surface did not match the issued challenge.
  return jsonb_build_object('status', 'mismatch');
end $$;

comment on function public.authorize_score_write_session(text, text, text, text) is
  'Slice 0.1. Turns a pending challenge into an active session, exactly once. Single-use is the WHERE token_hash IS NULL predicate inside the UPDATE — never a read-then-write check.';

-- ─────────────────────────────────────────────────────────────────
-- 3. Consume — one save, atomically
-- ─────────────────────────────────────────────────────────────────
-- ONE statement. `used_saves < max_saves` is evaluated while the row lock is
-- held, so two concurrent saves at used_saves = max_saves - 1 cannot both pass:
-- the second re-reads the committed value after the first releases the lock and
-- fails the predicate. This is the whole concurrency argument.
--
-- Returns the wallet and surface FROM THE ROW. The caller never supplies a
-- wallet, so "a token writing to someone else's wallet" is not a case that can
-- be expressed, let alone validated.

create or replace function public.consume_score_write_session(
  p_token_hash text
)
returns jsonb
language plpgsql
volatile
as $$
declare
  v_row public.score_write_sessions%rowtype;
begin
  update public.score_write_sessions
     set used_saves = used_saves + 1
   where token_hash  = p_token_hash
     and revoked_at  is null
     and expires_at  > now()
     and used_saves  < max_saves
  returning * into v_row;

  if found then
    return jsonb_build_object(
      'status',    'consumed',
      'wallet',    v_row.wallet,
      'surface',   v_row.surface,
      'usedSaves', v_row.used_saves,
      'maxSaves',  v_row.max_saves
    );
  end if;

  select * into v_row
    from public.score_write_sessions
   where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_build_object('status', 'exhausted', 'maxSaves', v_row.max_saves);
end $$;

comment on function public.consume_score_write_session(text) is
  'Slice 0.1. Spends one save from an active session, atomically. The used_saves < max_saves predicate is evaluated under the row lock of a single UPDATE, so concurrent saves cannot both cross the limit. Returns the wallet from the ROW — the caller never supplies one.';

-- ─────────────────────────────────────────────────────────────────
-- 4. Revoke
-- ─────────────────────────────────────────────────────────────────
-- Idempotent: revoking twice is not an error. A revocation that fails because
-- someone already revoked would be a footgun in an incident.

create or replace function public.revoke_score_write_session(
  p_session_id text
)
returns boolean
language sql
volatile
as $$
  update public.score_write_sessions
     set revoked_at = coalesce(revoked_at, now())
   where session_id = p_session_id
  returning true;
$$;

comment on function public.revoke_score_write_session(text) is
  'Slice 0.1. Marks a session unusable. Idempotent. The capability a signature buys must be withdrawable — a signature never was.';

-- ─────────────────────────────────────────────────────────────────
-- 5. Reclaim helper
-- ─────────────────────────────────────────────────────────────────
-- Not scheduled here: adding a cron job is a separate operational decision.

create or replace function public.purge_expired_score_write_sessions()
returns integer
language plpgsql
volatile
as $$
declare
  v_deleted integer;
begin
  delete from public.score_write_sessions
   where expires_at < now() - interval '7 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

comment on function public.purge_expired_score_write_sessions() is
  'Deletes sessions a week past expiry. Keeps a short forensic tail rather than deleting on expiry, so "which session wrote this row" stays answerable during an incident. Not scheduled.';

-- ─────────────────────────────────────────────────────────────────
-- 6. Drop the superseded per-save nonce store
-- ─────────────────────────────────────────────────────────────────
-- 20260729000000 added this to make a per-save signature single-use. Slice 0.1
-- removes the per-save signature, so the table has no writer and no reader.
-- Dropping it in the same commit that removes its code is the honest move:
-- leaving it turns into an unexplainable table with an obsolete comment.
-- Nothing ever wrote to it in production — Slice 0 was never deployed.

drop function if exists public.purge_expired_score_save_nonces();
drop table if exists public.score_save_nonces;

-- ── PostgREST cachea las firmas de funcion ────────────────────────
-- Sin esto, supabase.rpc() puede seguir viendo la firma vieja y tirar
-- PGRST202 ("Could not find the function") hasta que el cache expire.
-- No esta en las migraciones porque es especifico del deploy hosted.
notify pgrst, 'reload schema';

commit;
