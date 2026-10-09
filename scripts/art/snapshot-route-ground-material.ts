/**
 * One-off: freeze the exact main-branch village pixels used by forest/quarry.
 *
 * Usage:
 *   npx tsx scripts/art/snapshot-route-ground-material.ts <main-plate-dir>
 *
 * The input directory must contain main's `courtyard-ground.webp` and
 * `western-approach-ground.webp`. The output is deliberately tracked outside
 * `public/`: later village repainting must not change approved route plates.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { decodeWebp } from './lib/webp';

export const SNAPSHOT_DIRECTORY = 'assets/source/route-ground-material-main';

const definitions = [
  {
    name: 'paving',
    file: 'western-approach-ground.webp',
    crop: { x: 128, y: 64, width: 448, height: 224 },
  },
  {
    name: 'lawn',
    file: 'courtyard-ground.webp',
    crop: { x: 704, y: 192, width: 192, height: 96 },
  },
] as const;

const input = process.argv[2];
if (!input) throw new Error('Provide a directory containing main-branch village plates.');
mkdirSync(SNAPSHOT_DIRECTORY, { recursive: true });

const manifest: Record<string, unknown> = {};
for (const definition of definitions) {
  const source = await decodeWebp(new Uint8Array(readFileSync(join(input, definition.file))));
  const { x, y, width, height } = definition.crop;
  if (x + width > source.width || y + height > source.height)
    throw new Error(`${definition.file}: ${x},${y} ${width}x${height} is outside the plate.`);
  const png = new PNG({ width, height });
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const from = ((y + py) * source.width + x + px) * 4;
      const to = (py * width + px) * 4;
      for (let channel = 0; channel < 4; channel++)
        png.data[to + channel] = source.data[from + channel] ?? 0;
    }
  const bytes = PNG.sync.write(png, { colorType: 6 });
  const output = `${definition.name}.png`;
  writeFileSync(join(SNAPSHOT_DIRECTORY, output), bytes);
  manifest[definition.name] = {
    source: definition.file,
    crop: definition.crop,
    output,
    rgbaSha256: createHash('sha256').update(png.data).digest('hex'),
  };
}
writeFileSync(
  join(SNAPSHOT_DIRECTORY, 'manifest.json'),
  `${JSON.stringify({ sourceRevision: 'origin/main', crops: manifest }, null, 2)}\n`,
);
