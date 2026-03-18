// apps/web/src/lib/game/board-geometry.ts

export type Point = { x: number; y: number };

// Corners calibrated from chesscito-board.png grid-line analysis (% of 1024x1024 canvas)
// Method: grayscale pixel scan -> horizontal brightness minima -> per-row vertical
// line regression (6-point linear fit per column, max residual <4px)
// Horizontal grid lines at y: 5.6%, 14.7%, 24.4%, 34.5%, 45.1%, 55.8%, 67.0%, 79.1%, 91.2%
// Vertical edges converge toward top (perspective trapezoid)
export const BOARD_TOP_LEFT: Point = { x: 9.4, y: 5.6 };
export const BOARD_TOP_RIGHT: Point = { x: 89.5, y: 5.6 };
export const BOARD_BOTTOM_LEFT: Point = { x: 0.0, y: 91.2 };
export const BOARD_BOTTOM_RIGHT: Point = { x: 99.2, y: 91.2 };

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Gamma > 1 compresses top rows to match board perspective foreshortening
// Measured row heights (top->bottom): 94, 99, 103, 109, 109, 115, 124, 124 px
// Best-fit gamma via least-squares: 1.10
export const BOARD_V_GAMMA = 1.10;

export function interpolateQuad(u: number, v: number): Point {
  const vg = Math.pow(v, BOARD_V_GAMMA);
  return {
    x: lerp(lerp(BOARD_TOP_LEFT.x, BOARD_TOP_RIGHT.x, u), lerp(BOARD_BOTTOM_LEFT.x, BOARD_BOTTOM_RIGHT.x, u), vg),
    y: lerp(lerp(BOARD_TOP_LEFT.y, BOARD_TOP_RIGHT.y, u), lerp(BOARD_BOTTOM_LEFT.y, BOARD_BOTTOM_RIGHT.y, u), vg),
  };
}

/**
 * Compute bounding box + clip-path for a cell at (file, rank).
 * Rank 0 = row 1 (bottom), rank 7 = row 8 (top).
 */
export function cellGeometry(file: number, rank: number) {
  const row = 7 - rank;
  const col = file;
  const u0 = col / 8;
  const u1 = (col + 1) / 8;
  const v0 = row / 8;
  const v1 = (row + 1) / 8;
  const p00 = interpolateQuad(u0, v0);
  const p10 = interpolateQuad(u1, v0);
  const p01 = interpolateQuad(u0, v1);
  const p11 = interpolateQuad(u1, v1);
  const minX = Math.min(p00.x, p10.x, p01.x, p11.x);
  const maxX = Math.max(p00.x, p10.x, p01.x, p11.x);
  const minY = Math.min(p00.y, p10.y, p01.y, p11.y);
  const maxY = Math.max(p00.y, p10.y, p01.y, p11.y);
  const cW = maxX - minX || 0.01;
  const cH = maxY - minY || 0.01;

  function relPt(pt: Point) {
    return `${(((pt.x - minX) / cW) * 100).toFixed(1)}% ${(((pt.y - minY) / cH) * 100).toFixed(1)}%`;
  }

  return {
    left: minX,
    top: minY,
    width: cW,
    height: cH,
    clipPath: `polygon(${relPt(p00)}, ${relPt(p10)}, ${relPt(p11)}, ${relPt(p01)})`,
  };
}

/**
 * Get center point for placing a piece at (file, rank).
 */
export function cellCenter(file: number, rank: number): Point {
  const row = 7 - rank;
  const col = file;
  return interpolateQuad((col + 0.5) / 8, (row + 0.5) / 8);
}

/**
 * Get piece width (% of canvas) that scales gently with perspective.
 * Blends 40% actual cell width + 60% uniform width to avoid extreme size variation.
 */
export function pieceWidth(file: number, rank: number): number {
  const geo = cellGeometry(file, rank);
  const uniform = (BOARD_BOTTOM_RIGHT.x - BOARD_BOTTOM_LEFT.x) / 8;
  return (geo.width * 0.4 + uniform * 0.6) * 0.82;
}
