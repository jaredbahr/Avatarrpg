/** Normalize authored gate art to its agreed registration, retaining whole-image scenery. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { readImage, pixelAt, setPixel } from './lib/image';
import { crop, aspectCrop } from './lib/trim';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

const [groundPath, wallPath] = process.argv.slice(2);
if (!groundPath || !wallPath) throw new Error('Provide authored ground and three-panel wall PNGs.');
const ground = readImage(groundPath),
  walls = readImage(wallPath);
if (Math.abs(ground.width / ground.height - 1.8) > 0.002)
  throw new Error('Ground registration aspect changed.');
if (Math.abs(walls.width / walls.height - 384 / 176) > 0.004)
  throw new Error('Wall sheet registration aspect changed.');
const factor = Math.floor(Math.min(ground.width / 18, ground.height / 10, 2048 / 10));
const plate = scaleTo(ground, factor * 18, factor * 10);
const wallSheet = scaleTo(crop(walls, aspectCrop(walls, 384, 176)), 768, 352);
const outputs: { name: string; bytes: Uint8Array }[] = [];
for (const [i, side] of ['west', 'east'].entries()) {
  const chunk = crop(plate, {
    x: (i * plate.width) / 2,
    y: 0,
    width: plate.width / 2,
    height: plate.height,
  });
  outputs.push({ name: `ground-${side}`, bytes: await encodeWebp(chunk, 88) });
}
let clippedPixels = 0,
  keyedFringePixels = 0;
for (const [i, variant] of ['interior', 'end', 'corner'].entries()) {
  const wall = crop(wallSheet, { x: i * 256, y: 0, width: 256, height: 352 });
  for (let py = 0; py < wall.height; py++)
    for (let px = 0; px < wall.width; px++) {
      const x = (px + 0.5) / 2,
        y = (py + 0.5) / 2;
      const edge = Math.abs(x - 64) / 2;
      const [r, g, b] = pixelAt(wall, px, py);
      // Generator transparency-fringe contamination: saturated red/yellow,
      // confined to the outer eight world pixels, never limestone interiors.
      const fringe = Math.min(y - edge, 176 - edge - y, x, 128 - x) < 8;
      if (fringe && ((r - b > 100 && g - b > 100) || (r - g > 80 && r - b > 80))) {
        setPixel(wall, px, py, [0, 0, 0, 0]);
        keyedFringePixels++;
      }
      if (y < edge || y > 176 - edge) {
        if (pixelAt(wall, px, py)[3] > 0) clippedPixels++;
        setPixel(wall, px, py, [0, 0, 0, 0]);
      }
    }
  outputs.push({ name: `wall-${variant}`, bytes: await encodeWebp(wall, 88, true) });
}
const groundBytes = outputs
  .filter((o) => o.name.startsWith('ground'))
  .reduce((sum, o) => sum + o.bytes.length, 0);
const wallBytes = outputs
  .filter((o) => o.name.startsWith('wall'))
  .reduce((sum, o) => sum + o.bytes.length, 0);
if (groundBytes > 240 * 1024 || wallBytes > 100 * 1024)
  throw new Error(`Planning budget exceeded: ground ${groundBytes}, walls ${wallBytes}`);
const directory = 'public/art/maps/quarry-gate-scene';
mkdirSync(directory, { recursive: true });
for (const output of outputs) writeFileSync(`${directory}/${output.name}.webp`, output.bytes);
console.log({
  groundSource: [ground.width, ground.height],
  wallSource: [walls.width, walls.height],
  groundChunk: [plate.width / 2, plate.height],
  wall: [256, 352],
  clippedPixels,
  keyedFringePixels,
  groundBytes,
  wallBytes,
});
