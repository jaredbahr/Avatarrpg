/**
 * The quarry's top-down boards (ADR 0104 T5, #470) are the approved prototype's quarry bake
 * (`tutorial-demo.html`, `src/b3/world_quarry.js` `bakeQuarry`):
 *
 * - the tiles are the page's own embedded `qtiles`, pixel for pixel;
 * - with the terrain's guard off, the port is the prototype's own bake to the byte: the prototype's
 *   source runs here against a canvas stand-in and the two plates and class maps are compared;
 * - with the guard on (what ships), the rules win: no walkable cell's centre or standing box is the
 *   void, a cliff, a pit, a cut face or rock (a face may hang over a cell's top 13 px), every rock
 *   cell the rules block is rock, the Cutting's pool lies on its `~` cells and the Driller floor's
 *   pit on its `P` cells; the only cells still open to an object are the blocked floor cells the
 *   boards' object layouts fill.
 *
 * The generic checks (byte-stable bakes, `--check`, lossless pages, straight edges) run for every
 * board in `pack-ground.test.ts`; this reports the bake against the `topdown` 6 MiB family budget.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { PNG } from 'pngjs';
import { describe, expect, it, vi } from 'vitest';
import { validateTopDownLayout } from '../../../src/content/schemas';
import {
  AMBUSH_ROAD,
  COMBAT_MAPS,
  QUARRY_FLOOR,
  QUARRY_GATE,
} from '../../../src/content/maps/combat';
import type { MapScene } from '../../../src/core/types';
import { TOPDOWN_SCENES } from '../../../src/content/topdown';
import {
  CUTTING_TOPDOWN_LAYOUT,
  QUARRY_FLOOR_TOPDOWN_LAYOUT,
  QUARRY_GATE_TOPDOWN_LAYOUT,
} from '../../../src/content/topdownLayouts';
import { QUARRY_DEVIATIONS, QUARRY_SPRITE_SIZE } from '../../../src/content/scenes/quarry.topdown';
import {
  CELL,
  GRID,
  PLATE_H,
  PLATE_W,
  QUARRY,
  QUARRY_TERRAINS,
  classifyQuarry,
  groundOf,
  quarryGround,
  quarryTerrain,
  type QuarryTerrainConfig,
} from '../../../src/content/scenes/quarry.topdown.terrain';
import type { RgbaImage } from '../../../src/render/shadow/hardShadowMask';
import { bakePlate, mirror, quarryObject, quarryTiles, QUARRY_BOARDS } from './boards/quarry';
import { sceneFile } from './lib/board';

vi.setConfig({ testTimeout: 300_000 });

const PAGE = readFileSync('prototypes/topdown/tutorial-demo.html', 'utf8');
const SRC = 'prototypes/topdown/src/b3';
const TILES = quarryTiles();

/** A tile the page embeds in its board's `qtiles` (the board document is a JSON string in the page). */
function embedded(name: string): PNG {
  const match = new RegExp(
    `\\\\"${name}\\\\": \\\\"data:image/png;base64,([A-Za-z0-9+/=]+)\\\\"`,
  ).exec(PAGE);
  if (!match?.[1]) throw new Error(`tutorial-demo.html embeds no quarry tile "${name}"`);
  return PNG.sync.read(Buffer.from(match[1], 'base64'));
}

/**
 * The prototype's own bake, run from its source: `levels.js` (the rows and the legend) and
 * `world_quarry.js`, with the page's globals, its hash and noise (`head.js`), and a canvas stand-in
 * that does what the page's canvas does with opaque pixels (`putImageData`, `fillRect`, and reading
 * a tile back).
 */
function prototypeBake(config: QuarryTerrainConfig): {
  plate: Uint8ClampedArray;
  cls: Uint8Array;
  lev: Int8Array;
  face: Uint8Array;
} {
  const head = readFileSync(`${SRC}/head.js`, 'utf8');
  const noise = head.slice(head.indexOf('const hash2'), head.indexOf('// tell the tutorial shell'));
  const plate = new Uint8ClampedArray(PLATE_W * PLATE_H * 4);
  const ctx = {
    imageSmoothingEnabled: false,
    fillStyle: '#000000',
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (id: { data: Uint8ClampedArray }) => plate.set(id.data),
    fillRect(x: number, y: number, w: number, h: number) {
      const c = [1, 3, 5].map((i) => parseInt(this.fillStyle.slice(i, i + 2), 16));
      for (let Y = Math.max(0, y); Y < Math.min(PLATE_H, y + h); Y++)
        for (let X = Math.max(0, x); X < Math.min(PLATE_W, x + w); X++)
          plate.set([c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, 255], (Y * PLATE_W + X) * 4);
    },
  };
  const IMG: Record<string, { width: number; height: number; data: Uint8ClampedArray }> = {};
  for (const [k, t] of TILES) IMG[`q:${k}`] = t;
  const document = {
    createElement: () => {
      let im: RgbaImage | undefined;
      return {
        getContext: () => ({
          drawImage: (i: RgbaImage) => (im = i),
          getImageData: () => ({ data: im?.data }),
        }),
      };
    },
  };
  const level = config.level;
  const code = [
    readFileSync(`${SRC}/levels.js`, 'utf8'),
    'const T = 32, CS = 40, GW = 20, GH = 12, GX = 80, GY = 128, PW = 960, PH = 680;',
    `const LEVEL_KEY = ${JSON.stringify(level)}, LV = LEVELS[LEVEL_KEY], ROWS = LV.rows;`,
    "const LEG = c => LEGEND[c] || LEGEND['.'];",
    "const GR = ['#243d33', '#35593f', '#4f7d4a', '#7aa05a', '#a9c46f', '#c9d98a'];",
    noise,
    readFileSync(`${SRC}/world_quarry.js`, 'utf8'),
    'const __b = bakeQuarry(); __out.cls = __b.cls; __out.lev = __b.lev; __out.face = __b.face; __out.rows = ROWS;',
  ].join('\n');
  const out: Record<string, unknown> = {};
  runInNewContext(code, {
    __out: out,
    ASSETS: { qtiles_nvar: 16 },
    IMG,
    document,
    ground: { getContext: () => ctx },
    Math,
    Uint8Array,
    Int8Array,
    Float32Array,
    Uint8ClampedArray,
  });
  expect(out.rows).toEqual(config.rows);
  return {
    plate,
    cls: out.cls as Uint8Array,
    lev: out.lev as Int8Array,
    face: out.face as Uint8Array,
  };
}

const differing = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n + Math.abs(a.length - b.length);
};

describe("the quarry boards' tiles", () => {
  const names = [
    ...['moss0', 'moss1', 'floor', 'road', 'top', 'face', 'rim', 'water', 'grass'],
    ...Array.from({ length: 16 }, (_, i) => `var${i}`),
    ...['rock0', 'rock1', 'rock2', 'rock3'],
  ];
  it('are the tiles the approved page embeds, and no others', () => {
    expect([...TILES.keys()].sort()).toEqual([...names].sort());
  });
  it.each(names)('%s is the page’s, pixel for pixel', (name) => {
    const page = embedded(name),
      mine = TILES.get(name);
    expect([mine?.width, mine?.height]).toEqual([page.width, page.height]);
    expect(differing(mine?.data ?? [], page.data)).toBe(0);
  });
});

describe.each(QUARRY_TERRAINS.map((c) => [c.mapId, c] as const))('the %s board', (_id, config) => {
  const map = COMBAT_MAPS.find((m) => m.id === config.mapId);
  if (!map) throw new Error(`no map ${config.mapId}`);

  it("is the prototype's own bake to the byte with the guard off", () => {
    expect(config.rows).toEqual(map.rows);
    const proto = prototypeBake(config);
    const ground = quarryGround(config, false);
    expect(differing(ground.cls, proto.cls)).toBe(0);
    expect(differing(ground.lev, proto.lev)).toBe(0);
    expect(differing(ground.face, proto.face)).toBe(0);
    expect(differing(bakePlate(ground, TILES).plate.data, proto.plate)).toBe(0);
  });

  it('keeps every walkable cell standable, and leaves only the blocked floor cells to the objects', () => {
    // no objects yet (#470 is the ground): the validation's only complaint is a blocked floor cell
    // (a wall, a gate, a boulder) that the board's object layout stands a solid piece on
    const problems = validateTopDownLayout(map, {
      mapId: map.id,
      terrain: quarryTerrain(config),
      objects: [],
      slots: [],
    });
    const open: string[] = [];
    map.rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (
          map.legend[c]?.blocked &&
          !map.legend[c]?.elevation &&
          classifyQuarry(config, (x + 0.5) * CELL, (y + 0.5) * CELL).ground === 'ground'
        )
          open.push(
            `map "${map.id}" top-down layout blocked (${x},${y}) is neither a solid object's footprint nor blocked terrain`,
          );
      }),
    );
    expect(problems).toEqual(open);
    expect(open.every((p) => /\(\d+,\d+\)/.test(p))).toBe(true);
    for (const p of open) {
      const [, x, y] = /\((\d+),(\d+)\)/.exec(p) ?? [];
      expect(['#', 'G'], p).toContain(map.rows[Number(y)]?.[Number(x)]);
    }
  });

  it('lays rock on every rock cell, the pool on `~` and the pit on `P`, at their centres', () => {
    const g = groundOf(config);
    map.rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        const i = (GRID.y + y * CELL + 20) * PLATE_W + GRID.x + x * CELL + 20;
        const at = classifyQuarry(config, (x + 0.5) * CELL, (y + 0.5) * CELL);
        if (c === 'X') expect(['rock', 'face'], `(${x},${y})`).toContain(at.ground);
        if (c === '~') expect(g.cls[i], `(${x},${y})`).toBe(QUARRY.water);
        if (c === 'P') expect(g.cls[i], `(${x},${y})`).toBe(QUARRY.pit);
        if (c === '=') expect(g.cls[i], `(${x},${y})`).toBe(QUARRY.road);
      }),
    );
  });
});

describe('the quarry bake against the topdown family budget', () => {
  it('fits the 6 MiB family with every board', () => {
    const size = (dir: string): number =>
      readdirSync(dir).reduce((sum, f) => {
        const p = `${dir}/${f}`;
        return sum + (statSync(p).isDirectory() ? size(p) : statSync(p).size);
      }, 0);
    const quarry = QUARRY_BOARDS.map((b) => [b.id, size(b.out)] as const);
    const family = size('public/art/topdown');
    console.log(
      `topdown family ${(family / 2 ** 20).toFixed(2)} MiB of 6; quarry boards: ${quarry.map(([id, n]) => `${id} ${(n / 1024).toFixed(0)} KiB`).join(', ')}`,
    );
    for (const [id, n] of quarry) expect(n, id).toBeGreaterThan(0);
    expect(family).toBeLessThanOrEqual(6 * 2 ** 20);
  });
});

/** A sprite the page embeds in its board's `objects` (escaped inside the board document's string). */
function embeddedObject(name: string): PNG {
  const match = new RegExp(
    `\\\\"${name}\\\\": \\{\\\\"src\\\\": \\\\"data:image/png;base64,([A-Za-z0-9+/=]+)\\\\"`,
  ).exec(PAGE);
  if (!match?.[1]) throw new Error(`tutorial-demo.html embeds no object "${name}"`);
  return PNG.sync.read(Buffer.from(match[1], 'base64'));
}

const LAYOUTS = [QUARRY_GATE_TOPDOWN_LAYOUT, CUTTING_TOPDOWN_LAYOUT, QUARRY_FLOOR_TOPDOWN_LAYOUT];
const SPRITES = [...new Set(LAYOUTS.flatMap((l) => l.objects.map((o) => o.sprite)))].sort();

describe("the quarry boards' objects", () => {
  it.each(SPRITES)(
    '%s is the approved page’s sprite, pixel for pixel, at its listed size',
    (name) => {
      const mine = quarryObject(name),
        page = embeddedObject(name);
      expect([mine.width, mine.height]).toEqual([page.width, page.height]);
      // alpha everywhere, colour where opaque (a clear pixel's colour is never drawn)
      let n = 0;
      for (let i = 0; i < mine.data.length; i += 4) {
        const a = mine.data[i + 3] ?? 0;
        if (a !== (page.data[i + 3] ?? 0)) n++;
        else if (a && [0, 1, 2].some((c) => mine.data[i + c] !== page.data[i + c])) n++;
      }
      expect(n).toBe(0);
      expect(QUARRY_SPRITE_SIZE[name]).toEqual([mine.width, mine.height]);
    },
  );

  it('mirrors a flipped piece left to right, and nothing else', () => {
    const img = quarryObject('dead_shrub'),
      m = mirror(img);
    expect(mirror(m).data).toEqual(img.data);
    expect([...m.data.slice(0, 4)]).toEqual([
      ...img.data.slice((img.width - 1) * 4, img.width * 4),
    ]);
  });

  it('places nothing that reads solid on an open cell: only the low cover and the rubble stand there', () => {
    for (const layout of LAYOUTS) {
      const map = COMBAT_MAPS.find((m) => m.id === layout.mapId);
      if (!map) throw new Error(layout.mapId);
      for (const o of layout.objects) {
        if (o.exterior || o.kind === 'flat') continue;
        for (const c of o.footprint) {
          const ch = map.rows[c.y]?.[c.x] ?? 'X';
          if (map.legend[ch]?.blocked) continue;
          expect(
            ['sack', 'crate', 'lime_rubble', 'scree'],
            `${layout.mapId} ${o.id} on (${c.x},${c.y})`,
          ).toContain(o.sprite);
          expect(o.solid, o.id).toBe(false);
        }
      }
    }
  });

  it("draws the gate's `c` cells as low cover a figure stands in, not solid crates", () => {
    const cover = QUARRY_GATE_TOPDOWN_LAYOUT.objects.filter((o) => o.id.startsWith('cover'));
    const cells = QUARRY_GATE.rows.flatMap((row, y) =>
      [...row].flatMap((c, x) => (c === 'c' ? [`${x},${y}`] : [])),
    );
    expect(cells.length).toBe(4);
    for (const cell of cells) {
      const here = cover.filter((o) => o.footprint.some((f) => `${f.x},${f.y}` === cell));
      expect(here.map((o) => o.sprite).sort(), cell).toEqual(['crate', 'sack']);
      for (const o of here) {
        expect(o.solid).toBe(false);
        expect(QUARRY_SPRITE_SIZE[o.sprite]?.[1] ?? 99).toBeLessThanOrEqual(28);
      }
    }
    expect(QUARRY_GATE_TOPDOWN_LAYOUT.objects.some((o) => o.sprite === 'crates')).toBe(false);
  });

  it("stands a heap on every painted rubble cell, which the scene keeps as the map's", () => {
    for (const map of [AMBUSH_ROAD, QUARRY_FLOOR]) {
      const layout = LAYOUTS.find((l) => l.mapId === map.id);
      expect(map.scene?.paintedRubble?.length).toBeGreaterThan(0);
      for (const cell of map.scene?.paintedRubble ?? [])
        expect(
          layout?.objects.some(
            (o) =>
              o.sprite === 'lime_rubble' &&
              o.footprint.some((f) => f.x === cell.x && f.y === cell.y),
          ),
          `${map.id} (${cell.x},${cell.y})`,
        ).toBe(true);
    }
  });

  it('is registered for ?style=topdown, its scene listing every standing piece', () => {
    for (const board of QUARRY_BOARDS) {
      expect(TOPDOWN_SCENES.get(board.id)?.url).toBe(`${board.url}/scene.json`);
      const scene = JSON.parse(readFileSync(sceneFile(board), 'utf8')) as MapScene;
      const layout = LAYOUTS.find((l) => l.mapId === board.id);
      expect(scene.paintedWater).toBe(true);
      // the map's own painted rubble comes across with the rules' scene fields (`topdown.ts`)
      expect(scene.paintedRubble).toBeUndefined();
      expect(scene.scenery.length).toBe(layout?.objects.filter((o) => o.kind !== 'flat').length);
    }
  });

  it('lists every way it differs from the prototype', () => {
    expect(QUARRY_DEVIATIONS.length).toBeGreaterThan(0);
    for (const d of QUARRY_DEVIATIONS) expect(d.what.length, d.id).toBeGreaterThan(10);
  });
});
