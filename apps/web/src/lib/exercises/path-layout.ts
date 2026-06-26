/**
 * Path-map layout — infinite tiling.
 *
 * The exercises drawer renders its nodes on a single scrollable canvas whose
 * background is a vertically seamless tile (`path-map.png`, 1024×1536) set to
 * `repeat-y`. The tile carries TWO sandy "level pads" in an S-curve; stacking
 * copies makes the trail repeat forever, so ANY number of nodes lands on a pad
 * without re-arting. Add a 31st exercise later → the canvas just grows by more
 * tiles.
 *
 * Node 0 (exercise 1) sits at the visual BOTTOM. `tileNodePositions` returns
 * absolute `%` coordinates over the full T-tile canvas; `tileCount` gives T so
 * the canvas can size itself (`aspect-ratio: 1024 / (1536·T)`) and slice the
 * background (`background-size: 100% (100/T)%`).
 */

/** A point on the canvas, as a percentage (0–100) of width (`x`) and height
 *  (`y`). `y` grows downward (0 = top). */
export type PathPoint = { x: number; y: number };

/** Native pixel size of one seamless tile. */
export const TILE_ASPECT = { w: 1024, h: 1536 } as const;

/**
 * Pad centers WITHIN a single tile, ordered bottom → top, as `%` of the tile.
 * Measured from `path-map.png`: a lower-left pad and an upper-right pad.
 */
export const TILE_PADS: readonly PathPoint[] = [
  { x: 35.1, y: 69.1 }, // bottom pad (lower-left)
  { x: 63.2, y: 28.4 }, // top pad (upper-right)
];

/**
 * Manual fine-tune for seating the node art on the painted pad.
 *
 * `TILE_PADS` are the geometric centers of the wallpaper's sandy pads, but
 * the node sprites (btn-nodo, labyrinth) read off-center against the pads'
 * isometric perspective. These pixel nudges shift every node by a constant
 * amount (mobile 390px width). EDIT THESE BY HAND until the icons sit on the
 * pads: `+x` = right, `+y` = down. Labyrinth art can need its own nudge, so
 * it has a separate knob.
 */
export const NODE_PIXEL_OFFSET = { x: 17, y: -10 } as const;
export const LABYRINTH_PIXEL_OFFSET = { x: -15, y: -15 } as const;

/** Tiles needed to host `nodeCount` nodes (≥ 1). */
export function tileCount(nodeCount: number): number {
  if (nodeCount <= 0) return 1;
  return Math.ceil(nodeCount / TILE_PADS.length);
}

/**
 * Absolute `%` coordinates for each node over the full T-tile canvas, ordered
 * to match `orderedRows` (index 0 = bottom). Empty for `nodeCount <= 0`.
 *
 * Node `i` lands on pad `i % padsPerTile` of the tile `floor(i / padsPerTile)`
 * counted FROM THE BOTTOM, so growth is upward and the bottom pad stays put as
 * content is added.
 */
export function tileNodePositions(nodeCount: number): PathPoint[] {
  if (nodeCount <= 0) return [];
  const padsPerTile = TILE_PADS.length;
  const tiles = tileCount(nodeCount);
  const out: PathPoint[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const tileFromBottom = Math.floor(i / padsPerTile);
    const pad = TILE_PADS[i % padsPerTile];
    // The tile's top edge, measured in tile-units from the canvas top.
    const tileTopUnits = tiles - 1 - tileFromBottom;
    const y = ((tileTopUnits + pad.y / 100) / tiles) * 100;
    out.push({ x: pad.x, y });
  }
  return out;
}
