import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { LEGEND } from '../../content/maps/legend';
import { RngCursor, seedFromString } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, MapDef, Tile, Vec2 } from '../types';
import { hasCoverBetween, screenCellFor } from './damage';
import {
  DEFAULT_TILE,
  buildGrid,
  cachedGrid,
  hasLineOfSight,
  lineBetween,
  posKey,
  tileAt,
  withSurface,
  withTile,
} from './grid';
import { obscurementFor } from './obscurement';

const SEED = 'issue-518-los-properties';
const RANDOM_CASES = 2400;
const REAL_CASES_PER_MAP = 150;
const WALL: Tile = { ...DEFAULT_TILE, blocked: true, blocksSight: true };

function openGrid(width: number, height: number): Grid {
  return {
    width,
    height,
    tiles: Array.from({ length: width * height }, () => ({ ...DEFAULT_TILE })),
  };
}

function authored(rows: readonly string[]): MapDef {
  return {
    id: 'los-property-fixture',
    name: 'LOS property fixture',
    kind: 'combat',
    width: rows[0]?.length ?? 0,
    height: rows.length,
    rows,
    legend: LEGEND,
    partySpawns: [],
    npcs: [],
    props: [],
    ambience: '',
  };
}

function randomPosition(rng: RngCursor, grid: Grid): Vec2 {
  return { x: rng.int(0, grid.width - 1), y: rng.int(0, grid.height - 1) };
}

function battleFixture() {
  const state = createGame(CONTENT, {
    seed: SEED,
    party: [{ characterId: 'kaya', level: 3 }],
    startNode: '',
  });
  return createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
}

/** Sample the ideal segment at each major-axis coordinate, rounding half a
 * minor-axis tile toward the destination. No incremental error/raster loop. */
function segmentInterior(from: Vec2, to: Vec2): Vec2[] {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const major = Math.max(dx, dy);
  const minor = Math.min(dx, dy);
  return Array.from({ length: Math.max(0, major - 1) }, (_, index) => {
    const step = index + 1;
    const rounded = Math.floor((2 * minor * step + major) / (2 * major));
    return {
      x: from.x + Math.sign(to.x - from.x) * (dx >= dy ? step : rounded),
      y: from.y + Math.sign(to.y - from.y) * (dx >= dy ? rounded : step),
    };
  });
}

function hasMidpointTie(from: Vec2, to: Vec2): boolean {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const major = Math.max(dx, dy);
  const minor = Math.min(dx, dy);
  for (let step = 1; step < major; step++) {
    if (2 * ((minor * step) % major) === major) return true;
  }
  return false;
}

function segmentSight(grid: Grid, from: Vec2, to: Vec2): boolean {
  return segmentInterior(from, to).every((cell) => {
    const tile = tileAt(grid, cell);
    return tile !== undefined && !tile.blocksSight;
  });
}

/** Geometry checks use the ideal segment, not a second copy of Bresenham. */
function checkRaster(from: Vec2, to: Vec2, cells: readonly Vec2[]): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const span = Math.max(Math.abs(dx), Math.abs(dy));
  expect(cells).toHaveLength(Math.max(0, span - 1));
  expect(new Set(cells.map(posKey)).size).toBe(cells.length);
  const geometry = {
    adjacent: true,
    integer: true,
    bounded: true,
    forward: true,
    nearSegment: true,
  };
  let previous = from;
  for (const cell of [...cells, to]) {
    geometry.adjacent &&=
      Math.max(Math.abs(cell.x - previous.x), Math.abs(cell.y - previous.y)) ===
      (span === 0 ? 0 : 1);
    geometry.integer &&= Number.isInteger(cell.x) && Number.isInteger(cell.y);
    geometry.bounded &&=
      cell.x >= Math.min(from.x, to.x) &&
      cell.x <= Math.max(from.x, to.x) &&
      cell.y >= Math.min(from.y, to.y) &&
      cell.y <= Math.max(from.y, to.y);
    // No backwards steps; the line stays within half a minor-axis tile of
    // the ideal segment at every major-axis coordinate, including ties.
    geometry.forward &&= (cell.x - previous.x) * dx >= 0 && (cell.y - previous.y) * dy >= 0;
    geometry.nearSegment &&= 2 * Math.abs(dx * (cell.y - from.y) - dy * (cell.x - from.x)) <= span;
    previous = cell;
  }
  expect(geometry, `${posKey(from)} -> ${posKey(to)}`).toEqual({
    adjacent: true,
    integer: true,
    bounded: true,
    forward: true,
    nearSegment: true,
  });
  expect(cells.every((cell) => posKey(cell) !== posKey(from) && posKey(cell) !== posKey(to))).toBe(
    true,
  );
}

describe('seeded line-of-sight properties', () => {
  it('pins midpoint choices in all eight octants, axes, and translated negative coordinates', () => {
    const canaries: readonly { to: Vec2; cells: readonly (readonly [number, number])[] }[] = [
      {
        to: { x: 6, y: 3 },
        cells: [
          [1, 1],
          [2, 1],
          [3, 2],
          [4, 2],
          [5, 3],
        ],
      },
      {
        to: { x: 6, y: -3 },
        cells: [
          [1, -1],
          [2, -1],
          [3, -2],
          [4, -2],
          [5, -3],
        ],
      },
      {
        to: { x: 3, y: 6 },
        cells: [
          [1, 1],
          [1, 2],
          [2, 3],
          [2, 4],
          [3, 5],
        ],
      },
      {
        to: { x: 3, y: -6 },
        cells: [
          [1, -1],
          [1, -2],
          [2, -3],
          [2, -4],
          [3, -5],
        ],
      },
      {
        to: { x: -6, y: 3 },
        cells: [
          [-1, 1],
          [-2, 1],
          [-3, 2],
          [-4, 2],
          [-5, 3],
        ],
      },
      {
        to: { x: -6, y: -3 },
        cells: [
          [-1, -1],
          [-2, -1],
          [-3, -2],
          [-4, -2],
          [-5, -3],
        ],
      },
      {
        to: { x: -3, y: 6 },
        cells: [
          [-1, 1],
          [-1, 2],
          [-2, 3],
          [-2, 4],
          [-3, 5],
        ],
      },
      {
        to: { x: -3, y: -6 },
        cells: [
          [-1, -1],
          [-1, -2],
          [-2, -3],
          [-2, -4],
          [-3, -5],
        ],
      },
      {
        to: { x: 4, y: 0 },
        cells: [
          [1, 0],
          [2, 0],
          [3, 0],
        ],
      },
      {
        to: { x: 0, y: 4 },
        cells: [
          [0, 1],
          [0, 2],
          [0, 3],
        ],
      },
      {
        to: { x: 5, y: 2 },
        cells: [
          [1, 0],
          [2, 1],
          [3, 1],
          [4, 2],
        ],
      },
      {
        to: { x: 3, y: 3 },
        cells: [
          [1, 1],
          [2, 2],
        ],
      },
    ];
    for (const offset of [
      { x: 0, y: 0 },
      { x: -9, y: -11 },
    ]) {
      for (const canary of canaries) {
        const from = offset;
        const to = { x: offset.x + canary.to.x, y: offset.y + canary.to.y };
        const expected = canary.cells.map(([x, y]) => ({ x: x + offset.x, y: y + offset.y }));
        expect(lineBetween(from, to)).toEqual(expected);
        expect(segmentInterior(from, to)).toEqual(expected);
        expect(lineBetween(to, from)).toEqual(segmentInterior(to, from));
        checkRaster(from, to, expected);
      }
    }
    // Each independently pinned interior cell must block on its own. These
    // cases cannot pass by choosing the blocker from a faulty production line.
    for (const canary of canaries) {
      const from = { x: 7, y: 7 };
      const to = { x: from.x + canary.to.x, y: from.y + canary.to.y };
      const open = openGrid(15, 15);
      expect(hasLineOfSight(open, from, to)).toBe(true);
      for (const [x, y] of canary.cells) {
        const wall = withTile(open, { x: from.x + x, y: from.y + y }, WALL);
        expect(hasLineOfSight(wall, from, to)).toBe(false);
        expect(hasLineOfSight(wall, to, from)).toBe(segmentSight(wall, to, from));
      }
    }
  });

  it('pins ADR 0105 directional ties on a 3x2 grid, with strict endpoint exclusion', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 2, y: 1 };
    const open = openGrid(3, 2);
    const wall = withTile(open, { x: 1, y: 1 }, WALL);
    expect(lineBetween(from, to)).toEqual([{ x: 1, y: 1 }]);
    expect(lineBetween(to, from)).toEqual([{ x: 1, y: 0 }]);
    expect(hasLineOfSight(open, from, to)).toBe(true);
    expect(hasLineOfSight(wall, from, to)).toBe(false);
    expect(hasLineOfSight(wall, to, from)).toBe(true);
    const endpoints = withTile(withTile(open, from, WALL), to, WALL);
    expect(hasLineOfSight(endpoints, from, to)).toBe(true);
    expect(hasLineOfSight(endpoints, to, from)).toBe(true);
    // The other tie-adjacent tile is not merged into a wider, double-counted ray.
    expect(hasLineOfSight(withTile(open, { x: 1, y: 0 }, WALL), from, to)).toBe(true);
    expect(hasLineOfSight(withTile(open, { x: 1, y: 0 }, WALL), to, from)).toBe(false);
  });

  it('sees self and all eight neighbours even when every tile blocks sight', () => {
    const grid = { ...openGrid(7, 7), tiles: Array.from({ length: 49 }, () => WALL) };
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const from = { x, y };
        expect(lineBetween(from, from)).toEqual([]);
        expect(hasLineOfSight(grid, from, from)).toBe(true);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const to = { x: x + dx, y: y + dy };
            if (!tileAt(grid, to)) continue;
            expect(lineBetween(from, to)).toEqual([]);
            expect(hasLineOfSight(grid, from, to)).toBe(true);
          }
        }
      }
    }
  });

  it('checks >=2,000 unfiltered random and authored-map cases with actual prop baking', () => {
    const rng = new RngCursor(seedFromString(SEED));
    const fixture = { ...battleFixture(), props: [] };
    const barrel = CONTENT.props.get('water_barrel');
    if (!barrel) throw new Error('Missing authored water barrel');
    expect([barrel.blocksMove, barrel.blocksSight, barrel.grantsCover]).toEqual([
      true,
      false,
      true,
    ]);
    const maps = [...CONTENT.maps.values()];
    expect(maps.map((map) => map.id)).toEqual(
      expect.arrayContaining([
        'ambush_road',
        'forest_road',
        'quarry_floor',
        'quarry_gate',
        'ba_dan_village',
        'ba_dan_riverside',
      ]),
    );
    let cases = 0;
    let clear = 0;
    let blocked = 0;
    let wallFlips = 0;
    let clearInteriorProps = 0;
    let blockedInteriorProps = 0;
    let opaquePropTiles = 0;
    let tieCases = 0;
    let noTieCases = 0;
    let asymmetricSight = 0;
    const octants = new Set<string>();

    const check = (grid: Grid, from: Vec2, to: Vec2): void => {
      cases++;
      const cells = lineBetween(from, to);
      checkRaster(from, to, cells);
      expect(cells).toEqual(segmentInterior(from, to));
      expect(lineBetween(to, from)).toEqual(segmentInterior(to, from));
      const result = hasLineOfSight(grid, from, to);
      const reverseResult = hasLineOfSight(grid, to, from);
      expect(result).toBe(segmentSight(grid, from, to));
      expect(reverseResult).toBe(segmentSight(grid, to, from));
      if (hasMidpointTie(from, to)) {
        tieCases++;
        expect(lineBetween(to, from)).not.toEqual([...cells].reverse());
      } else {
        noTieCases++;
        expect(lineBetween(to, from)).toEqual([...cells].reverse());
        expect(reverseResult).toBe(result);
      }
      if (result !== reverseResult) asymmetricSight++;
      if (result) clear++;
      else blocked++;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
        octants.add(`${Math.sign(dx)},${Math.sign(dy)},${Math.abs(dx) > Math.abs(dy)}`);
      }

      // Clear only sight flags, preserving the generated/authored elevations,
      // surfaces and movement blockers. This guarantees a true starting line.
      const opened = {
        ...grid,
        tiles: grid.tiles.map((tile) => ({ ...tile, blocksSight: false })),
      };
      expect(hasLineOfSight(opened, from, to)).toBe(true);
      if (cells.length > 0) {
        const chosen = rng.pick(cells);
        const old = tileAt(opened, chosen);
        if (!old) throw new Error('Raster left the endpoint bounding box');
        const oneWall = withTile(opened, chosen, { ...old, blocksSight: true });
        expect(hasLineOfSight(oneWall, from, to)).toBe(false);
        expect(hasLineOfSight(oneWall, to, from)).toBe(segmentSight(oneWall, to, from));
        const wallTiles = opened.tiles.slice();
        for (const cell of cells) {
          const tile = tileAt(opened, cell);
          if (!tile) throw new Error('Missing interior tile');
          wallTiles[cell.y * opened.width + cell.x] = { ...tile, blocksSight: true };
        }
        const allWalls = { ...opened, tiles: wallTiles };
        expect(hasLineOfSight(allWalls, from, to)).toBe(false);
        expect(hasLineOfSight(allWalls, to, from)).toBe(segmentSight(allWalls, to, from));
        wallFlips++;
      }

      // Use the real prop code and authored definition. The fence itself is
      // authored as LEGEND.F, exercised through buildGrid in the next test.
      const pos = cells.length > 0 ? rng.pick(cells) : from;
      const previous = tileAt(grid, pos);
      if (!previous) throw new Error('Missing prop tile');
      if (cells.length > 0) {
        if (result) clearInteriorProps++;
        else blockedInteriorProps++;
        if (previous.blocksSight) opaquePropTiles++;
      }
      const draft = new BattleDraft(CONTENT, { ...fixture, grid }, new RngCursor(17));
      const prop = draft.placeProp(barrel.id, pos);
      expect(prop).toEqual({
        id: `prop${fixture.nextUnitSerial}`,
        propId: barrel.id,
        pos,
        hp: barrel.hp,
        previous,
      });
      expect(draft.props).toEqual([prop]);
      expect(tileAt(draft.grid, pos)).toEqual({ ...previous, blocked: true, cover: true });
      expect(tileAt(grid, pos)).toBe(previous);
      expect(fixture.props).toEqual([]);
      expect(hasLineOfSight(draft.grid, from, to)).toBe(result);
      expect(hasLineOfSight(draft.grid, to, from)).toBe(reverseResult);
      // Interleave grids with opposite answers before rechecking the original.
      expect(hasLineOfSight(opened, from, to)).toBe(true);
      expect(hasLineOfSight(grid, from, to)).toBe(result);
      expect(lineBetween(from, to)).toEqual(cells);
    };

    for (let i = 0; i < RANDOM_CASES; i++) {
      const width = rng.int(3, 18);
      const height = rng.int(3, 18);
      const grid: Grid = {
        width,
        height,
        tiles: Array.from({ length: width * height }, () => ({
          ...DEFAULT_TILE,
          blocked: rng.chance(0.35),
          blocksSight: rng.chance(0.25),
          cover: rng.chance(0.3),
          elevation: rng.int(0, 3),
        })),
      };
      check(grid, randomPosition(rng, grid), randomPosition(rng, grid));
    }
    for (const map of maps) {
      const grid = buildGrid(map);
      const cached = cachedGrid(map);
      expect(cached).toEqual(grid);
      for (let i = 0; i < REAL_CASES_PER_MAP; i++) {
        check(i % 2 === 0 ? grid : cached, randomPosition(rng, grid), randomPosition(rng, grid));
      }
      expect(cachedGrid(map)).toBe(cached);
      expect(cached).toEqual(grid);
    }
    expect(cases).toBe(RANDOM_CASES + maps.length * REAL_CASES_PER_MAP);
    expect(cases).toBeGreaterThanOrEqual(2000);
    expect(clear).toBeGreaterThan(100);
    expect(blocked).toBeGreaterThan(100);
    expect(wallFlips).toBeGreaterThan(2000);
    expect(clearInteriorProps).toBeGreaterThan(100);
    expect(blockedInteriorProps).toBeGreaterThan(100);
    expect(opaquePropTiles).toBeGreaterThan(100);
    expect(tieCases).toBeGreaterThan(100);
    expect(noTieCases).toBeGreaterThan(100);
    expect(asymmetricSight).toBeGreaterThan(10);
    expect(octants.size).toBe(8);
  }, 10_000);

  it('keeps real fence tiles transparent and cached maps isolated by object identity', () => {
    expect(LEGEND.F).toEqual({ terrain: 'wood', blocked: true, blocksSight: false, cover: true });
    const clearMap = authored(['.....', '.F...', '.....']);
    const blockedMap = authored(['.....', '.F.#.', '.....']);
    const clearGrid = cachedGrid(clearMap);
    const blockedGrid = cachedGrid(blockedMap);
    expect(clearGrid).not.toBe(blockedGrid);
    expect(tileAt(clearGrid, { x: 1, y: 1 })).toEqual({
      ...DEFAULT_TILE,
      terrain: 'wood',
      blocked: true,
      cover: true,
    });
    const from = { x: 0, y: 1 };
    const to = { x: 4, y: 1 };
    for (let i = 0; i < 64; i++) {
      expect(cachedGrid(clearMap)).toBe(clearGrid);
      expect(hasLineOfSight(clearGrid, from, to)).toBe(true);
      expect(cachedGrid(blockedMap)).toBe(blockedGrid);
      expect(hasLineOfSight(blockedGrid, from, to)).toBe(false);
      expect(hasLineOfSight(clearGrid, to, from)).toBe(true);
      expect(hasLineOfSight(blockedGrid, to, from)).toBe(false);
    }
    for (const rows of [
      ['.....', '.....', '.....'],
      ['.....', '...#.', '.....'],
    ]) {
      const before = buildGrid(authored(rows));
      const withFence = buildGrid(
        authored(rows.map((row, y) => (y === 1 ? `.F${row.slice(2)}` : row))),
      );
      expect(hasLineOfSight(withFence, from, to)).toBe(hasLineOfSight(before, from, to));
      expect(hasLineOfSight(withFence, to, from)).toBe(hasLineOfSight(before, to, from));
    }
    // Missing interior tiles block in both directions; missing endpoints remain excluded.
    const short: Grid = { width: 3, height: 2, tiles: [DEFAULT_TILE] };
    expect(hasLineOfSight(short, { x: 0, y: 0 }, { x: 2, y: 1 })).toBe(false);
    expect(hasLineOfSight(short, { x: 2, y: 1 }, { x: 0, y: 0 })).toBe(false);
    expect(hasLineOfSight(short, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true);
  });

  it('preserves source-to-target order for defender-side cover and the shared cloud path', () => {
    const fixture = battleFixture();
    const party = fixture.units.find((unit) => unit.faction === 'party');
    const enemy = fixture.units.find((unit) => unit.faction === 'enemy');
    if (!party || !enemy) throw new Error('Missing fixture units');
    const from = { x: 0, y: 0 };
    const to = { x: 6, y: 3 };
    const nearFrom = { x: 1, y: 0 };
    const nearTo = { x: 5, y: 3 };
    expect(screenCellFor(from, to)).toEqual(nearTo);
    expect(screenCellFor(to, from)).toEqual(nearFrom);
    const open = openGrid(7, 4);
    const cover = withTile(open, nearTo, { ...DEFAULT_TILE, cover: true });
    const attacker = { ...party, pos: from, size: 1 as const };
    const defender = { ...enemy, pos: to, size: 1 as const };
    const units = [attacker, defender];
    expect(hasCoverBetween(CONTENT, cover, defender, true, { origin: from, attacker, units })).toBe(
      true,
    );
    expect(
      hasCoverBetween(CONTENT, cover, attacker, true, {
        origin: to,
        attacker: defender,
        units,
      }),
    ).toBe(false);
    const steam = CONTENT.surfaces.get('steam');
    if (!steam?.obscures) throw new Error('Missing authored steam obscurement');
    const cloud = withSurface(open, { x: 1, y: 1 }, { id: 'steam', duration: 2, spread: 0 });
    expect(obscurementFor(CONTENT, cloud, attacker, defender, 0).through).toBe(
      steam.obscures.through,
    );
    expect(obscurementFor(CONTENT, cloud, defender, attacker, 0).through).toBe(0);
    const reverseCloud = withSurface(open, nearFrom, { id: 'steam', duration: 2, spread: 0 });
    expect(obscurementFor(CONTENT, reverseCloud, attacker, defender, 0).through).toBe(0);
    expect(obscurementFor(CONTENT, reverseCloud, defender, attacker, 0).through).toBe(
      steam.obscures.through,
    );
    const offLine = withSurface(open, { x: 3, y: 0 }, { id: 'steam', duration: 2, spread: 0 });
    expect(obscurementFor(CONTENT, offLine, attacker, defender, 0).through).toBe(0);
    expect(obscurementFor(CONTENT, offLine, defender, attacker, 0).through).toBe(0);
    // Results own their arrays: a caller reversing one cannot poison later calls.
    lineBetween(to, from).reverse();
    expect(screenCellFor(to, from)).toEqual(nearFrom);
  });
});
