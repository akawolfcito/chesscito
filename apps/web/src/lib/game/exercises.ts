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
  // 4. Distinta fila Y distinta columna — necesita 2 movimientos
  { id: "rook-4", startPos: pos(0, 0), targetPos: pos(7, 7), optimalMoves: 2 },
  // 5. Esquina a posición compleja
  { id: "rook-5", startPos: pos(7, 7), targetPos: pos(1, 2), optimalMoves: 2 },
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

export const EXERCISES: Record<PieceId, Exercise[]> = {
  rook:   ROOK_EXERCISES,
  bishop: BISHOP_EXERCISES,
  knight: KNIGHT_EXERCISES,
};

export const BADGE_THRESHOLD = 10; // de 15 estrellas posibles
export const EXERCISES_PER_PIECE = 5;
