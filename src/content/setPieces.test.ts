import { describe, expect, it } from 'vitest';
import { OLD_VILLAGE_ROWS } from './maps/oldVillage.fixture';
import { BA_DAN_VILLAGE } from './maps/village';
import { LEGEND } from './maps/legend';
import { BA_DAN_DRESSING_PLAN } from './maps/oldVillage.dressing.fixture';
import { BA_DAN_TOPDOWN_OBJECTS } from './scenes/baDan.topdown';
import { validateDressing, type DressingPlan } from './setPieces';
import type { TopDownObject } from './topdownLayout';

const blocked = (x: number, y: number): boolean => {
  // The dressing plan was drawn to the old 24 x 16 rows; the live village is a blockout until its dressing stage.
  const ch = OLD_VILLAGE_ROWS[y]?.[x];
  if (ch === undefined) return true;
  const def = BA_DAN_VILLAGE.legend?.[ch] ?? LEGEND[ch];
  return def ? def.blocked === true : true;
};

describe('the placement grammar (ADR 0119)', () => {
  it('holds Ba Dan square to its design: purposes, hugging, clear paths, quiet ground, one focus a zone', () => {
    expect(validateDressing(BA_DAN_DRESSING_PLAN, BA_DAN_TOPDOWN_OBJECTS, blocked)).toEqual([]);
  });

  const prop = (id: string, x: number, base: number, cells: [number, number][]): TopDownObject => ({
    id,
    sprite: 'crate',
    kind: 'prop',
    x,
    base,
    footprint: cells.map(([cx, cy]) => ({ x: cx, y: cy })),
    solid: true,
    depth: { x: x / 40, y: base / 40 },
  });
  const objects = [
    prop('house', 60, 80, [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ]),
    prop('barrel', 140, 120, [[3, 2]]),
    prop('lamp-a', 20, 300, [[0, 7]]),
    prop('lamp-b', 100, 300, [[2, 7]]),
    prop('lamp-c', 220, 300, [[5, 7]]),
    prop('stray', 300, 200, [[7, 4]]),
  ];
  const plan: DressingPlan = {
    mapId: 'fixture',
    scope: { x0: 0, y0: 0, x1: 9, y1: 9 },
    setPieces: [
      {
        id: 'home',
        purpose: 'a house',
        anchor: 'house',
        satellites: ['barrel'],
        aprons: [],
        focal: true,
      },
      {
        id: 'lamps',
        purpose: 'lamps',
        anchor: 'lamp-a',
        satellites: ['lamp-b', 'lamp-c'],
        run: true,
        aprons: [],
      },
    ],
    paths: [{ id: 'lane', cells: [{ x: 7, y: 4 }] }],
    quiet: [{ x0: 6, y0: 3, x1: 8, y1: 5 }],
    zones: [
      { id: 'north', rect: { x0: 0, y0: 0, x1: 9, y1: 3 } },
      { id: 'south', rect: { x0: 0, y0: 6, x1: 9, y1: 9 } },
    ],
  };

  it('names a prop no set piece explains, one on a path or in quiet ground, and a zone without one focus', () => {
    expect(validateDressing(plan, objects, () => false)).toEqual([
      'dressing "fixture": run "lamps" is unevenly spaced (80, 120 px)',
      'dressing "fixture": prop "stray" belongs to no set piece',
      'dressing "fixture": path "lane" runs under "stray" at (7,4)',
      'dressing "fixture": "stray" stands in quiet ground (6,3)-(8,5)',
      'dressing "fixture": zone "south" has 0 focal set pieces (none), not one',
    ]);
  });

  it('names a satellite left out on the open ground, away from what it serves', () => {
    const far = objects.map((o) => (o.id === 'barrel' ? { ...o, footprint: [{ x: 6, y: 2 }] } : o));
    expect(validateDressing(plan, far, () => false)).toContain(
      'dressing "fixture": "barrel" stands 4 cells from its anchor "house" (at most 2)',
    );
  });
});
