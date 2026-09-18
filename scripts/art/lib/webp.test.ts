import { expect, it } from 'vitest';
import { newImage } from './image';
import { encodeWebp } from './webp';

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
