-- Chesscito: Supabase cache layer for leaderboard + hall of fame
-- Run this in the Supabase SQL Editor to create all tables, indices, and views.

-- Scores (one row per ScoreSubmitted event)
CREATE TABLE IF NOT EXISTS scores (
  id serial PRIMARY KEY,
  player text NOT NULL CHECK (player = lower(player)),
  level_id int NOT NULL,
  score int NOT NULL,
  time_ms int NOT NULL,
  tx_hash text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_player_level
  ON scores (player, level_id, score DESC);

-- Victories (one row per VictoryMinted event)
CREATE TABLE IF NOT EXISTS victories (
  id serial PRIMARY KEY,
  token_id bigint UNIQUE NOT NULL,
  player text NOT NULL CHECK (player = lower(player)),
  difficulty smallint NOT NULL,
  total_moves int NOT NULL,
  time_ms int NOT NULL,
  tx_hash text UNIQUE NOT NULL,
  minted_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_victories_player ON victories (player);

-- Passport verification cache
CREATE TABLE IF NOT EXISTS passport_cache (
  player text PRIMARY KEY CHECK (player = lower(player)),
  is_verified boolean DEFAULT false,
  checked_at timestamptz DEFAULT now()
);

-- Sync state (tracks last synced block for cron)
CREATE TABLE IF NOT EXISTS sync_state (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Leaderboard function (RPC) — more reliable than direct view access via PostgREST
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

-- Leaderboard view: best score per player per level, summed, ranked
CREATE OR REPLACE VIEW leaderboard_v AS
SELECT
  sub.player,
  SUM(sub.best_score)::int AS total_score,
  RANK() OVER (ORDER BY SUM(sub.best_score) DESC, sub.player ASC)::int AS rank,
  COALESCE(pc.is_verified, false) AS is_verified
FROM (
  SELECT player, level_id, MAX(score) AS best_score
  FROM scores
  GROUP BY player, level_id
) sub
LEFT JOIN passport_cache pc ON pc.player = sub.player
GROUP BY sub.player, pc.is_verified
ORDER BY total_score DESC, sub.player ASC
LIMIT 10;
