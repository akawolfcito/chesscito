/**
 * Supabase table types — derived data only.
 * On-chain remains source of truth for scores, badges, and victories.
 */

export type PracticeRun = {
  id: string;
  wallet: string;
  piece: string;
  exercise_id: string;
  actual_moves: number;
  optimal_moves: number;
  stars_earned: number;
  time_ms: number;
  was_replay: boolean;
  created_at: string;
};

export type PracticeMoveLog = {
  id: string;
  run_id: string;
  move_index: number;
  from_square: string;
  to_square: string;
  created_at: string;
};

export type CoachSummary = {
  id: string;
  wallet: string;
  mode: "arena" | "practice";
  piece: string | null;
  game_id: string | null;
  analysis: Record<string, unknown>;
  created_at: string;
};

export type PlayerProgressSnapshot = {
  id: string;
  wallet: string;
  piece: string;
  total_stars: number;
  best_local_score: number;
  badge_claimed: boolean;
  exercise_breakdown: number[];
  updated_at: string;
};

export type HallVictoryIndex = {
  id: string;
  token_id: number;
  wallet: string;
  difficulty: string;
  total_moves: number;
  time_ms: number;
  block_number: number;
  tx_hash: string;
  minted_at: string;
};
