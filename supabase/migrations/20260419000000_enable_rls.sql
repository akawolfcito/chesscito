-- Chesscito: enable Row Level Security on cache layer tables
-- Defense-in-depth: protects data even if SUPABASE_SERVICE_ROLE_KEY leaks
-- or an anon key is later exposed to the client.
--
-- Policies chosen to match current access patterns (all writes are
-- server-side via service_role, which bypasses RLS):
--   scores, victories        → public SELECT (leaderboard/trophies)
--   passport_cache, sync_state → service_role only (no policies = no anon)
--   leaderboard_v            → view respects caller's RLS (security_invoker)

ALTER TABLE scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE victories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scores_select_public"
  ON scores FOR SELECT
  USING (true);

CREATE POLICY "victories_select_public"
  ON victories FOR SELECT
  USING (true);

ALTER VIEW leaderboard_v SET (security_invoker = on);
