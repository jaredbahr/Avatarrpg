/** Pack transparent local Cutting/Driller material regions from the reviewed quarry sheet. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { AMBUSH_ROAD, QUARRY_FLOOR } from '../../src/content/maps/combat';
import { newImage, pixelAt, readImage, setPixel } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

const [mapId, sourcePath] = process.argv.slice(2);
const map = mapId === 'cutting' ? AMBUSH_ROAD : mapId === 'driller' ? QUARRY_FLOOR : null;
if (!map || !sourcePath)
  throw new Error('Usage: quarry-route-ground.ts <cutting|driller> <six-panel-source.png>');
const bytes = readFileSync(sourcePath);
const source = readImage(sourcePath);
if (source.width !== 1536 || source.height !== 1024)
  throw new Error('Expected the reviewed 1536 by 1024 quarry sheet.');
const panelSize = 512,
  inset = 24;
const panel = (index: number) =>
  crop(source, {
    x: (index % 3) * panelSize + inset,
    y: Math.floor(index / 3) * panelSize + inset,
    width: panelSize - inset * 2,
    height: panelSize - inset * 2,
  });
const fields = [0, 1, 2].map((index) => scaleTo(panel(index), 128, 128));
const transitions = [3, 4, 5].map((index) => scaleTo(panel(index), 128, 128));
type Kind = 'dirt' | 'road' | 'stone' | 'dynamic' | 'void';
const kind = (key: string | undefined): Kind =>
  key === '='
    ? 'road'
    : key === '^' || key === 'A' || key === 'r'
      ? 'stone'
      : key === '~' || key === 'o' || key === 'm'
        ? 'dynamic'
        : key === '.' || key === ',' || key === 'c'
          ? 'dirt'
          : 'void';
const mirror = (value: number, size: number) => {
  const p = ((value % (size * 2)) + size * 2) % (size * 2);
  return p < size ? p : size * 2 - p - 1;
};
const page = { x: -128, y: -192, width: 2304, height: 1280 };
const names = ['dirt-west', 'dirt-east', 'road', 'stone'] as const;
const images = new Map(names.map((name) => [name, newImage(page.width, page.height)]));
const region = (x: number, key: string | undefined) => {
  const terrain = kind(key);
  if (terrain === 'dirt') return x < 10 ? 'dirt-west' : 'dirt-east';
  return terrain === 'road' ? 'road' : terrain === 'stone' ? 'stone' : null;
};
for (let py = 0; py < page.height; py++)
  for (let px = 0; px < page.width; px++) {
    const wx = page.x + px + 0.5,
      wy = page.y + py + 0.5;
    const gx = ((wx - 768) / 64 + wy / 32) / 2,
      gy = (wy / 32 - (wx - 768) / 64) / 2;
    const x = Math.floor(gx),
      y = Math.floor(gy),
      key = map.rows[y]?.[x],
      name = region(x, key);
    if (!name) continue;
    const current = kind(key),
      field = fields[current === 'road' ? 1 : current === 'stone' ? 2 : 0];
    if (!field) throw new Error('Missing field');
    let rgba = pixelAt(field, mirror(px, 128), mirror(py, 128));
    const neighbors = [
      [x - 1, y, (gx - x + 0.15) / 0.3, gy, false],
      [x + 1, y, (gx - x - 0.85) / 0.3, gy, true],
      [x, y - 1, (gy - y + 0.15) / 0.3, gx, false],
      [x, y + 1, (gy - y - 0.85) / 0.3, gx, true],
    ] as const;
    for (const [nx, ny, t, along, forward] of neighbors) {
      const other = kind(map.rows[ny]?.[nx]);
      if (t < 0 || t > 1 || other === current || other === 'dynamic' || other === 'void') continue;
      const transitionIndex =
        (current === 'dirt' && other === 'road') || (current === 'road' && other === 'dirt')
          ? 0
          : (current === 'dirt' && other === 'stone') || (current === 'stone' && other === 'dirt')
            ? 1
            : null;
      if (transitionIndex === null) continue;
      const transition = transitions[transitionIndex];
      if (!transition) throw new Error('Missing transition');
      const dirtForward = current === 'dirt' ? forward : !forward;
      rgba = pixelAt(
        transition,
        Math.min(127, Math.max(0, Math.floor((dirtForward ? t : 1 - t) * 128))),
        mirror(Math.floor(along * 128), 128),
      );
      break;
    }
    setPixel(images.get(name)!, px, py, [rgba[0], rgba[1], rgba[2], 255]);
  }
const root = mapId === 'cutting' ? 'cutting-scene' : 'driller-floor-scene';
const regions = [] as {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bytes: number;
}[];
let total = 0;
for (const [name, image] of images) {
  const bounds = alphaBounds(image);
  if (!bounds) continue;
  const packed = await encodeWebp(crop(image, bounds), 84, true);
  writeFileSync(`public/art/maps/${root}/${name}.webp`, packed);
  total += packed.length;
  regions.push({
    name,
    x: page.x + bounds.x,
    y: page.y + bounds.y,
    width: bounds.width,
    height: bounds.height,
    bytes: packed.length,
  });
}
if (total > 240 * 1024) throw new Error(`${mapId} local ground exceeds 240KiB: ${total}`);
mkdirSync(`art/raw/${root}`, { recursive: true });
writeFileSync(
  `art/raw/${root}/route-ground-registration.json`,
  JSON.stringify(
    {
      mapId,
      source: sourcePath,
      sourceSha256: createHash('sha256').update(bytes).digest('hex'),
      page,
      regions,
      total,
    },
    null,
    2,
  ),
);
const exportName = mapId === 'cutting' ? 'CUTTING_GROUND_REGIONS' : 'DRILLER_GROUND_REGIONS';
const registrationPath = 'src/content/scenes/quarryRouteGround.ts';
const existing = existsSync(registrationPath)
  ? readFileSync(registrationPath, 'utf8')
  : '/** Generated from authoritative map rows by quarry-route-ground.ts. */\n';
const declaration = `export const ${exportName} = ${JSON.stringify(
  regions.map(({ name, ...r }) => ({ name, ...r })),
  null,
  2,
)} as const;`;
const pattern = new RegExp(`export const ${exportName} = [\\s\\S]*? as const;`);
writeFileSync(
  registrationPath,
  pattern.test(existing) ? existing.replace(pattern, declaration) : `${existing}\n${declaration}\n`,
);
console.log({
  mapId,
  sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  regions,
  total,
});
