import { expect, it } from 'vitest';
import { pixelAt } from './lib/image';
import type { Image } from './lib/image';
import { GARDEN_TONES, GRAIN } from './ba-dan-garden';
import {
  APRON_ALPHA_STEPS,
  APRON_FADE,
  apronDepth,
  apronLogical,
  apronPixel,
  packApron,
} from './ba-dan-exterior-apron';

const grassTones = new Set(Object.values(GARDEN_TONES).map((tone) => tone.join(',')));

// The shipped files are the ring cut into bands; `apron-plates.test.ts` proves
// that cut byte-for-byte. These are the ring's own promises.
it('packs an apron that never paints a playable pixel', () => {
  const image = packApron();

  let inside = 0,
    beyond = 0,
    opaque = 0,
    feather = 0,
    transitionHoles = 0;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const alpha = pixelAt(image, px, py)[3];
      const { x, y } = apronLogical(px, py);
      const depth = apronDepth(x, y);
      if (alpha === 0) {
        // A texel straddling the fade stays clear, so allow its width there.
        if (depth > 0.6 && depth < APRON_FADE - 0.05) transitionHoles++;
        continue;
      }
      if (depth <= 0) inside++;
      if (depth >= APRON_FADE) beyond++;
      if (alpha === 255) opaque++;
      else feather++;
      expect(APRON_ALPHA_STEPS).toContain(alpha);
    }
  expect({ inside, beyond }).toEqual({ inside: 0, beyond: 0 });
  expect(opaque, 'the plate has an opaque band').toBeGreaterThan(1_000);
  expect(feather, 'the fade uses broad flat alpha steps').toBeGreaterThan(1_000);
  expect(transitionHoles, 'stepped bands have no halftone holes before the outer edge').toBe(0);
});

it('starts opaque at the rim, has room for the whole band, and runs the roads on', () => {
  // Byte-identical to the shipped file, which the first test pins.
  const image = packApron();
  const alphaAt = (x: number, y: number): number => {
    const px = apronPixel(x, y);
    return pixelAt(image, px.x, px.y)[3];
  };
  expect(alphaAt(10.5, -0.05), 'north rim').toBe(255);
  expect(alphaAt(-0.05, 7.5), 'west road rim').toBe(255);
  expect(alphaAt(23.5, 16.05), 'south rim').toBe(255);
  expect(image.width, 'the plate covers the map and the band').toBe(3200);
  expect(image.height).toBe(1600);
  expect(apronDepth(-2.4, 8)).toBeGreaterThan(0);
  expect(apronDepth(26.4, 8)).toBeGreaterThan(0);

  const isGrass = (x: number, y: number): boolean => {
    const px = apronPixel(x, y);
    return grassTones.has(pixelAt(image, px.x, px.y).slice(0, 3).join(','));
  };
  // Share of an exit's painted texels, between two depths past the rim, that
  // are flagstone.
  const paved = (side: 'west' | 'east', from: number, to: number): number => {
    let stone = 0,
      all = 0;
    for (let depth = from; depth < to; depth += 0.05)
      for (let along = 7.1; along < 8.9; along += 0.05) {
        const x = side === 'west' ? -depth : 24 + depth;
        if (alphaAt(x, along) === 0) continue;
        all++;
        if (!isGrass(x, along)) stone++;
      }
    return stone / all;
  };
  // A road exit is whole at the rim and still a road out into the fade; grass
  // creeps into it rather than closing it off.
  for (const side of ['west', 'east'] as const) {
    const rim = paved(side, 0, 0.5);
    const fade = paved(side, 1.5, APRON_FADE);
    expect(rim, `${side} exit at the rim`).toBeGreaterThan(0.95);
    expect(fade, `${side} exit into the fade`).toBeGreaterThan(0.2);
    expect(fade, `${side} exit wears to grass`).toBeLessThan(rim - 0.2);
  }
  // Grass borders carry grass.
  expect(isGrass(10.5, -1.35), 'north lawn').toBe(true);
  expect(isGrass(-1.6, 3.5), 'west trees').toBe(true);
});

/**
 * Texels that differ from all four neighbours. An ordered screen is made of
 * them; painted clusters and flat bands have almost none. The class of a texel
 * is its coverage and, if painted, whether it is meadow.
 */
function singletons(image: Image): { singles: number; painted: number } {
  const w = image.width / GRAIN;
  const h = image.height / GRAIN;
  const cls = new Int8Array(w * h);
  for (let ty = 0; ty < h; ty++)
    for (let tx = 0; tx < w; tx++) {
      const rgba = pixelAt(image, tx * GRAIN, ty * GRAIN);
      cls[ty * w + tx] = rgba[3] === 0 ? 0 : grassTones.has(rgba.slice(0, 3).join(',')) ? 1 : 2;
    }
  let singles = 0,
    painted = 0;
  for (let ty = 1; ty < h - 1; ty++)
    for (let tx = 1; tx < w - 1; tx++) {
      const self = cls[ty * w + tx];
      const around = [
        cls[ty * w + tx - 1],
        cls[ty * w + tx + 1],
        cls[(ty - 1) * w + tx],
        cls[(ty + 1) * w + tx],
      ];
      // Only the band itself: a painted texel, or a hole with paint around it.
      if (self === 0 && around.every((c) => c === 0)) continue;
      if (self !== 0) painted++;
      if (around.every((c) => c !== self)) singles++;
    }
  return { singles, painted };
}

it('uses clusters and flat bands rather than a repeating ordered screen', () => {
  const { singles, painted } = singletons(packApron());
  expect(painted).toBeGreaterThan(10_000);
  // Measured: 45% for the 4x4 Bayer apron of 0fbcc40, 0.002% for this one.
  expect(singles / painted).toBeLessThan(0.02);
});
