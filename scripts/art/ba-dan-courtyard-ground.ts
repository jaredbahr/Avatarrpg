/**
 * Repaint the lawn in the tracked Ba Dan courtyard plate.
 *
 * The decoded paving authority (see `authority` below) holds the paving/stone RGB,
 * transparent RGB, registration and alpha. Only opaque grass-cell RGB changes.
 *
 * npx tsx scripts/art/ba-dan-courtyard-ground.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { decodeWebp, encodeWebp } from './lib/webp';
import {
  GROUND_WEBP_QUALITY,
  pavedCell,
  villageBake,
  villageGroundRgb,
} from './ba-dan-village-material';

const output = 'public/art/maps/ba-dan-scene/courtyard-ground.webp';
/**
 * The lossless paving, alpha and registration authority: the courtyard plate as
 * first accepted. The shipped plate is lossy, so reading it back here would
 * lose a generation of paving on every run.
 */
const authority = 'assets/source/ba-dan-ground-v1/courtyard-paving.webp';

// Projected bounds of the logical x5..15,y3..11 court. The image is already
// in camera space, so these are screen pixels, not another ground transform.
const x0 = 640;
const y0 = 256;
const width = 1152;
const height = 576;
const image = await decodeWebp(new Uint8Array(readFileSync(authority)));
if (image.width !== width || image.height !== height)
  throw new Error(
    `Courtyard paving authority is ${image.width}x${image.height}; expected ${width}x${height}.`,
  );

/** Whether a lawn cell lies within a fifth of a tile of a logical point. */
function lawnNear(x: number, y: number): boolean {
  for (let cy = Math.floor(y) - 1; cy <= Math.floor(y) + 1; cy++)
    for (let cx = Math.floor(x) - 1; cx <= Math.floor(x) + 1; cx++) {
      const key = BA_DAN_VILLAGE.rows[cy]?.[cx];
      if (key !== ',' && key !== 'T') continue;
      if (Math.hypot(Math.max(cx - x, 0, x - cx - 1), Math.max(cy - y, 0, y - cy - 1)) < 0.2)
        return true;
    }
  return false;
}

for (let py = 0; py < height; py++) {
  for (let px = 0; px < width; px++) {
    const dx = (px + x0 - 1024 + 0.5) / 64;
    const dy = (py + y0 + 0.5) / 32;
    const x = (dx + dy) / 2;
    const y = (dy - dx) / 2;
    const cell = BA_DAN_VILLAGE.rows[Math.floor(y)]?.[Math.floor(x)];
    const to = (py * image.width + px) * 4;
    const alpha = image.data[to + 3] ?? 0;
    // Every translucent pixel is the courtyard's exterior feather, whatever
    // material the old plate stored there. Over lawn its RGB must be the garden
    // below or old paving/earth colours form a pale brown outline when
    // alpha-composited (the x=15 and y=11 tile edges). Over a road cell it must
    // stay paving, because the road runs on beneath it into the western and east
    // approaches: lawn colour there drew a brown bar across the road at x=5.
    const feather = alpha > 0 && alpha < 255;
    const road = pavedCell(Math.floor(x), Math.floor(y));
    const grass = cell === ',' || cell === 'T' || (cell === 'l' && !road);
    if ((feather && !road) || (grass && alpha === 255)) {
      const rgb = villageGroundRgb(px + x0 + 0.5, py + y0 + 0.5);
      image.data[to] = rgb[0];
      image.data[to + 1] = rgb[1];
      image.data[to + 2] = rgb[2];
    }
    // A paving pixel whose alpha is partial only because it borders the lawn
    // was blending the garden's olive into the stone edge, a pale green line.
    // The road's far feathers (x5, x15, y3, y11) run on beneath other plates
    // and stay feathered; the lawn edge is opaque.
    if (feather && cell === '=' && lawnNear(x, y)) image.data[to + 3] = 255;
    // Light and shade, with the stone's own lip, on every painted pixel.
    if ((image.data[to + 3] ?? 0) > 0) {
      const lit = villageBake(px + x0 + 0.5, py + y0 + 0.5, [
        image.data[to] ?? 0,
        image.data[to + 1] ?? 0,
        image.data[to + 2] ?? 0,
      ]);
      image.data[to] = lit[0];
      image.data[to + 1] = lit[1];
      image.data[to + 2] = lit[2];
    }
  }
}

const outDir = 'public/art/maps/ba-dan-scene';
mkdirSync(outDir, { recursive: true });
writeFileSync(output, await encodeWebp(image, GROUND_WEBP_QUALITY, true));
