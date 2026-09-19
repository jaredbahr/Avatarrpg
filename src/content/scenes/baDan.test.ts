import { expect, it } from 'vitest';
import { BA_DAN_VILLAGE } from '../maps/village';
import {
  BA_DAN_CANAL,
  BA_DAN_WATER_CELLS,
  BA_DAN_CANAL_BRIDGE,
  BA_DAN_CANAL_BANKS,
  BA_DAN_COURTYARD_GROUND,
  BA_DAN_COURTYARD_FOOTPRINTS,
  BA_DAN_COURT_TREES,
  BA_DAN_SCENE,
} from './baDan';
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

it('registers the painted canal to every actual permanent-water cell', () => {
  const painted = BA_DAN_WATER_CELLS.map(({ x, y }) => `${x},${y}`);
  const actual = BA_DAN_VILLAGE.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) =>
      BA_DAN_VILLAGE.legend[key]?.surface === 'water' ? [`${x},${y}`] : [],
    ),
  );
  expect(painted).toEqual(actual);
  expect(BA_DAN_CANAL).toMatchObject({ x: 6, y: 6, width: 7, height: 1 });
  expect(BA_DAN_VILLAGE.rows[BA_DAN_CANAL_BRIDGE.y]?.[BA_DAN_CANAL_BRIDGE.x]).toBe('=');
});

it('keeps the canal walkable and registers one low bridge at the dry crossing', () => {
  const grid = buildGrid(BA_DAN_VILLAGE);
  for (const pos of BA_DAN_WATER_CELLS) expect(tileAt(grid, pos)?.blocked).not.toBe(true);
  const bridge = BA_DAN_VILLAGE.scene?.scenery.find((piece) => piece.id === 'canal-bridge');
  const bridgeFront = BA_DAN_VILLAGE.scene?.scenery.find(
    (piece) => piece.id === 'canal-bridge-front',
  );
  expect(bridge).toMatchObject({
    footprint: [BA_DAN_CANAL_BRIDGE],
    width: 192,
    height: 121.125,
  });
  expect(bridge?.x).toBe(1120);
  expect(bridge?.y).toBe(451.4375);
  expect(bridge?.depth).toEqual({ x: 9.5, y: 6.25 });
  expect(bridgeFront).toMatchObject({
    url: 'art/maps/ba-dan-scene/canal-bridge-front.webp',
    footprint: [BA_DAN_CANAL_BRIDGE],
    depth: { x: 9.5, y: 6.75 },
    x: bridge?.x,
    y: bridge?.y,
    width: bridge?.width,
    height: bridge?.height,
  });
  expect(bridge?.fadeWhenOccluding).toBeUndefined();
});

it('uses transparent localized canal banks while the grid owns permanent water', () => {
  expect(BA_DAN_SCENE.groundMode).toBe('partial');
  expect(BA_DAN_SCENE.ground).toContainEqual({
    url: 'art/maps/ba-dan-scene/courtyard-ground.webp',
    ...BA_DAN_COURTYARD_GROUND,
  });
  expect(BA_DAN_SCENE.ground.some((piece) => piece.url.endsWith('/ground-west.webp'))).toBe(false);
  expect(BA_DAN_SCENE.ground.some((piece) => piece.url.endsWith('/ground-east.webp'))).toBe(false);
  const canal = BA_DAN_SCENE.ground.find((piece) => piece.url.endsWith('/canal-banks.webp'));
  expect(canal).toMatchObject(BA_DAN_CANAL_BANKS);
  expect(BA_DAN_SCENE.paintedWater).toBeUndefined();
  expect(BA_DAN_SCENE.ground.some((piece) => piece.url.endsWith('/canal.webp'))).toBe(false);
  expect(BA_DAN_SCENE.ground.some((piece) => piece.url.endsWith('/pond.webp'))).toBe(false);
});

it('covers the projected courtyard and southeast canal bank without clipping', () => {
  const projected = [
    { x: 5, y: 3 },
    { x: 15, y: 3 },
    { x: 5, y: 11 },
    { x: 15, y: 11 },
  ].map(({ x, y }) => ({
    x: 1024 + (x - y) * 64,
    y: (x + y) * 32,
  }));
  for (const point of projected) {
    expect(point.x).toBeGreaterThanOrEqual(BA_DAN_COURTYARD_GROUND.x);
    expect(point.y).toBeGreaterThanOrEqual(BA_DAN_COURTYARD_GROUND.y);
    expect(point.x).toBeLessThanOrEqual(BA_DAN_COURTYARD_GROUND.x + BA_DAN_COURTYARD_GROUND.width);
    expect(point.y).toBeLessThanOrEqual(BA_DAN_COURTYARD_GROUND.y + BA_DAN_COURTYARD_GROUND.height);
  }
  expect(BA_DAN_CANAL_BANKS.x + BA_DAN_CANAL_BANKS.width).toBeLessThanOrEqual(
    BA_DAN_COURTYARD_GROUND.x + BA_DAN_COURTYARD_GROUND.width,
  );
  expect(BA_DAN_CANAL_BANKS.y + BA_DAN_CANAL_BANKS.height).toBeLessThanOrEqual(
    BA_DAN_COURTYARD_GROUND.y + BA_DAN_COURTYARD_GROUND.height,
  );
});

it('keeps court trunks solid and both shop doors and village routes reachable', () => {
  const map = BA_DAN_VILLAGE;
  const grid = buildGrid(map);
  const start = map.partySpawns[0];
  if (!start) throw new Error('Village has no spawn');
  const paths = reachable({ grid, blocked: new Set(), surfaces: new Map(), size: 1 }, start, 1000);
  for (const pos of BA_DAN_COURT_TREES) {
    expect(tileAt(grid, pos)?.blocked).toBe(true);
    expect(paths.has(posKey(pos))).toBe(false);
    expect(map.scene?.scenery.find((s) => s.id === `tree-${pos.x}-${pos.y}`)).toMatchObject({
      footprint: [pos],
      depth: pos,
      width: 320,
      fadeWhenOccluding: true,
    });
  }
  for (const pos of [
    ...map.npcs.map((npc) => npc.pos),
    { x: 9, y: 3 },
    { x: 11, y: 3 },
    { x: 23, y: 7 },
    { x: 19, y: 14 },
    { x: 5, y: 6 },
    { x: 17, y: 6 },
  ])
    expect(paths.has(posKey(pos)), `Unreachable court destination ${posKey(pos)}`).toBe(true);
  for (const y of [7, 8]) {
    for (let x = 0; x < map.width; x++) expect(tileAt(grid, { x, y })?.blocked).not.toBe(true);
  }
});
