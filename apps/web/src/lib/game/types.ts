export type PieceId = "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";

export type BoardPosition = {
  file: number; // 0=a … 7=h
  rank: number; // 0=1 … 7=8
};

export type BoardPiece = {
  id: string;
  type: PieceId;
  position: BoardPosition;
};

export type SquareState = {
  file: number;
  rank: number;
  label: string;
  isDark: boolean;
  isHighlighted: boolean;
  isEndpoint: boolean;
  isSelected: boolean;
  isTarget: boolean;
  piece: BoardPiece | null;
};

export type Exercise = {
  id: string;
  startPos: BoardPosition;   // posición inicial de la pieza
  targetPos: BoardPosition;  // casilla objetivo
  optimalMoves: number;      // mínimo teórico de movimientos
  isCapture?: boolean;
  /** L2 labyrinth obstacles — friendly blocker pieces that the player's
   *  piece cannot move through or capture. Sliding pieces (rook, bishop,
   *  queen) stop one square before an obstacle in the line of attack.
   *  When set, the exercise is treated as labyrinth mode. */
  obstacles?: BoardPosition[];
  /** Squares with capturable enemy pickups. In pawn labyrinths with
   *  isCapture=true, the pawn may only move diagonally to squares in
   *  captureTargets or targetPos. Rendered as capturable markers
   *  without a lock icon, visually distinct from obstacles. */
  captureTargets?: BoardPosition[];

  /* ── Labyrinth System v0.2 — mint metadata (all optional, additive).
   *  Spec: docs/superpowers/specs/2026-06-02-labyrinth-system-v0.2.md §4.1
   *  Defaults are applied by `resolveLabyrinthMintPolicy` — never read
   *  these directly; always resolve through the helper so UI, sign
   *  endpoint, and leaderboard reader share one source of truth. */
  mintable?: boolean;
  leaderboardEligible?: boolean;
  rewardEligible?: boolean;
  campaignEligible?: boolean;
  minStarsToMint?: 1 | 2 | 3;
  minStarsForReward?: 1 | 2 | 3;
  seasonId?: string;
  campaignId?: string;
  partnerId?: string;
  rewardTier?: "none" | "in_game" | "partner" | "mystery";
};

export type LabyrinthProgress = {
  piece: PieceId;
  /** Best (minimum) move count achieved across attempts per labyrinth.
   *  null until first completion. */
  bestMoves: Record<string, number | null>;
  /** Stars earned per labyrinth (0–3). Stars are recomputed when a new
   *  best is recorded. */
  stars: Record<string, number>;
};

export type PieceProgress = {
  piece: PieceId;
  /** Índice del ejercicio activo. Rango válido: 0 .. getExerciseCount(piece) - 1.
   *  Per-piece dinámico desde Sprint 1 commit 1 (Training Economy Alpha
   *  2026-06-05) cuando piece pools dejaron de ser fijos en 5. */
  exerciseIndex: number;
  /** Estrellas (0..3) por ejercicio. La longitud del array matchea
   *  getExerciseCount(piece) — relajado de tuple fijo de 5 a number[]
   *  en Sprint 1 commit 4 para soportar piece pools de tamaño variable.
   *  loadProgress migra legacy stars[5] a la longitud actual padding
   *  con ceros al final, preservando todos los valores existentes. */
  stars: number[];
};

/* ── Arena (full chess) types ── */

export type ChessPieceId = PieceId;

export type PieceColor = "w" | "b";

export type ChessBoardPiece = {
  /** Stable identity that survives moves — used as React key to keep CSS
   *  transitions attached to the same DOM node when pieces re-sort. */
  id: string;
  type: ChessPieceId;
  color: PieceColor;
  square: string; // algebraic notation, e.g. "e4"
};

export type ArenaDifficulty = "easy" | "medium" | "hard";

export type ArenaStatus =
  | "selecting"
  | "playing"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "resigned";
