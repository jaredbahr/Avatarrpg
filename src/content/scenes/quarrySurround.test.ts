import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import decode, { init } from '@jsquash/webp/decode.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { DRILLER_FLOOR_SCENE } from './quarryProjected';

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
  await init(await WebAssembly.compile(wasm));
});

describe('shipped quarry exterior surround', () => {
  it('keeps every live floor cell alpha-free after WebP encoding', async () => {
    let checked = 0;
    for (const piece of DRILLER_FLOOR_SCENE.ground.slice(0, 2)) {
      const bytes = readFileSync(`public/${piece.url}`);
      const image = await decode(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      );
      expect(image.width).toBeLessThanOrEqual(2048);
      expect(image.height).toBeLessThanOrEqual(2048);
      let leaks = 0;
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++) {
          const worldX = piece.x + ((x + 0.5) / image.width) * piece.width;
          const worldY = piece.y + ((y + 0.5) / image.height) * piece.height;
          const mapX = worldY / 64 + (worldX - 768) / 128;
          const mapY = worldY / 64 - (worldX - 768) / 128;
          if (mapX < 0 || mapX >= 20 || mapY < 0 || mapY >= 12) continue;
          checked++;
          if (image.data[(y * image.width + x) * 4 + 3] !== 0) leaks++;
        }
      expect(leaks, piece.url).toBe(0);
    }
    expect(checked).toBeGreaterThan(200_000);
  });
});
