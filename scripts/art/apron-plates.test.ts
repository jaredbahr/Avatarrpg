/**
 * The apron ships as bands, and these are the proofs that make that safe: the
 * bands cover the whole ring, cover it once, stay inside the texture the device
 * matrix promises, and are the exact rectangles the packed art was cut into.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BA_DAN_APRON_BANDS,
  BA_DAN_APRON_DEPTH,
  BA_DAN_APRON_MAP,
  BA_DAN_APRON_PIECES,
} from '../../src/content/scenes/baDan';
import {
  FOREST_APRON_BANDS,
  FOREST_APRON_DEPTH,
  FOREST_APRON_MAP,
  FOREST_APRON_PIECES,
  FOREST_APRON_SEAM,
} from '../../src/content/scenes/forestRoad';
import { apronBands, type ApronBand } from './lib/apron-bands';
import {
  DIRECTORY as BA_DAN_DIRECTORY,
  QUALITY as BA_DAN_QUALITY,
  STEM as BA_DAN_STEM,
  packApron,
} from './ba-dan-exterior-apron';
import {
  DIRECTORY as FOREST_DIRECTORY,
  QUALITY as FOREST_QUALITY,
  STEM as FOREST_STEM,
  packSceneApron,
} from './forest-exterior-apron';
import { apronPlatePath } from './lib/apron-plates';
import { crop } from './lib/trim';
import { encodeWebp } from './lib/webp';
import type { Image } from './lib/image';

/** The device matrix's promise: every iPad takes a 2048-pixel texture. */
const TEXTURE_CAP = 2048;
/** The plate's own faint feather still counts as painted; only clear texels do not. */
const PAINTED = 1;

interface Scene {
  readonly name: string;
  readonly ring: Image;
  readonly bands: readonly ApronBand[];
}

const village: Scene = { name: 'Ba Dan', ring: packApron(), bands: BA_DAN_APRON_BANDS };
const forest: Scene = {
  name: 'Forest Road',
  ring: await packSceneApron(),
  bands: FOREST_APRON_BANDS,
};
const scenes = [village, forest];

describe('the ring the scene registers', () => {
  it('is the table the geometry computes from each map', () => {
    expect([...BA_DAN_APRON_BANDS]).toEqual(
      apronBands({ ...BA_DAN_APRON_MAP, depth: BA_DAN_APRON_DEPTH }),
    );
    expect([...FOREST_APRON_BANDS]).toEqual(
      apronBands({ ...FOREST_APRON_MAP, depth: FOREST_APRON_DEPTH, inset: FOREST_APRON_SEAM }),
    );
  });

  it('keeps every band inside the texture every iPad takes', () => {
    for (const scene of scenes)
      for (const [index, band] of scene.bands.entries())
        expect(
          Math.max(band.width, band.height),
          `${scene.name} band ${index} is ${band.width}x${band.height}`,
        ).toBeLessThanOrEqual(TEXTURE_CAP);
  });

  it('covers the whole plate, once, from bands that do not overlap', () => {
    for (const scene of scenes) {
      const { ring, bands } = scene;
      const covered = new Uint8Array(ring.width * ring.height);
      for (const band of bands) {
        expect(band.x, `${scene.name} band starts on the plate`).toBeGreaterThanOrEqual(0);
        expect(band.y).toBeGreaterThanOrEqual(0);
        expect(band.x + band.width, `${scene.name} band ends on the plate`).toBeLessThanOrEqual(
          ring.width,
        );
        expect(band.y + band.height).toBeLessThanOrEqual(ring.height);
        for (let y = band.y; y < band.y + band.height; y++)
          for (let x = band.x; x < band.x + band.width; x++)
            covered[y * ring.width + x] = (covered[y * ring.width + x] ?? 0) + 1;
      }
      let painted = 0;
      let missed = 0;
      let doubled = 0;
      for (let y = 0; y < ring.height; y++)
        for (let x = 0; x < ring.width; x++) {
          const count = covered[y * ring.width + x] ?? 0;
          if (count > 1) doubled++;
          if ((ring.data[(y * ring.width + x) * 4 + 3] ?? 0) < PAINTED) continue;
          painted++;
          if (count === 0) missed++;
        }
      expect(painted, `${scene.name} has painted apron`).toBeGreaterThan(100_000);
      expect(missed, `${scene.name} pixels no band covers`).toBe(0);
      expect(doubled, `${scene.name} pixels two bands cover`).toBe(0);
    }
  });

  it('drops most of the clear texels the single plate carried', () => {
    for (const scene of scenes) {
      const area = scene.bands.reduce((total, band) => total + band.width * band.height, 0);
      const plate = scene.ring.width * scene.ring.height;
      expect(
        area,
        `${scene.name} bands hold ${(area / 1e6).toFixed(2)}M of ${(plate / 1e6).toFixed(2)}M texels`,
      ).toBeLessThan(plate * 0.5);
    }
  });

  it('is the ground the scene itself lists, offset by the ring', () => {
    expect(BA_DAN_APRON_PIECES).toHaveLength(BA_DAN_APRON_BANDS.length);
    expect(FOREST_APRON_PIECES).toHaveLength(FOREST_APRON_BANDS.length);
    for (const [index, piece] of BA_DAN_APRON_PIECES.entries())
      expect(piece.url).toBe(`art/maps/ba-dan-scene/exterior-apron-${index}.webp`);
    for (const [index, piece] of FOREST_APRON_PIECES.entries())
      expect(piece.url).toBe(`art/maps/forest-scene/exterior-apron-${index}.webp`);
  });
});

describe('the art on disk', () => {
  it('is the packed ring cut into exactly those bands', async () => {
    const cases = [
      {
        label: 'Ba Dan',
        ...village,
        directory: BA_DAN_DIRECTORY,
        stem: BA_DAN_STEM,
        quality: BA_DAN_QUALITY,
      },
      {
        label: 'Forest Road',
        ...forest,
        directory: FOREST_DIRECTORY,
        stem: FOREST_STEM,
        quality: FOREST_QUALITY,
      },
    ];
    for (const scene of cases)
      for (const [index, band] of scene.bands.entries()) {
        const path = apronPlatePath(scene.directory, scene.stem, index);
        const shipped = readFileSync(path);
        expect(
          Buffer.from(await encodeWebp(crop(scene.ring, band), scene.quality, true)),
          path,
        ).toEqual(shipped);
      }
  });
});
