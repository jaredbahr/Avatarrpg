/**
 * Pack the forest pond's bank reeds: a low fringe of the artist's own flood-bank
 * reed mass, cut from the nest-free end of `old-nest-reeds.png` so the pond's
 * waterline carries vegetation the way the references do, without painting a
 * second nest or synthesising a plant.
 *
 * The fringe is a standing scenery layer, not ground: the pond plate's own
 * contract keeps everything past its dry matte clear, and reeds overhang the
 * water. Nothing here changes a rule, a surface, a footprint or the water layer.
 *
 * Usage: node --import tsx scripts/art/pond-reeds.ts [--audit]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { imageSize, newImage, pixelAt, readImage, setPixel, writePng } from './lib/image';
import type { Image } from './lib/image';
import { crop } from './lib/trim';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

export const REED_SOURCE = 'assets/source/forest-bank/old-nest-reeds.png';
export const REED_OUTPUT = 'public/art/maps/forest-scene/pond-reeds.webp';
/**
 * The nest occupies the right half of the source; this box is the reed fan to
 * its left, measured against the source's own alpha bounds (x 20, y 363) so the
 * left edge keeps the artist's pointed leaf tips and only the cut edges fade.
 */
export const REED_CROP = { x: 20, y: 545, width: 540, height: 330 } as const;
/** Packed width; the runtime placement scales it back down. */
export const REED_WIDTH = 512;
/** The cut edges: how far the mass fades out, in source pixels. */
export const REED_FEATHER = { right: 64, top: 74, bottom: 18, left: 0 } as const;
/** The source's own alpha bound where the reed fan begins, checked by the test. */
export const REED_SOURCE_ORIGIN = { x: 20, y: 363 } as const;

/** Smoothstep, so a fading edge leaves no straight ruled line behind it. */
const smooth = (t: number): number => {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * The fringe, cropped and feathered. Every opaque pixel is the artist's; the
 * only new values are alpha on the four cut edges, where the mass is faded so
 * the crop does not end on a ruled line.
 */
export function packPondReeds(raw: Image): Image {
  const box = crop(raw, REED_CROP);
  const scale = REED_WIDTH / box.width;
  const packed = scaleTo(box, REED_WIDTH, Math.max(1, Math.round(box.height * scale)));
  const out = newImage(packed.width, packed.height);
  const featherX = REED_FEATHER.right * scale;
  const featherTop = REED_FEATHER.top * scale;
  const featherBottom = REED_FEATHER.bottom * scale;
  const featherLeft = REED_FEATHER.left * scale;
  for (let py = 0; py < packed.height; py++)
    for (let px = 0; px < packed.width; px++) {
      const pixel = pixelAt(packed, px, py);
      if (pixel[3] === 0) continue;
      let alpha = pixel[3];
      if (featherX > 0 && px > packed.width - featherX)
        alpha = Math.round(alpha * smooth((packed.width - px) / featherX));
      if (featherTop > 0 && py < featherTop) alpha = Math.round(alpha * smooth(py / featherTop));
      if (featherBottom > 0 && py > packed.height - featherBottom)
        alpha = Math.round(alpha * smooth((packed.height - py) / featherBottom));
      if (featherLeft > 0 && px < featherLeft) alpha = Math.round(alpha * smooth(px / featherLeft));
      setPixel(out, px, py, [pixel[0], pixel[1], pixel[2], alpha]);
    }
  return out;
}

async function main(): Promise<void> {
  const source = readImage(REED_SOURCE);
  const image = packPondReeds(source);
  const bytes = await encodeWebp(image, 88, true);
  mkdirSync(dirname(REED_OUTPUT), { recursive: true });
  writeFileSync(REED_OUTPUT, bytes);
  if (process.argv.includes('--audit')) writePng('.shots/pond/reeds.png', image);
  console.log(
    JSON.stringify({
      sourceHeader: imageSize(new Uint8Array(readFileSync(REED_SOURCE))),
      crop: REED_CROP,
      packed: { width: image.width, height: image.height },
      bytes: bytes.length,
    }),
  );
}

if (process.argv[1]?.endsWith('pond-reeds.ts')) await main();
