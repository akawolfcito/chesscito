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

/** A static black piece that projects a threat. Lives HERE rather than next to
 *  `mapFenPuzzle` because `Exercise` carries it and fen-puzzle.ts imports this
 *  module — the other direction would be a cycle. `fen-puzzle` re-exports it. */
export type TypedEnemy = { pos: BoardPosition; piece: PieceId };

/** What a Promotion Run level asks the player to crown (P3). Here rather than in
 *  `promotion-run.ts` for the same reason as `TypedEnemy`: `Exercise` carries it
 *  and that module imports this one, so the other direction would be a cycle.
 *  `promotion-run.ts` and `fen-puzzle.ts` both re-export it.
 *
 *  A record rather than a bare `PieceId` on purpose: the bishop-pair variant
 *  (plan §3.5) is a second win condition, and this is where it lands — a widened
 *  type, not surgery on every caller. */
export type MissionSpec = { promoteTo: PieceId };

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

/** Authoring difficulty tier for an exercise. Drives tier-gated daily
 *  rotation (future rotation engine) and pedagogical bias toward less
 *  completed exercises. Optional + additive — legacy entries without a
 *  tier are treated as untiered until classified. Criteria live next to
 *  the catalog in `exercises.ts` (TIER CRITERIA block). */
export type ExerciseTier = "easy" | "medium" | "hard";

/** Commercial access metadata for authored content. Missing metadata is
 *  intentionally resolved as `base` by the shared Training Content gate so
 *  every existing catalog row remains available under its current rules. */
export type ContentAccess = "base" | "training_pass";

export type Exercise = {
  id: string;
  startPos: BoardPosition;   // posición inicial de la pieza
  targetPos: BoardPosition;  // casilla objetivo
  optimalMoves: number;      // mínimo teórico de movimientos
  isCapture?: boolean;
  /** Difficulty tier (rotation + progression metadata). Optional during
   *  the content-authoring rollout; consumed by the future rotation
   *  engine, NOT by current UI. See `ExerciseTier`. */
  tier?: ExerciseTier;
  /** Additive entitlement requirement. Absent means `base` for backwards
   *  compatibility; consumers must resolve it through content-access.ts. */
  access?: ContentAccess;
  /** Authoring-only pedagogical objective, EN. NOT user-facing copy yet
   *  — if surfaced later it gets EN/ES i18n in a separate commit. Plain
   *  guidance for content reviewers on what the exercise teaches. */
  objective?: string;

  /* ── Pedagogy (A1). The exercise says what it teaches.
   *  Before this, the catalog knew the lesson only as `tags` — an internal
   *  taxonomy that never reached the player, so the UI fell back to
   *  "Exercise 1..10" and a player captured a star without ever learning
   *  what for. These four are CURATED, never derived from tags: three tags
   *  turned out to be lies, and text generated from a lie is a lesson that
   *  lies with the authority of a system. The linter enforces them for
   *  curated pieces (lib/content/lint.ts).
   *  Plan: docs/plans/2026-07-13-rook-curriculum-implementation-plan.md §7 */

  /** The single chess principle this exercise exists to teach, as a stable
   *  slug (e.g. "rank-movement", "no-diagonal", "friendly-blocker"). One per
   *  exercise — if it teaches two things, it is two exercises. */
  principle?: string;
  /** User-facing title. Short, imperative, no jargon ("Move along the rank").
   *  Replaces the "Exercise {n}" fallback in the drawer. */
  title?: string;
  /** User-facing prompt shown when the exercise opens. One sentence that
   *  states the PRINCIPLE, never the solution: "You cannot jump over your own
   *  piece. Go around it." — not "Move to b1, then b3". */
  playerPrompt?: string;
  /** Authoring-only. What the player should walk away knowing. Read by content
   *  reviewers; never rendered. */
  learningObjective?: string;
  /** Lowercase kebab-case content tags (e.g. "straight-line",
   *  "blocked-file", "detour", "capture", "edge-control", "rook-lift").
   *  Used for authoring organization + future rotation variety bias. */
  tags?: string[];
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
  /** Safe Path — the static black pieces that WATCH squares. Typed, because a
   *  rook does not attack like a bishop, and `obstacles` is squares-only.
   *  Never route with these directly: `lib/game/attack-map.ts` turns them into
   *  the watched set, and only it knows that a ray also watches its blocker. */
  enemies?: TypedEnemy[];

  /** Promotion Run — the piece this level asks the pawn to crown. Absent on
   *  every other kind. The board checks it AT the promotion; the route to rank 8
   *  does not depend on it. */
  mission?: MissionSpec;

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
  /** Active exercise, keyed by exerciseId (not a pool index). `null`
   *  means "no exercise selected yet" → consumers fall back to the first
   *  pool exercise. Replaces the legacy positional `exerciseIndex` in the
   *  Exercises-Builder cluster (2026-06-16) so the catalog can be
   *  reordered/edited without remapping live progress. */
  currentId: string | null;
  /** Best stars (0..3) per exercise, keyed by exerciseId. Sparse: an id
   *  absent from the map means "not played yet" (read as `?? 0`). Order-
   *  independent — immune to catalog reordering. `loadProgress` migrates
   *  the legacy positional `number[]` shape to this map by current catalog
   *  order, dropping ids not in the pool and clamping values to [0,3]. */
  stars: Record<string, number>;
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
