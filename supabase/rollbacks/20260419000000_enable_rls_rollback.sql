-- Rollback for 20260419000000_enable_rls.sql
-- Run this in the Supabase SQL Editor if RLS breaks current API access.
-- Leaves the tables/view in their pre-migration state (no RLS, no policies).

DROP POLICY IF EXISTS "scores_select_public"    ON scores;
DROP POLICY IF EXISTS "victories_select_public" ON victories;

ALTER TABLE scores         DISABLE ROW LEVEL SECURITY;
ALTER TABLE victories      DISABLE ROW LEVEL SECURITY;
ALTER TABLE passport_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state     DISABLE ROW LEVEL SECURITY;

ALTER VIEW leaderboard_v RESET (security_invoker);
