/**
 * The grid the Ba Dan residents' G sheets are packed on (issue #284, ADR
 * 0084, ADR 0091): sheet pixels per world pixel, where a ground tile is 64
 * world px.
 *
 * 1 is the world's native grid, the party's since ADR 0089: 64 px a tile, a
 * 64x96 cel, a figure about 59 px tall, redrawn there natively
 * (`art/source/residents-g1`, packed by `scripts/art/residents-g1.ts`). 2 was
 * the old G sheet, 128 px a tile, a 128x192 cel. The manifest reads this.
 */
export const RESIDENT_SHEET_PX_PER_WORLD_PX = 1;

/** World pixels a ground tile spans. */
export const WORLD_TILE_PX = 64;

export interface ResidentGrid {
  readonly pxPerWorldPx: number;
  readonly pixelsPerTile: number;
  readonly frameW: number;
  readonly frameH: number;
}

export function residentGrid(pxPerWorldPx = RESIDENT_SHEET_PX_PER_WORLD_PX): ResidentGrid {
  if (!Number.isInteger(pxPerWorldPx) || pxPerWorldPx < 1)
    throw new Error(
      `A resident grid is a whole number of sheet px per world px, not ${pxPerWorldPx}.`,
    );
  const pixelsPerTile = WORLD_TILE_PX * pxPerWorldPx;
  return { pxPerWorldPx, pixelsPerTile, frameW: pixelsPerTile, frameH: pixelsPerTile * 1.5 };
}
