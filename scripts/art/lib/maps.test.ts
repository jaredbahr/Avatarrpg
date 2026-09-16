import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_MAPS } from '../../../src/content';
import { FOREST_ROAD } from '../../../src/content/maps/combat';
import { LEGEND } from '../../../src/content/maps/legend';
import { defaultPixelsPerTile } from '../map';
import { LAYOUT_PX, layoutPath, mapPack, packPath } from '../map-pack';
import { PROBE_PATH, PROBE_PX, PROBE_TILES, probeBackdrop } from '../probe-backdrop';
import { newImage, parseHex, pixelAt, readPng, setPixel } from './image';
import {
  TILE_CLASSES,
  classify,
  describeLayout,
  describeRegion,
  listWords,
  regions,
  renderLayout,
} from './layout';
import { encodeWebp, webpSize } from './webp';

/**
 * The map side of the art scripts: the layout images and words the packs are
 * made of, the WebP encoder and header reader `art:map` and the validator
 * use, and the packs, layout images and probe painting committed under the
 * repo, which must be what the generators produce from the content today.
 */

const rgb = (image: ReturnType<typeof newImage>, x: number, y: number) =>
  pixelAt(image, x, y).slice(0, 3);

describe('tile classes', () => {
  it('sort the legend into what a painting must place', () => {
    const expected: Record<string, ReturnType<typeof classify>> = {
      ',': 'grass',
      '.': 'dirt',
      '=': 'road',
      T: 'tree',
      B: 'building',
      '#': 'wall',
      P: 'pit',
      c: 'cover',
      r: 'rubble',
      '^': 'ledge',
      A: 'ledge2',
      '~': 'water',
      o: 'oil',
      m: 'mud',
    };
    for (const [key, cls] of Object.entries(expected)) {
      const template = LEGEND[key];
      expect(template, key).toBeDefined();
      if (template) expect(classify(template), key).toBe(cls);
    }
  });
});

describe('layout images', () => {
  it('draw every tile as its class colour at the asked size', () => {
    const image = renderLayout(FOREST_ROAD, 4);
    expect(image.width).toBe(80);
    expect(image.height).toBe(48);
    expect(rgb(image, 5 * 4 + 2, 6 * 4 + 2)).toEqual(parseHex(TILE_CLASSES.water.color));
    expect(rgb(image, 2, 2)).toEqual(parseHex(TILE_CLASSES.tree.color));
    expect(rgb(image, 10 * 4 + 2, 4 * 4 + 2)).toEqual(parseHex(TILE_CLASSES.road.color));
    expect(rgb(image, 3 * 4 + 2, 1 * 4 + 2)).toEqual(parseHex(TILE_CLASSES.grass.color));
  });

  it('darken the tile lines when asked, and paint marks over the class', () => {
    const lined = renderLayout(FOREST_ROAD, 4, { grid: true });
    const [onLine] = rgb(lined, 0, 5);
    const [inside] = rgb(lined, 1, 5);
    expect(onLine).toBeLessThan(inside ?? 0);

    const marked = renderLayout(FOREST_ROAD, 4, {
      marks: [{ pos: { x: 3, y: 2 }, color: '#ff00ff' }],
    });
    expect(rgb(marked, 3 * 4 + 2, 2 * 4 + 2)).toEqual([255, 0, 255]);
    expect(rgb(marked, 4 * 4 + 2, 2 * 4 + 2)).toEqual(parseHex(TILE_CLASSES.grass.color));
  });
});

describe('layout words', () => {
  it('list runs of numbers the way a person would', () => {
    expect(listWords([4, 8])).toBe('4 and 8');
    expect(listWords([5, 6, 7])).toBe('5–7');
    expect(listWords([0, 1, 2, 5, 9, 10])).toBe('0–2, 5 and 9–10');
    expect(listWords([3])).toBe('3');
  });

  it("find the forest road's pond as one patch and say where its rows run", () => {
    const water = regions(FOREST_ROAD).filter((r) => r.cls === 'water');
    expect(water).toHaveLength(1);
    const [pond] = water;
    if (!pond) return;
    expect(pond.tiles).toHaveLength(8);
    expect([pond.x0, pond.y0, pond.x1, pond.y1]).toEqual([4, 5, 7, 7]);
    expect(describeRegion(FOREST_ROAD, pond)).toBe(
      '8 tiles (middle left), rows 5 and 7: columns 5–6; row 6: columns 4–7',
    );
  });

  it('call a full-width band edge to edge and a solid patch a block', () => {
    const road = regions(FOREST_ROAD).find((r) => r.cls === 'road');
    expect(road && describeRegion(FOREST_ROAD, road)).toMatch(
      /^68 tiles \(the centre\), rows 4 and 8: columns 0–19/,
    );
    const rock = regions(FOREST_ROAD).find((r) => r.cls === 'rubble');
    expect(rock && describeRegion(FOREST_ROAD, rock)).toBe(
      'one tile at column 7, row 3 (top centre)',
    );
    const wide = {
      ...FOREST_ROAD,
      rows: FOREST_ROAD.rows.map((row, y) => (y === 4 ? row : row.replace(/=/g, ','))),
    };
    const band = regions(wide).find((r) => r.cls === 'road');
    expect(band && describeRegion(wide, band)).toBe('row 4, edge to edge');
  });

  it('put the features first and sum the open ground', () => {
    const words = describeLayout(FOREST_ROAD);
    expect(words.features[0]).toMatch(/^Road \(68 tiles\)/);
    expect(words.ground).toBe('Open ground everywhere else: grass (141 tiles).');
  });
});

describe('pixels a tile', () => {
  it('keep a painting 1920 wide in steps of eight, inside the texture cap', () => {
    expect(defaultPixelsPerTile({ width: 20 })).toBe(96);
    expect(defaultPixelsPerTile({ width: 24 })).toBe(80);
    expect(defaultPixelsPerTile({ width: 8 })).toBe(240);
    expect(defaultPixelsPerTile({ width: 4 })).toBe(256);
  });
});

describe('webp', () => {
  it('round-trips a size through the encoder and the header reader', async () => {
    const image = newImage(40, 24);
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 40; x++) setPixel(image, x, y, [x * 6, y * 10, 90, 255]);
    }
    const bytes = await encodeWebp(image, 80);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe('WEBP');
    expect(webpSize(bytes)).toEqual({ width: 40, height: 24 });
  });

  it('reads the lossless and the extended headers, and refuses anything else', () => {
    const header = (chunk: string, payload: number[]): Uint8Array => {
      const out = new Uint8Array(40);
      out.set(
        [...'RIFF'].map((c) => c.charCodeAt(0)),
        0,
      );
      out.set(
        [...'WEBP'].map((c) => c.charCodeAt(0)),
        8,
      );
      out.set(
        [...chunk].map((c) => c.charCodeAt(0)),
        12,
      );
      out.set(payload, 20);
      return out;
    };
    // VP8L: signature, then 14 bits of width-1 and 14 bits of height-1.
    const bits = (300 - 1) | ((200 - 1) << 14);
    expect(
      webpSize(
        header('VP8L', [
          0x2f,
          bits & 255,
          (bits >> 8) & 255,
          (bits >> 16) & 255,
          (bits >> 24) & 255,
        ]),
      ),
    ).toEqual({ width: 300, height: 200 });
    // VP8X: four bytes of flags, then width-1 and height-1 as 24-bit numbers.
    expect(webpSize(header('VP8X', [0, 0, 0, 0, 0x7f, 0x07, 0x00, 0x7f, 0x04, 0x00]))).toEqual({
      width: 1920,
      height: 1152,
    });
    expect(webpSize(new Uint8Array(10))).toBeNull();
    expect(webpSize(header('ABCD', [0, 0, 0, 0]))).toBeNull();
  });
});

/** Whitespace-insensitive, so prettier's reflow of a pack does not count as drift. */
const normalise = (text: string): string => text.replace(/\s+/g, ' ').trim();

describe('what is committed', () => {
  for (const map of ALL_MAPS) {
    it(`${map.id}: the pack and the layout image are what the content generates`, () => {
      expect(existsSync(packPath(map)), packPath(map)).toBe(true);
      expect(normalise(readFileSync(packPath(map), 'utf8'))).toBe(normalise(mapPack(map)));
      const onDisk = readPng(layoutPath(map));
      const fresh = renderLayout(map, LAYOUT_PX, { grid: true });
      expect([onDisk.width, onDisk.height]).toEqual([fresh.width, fresh.height]);
      expect(Buffer.from(onDisk.data).equals(Buffer.from(fresh.data))).toBe(true);
    });
  }

  it('the probe painting is the forest road with its block, at 32 px a tile', () => {
    const onDisk = readPng(PROBE_PATH);
    const fresh = probeBackdrop();
    expect([onDisk.width, onDisk.height]).toEqual([
      FOREST_ROAD.width * PROBE_PX,
      FOREST_ROAD.height * PROBE_PX,
    ]);
    expect(Buffer.from(onDisk.data).equals(Buffer.from(fresh.data))).toBe(true);
    for (const tile of PROBE_TILES) {
      expect(rgb(onDisk, tile.x * PROBE_PX + 16, tile.y * PROBE_PX + 16)).toEqual([255, 0, 255]);
    }
  });
});
