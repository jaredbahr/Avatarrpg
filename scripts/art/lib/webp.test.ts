import { expect, it, vi } from 'vitest';
import { newImage } from './image';
import { encodeUprightWebp, encodeWebp } from './webp';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

it('retains a transparency chunk for scene layers while keeping legacy ground opaque', async () => {
  const image = newImage(16, 16);
  for (let y = 4; y < 12; y++) {
    for (let x = 4; x < 12; x++) {
      const offset = (y * 16 + x) * 4;
      image.data.set([120, 90, 60, 255], offset);
    }
  }
  const layer = await encodeWebp(image, 88, true);
  const ground = await encodeWebp(image, 88);
  expect(Buffer.from(layer).includes(Buffer.from('ALPH'))).toBe(true);
  expect(Buffer.from(ground).includes(Buffer.from('ALPH'))).toBe(false);
  expect(image.data[3]).toBe(0);
});

it('refuses an upright image that misses the lossy contract even at q100', async () => {
  const image = newImage(32, 32);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const colours = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0],
      ];
      image.data.set([...(colours[(x + 2 * y) % 4] ?? [0, 0, 0]), 255], (y * 32 + x) * 4);
    }
  await expect(encodeUprightWebp(image)).rejects.toThrow(/q100/);
});
