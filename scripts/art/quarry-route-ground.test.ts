import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { AMBUSH_ROAD, QUARRY_FLOOR, QUARRY_GATE } from '../../src/content/maps/combat';
import {
  CUTTING_GROUND_REGIONS,
  CUTTING_POOL_BYTES,
  DRILLER_GROUND_REGIONS,
  DRILLER_PLATES,
} from '../../src/content/scenes/quarryRouteGround';
import { QUARRY_GATE_GROUND_REGIONS } from '../../src/content/scenes/quarryGate';
import type { Image } from './lib/image';
import type { MapDef } from '../../src/core/types';
import { pixelAt, toHex } from './lib/image';
import { decodeWebp, encodeWebp } from './lib/webp';
import { FOREST_INK } from './forest-village-material';
import {
  QUARRY_GROUND_QUALITY,
  QUARRY_GROUND_TONES,
  heapClass,
  heapFits,
  nearestHeap,
} from './quarry-village-material';
import {
  CUTTING_POOL_OUTPUT,
  QUARRY_PAGE,
  openFloor,
  buildCuttingPool,
  buildQuarryGround,
} from './quarry-route-ground';
import { buildGateGround, plainSpoil } from './quarry-modular-ground';
import { COURSE, NORTH_RISE, SOUTH_RISE } from './cutting-rock';
import { buildDrillerGantry, buildDrillerShaft, DRILLER_GANTRY_CELLS } from './driller-shaft';
import type { Plate } from './driller-shaft';
import { TERRAIN_STYLES } from '../../src/render/palettes';
import { luma, measure, readPlate } from './forest-ground-measure';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/** DL-2 §3: no 128 px window inside a packed plate may span more than this. */
const MAX_WINDOW_SPAN = 1.25;
/**
 * `docs/coordination/handoffs/village-ground-tone.md` measured the village's
 * authored ground on screen at `#8d9557`; DL-2 asks every re-keyed plate to sit
 * inside 1.3x of it, which is what makes the four scenes read as one game.
 */
const VILLAGE = luma(0x8d, 0x95, 0x57);
const INK = toHex([0x1b, 0x14, 0x10]);

type Built = Map<string, { image: Image; x: number; y: number }>;
const driller: Built = await buildQuarryGround('driller');
const cutting: Built = await buildQuarryGround('cutting');
const gate: Built = await buildGateGround();
const pool: Image = await buildCuttingPool();

const plate = (built: Built, name: string) => {
  const found = built.get(name);
  if (!found) throw new Error(`no ${name} plate`);
  return found;
};

it.each([
  ['driller-floor-scene', () => driller, DRILLER_GROUND_REGIONS],
  ['cutting-scene', () => cutting, CUTTING_GROUND_REGIONS],
  ['quarry-gate-scene', () => gate, QUARRY_GATE_GROUND_REGIONS],
] as const)('registers %s exactly where the packer puts it', (_root, built, regions) => {
  for (const region of regions) {
    const { image, x, y } = plate(built(), region.name);
    expect({ x, y, width: image.width, height: image.height }).toEqual({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    });
  }
});

it('paints only the named materials, their rims and the ink', () => {
  const allowed = new Set<string>([FOREST_INK]);
  for (const tone of Object.values(QUARRY_GROUND_TONES))
    for (const hex of Object.values(tone)) allowed.add(hex);
  const seen = new Set<string>();
  const images = [driller, cutting, gate].flatMap((built) =>
    [...built.values()].map(({ image }) => image),
  );
  for (const image of [...images, pool])
    for (let i = 0; i < image.data.length; i += 4) {
      if ((image.data[i + 3] ?? 0) === 0) continue;
      seen.add(toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]));
    }
  // Flat tones only: a colour outside the table would be the continuous tone a
  // gradient or a distance haze needs in order to exist.
  expect([...seen].filter((hex) => !allowed.has(hex))).toEqual([]);
  // Every material the two scenes claim is on a plate, so neither the floor's
  // earth plane nor the gate's terrace can be one swatch.
  for (const tone of Object.values(QUARRY_GROUND_TONES))
    expect(seen, `${tone.base} is painted`).toContain(tone.base);
  expect(seen).toContain(INK);
});

it('carries no baked gradient and stays in the village tone band', async () => {
  // The plate these pixels are derived from, measured live rather than
  // recorded, so the assertion is "the same key as the village's own paving"
  // and not a number that can go stale.
  const source = measure(
    await readPlate('public/art/maps/ba-dan-scene/western-approach-ground.webp'),
  ).mean;
  for (const [scene, built] of [
    ['driller', driller],
    ['cutting', cutting],
    ['gate', gate],
  ] as const)
    for (const [name, { image }] of built) {
      const m = measure(image);
      expect(m.opaque, `${scene}/${name} has paint`).toBeGreaterThan(0);
      expect(m.span, `${scene}/${name} window span`).toBeLessThan(MAX_WINDOW_SPAN);
      // Two anchors, because §3 gives the quarry two families and the village
      // is measured two ways. A limestone terrace belongs against the village's
      // own paving *plate*, which is the painting these pixels come from; a
      // packed-earth floor belongs against the village's recorded *on-screen*
      // ground `#8d9557`, which is what a reviewer actually compares. No plate
      // may sit outside both — that is what "a fourth ground family" means.
      const band = Math.min(
        Math.max(source / m.mean, m.mean / source),
        Math.max(VILLAGE / m.mean, m.mean / VILLAGE),
      );
      expect(band, `${scene}/${name} tone band`).toBeLessThan(1.3);
    }
  // DL-2's stated acceptance is about the *floor* — the plane that is 60% of
  // `14-boss-blast-floor`'s frame — against the village's recorded on-screen
  // ground. A limestone terrace cannot also sit inside 1.3x of that figure
  // without drifting a §3 hex, which the bible calls a QA failure; see the
  // handoff's "Open" section.
  for (const [scene, name] of [
    [driller, 'dirt-west'],
    [driller, 'dirt-east'],
    // The Cutting's cart lane is the same packed earth as the Driller's floor.
    [cutting, 'road'],
  ] as const) {
    const m = measure(plate(scene, name).image);
    expect(Math.max(VILLAGE / m.mean, m.mean / VILLAGE), `floor ${name}`).toBeLessThan(1.3);
  }
});

/** Whether a built page paints the bible's ink at a logical point. */
function inkAt(built: Built, gx: number, gy: number): boolean {
  for (const [, { image, x: originX, y: originY }] of built) {
    const px = Math.round(768 + (gx - gy) * 64 - originX - 0.5),
      py = Math.round((gx + gy) * 32 - originY - 0.5);
    if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
    const rgba = pixelAt(image, px, py);
    if (rgba[3] === 255 && toHex([rgba[0], rgba[1], rgba[2]]) === INK) return true;
  }
  return false;
}

/**
 * Walk inward from the midpoint of each of a diamond's four cell edges, and
 * report which edges carry ink. The ink is a 2 px line, which is 0.014 of a
 * tile either side of the edge, so a single sample at a fixed inset would be a
 * coin toss against rounding.
 */
function inkedEdges(built: Built, cx: number, cy: number): { dx: number; dy: number }[] {
  const edges = [
    { dx: -1, dy: 0, at: (t: number) => [cx + t, cy + 0.5] },
    { dx: 1, dy: 0, at: (t: number) => [cx + 1 - t, cy + 0.5] },
    { dx: 0, dy: -1, at: (t: number) => [cx + 0.5, cy + t] },
    { dx: 0, dy: 1, at: (t: number) => [cx + 0.5, cy + 1 - t] },
  ];
  return edges
    .filter(({ at }) => {
      for (let t = 0.002; t < 0.04; t += 0.002) {
        const [gx = 0, gy = 0] = at(t);
        if (inkAt(built, gx, gy)) return true;
      }
      return false;
    })
    .map(({ dx, dy }) => ({ dx, dy }));
}

it('leaves ink off every plain-material join at the gate and Cutting', () => {
  const scenes = [
    {
      name: 'gate',
      built: gate,
      map: QUARRY_GATE,
      material: (key: string | undefined) =>
        key === '=' ? 'earth' : key === '.' || key === ',' ? 'spoil' : null,
    },
    {
      name: 'cutting',
      built: cutting,
      map: AMBUSH_ROAD,
      material: (key: string | undefined) =>
        key === '=' ? 'earth' : key === ',' ? 'spoil' : key === '.' ? 'earth' : null,
    },
  ] as const;
  for (const scene of scenes) {
    let checked = 0;
    for (let y = 0; y < scene.map.height; y++)
      for (let x = 0; x < scene.map.width; x++) {
        const own = scene.material(scene.map.rows[y]?.[x]);
        if (!own) continue;
        for (const { dx, dy } of [
          { dx: 1, dy: 0 },
          { dx: 0, dy: 1 },
        ]) {
          const other = scene.material(scene.map.rows[y + dy]?.[x + dx]);
          if (!other || other === own) continue;
          checked++;
          expect(
            inkedEdges(scene.built, x, y),
            `${scene.name} plain join at ${x},${y} toward ${dx},${dy}`,
          ).not.toContainEqual({ dx, dy });
        }
      }
    expect(checked, `${scene.name} exercises plain-material joins`).toBeGreaterThan(0);
  }
});

it.each([
  // The floor has four oil blocks; the old pass painted every one of them with
  // the same field as the floor and no edge at all. The Cutting has no oil.
  ['driller', () => driller, QUARRY_FLOOR, 16],
  ['cutting', () => cutting, AMBUSH_ROAD, 0],
] as const)('gives every %s ledge and oil diamond an ink edge', (_scene, built, map, hazards) => {
  let checked = 0;
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (map.rows[y]?.[x] !== 'o') continue;
      checked++;
      expect(inkedEdges(built(), x, y).length, `oil at ${x},${y} carries ink`).toBeGreaterThan(0);
    }
  expect(checked).toBe(hazards);

  // The ledge mass is a long boundary with the floor, so its ink is thousands
  // of pixels of 2 px line rather than a stray fleck.
  const { image } = plate(built(), 'stone');
  let inked = 0;
  for (let i = 0; i < image.data.length; i += 4)
    if (toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]) === INK)
      inked++;
  expect(inked).toBeGreaterThan(5_000);
});

/**
 * DL-2 W5 gate. A cover cell (legend `r`) used to be an inked spoil diamond
 * and nothing else, which read as a faint tile beside the decorative heaps.
 * Now the route's painted heap stands on it (`quarryProjected.ts`) and the
 * pages lay the ground it stands on: no diamond ink toward open floor, and the
 * heap's spill of spoil across the cell's middle — on the Driller's earth, and
 * on the Cutting's shoulders, where it is the spoil row the other way up.
 */
it.each([
  // The Driller's other four heaps stand on its benches (`R`), not on spill.
  ['driller', () => driller, QUARRY_FLOOR, 2],
  ['cutting', () => cutting, AMBUSH_ROAD, 4],
] as const)(
  'stands every %s cover cell on its spill, not on an inked diamond',
  (_s, built, map, n) => {
    const spoil = new Set<string>(Object.values(QUARRY_GROUND_TONES.spoil));
    let cells = 0;
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        if (map.rows[y]?.[x] !== 'r') continue;
        cells++;
        for (const { dx, dy } of inkedEdges(built(), x, y)) {
          const neighbour = map.rows[y + dy]?.[x + dx];
          // Toward the lane or a ledge the floor keeps its own inked edge.
          expect(
            neighbour === '.' || neighbour === ',',
            `cover ${x},${y} is inked toward ${neighbour}`,
          ).toBe(false);
        }
        let spilt = 0,
          all = 0;
        for (let v = 0.3; v <= 0.7; v += 0.05)
          for (let u = 0.3; u <= 0.7; u += 0.05)
            for (const [, { image, x: originX, y: originY }] of built()) {
              const rgba = pixelAt(
                image,
                Math.floor(768 + (x + u - (y + v)) * 64 - originX),
                Math.floor((x + u + y + v) * 32 - originY),
              );
              if (rgba[3] !== 255) continue;
              all++;
              if (spoil.has(toHex([rgba[0], rgba[1], rgba[2]]))) spilt++;
            }
        expect(spilt / all, `cover ${x},${y} stands on spill`).toBeGreaterThan(0.95);
      }
    expect(cells).toBe(n);
  },
);

/**
 * DL-2 W4. The Cutting is the gate's road layout cut between ledges, and it
 * takes the gate's reading of it: a packed-earth cart lane with its haul
 * tracks, and spoil shoulders. Since the W5 gate the shoulders' heaps are low
 * uninked mounds in the spoil row alone, so a shoulder is spoil and nothing
 * else. Read cell by cell off the built plates, so neither can drift.
 */
it("keeps the Cutting's lane apart from its spoil shoulders", () => {
  const lane = new Set<string>(
    [QUARRY_GROUND_TONES.earth, QUARRY_GROUND_TONES.rut, QUARRY_GROUND_TONES.wear].flatMap((t) =>
      Object.values(t),
    ),
  );
  const shoulder = new Set<string>(Object.values(QUARRY_GROUND_TONES.spoil));
  // Per cell: how many interior pixels are lane tones, shoulder tones and ink.
  const cells = new Map<string, { lane: number; shoulder: number; ink: number; all: number }>();
  for (const [, { image, x: originX, y: originY }] of cutting)
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const i = (py * image.width + px) * 4;
        if ((image.data[i + 3] ?? 0) < 255) continue;
        const wx = originX + px + 0.5,
          wy = originY + py + 0.5;
        const gx = ((wx - 768) / 64 + wy / 32) / 2,
          gy = (wy / 32 - (wx - 768) / 64) / 2;
        const x = Math.floor(gx),
          y = Math.floor(gy);
        // The interior only: ink, rims and the feathered join live at the edge.
        if (Math.min(gx - x, x + 1 - gx, gy - y, y + 1 - gy) < 0.2) continue;
        const hex = toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]);
        const tally = cells.get(`${x},${y}`) ?? { lane: 0, shoulder: 0, ink: 0, all: 0 };
        tally.all++;
        if (lane.has(hex)) tally.lane++;
        if (shoulder.has(hex)) tally.shoulder++;
        if (hex === INK) tally.ink++;
        cells.set(`${x},${y}`, tally);
      }

  let lanes = 0,
    shoulders = 0;
  for (let y = 0; y < AMBUSH_ROAD.height; y++)
    for (let x = 0; x < AMBUSH_ROAD.width; x++) {
      const key = AMBUSH_ROAD.rows[y]?.[x];
      const tally = cells.get(`${x},${y}`);
      if (key === '=') {
        lanes++;
        expect(tally?.all, `lane ${x},${y} is painted`).toBeGreaterThan(0);
        if (!tally) continue;
        // Packed earth throughout, and no heap ink speckled across the lane.
        expect(tally.lane / tally.all, `lane ${x},${y} is packed earth`).toBeGreaterThan(0.95);
        expect(tally.ink, `lane ${x},${y} carries no stray ink`).toBe(0);
      } else if (key === ',') {
        shoulders++;
        if (!tally) continue;
        // The amended spoil row intentionally shares packed-earth dust and
        // shadow tones, so membership in the spoil triple is the useful pin.
        // No decorative heap carries ink: ink on the board marks objects.
        expect(tally.ink, `shoulder ${x},${y} carries no ink`).toBe(0);
        expect(tally.shoulder / tally.all, `shoulder ${x},${y} is spoil`).toBeGreaterThan(0.95);
      }
    }
  // Every lane and shoulder cell of the M5 footprint (60 and 55): the cut
  // closed the old 96 shoulder cells down to the bays either side of the road.
  expect(lanes).toBe(60);
  expect(shoulders).toBe(55);
});

/** The stone plate's colour at a world pixel, or null where it is clear. */
function stoneAt(built: Built, wx: number, wy: number): string | null {
  const { image, x, y } = plate(built, 'stone');
  const rgba = pixelAt(image, Math.floor(wx - x), Math.floor(wy - y));
  return rgba[3] === 255 ? toHex([rgba[0], rgba[1], rgba[2]]) : null;
}

/**
 * M5 round 2. The Cutting's north cut is sheer and tall and its south run a
 * low lip: read up the plate from the foot of a face, the top lip's ink sits
 * where the face's height says it does. Before round 2 every face was at most
 * two courses, so the north one would find its lip at 32, not 64.
 */
it.each([
  // X (12,2) over the floor at (12,3): the north cut, four courses. Its
  // column climbs through rock the whole way; a column that climbs into a
  // ledge is cut short there, because no face paints over a playable cell.
  ['north cut over the floor', 12.5, 3, NORTH_RISE],
  // X (12,9) over the bay at (13,9): the south run, two courses.
  ['south run over a bay', 13, 9.5, SOUTH_RISE],
  // X (5,11) at the board's south edge: a one-course lip.
  ['south edge lip', 5.5, 12, COURSE],
] as const)("stands the Cutting's %s at its height", (_name, gx, gy, rise) => {
  const wx = 768 + (gx - gy) * 64,
    foot = (gx + gy) * 32;
  const inkBetween = (from: number, to: number): number => {
    let found = 0;
    for (let k = from; k <= to; k++) if (stoneAt(cutting, wx, foot - k - 0.5) === INK) found++;
    return found;
  };
  // The top lip, a pixel either side of the rise for rounding.
  expect(inkBetween(rise - 3, rise + 1), 'lip ink at the rise').toBeGreaterThan(0);
  // A clean face below it: joints are the joint tone, never ink.
  expect(inkBetween(4, rise - 5), 'no ink on the face').toBe(0);
  // And the rough top above it carries none either.
  expect(inkBetween(rise + 3, rise + 12), 'no ink on the top').toBe(0);
});

/**
 * M5 round 2. A ledge is walkable and the rock is not, and they must read
 * apart: the ledge keeps the block's dressed paving, whose pale rim share is
 * the slabs' worn arrises, while the rock's rough top takes the rim only on
 * the lip of a chipped hollow.
 */
it("tells the Cutting's ledge tops from its rock tops", () => {
  const rim: string = QUARRY_GROUND_TONES.block.rim;
  const share = (cells: readonly (readonly [number, number])[]): number => {
    let hits = 0,
      all = 0;
    for (const [cx, cy] of cells)
      for (let v = 0.3; v <= 0.7; v += 0.02)
        for (let u = 0.3; u <= 0.7; u += 0.02) {
          const hex = stoneAt(cutting, 768 + (cx + u - cy - v) * 64, (cx + u + cy + v) * 32);
          if (!hex) continue;
          all++;
          if (hex === rim) hits++;
        }
    return hits / all;
  };
  // The NE ledge's middle, and the rock top behind the cut's tallest run.
  const ledge = share([
    [15, 2],
    [16, 2],
    [16, 3],
  ]);
  const rock = share([
    [9, 0],
    [10, 0],
    [11, 0],
  ]);
  expect(ledge).toBeGreaterThan(0.08);
  expect(rock).toBeLessThan(ledge / 2);
});

/**
 * Generated art, 2026-10-03: the floor-level interiors of these twelve pages
 * (the walkable `.`, `=`, `,` and oil/shaft cells of the Driller and Cutting,
 * and the gate's flag cells) are generated paving, luminance-matched per cell
 * and filled mechanically into the packer's pages; raised tops, faces and ink
 * are the packer's own. The packer cannot reproduce them, so the shipped bytes
 * are pinned here. Provenance: docs/art/quarry-floor-fill.md.
 */
const SHIPPED_FLOOR_FILL: Record<string, string> = {
  'quarry-gate-scene/earth-west':
    'bf5d9007bcc0027fa78df29a6a0b72b713b617f712a37ea986ee70bca7e058ea',
  'quarry-gate-scene/earth-east':
    '33746b02f2aebc8a0571eee74009c194924a264041a36b5a5b1ef82186229d0b',
  'quarry-gate-scene/road': '065a0c29c4e51033551547ba2ee4ecd5c400452a7943fb084e5e38e7952b8c4d',
  'quarry-gate-scene/limestone': '1b572149d852fae047b4cc8a78d01f0d14ef1a79bad2faebbb50b04292c67571',
  'cutting-scene/dirt-west': 'e7ca53824fe35a590b44e73f3f282c0c3e45648514a16e6c14df434e8b8d8e8e',
  'cutting-scene/dirt-east': '95105f6ec73dcf0cb6df47505215046156f6d086cabf7348240fa0098945e8a7',
  'cutting-scene/road': '4b831e47ba90f004d48d58e18953ac1b735d6c022e1e9437342112b636f3e3db',
  'cutting-scene/stone': '3204887476443dc026f2bc576fedf129d1a4925a3360aee511ebaf2941ad3fcd',
  'driller-floor-scene/dirt-west':
    '44912dfd1f6d3aad75120f6615f069d68a901888d5ced1fb3e3f134e897af742',
  'driller-floor-scene/dirt-east':
    'e68fe1146cba7a24f1e4a6b20c10b33858ade29c4deb717bb838e4ba8f1b5c15',
  'driller-floor-scene/road': 'c648a618c5c344e1f810440eb7f22813b530b93631de685251a5bdc315a90b1e',
  'driller-floor-scene/stone': '217d69d72cc8e586a62bc1bee5246078227d382765a5bd82449c82b9553752a0',
};

/**
 * The hash above pins the bytes; this pins what the bytes may contain. The
 * shipped pages are the packer's plates with generated paving filled into the
 * floor-level walkable cells (docs/art/quarry-floor-fill.md), so against the
 * packer's page:
 *
 * - alpha is identical;
 * - outside the fill masks (every walkable elevation-0 cell, inset 4 px from
 *   each edge, so its rim and ink stay out) the colour is the packer's, up to
 *   the lossy q34 encode. Measured per whole cell (>= 1000 px of the page,
 *   which drops the 2 px alpha-bleed slivers whose hard ink lines the encoder
 *   moves by a pixel), a re-encode alone moves a raised top, face or ink cell
 *   by <= 7.7 mean abs / 2.3 signed per channel, and the shipped pages by
 *   <= 11.3 / 4.3. Bounds are 14 / 8: a repaint of a raised top or face
 *   with paving moves it by tens (the limestone and block tones sit 60-100
 *   from the paving), far past them;
 * - the walkable cells' own outside-mask ring (rim, ink, 3 px feather) may
 *   move more, since the fill feathers into it: measured <= 37.4 / 21.6
 *   against a re-encode's 10.5 / 4.9, bounded at 42 / 28.
 */
const OUTSIDE_MASK_CELL = { minPixels: 1000, abs: 14, signed: 8, ringAbs: 42, ringSigned: 28 };
const MASK_INSET_PX = 4;
const TILE_FACE_PX = 4096 / Math.hypot(64, 32);

/**
 * Where a page pixel sits relative to the fill: the floor-level walkable cell it
 * falls in and its distance in px to that cell's nearest edge, or `distPx` of
 * `Infinity` outside any such cell. The fill's interior is `floor` with
 * `distPx >= MASK_INSET_PX`; everything else is the packer's.
 */
function footprintAt(
  map: MapDef,
  originX: number,
  originY: number,
  px: number,
  py: number,
): { floor: boolean; distPx: number } {
  const key = (gx: number, gy: number) => map.rows[Math.floor(gy)]?.[Math.floor(gx)];
  const wx = originX + px + 0.5,
    wy = originY + py + 0.5;
  const gx = ((wx - 768) / 64 + wy / 32) / 2,
    gy = (wy / 32 - (wx - 768) / 64) / 2;
  const k = key(gx, gy);
  const tile = k === undefined ? undefined : map.legend[k];
  const floor = !!tile && !tile.blocked && !(tile.elevation ?? 0) && k !== 'r' && k !== '~';
  const cx = Math.floor(gx),
    cy = Math.floor(gy);
  const distPx = floor
    ? Math.min(gx - cx, cx + 1 - gx, gy - cy, cy + 1 - gy) * TILE_FACE_PX
    : Number.POSITIVE_INFINITY;
  return { floor, distPx };
}

function footprintViolations(
  map: MapDef,
  page: { image: Image; x: number; y: number },
  shipped: Image,
): string[] {
  const { image, x: originX, y: originY } = page;
  const problems: string[] = [];
  if (shipped.width !== image.width || shipped.height !== image.height)
    return [`size ${shipped.width}x${shipped.height} != ${image.width}x${image.height}`];
  const floor = (key: string | undefined): boolean => {
    const tile = key === undefined ? undefined : map.legend[key];
    return !!tile && !tile.blocked && !(tile.elevation ?? 0) && key !== 'r' && key !== '~';
  };
  const inset = MASK_INSET_PX / TILE_FACE_PX;
  const cells = new Map<string, { abs: number; signed: number[]; n: number; ring: boolean }>();
  let alphaDiffs = 0;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const i = (py * image.width + px) * 4;
      if (image.data[i + 3] !== shipped.data[i + 3]) alphaDiffs++;
      if (!image.data[i + 3]) continue;
      const wx = originX + px + 0.5,
        wy = originY + py + 0.5;
      const gx = ((wx - 768) / 64 + wy / 32) / 2,
        gy = (wy / 32 - (wx - 768) / 64) / 2;
      const cx = Math.floor(gx),
        cy = Math.floor(gy);
      const isFloor = floor(map.rows[cy]?.[cx]);
      if (isFloor && Math.min(gx - cx, cx + 1 - gx, gy - cy, cy + 1 - gy) >= inset) continue;
      const cell = cells.get(`${cx},${cy}`) ?? {
        abs: 0,
        signed: [0, 0, 0],
        n: 0,
        ring: isFloor,
      };
      for (let c = 0; c < 3; c++) {
        const d = (shipped.data[i + c] ?? 0) - (image.data[i + c] ?? 0);
        cell.abs += Math.abs(d) / 3;
        cell.signed[c] = (cell.signed[c] ?? 0) + d;
      }
      cell.n++;
      cells.set(`${cx},${cy}`, cell);
    }
  if (alphaDiffs) problems.push(`${alphaDiffs} alpha pixels differ`);
  const bounds = OUTSIDE_MASK_CELL;
  for (const [at, cell] of cells) {
    if (cell.n < bounds.minPixels) continue;
    const abs = cell.abs / cell.n,
      signed = Math.max(...cell.signed.map((s) => Math.abs(s / cell.n)));
    const [maxAbs, maxSigned] = cell.ring
      ? [bounds.ringAbs, bounds.ringSigned]
      : [bounds.abs, bounds.signed];
    if (abs > maxAbs || signed > maxSigned)
      problems.push(
        `${cell.ring ? 'floor ring' : 'raised/face/ink'} cell ${at} (${map.rows[Number(at.split(',')[1])]?.[Number(at.split(',')[0])]}) moved ${abs.toFixed(1)} abs / ${signed.toFixed(1)} signed`,
      );
  }
  return problems;
}

/**
 * The cell means above cannot see a repaint confined to an ink line or a small
 * face section: 100 px moved by 70 levels is under 2 of mean abs in a ~4000 px
 * cell, and fragments under `minPixels` are skipped outright. So every 8 x 8
 * window of the page that holds a protected pixel (alpha > 0 and not inside the
 * fill's interior mask, the same inset-aware mask `footprintViolations` uses, so
 * raised tops, faces, ink lines, the small fragments and every floor cell's own
 * rim, face sliver and ink line all count) is scored too:
 * the sum of per-pixel mean abs channel error over the window's protected
 * pixels, divided by the larger of their count and 16 (so a 2 px ink line, which
 * fills at most 16 pixels of a window, is not diluted by the empty rest).
 *
 * Measured with the packer's plate re-encoded at q34 with `exact=1` and decoded
 * (the noise a faithful page carries): max window error 19.0 on every page.
 * The shipped pages measure at most 22.4 outside the feather band, off the floor
 * (raised tops and faces) included: the scan counts every protected pixel that is
 * not a floor interior. The bound is 26. A 100 px repaint of an ink line, a face sliver or a floor cell's rim by 70
 * levels scores about 70 in its window.
 *
 * The one band that legitimately changed is the fill's 3 px feather, which
 * blends into the cell just outside the mask (`MASK_INSET_PX - 3` to
 * `MASK_INSET_PX` px from the cell edge). It is scored on its own with a looser
 * bound: the shipped pages measure up to 66.1 there (the re-encode alone, 19.0),
 * so the bound is 70. The band is 3 px wide, so a repaint reaching past it into
 * the rim proper (under 1 px from the edge) or the ink still lands in the strict
 * scan above.
 *
 * The Gate's earth and road pages are encoded with the packer's colour under
 * alpha 0, not the fill's: the fill's colour once leaked across the lossy blocks
 * into the 1-2 px ink pixels of the plate's outer edge and turned them
 * near-white (253,236,224 for 27,20,16). No window may exceed the bound.
 */
const WINDOW_PX = 8;
const WINDOW_MAX_ERROR = 26;
const FEATHER_PX = 3;
const FEATHER_MAX_ERROR = 70;
const inFeather = (distPx: number): boolean =>
  distPx >= MASK_INSET_PX - FEATHER_PX && distPx < MASK_INSET_PX;
/** Everything but a floor interior and the feather: off-floor pixels (Infinity) are protected too. */
const inStrictRim = (distPx: number): boolean =>
  distPx < MASK_INSET_PX - FEATHER_PX || !Number.isFinite(distPx);
const inFloorInterior = (distPx: number): boolean =>
  Number.isFinite(distPx) && distPx >= MASK_INSET_PX;

function windowScan(
  map: MapDef,
  page: { image: Image; x: number; y: number },
  other: Image,
  /** Which pixels count, by distance in px to their floor cell's edge (Infinity off the floor). */
  counts: (distPx: number) => boolean = inStrictRim,
): { max: number; over: number; at: string } {
  const { image, x: originX, y: originY } = page;
  const { width: w, height: h } = image;
  const stride = w + 1;
  const err = new Float64Array(stride * (h + 1));
  const count = new Float64Array(stride * (h + 1));
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      let e = 0,
        n = 0;
      if (image.data[i + 3]) {
        if (counts(footprintAt(map, originX, originY, px, py).distPx)) {
          n = 1;
          for (let c = 0; c < 3; c++)
            e += Math.abs((other.data[i + c] ?? 0) - (image.data[i + c] ?? 0)) / 3;
        }
      }
      const k = (py + 1) * stride + px + 1;
      err[k] = e + (err[k - 1] ?? 0) + (err[k - stride] ?? 0) - (err[k - stride - 1] ?? 0);
      count[k] = n + (count[k - 1] ?? 0) + (count[k - stride] ?? 0) - (count[k - stride - 1] ?? 0);
    }
  const box = (sum: Float64Array, x: number, y: number): number =>
    (sum[(y + WINDOW_PX) * stride + x + WINDOW_PX] ?? 0) -
    (sum[y * stride + x + WINDOW_PX] ?? 0) -
    (sum[(y + WINDOW_PX) * stride + x] ?? 0) +
    (sum[y * stride + x] ?? 0);
  let max = 0,
    over = 0,
    at = '';
  for (let y = 0; y + WINDOW_PX <= h; y++)
    for (let x = 0; x + WINDOW_PX <= w; x++) {
      const n = box(count, x, y);
      if (!n) continue;
      const score = box(err, x, y) / Math.max(n, 16);
      if (score > WINDOW_MAX_ERROR) over++;
      if (score > max) {
        max = score;
        at = `${x},${y}`;
      }
    }
  return { max, over, at };
}

/**
 * A 1-2 px ink line is too thin for the window bound to be sure of (a diagonal
 * line leaves ~8 pixels in a window, diluted by the divisor), so ink is checked
 * on its own, pixel by pixel, against what the codec does to that very pixel.
 * Each pixel the packer paints in the ink colour, outside the fill's interior,
 * has a baseline delta per channel: how far a pure re-encode of the packer's page
 * (q34, exact, the settings the shipped pages use) moves it. The shipped pixel
 * may move INK_MARGIN levels past that baseline and no further, in every channel.
 * One global tolerance had to cover the worst codec pixel (a few off-floor ink
 * pixels move ~70 from noise alone), which let an ink pixel repainted to gray 80
 * (moves 53/60/64) through. Measured over the twelve shipped pages, a shipped
 * ink pixel sits at most 44 levels past its own re-encode delta (the shipped
 * encode saw a different neighbourhood, so a 14-16 margin cannot hold them: the
 * composite of packer page plus shipped fill re-encoded as a baseline was worse,
 * 60), so INK_MARGIN is 46. A pixel the codec barely moves is therefore held to
 * ~46 and a gray 80 repaint (64 in blue) fails wherever the baseline is under 18;
 * INK_CAP, 70, still bounds the absolute move (the shipped pages reach 66).
 */
const INK_MARGIN = 46;
const INK_CAP = 70;

const reencodeCache = new Map<string, Promise<Image>>();
/** The packer's page through the shipped encoder settings, decoded; encoded once per page. */
function reencoded(key: string, image: Image): Promise<Image> {
  let hit = reencodeCache.get(key);
  if (!hit) {
    hit = encodeWebp(image, QUARRY_GROUND_QUALITY, true).then(decodeWebp);
    reencodeCache.set(key, hit);
  }
  return hit;
}

function inkViolations(
  map: MapDef,
  page: { image: Image; x: number; y: number },
  shipped: Image,
  baseline: Image,
): string[] {
  const { data } = page.image;
  let bright = 0;
  for (let py = 0; py < shipped.height; py++)
    for (let px = 0; px < shipped.width; px++) {
      const i = (py * shipped.width + px) * 4;
      if (data[i + 3] !== 255 || data[i] !== 0x1b || data[i + 1] !== 0x14) continue;
      if (data[i + 2] !== 0x10) continue;
      if (inFloorInterior(footprintAt(map, page.x, page.y, px, py).distPx)) continue;
      for (let c = 0; c < 3; c++) {
        const base = Math.abs((baseline.data[i + c] ?? 0) - (data[i + c] ?? 0));
        const moved = Math.abs((shipped.data[i + c] ?? 0) - (data[i + c] ?? 0));
        if (moved > INK_CAP || moved > base + INK_MARGIN) {
          bright++;
          break;
        }
      }
    }
  return bright
    ? [`${bright} ink pixels moved past their re-encode by ${INK_MARGIN} or over ${INK_CAP}`]
    : [];
}

function windowViolations(
  map: MapDef,
  page: { image: Image; x: number; y: number },
  shipped: Image,
): string[] {
  const strict = windowScan(map, page, shipped);
  const feather = windowScan(map, page, shipped, inFeather);
  const problems: string[] = [];
  if (strict.over)
    problems.push(
      `${strict.over} windows over ${WINDOW_MAX_ERROR}; worst ${strict.max.toFixed(1)} at ${strict.at}`,
    );
  if (feather.max > FEATHER_MAX_ERROR)
    problems.push(
      `feather windows over ${FEATHER_MAX_ERROR}; worst ${feather.max.toFixed(1)} at ${feather.at}`,
    );
  return problems;
}

it.each([
  ['driller-floor-scene', QUARRY_FLOOR, () => driller, DRILLER_GROUND_REGIONS],
  ['cutting-scene', AMBUSH_ROAD, () => cutting, CUTTING_GROUND_REGIONS],
  ['quarry-gate-scene', QUARRY_GATE, () => gate, QUARRY_GATE_GROUND_REGIONS],
] as const)(
  "ships %s pages that keep the packer's alpha and everything outside the floor fill",
  async (root, map, built, regions) => {
    for (const region of regions) {
      const shipped = await decodeWebp(
        new Uint8Array(readFileSync(`public/art/maps/${root}/${region.name}.webp`)),
      );
      const page = plate(built(), region.name);
      expect(footprintViolations(map, page, shipped), region.name).toEqual([]);
      expect(windowViolations(map, page, shipped), `${root}/${region.name} windows`).toEqual([]);
      const baseline = await reencoded(`${root}/${region.name}`, page.image);
      expect(inkViolations(map, page, shipped, baseline), `${root}/${region.name} ink`).toEqual([]);
    }
  },
);

it('holds the window bound above the encoder noise of an unchanged page', async () => {
  for (const [map, built, regions] of [
    [QUARRY_FLOOR, driller, DRILLER_GROUND_REGIONS],
    [AMBUSH_ROAD, cutting, CUTTING_GROUND_REGIONS],
    [QUARRY_GATE, gate, QUARRY_GATE_GROUND_REGIONS],
  ] as const)
    for (const region of regions) {
      const page = plate(built, region.name);
      const again = await decodeWebp(await encodeWebp(page.image, QUARRY_GROUND_QUALITY, true));
      const { max, over } = windowScan(map, page, again);
      expect(over, `${region.name} re-encode (worst ${max.toFixed(1)})`).toBe(0);
      expect(windowScan(map, page, again, inFeather).max).toBeLessThan(FEATHER_MAX_ERROR);
    }
});

it('ships the plates the packers build, inside the registered page', async () => {
  for (const [root, built, regions] of [
    ['driller-floor-scene', driller, DRILLER_GROUND_REGIONS],
    ['cutting-scene', cutting, CUTTING_GROUND_REGIONS],
    ['quarry-gate-scene', gate, QUARRY_GATE_GROUND_REGIONS],
  ] as const)
    for (const region of regions) {
      const { image } = plate(built, region.name);
      // The stone and limestone pages are the pre-existing 2050 px full-board
      // pages; nothing here may grow a plate past them.
      expect(Math.max(image.width, image.height), `${region.name} size`).toBeLessThanOrEqual(2050);
      expect(image.width).toBeLessThanOrEqual(QUARRY_PAGE.width);
      // The pages are the packer's plates with their floor-level interiors
      // replaced by generated floor material (docs/art/quarry-floor-fill.md),
      // so they are pinned by hash rather than rebuilt: see SHIPPED_FLOOR_FILL.
      expect(
        createHash('sha256')
          .update(readFileSync(`public/art/maps/${root}/${region.name}.webp`))
          .digest('hex'),
        `${root}/${region.name}.webp`,
      ).toBe(SHIPPED_FLOOR_FILL[`${root}/${region.name}`]);
    }
  expect(Math.max(pool.width, pool.height), 'pool-bank size').toBeLessThanOrEqual(2048);
  expect(
    Buffer.from(await encodeWebp(pool, QUARRY_GROUND_QUALITY, true)),
    CUTTING_POOL_OUTPUT,
  ).toEqual(readFileSync(CUTTING_POOL_OUTPUT));
});

/**
 * The `bytes` field of each generated region table is a pin, not a comment:
 * `quarryProjected.ts` drops it before the scene sees it, so nothing at runtime
 * would notice a page re-encoded behind the table's back. The pages are
 * approved art (The Cutting's especially), so a repack has to show up here.
 */
/**
 * The gate's region table is shipped in the runtime bundle, which is at its
 * budget, so its pins live here rather than as a `bytes` field on each region.
 */
const QUARRY_GATE_GROUND_BYTES = [
  { name: 'earth-west', bytes: 40_864 },
  { name: 'earth-east', bytes: 41_264 },
  { name: 'road', bytes: 16_010 },
  { name: 'limestone', bytes: 36_966 },
] as const;

it('pins a size for every gate page', () => {
  expect(QUARRY_GATE_GROUND_BYTES.map(({ name }) => name)).toEqual(
    QUARRY_GATE_GROUND_REGIONS.map(({ name }) => name),
  );
});

it.each([
  ['driller-floor-scene', DRILLER_GROUND_REGIONS],
  ['cutting-scene', CUTTING_GROUND_REGIONS],
  ['quarry-gate-scene', QUARRY_GATE_GROUND_BYTES],
] as const)('pins every %s page to its recorded size on disk', (root, regions) => {
  expect(regions.length).toBeGreaterThan(0);
  for (const region of regions)
    expect(
      statSync(`public/art/maps/${root}/${region.name}.webp`).size,
      `${root}/${region.name}.webp`,
    ).toBe(region.bytes);
});

it("pins the Cutting's pool plate to its recorded size on disk", () => {
  expect(statSync(CUTTING_POOL_OUTPUT).size).toBe(CUTTING_POOL_BYTES);
});

/**
 * M6. The drill shaft and the four gantry decks are plates of their own over
 * the Driller's pages: shipped as the packer builds them, registered where it
 * puts them, pinned on disk, and painted only in the game's wood, pit and ink.
 */
it("ships, registers and pins the Driller's shaft and gantry plates", async () => {
  const built: [string, Plate][] = [
    ['shaft', buildDrillerShaft()],
    ...DRILLER_GANTRY_CELLS.map((cell): [string, Plate] => [
      `gantry-${cell.x}-${cell.y}`,
      buildDrillerGantry(cell),
    ]),
  ];
  expect(DRILLER_PLATES.map(({ name }) => name)).toEqual(built.map(([name]) => name));
  const allowed = new Set<string>([
    INK,
    ...Object.values(TERRAIN_STYLES.wood),
    ...Object.values(TERRAIN_STYLES.pit),
  ]);
  for (const [name, { image, x, y }] of built) {
    const region = DRILLER_PLATES.find((plate) => plate.name === name);
    expect(region, name).toBeDefined();
    if (!region) continue;
    expect({ x, y, width: image.width, height: image.height }).toEqual({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    });
    const path = `public/art/maps/driller-floor-scene/${name}.webp`;
    expect(Buffer.from(await encodeWebp(image, QUARRY_GROUND_QUALITY, true)), path).toEqual(
      readFileSync(path),
    );
    expect(statSync(path).size, path).toBe(region.bytes);
    const off: string[] = [];
    for (let i = 0; i < image.data.length; i += 4) {
      if ((image.data[i + 3] ?? 0) === 0) continue;
      const hex = toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]);
      if (!allowed.has(hex)) off.push(hex);
    }
    expect(off, `${name} paints only wood, pit and ink`).toEqual([]);
  }
  // One deck per perch, and the shaft is the whole of legend `P`.
  expect(DRILLER_GANTRY_CELLS).toEqual(
    QUARRY_FLOOR.rows.flatMap((row, y) =>
      [...row].flatMap((k, x) => (k === 'A' ? [{ x, y }] : [])),
    ),
  );
});

/**
 * A decorative spoil heap is drawn whole or not at all. Sampled over the whole
 * board along every heap's chip rim, the one tone of a heap the ground round it
 * does not carry at every point: a heap the packers' shared fit rule
 * (`heapFits`) admits must show all of its rim, so none is cut by a lane edge,
 * a ledge, a wall base or a cover cell into a sliver. Each is ground texture —
 * uninked (the shoulder and floor tests hold ink off plain ground) and under a
 * third of a tile across — and there are enough of them that no page is bare.
 */
it.each([
  ['cutting', () => cutting, AMBUSH_ROAD, openFloor(AMBUSH_ROAD, 'spoil'), 5],
  ['driller', () => driller, QUARRY_FLOOR, openFloor(QUARRY_FLOOR, 'earth'), 5],
  ['gate', () => gate, QUARRY_GATE, plainSpoil, 5],
] as const)(
  'draws every %s decorative heap whole and small',
  (_scene, built, map, carries, atLeast) => {
    const rim: string = QUARRY_GROUND_TONES.spoil.rim;
    const heaps = new Map<string, { hits: number; all: number; radius: number; fits: boolean }>();
    // Every painted pixel, read at its own centre, exactly where the packer
    // decided its colour, so no sample can fall across a pixel boundary.
    for (const [, { image, x: originX, y: originY }] of built())
      for (let py = 0; py < image.height; py++)
        for (let px = 0; px < image.width; px++) {
          const rgba = pixelAt(image, px, py);
          if (rgba[3] !== 255) continue;
          const wx = originX + px + 0.5,
            wy = originY + py + 0.5;
          const gx = ((wx - 768) / 64 + wy / 32) / 2,
            gy = (wy / 32 - (wx - 768) / 64) / 2;
          if (gx < 0 || gy < 0 || gx >= map.width || gy >= map.height) continue;
          if (heapClass(gx, gy) !== 'rim') continue;
          const heap = nearestHeap(gx, gy);
          if (!heap) continue;
          const key = `${heap.hx.toFixed(4)},${heap.hy.toFixed(4)}`;
          const tally = heaps.get(key) ?? {
            hits: 0,
            all: 0,
            radius: heap.radius,
            fits: heapFits(gx, gy, carries),
          };
          tally.all++;
          if (toHex([rgba[0], rgba[1], rgba[2]]) === rim) tally.hits++;
          heaps.set(key, tally);
        }
    let whole = 0;
    for (const [key, { hits, all, radius, fits }] of heaps) {
      if (!fits) continue;
      whole++;
      expect(hits, `heap at ${key}: ${hits} of ${all} rim pixels`).toBe(all);
      expect(radius, `heap at ${key} radius`).toBeLessThan(0.25);
    }
    expect(whole).toBeGreaterThanOrEqual(atLeast);
  },
);
