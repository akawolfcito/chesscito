-- pgbench fixture for a non-production database only.
--
-- Slice 3 etapa 4B: two clients racing the SAME attempt_id on the SAME wallet.
-- The replay lookup at step 4 is a SELECT, so on its own it cannot settle a
-- race: both callers can miss the row and proceed to insert. Two things stop
-- the second one — the wallet advisory lock (the second waits, then sees the
-- committed row and returns a replay) and `unique (wallet, attempt_id)` behind
-- it. This fixture exercises both.
--
-- Prepare the session row once, then run with 8 clients against a disposable
-- Supabase test database:
--
--   psql "$SUPABASE_TEST_DATABASE_URL" -c "
--     insert into public.score_write_sessions
--       (session_id, wallet, surface, token_hash, issued_at, expires_at,
--        challenge_expires_at, max_saves, used_saves, authorized_at)
--     values (repeat('c',32), '0xcccccccccccccccccccccccccccccccccccccccc',
--             'learn', repeat('c',64), now(), now() + interval '2 hours',
--             now() + interval '5 minutes', 100, 0, now());"
--
--   pgbench -n -c 8 -j 8 -t 1 -f this-file "$SUPABASE_TEST_DATABASE_URL"
--
-- Then assert, in SQL:
--   1. exactly ONE row in score_attempts for that (wallet, attempt_id);
--   2. used_saves = 1 — seven of the eight callers were replays and spent
--      nothing;
--   3. exactly ONE score_saves row for that wallet+level.
--
-- Any other outcome means the lock or the unique key stopped holding. This
-- fixture never touches production data and never submits a payment.

select public.save_score_attempt(
  repeat('c', 64),                                  -- p_token_hash
  'cccccccccccccccccccccccccccccccc',               -- p_attempt_id (the race)
  'client',                                         -- p_attempt_id_source
  1,                                                -- p_level_id
  120,                                              -- p_score
  30000,                                            -- p_time_ms
  'rook-distance-1',                                -- p_exercise_id
  'moves', 4, null,                                 -- measurement
  'graded', 3,                                      -- grade
  'learn'                                           -- p_deployment_surface
);
