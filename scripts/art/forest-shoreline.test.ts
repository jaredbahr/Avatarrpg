import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { pixelAt, toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GROUND_QUALITY,
  FOREST_INK,
  FOREST_PIECE_TONES,
  loadForestMaterial,
} from './forest-village-material';
import {
  BED_DEEP_AT,
  BED_DEEP_BAND,
  BITE_FEATHER,
  SHORE_BITE,
  SHORE_LIMIT,
  biteDepth,
  packShoreline,
  pondInset,
  SHORE_OUTPUT,
  shorePosition,
  shoreDistance,
} from './forest-shoreline';

const luminance = (pixel: readonly number[]): number =>
  0.299 * (pixel[0] ?? 0) + 0.587 * (pixel[1] ?? 0) + 0.114 * (pixel[2] ?? 0);

const material = await loadForestMaterial();
const { image, bedPixels, bitePixels } = packShoreline(material);
const inset = pondInset(image.width, image.height);

it('ships the pond plate the packer builds', async () => {
  expect(Buffer.from(await encodeWebp(image, FOREST_GROUND_QUALITY, true))).toEqual(
    readFileSync(SHORE_OUTPUT),
  );
});

it('paints only the damp margin, the bed, their rims and the ink', () => {
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
    FOREST_PIECE_TONES.bed.rim,
  ])
    expect(seen, `${hex} is painted`).toContain(hex);
});

it('keeps the bank, its wandering bite and the opaque bed of ADR 0045', () => {
  let missingBank = 0,
    leaks = 0,
    wetDryBank = 0,
    waterPixels = 0,
    clearWater = 0,
    intruding = 0,
    deepestBite = 0,
    deepBite = 0,
    featherBand = 0;
  /** Mean brightness of the plate's own bands: the dry bank and the bed. */
  const band = {
    bank: { n: 0, sum: 0 },
    shelf: { n: 0, sum: 0 },
    deep: { n: 0, sum: 0 },
    featherOuter: { n: 0, sum: 0 },
    featherInner: { n: 0, sum: 0 },
  };
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const { x, y } = shorePosition(px, py);
      const distance = shoreDistance(x, y);
      const pixel = pixelAt(image, px, py);
      const [r, g, b, alpha] = pixel;
      if (distance > 0 && distance <= 0.08 && alpha !== 255) missingBank++;
      if (distance >= SHORE_LIMIT && alpha !== 0) leaks++;
      // Outside the water the plate is dry land: nothing there may be wet-keyed.
      if (distance > 0 && alpha > 0 && b > r + 5 && g > r + 5) wetDryBank++;
      if (distance > 0 && distance <= 0.06 && alpha === 255) {
        band.bank.n++;
        band.bank.sum += luminance(pixel);
      }
      const inside = inset[py * image.width + px] ?? 0;
      if (inside > 0) {
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
        const depth = biteDepth(x, y);
        if (inside < depth) {
          intruding++;
          // The bank never reaches half a cell in: the middle of every water
          // tile stays water, and the rules' tile is never repainted as dry.
          deepestBite = Math.max(deepestBite, inside);
          if (inside > SHORE_BITE * 0.6) deepBite++;
        }
        if (inside > depth - BITE_FEATHER && inside < depth) {
          featherBand++;
          const slice =
            (depth - inside) / BITE_FEATHER > 0.6
              ? band.featherOuter
              : (depth - inside) / BITE_FEATHER < 0.4
                ? band.featherInner
                : null;
          if (slice) {
            slice.n++;
            slice.sum += luminance(pixel);
          }
        }
      }
    }
  expect({ missingBank, leaks, wetDryBank }).toEqual({
    missingBank: 0,
    leaks: 0,
    wetDryBank: 0,
  });
  expect(clearWater).toBe(0);
  expect(bedPixels + bitePixels).toBe(waterPixels);
  expect(deepestBite).toBeLessThanOrEqual(SHORE_BITE);
  // The shore really does come in, and wanders as it does: a uniform ring
  // would leave the pond reading as the rules' own cross.
  expect(intruding).toBeGreaterThan(5_000);
  expect(deepBite).toBeGreaterThan(300);
  expect(intruding / waterPixels).toBeLessThan(0.35);
  expect(featherBand).toBeGreaterThan(5_000);
  /*
   * The bed still deepens away from the shore (ADR 0045) — but by *which* of
   * its two flat tones a pixel takes, not by a ramp: the deep tone's share
   * rises across `BED_DEEP_BAND`, so these band means fall while every pixel
   * stays one of the table's keys.
   */
  const mean = (b: { n: number; sum: number }): number => b.sum / b.n;
  expect(mean(band.shelf)).toBeLessThan(mean(band.bank) * 0.85);
  expect(mean(band.deep)).toBeLessThan(mean(band.shelf) * 0.8);
  // The wet line: ink, with the §3 edge on its wet side and the margin's pale
  // rim on its dry one, so the bite's inner sliver runs pale to dark outward.
  expect(mean(band.featherOuter)).toBeGreaterThan(mean(band.featherInner));
  expect(BED_DEEP_AT).toBeGreaterThan(BED_DEEP_BAND / 2);
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

it('preserves all eight permanent walkable water cells without adding shore collision', () => {
  const actual = FOREST_ROAD.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) => (key === '~' ? [{ x, y }] : [])),
  );
  expect(actual).toEqual(FOREST_WATER_CELLS);
  expect(actual).toHaveLength(8);
  expect(FOREST_ROAD.legend['~']).toEqual({
    terrain: 'dirt',
    surface: 'water',
    surfaceDuration: -1,
  });
  expect(FOREST_ROAD.props).toEqual([]);
});
