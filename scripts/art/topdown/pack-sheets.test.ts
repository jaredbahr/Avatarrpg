/**
 * The top-down sheets (ADR 0104 T2) ship exactly what the prototype's committed PixelLab takes pack to, as
 * `pack-sheets.ts --check` asserts: every atlas, clip file, actions file and the manifest's data module, byte for
 * byte, and nothing else under `public/art/topdown/`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { decodeWebp, isLosslessWebp } from '../lib/webp';
import { DATA, OUT, packTopdownSheets } from './pack-sheets';

// Reading some 3,000 frames and the encoder's slowest lossless search take a minute or more on a busy machine.
vi.setConfig({ testTimeout: 600_000, hookTimeout: 600_000 });

const files = await packTopdownSheets();

it('ships exactly what the committed sources pack to', () => {
  for (const [path, content] of files) {
    const bytes = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content);
    expect(bytes.equals(readFileSync(path)), `${path} is stale: run pack-sheets.ts`).toBe(true);
  }
  // Files only: the `ba-dan/` folder beside them is `pack-ground.ts`'s, held by its own test.
  const shipped = readdirSync(OUT, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => `${OUT}/${e.name}`);
  expect(shipped.sort()).toEqual([...files.keys()].filter((path) => path !== DATA).sort());
});

it('ships lossless pages with hard alpha', async () => {
  for (const [path, content] of files) {
    if (!path.endsWith('.webp') || typeof content === 'string') continue;
    expect(isLosslessWebp(content), path).toBe(true);
    const image = await decodeWebp(content);
    for (let i = 3; i < image.data.length; i += 4)
      if (image.data[i] !== 0 && image.data[i] !== 255) throw new Error(`${path}: a soft pixel`);
  }
});
