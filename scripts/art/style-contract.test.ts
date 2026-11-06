/**
 * The one art style (ADR 0102, amended 2026-11-06): every asset the contract lists has hard alpha (each pixel fully
 * opaque or fully clear), and holds the number of colours recorded for it, never more than its own cap or the
 * contract's ceiling. The single shared palette is gone (the owner: "dropping the palette is fine"); a count per
 * asset keeps a repack from drifting silently toward a painting. Listed assets stay listed, so the style can only
 * spread, never drift back.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Image } from './lib/image';
import { readImage } from './lib/image';
import { decodeWebp } from './lib/webp';
import { measureStyle as measure } from './lib/colours';

interface AssetRecord {
  /** The distinct opaque colours the asset holds, as measured when it was last packed. */
  readonly colours: number;
  /** The most it may hold: raising it is a decision made in review, with a reason. */
  readonly cap: number;
}

interface StyleContract {
  /** No asset's cap passes this: pixel art at these sizes holds tens or hundreds of colours, a painting tens of thousands. */
  readonly ceiling: number;
  readonly assets: Readonly<Record<string, AssetRecord>>;
}

const contract = JSON.parse(readFileSync('art/style/contract.json', 'utf8')) as StyleContract;

async function load(path: string): Promise<Image> {
  return path.endsWith('.webp') ? decodeWebp(new Uint8Array(readFileSync(path))) : readImage(path);
}

/** What is wrong with one asset against its record, so a failure names the numbers. */
export function styleProblems(image: Image, record: AssetRecord, ceiling: number): string[] {
  const { colours, soft } = measure(image);
  const problems: string[] = [];
  if (soft) problems.push(`${soft} semi-transparent pixels (alpha must be 0 or 255)`);
  if (colours > record.cap) problems.push(`${colours} colours, over its cap of ${record.cap}`);
  else if (colours !== record.colours)
    problems.push(`${colours} colours, recorded as ${record.colours}: update the record`);
  if (record.cap > ceiling) problems.push(`its cap ${record.cap} is over the ceiling ${ceiling}`);
  return problems;
}

describe('the art style contract (ADR 0102)', () => {
  const paths = Object.keys(contract.assets);

  it('records a count under a cap for every asset', () => {
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      const record = contract.assets[path];
      expect(Number.isInteger(record?.colours) && Number.isInteger(record?.cap), path).toBe(true);
      expect(record?.colours, path).toBeLessThanOrEqual(record?.cap ?? 0);
    }
  });

  it('flags a soft edge, a count over its cap and a count that drifted from its record', () => {
    const image: Image = {
      width: 3,
      height: 1,
      data: new Uint8Array([1, 2, 3, 255, 9, 9, 9, 128, 4, 5, 6, 255]),
    };
    expect(measure(image)).toEqual({ colours: 2, soft: 1 });
    expect(styleProblems(image, { colours: 2, cap: 1 }, 64)).toEqual([
      '1 semi-transparent pixels (alpha must be 0 or 255)',
      '2 colours, over its cap of 1',
    ]);
    expect(styleProblems(image, { colours: 3, cap: 128 }, 64)).toEqual([
      '1 semi-transparent pixels (alpha must be 0 or 255)',
      '2 colours, recorded as 3: update the record',
      'its cap 128 is over the ceiling 64',
    ]);
  });

  for (const path of paths) {
    it(`${path} has hard alpha and its recorded colours`, async () => {
      const record = contract.assets[path];
      if (!record) throw new Error(`${path} has no record`);
      expect(styleProblems(await load(path), record, contract.ceiling)).toEqual([]);
    });
  }
});
