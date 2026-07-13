/**
 * Path-map layout — fixed base cap + infinite tiling.
 *
 * The exercises drawer stacks, bottom → top:
 *   1. ONE fixed "base" image (`path-map-base.png`, the water-island
 *      trailhead) carrying the first node (exercise 1).
 *   2. As many seamless tiles (`path-map.png`, a 2-pad S-curve) as the
 *      remaining nodes need. The tile repeats forever, so any node count
 *      works — add a 31st exercise later and the trail just grows.
 *
 * Both the base's top edge and the tile's bottom edge cross at horizontal
 * center, so they connect seamlessly.
 *
 * `pathLayout(n)` returns the absolute `%` coordinates of every node
 * (index 0 = bottom = base) plus the geometry the canvas needs to size and
 * slice itself.
 */

/** A point on the canvas, as a percentage (0–100) of width (`x`) and
 *  height (`y`). `y` grows downward (0 = top). */
export type PathPoint = { x: number; y: number };

/** Native pixel size of one seamless tile. */
export const TILE_ASPECT = { w: 1024, h: 1536 } as const;
/** Native pixel size of the fixed base cap. */
export const BASE_ASPECT = { w: 1024, h: 1042 } as const;

/**
 * Pad centers WITHIN a single tile, ordered bottom → top, as `%` of the
 * tile. A lower-left pad and an upper-right pad.
 */
export const TILE_PADS: readonly PathPoint[] = [
  { x: 35.1, y: 69.1 }, // bottom pad (lower-left)
  { x: 63.2, y: 28.4 }, // top pad (upper-right)
];

/** The single pad on the base cap, as `%` of the base image. */
export const BASE_PAD: PathPoint = { x: 48.6, y: 51.0 };

/**
 * Manual fine-tune for seating the node art on the painted pads.
 *
 * The pads' isometric centers differ from the sprites' visual centers, so
 * each node is nudged by a constant pixel amount (mobile 390px width). EDIT
 * BY HAND until the icons sit on the pads: `+x` = right, `+y` = down.
 *
 * PER COLUMN. The two pads in a tile are painted in different perspectives —
 * one sits left of the trail, one right — so a single nudge that centers the
 * left column necessarily throws the right one off. Index matches `TILE_PADS`:
 * `[0]` = bottom/left pad, `[1]` = top/right pad.
 *
 * The base pad and the labyrinth art keep their own knobs: the base is a
 * different image entirely, and the maze sprite has a different visual center
 * from the piece sprites.
 */
export const NODE_PIXEL_OFFSET: readonly PathPoint[] = [
  { x: -15, y: -20 }, // bottom pad (lower-left)
  { x: -15, y: -20 }, // top pad (upper-right)
];

/** Labyrinth art, per column. Same indexing as `TILE_PADS`. */
export const LABYRINTH_PIXEL_OFFSET: readonly PathPoint[] = [
  { x: 18, y: -10 }, // bottom pad (lower-left)
  { x: 18, y: -10 }, // top pad (upper-right)
];

export const BASE_PIXEL_OFFSET = { x: 3, y: -10 } as const;

/**
 * The column a node sits in: 0 = bottom/left pad, 1 = top/right pad.
 * Node 0 lives on the base cap and has no column — callers use
 * `BASE_PIXEL_OFFSET` for it and never ask.
 */
export function padIndexForNode(nodeIndex: number): number {
  return (nodeIndex - 1) % TILE_PADS.length;
}

/**
 * Vertical seam calibration. The base cap stays pinned to the very bottom
 * edge (its water never lifts → no green gap). This knob slides the TILE
 * trail (background + tile nodes) so the tile's trail-bottom meets the
 * base's trail-top with no jump. Y-only, in pixels (mobile 390px width).
 * `+` = tiles down, `-` = tiles up. EDIT BY HAND while watching the
 * base↔tile seam on device.
 */
export const BASE_SEAM_OFFSET_Y = 50 as const;

export type PathLayout = {
  /** Number of repeating tiles stacked above the base. */
  tilesAbove: number;
  /** Base height as a fraction (0–1) of the total canvas height. */
  baseFrac: number;
  /** Total canvas height in canvas-WIDTH units (height = width × this). */
  totalUnits: number;
  /** Absolute %coords per node, index 0 = bottom (base) → top. */
  positions: PathPoint[];
};

const TILE_AR = TILE_ASPECT.h / TILE_ASPECT.w; // 1.5
const BASE_AR = BASE_ASPECT.h / BASE_ASPECT.w; // 1.0

/**
 * Compose the base + tile layout for `nodeCount` nodes. Node 0 sits on the
 * base pad; nodes 1.. fill the tiles above (2 pads each, bottom → top).
 */
export function pathLayout(nodeCount: number): PathLayout {
  if (nodeCount <= 0) {
    return { tilesAbove: 0, baseFrac: 1, totalUnits: BASE_AR, positions: [] };
  }

  const tilesAbove = Math.ceil((nodeCount - 1) / TILE_PADS.length);
  const totalUnits = BASE_AR + TILE_AR * tilesAbove;
  const baseFrac = BASE_AR / totalUnits;
  const tilesFrac = 1 - baseFrac;

  const positions: PathPoint[] = [];
  // Node 0 → base pad (base occupies the bottom `baseFrac` of the canvas).
  positions.push({
    x: BASE_PAD.x,
    y: (tilesFrac + baseFrac * (BASE_PAD.y / 100)) * 100,
  });
  // Nodes 1.. → tile region (the top `tilesFrac` of the canvas), bottom → top.
  for (let i = 1; i < nodeCount; i++) {
    const j = i - 1; // 0-indexed within the tile region, from the bottom
    const tileFromBottom = Math.floor(j / TILE_PADS.length);
    const pad = TILE_PADS[j % TILE_PADS.length];
    const yInTiles =
      (tilesAbove - 1 - tileFromBottom + pad.y / 100) / tilesAbove;
    positions.push({ x: pad.x, y: yInTiles * tilesFrac * 100 });
  }
  return { tilesAbove, baseFrac, totalUnits, positions };
}
