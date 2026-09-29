import { describe, expect, it } from 'vitest';
import { mapSchema } from '../schemas';
import { LEGEND, LEGEND_KEYS } from './legend';

/**
 * The M1 legend additions. They are new keys only: `src/content/maps/*` maps
 * still draw every row from the same characters they always did, so adding a
 * key must not touch an existing tile.
 */
describe('map legend (M1 keys)', () => {
  it('resolves every new key to the authored tile', () => {
    expect(LEGEND.X).toEqual({ terrain: 'wall', elevation: 2, blocked: true, blocksSight: true });
    expect(LEGEND.W).toEqual({ terrain: 'water_deep', blocked: true, blocksSight: false });
    expect(LEGEND.G).toEqual({ terrain: 'wood', blocked: true, blocksSight: true });
    expect(LEGEND.R).toEqual({
      terrain: 'sand',
      elevation: 1,
      surface: 'rubble',
      surfaceDuration: -1,
    });
    expect(LEGEND.F).toEqual({ terrain: 'wood', blocked: true, blocksSight: false });
    expect(LEGEND.U).toEqual({ terrain: 'grass', blocked: true, blocksSight: true });
  });

  it('lists the new keys and keeps the pre-existing ones untouched', () => {
    for (const key of ['X', 'W', 'G', 'R', 'F', 'U']) {
      expect(LEGEND_KEYS, key).toContain(key);
      expect(LEGEND[key], key).toBeDefined();
    }
    // Spot checks across the sections: blockers, cover, elevation and surfaces.
    expect(LEGEND['#']).toEqual({ terrain: 'wall', blocked: true, blocksSight: true });
    expect(LEGEND.r).toEqual({ terrain: 'sand', surface: 'rubble', surfaceDuration: -1 });
    expect(LEGEND['^']).toEqual({ terrain: 'stone', elevation: 1 });
    expect(LEGEND.A).toEqual({ terrain: 'stone', elevation: 2 });
  });

  it('parses a map that draws every new key', () => {
    const parsed = mapSchema.safeParse({
      id: 'legend_probe',
      name: 'Legend probe',
      kind: 'combat',
      width: 4,
      height: 4,
      rows: ['XWGR', 'FUXW', 'GRFU', 'XWGR'],
      legend: LEGEND,
      partySpawns: [{ x: 0, y: 0 }],
      npcs: [],
      props: [],
      ambience: 'none',
    });
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
  });
});

/**
 * The E4 ramp. It shares tier 1 with `^` and only differs in the climb cost, so
 * the key itself changes no tile's terrain, elevation, blocking or cover.
 */
describe('map legend (E4 ramp key)', () => {
  it('resolves S to a tier-1 stone ramp', () => {
    expect(LEGEND.S).toEqual({ terrain: 'stone', elevation: 1, ramp: true });
    expect(LEGEND_KEYS).toContain('S');
  });

  it('parses a map that draws a ramp beside a bare tier step', () => {
    const parsed = mapSchema.safeParse({
      id: 'ramp_probe',
      name: 'Ramp probe',
      kind: 'combat',
      width: 4,
      height: 4,
      rows: ['..S^', '..,^', '....', '....'],
      legend: LEGEND,
      partySpawns: [{ x: 0, y: 0 }],
      npcs: [],
      props: [],
      ambience: 'none',
    });
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
  });
});
