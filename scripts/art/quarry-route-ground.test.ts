import { readFileSync, statSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AMBUSH_ROAD, QUARRY_FLOOR, QUARRY_GATE } from '../../src/content/maps/combat';
import {
  CUTTING_GROUND_REGIONS,
  DRILLER_GROUND_REGIONS,
} from '../../src/content/scenes/quarryRouteGround';
import { QUARRY_GATE_GROUND_REGIONS } from '../../src/content/scenes/quarryGate';
import type { Image } from './lib/image';
import { pixelAt, toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import { FOREST_INK } from './forest-village-material';
import {
  HEAP_INK,
  QUARRY_GROUND_QUALITY,
  QUARRY_GROUND_TONES,
  nearestHeap,
} from './quarry-village-material';
import { QUARRY_PAGE, buildQuarryGround } from './quarry-route-ground';
import { buildGateGround } from './quarry-modular-ground';
import { luma, measure, readPlate } from './forest-ground-measure';

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
  for (const built of [driller, cutting, gate])
    for (const [, { image }] of built)
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

it.each([
  // The floor has four oil pairs and four rubble cells; the old pass painted
  // every one of them with the same field as the floor and no edge at all.
  ['driller', () => driller, QUARRY_FLOOR, 8],
  // The Cutting's four rubble cells lie on its spoil shoulders, the same
  // material as the ground round them, so their ink is the whole of their edge.
  ['cutting', () => cutting, AMBUSH_ROAD, 4],
] as const)(
  'gives every %s ledge and hazard diamond an ink edge',
  (_scene, built, map, hazards) => {
    const { image, x: originX, y: originY } = plate(built(), 'stone');
    const isInk = (gx: number, gy: number): boolean => {
      const rgba = pixelAt(
        image,
        Math.round(768 + (gx - gy) * 64 - originX - 0.5),
        Math.round((gx + gy) * 32 - originY - 0.5),
      );
      return toHex([rgba[0], rgba[1], rgba[2]]) === INK;
    };
    /**
     * Walk inward from the midpoint of each of the diamond's four cell edges.
     * The ink is a 2 px line, which is 0.014 of a tile either side of the edge,
     * so a single sample at a fixed inset would be a coin toss against rounding.
     */
    const inkOnRim = (cx: number, cy: number): boolean => {
      for (let t = 0.002; t < 0.04; t += 0.002)
        if (
          isInk(cx + t, cy + 0.5) ||
          isInk(cx + 1 - t, cy + 0.5) ||
          isInk(cx + 0.5, cy + t) ||
          isInk(cx + 0.5, cy + 1 - t)
        )
          return true;
      return false;
    };

    let checked = 0;
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const key = map.rows[y]?.[x];
        if (key !== 'r' && key !== 'o') continue;
        checked++;
        expect(inkOnRim(x, y), `hazard '${key}' at ${x},${y} carries ink`).toBe(true);
      }
    expect(checked).toBeGreaterThanOrEqual(hazards);

    // The ledge mass is a long boundary with the floor, so its ink is thousands
    // of pixels of 2 px line rather than a stray fleck.
    let inked = 0;
    for (let i = 0; i < image.data.length; i += 4)
      if (toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]) === INK)
        inked++;
    expect(inked).toBeGreaterThan(5_000);
  },
);

/**
 * DL-2 W4. The Cutting is the gate's road layout cut between ledges, and it
 * takes the gate's reading of it: a packed-earth cart lane with its haul
 * tracks, and spoil shoulders carrying inked heaps of cut stone. Read cell by
 * cell off the built plates, so neither the lane nor a clipped heap can drift.
 */
it("keeps the Cutting's lane apart from its spoil shoulders", () => {
  const lane = new Set<string>(
    [QUARRY_GROUND_TONES.earth, QUARRY_GROUND_TONES.rut, QUARRY_GROUND_TONES.wear].flatMap((t) =>
      Object.values(t),
    ),
  );
  // Spoil, and the whole heaps of cut stone on it: limestone body, block rim.
  const shoulder = new Set<string>(
    [QUARRY_GROUND_TONES.spoil, QUARRY_GROUND_TONES.limestone, QUARRY_GROUND_TONES.block].flatMap(
      (t) => Object.values(t),
    ),
  );
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
        expect(tally.lane, `shoulder ${x},${y} has no earth`).toBe(0);
        // A heap's own ink outline is part of the shoulder's painting.
        expect(
          (tally.shoulder + tally.ink) / tally.all,
          `shoulder ${x},${y} is spoil`,
        ).toBeGreaterThan(0.95);
      }
    }
  expect(lanes).toBeGreaterThan(50);
  expect(shoulders).toBeGreaterThan(70);
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
      expect(
        Buffer.from(await encodeWebp(image, QUARRY_GROUND_QUALITY, true)),
        `${root}/${region.name}.webp`,
      ).toEqual(readFileSync(`public/art/maps/${root}/${region.name}.webp`));
    }
});

/**
 * The `bytes` field of each generated region table is a pin, not a comment:
 * `quarryProjected.ts` drops it before the scene sees it, so nothing at runtime
 * would notice a page re-encoded behind the table's back. The pages are
 * approved art (The Cutting's especially), so a repack has to show up here.
 */
it.each([
  ['driller-floor-scene', DRILLER_GROUND_REGIONS],
  ['cutting-scene', CUTTING_GROUND_REGIONS],
] as const)('pins every %s page to its recorded size on disk', (root, regions) => {
  expect(regions.length).toBeGreaterThan(0);
  for (const region of regions)
    expect(
      statSync(`public/art/maps/${root}/${region.name}.webp`).size,
      `${root}/${region.name}.webp`,
    ).toBe(region.bytes);
});

/**
 * A spoil heap is drawn whole or not at all. Sampled over the whole board: every
 * heap whose body shows anywhere must show its body everywhere, so none is cut
 * by a lane edge, a ledge, a wall base or a cover cell into a sliver (the fit
 * rule both packers share, `heapFits`).
 */
it.each([
  ['cutting', () => cutting, AMBUSH_ROAD, ['dirt-west', 'dirt-east'], 3],
  ['gate', () => gate, QUARRY_GATE, ['earth-west', 'earth-east'], 5],
] as const)('draws every %s spoil heap whole', (_scene, built, map, pages, atLeast) => {
  const body = new Set<string>(Object.values(QUARRY_GROUND_TONES.limestone));
  const heaps = new Map<string, { hits: number; all: number }>();
  const step = 0.02;
  for (let gy = step / 2; gy < map.height; gy += step)
    for (let gx = step / 2; gx < map.width; gx += step) {
      const heap = nearestHeap(gx, gy);
      // Well inside the body, clear of the ink line and of pixel rounding.
      if (!heap || heap.distance > -HEAP_INK - 0.02) continue;
      const key = `${heap.hx.toFixed(4)},${heap.hy.toFixed(4)}`;
      const tally = heaps.get(key) ?? { hits: 0, all: 0 };
      tally.all++;
      const { image, x: originX, y: originY } = plate(built(), pages[gx < 10 ? 0 : 1]);
      const rgba = pixelAt(
        image,
        Math.floor(768 + (gx - gy) * 64 - originX),
        Math.floor((gx + gy) * 32 - originY),
      );
      if ((rgba[3] ?? 0) === 255 && body.has(toHex([rgba[0], rgba[1], rgba[2]]))) tally.hits++;
      heaps.set(key, tally);
    }
  let whole = 0;
  for (const [key, { hits, all }] of heaps) {
    expect(hits === 0 || hits === all, `heap at ${key}: ${hits} of ${all} body samples`).toBe(true);
    if (hits === all) whole++;
  }
  expect(whole).toBeGreaterThanOrEqual(atLeast);
});
