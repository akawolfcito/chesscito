import type { BoardPosition } from "../types";
import { getRookMoves } from "./rook";
import { getBishopMoves } from "./bishop";

export function getQueenMoves(
  origin: BoardPosition,
  blockers: BoardPosition[] = [],
): BoardPosition[] {
  return [
    ...getRookMoves(origin, blockers),
    ...getBishopMoves(origin, blockers),
  ];
}
