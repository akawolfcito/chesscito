-- Chesscito — SaveScore off-chain (basic) + atomic save RPC
--
-- Slice 1 of the SaveScore off-chain/Peones cluster (spec:
-- docs/specs/savescore-offchain-peones.md, P0-closed revision;
-- red-team round 2 verdict READY for /tdd).
--
-- Ships:
--   1. `score_saves` — the off-chain basic-save table. SEPARATE from
--      the legacy `scores` table (on-chain proof path), so the base
--      gameplay flow never touches tx_hash / EIP-712 / on-chain writes.
--      Dedup anchor is `save_id` UNIQUE (NOT tx_hash).
--   2. `save_basic_score` RPC — the atomic core. One Postgres
--      transaction decides free vs paid and (for paid) REUSES the
--      existing `peones_spend` RPC instead of inserting raw into
--      `peones_ledger`. Inherits balance guard (FOR UPDATE),
--      idempotency, and the never-negative-balance invariant.
--
-- DESIGN PRINCIPLES (spec §Behavior, P1 ledger-rpc-coupling +
-- balance-read-in-tx closed):
--
--   FREE_SCORE_SAVE_LIMIT  = 5   (free basic saves per wallet, lifetime)
--   SCORE_SAVE_COST_PEONES = 1   (cost beyond the free quota)
--   Both hard-coded here like the Sprint 3 cap=10 — change via migration.
--
--   Order inside save_basic_score (founder sign-off 2026-06-09):
--     0. pg_advisory_xact_lock(hashtext(lower(wallet))) — serialise ALL
--        saves for a wallet within the txn. Without it two concurrent
--        saves at freeUsed=4 could both read 4 and both insert as free.
--     1. Dedup: if save_id exists → return duplicate (no row, no debit).
--     2. freeUsed = count(score_saves WHERE wallet) — per wallet.
--     3. freeUsed < 5  → insert mode='free' (peones_spent=0) → saved/free.
--     4. freeUsed >= 5 → call peones_spend('save_game', 1,
--        idem='spend:save_game:'||save_id) in the SAME txn:
--          - on success → insert mode='peones' (peones_spent=1) → saved/peones.
--          - on P0001 insufficient_balance → catch, insert nothing → insufficient_peones.
--
--   The whole thing is ONE transaction: the score_saves insert and the
--   peones_spend ledger debit either both commit or both roll back. No
--   "charge without save" / "save without charge" window.
--
-- ISOLATION (spec §Non-goals): this migration NEVER references the
-- legacy scores table nor the leaderboard view, never ALTERs them.

-- ─────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────

create table public.score_saves (
  id           bigint generated always as identity primary key,

  -- Deterministic dedup + idempotency anchor. Built from
  -- `${player}:${levelId}:${gameId}` lowercased (server re-derives and
  -- validates). UNIQUE is the sole anti-double-row guard. NO tx_hash.
  save_id      text        not null unique,

  -- Lowercase 0x-prefixed 40-hex. Mixed case is a write-time bug; the
  -- RPC lower()s before insert. Regex check mirrors peones_ledger.
  wallet       text        not null check (wallet ~ '^0x[0-9a-f]{40}$'),

  level_id     int         not null check (level_id between 1 and 6),
  score        int         not null check (score > 0),
  time_ms      int         not null check (time_ms > 0),
  game_id      text        not null,

  -- 'free' inside the quota, 'peones' once a Peón was spent for it.
  mode         text        not null check (mode in ('free','peones')),

  -- 0 for free saves, 1 for paid saves. Mirrors SCORE_SAVE_COST_PEONES.
  peones_spent int         not null default 0 check (peones_spent in (0,1)),

  metadata     jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.score_saves is
  'SaveScore off-chain basic flow. Separate from legacy `scores` (on-chain proof path). Dedup by save_id UNIQUE (no tx_hash). is_verified is constant FALSE in the combined leaderboard view (Slice 4).';
comment on column public.score_saves.save_id is
  'Deterministic `${player}:${levelId}:${gameId}` lowercased. Sole anti-double-row guard + Peones spend idempotency seed (spend:save_game:{save_id}).';

-- Per-wallet quota count + leaderboard aggregation.
create index score_saves_wallet_idx on public.score_saves (wallet);

-- HUD / history recent-first polling.
create index score_saves_wallet_created_idx
  on public.score_saves (wallet, created_at desc);

-- ─────────────────────────────────────────────────────────────────
-- 2. RLS — server-only writes (mirrors peones_ledger)
-- ─────────────────────────────────────────────────────────────────

alter table public.score_saves enable row level security;

create policy score_saves_no_client_writes
  on public.score_saves for insert to authenticated, anon with check (false);

create policy score_saves_no_client_updates
  on public.score_saves for update to authenticated, anon using (false) with check (false);

create policy score_saves_no_client_deletes
  on public.score_saves for delete to authenticated, anon using (false);

create policy score_saves_own_reads
  on public.score_saves for select to authenticated, anon
  using (
    wallet = lower(coalesce(
      current_setting('request.jwt.claims', true)::json->>'wallet', ''
    ))
  );

-- ─────────────────────────────────────────────────────────────────
-- 3. save_basic_score — atomic free/paid save RPC
-- ─────────────────────────────────────────────────────────────────
--
-- Returns a single jsonb object:
--   { status, mode, freeUsed, freeLimit, freeRemaining,
--     requiresPeones, spent, balance, scoreSaveId, required? }
--
-- status ∈ { 'saved', 'duplicate', 'insufficient_peones' }.
-- The endpoint (Slice 3) adds transport-level validation (isAddress,
-- saveId re-derivation, soft rate-limit) + builds p_attestation_hash
-- with the existing TS helper, exactly as POST /api/peones/spend does.

create function public.save_basic_score(
  p_save_id          text,
  p_wallet           text,
  p_level_id         int,
  p_score            int,
  p_time_ms          int,
  p_game_id          text,
  p_attestation_hash text,
  p_metadata         jsonb default null
)
returns jsonb
language plpgsql
volatile
as $$
declare
  -- Calibration constants. Same magic-number-in-migration pattern as
  -- the Sprint 3 daily cap (10). Change via migration only.
  c_free_limit constant int := 5;   -- FREE_SCORE_SAVE_LIMIT
  c_cost       constant int := 1;   -- SCORE_SAVE_COST_PEONES

  v_wallet     text;
  v_used       int;
  v_remaining  int;
  v_requires   boolean;
  v_balance    bigint;
  v_idem       text;
  v_new_bal    bigint;
  v_dup_mode   text;
  v_dup_spent  int;
begin
  v_wallet := lower(p_wallet);

  -- 0. Serialise every save for this wallet within the transaction.
  --    Removes the free-quota race AND any double-count entirely.
  perform pg_advisory_xact_lock(hashtext(lower(p_wallet)));

  -- 1. Dedup. The UNIQUE on save_id is the hard guard; this is the
  --    fast idempotent return so a replay never inserts / never debits.
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
      'freeLimit', c_free_limit,
      'freeRemaining', greatest(0, c_free_limit - v_used),
      'requiresPeones', v_used >= c_free_limit,
      'spent', v_dup_spent,
      'balance', v_balance,
      'scoreSaveId', p_save_id
    );
  end if;

  -- 2. Per-wallet quota count.
  v_used := (select count(*) from public.score_saves where wallet = v_wallet);
  v_requires := v_used >= c_free_limit;

  if not v_requires then
    -- 3. FREE path — no balance touched.
    insert into public.score_saves
      (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent, metadata)
    values
      (p_save_id, v_wallet, p_level_id, p_score, p_time_ms, p_game_id, 'free', 0, p_metadata);

    v_used := v_used + 1;
    v_balance := coalesce(
      (select balance from public.peones_balances where wallet = v_wallet), 0);
    return jsonb_build_object(
      'status', 'saved',
      'mode', 'free',
      'freeUsed', v_used,
      'freeLimit', c_free_limit,
      'freeRemaining', greatest(0, c_free_limit - v_used),
      'requiresPeones', v_used >= c_free_limit,
      'spent', 0,
      'balance', v_balance,
      'scoreSaveId', p_save_id
    );
  end if;

  -- 4. PAID path — reuse peones_spend (never raw ledger insert). The
  --    spend runs in THIS transaction; its FOR UPDATE lock + balance
  --    guard make the check atomic. On P0001 we roll the spend's
  --    subtransaction back and insert NOTHING.
  v_idem := 'spend:save_game:' || p_save_id;

  begin
    select new_balance
      into v_new_bal
      from public.peones_spend(
        v_wallet, c_cost, 'save_game', p_save_id, v_idem, p_attestation_hash, p_metadata, false
      );
  exception
    when sqlstate 'P0001' then
      -- insufficient_balance — no score_saves row, no extra debit.
      v_balance := coalesce(
        (select balance from public.peones_balances where wallet = v_wallet), 0);
      return jsonb_build_object(
        'status', 'insufficient_peones',
        'mode', null,
        'freeUsed', v_used,
        'freeLimit', c_free_limit,
        'freeRemaining', 0,
        'requiresPeones', true,
        'spent', 0,
        'balance', v_balance,
        'required', c_cost,
        'scoreSaveId', p_save_id
      );
  end;

  -- Spend succeeded → persist the paid save in the same transaction.
  insert into public.score_saves
    (save_id, wallet, level_id, score, time_ms, game_id, mode, peones_spent, metadata)
  values
    (p_save_id, v_wallet, p_level_id, p_score, p_time_ms, p_game_id, 'peones', c_cost, p_metadata);

  v_used := v_used + 1;
  return jsonb_build_object(
    'status', 'saved',
    'mode', 'peones',
    'freeUsed', v_used,
    'freeLimit', c_free_limit,
    'freeRemaining', 0,
    'requiresPeones', true,
    'spent', c_cost,
    'balance', v_new_bal,
    'scoreSaveId', p_save_id
  );
end;
$$;

comment on function public.save_basic_score(text, text, int, int, int, text, text, jsonb) is
  'SaveScore basic atomic RPC. advisory-lock per wallet → dedup → quota count → free (<5) or peones_spend reuse (>=5). One transaction; P0001 insufficient rolls the spend back and inserts no row. FREE_SCORE_SAVE_LIMIT=5, SCORE_SAVE_COST_PEONES=1 — change via migration.';

-- ─────────────────────────────────────────────────────────────────
-- 4. Migration footer
-- ─────────────────────────────────────────────────────────────────
--
-- Slice 2 adds the pure `lib/scores/save-service.ts` (computeScoreSaveQuota,
-- deriveScoreSaveId + lockstep test vs SPEND_COST_BY_TARGET.save_game).
-- Slice 3 adds POST /api/scores/save (validation + soft rate-limit +
-- attestation build). Slice 4 adds the combined leaderboard view. Slice 5
-- rewires the SaveScore client off the on-chain path. NO endpoint / NO UI
-- ships in this slice.
