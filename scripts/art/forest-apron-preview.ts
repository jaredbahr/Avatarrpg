/** Local preview only: composite the forest ground over the page, apron included. */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init as initWebpDecode } from '@jsquash/webp/decode.js';
import { FOREST_EXTERIOR_APRON, FOREST_ROAD_SCENE } from '../../src/content/scenes/forestRoad';
import { newImage, pixelAt, setPixel, writePng, type Image } from './lib/image';

let ready: Promise<void> | null = null;
async function readWebp(path: string): Promise<Image> {
  if (!ready) {
    const require = createRequire(import.meta.url);
    const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
    ready = WebAssembly.compile(wasm).then((module) => initWebpDecode(module));
  }
  await ready;
  const bytes = readFileSync(path);
  const decoded = await decode(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return { width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) };
}

const SCALE = 0.7;
const region = FOREST_EXTERIOR_APRON;
const image = newImage(Math.round(region.width * SCALE), Math.round(region.height * SCALE));
for (let i = 0; i < image.data.length; i += 4) {
  image.data[i] = 0xf4;
  image.data[i + 1] = 0xef;
  image.data[i + 2] = 0xe2;
  image.data[i + 3] = 255;
}

const skipApron = process.argv.includes('--no-apron');
const seen = new Map<string, Image>();
for (const piece of FOREST_ROAD_SCENE.ground) {
  if (skipApron && piece.url.includes('exterior-apron')) continue;
  let plate = seen.get(piece.url);
  if (!plate) {
    plate = await readWebp(`public/${piece.url}`);
    seen.set(piece.url, plate);
  }
  for (let py = 0; py < plate.height; py++) {
    for (let px = 0; px < plate.width; px++) {
      const [r, g, b, a] = pixelAt(plate, px, py);
      if (a === 0) continue;
      const x = Math.round((piece.x + px - region.x) * SCALE);
      const y = Math.round((piece.y + py - region.y) * SCALE);
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const [dr, dg, db] = pixelAt(image, x, y);
      setPixel(image, x, y, [
        Math.round((r * a + dr * (255 - a)) / 255),
        Math.round((g * a + dg * (255 - a)) / 255),
        Math.round((b * a + db * (255 - a)) / 255),
        255,
      ]);
    }
  }
}
mkdirSync('.shots/forest-apron', { recursive: true });
writePng(`.shots/forest-apron/preview${skipApron ? '-no-apron' : ''}.png`, image);
console.log(`wrote preview ${image.width}x${image.height}`);
