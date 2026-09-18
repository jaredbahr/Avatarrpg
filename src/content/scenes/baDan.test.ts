import { expect, it } from 'vitest';
import { BA_DAN_VILLAGE } from '../maps/village';
import { BA_DAN_POND, BA_DAN_COURTYARD_FOOTPRINTS } from './baDan';
import { buildGrid, reachable, posKey, tileAt } from '../../core/rules/grid';

it('keeps painted low boundaries solid while preserving every village destination', () => {
  const map = BA_DAN_VILLAGE;
  const grid = buildGrid(map);
  for (const p of BA_DAN_COURTYARD_FOOTPRINTS) {
    expect(tileAt(grid, p)).toMatchObject({ blocked: true, blocksSight: false });
    expect(
      map.scene?.scenery.some((s) => s.footprint.some((f) => f.x === p.x && f.y === p.y)),
    ).toBe(true);
  }
  const start = map.partySpawns[0];
  if (!start) throw new Error('Village has no spawn');
  const paths = reachable({ grid, blocked: new Set(), surfaces: new Map(), size: 1 }, start, 1000);
  for (const p of [...map.npcs.map((npc) => npc.pos), { x: 9, y: 4 }, { x: 23, y: 7 }])
    expect(paths.has(posKey(p)), `Unreachable village destination ${posKey(p)}`).toBe(true);
});

it('registers the painted pond to every actual permanent-water cell', () => {
  const painted: string[] = [];
  for (let y = BA_DAN_POND.y; y < BA_DAN_POND.y + BA_DAN_POND.height; y++) {
    for (let x = BA_DAN_POND.x; x < BA_DAN_POND.x + BA_DAN_POND.width; x++) {
      painted.push(`${x},${y}`);
    }
  }
  const actual = BA_DAN_VILLAGE.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) =>
      BA_DAN_VILLAGE.legend[key]?.surface === 'water' ? [`${x},${y}`] : [],
    ),
  );
  expect(painted).toEqual(actual);
});
