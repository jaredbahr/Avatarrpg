import { expect, it } from 'vitest';
import { FOREST_GROUND_ROWS, FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { pixelAt, toHex } from './lib/image';
import { expectPackerAlpha, expectShippedPin } from './lib/shipped-pin';
import { FOREST_INK, FOREST_PIECE_TONES, loadForestMaterial } from './forest-village-material';
import {
  BED_DEEP_AT,
  BED_DEEP_BAND,
  FOREST_POND,
  INK_HALF,
  MARGIN_LEVEL,
  MARGIN_LEVEL_WANDER,
  SHORE_BLUR,
  blurredWater,
  organicShore,
  packShoreline,
  pondInset,
  SHORE_OUTPUT,
  WET_BANK,
  shorePosition,
  shoreDistance,
} from './forest-shoreline';

const luminance = (pixel: readonly number[]): number =>
  0.299 * (pixel[0] ?? 0) + 0.587 * (pixel[1] ?? 0) + 0.114 * (pixel[2] ?? 0);

const material = await loadForestMaterial();
const { image, bedPixels, bitePixels } = packShoreline(material);
const inset = pondInset(image.width, image.height);
const BED_HEXES = new Set<string>(Object.values(FOREST_PIECE_TONES.bed));

/** Generated 2026-10-03 (see docs/art/forest-pond-shoreline.md); not packer output. */
const POND_PIN = {
  bytes: 53422,
  sha256: '5c9c9772389e1aef7fd54e09fdd56ecfc4312d8a5be75b8a7b2d07bb0dc59d80',
};

it('ships the generated pond plate on the packer footprint', async () => {
  expectShippedPin(SHORE_OUTPUT, POND_PIN);
  await expectPackerAlpha(SHORE_OUTPUT, image);
});

it('paints only the damp margin, the bed and the ink', () => {
  const allowed = new Set<string>([FOREST_INK]);
  for (const key of ['margin', 'bed'] as const)
    for (const hex of Object.values(FOREST_PIECE_TONES[key])) allowed.add(hex);
  const seen = new Set<string>();
  for (let i = 0; i < image.data.length; i += 4) {
    if ((image.data[i + 3] ?? 0) === 0) continue;
    seen.add(toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]));
  }
  // Flat tones only: a colour outside the DL-2 §3 water-margin rows would be
  // the continuous tone a baked gradient needs in order to exist.
  expect([...seen].filter((hex) => !allowed.has(hex))).toEqual([]);
  for (const hex of [
    FOREST_PIECE_TONES.margin.base,
    FOREST_PIECE_TONES.bed.base,
    FOREST_PIECE_TONES.bed.shadow,
  ])
    expect(seen, `${hex} is painted`).toContain(hex);
  // The DL-2 W5 gate: a `#7ec8e3` band on the wet line's water side read as a
  // UI selection ring round the pond, so the ink meets the bed directly.
  expect(seen, 'no waterline halo').not.toContain(FOREST_PIECE_TONES.bed.rim);
});

it('keeps the organic bank and the opaque bed of ADR 0045', () => {
  expect(FOREST_POND.organic).toBe(true);
  let leaks = 0,
    wetDryBank = 0,
    waterPixels = 0,
    clearWater = 0,
    deepestBank = 0,
    strayInk = 0;
  /** Mean brightness of the plate's own bands: the dry bank and the bed. */
  const band = {
    bank: { n: 0, sum: 0 },
    shelf: { n: 0, sum: 0 },
    deep: { n: 0, sum: 0 },
  };
  // The margin gives out where the blurred water falls to its wandering
  // level, and that level never drops below this: nothing past it is painted.
  const marginFloor = MARGIN_LEVEL - MARGIN_LEVEL_WANDER / 2;
  const wetBank = new Map<string, number>();
  let shadowUnderFilm = 0;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const { x, y } = shorePosition(px, py);
      const distance = shoreDistance(x, y);
      const pixel = pixelAt(image, px, py);
      const [r, g, b, alpha] = pixel;
      const hex = toHex(pixel.slice(0, 3));
      if (distance > 0 && alpha > 0 && blurredWater(x, y, FOREST_WATER_CELLS) <= marginFloor)
        leaks++;
      // Outside the water the plate is dry land: nothing there may be wet-keyed.
      if (distance > 0 && alpha > 0 && b > r + 5 && g > r + 5) wetDryBank++;
      if (distance > 0 && distance <= 0.06 && alpha === 255) {
        band.bank.n++;
        band.bank.sum += luminance(pixel);
      }
      const inside = inset[py * image.width + px] ?? 0;
      if (inside <= 0) continue;
      waterPixels++;
      // The bed is opaque across the whole pond, so the 0.4-alpha water film
      // always tints authored bottom rather than bare backdrop.
      if (alpha === 0) clearWater++;
      if (inside >= 0.3 && inside < 0.6) {
        band.shelf.n++;
        band.shelf.sum += luminance(pixel);
      }
      if (inside >= 0.9) {
        band.deep.n++;
        band.deep.sum += luminance(pixel);
      }
      const fromLine = organicShore(x, y, FOREST_WATER_CELLS);
      if (fromLine < 0) deepestBank = Math.max(deepestBank, inside);
      // The ink is the wet line and nothing else.
      if ((hex === FOREST_INK) !== Math.abs(fromLine) < INK_HALF) strayInk++;
      if (hex === FOREST_PIECE_TONES.margin.shadow) shadowUnderFilm++;
      // Clear of the ink, the bank shows only its own paint.
      if (fromLine < -2 * INK_HALF) wetBank.set(hex, (wetBank.get(hex) ?? 0) + 1);
    }
  expect({ leaks, wetDryBank, clearWater, strayInk }).toEqual({
    leaks: 0,
    wetDryBank: 0,
    clearWater: 0,
    strayInk: 0,
  });
  expect(bedPixels + bitePixels).toBe(waterPixels);
  // The bank never reaches half a cell in: the middle of every water tile
  // stays water, and the rules' tile is never repainted as dry.
  expect(deepestBank).toBeLessThan(0.4);
  // The shore really does come in, without eating the pond.
  expect(bitePixels / waterPixels).toBeGreaterThan(0.15);
  expect(bitePixels / waterPixels).toBeLessThan(0.4);
  /*
   * The bed still deepens away from the shore (ADR 0045) — but by *which* of
   * its two flat tones a pixel takes, not by a ramp: the deep tone's share
   * rises across `BED_DEEP_BAND`, so these band means fall while every pixel
   * stays one of the table's keys.
   */
  const mean = (b: { n: number; sum: number }): number => b.sum / b.n;
  expect(mean(band.shelf)).toBeLessThan(mean(band.bank) * 0.85);
  expect(mean(band.deep)).toBeLessThan(mean(band.shelf) * 0.8);
  expect(BED_DEEP_AT).toBeGreaterThan(BED_DEEP_BAND / 2);
  // Under the water film the bank keeps the damp margin's base and rim. Its
  // shadow there, darkened again by the film, read as a grey-olive band of mud
  // round the water (the DL-2 W5 gate), so no wet pixel takes it; and the
  // bank's lifted rim patches really are painted, so the choice is exercised.
  expect(shadowUnderFilm).toBe(0);
  expect([...wetBank.keys()].sort()).toEqual([WET_BANK.field, WET_BANK.lifted].sort());
  expect(wetBank.get(WET_BANK.field) ?? 0).toBeGreaterThan(wetBank.get(WET_BANK.lifted) ?? 0);
  // Every real water centre carries bed, and muted bed at that: the middle of
  // a tile is never dry bank, and never the brightest thing in the pond.
  for (const { x, y } of FOREST_WATER_CELLS) {
    const px = Math.round((768 + (x - y) * 64 - 560) * 2);
    const py = Math.round(((x + y + 1) * 32 - 304) * 2);
    let clearSamples = 0;
    let brightest = 0;
    for (let oy = -12; oy <= 12; oy++)
      for (let ox = -12; ox <= 12; ox++) {
        const sample = pixelAt(image, px + ox, py + oy);
        if (sample[3] === 0) clearSamples++;
        brightest = Math.max(brightest, luminance(sample));
      }
    expect(clearSamples, `water at ${x},${y}`).toBe(0);
    expect(brightest, `water at ${x},${y}`).toBeLessThan(mean(band.bank));
  }
});

it('rounds the shore off the steps of the cells', () => {
  /*
   * docs/art-bible.md: construction seams disappear in normal presentation.
   * A shore held a fixed distance inside the cells keeps every step they make
   * as a sharp corner, so the bed runs to within about the bite times root two
   * of each corner a water cell pushes out (0.20 cells at worst, measured on
   * the plain packer) and within the bite of each corner the land pushes in
   * (0.09). The organic shore rounds both: the blur takes the water's corners
   * off and the bite, measured in a straight line from the land, turns each
   * land corner on a circle.
   */
  const bed: { x: number; y: number }[] = [];
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++)
      if (
        (inset[py * image.width + px] ?? 0) > 0 &&
        BED_HEXES.has(toHex(pixelAt(image, px, py).slice(0, 3)))
      )
        bed.push(shorePosition(px, py));
  const water = new Set(FOREST_WATER_CELLS.map((c) => `${c.x},${c.y}`));
  const wet = (x: number, y: number): number => (water.has(`${x},${y}`) ? 1 : 0);
  const clearance = { convex: Infinity, concave: Infinity };
  let corners = 0;
  for (let y = 0; y <= 12; y++)
    for (let x = 0; x <= 20; x++) {
      const quadrants = wet(x - 1, y - 1) + wet(x, y - 1) + wet(x - 1, y) + wet(x, y);
      const kind = quadrants === 1 ? 'convex' : quadrants === 3 ? 'concave' : null;
      if (!kind) continue;
      corners++;
      for (const b of bed)
        if (Math.abs(b.x - x) < 0.8 && Math.abs(b.y - y) < 0.8)
          clearance[kind] = Math.min(clearance[kind], Math.hypot(b.x - x, b.y - y));
    }
  expect(corners).toBe(10);
  expect(clearance.convex).toBeGreaterThan(0.3);
  expect(clearance.concave).toBeGreaterThan(0.15);
  // And the blur stays short of every water cell's middle.
  expect(SHORE_BLUR).toBeLessThan(0.7);
});

it('keeps the bed blue enough for the authored-water gate', () => {
  // `e2e/renderer.spec.ts` wants blue minus red above 20 where the rules say
  // water, and the pond bed is what the 0.4-alpha film tints. Both bed tones
  // clear it on their own, so no rasteriser has to make up the difference.
  for (const hex of [FOREST_PIECE_TONES.bed.base, FOREST_PIECE_TONES.bed.shadow]) {
    const red = Number.parseInt(hex.slice(1, 3), 16);
    const blue = Number.parseInt(hex.slice(5, 7), 16);
    expect(blue - red, hex).toBeGreaterThan(20);
  }
});

it('preserves all nine permanent walkable water cells without adding shore collision', () => {
  const actual = FOREST_GROUND_ROWS.flatMap((row, y) =>
    [...row].flatMap((key, x) => (key === '~' ? [{ x, y }] : [])),
  );
  expect(actual).toEqual(FOREST_WATER_CELLS);
  expect(actual).toHaveLength(9);
  expect(FOREST_ROAD.legend['~']).toEqual({
    terrain: 'dirt',
    surface: 'water',
    surfaceDuration: -1,
  });
  // The map's two props (the barrel under the NE bank, the flask on the
  // thugs' island) stand well clear of the pond: nothing solid or spillable
  // sits in the water or on the shore ring round it.
  for (const { pos } of FOREST_ROAD.props)
    expect(shoreDistance(pos.x + 0.5, pos.y + 0.5), `${pos.x},${pos.y}`).toBeGreaterThan(1);
});
