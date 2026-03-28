import type { BoardPiece, BoardPosition, PieceId, SquareState } from "@/lib/game/types";
import { getBishopMoves } from "@/lib/game/rules/bishop";
import { getKnightMoves } from "@/lib/game/rules/knight";
import { getRookMoves } from "@/lib/game/rules/rook";

const BOARD_SIZE = 8;
const FILE_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function makePiece(type: PieceId, position: BoardPosition): BoardPiece {
  return { id: `${type}-1`, type, position };
}

export function arePositionsEqual(a: BoardPosition, b: BoardPosition) {
  return a.file === b.file && a.rank === b.rank;
}

export function isInsideBoard(position: BoardPosition) {
  return (
    position.file >= 0 &&
    position.file < BOARD_SIZE &&
    position.rank >= 0 &&
    position.rank < BOARD_SIZE
  );
}

export function getPositionLabel(position: BoardPosition) {
  return `${FILE_LABELS[position.file]}${position.rank + 1}`;
}

export function getValidTargets(
  pieceType: PieceId,
  position: BoardPosition,
  blockers: BoardPosition[] = []
): BoardPosition[] {
  switch (pieceType) {
    case "rook":   return getRookMoves(position, blockers);
    case "bishop": return getBishopMoves(position, blockers);
    case "knight": return getKnightMoves(position);
    default:       return [];
  }
}

export function movePiece(piece: BoardPiece, nextPosition: BoardPosition): BoardPiece {
  if (!isInsideBoard(nextPosition)) return piece;
  return { ...piece, position: nextPosition };
}

export function buildBoardSquares({
  selectedPosition,
  piece,
  validTargets,
  targetPosition = null,
}: {
  selectedPosition: BoardPosition | null;
  piece: BoardPiece;
  validTargets: BoardPosition[];
  targetPosition?: BoardPosition | null;
}): SquareState[] {
  // Compute endpoints: highlighted cells with no adjacent highlighted neighbor
  // further from origin in the same direction (farthest in each ray)
  const endpointSet = computeEndpoints(validTargets, selectedPosition);

  const squares: SquareState[] = [];

  for (let rank = BOARD_SIZE - 1; rank >= 0; rank--) {
    for (let file = 0; file < BOARD_SIZE; file++) {
      const position = { file, rank };
      const isHighlighted = validTargets.some((t) => arePositionsEqual(t, position));
      squares.push({
        file,
        rank,
        label: getPositionLabel(position),
        isDark: (file + rank) % 2 === 1,
        isHighlighted,
        isEndpoint: isHighlighted && endpointSet.has(`${file},${rank}`),
        isSelected: selectedPosition ? arePositionsEqual(selectedPosition, position) : false,
        isTarget: targetPosition ? arePositionsEqual(targetPosition, position) : false,
        piece: arePositionsEqual(piece.position, position) ? piece : null,
      });
    }
  }

  return squares;
}

/**
 * Finds endpoint cells — the farthest valid cell from origin along each axis/diagonal.
 * For rook: the end of each cardinal ray.
 * For bishop: the end of each diagonal ray.
 * For knight: every valid target is an endpoint (no continuous path).
 */
function computeEndpoints(
  validTargets: BoardPosition[],
  origin: BoardPosition | null,
): Set<string> {
  const endpoints = new Set<string>();
  if (!origin || validTargets.length === 0) return endpoints;

  const targetSet = new Set(validTargets.map((t) => `${t.file},${t.rank}`));

  // 8 directions: cardinal + diagonal
  const DIRS = [
    { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
    { df: 1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: 1 }, { df: -1, dr: -1 },
  ];

  for (const { df, dr } of DIRS) {
    let last: string | null = null;
    let f = origin.file + df;
    let r = origin.rank + dr;
    while (f >= 0 && f < BOARD_SIZE && r >= 0 && r < BOARD_SIZE) {
      const key = `${f},${r}`;
      if (targetSet.has(key)) {
        last = key;
      } else {
        break; // ray blocked
      }
      f += df;
      r += dr;
    }
    if (last) endpoints.add(last);
  }

  // For knight (no ray continuity), check if any target wasn't found via rays
  // If no endpoints were detected via rays, mark all targets as endpoints
  if (endpoints.size === 0 && validTargets.length > 0) {
    for (const t of validTargets) {
      endpoints.add(`${t.file},${t.rank}`);
    }
  }

  return endpoints;
}
