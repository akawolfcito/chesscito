-- Leaderboard RPC function for reliable access via PostgREST
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  player text,
  total_score int,
  rank int,
  is_verified boolean
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sub.player,
    SUM(sub.best_score)::int AS total_score,
    RANK() OVER (ORDER BY SUM(sub.best_score) DESC, sub.player ASC)::int AS rank,
    COALESCE(pc.is_verified, false) AS is_verified
  FROM (
    SELECT s.player, s.level_id, MAX(s.score) AS best_score
    FROM scores s
    GROUP BY s.player, s.level_id
  ) sub
  LEFT JOIN passport_cache pc ON pc.player = sub.player
  GROUP BY sub.player, pc.is_verified
  ORDER BY total_score DESC, sub.player ASC
  LIMIT 10;
$$;
