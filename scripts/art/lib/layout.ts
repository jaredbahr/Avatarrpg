/**
 * A map's tile grid as a picture and as words, for the map prompt packs and
 * the probe painting (ADR 0009).
 *
 * The layout image is the grid as flat colour blocks, one colour per kind of
 * tile, so a generator can be handed the composition it must keep: the road
 * where the road is, the pond where the pond is, every edge on a tile edge.
 * The words say the same thing for the prompt and for a person reading the
 * pack. Both come from the map's rows and legend, so they cannot drift from
 * what the rules use.
 */

import type { MapDef, TerrainId, TileTemplate, Vec2 } from '../../../src/core/types';
import type { Image } from './image';
import { newImage, parseHex, setPixel } from './image';

/**
 * What a tile is drawn and named as, in the order the words list them:
 * the features a painting must place first, the open ground last.
 */
export const TILE_CLASSES = {
  road: { label: 'road', color: '#c9b48a' },
  water: { label: 'still water', color: '#4aa3c8' },
  water_deep: { label: 'deep water', color: '#2f6f8f' },
  tree: { label: 'trees', color: '#2f6b33' },
  building: { label: 'timber walls', color: '#6b4a2f' },
  wall: { label: 'stone walls', color: '#3a3530' },
  ledge2: { label: 'high ledges, two steps up', color: '#d6d3ca' },
  ledge: { label: 'ledges, one step up', color: '#b3b0a6' },
  pit: { label: 'pits', color: '#141010' },
  rubble: { label: 'heaps of tumbled rock', color: '#8c8577' },
  cover: { label: 'crates and cover', color: '#b07b3a' },
  oil: { label: 'spilled oil', color: '#2b2620' },
  mud: { label: 'churned mud', color: '#6b4b2a' },
  sand: { label: 'sand', color: '#e0c98a' },
  wood: { label: 'plank floors', color: '#8b5a2b' },
  grass: { label: 'grass', color: '#6aa84f' },
  dirt: { label: 'bare earth', color: '#a67c52' },
  stone: { label: 'flagstones', color: '#9a9a94' },
} as const satisfies Record<string, { label: string; color: string }>;

export type TileClassId = keyof typeof TILE_CLASSES;

/** The open ground a map is mostly made of; summarised rather than placed. */
const GROUND: readonly TileClassId[] = ['grass', 'dirt', 'stone'];

/** Which class a legend entry belongs to: what blocks, what stands up, what lies on top. */
export function classify(tile: TileTemplate): TileClassId {
  if (tile.blocked) {
    if (tile.terrain === 'pit') return 'pit';
    if (tile.terrain === 'grass') return 'tree';
    if (tile.terrain === 'wood') return 'building';
    return 'wall';
  }
  const elevation = tile.elevation ?? 0;
  if (elevation >= 2) return 'ledge2';
  if (elevation === 1) return 'ledge';
  if (tile.surface === 'water') return 'water';
  if (tile.surface === 'oil') return 'oil';
  if (tile.surface === 'mud') return 'mud';
  if (tile.surface === 'rubble') return 'rubble';
  if (tile.cover) return 'cover';
  return tile.terrain satisfies TerrainId;
}

/** The legend entry under a tile; throws on a map the content test would already reject. */
export function templateAt(map: MapDef, x: number, y: number): TileTemplate {
  const ch = map.rows[y]?.[x];
  const template = ch === undefined ? undefined : map.legend[ch];
  if (!template) throw new Error(`${map.id}: no tile at ${x},${y}`);
  return template;
}

export interface LayoutOptions {
  /** Darkens a one-pixel line along every tile's top and left edge, and the image's far edges. */
  readonly grid?: boolean;
  /** Tiles painted a flat colour of their own, over their class. */
  readonly marks?: readonly { readonly pos: Vec2; readonly color: string }[];
}

/** The grid as flat colour blocks, `px` pixels a tile. */
export function renderLayout(map: MapDef, px: number, options: LayoutOptions = {}): Image {
  const image = newImage(map.width * px, map.height * px);
  const marks = new Map<string, [number, number, number]>();
  for (const mark of options.marks ?? []) {
    marks.set(`${mark.pos.x},${mark.pos.y}`, parseHex(mark.color));
  }
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const rgb =
        marks.get(`${x},${y}`) ?? parseHex(TILE_CLASSES[classify(templateAt(map, x, y))].color);
      for (let py = 0; py < px; py++) {
        for (let pxx = 0; pxx < px; pxx++) {
          setPixel(image, x * px + pxx, y * px + py, [rgb[0], rgb[1], rgb[2], 255]);
        }
      }
    }
  }
  if (options.grid) {
    const darken = (x: number, y: number): void => {
      const i = (y * image.width + x) * 4;
      image.data[i] = Math.round((image.data[i] ?? 0) * 0.78);
      image.data[i + 1] = Math.round((image.data[i + 1] ?? 0) * 0.78);
      image.data[i + 2] = Math.round((image.data[i + 2] ?? 0) * 0.78);
    };
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const onLine =
          x % px === 0 || y % px === 0 || x === image.width - 1 || y === image.height - 1;
        if (onLine) darken(x, y);
      }
    }
  }
  return image;
}

/* ------------------------------------------------------------------ */
/* Words                                                               */
/* ------------------------------------------------------------------ */

export interface Region {
  readonly cls: TileClassId;
  readonly tiles: readonly Vec2[];
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Every four-connected patch of one class, largest first within a class. */
export function regions(map: MapDef): Region[] {
  const classes: TileClassId[][] = [];
  for (let y = 0; y < map.height; y++) {
    const row: TileClassId[] = [];
    for (let x = 0; x < map.width; x++) row.push(classify(templateAt(map, x, y)));
    classes.push(row);
  }
  const seen = new Set<string>();
  const found: Region[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      const cls = classes[y]?.[x];
      if (!cls) continue;
      const tiles: Vec2[] = [];
      const queue: Vec2[] = [{ x, y }];
      seen.add(key);
      while (queue.length > 0) {
        const here = queue.pop();
        if (!here) break;
        tiles.push(here);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = here.x + dx;
          const ny = here.y + dy;
          const nkey = `${nx},${ny}`;
          if (seen.has(nkey) || classes[ny]?.[nx] !== cls) continue;
          seen.add(nkey);
          queue.push({ x: nx, y: ny });
        }
      }
      found.push({
        cls,
        tiles,
        x0: Math.min(...tiles.map((t) => t.x)),
        y0: Math.min(...tiles.map((t) => t.y)),
        x1: Math.max(...tiles.map((t) => t.x)),
        y1: Math.max(...tiles.map((t) => t.y)),
      });
    }
  }
  const order = Object.keys(TILE_CLASSES) as TileClassId[];
  return found.sort(
    (a, b) => order.indexOf(a.cls) - order.indexOf(b.cls) || b.tiles.length - a.tiles.length,
  );
}

/** "4–8", "4", or "4, 6 and 9–11": runs of consecutive numbers. */
export function listWords(values: readonly number[]): string {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const runs: string[] = [];
  let start = sorted[0];
  let last = sorted[0];
  if (start === undefined || last === undefined) return '';
  for (const value of sorted.slice(1)) {
    if (value === last + 1) {
      last = value;
      continue;
    }
    runs.push(start === last ? `${start}` : `${start}–${last}`);
    start = value;
    last = value;
  }
  runs.push(start === last ? `${start}` : `${start}–${last}`);
  if (runs.length <= 1) return runs[0] ?? '';
  return `${runs.slice(0, -1).join(', ')} and ${runs[runs.length - 1]}`;
}

/** Where a patch sits, in thirds: "top left", "middle right", "the centre". */
function placeWords(map: MapDef, region: Region): string {
  const cx = (region.x0 + region.x1 + 1) / 2 / map.width;
  const cy = (region.y0 + region.y1 + 1) / 2 / map.height;
  const v = cy < 1 / 3 ? 'top' : cy > 2 / 3 ? 'bottom' : 'middle';
  const h = cx < 1 / 3 ? 'left' : cx > 2 / 3 ? 'right' : 'centre';
  if (v === 'middle' && h === 'centre') return 'the centre';
  return `${v} ${h}`;
}

/** One patch in words, exact to the tile. */
export function describeRegion(map: MapDef, region: Region): string {
  const w = region.x1 - region.x0 + 1;
  const h = region.y1 - region.y0 + 1;
  const n = region.tiles.length;
  const where = placeWords(map, region);
  const cols = w === 1 ? `column ${region.x0}` : `columns ${region.x0}–${region.x1}`;
  const rows = h === 1 ? `row ${region.y0}` : `rows ${region.y0}–${region.y1}`;
  if (n === w * h) {
    if (w === map.width) return `${rows}, edge to edge`;
    if (h === map.height) return `${cols}, top to bottom`;
    if (n === 1) return `one tile at column ${region.x0}, row ${region.y0} (${where})`;
    return `a ${w}×${h} block at ${cols}, ${rows} (${where})`;
  }
  // Irregular: row by row, rows with the same runs said once.
  const byRuns = new Map<string, number[]>();
  for (let y = region.y0; y <= region.y1; y++) {
    const xs = region.tiles.filter((t) => t.y === y).map((t) => t.x);
    if (xs.length === 0) continue;
    const key = xs.length === 1 ? `column ${xs[0]}` : `columns ${listWords(xs)}`;
    byRuns.set(key, [...(byRuns.get(key) ?? []), y]);
  }
  const parts = [...byRuns].map(([runs, ys]) => {
    const rowWords = ys.length === 1 ? `row ${ys[0]}` : `rows ${listWords(ys)}`;
    return `${rowWords}: ${runs}`;
  });
  return `${n} tiles (${where}), ${parts.join('; ')}`;
}

export interface LayoutWords {
  /** One line per kind of feature present, in the order the painting should place them. */
  readonly features: readonly string[];
  /** The open ground under everything else, by share. */
  readonly ground: string;
}

export function describeLayout(map: MapDef): LayoutWords {
  const all = regions(map);
  const features: string[] = [];
  for (const cls of Object.keys(TILE_CLASSES) as TileClassId[]) {
    if (GROUND.includes(cls)) continue;
    const patches = all.filter((r) => r.cls === cls);
    if (patches.length === 0) continue;
    const label = TILE_CLASSES[cls].label;
    const total = patches.reduce((sum, r) => sum + r.tiles.length, 0);
    features.push(
      `${label[0]?.toUpperCase()}${label.slice(1)} (${total} ${total === 1 ? 'tile' : 'tiles'}): ${patches
        .map((r) => describeRegion(map, r))
        .join('; ')}.`,
    );
  }
  const counts = GROUND.map((cls) => ({
    cls,
    n: all.filter((r) => r.cls === cls).reduce((sum, r) => sum + r.tiles.length, 0),
  }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
  const ground =
    counts.length === 0
      ? 'No open ground: every tile is a feature.'
      : `Open ground everywhere else: ${counts
          .map((c) => `${TILE_CLASSES[c.cls].label} (${c.n} tiles)`)
          .join(', ')}.`;
  return { features, ground };
}

/** The legend keys a map uses, each with the class it draws as. */
export function legendWords(map: MapDef): string[] {
  const used = new Set<string>();
  for (const row of map.rows) for (const ch of row) used.add(ch);
  return [...used].map((ch) => {
    const template = map.legend[ch];
    const label = template ? TILE_CLASSES[classify(template)].label : 'unknown';
    return `\`${ch}\` ${label}`;
  });
}
