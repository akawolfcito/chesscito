import type { Exercise, PieceId } from "@/lib/game/types";

function pos(file: number, rank: number) {
  return { file, rank };
}

const ROOK_EXERCISES: Exercise[] = [
  // 1. Mover a lo largo de la fila (horizontal puro)
  { id: "rook-1", startPos: pos(0, 0), targetPos: pos(7, 0), optimalMoves: 1 },
  // 2. Mover a lo largo de la columna (vertical puro)
  { id: "rook-2", startPos: pos(0, 0), targetPos: pos(0, 7), optimalMoves: 1 },
  // 3. Desde el centro hacia arriba
  { id: "rook-3", startPos: pos(3, 3), targetPos: pos(3, 7), optimalMoves: 1 },
  // 4. Captura — esquina a esquina diagonal
  { id: "rook-4", startPos: pos(0, 0), targetPos: pos(7, 7), optimalMoves: 2, isCapture: true },
  // 5. Captura — esquina a posición compleja
  { id: "rook-5", startPos: pos(7, 7), targetPos: pos(1, 2), optimalMoves: 2, isCapture: true },
];

const BISHOP_EXERCISES: Exercise[] = [
  // 1. Diagonal principal larga (a1→h8)
  { id: "bishop-1", startPos: pos(0, 0), targetPos: pos(7, 7), optimalMoves: 1 },
  // 2. Diagonal anti-principal (h1→a8)
  { id: "bishop-2", startPos: pos(7, 0), targetPos: pos(0, 7), optimalMoves: 1 },
  // 3. Diagonal corta desde el centro
  { id: "bishop-3", startPos: pos(3, 3), targetPos: pos(6, 6), optimalMoves: 1 },
  // 4. Mismo color, distinta diagonal — necesita 2 movimientos
  //    a1(0,0) → g1(6,0): via (3,3)→(6,0) ✓
  { id: "bishop-4", startPos: pos(0, 0), targetPos: pos(6, 0), optimalMoves: 2 },
  // 5. Mismo color, ruta no obvia
  //    c3(2,2) → g3(6,2): via e5(4,4)→g3 ✓
  { id: "bishop-5", startPos: pos(2, 2), targetPos: pos(6, 2), optimalMoves: 2 },
];

const KNIGHT_EXERCISES: Exercise[] = [
  // 1. Un salto en L desde el centro
  { id: "knight-1", startPos: pos(3, 3), targetPos: pos(4, 5), optimalMoves: 1 },
  // 2. Un salto desde esquina
  { id: "knight-2", startPos: pos(0, 0), targetPos: pos(1, 2), optimalMoves: 1 },
  // 3. Un salto horizontal
  { id: "knight-3", startPos: pos(0, 0), targetPos: pos(2, 1), optimalMoves: 1 },
  // 4. Dos saltos — no alcanzable en 1
  { id: "knight-4", startPos: pos(0, 0), targetPos: pos(3, 1), optimalMoves: 2 },
  // 5. Trayecto desde esquina a posición lejana
  { id: "knight-5", startPos: pos(0, 0), targetPos: pos(4, 4), optimalMoves: 3 },
];

const PAWN_EXERCISES: Exercise[] = [
  // 1. Forward one — simplest possible pawn move
  { id: "pawn-1", startPos: pos(4, 1), targetPos: pos(4, 2), optimalMoves: 1 },
  // 2. Forward march — advance two from starting rank, then one more
  { id: "pawn-2", startPos: pos(3, 1), targetPos: pos(3, 4), optimalMoves: 2 },
  // 3. Diagonal capture — one step diagonally forward
  { id: "pawn-3", startPos: pos(2, 4), targetPos: pos(3, 5), optimalMoves: 1, isCapture: true },
  // 4. Capture decision — must choose diagonal, not forward
  { id: "pawn-4", startPos: pos(5, 3), targetPos: pos(6, 4), optimalMoves: 1, isCapture: true },
  // 5. Mixed path — advance then capture (forward + forward + diagonal)
  //    d2(3,1) → d4(3,3) fwd2, → d5(3,4) fwd1, → e6(4,5) diagonal capture = 3 moves
  { id: "pawn-5", startPos: pos(3, 1), targetPos: pos(4, 5), optimalMoves: 3, isCapture: true },
];

/** Pieces with exercises defined and playable */
export const PLAYABLE_PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn"];

export const EXERCISES: Record<PieceId, Exercise[]> = {
  rook:   ROOK_EXERCISES,
  bishop: BISHOP_EXERCISES,
  knight: KNIGHT_EXERCISES,
  pawn:   PAWN_EXERCISES,
  queen:  [], // PR-6
  king:   [], // PR-9
};

export const BADGE_THRESHOLD = 10; // de 15 estrellas posibles
export const EXERCISES_PER_PIECE = 5;

/* ── L2 Labyrinths (POC) ──────────────────────────────────────────
 * Obstacles are friendly blocker pieces. The player's piece cannot
 * move through them or capture them. The labyrinth forces a non-
 * trivial path between startPos and targetPos. Stars are awarded by
 * how close the player's move count approaches `optimalMoves`:
 *   moves == optimal           → 3 stars
 *   moves <= optimal + 2       → 2 stars
 *   moves <= optimal + 4       → 1 star
 *   else                       → 0 stars (allowed, no fail)
 * --------------------------------------------------------------- */

const ROOK_LABYRINTHS: Exercise[] = [
  /**
   * rook-lab-1 — "Cross-and-corner"
   * Obstacles form an L-shape that forces the rook to navigate around.
   * Start at a1 (0,0); target h8 (7,7). Direct path 0→0→7→7 (2 moves)
   * is blocked: an obstacle at (3,0) blocks the file 0 horizontal first
   * leg ends at (2,0); an obstacle at (3,7) and (7,3) keep the player
   * from corner-jumping. Optimal: 4 moves.
   *
   *  8 . . . . . . . ★
   *  7 . . . X . . . .
   *  6 . . . . . . . .
   *  5 . . . . . . . .
   *  4 . . . . . . . X
   *  3 . . . . . . . .
   *  2 . . . . . . . .
   *  1 ♜ . . X . . . .
   *    a b c d e f g h
   */
  {
    id: "rook-lab-1",
    startPos: pos(0, 0),
    targetPos: pos(7, 7),
    optimalMoves: 4,
    obstacles: [
      pos(3, 0), // d1
      pos(3, 7), // d8
      pos(7, 3), // h4
    ],
  },
];

export const LABYRINTHS: Record<PieceId, Exercise[]> = {
  rook:   ROOK_LABYRINTHS,
  bishop: [],
  knight: [],
  pawn:   [],
  queen:  [],
  king:   [],
};

/** Compute stars earned in a labyrinth. */
export function labyrinthStars(moves: number, optimal: number): number {
  if (moves <= optimal) return 3;
  if (moves <= optimal + 2) return 2;
  if (moves <= optimal + 4) return 1;
  return 0;
}
