-- Slice 3 etapa 4B — `save_score_attempt` behavioural smoke.
--
-- Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7).
--
-- The vitest guard (src/lib/scores/__tests__/score-attempts-schema.test.ts)
-- reads this migration as TEXT and can only prove the properties are still
-- written down. THIS file proves the ones only a running Postgres can answer:
-- that the transaction actually rolls back, that a replay actually spends
-- nothing, and that anon actually cannot execute the function.
--
-- Run:
--   supabase start                 # from apps/web (Docker)
--   supabase db reset              # applies all migrations incl. this slice
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
--        -f supabase/tests/score_attempts_smoke.sql
--
-- The whole script runs in ONE transaction and ROLLBACKs at the end, so it is
-- repeatable and never persists smoke rows. A failed assertion RAISEs and
-- aborts; success prints 'SCORE_ATTEMPTS SMOKE — ALL PASSED'.
--
-- NOT COVERED HERE: true concurrency. Two sessions racing the same attempt_id
-- cannot be expressed in one psql connection — that is
-- `score_attempts_same_attempt_concurrency.sql`, a pgbench fixture. What this
-- file proves is the constraint that makes the race safe.

begin;

do $$
declare
  w_a      text := '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  w_b      text := '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  tok_a    text := repeat('a', 64);
  tok_b    text := repeat('b', 64);
  att_1    text := repeat('1', 32);
  att_2    text := repeat('2', 32);
  r        jsonb;
  r2       jsonb;
  v_used   int;
  v_before int;
  v_saves  int;
  v_rows   int;
begin
  -- ── Fixture: one live session per wallet ───────────────────────────
  insert into public.score_write_sessions
    (session_id, wallet, surface, token_hash, issued_at, expires_at,
     challenge_expires_at, max_saves, used_saves, authorized_at)
  values
    (repeat('a', 32), w_a, 'learn', tok_a, now(), now() + interval '2 hours',
     now() + interval '5 minutes', 100, 0, now()),
    (repeat('b', 32), w_b, 'learn', tok_b, now(), now() + interval '2 hours',
     now() + interval '5 minutes', 100, 0, now());

  -- ── Case 1: a new attempt writes one of everything ─────────────────
  r := public.save_score_attempt(
    tok_a, att_1, 'client', 1, 120, 30000, 'rook-distance-1',
    'moves', 4, null, 'graded', 3, 'learn');

  if r->>'status' <> 'saved' then
    raise exception 'case 1: expected saved, got %', r->>'status';
  end if;
  if (r->'attempt'->>'replayed')::boolean then
    raise exception 'case 1: a first attempt must not be a replay';
  end if;
  if (r->'attempt'->>'attemptIndex')::int <> 1 then
    raise exception 'case 1: expected attemptIndex 1, got %',
      r->'attempt'->>'attemptIndex';
  end if;
  if (r->'attempt'->>'starsEarned')::int <> 3 then
    raise exception 'case 1: stars must be the ones the server graded';
  end if;

  select count(*) into v_rows from public.score_attempts where wallet = w_a;
  if v_rows <> 1 then raise exception 'case 1: expected 1 attempt row, got %', v_rows; end if;

  select count(*) into v_saves from public.score_saves where wallet = w_a;
  if v_saves <> 1 then raise exception 'case 1: expected 1 score_saves row, got %', v_saves; end if;

  select used_saves into v_used from public.score_write_sessions where token_hash = tok_a;
  if v_used <> 1 then raise exception 'case 1: expected 1 unit spent, got %', v_used; end if;

  -- ── Case 2: replay — same attempt_id, consumes ZERO ────────────────
  -- This is what makes a retry of a failed POST safe: it can never become a
  -- second attempt, and it can never spend a second unit.
  r2 := public.save_score_attempt(
    tok_a, att_1, 'client', 1, 120, 30000, 'rook-distance-1',
    'moves', 4, null, 'graded', 3, 'learn');

  if not (r2->'attempt'->>'replayed')::boolean then
    raise exception 'case 2: expected replayed true';
  end if;
  if r2->'attempt'->>'attemptIndex' <> r->'attempt'->>'attemptIndex' then
    raise exception 'case 2: attemptIndex must be stable across a replay';
  end if;
  if r2->>'scoreSaveId' <> r->>'scoreSaveId' then
    raise exception 'case 2: scoreSaveId must be stable across a replay';
  end if;

  select used_saves into v_used from public.score_write_sessions where token_hash = tok_a;
  if v_used <> 1 then
    raise exception 'case 2: a replay must consume 0, used_saves is %', v_used;
  end if;

  select count(*) into v_rows from public.score_attempts where wallet = w_a;
  if v_rows <> 1 then raise exception 'case 2: a replay must not insert, got % rows', v_rows; end if;

  -- ── Case 3: a foreign wallet's attempt_id is NOT a replay ──────────
  -- Looked up by (wallet, attempt_id) it finds nothing, so wallet B never
  -- learns anything about wallet A's row — and gets its own attempt.
  r := public.save_score_attempt(
    tok_b, att_1, 'client', 1, 120, 30000, 'rook-distance-1',
    'moves', 4, null, 'graded', 3, 'learn');

  if (r->'attempt'->>'replayed')::boolean then
    raise exception 'case 3: another wallet''s attempt_id must not read as a replay';
  end if;
  if (r->'attempt'->>'attemptIndex')::int <> 1 then
    raise exception 'case 3: wallet B''s ordinal is its own, expected 1';
  end if;

  -- ── Case 4: a duplicate score still records the attempt ────────────
  -- Carril 2 completions leave the cumulative score unchanged, so save_id
  -- re-derives identically and score_saves answers `duplicate`. That is the
  -- normal case for a whole lane of the game, not an error: zero new
  -- score_saves rows, one new score_attempts row.
  select count(*) into v_saves from public.score_saves where wallet = w_a;

  r := public.save_score_attempt(
    tok_a, att_2, 'client', 1, 120, 31000, 'rook-distance-1',
    'moves', 6, null, 'graded', 1, 'learn');

  if r->>'status' <> 'duplicate' then
    raise exception 'case 4: expected duplicate, got %', r->>'status';
  end if;
  if (r->'attempt'->>'attemptIndex')::int <> 2 then
    raise exception 'case 4: expected attemptIndex 2, got %',
      r->'attempt'->>'attemptIndex';
  end if;

  select count(*) into v_rows from public.score_attempts where wallet = w_a;
  if v_rows <> 2 then raise exception 'case 4: expected 2 attempt rows, got %', v_rows; end if;

  if (select count(*) from public.score_saves where wallet = w_a) <> v_saves then
    raise exception 'case 4: a duplicate must not add a score_saves row';
  end if;

  -- ── Case 5: a failure AFTER the consume rolls the consume back ─────
  -- The grade-coherence CHECK is the trigger: `graded` with a NULL
  -- stars_earned cannot be inserted. The insert is step 7, well past the
  -- consume at step 5. If the spend survived the abort, "rejected consumes
  -- nothing" would be false and a refund path would have to exist.
  select used_saves into v_before from public.score_write_sessions where token_hash = tok_a;
  select count(*) into v_saves from public.score_saves where wallet = w_a;
  select count(*) into v_rows  from public.score_attempts where wallet = w_a;

  begin
    perform public.save_score_attempt(
      tok_a, repeat('3', 32), 'client', 2, 999, 30000, 'bishop-x',
      'moves', 4, null, 'graded', null, 'learn');
    raise exception 'case 5: the incoherent grade should have raised';
  exception
    when check_violation then
      null;  -- expected: the subtransaction rolls back everything above
  end;

  select used_saves into v_used from public.score_write_sessions where token_hash = tok_a;
  if v_used <> v_before then
    raise exception 'case 5: the consume survived the abort (% -> %)', v_before, v_used;
  end if;
  if (select count(*) from public.score_saves where wallet = w_a) <> v_saves then
    raise exception 'case 5: a score_saves row survived the abort';
  end if;
  if (select count(*) from public.score_attempts where wallet = w_a) <> v_rows then
    raise exception 'case 5: an attempt row survived the abort';
  end if;

  -- ── Case 6: (wallet, attempt_id) is unique ─────────────────────────
  -- The constraint the concurrency fixture relies on: two racing inserts of
  -- one attempt_id cannot both land, whatever the replay lookup saw.
  begin
    insert into public.score_attempts (
      attempt_id, wallet, surface, level_id, exercise_id,
      measure_kind, measure_value, measure_ceiling,
      grade_status, stars_earned, score, time_ms,
      save_status, save_id, attempt_index, attempt_id_source)
    values (
      att_1, w_a, 'learn', 1, 'rook-distance-1',
      'moves', 4, null, 'graded', 3, 120, 30000,
      'saved', 'x', 99, 'client');
    raise exception 'case 6: a duplicate (wallet, attempt_id) should have raised';
  exception
    when unique_violation then
      null;  -- expected
  end;

  -- ── Case 7: an unknown token writes nothing ────────────────────────
  select count(*) into v_rows from public.score_attempts;
  r := public.save_score_attempt(
    repeat('f', 64), repeat('4', 32), 'client', 1, 120, 30000, 'rook-distance-1',
    'moves', 4, null, 'graded', 3, 'learn');

  if r->>'status' <> 'session_error' or r->>'sessionStatus' <> 'not_found' then
    raise exception 'case 7: expected session_error/not_found, got %', r::text;
  end if;
  if (select count(*) from public.score_attempts) <> v_rows then
    raise exception 'case 7: an unknown token wrote a row';
  end if;

  -- ── Case 8: a surface mismatch writes nothing and spends nothing ───
  select used_saves into v_before from public.score_write_sessions where token_hash = tok_a;
  r := public.save_score_attempt(
    tok_a, repeat('5', 32), 'client', 1, 120, 30000, 'rook-distance-1',
    'moves', 4, null, 'graded', 3, 'play');

  if r->>'reason' <> 'surface_mismatch' then
    raise exception 'case 8: expected surface_mismatch, got %', r::text;
  end if;
  select used_saves into v_used from public.score_write_sessions where token_hash = tok_a;
  if v_used <> v_before then
    raise exception 'case 8: a surface mismatch spent a unit';
  end if;

  -- ── Case 9: an exhausted session spends nothing and writes nothing ─
  update public.score_write_sessions
     set used_saves = max_saves
   where token_hash = tok_b;

  select count(*) into v_rows from public.score_attempts where wallet = w_b;
  r := public.save_score_attempt(
    tok_b, repeat('6', 32), 'client', 1, 130, 30000, 'rook-distance-1',
    'moves', 4, null, 'graded', 3, 'learn');

  if r->>'sessionStatus' <> 'exhausted' then
    raise exception 'case 9: expected exhausted, got %', r::text;
  end if;
  if (select count(*) from public.score_attempts where wallet = w_b) <> v_rows then
    raise exception 'case 9: an exhausted session wrote a row';
  end if;

  -- ── Case 10: ungraded and starless use NULL, never a sentinel ──────
  r := public.save_score_attempt(
    tok_a, repeat('7', 32), 'server', 1, 140, 30000, null,
    null, null, null, 'ungraded', null, 'learn');
  if r->'attempt'->>'starsEarned' is not null then
    raise exception 'case 10: ungraded must report NULL stars, got %',
      r->'attempt'->>'starsEarned';
  end if;

  r := public.save_score_attempt(
    tok_a, repeat('8', 32), 'client', 3, 150, 30000, 'knight-tour-1',
    'coverage', 40, 63, 'starless', null, 'learn');
  if r->'attempt'->>'gradeStatus' <> 'starless' then
    raise exception 'case 10: expected starless, got %', r->'attempt'->>'gradeStatus';
  end if;
  if r->'attempt'->>'starsEarned' is not null then
    raise exception 'case 10: starless must report NULL stars';
  end if;

  -- ── Case 11: a graded ZERO is insertable ───────────────────────────
  -- The reason the check is `between 0 and 3`. A labyrinth over optimal + 4
  -- earns 0 honestly, and a `between 1 and 3` would abort the whole
  -- transaction on that run.
  r := public.save_score_attempt(
    tok_a, repeat('9', 32), 'client', 1, 160, 30000, 'rook-lab-1',
    'moves', 40, null, 'graded', 0, 'learn');
  if (r->'attempt'->>'starsEarned')::int <> 0 then
    raise exception 'case 11: a zero-star run must persist as 0';
  end if;

  raise notice 'SCORE_ATTEMPTS SMOKE — ALL PASSED';
end $$;

-- ── Case 12: privileges ──────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default, so this is the assertion that
-- the revoke actually happened. Run outside the DO block so the failure names
-- the role.
do $$
begin
  if has_function_privilege('anon', 'public.save_score_attempt(text, text, text, int, int, int, text, text, int, int, text, int, text)', 'execute') then
    raise exception 'privileges: anon can execute save_score_attempt';
  end if;
  if has_function_privilege('authenticated', 'public.save_score_attempt(text, text, text, int, int, int, text, text, int, int, text, int, text)', 'execute') then
    raise exception 'privileges: authenticated can execute save_score_attempt';
  end if;
  if has_function_privilege('anon', 'public.save_basic_score(text, text, int, int, int, text, text, jsonb, text)', 'execute') then
    raise exception 'privileges: anon can execute save_basic_score';
  end if;
  if has_function_privilege('authenticated', 'public.save_basic_score(text, text, int, int, int, text, text, jsonb, text)', 'execute') then
    raise exception 'privileges: authenticated can execute save_basic_score';
  end if;
  if not has_function_privilege('service_role', 'public.save_score_attempt(text, text, text, int, int, int, text, text, int, int, text, int, text)', 'execute') then
    raise exception 'privileges: service_role cannot execute save_score_attempt';
  end if;
  raise notice 'SCORE_ATTEMPTS PRIVILEGES — ALL PASSED';
end $$;

rollback;
