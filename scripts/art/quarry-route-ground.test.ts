import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { QUARRY_FLOOR } from '../../src/content/maps/combat';
import { DRILLER_GROUND_REGIONS } from '../../src/content/scenes/quarryRouteGround';
import { QUARRY_GATE_GROUND_REGIONS } from '../../src/content/scenes/quarryGate';
import type { Image } from './lib/image';
import { pixelAt, toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import { FOREST_INK } from './forest-village-material';
import { QUARRY_GROUND_QUALITY, QUARRY_GROUND_TONES } from './quarry-village-material';
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
const gate: Built = await buildGateGround();

const plate = (built: Built, name: string) => {
  const found = built.get(name);
  if (!found) throw new Error(`no ${name} plate`);
  return found;
};

it.each([
  ['driller-floor-scene', () => driller, DRILLER_GROUND_REGIONS],
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
  for (const built of [driller, gate])
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
  for (const name of ['dirt-west', 'dirt-east']) {
    const m = measure(plate(driller, name).image);
    expect(Math.max(VILLAGE / m.mean, m.mean / VILLAGE), `floor ${name}`).toBeLessThan(1.3);
  }
});

it('gives every ledge and hazard diamond an ink edge', () => {
  const { image, x: originX, y: originY } = plate(driller, 'stone');
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
  for (let y = 0; y < QUARRY_FLOOR.height; y++)
    for (let x = 0; x < QUARRY_FLOOR.width; x++) {
      const key = QUARRY_FLOOR.rows[y]?.[x];
      if (key !== 'r' && key !== 'o') continue;
      checked++;
      expect(inkOnRim(x, y), `hazard '${key}' at ${x},${y} carries ink`).toBe(true);
    }
  // The floor has four oil pairs and four rubble cells; the old pass painted
  // every one of them with the same field as the floor and no edge at all.
  expect(checked).toBeGreaterThan(8);

  // The ledge mass is a long boundary with the floor, so its ink is thousands
  // of pixels of 2 px line rather than a stray fleck.
  let inked = 0;
  for (let i = 0; i < image.data.length; i += 4)
    if (toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]) === INK)
      inked++;
  expect(inked).toBeGreaterThan(5_000);
});

it('ships the plates the packers build, inside the registered page', async () => {
  for (const [root, built, regions] of [
    ['driller-floor-scene', driller, DRILLER_GROUND_REGIONS],
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
