import { describe, expect, it } from 'vitest';
import { QUARRY_FLOOR, QUARRY_GATE } from '../../content/maps/combat';
import { buildGrid } from '../../core/rules/grid';
import type { Grid, SurfaceId } from '../../core/types';
import type { RgbaImage } from '../shadow/hardShadowMask';
import { TOPDOWN_FIXTURE } from '../topdown.fixture';
import { CS, groundOk } from './organic';
import { EDGE, maskInto, SEED, TopdownSurfaces } from './surfaces';

type Cell = readonly [number, number];
type Change = readonly [number, number, SurfaceId | null];
type Footprint = { width: number; height: number; mask: Uint8Array };

// Fixed before the #598 follow-up painter: short pixel steps are intentional,
// but a straight third of a 40px tile reads as a square side. Four luminance
// levels separate a darker liquid core from its shoulder without fixing RGB.
const MAX_FLAT_RUN = Math.floor(CS / 3);
const CORE_DROP = 4;
const MAX_INWARD_CUT = 3;
// Reuse the existing readability suite's relative highlight threshold solely
// to identify sheen pixels. A four-pixel connected mark with no solid 2x2
// block is a thin streak, rather than an isolated fleck or a moss-like patch.
const SHEEN_ABOVE_CORE = 12;
const MIN_SHEEN_LENGTH = Math.floor(CS / 10);

function empty(width = 10, height = 8): Grid {
  return buildGrid({
    ...TOPDOWN_FIXTURE,
    width,
    height,
    rows: Array.from({ length: height }, () => '.'.repeat(width)),
    legend: { '.': { terrain: 'stone' } },
  });
}

function changed(grid: Grid, changes: readonly Change[]): Grid {
  const tiles = grid.tiles.slice();
  for (const [x, y, id] of changes) {
    const i = y * grid.width + x;
    const tile = tiles[i];
    if (!tile) throw new Error(`Missing fixture tile ${x},${y}`);
    tiles[i] = {
      ...tile,
      surface: id === null ? null : { id, duration: 3, spread: 0 },
    };
  }
  return { ...grid, tiles };
}

const oil = (cells: readonly Cell[]): Grid =>
  changed(
    empty(),
    cells.map(([x, y]) => [x, y, 'oil'] as const),
  );

const oilOnly = (grid: Grid): Grid => ({
  ...grid,
  tiles: grid.tiles.map((tile) => (tile.surface?.id === 'oil' ? tile : { ...tile, surface: null })),
});

const rectangle: Cell[] = [];
for (let y = 2; y <= 4; y++) for (let x = 2; x <= 6; x++) rectangle.push([x, y]);
const fixtures: readonly { name: string; grid: Grid }[] = [
  { name: 'isolated cell', grid: oil([[4, 3]]) },
  { name: 'long rectangle', grid: oil(rectangle) },
  {
    name: 'bent pool',
    grid: oil([
      [2, 2],
      [3, 2],
      [4, 2],
      [4, 3],
      [4, 4],
      [5, 4],
      [6, 4],
    ]),
  },
  { name: 'authored quarry gate', grid: oilOnly(buildGrid(QUARRY_GATE)) },
  { name: 'authored Driller floor', grid: oilOnly(buildGrid(QUARRY_FLOOR)) },
];

function fresh(grid: Grid): TopdownSurfaces {
  const surfaces = new TopdownSurfaces(grid);
  surfaces.update(grid);
  return surfaces;
}

function footprint(image: RgbaImage): Footprint {
  return {
    width: image.width,
    height: image.height,
    mask: Uint8Array.from({ length: image.width * image.height }, (_, i) =>
      (image.data[i * 4 + 3] ?? 0) > 0 ? 1 : 0,
    ),
  };
}

function canonical(grid: Grid): Footprint {
  const width = grid.width * CS;
  const height = grid.height * CS;
  const mask = new Uint8Array(width * height);
  const cells = new Set(grid.tiles.flatMap((tile, i) => (tile.surface?.id === 'oil' ? [i] : [])));
  maskInto(
    mask,
    { w: grid.width, h: grid.height },
    cells,
    SEED.oil,
    EDGE('oil'),
    groundOk(grid),
    (x, y) => grid.tiles[y * grid.width + x]?.blocked ?? true,
    { x0: 0, y0: 0, x1: width, y1: height },
  );
  return { width, height, mask };
}

// Independent graph distances and components over public alpha pixels; neither
// copies insideDist nor knows the production scallop/noise/palette predicate.
function neighbours(i: number, width: number, length: number, visit: (j: number) => void) {
  if (i % width) visit(i - 1);
  if (i % width < width - 1) visit(i + 1);
  if (i >= width) visit(i - width);
  if (i + width < length) visit(i + width);
}

function distances({ width, height, mask }: Footprint): Uint16Array {
  const distance = new Uint16Array(mask.length).fill(65535);
  const queue = new Uint32Array(mask.length);
  let tail = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) continue;
    distance[i] = 0;
    queue[tail++] = i;
  }
  // All distance-zero seeds precede distance-one seeds in the BFS queue.
  for (let i = 0; i < mask.length; i++)
    if (
      mask[i] &&
      (i < width || i >= width * (height - 1) || i % width === 0 || i % width === width - 1)
    ) {
      distance[i] = 1;
      queue[tail++] = i;
    }
  for (let head = 0; head < tail; head++) {
    const i = queue[head] ?? 0;
    neighbours(i, width, mask.length, (j) => {
      if (distance[j] !== 65535) return;
      distance[j] = (distance[i] ?? 0) + 1;
      queue[tail++] = j;
    });
  }
  return distance;
}

function components({ width, height, mask }: Footprint, value: number, diagonal = false) {
  const labels = new Uint32Array(mask.length);
  const queue = new Uint32Array(mask.length);
  const sizes: number[] = [0];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== value || labels[start]) continue;
    const label = sizes.length;
    let tail = 1;
    queue[0] = start;
    labels[start] = label;
    for (let head = 0; head < tail; head++) {
      const i = queue[head] ?? 0;
      const visit = (j: number) => {
        if (mask[j] !== value || labels[j]) return;
        labels[j] = label;
        queue[tail++] = j;
      };
      neighbours(i, width, mask.length, visit);
      if (diagonal) {
        const x = i % width;
        const y = Math.floor(i / width);
        if (x && y) visit(i - width - 1);
        if (x < width - 1 && y) visit(i - width + 1);
        if (x && y < height - 1) visit(i + width - 1);
        if (x < width - 1 && y < height - 1) visit(i + width + 1);
      }
    }
    sizes.push(tail);
  }
  return { labels, sizes };
}

function longestFlatOutline({ width, height, mask }: Footprint): number {
  let longest = 0;
  for (const transpose of [false, true]) {
    const across = transpose ? height : width;
    const down = transpose ? width : height;
    for (const far of [false, true]) {
      let previous = -1;
      let run = 0;
      for (let a = 0; a < across; a++) {
        let edge = -1;
        for (let b = 0; b < down; b++) {
          const v = far ? down - b - 1 : b;
          if (mask[transpose ? a * width + v : v * width + a]) {
            edge = v;
            break;
          }
        }
        run = edge >= 0 && edge === previous ? run + 1 : edge >= 0 ? 1 : 0;
        longest = Math.max(longest, run);
        previous = edge;
      }
    }
  }
  return longest;
}

const light = (image: RgbaImage, i: number): number =>
  0.2126 * (image.data[i * 4] ?? 0) +
  0.7152 * (image.data[i * 4 + 1] ?? 0) +
  0.0722 * (image.data[i * 4 + 2] ?? 0);

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  if (!values.length) throw new Error('Missing material samples');
  return values[Math.floor(values.length / 2)] ?? 0;
}

describe('oil liquid edges and core (#598 follow-up)', () => {
  it('breaks the tile-aligned sides of all four Driller floor oil patches', () => {
    const grid = oilOnly(buildGrid(QUARRY_FLOOR));
    const { width, height, mask } = footprint(fresh(grid).art.layer);
    const { labels } = components({ width, height, mask }, 1);
    const patches = [
      { name: 'north-west', x: 7, y: 2 },
      { name: 'north-east', x: 11, y: 2 },
      { name: 'south-west', x: 7, y: 8 },
      { name: 'south-east', x: 11, y: 8 },
    ];
    const limits = new Map<number, number>();
    for (const { name, x, y } of patches) {
      const label = labels[(y * CS + CS / 2) * width + x * CS + CS / 2] ?? 0;
      expect(label, name).toBeGreaterThan(0);
      expect(limits.has(label), name).toBe(false);
      limits.set(label, 0);
    }

    for (const horizontal of [true, false]) {
      const length = horizontal ? width : height;
      const lines = horizontal ? height : width;
      for (const outside of [-1, 1]) {
        for (let line = 0; line < lines; line++) {
          let previous = 0;
          let run = 0;
          for (let position = 0; position < length; position++) {
            const index = horizontal ? line * width + position : position * width + line;
            const label = labels[index] ?? 0;
            const nextLine = line + outside;
            const neighbour = horizontal ? index + outside * width : index + outside;
            const onOutline =
              limits.has(label) && (nextLine < 0 || nextLine >= lines || !mask[neighbour]);
            if (!onOutline) {
              previous = 0;
              run = 0;
              continue;
            }
            run = label === previous ? run + 1 : 1;
            previous = label;
            if (run > (limits.get(label) ?? 0)) limits.set(label, run);
          }
        }
      }
    }

    for (const [index, run] of [...limits.values()].entries()) {
      expect.soft(run, patches[index]?.name).toBeLessThanOrEqual(6);
    }
  });

  for (const { name, grid } of fixtures) {
    it(`${name}: breaks long straight tops and square sides into pixel contours`, () => {
      const shape = footprint(fresh(grid).art.layer);
      expect(shape.mask.some(Boolean)).toBe(true);
      expect(longestFlatOutline(shape)).toBeLessThanOrEqual(MAX_FLAT_RUN);
    });

    it(`${name}: only trims the canonical boundary, retaining opaque connected cores`, () => {
      const image = fresh(grid).art.layer;
      const shape = footprint(image);
      const original = canonical(grid);
      const depth = distances(original);
      let outside = 0;
      let missingCore = 0;
      let partialAlpha = 0;
      for (let i = 0; i < shape.mask.length; i++) {
        if (shape.mask[i] && !original.mask[i]) outside++;
        if (original.mask[i] && (depth[i] ?? 0) > MAX_INWARD_CUT && !shape.mask[i]) missingCore++;
        if (shape.mask[i] && image.data[i * 4 + 3] !== 255) partialAlpha++;
      }
      expect({ outside, missingCore, partialAlpha }).toEqual({
        outside: 0,
        missingCore: 0,
        partialAlpha: 0,
      });

      const foreground = components(shape, 1);
      const canonicalForeground = components(original, 1);
      const centres: number[] = [];
      grid.tiles.forEach((tile, cell) => {
        if (tile.surface?.id !== 'oil') return;
        const x = (cell % grid.width) * CS + CS / 2;
        const y = Math.floor(cell / grid.width) * CS + CS / 2;
        const centre = y * shape.width + x;
        const label = foreground.labels[centre] ?? 0;
        expect(label, `retained oil centre ${cell}`).toBeGreaterThan(0);
        centres.push(centre);
      });
      // The unchanged canonical gate already separates adjacent authored oil
      // centres; the Driller mask also has two detached depth-four fragments.
      // Preserve those identities instead of requiring impossible new joins or
      // removal beyond the three-pixel trim. No new split or join is permitted.
      for (const a of centres)
        for (const b of centres) {
          expect(foreground.labels[a] === foreground.labels[b], `centre pair ${a},${b}`).toBe(
            canonicalForeground.labels[a] === canonicalForeground.labels[b],
          );
        }
      const canonicalByActual = new Map<number, number>();
      const actualByCanonical = new Map<number, number>();
      let joinedComponents = 0;
      let splitComponents = 0;
      for (let i = 0; i < shape.mask.length; i++) {
        if (!shape.mask[i]) continue;
        const actualLabel = foreground.labels[i] ?? 0;
        const canonicalLabel = canonicalForeground.labels[i] ?? 0;
        if (
          canonicalByActual.has(actualLabel) &&
          canonicalByActual.get(actualLabel) !== canonicalLabel
        )
          joinedComponents++;
        if (
          actualByCanonical.has(canonicalLabel) &&
          actualByCanonical.get(canonicalLabel) !== actualLabel
        )
          splitComponents++;
        canonicalByActual.set(actualLabel, canonicalLabel);
        actualByCanonical.set(canonicalLabel, actualLabel);
      }
      expect({ joinedComponents, splitComponents }).toEqual({
        joinedComponents: 0,
        splitComponents: 0,
      });

      const background = components(shape, 0);
      const exterior = new Set<number>();
      for (let x = 0; x < shape.width; x++) {
        exterior.add(background.labels[x] ?? 0);
        exterior.add(background.labels[(shape.height - 1) * shape.width + x] ?? 0);
      }
      for (let y = 0; y < shape.height; y++) {
        exterior.add(background.labels[y * shape.width] ?? 0);
        exterior.add(background.labels[y * shape.width + shape.width - 1] ?? 0);
      }
      exterior.delete(0);
      // Existing canonical holes are part of the reference. A newly enclosed
      // background component cannot contain any canonical background pixel.
      const inheritedBackground = new Set<number>();
      for (let i = 0; i < original.mask.length; i++)
        if (!original.mask[i]) inheritedBackground.add(background.labels[i] ?? 0);
      let newHoles = 0;
      for (let label = 1; label < background.sizes.length; label++)
        if (!exterior.has(label) && !inheritedBackground.has(label)) newHoles++;
      expect(newHoles, 'no new enclosed transparent holes relative to the canonical mask').toBe(0);
    });
  }

  it('reads as a darker liquid core below its shoulder with a thin connected still sheen', () => {
    const grid = oil(rectangle);
    const image = fresh(grid).art.layer;
    const shape = footprint(image);
    const depth = distances(shape);
    const shoulder: number[] = [];
    const core: number[] = [];
    for (let i = 0; i < shape.mask.length; i++) {
      if (!shape.mask[i]) continue;
      if ((depth[i] ?? 0) >= 2 && (depth[i] ?? 0) <= 4) shoulder.push(light(image, i));
      if ((depth[i] ?? 0) >= 9) core.push(light(image, i));
    }
    expect(shoulder.length).toBeGreaterThan(100);
    expect(core.length).toBeGreaterThan(1000);
    const coreLight = median(core);
    expect.soft(median(shoulder) - coreLight).toBeGreaterThanOrEqual(CORE_DROP);
    const sheen = Uint8Array.from(shape.mask, (on, i) =>
      on && (depth[i] ?? 0) >= 9 && light(image, i) > coreLight + SHEEN_ABOVE_CORE ? 1 : 0,
    );
    // Diagonal neighbours count as a continuous one-pixel contour, too.
    const marks = components({ ...shape, mask: sheen }, 1, true);
    expect(Math.max(...marks.sizes)).toBeGreaterThanOrEqual(MIN_SHEEN_LENGTH);
    let solidSquares = 0;
    for (let y = 0; y < shape.height - 1; y++)
      for (let x = 0; x < shape.width - 1; x++) {
        const i = y * shape.width + x;
        if (sheen[i] && sheen[i + 1] && sheen[i + shape.width] && sheen[i + shape.width + 1])
          solidSquares++;
      }
    expect(solidSquares, 'a thin sheen has no filled 2x2 interior highlight blocks').toBe(0);
    expect(Buffer.from(fresh(grid).art.layer.data).equals(Buffer.from(image.data))).toBe(true);
  });

  it('keeps incremental oil edits byte-identical to fresh paint across corners and material overlaps', () => {
    let grid = empty(12, 9);
    const retained = fresh(grid);
    const steps: readonly (readonly Change[])[] = [
      [[0, 0, 'oil']],
      [
        [1, 0, 'oil'],
        [1, 1, 'oil'],
        [5, 4, 'oil'],
        [6, 4, 'oil'],
      ],
      [
        [2, 1, 'mud'],
        [4, 4, 'water'],
        [7, 4, 'ice'],
        [7, 5, 'fire'],
      ],
      [
        [2, 0, 'oil'],
        [2, 1, 'oil'],
        [5, 5, 'oil'],
        [6, 5, 'oil'],
      ],
      [
        [1, 0, null],
        [5, 4, null],
      ],
      [
        [0, 0, null],
        [1, 1, null],
        [2, 0, null],
        [2, 1, null],
        [6, 4, null],
        [5, 5, null],
        [6, 5, null],
      ],
      [
        [11, 8, 'oil'],
        [10, 8, 'oil'],
        [11, 7, 'oil'],
      ],
      [
        [10, 8, 'water'],
        [11, 7, null],
      ],
    ];
    for (const [step, edits] of steps.entries()) {
      grid = changed(grid, edits);
      const before = JSON.stringify(grid);
      for (const tile of grid.tiles) {
        if (tile.surface) Object.freeze(tile.surface);
        Object.freeze(tile);
      }
      Object.freeze(grid.tiles);
      Object.freeze(grid);
      expect(retained.update(grid), `changed step ${step}`).toBe(true);
      const whole = fresh(grid).art;
      const actual = retained.art;
      expect(
        Buffer.from(actual.layer.data).equals(Buffer.from(whole.layer.data)),
        `layer step ${step}`,
      ).toBe(true);
      expect(
        Buffer.from(actual.glow.data).equals(Buffer.from(whole.glow.data)),
        `glow step ${step}`,
      ).toBe(true);
      expect(actual.flames).toEqual(whole.flames);
      expect(actual.steam).toEqual(whole.steam);
      expect(JSON.stringify(grid), `rules grid unchanged at step ${step}`).toBe(before);
    }
  });
});
