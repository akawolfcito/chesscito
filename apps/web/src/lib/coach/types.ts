export type GameResult = "win" | "lose" | "draw" | "resigned";

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
