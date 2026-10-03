/**
 * Pack the title screen's key art (docs/art/title-key-art.md).
 *
 *   npx tsx scripts/art/title-art.ts <a|b|c> <source.png> [outDir]
 *
 * The painting is generated, so the packer cannot reproduce it from this
 * repository: the source PNG travels with the review branch, and the shipped
 * bytes are pinned by hash in `title-art.test.ts`. What this script does is
 * purely mechanical: a box-filter downscale and a lossy WebP encode, once for
 * the 16:9 landscape file and once for a crop that keeps the party, for
 * portrait screens, for each of the three paintings the title rotates through. Nothing is repainted.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readImage } from './lib/image';
import { crop } from './lib/trim';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

/** How each painting is cut from its 1920x1080 source; the encode is the same for all. */
const WIDE = { width: 1600, height: 900, quality: 82 } as const;

export const TITLE_ART = {
  a: {
    wide: { file: 'title-a-wide.webp', ...WIDE },
    portrait: {
      file: 'title-a-portrait.webp',
      width: 810,
      height: 900,
      quality: 82,
      /** The right-hand four of the party, the road and the edge of the quarry. */
      cut: { x: 948, y: 0, width: 972, height: 1080 },
    },
  },
  b: {
    wide: { file: 'title-b-wide.webp', ...WIDE },
    portrait: {
      file: 'title-b-portrait.webp',
      width: 810,
      height: 900,
      quality: 82,
      /** All five of the party, the market stalls and the pond. */
      cut: { x: 60, y: 0, width: 972, height: 1080 },
    },
  },
  c: {
    wide: { file: 'title-c-wide.webp', ...WIDE },
    portrait: {
      file: 'title-c-portrait.webp',
      width: 700,
      height: 900,
      quality: 82,
      /** Source crop (px of the 1920x1080 painting): the party, the gate and the road. */
      cut: { x: 1080, y: 0, width: 840, height: 1080 },
    },
  },
} as const;

const [id, source, outDir = 'public/art/title'] = process.argv.slice(2);
if (id && source && process.argv[1]?.endsWith('title-art.ts')) {
  const spec = TITLE_ART[id as keyof typeof TITLE_ART];
  if (!spec) throw new Error(`Unknown painting "${id}": expected a, b or c.`);
  const raw = readImage(source);
  if (raw.width !== 1920 || raw.height !== 1080) throw new Error('Expected a 1920x1080 source.');
  mkdirSync(outDir, { recursive: true });
  const outputs = [
    [spec.wide, scaleTo(raw, spec.wide.width, spec.wide.height)],
    [
      spec.portrait,
      scaleTo(crop(raw, spec.portrait.cut), spec.portrait.width, spec.portrait.height),
    ],
  ] as const;
  for (const [out, image] of outputs) {
    const bytes = await encodeWebp(image, out.quality);
    writeFileSync(resolve(outDir, out.file), bytes);
    console.log(`${out.file}: ${out.width}x${out.height}, ${bytes.length} bytes`);
  }
}
