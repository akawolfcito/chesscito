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
