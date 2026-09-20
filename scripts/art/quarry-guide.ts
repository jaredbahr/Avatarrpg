/** Technical registration guides, never shipped as authored art. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { QUARRY_GATE } from '../../src/content/maps/combat';

const project = (x: number, y: number) => `${768 + (x - y) * 64},${(x + y) * 32}`;
const colors: Record<string, string> = {
  '.': '#b8a58a',
  '=': '#ceb99a',
  '^': '#b6b0a0',
  '#': '#6e695c',
  c: '#816e51',
  o: '#999487',
};
const cells = QUARRY_GATE.rows.flatMap((row, y) =>
  [...row].map(
    (key, x) =>
      `<polygon points="${[project(x, y), project(x + 1, y), project(x + 1, y + 1), project(x, y + 1)].join(' ')}" fill="${colors[key]}"/>`,
  ),
);
mkdirSync('docs/art', { recursive: true });
writeFileSync(
  'docs/art/quarry-gate-guide.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="2304" height="1280" viewBox="-128 -192 2304 1280"><rect x="-128" y="-192" width="2304" height="1280" fill="#b8a58a"/>${cells.join('')}</svg>\n`,
);
writeFileSync(
  'docs/art/quarry-wall-guide.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="704" viewBox="0 0 384 176">${[0, 128, 256].map((x) => `<g transform="translate(${x},0)"><polygon points="64,0 128,32 64,64 0,32" fill="#cabb99"/><polygon points="0,32 64,64 64,176 0,144" fill="#9b8c73"/><polygon points="128,32 64,64 64,176 128,144" fill="#776b58"/></g>`).join('')}</svg>\n`,
);
