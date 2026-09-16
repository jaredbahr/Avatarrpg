import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AssetEntry } from '../../src/content/assets/manifest';
import { newImage, setPixel, writePng } from './lib/image';
import { MAX_IMAGE_BYTES, validateImages } from './validate';

/** A `public/` with a portraits folder holding what each test asks for. */
function site(): string {
  const dir = mkdtempSync(join(tmpdir(), 'fnt-validate-'));
  mkdirSync(join(dir, 'art', 'portraits'), { recursive: true });
  return dir;
}

function flat(w: number, h: number): ReturnType<typeof newImage> {
  const image = newImage(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) setPixel(image, x, y, [244, 233, 216, 255]);
  return image;
}

describe('validateImages', () => {
  it('passes a 512 px portrait and any texture-sized image of another kind', () => {
    const dir = site();
    writePng(join(dir, 'art', 'portraits', 'kaya.png'), flat(512, 512));
    mkdirSync(join(dir, 'art', 'units'));
    writePng(join(dir, 'art', 'units', 'kaya.png'), flat(64, 96));
    const entries: Record<string, AssetEntry> = {
      'portrait.kaya': { kind: 'image', url: 'art/portraits/kaya.png', palette: 'fire' },
      'unit.fire.kaya': { kind: 'image', url: 'art/units/kaya.png', palette: 'fire' },
      'unit.earth.bo': { kind: 'painter', painter: 'bender', palette: 'earth' },
    };
    expect(validateImages(dir, entries)).toEqual([]);
  });

  it('names a missing file, the wrong size, a JPEG, a misnamed format and an absolute url', () => {
    const dir = site();
    writePng(join(dir, 'art', 'portraits', 'small.png'), flat(300, 300));
    writePng(join(dir, 'art', 'portraits', 'named.webp'), flat(512, 512));
    writeFileSync(
      join(dir, 'art', 'portraits', 'photo.png'),
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]),
    );
    const entries: Record<string, AssetEntry> = {
      'portrait.gone': { kind: 'image', url: 'art/portraits/gone.png' },
      'portrait.small': { kind: 'image', url: 'art/portraits/small.png' },
      'portrait.named': { kind: 'image', url: 'art/portraits/named.webp' },
      'portrait.photo': { kind: 'image', url: 'art/portraits/photo.png' },
      'portrait.abs': { kind: 'image', url: '/art/portraits/small.png' },
    };
    const problems = validateImages(dir, entries);
    expect(problems).toHaveLength(5);
    expect(problems.join('\n')).toMatch(/gone.png is missing/);
    expect(problems.join('\n')).toMatch(/small.png is 300x300, expected 512x512/);
    expect(problems.join('\n')).toMatch(/named.webp is a png named as something else/);
    expect(problems.join('\n')).toMatch(/photo.png must be a PNG or a WebP/);
    expect(problems.join('\n')).toMatch(/must be relative to the site root/);
  });

  it('flags a file heavier than the limit', () => {
    const dir = site();
    // Noise does not compress: a 512 px PNG of it is well past the limit.
    const noisy = newImage(512, 512);
    let seed = 7;
    for (let i = 0; i < noisy.data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noisy.data[i] = (seed >>> 16) & 255;
    }
    writePng(join(dir, 'art', 'portraits', 'noise.png'), noisy);
    const problems = validateImages(dir, {
      'portrait.noise': { kind: 'image', url: 'art/portraits/noise.png' },
    });
    expect(problems.join('\n')).toMatch(new RegExp(`the limit is ${MAX_IMAGE_BYTES / 1024} KB`));
  });
});
