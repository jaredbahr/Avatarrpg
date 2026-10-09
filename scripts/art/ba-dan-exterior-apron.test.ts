import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  BA_DAN_APRON_BANDS,
  BA_DAN_EXTERIOR_APRON,
  BA_DAN_FRAME,
} from '../../src/content/scenes/baDan';
import { apronPlatePath } from './lib/apron-plates';
import { pixelAt } from './lib/image';
import type { Image } from './lib/image';
import { decodeWebp } from './lib/webp';
import { GRAIN, worldLogical } from './ba-dan-garden';
import {
  APRON_ALPHA_STEPS,
  APRON_BANK_MIN,
  APRON_BANK_SOFT,
  APRON_FADE,
  DIRECTORY,
  FRAME_BANK_MAX,
  FRAME_BANK_MIN,
  FRAME_START,
  STEM,
  apronBank,
  apronDepth,
  apronLogical,
  apronPixel,
  farGround,
  packApron,
  packFrame,
} from './ba-dan-exterior-apron';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const isGrassRgb = (rgba: readonly number[]): boolean => (rgba[1] ?? 0) >= (rgba[0] ?? 0);

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
        // The margin is ground up to its wandering low bank, which is never
        // nearer than `APRON_BANK_MIN`; a clear texel inside that is a hole.
        // (This used to be the whole fade; the fade was the defect, a
        // gradient into the page, so the premise is now the bank.)
        if (depth > 0.6 && depth < APRON_BANK_MIN - APRON_BANK_SOFT - 0.05) transitionHoles++;
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
  expect(feather, 'the bank edge is antialiased in a few small alpha steps').toBeGreaterThan(1_000);
  expect(transitionHoles, 'the margin has no holes before its bank').toBe(0);
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
    return isGrassRgb(pixelAt(image, px.x, px.y));
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
  // A road exit is whole at the rim and still a road out into the fade. It used to give up half
  // its stone to grass by the fade and end there; since the south and east frame the road runs on
  // as a road through a gap in the planting (`the south and east frame` below holds that, and that
  // it does thin further out), so here it only has to stay a road and never gain stone.
  const rim = paved('east', 0, 0.5);
  const fade = paved('east', 1.5, APRON_FADE);
  expect(rim, 'east exit at the rim').toBeGreaterThan(0.95);
  expect(fade, 'east exit into the fade').toBeGreaterThan(0.2);
  expect(fade, 'east exit does not gain stone').toBeLessThanOrEqual(rim);
  // The west road ends at the ford (`ba-dan-edges.ts` lays the water over
  // this): the apron carries no road on past it.
  expect(paved('west', 0, APRON_FADE), 'west road past the ford').toBeLessThan(0.1);
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
      cls[ty * w + tx] = rgba[3] === 0 ? 0 : isGrassRgb(rgba) ? 1 : 2;
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

it('ships a rim with no light fringe from the lossy encoder', async () => {
  // The bands are lossy. A clear texel's colour still feeds the encoder, and
  // black ones beside the rim smeared a light line along all of it.
  const ring = packApron();
  let rim = 0,
    fringe = 0;
  for (const [index, band] of BA_DAN_APRON_BANDS.entries()) {
    const shipped = await decodeWebp(readFileSync(apronPlatePath(DIRECTORY, STEM, index)));
    for (let py = 0; py < band.height; py++)
      for (let px = 0; px < band.width; px++) {
        const packed = pixelAt(ring, band.x + px, band.y + py);
        if (packed[3] !== 255) continue;
        const { x, y } = apronLogical(band.x + px, band.y + py);
        if (apronDepth(x, y) > 0.1) continue;
        rim++;
        const got = pixelAt(shipped, px, py);
        const luma = (c: readonly number[]): number =>
          0.299 * (c[0] ?? 0) + 0.587 * (c[1] ?? 0) + 0.114 * (c[2] ?? 0);
        if (Math.abs(got[2] - packed[2]) > 16 || luma(got) - luma(packed) > 12) fringe++;
      }
  }
  expect(rim).toBeGreaterThan(1_000);
  expect(fringe / rim).toBeLessThan(0.02);
});

it('uses clusters and flat bands rather than a repeating ordered screen', () => {
  const { singles, painted } = singletons(packApron());
  expect(painted).toBeGreaterThan(10_000);
  // Measured: 45% for the 4x4 Bayer apron of 0fbcc40, 0.002% for this one.
  expect(singles / painted).toBeLessThan(0.02);
});

/**
 * Where the tour's ten views sit (`.review/ingame-true6`, the scene's world pixel under the
 * screen's top-left corner), each 912 by 477 world pixels of map canvas at 1.5 screen pixels.
 */
const TOUR_VIEWS = [
  [568, -237],
  [824, -109],
  [568, 96],
  [1080, 96],
  [568, 430],
  [1080, 430],
  [623, 736],
  [1080, 764],
  [824, 837],
  [1080, 965],
] as const;

/** Whether the margin colour is what the player sees at a logical point, ground plates only. */
function showsMargin(x: number, y: number): boolean {
  const depth = apronDepth(x, y);
  if (depth <= 0) return false;
  const far = farGround(x, y);
  return far ? far.depth >= far.bank : depth >= apronBank(x, y);
}

describe('the south and east frame', () => {
  const frame = packFrame();
  const ringed = packApron();

  it('is a plate of ground that never reaches a playable pixel', () => {
    let painted = 0;
    for (let py = 0; py < frame.height; py++)
      for (let px = 0; px < frame.width; px++) {
        if ((pixelAt(frame, px, py)[3] ?? 0) === 0) continue;
        painted++;
        const { x, y } = worldLogical(BA_DAN_FRAME.x + px + 0.5, BA_DAN_FRAME.y + py + 0.5);
        expect(apronDepth(x, y), `(${px},${py}) is outside the board`).toBeGreaterThan(0);
        const far = farGround(x, y)!;
        expect(far, `(${px},${py}) is on the near edges`).not.toBeNull();
        expect(far.depth).toBeGreaterThanOrEqual(FRAME_START);
        expect(far.depth).toBeLessThan(far.bank + 1e-9);
      }
    expect(painted).toBeGreaterThan(600_000);
  });

  it('runs on from the apron in the same pixels, so the two meet without a seam', () => {
    // Both plates colour a texel through `frameColour` and bake it with the same light; where they
    // overlap (depth FRAME_START + 0.2 to APRON_FADE) both are opaque and must agree exactly.
    let compared = 0;
    for (let py = 0; py < frame.height; py += 3)
      for (let px = 0; px < frame.width; px += 3) {
        const f = pixelAt(frame, px, py);
        if (f[3] !== 255) continue;
        const wx = BA_DAN_FRAME.x + px;
        const wy = BA_DAN_FRAME.y + py;
        const a = pixelAt(ringed, wx - BA_DAN_EXTERIOR_APRON.x, wy - BA_DAN_EXTERIOR_APRON.y);
        if (a[3] !== 255) continue;
        compared++;
        expect([a[0], a[1], a[2]], `world (${wx},${wy})`).toEqual([f[0], f[1], f[2]]);
      }
    expect(compared, 'the overlap is real').toBeGreaterThan(1_000);
  });

  it('ends in a tree line of its own, between the bank limits, at every point of the edges', () => {
    const banks: number[] = [];
    for (let x = 0; x <= 24; x += 0.25) banks.push(farGround(x, 17)!.bank);
    for (let y = 0; y <= 16; y += 0.25) banks.push(farGround(25, y)!.bank);
    for (const bank of banks) {
      expect(bank).toBeGreaterThanOrEqual(FRAME_BANK_MIN - 1e-9);
      // A road exit pushes its own stretch out; nothing else goes past the maximum.
      expect(bank).toBeLessThanOrEqual(FRAME_BANK_MAX + 1.4 + 1e-9);
    }
    // It really wanders: more than a tile of difference along the edges.
    expect(Math.max(...banks) - Math.min(...banks)).toBeGreaterThan(1);
  });

  it('leaves the flat margin colour a small part of the tour wherever the near edges are in view', () => {
    // Before the frame the south and east views were 21%, 22% and 40% margin (views 7, 9, 10).
    const share = TOUR_VIEWS.map(([wx, wy]) => {
      let fill = 0;
      let all = 0;
      for (let sy = 0; sy < 477; sy += 4)
        for (let sx = 0; sx < 912; sx += 4) {
          const py = wy + 38 + sy;
          const px = wx + sx;
          const x = ((px - 1024) / 64 + py / 32) / 2;
          const y = (py / 32 - (px - 1024) / 64) / 2;
          all++;
          if (showsMargin(x, y)) fill++;
        }
      return fill / all;
    });
    for (const view of [6, 7, 8, 9]) expect(share[view], `view ${view + 1}`).toBeLessThan(0.08);
  });

  it('keeps both road exits a road well past the apron, leaving through the planting', () => {
    // Flagstone (reddish, bright) share along each exit's centre line: whole at the rim, still most
    // of the texels three tiles out, and a track that goes on to the tree line.
    const stone = (points: readonly (readonly [number, number])[]): number => {
      let rock = 0;
      for (const [x, y] of points) {
        const wx = Math.round(1024 + (x - y) * 64) - BA_DAN_FRAME.x;
        const wy = Math.round((x + y) * 32) - BA_DAN_FRAME.y;
        const [r, g, , a] = pixelAt(frame, wx, wy);
        if (a > 0 && r > g + 6 && r > 150) rock++;
      }
      return rock / points.length;
    };
    const south: (readonly [number, number])[] = [];
    const east: (readonly [number, number])[] = [];
    for (let d = 2.1; d <= 3.4; d += 0.05)
      for (const across of [-0.4, 0, 0.4]) {
        south.push([19.5 + across, 16 + d]);
        east.push([24 + d, 8 + across]);
      }
    const far: (readonly [number, number])[] = [];
    for (let d = 4.4; d <= 5.4; d += 0.05)
      for (const across of [-0.4, 0, 0.4]) far.push([19.5 + across, 16 + d]);
    expect(stone(far), 'south exit wears to a track by the tree line').toBeLessThan(
      stone(south) - 0.3,
    );
    expect(stone(south), 'south exit, depth 2.1 to 3.4').toBeGreaterThan(0.6);
    expect(stone(east), 'east exit, depth 2.1 to 3.4').toBeGreaterThan(0.6);
    // The tree line is further out at the exits than beside them.
    expect(farGround(19.5, 20)!.bank).toBeGreaterThan(farGround(15, 20)!.bank - 0.2);
    expect(farGround(19.5, 20)!.road).toBeGreaterThan(0.9);
    expect(farGround(26, 8)!.road).toBeGreaterThan(0.9);
  });
});
