/** Re-encode the approved dirt-east pages with a soft x=10 takeover seam. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import {
  CUTTING_GROUND_REGIONS,
  DRILLER_GROUND_REGIONS,
} from '../../src/content/scenes/quarryRouteGround';
import { encodeWebp } from './lib/webp';

const require = createRequire(import.meta.url);
const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
await init(await WebAssembly.compile(wasm));
for (const [directory, regions] of [
  ['cutting-scene', CUTTING_GROUND_REGIONS],
  ['driller-floor-scene', DRILLER_GROUND_REGIONS],
] as const) {
  const region = regions.find(({ name }) => name === 'dirt-east');
  if (!region) throw new Error(`Missing dirt-east registration for ${directory}`);
  const path = `public/art/maps/${directory}/dirt-east.webp`;
  const bytes = readFileSync(path);
  const decoded = await decode(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const image = {
    width: decoded.width,
    height: decoded.height,
    data: new Uint8Array(decoded.data),
  };
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const index = (py * image.width + px) * 4;
      const alpha = image.data[index + 3] ?? 0;
      if (!alpha) continue;
      const wx = region.x + px + 0.5,
        wy = region.y + py + 0.5;
      const gx = ((wx - 768) / 64 + wy / 32) / 2;
      const t = Math.max(0, Math.min(1, (gx - 9.96) / 0.08));
      image.data[index + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  writeFileSync(path, await encodeWebp(image, 84, true));
}
