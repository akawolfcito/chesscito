-- Chesscito — Slice 3 etapa 4B: attempt identity
--
-- Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7).
--
-- WHAT THIS TABLE IS FOR, AND WHY score_saves COULD NOT ANSWER IT
-- ---------------------------------------------------------------
-- `score_saves` holds ONE row per (wallet, level, distinct score). Repeating
-- your best run writes nothing at all, so `created_at` there does NOT mean
-- "played" — it means "improved". Every question shaped like "how many times
-- did this wallet play the rook this week" is unanswerable from it, and any
-- time window built on it silently measures improvements.
--
-- `score_attempts` records the PLAY: one row per completed attempt, including
-- the ones that improve nothing. The two tables answer different questions and
-- neither replaces the other, which is why this is additive and `score_saves`
-- is untouched.
--
-- THE CLIENT NEVER SENDS STARS (D12)
-- ----------------------------------
-- It sends a raw measurement; the endpoint grades it with the grader the
-- catalogue bucket selects (`lib/scores/attempt-grading.ts`) and passes the
-- RESULT here. A stolen token can buy row count on its own wallet; it cannot
-- inflate `stars_earned`.
--
-- THE DAILY IS NOT IN THIS TABLE (D17)
-- ------------------------------------
-- `focus_day_ledger` owns the Daily. A wallet can have a Focus Day with ZERO
-- attempt rows, and attempt rows with no Focus Day. Do not join them and do
-- not derive one from the other.

-- ─────────────────────────────────────────────────────────────────
-- 1. The table
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.score_attempts (
  id            bigint generated always as identity primary key,
  attempt_id    text        not null,
  wallet        text        not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  surface       text        not null check (surface in ('learn','play')),
  level_id      int         not null check (level_id between 1 and 6),
  exercise_id   text        null check (exercise_id is null or length(exercise_id) between 1 and 64),

  measure_kind    text null check (measure_kind is null or measure_kind in ('moves','failures','coverage')),
  measure_value   int  null check (measure_value is null or measure_value >= 0),
  measure_ceiling int  null check (measure_ceiling is null or measure_ceiling > 0),

  grade_status  text        not null check (grade_status in ('graded','starless','ungraded')),
  -- 0 IS A REAL RESULT. `between 1 and 3` would abort the insert AND the whole
  -- transaction on an honest low run: labyrinthStars returns 0 above
  -- optimal + 4, tourStars returns 0 below the 80% pass line.
  stars_earned  int         null check (stars_earned is null or stars_earned between 0 and 3),

  score         int         not null check (score > 0),
  time_ms       int         not null check (time_ms > 0),
  save_status   text        not null check (save_status in ('saved','duplicate')),
  save_id       text        not null,
  attempt_index int         not null check (attempt_index > 0),
  attempt_id_source text    not null check (attempt_id_source in ('client','server')),
  created_at    timestamptz not null default now(),

  -- Keyed by wallet as well as attempt_id, for the same reason
  -- `score_save_nonces` was keyed `(wallet, nonce)`: two honest wallets that
  -- pick the same 128-bit value must not lock each other out, and it removes
  -- the cross-wallet replay oracle — a foreign attempt_id finds no row rather
  -- than someone else's.
  unique (wallet, attempt_id),
  -- The ordinal is per wallet, surface and level. Global would make two
  -- products' counts interleave and mean nothing.
  unique (wallet, surface, level_id, attempt_index),

  constraint score_attempts_grade_coherent check (
    (grade_status = 'graded' and stars_earned is not null) or
    (grade_status in ('starless','ungraded') and stars_earned is null)
  ),
  constraint score_attempts_measure_coherent check (
    (measure_kind is null and measure_value is null and measure_ceiling is null) or
    (measure_kind in ('moves','failures') and measure_value is not null and measure_ceiling is null) or
    (measure_kind = 'coverage' and measure_value is not null and measure_ceiling is not null)
  )
);

comment on table public.score_attempts is
  'Slice 3 (2026-07-31). One row per COMPLETED attempt, including attempts that improve nothing — which is exactly what score_saves cannot record, since it only writes on a new best. The Daily is NOT here: focus_day_ledger owns it (D17), a wallet can have a Focus Day with zero rows here and rows here with no Focus Day.';

comment on column public.score_attempts.measure_value is
  'The raw number the attempt reported, whose MEANING is measure_kind: moves for the four move-graded buckets, failures for promotion-run, reached (covered squares / placed queens) for the coverage buckets. Three quantities in one int column because they are never compared to each other — read measure_kind first, always.';

comment on column public.score_attempts.measure_ceiling is
  'Coverage only: the catalogue''s authoritative ceiling the run was graded against. NULL for moves and failures, which have no denominator.';

comment on column public.score_attempts.stars_earned is
  'Server-computed, never client-supplied (D12). NULL means no stars were awarded — Knight''s Tour is starless by product decision (D15), and a legacy bundle that sent no measurement is ungraded. 0 means a real run that earned zero.';

comment on column public.score_attempts.save_id is
  'Logical pointer to the score_saves row this attempt resolved against. Deliberately NOT a foreign key: a duplicate attempt points at a row written by an earlier attempt, and a FK would suggest an ownership that does not exist.';

comment on column public.score_attempts.attempt_id_source is
  'client = the bundle minted the attempt id; server = it sent none and the server minted one. Makes the deploy order safe: migration + endpoint can ship before the client that mints ids.';

create index if not exists score_attempts_created_idx
  on public.score_attempts (created_at desc);

create index if not exists score_attempts_ordinal_idx
  on public.score_attempts (wallet, surface, level_id, attempt_index desc);

alter table public.score_attempts enable row level security;

-- Service role only. A client that could read this table could enumerate any
-- wallet's play history; one that could insert could manufacture activity.
drop policy if exists "deny_all_direct_client_access" on public.score_attempts;
create policy "deny_all_direct_client_access"
  on public.score_attempts
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ─────────────────────────────────────────────────────────────────
-- 2. save_score_attempt — one transaction, consume included
-- ─────────────────────────────────────────────────────────────────
-- Everything the endpoint used to do in three round trips (consume, save,
-- record) happens here in one, because "rejected consumes nothing" is only
-- true if a later failure can undo the consume. It is a property of the
-- TRANSACTION, not a refund path — there is no refund path, and there must
-- never be one.
--
-- NO p_wallet PARAMETER. The wallet comes out of the session row, so "a token
-- writing to someone else's wallet" is not a case that can be expressed, let
-- alone forgotten. Same argument as `consume_score_write_session`.
--
-- The wallet is RETURNED on every failure so the endpoint keeps its logging
-- identity. It is returned raw, not hashed: `hashWallet` is salted with
-- LOG_SALT, which lives in the deployment env and not in the database, and a
-- second hashing implementation here would be a second thing to keep in sync.
--
-- LOCK ORDER IS AN INVARIANT
-- --------------------------
-- The wallet advisory lock is taken BEFORE any score_write_sessions UPDATE,
-- and `/api/scores/authorize` must never take the wallet lock at all. Two
-- paths that take the same two locks in opposite orders deadlock under
-- concurrency, and the failure shows up as timeouts under load — never in a
-- test that runs one statement at a time.
--
-- The nested advisory lock inside `save_basic_score` is safe and deliberate:
-- it is the same xact lock on the same wallet hash, and xact locks are
-- re-entrant within one transaction.

create or replace function public.save_score_attempt(
  p_token_hash text,
  p_attempt_id text,
  p_attempt_id_source text,
  p_level_id int,
  p_score int,
  p_time_ms int,
  p_exercise_id text,
  p_measure_kind text,
  p_measure_value int,
  p_measure_ceiling int,
  p_grade_status text,
  p_stars_earned int,
  p_deployment_surface text
)
returns jsonb
language plpgsql
volatile
as $$
declare
  v_session  public.score_write_sessions%rowtype;
  v_existing public.score_attempts%rowtype;
  v_wallet   text;
  v_consume  jsonb;
  v_save     jsonb;
  v_save_id  text;
  v_game_id  text;
  v_index    int;
  v_used     int;
  v_balance  bigint;
begin
  -- 1. Resolve the session. Read-only: this classifies the states that are
  --    facts about the row (missing, revoked, expired). It deliberately does
  --    NOT decide `exhausted` — that is a race, and only the atomic UPDATE in
  --    consume_score_write_session may settle it.
  select * into v_session
    from public.score_write_sessions
   where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('status', 'session_error', 'sessionStatus', 'not_found');
  end if;

  v_wallet := v_session.wallet;

  if v_session.revoked_at is not null then
    return jsonb_build_object(
      'status', 'session_error', 'sessionStatus', 'revoked', 'wallet', v_wallet);
  end if;
  if v_session.expires_at <= now() then
    return jsonb_build_object(
      'status', 'session_error', 'sessionStatus', 'expired', 'wallet', v_wallet);
  end if;

  -- 2. Serialise every write for this wallet. BEFORE the session UPDATE below.
  perform pg_advisory_xact_lock(hashtext(v_wallet));

  -- 3. A session minted on the other product must not write here.
  if v_session.surface is distinct from p_deployment_surface then
    return jsonb_build_object(
      'status', 'invalid', 'reason', 'surface_mismatch', 'wallet', v_wallet);
  end if;

  -- 4. Replay. Before the consume, so a retry of a failed POST costs nothing:
  --    the attempt already exists, and answering it again must not spend a
  --    second unit of a budget the player already paid for it.
  select * into v_existing
    from public.score_attempts
   where wallet = v_wallet
     and attempt_id = p_attempt_id;

  if found then
    v_used := (select count(*) from public.score_saves where wallet = v_wallet);
    v_balance := coalesce(
      (select balance from public.peones_balances where wallet = v_wallet), 0);
    -- Stored values, not recomputed ones: a replay must be stable in status,
    -- attemptIndex, scoreSaveId, starsEarned and gradeStatus. freeUsed and
    -- balance are read fresh on purpose — they are not attempt facts.
    return jsonb_build_object(
      'status',         v_existing.save_status,
      'mode',           'free',
      'freeUsed',       v_used,
      'requiresPeones', false,
      'spent',          0,
      'balance',        v_balance,
      'scoreSaveId',    v_existing.save_id,
      'wallet',         v_wallet,
      'attempt', jsonb_build_object(
        'attemptId',    v_existing.attempt_id,
        'attemptIndex', v_existing.attempt_index,
        'replayed',     true,
        'starsEarned',  v_existing.stars_earned,
        'gradeStatus',  v_existing.grade_status
      )
    );
  end if;

  -- 5. Spend one unit. Anything that fails after this line rolls the spend
  --    back with it, which is what makes "rejected consumes nothing" true.
  v_consume := public.consume_score_write_session(p_token_hash);
  if v_consume->>'status' <> 'consumed' then
    return jsonb_build_object(
      'status',        'session_error',
      'sessionStatus', v_consume->>'status',
      'wallet',        v_wallet
    );
  end if;

  -- 6. The score save itself. CALLED, never copied: score_saves has one
  --    writer, and a second copy of that body would drift from it at the
  --    first change to either.
  --
  --    `save_id` keeps its original meaning — best-score-per-level identity —
  --    and its original derivation, mirroring `deriveScoreSaveId` in
  --    lib/scores/save-service.ts. A divergence here would split one level's
  --    dedup key in two and quietly break the duplicate answer.
  v_game_id := p_score::text;
  v_save_id := lower(v_wallet || ':' || p_level_id::text || ':' || v_game_id);

  v_save := public.save_basic_score(
    v_save_id,
    v_wallet,
    p_level_id,
    p_score,
    p_time_ms,
    v_game_id,
    null,
    null,
    -- The SESSION's surface, not the caller's. They were just checked equal;
    -- passing the session's keeps the row's provenance sourced from the row.
    v_session.surface
  );

  -- 7. The ordinal, inside the lock. Two concurrent attempts on the same
  --    (wallet, surface, level) cannot read the same max: the second waits on
  --    the advisory lock. The UNIQUE is the backstop if they ever could.
  select coalesce(max(attempt_index), 0) + 1 into v_index
    from public.score_attempts
   where wallet = v_wallet
     and surface = v_session.surface
     and level_id = p_level_id;

  insert into public.score_attempts (
    attempt_id, wallet, surface, level_id, exercise_id,
    measure_kind, measure_value, measure_ceiling,
    grade_status, stars_earned,
    score, time_ms, save_status, save_id, attempt_index, attempt_id_source
  ) values (
    p_attempt_id, v_wallet, v_session.surface, p_level_id, p_exercise_id,
    p_measure_kind, p_measure_value, p_measure_ceiling,
    p_grade_status, p_stars_earned,
    p_score, p_time_ms, v_save->>'status', v_save_id, v_index, p_attempt_id_source
  );

  -- 8. The union of the save result and the attempt outcome. A client that
  --    ignores `attempt` sees exactly what it saw before.
  return v_save || jsonb_build_object(
    'wallet', v_wallet,
    'attempt', jsonb_build_object(
      'attemptId',    p_attempt_id,
      'attemptIndex', v_index,
      'replayed',     false,
      'starsEarned',  p_stars_earned,
      'gradeStatus',  p_grade_status
    )
  );
end $$;

comment on function public.save_score_attempt(text, text, text, int, int, int, text, text, int, int, text, int, text) is
  'Slice 3 (2026-07-31). One transaction: resolve session -> lock wallet -> surface check -> replay -> consume -> save_basic_score -> insert attempt. A replay consumes ZERO and returns the stored row. Any failure after the consume rolls it back, so "rejected consumes nothing" is a property of the transaction and not a refund. Takes no wallet parameter: the wallet comes from the session row.';

-- ─────────────────────────────────────────────────────────────────
-- 3. Privileges
-- ─────────────────────────────────────────────────────────────────
-- Postgres grants EXECUTE on a new function to PUBLIC by default, so revoking
-- from anon/authenticated alone changes NOTHING — they would still hold it
-- through PUBLIC. Revoke from PUBLIC first, then grant to the one role that
-- should have it.
--
-- `save_basic_score` is included because it is now reachable two ways, and a
-- caller who could invoke it directly would write a score row with no attempt
-- row and no budget spent.

revoke execute on function public.save_score_attempt(text, text, text, int, int, int, text, text, int, int, text, int, text) from public;
revoke execute on function public.save_basic_score(text, text, int, int, int, text, text, jsonb, text) from public;

grant execute on function public.save_score_attempt(text, text, text, int, int, int, text, text, int, int, text, int, text) to service_role;
grant execute on function public.save_basic_score(text, text, int, int, int, text, text, jsonb, text) to service_role;
