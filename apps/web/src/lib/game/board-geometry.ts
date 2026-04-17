// apps/web/src/lib/game/board-geometry.ts

export type Point = { x: number; y: number };

// Uniform 8x8 grid — each cell is 12.5% of the board
const CELL_SIZE = 12.5;

/**
 * Compute bounding box for a cell at (file, rank).
 * Rank 0 = row 1 (bottom), rank 7 = row 8 (top).
 * Uniform grid — no perspective distortion.
 */
export function cellGeometry(file: number, rank: number) {
  const row = 7 - rank;
  const col = file;

  return {
    left: col * CELL_SIZE,
    top: row * CELL_SIZE,
    width: CELL_SIZE,
    height: CELL_SIZE,
  };
}

/**
 * Get center point for placing a piece at (file, rank).
 */
export function cellCenter(file: number, rank: number): Point {
  const row = 7 - rank;
  const col = file;

  return {
    x: (col + 0.5) * CELL_SIZE,
    y: (row + 0.5) * CELL_SIZE,
  };
}

/**
 * Get piece width (% of canvas) — uniform size for all cells.
 */
export function pieceWidth(): number {
  return CELL_SIZE * 0.82;
}
