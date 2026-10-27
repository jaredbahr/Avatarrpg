/**
 * The grid the Ba Dan residents' G sheets are packed on (issue #284, ADR
 * 0084): sheet pixels per world pixel, where a ground tile is 64 world px.
 *
 * 2 is today's G sheet, the party's: 128 px a tile, a 128x192 cel. 1 is the
 * world's native grid under test for the party (`art/source/party-g1`): 64 px
 * a tile, a 64x96 cel, a figure about 59 px tall. `scripts/art/resident-g.ts`
 * and the manifest both read this, so moving the residents to another grid is
 * a change here and a re-run of the packer, not a rewrite.
 */
export const RESIDENT_SHEET_PX_PER_WORLD_PX = 2;

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
