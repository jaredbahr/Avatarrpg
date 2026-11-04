/**
 * The one art style (ADR 0102): every asset the contract lists draws only from the shared palette and has hard
 * alpha (each pixel fully opaque or fully clear). Converted assets join the list and stay on it, so the style can
 * only spread, never drift back.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Image } from './lib/image';
import { readImage } from './lib/image';
import { decodeWebp } from './lib/webp';

interface StyleContract {
  readonly cap: number;
  readonly palette: readonly string[];
  readonly assets: readonly string[];
}

const contract = JSON.parse(readFileSync('art/style/contract.json', 'utf8')) as StyleContract;

async function load(path: string): Promise<Image> {
  return path.endsWith('.webp') ? decodeWebp(new Uint8Array(readFileSync(path))) : readImage(path);
}

const hex = (r: number, g: number, b: number): string =>
  `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

/** Up to `limit` problems, so a failure names the colours and pixels rather than just a count. */
export function styleProblems(image: Image, palette: ReadonlySet<string>, limit = 5): string[] {
  const problems: string[] = [];
  const strays = new Map<string, number>();
  let soft = 0;
  for (let i = 0; i < image.width * image.height; i++) {
    const o = i * 4;
    const a = image.data[o + 3] ?? 0;
    if (a === 0) continue;
    if (a !== 255) {
      soft++;
      continue;
    }
    const c = hex(image.data[o] ?? 0, image.data[o + 1] ?? 0, image.data[o + 2] ?? 0);
    if (!palette.has(c)) strays.set(c, (strays.get(c) ?? 0) + 1);
  }
  if (soft) problems.push(`${soft} semi-transparent pixels (alpha must be 0 or 255)`);
  const top = [...strays].sort((x, y) => y[1] - x[1]).slice(0, limit);
  for (const [c, n] of top) problems.push(`${c} is off the palette (${n} px)`);
  if (strays.size > limit) problems.push(`…and ${strays.size - limit} more off-palette colours`);
  return problems;
}

describe('the art style contract (ADR 0102)', () => {
  const palette = new Set(contract.palette.map((c) => c.toLowerCase()));

  it('keeps one palette, unique and under its cap', () => {
    expect(palette.size).toBe(contract.palette.length);
    expect(palette.size).toBeLessThanOrEqual(contract.cap);
    for (const c of palette) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('lists each asset once', () => {
    expect(new Set(contract.assets).size).toBe(contract.assets.length);
  });

  it('flags a stray colour and a soft edge', () => {
    const image: Image = {
      width: 2,
      height: 1,
      data: new Uint8Array([1, 2, 3, 255, 9, 9, 9, 128]),
    };
    expect(styleProblems(image, new Set())).toEqual([
      '1 semi-transparent pixels (alpha must be 0 or 255)',
      '#010203 is off the palette (1 px)',
    ]);
  });

  for (const path of contract.assets) {
    it(`${path} uses only the palette, with hard alpha`, async () => {
      expect(styleProblems(await load(path), palette)).toEqual([]);
    });
  }
});
