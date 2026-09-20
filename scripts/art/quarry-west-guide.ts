/** Technical surface/ownership guides, not shipped replacement artwork. */
import { mkdirSync, writeFileSync } from 'node:fs';

export const WEST_BOUNDS = { x: 864, y: -64, width: 576, height: 480 };
export const WEST_CELLS = [
  ...[4, 5, 6, 7, 8, 9].map((x) => ({ x, y: 0, height: x === 4 ? 160 : x === 9 ? 208 : 144 })),
  { x: 4, y: 1, height: 160 },
  { x: 9, y: 1, height: 208 },
].sort((a, b) => a.x + a.y - b.x - b.y || a.x - b.x);

export type Point = readonly [number, number];
export function westSurfaces(cell: (typeof WEST_CELLS)[number]): readonly (readonly Point[])[] {
  const p = (x: number, y: number, h = 0): Point => [768 + (x - y) * 64, (x + y) * 32 - h];
  const { x, y, height: h } = cell;
  const a = p(x, y, h),
    b = p(x + 1, y, h),
    c = p(x + 1, y + 1, h),
    d = p(x, y + 1, h);
  return [
    [a, b, c, d],
    [d, c, p(x + 1, y + 1), p(x, y + 1)],
    [b, p(x + 1, y), p(x + 1, y + 1), c],
  ];
}

if (process.argv[1]?.endsWith('quarry-west-guide.ts')) {
  mkdirSync('art/raw/quarry-west', { recursive: true });
  for (const ownership of [false, true]) {
    const shapes = WEST_CELLS.flatMap((cell, index) =>
      westSurfaces(cell).map((points, face) => {
        const fill = ownership
          ? `rgb(${(index + 1) * 24},0,0)`
          : ['#c8baa0', '#a5967e', '#80745f'][face];
        return `<polygon points="${points.map((p) => p.join(',')).join(' ')}" fill="${fill}"/>`;
      }),
    ).join('');
    writeFileSync(
      `art/raw/quarry-west/${ownership ? 'ownership' : 'structure'}-guide.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="1728" height="1440" viewBox="864 -64 576 480">${shapes}</svg>`,
    );
  }
}
