import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { ASSETS } from './assets/manifest';

describe('Kaya expression delivery', () => {
  const neutral = PNG.sync.read(readFileSync(join(process.cwd(), 'public/art/portraits/kaya.png')));
  for (const expression of ['angry', 'worried', 'warm']) {
    it(`${expression} keeps the neutral outside the face and ships indexed at 512px`, () => {
      const entry = ASSETS[`portrait.kaya.${expression}`];
      expect(entry?.kind).toBe('image');
      if (entry?.kind !== 'image') throw new Error('Expression image missing');
      const bytes = readFileSync(join(process.cwd(), 'public', entry.url));
      const image = PNG.sync.read(bytes);
      expect([image.width, image.height, bytes[25]]).toEqual([512, 512, 3]);
      let faceChanges = 0;
      let nonFaceChanges = 0;
      for (let y = 0; y < 512; y++)
        for (let x = 0; x < 512; x++) {
          const i = (y * 512 + x) * 4;
          const changed = [0, 1, 2, 3].some((c) => image.data[i + c] !== neutral.data[i + c]);
          if (!changed) continue;
          if (x < 211 || x > 353 || y < 169 || y > 319) nonFaceChanges++;
          else faceChanges++;
        }
      expect(nonFaceChanges).toBe(0);
      expect(faceChanges).toBeGreaterThan(100);
    });
  }
});
