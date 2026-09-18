/** Technical registration guides only; these diagrams are not shipped artwork. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';

const project = (x: number, y: number) => ({ x: 768 + (x - y) * 64, y: (x + y) * 32 });
const point = (x: number, y: number) => `${x},${y}`;
const waterEdges = new Map<string, string>();
const polygons: string[] = [];
const colors: Record<string, string> = {
  ',': '#78845c',
  T: '#47593a',
  '=': '#b8a27a',
  '^': '#aba58f',
  r: '#6f685c',
  '~': '#426c6b',
};
for (let y = 0; y < FOREST_ROAD.height; y++) {
  for (let x = 0; x < FOREST_ROAD.width; x++) {
    const key = FOREST_ROAD.rows[y]?.[x] ?? ',';
    const corners = [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
    ] as const;
    const vertices = corners.map(([cx, cy]) => {
      const p = project(cx, cy);
      return point(p.x, p.y);
    });
    polygons.push(`<polygon points="${vertices.join(' ')}" fill="${colors[key] ?? colors[',']}"/>`);
    if (key !== '~') continue;
    for (let i = 0; i < 4; i++) {
      const a = corners[i],
        b = corners[(i + 1) % 4];
      if (!a || !b) throw new Error('Missing cell corner');
      const start = point(a[0], a[1]),
        end = point(b[0], b[1]);
      waterEdges.set(`${start}>${end}`, end);
    }
  }
}
// Cancel reverse edges using full edge identities, then retain just the exterior.
const boundary = new Map<string, string>();
for (const key of waterEdges.keys()) {
  const [a, b] = key.split('>');
  if (!a || !b) throw new Error('Malformed edge');
  if (!waterEdges.has(`${b}>${a}`)) boundary.set(a, b);
}
const first = boundary.keys().next().value as string | undefined;
if (!first) throw new Error('Forest has no water perimeter');
const outline: string[] = [];
let next = first;
do {
  const coordinates = next.split(',').map(Number);
  const x = coordinates[0],
    y = coordinates[1];
  if (x === undefined || y === undefined) throw new Error('Malformed vertex');
  const p = project(x, y);
  outline.push(point(p.x - 576, p.y - 320));
  const end = boundary.get(next);
  if (!end) throw new Error('Open water perimeter');
  next = end;
  if (outline.length > boundary.size) throw new Error('Water perimeter did not close');
} while (next !== first);

mkdirSync('docs/art', { recursive: true });
writeFileSync(
  'docs/art/forest-water-guide.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="1408" height="768" viewBox="-16 -16 352 192"><polygon points="${outline.join(' ')}" fill="#426c6b" stroke="#1b1410" stroke-width="0.5"/></svg>\n`,
);
writeFileSync(
  'docs/art/forest-ground-guide.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="2304" height="1280" viewBox="-128 -192 2304 1280"><rect x="-128" y="-192" width="2304" height="1280" fill="#78845c"/>${polygons.join('')}</svg>\n`,
);
console.log(`Forest guides: ${outline.length} perimeter vertices, exact authored cells.`);
