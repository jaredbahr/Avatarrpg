import { describe, expect, it } from 'vitest';
import type { Grid, Tile } from '../../core/types';
import { boardRelief, decorChunks, decorSignature, isCanopy, surfaceEdges } from './board';

const tile = (overrides: Partial<Tile> = {}): Tile => ({
  terrain: 'dirt',
  elevation: 0,
  blocked: false,
  blocksSight: false,
  cover: false,
  surface: null,
  ...overrides,
});

/** A grid from rows of characters: `^` raised, `A` raised twice, `#` wall, `T` tree, `~` water. */
function grid(rows: string[]): Grid {
  const width = rows[0]?.length ?? 0;
  const tiles: Tile[] = [];
  for (const row of rows) {
    for (const ch of row) {
      if (ch === '^') tiles.push(tile({ terrain: 'stone', elevation: 1 }));
      else if (ch === 'A') tiles.push(tile({ terrain: 'stone', elevation: 2 }));
      else if (ch === '#') tiles.push(tile({ terrain: 'wall', blocked: true, blocksSight: true }));
      else if (ch === 'T') tiles.push(tile({ terrain: 'grass', blocked: true, blocksSight: true }));
      else if (ch === 'P') tiles.push(tile({ terrain: 'pit', blocked: true }));
      else if (ch === '~') {
        tiles.push(tile({ surface: { id: 'water', duration: -1, spread: 0 } }));
      } else if (ch === ',') tiles.push(tile({ terrain: 'grass' }));
      else if (ch === '=') tiles.push(tile({ terrain: 'road' }));
      else if (ch === 's') tiles.push(tile({ terrain: 'stone' }));
      else if (ch === 'm') {
        tiles.push(tile({ surface: { id: 'mud', duration: -1, spread: 0 } }));
      } else tiles.push(tile());
    }
  }
  return { width, height: rows.length, tiles };
}

const index = (g: Grid, x: number, y: number) => y * g.width + x;

describe('boardRelief', () => {
  it('puts a south-facing face in the tile below a ledge and shadow lines beside it', () => {
    const g = grid(['...', '.^.', '...']);
    const relief = boardRelief(g);
    expect(relief.get(index(g, 1, 2))?.faceDrop).toBe(1);
    expect(relief.get(index(g, 2, 1))?.westDrop).toBe(1);
    expect(relief.get(index(g, 0, 1))?.eastDrop).toBe(1);
    // The tile above the ledge has nothing to draw: the back of a ledge has no face.
    expect(relief.get(index(g, 1, 0))).toBeUndefined();
    // The ledge itself is rimmed on every side.
    expect(relief.get(index(g, 1, 1))?.rim).toEqual({ n: true, e: true, s: true, w: true });
  });

  it('measures a drop in tiers, and none between equals', () => {
    const g = grid(['AA', '^^', '..']);
    const relief = boardRelief(g);
    expect(relief.get(index(g, 0, 1))?.faceDrop).toBe(1);
    expect(relief.get(index(g, 0, 2))?.faceDrop).toBe(1);
    expect(relief.get(index(g, 0, 1))?.eastDrop).toBe(0);
    expect(relief.get(index(g, 0, 0))?.rim).toEqual({ n: false, e: false, s: true, w: false });
  });

  it('outlines only the open sides of a wall run and never a tree', () => {
    const g = grid(['.T.', '##.', '...']);
    const relief = boardRelief(g);
    expect(relief.get(index(g, 0, 1))?.solid).toEqual({ n: true, e: false, s: true, w: false });
    expect(relief.get(index(g, 1, 1))?.solid).toEqual({ n: true, e: true, s: true, w: false });
    expect(relief.get(index(g, 1, 0))).toBeUndefined();
    expect(isCanopy(g.tiles[index(g, 1, 0)] ?? tile())).toBe(true);
  });

  it('gives a pit its open edges too, so a wide pit has one far wall', () => {
    const g = grid(['...', 'PP.', '...']);
    const relief = boardRelief(g);
    expect(relief.get(index(g, 0, 1))?.solid).toEqual({ n: true, e: false, s: true, w: false });
    expect(relief.get(index(g, 1, 1))?.solid).toEqual({ n: true, e: true, s: true, w: false });
  });

  it('is empty for a flat open board', () => {
    expect(boardRelief(grid(['...', '...'])).size).toBe(0);
  });

  it('names the material each open edge meets, and nothing off the map', () => {
    const g = grid([',,', '=.', '..']);
    const roads = boardRelief(g).get(index(g, 0, 1));
    // Grass north, dirt east and south, and the map edge to the west.
    expect(roads?.seams).toEqual(['grass', 'dirt', 'dirt', null]);
    const grass = boardRelief(g).get(index(g, 1, 0));
    expect(grass?.seams).toEqual([null, null, 'dirt', null]);
    // The interior stays bare: two tiles of the same material need no join.
    expect(boardRelief(g).get(index(g, 1, 2))).toBeUndefined();
  });

  it('treats standing water as a material, so a pond gets a bank and the bank a wet rim', () => {
    const g = grid(['.~', '..']);
    expect(boardRelief(g).get(index(g, 1, 0))?.seams).toEqual([null, null, 'dirt', 'dirt']);
    expect(boardRelief(g).get(index(g, 0, 0))?.seams).toEqual([null, 'water', null, null]);
  });

  it('gives a blocked tile no join of its own, including a tree', () => {
    const g = grid([',T', '=,']);
    expect(boardRelief(g).get(index(g, 1, 0))).toBeUndefined();
  });
});

describe('surfaceEdges', () => {
  it('rims a pool only where it meets something else, and at the map edge', () => {
    const g = grid(['.~~', '.~.', '...']);
    expect(surfaceEdges(g, { x: 1, y: 0 })).toEqual({ n: true, e: false, s: false, w: true });
    expect(surfaceEdges(g, { x: 2, y: 0 })).toEqual({ n: true, e: true, s: true, w: false });
    expect(surfaceEdges(g, { x: 1, y: 1 })).toEqual({ n: false, e: true, s: true, w: true });
    expect(surfaceEdges(g, { x: 0, y: 0 })).toEqual({ n: false, e: false, s: false, w: false });
  });
});

describe('decor chunks', () => {
  it('cover the grid in squares of eight', () => {
    expect(decorChunks(grid(['...']))).toEqual({ cols: 1, rows: 1 });
    expect(decorChunks({ width: 20, height: 12, tiles: [] })).toEqual({ cols: 3, rows: 2 });
    expect(decorChunks({ width: 24, height: 16, tiles: [] })).toEqual({ cols: 3, rows: 2 });
  });

  it('change their signature with footing and with standing water, not with other surfaces', () => {
    const flat = grid(['..']);
    const wet = grid(['.~']);
    const muddy = grid(['.m']);
    const raised = grid(['.^']);
    expect(decorSignature(flat)).not.toBe(decorSignature(wet));
    expect(decorSignature(flat)).toBe(decorSignature(muddy));
    expect(decorSignature(flat)).not.toBe(decorSignature(raised));
  });
});
