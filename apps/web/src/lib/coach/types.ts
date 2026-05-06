export type CoachGameResult = "win" | "lose" | "draw" | "resigned";

// Back-compat alias — existing importers (game-result.ts, prompt-template.ts,
// fallback-engine.ts) continue to use `GameResult`. New persist sites use
// `CoachGameResult` per the spec §5/§10 to make the schema-check coupling
// loud at the call site.
export type GameResult = CoachGameResult;

const COACH_GAME_RESULTS: readonly CoachGameResult[] = [
  "win",
  "lose",
  "draw",
  "resigned",
] as const;

export function toCoachGameResult(input: unknown): CoachGameResult {
  if (typeof input === "string" && (COACH_GAME_RESULTS as readonly string[]).includes(input)) {
    return input as CoachGameResult;
  }
  throw new Error(
    `Invalid CoachGameResult: ${JSON.stringify(input)} (expected one of ${COACH_GAME_RESULTS.join(", ")})`,
  );
}

export type GameRecord = {
  gameId: string;
  moves: string[];
  result: GameResult;
  difficulty: "easy" | "medium" | "hard";
  totalMoves: number;
  elapsedMs: number;
  timestamp: number;
  receivedAt?: number;
};

export type Mistake = {
  moveNumber: number;
  played: string;
  better: string;
  explanation: string;
};

export type CoachResponse = {
  kind: "full";
  summary: string;
  mistakes: Mistake[];
  lessons: string[];
  praise: string[];
};

export type BasicCoachResponse = {
  kind: "quick";
  summary: string;
  tips: string[];
};

export type CoachAnalysisRecord = {
  gameId: string;
  provider: "server" | "fallback";
  model?: string;
  analysisVersion: string;
  createdAt: number;
  response: CoachResponse | BasicCoachResponse;
};

export type PlayerSummary = {
  gamesPlayed: number;
  recentMistakeCategories: string[];
  avgGameLength: number;
  difficultyDistribution: Record<string, number>;
  weaknessTags: string[];
};

export type JobStatus =
  | { status: "pending" }
  | { status: "ready"; response: CoachResponse }
  | { status: "failed"; reason: string };

export type BadgeCriteria = {
  area: string;
  metric: string;
  threshold: number;
  windowSize: number;
  minDifficulty?: "medium" | "hard";
  minDiverseDifficulties?: number;
};

// ────────────────────────────────────────────────────────────────────────
// Coach session memory — v1 taxonomy + persistence shapes (spec §5/§10)
// ────────────────────────────────────────────────────────────────────────

/**
 * Canonical 6-label v1 weakness taxonomy. Deterministic — derived from
 * `mistake.explanation` keyword/positional rules in `weakness-tags.ts`.
 * Adding a new label is a v2 contract change; do NOT extend in v1.
 */
export type WeaknessTag =
  | "hanging-piece"
  | "missed-tactic"
  | "weak-king-safety"
  | "weak-pawn-structure"
  | "opening-blunder"
  | "endgame-conversion";

/**
 * Row shape for `public.coach_analyses`. Used by the PR 2 writer
 * (`persistAnalysis`) and reader (`aggregateHistory`).
 *
 * - `wallet`: lowercase `0x…` address (composite PK part 1).
 * - `game_id`: UUID (composite PK part 2).
 * - `kind`: `"full"` only in v1; `"quick"` reserved for v2 (P1-5).
 * - `expires_at`: 1y rolling TTL. Cron purges (`/api/cron/coach-purge`)
 *   delete rows where `expires_at < now()`. Backfill (PR 3) sets this
 *   to the original analysis's `createdAt + 1y` rather than the column
 *   default to honor the privacy notice "365 days from creation" (P1-6).
 */
export type CoachAnalysisRow = {
  wallet: string;
  game_id: string;
  created_at: string; // ISO 8601
  expires_at: string; // ISO 8601
  kind: "full" | "quick";
  difficulty: "easy" | "medium" | "hard";
  result: CoachGameResult;
  total_moves: number;
  summary_text: string;
  mistakes: Mistake[];
  lessons: string[];
  praise: string[];
  weakness_tags: WeaknessTag[];
};

/**
 * Aggregated digest computed per-PRO-request from the last 20 rows.
 * Consumed by the prompt augmentation block (PR 2 `prompt-template.ts`).
 *
 * - `gamesPlayed`: depth of the read (≤ 20).
 * - `recentResults`: per-bucket counts across the digest window.
 * - `topWeaknessTags`: top 3 tags by count, descending; ties broken by
 *   alphabetical ascending. Empty array means "no canonical-tag matches
 *   found across these games" — triggers the no-evidence hard-guard
 *   prompt branch (spec §6.3).
 */
export type HistoryDigest = {
  gamesPlayed: number;
  recentResults: {
    win: number;
    lose: number;
    draw: number;
    resigned: number;
  };
  topWeaknessTags: Array<{ tag: WeaknessTag; count: number }>;
};
