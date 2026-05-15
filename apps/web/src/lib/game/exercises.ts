import type { Exercise, PieceId } from "@/lib/game/types";
import { defineLabyrinth } from "@/lib/game/notation";

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

const QUEEN_EXERCISES: Exercise[] = [
  // 1. Long diagonal (a1→h8)
  { id: "queen-1", startPos: pos(0, 0), targetPos: pos(7, 7), optimalMoves: 1 },
  // 2. Vertical file (a1→a8)
  { id: "queen-2", startPos: pos(0, 0), targetPos: pos(0, 7), optimalMoves: 1 },
  // 3. Short diagonal (d4→e5)
  { id: "queen-3", startPos: pos(3, 3), targetPos: pos(4, 4), optimalMoves: 1 },
  // 4. Horizontal rank (a1→h1)
  { id: "queen-4", startPos: pos(0, 0), targetPos: pos(7, 0), optimalMoves: 1 },
  // 5. Two-move path: e4(4,3) → b8(1,7) — not reachable in 1 (no shared rank/file/diagonal)
  { id: "queen-5", startPos: pos(4, 3), targetPos: pos(1, 7), optimalMoves: 2 },
];

/** Pieces with exercises defined and playable */
export const PLAYABLE_PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen"];

export const EXERCISES: Record<PieceId, Exercise[]> = {
  rook:   ROOK_EXERCISES,
  bishop: BISHOP_EXERCISES,
  knight: KNIGHT_EXERCISES,
  pawn:   PAWN_EXERCISES,
  queen:  QUEEN_EXERCISES,
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
  {
    id: "rook-lab-1",
    startPos: pos(0, 0),
    targetPos: pos(7, 7),
    optimalMoves: 3,
    obstacles: [
      pos(3, 0), // d1
      pos(3, 7), // d8
      pos(7, 3), // h4
    ],
  },
  {
    id: "rook-lab-2",
    startPos: pos(0, 0),
    targetPos: pos(7, 0),
    optimalMoves: 3,
    obstacles: [
      pos(2, 0), // c1
      pos(5, 0), // f1
      pos(0, 3), // a4
    ],
  },
  defineLabyrinth({
    id: "rook-lab-3",
    start: "a1",
    target: "h8",
    obstacles: ["d1", "a4", "h5"],
    optimalMoves: 3,
  }),
];

const BISHOP_LABYRINTHS: Exercise[] = [
  defineLabyrinth({
    id: "bishop-lab-3",
    start: "c1",
    target: "h6",
    obstacles: ["e3", "g5"],
    optimalMoves: 3,
  }),
  defineLabyrinth({
    id: "bishop-lab-4",
    start: "a1",
    target: "h8",
    obstacles: ["c3", "e5"],
    optimalMoves: 5,
  }),
];

const KNIGHT_LABYRINTHS: Exercise[] = [
  /**
   * knight-lab-1 — "The Clipped Jump"
   * From a1 to e4. c2 blocks the natural first move, forcing the
   * knight out through b3. d4 pinches the centre so the knight
   * must hook around via d2 or c5.
   *
   *  8 . . . . . . . .
   *  7 . . . . . . . .
   *  6 . . . . . . . .
   *  5 . . . . . . . .
   *  4 . . . . X ★ . .
   *  3 . . . . . . . .
   *  2 . . X . . . . .
   *  1 ♘ . . . . . . .
   *    a b c d e f g h
   */
  {
    id: "knight-lab-1",
    startPos: pos(0, 0),
    targetPos: pos(4, 3),
    optimalMoves: 3,
    obstacles: [
      pos(2, 1), // c2
      pos(3, 3), // d4
    ],
  },
  /**
   * knight-lab-2 — "The Zigzag"
   * From a1 to e5. b3 and d3 choke two early squares; c6 blocks
   * the far side. The knight must weave a 4-jump through narrow
   * gaps.
   *
   *  8 . . . . . . . .
   *  7 . . . . . . . .
   *  6 . . X . . . . .
   *  5 . . . . ★ . . .
   *  4 . . . . . . . .
   *  3 . . X . . . . .
   *  2 . . . . . . . .
   *  1 ♘ . . . . . . .
   *    a b c d e f g h
   */
  {
    id: "knight-lab-2",
    startPos: pos(0, 0),
    targetPos: pos(4, 4),
    optimalMoves: 4,
    obstacles: [
      pos(1, 2), // b3
      pos(3, 2), // d3
      pos(2, 5), // c6
    ],
  },
  defineLabyrinth({
    id: "knight-lab-3",
    start: "a1",
    target: "h8",
    obstacles: ["d1", "c5", "g6"],
    optimalMoves: 6,
  }),
  defineLabyrinth({
    id: "knight-lab-4",
    start: "a1",
    target: "f6",
    obstacles: ["c2", "d4", "e3"],
    optimalMoves: 4,
  }),
  defineLabyrinth({
    id: "knight-lab-5",
    start: "b1",
    target: "g7",
    obstacles: ["c4", "e6", "g5"],
    optimalMoves: 5,
  }),
];

const PAWN_LABYRINTHS: Exercise[] = [
  defineLabyrinth({
    id: "pawn-lab-3",
    start: "a2",
    target: "d7",
    obstacles: ["a3", "a4"],
    captureTargets: ["b3", "c4", "d5"],
    isCapture: true,
    optimalMoves: 5,
  }),
  defineLabyrinth({
    id: "pawn-lab-4",
    start: "a2",
    target: "c6",
    obstacles: ["a3"],
    captureTargets: ["b3", "c4"],
    isCapture: true,
    optimalMoves: 4,
  }),
  defineLabyrinth({
    id: "pawn-lab-5",
    start: "g2",
    target: "c7",
    obstacles: ["g3"],
    captureTargets: ["f3", "e4", "d5", "c6"],
    isCapture: true,
    optimalMoves: 5,
  }),
];

const QUEEN_LABYRINTHS: Exercise[] = [
  {
    id: "queen-lab-1",
    startPos: pos(0, 0),
    targetPos: pos(7, 7),
    optimalMoves: 3,
    obstacles: [
      pos(1, 1), // b2
      pos(0, 4), // a5
      pos(7, 3), // h4
    ],
  },
  defineLabyrinth({
    id: "queen-lab-2",
    start: "a1",
    target: "h1",
    obstacles: ["d1", "e2", "d3", "a4", "h4"],
    optimalMoves: 3,
  }),
  defineLabyrinth({
    id: "queen-lab-3",
    start: "d1",
    target: "d8",
    obstacles: ["d3", "d5", "d7"],
    optimalMoves: 3,
  }),
];

export const LABYRINTHS: Record<PieceId, Exercise[]> = {
  rook:   ROOK_LABYRINTHS,
  bishop: BISHOP_LABYRINTHS,
  knight: KNIGHT_LABYRINTHS,
  pawn:   PAWN_LABYRINTHS,
  queen:  QUEEN_LABYRINTHS,
  king:   [],
};

/** Compute stars earned in a labyrinth. */
export function labyrinthStars(moves: number, optimal: number): number {
  if (moves <= optimal) return 3;
  if (moves <= optimal + 2) return 2;
  if (moves <= optimal + 4) return 1;
  return 0;
}
