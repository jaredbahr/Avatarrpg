/**
 * The quarry surround: verify the shipped pages against the playable diamond.
 *
 *   node --import tsx scripts/art/quarry-surround-pack.ts
 *
 * This used to register a 1572 x 1001 generated source onto two 672 x 832 pages
 * at half scale. The shipped pages are no longer that: since 2026-10-03 they are
 * the crisp 1344 x 1664 re-cut (1 page pixel = 1 scene pixel), whose source is
 * generated art plus a mechanical clean-up that this repository does not carry,
 * so nothing here can reproduce them. `docs/art/quarry-surround-composition.md`
 * records the provenance and `quarry-surround.test.ts` pins the shipped bytes.
 *
 * What the repository can still do, and what this does, is hold the pages to the
 * contract the renderer relies on: both backends draw the procedural board first
 * and the surround over it, so the surround's alpha *is* the board's visible
 * edge. The alpha must be binary, and clear exactly where the pixel centre lies
 * inside the floor diamond (map x 0..20, y 0..12).
 */
import { readFileSync } from 'node:fs';
import { decodeWebp } from './lib/webp';

export const SURROUND_PAGES = [
  { side: 'west', x: -320, y: -560 },
  { side: 'east', x: 1024, y: -560 },
] as const;
export const SURROUND_SIZE = { width: 1344, height: 1664 } as const;
const MAP = { width: 20, height: 12 } as const;

/** Whether a scene-pixel centre lies inside the playable diamond. */
export function insideFloor(worldX: number, worldY: number): boolean {
  const diagonal = (worldX - 768) / 64;
  const sum = worldY / 32;
  const x = (diagonal + sum) / 2;
  const y = (sum - diagonal) / 2;
  return x >= 0 && x <= MAP.width && y >= 0 && y <= MAP.height;
}

export interface SurroundReport {
  width: number;
  height: number;
  /** Pixels whose alpha is neither 0 nor 255. */
  partialAlpha: number;
  /** Clear pixels outside the diamond, which would show the board's ink edge. */
  clearOutside: number;
  /** Opaque pixels inside the diamond, which would cover the live floor. */
  opaqueInside: number;
}

export async function checkSurround(side: 'west' | 'east'): Promise<SurroundReport> {
  const page = SURROUND_PAGES.find((candidate) => candidate.side === side);
  if (!page) throw new Error(`unknown surround page ${side}`);
  const image = await decodeWebp(
    new Uint8Array(readFileSync(`public/art/maps/quarry-surround/${side}.webp`)),
  );
  const report: SurroundReport = {
    width: image.width,
    height: image.height,
    partialAlpha: 0,
    clearOutside: 0,
    opaqueInside: 0,
  };
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const alpha = image.data[(y * image.width + x) * 4 + 3] ?? 0;
      if (alpha !== 0 && alpha !== 255) report.partialAlpha++;
      const inside = insideFloor(page.x + x + 0.5, page.y + y + 0.5);
      if (inside && alpha !== 0) report.opaqueInside++;
      if (!inside && alpha === 0) report.clearOutside++;
    }
  return report;
}

if (process.argv[1]?.endsWith('quarry-surround-pack.ts')) {
  for (const { side } of SURROUND_PAGES) console.log(side, await checkSurround(side));
}
