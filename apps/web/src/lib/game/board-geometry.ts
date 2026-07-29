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

export type HintPlacement = "top" | "bottom" | "left" | "right";

/**
 * Which side of the piece the "Tap your piece first" pill should sit on, so it
 * never clips against the board edge. Geometry, not policy — which is why it
 * lives here and not inside whichever board asked first.
 */
export function pickHintPlacement(file: number, rank: number): HintPlacement {
  if (rank >= 6) return "bottom";
  if (file <= 1) return "right";
  if (file >= 6) return "left";
  return "top";
}
/* Move trail geometry, in viewBox units — one cell is 12.5.
 *
 * An arrowhead of FIXED size with a streak behind it, rather than one triangle
 * stretched between the squares. A single triangle has to be either a needle
 * over long moves or a blob over short ones, and its wide notched end reads as
 * a second arrowhead aimed back at where the piece started. Pinning the head
 * makes "which way" a constant, and lets the streak carry only "how far". */

/** Head width stays under one square, per the founder's constraint. */
const TRAIL_HEAD_HALF_WIDTH = 4.6;
const TRAIL_HEAD_LENGTH = 6;
/** How far the tip stops SHORT of the destination centre. The trail is drawn
 *  after the move, so a tip on the centre would sit under the piece that just
 *  landed there. Half a cell puts the head at the square's edge, pointing at
 *  the piece instead of hiding beneath it. */
const TRAIL_TIP_INSET = 5.6;
/** The streak: a sliver where the piece set off, full width behind the head —
 *  the shape a moving object leaves, not a wedge pointing backwards. */
const TRAIL_STREAK_HALF_AT_HEAD = 1.8;
const TRAIL_STREAK_HALF_AT_ORIGIN = 0.45;
/** A one-square move leaves under 7 units once the tip is inset, so the head
 *  has to give way or it swallows the streak whole. */
const TRAIL_HEAD_MAX_SHARE = 0.72;

/**
 * The move trail — a fixed arrowhead with the streak the piece left behind it,
 * as SVG polygon points.
 *
 * A plain line said "these two squares are connected"; this says which way the
 * piece went, which is the whole lesson (rook straight, bishop diagonal).
 * Built from the move vector rather than rotated in CSS: the board is square
 * and the viewBox is uniform, so a perpendicular in viewBox units is a true
 * perpendicular on screen, and no transform-origin has to be guessed.
 *
 * Returns null for a zero-length move — there is no direction to point in, and
 * normalising would divide by zero.
 */
export function trailDartPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string | null {
  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const length = Math.hypot(vx, vy);
  if (length < 0.01) return null;

  const dx = vx / length;
  const dy = vy / length;
  // Perpendicular to the travel direction.
  const px = -dy;
  const py = dx;

  // Everything is measured from the origin, along the travel.
  const tipAt = Math.max(length - TRAIL_TIP_INSET, length * 0.35);
  const headLength = Math.min(TRAIL_HEAD_LENGTH, tipAt * TRAIL_HEAD_MAX_SHARE);
  const headBaseAt = tipAt - headLength;
  // Shrink the head's width with its length so a clamped head stays an
  // arrowhead instead of turning into a wide flat bar.
  const headHalf = TRAIL_HEAD_HALF_WIDTH * (headLength / TRAIL_HEAD_LENGTH);
  const streakHalf = Math.min(TRAIL_STREAK_HALF_AT_HEAD, headHalf * 0.6);

  const at = (along: number, across: number) => ({
    x: from.x + dx * along + px * across,
    y: from.y + dy * along + py * across,
  });

  // Perimeter, tip first: down the head's left barb, back along the streak to
  // the origin, then out the other side.
  const perimeter = [
    at(tipAt, 0),
    at(headBaseAt, headHalf),
    at(headBaseAt, streakHalf),
    at(0, TRAIL_STREAK_HALF_AT_ORIGIN),
    at(0, -TRAIL_STREAK_HALF_AT_ORIGIN),
    at(headBaseAt, -streakHalf),
    at(headBaseAt, -headHalf),
  ];

  return perimeter.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

