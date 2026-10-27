import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { checkSources } from './g-sprites';
import type { ResidentPins } from './resident-g';
import {
  RESIDENT_KEYS,
  RESIDENT_NAMES,
  buildResident,
  readAssembly,
  residentCounts,
  residentPins,
  residentSource,
  residentSourceFiles,
} from './resident-g';

// Encoding and decoding a whole WebP page is slow on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEMP: string[] = [];
afterEach(() => {
  for (const dir of TEMP.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const pinsOf = (name: (typeof RESIDENT_NAMES)[number]) =>
  JSON.parse(readFileSync(residentPins(name), 'utf8')) as ResidentPins;

describe('Ba Dan resident G sheets (issue #284)', () => {
  it.each(RESIDENT_NAMES)(
    '%s: pins exactly the cels its assembly names, and they match',
    (name) => {
      const files = residentSourceFiles(readAssembly(name));
      expect(files).toHaveLength(8 * (4 + 8));
      const pins = pinsOf(name);
      expect(Object.keys(pins.cels).sort()).toEqual([...files].sort());
      expect(checkSources(residentSource(name), files, pins.cels, 'source')).toEqual([]);
    },
  );

  it.each(RESIDENT_NAMES)('%s: pins a decoded cel for every frame its sheet draws', (name) => {
    const entry = ASSETS[RESIDENT_KEYS[name]];
    if (entry?.kind !== 'sheet') throw new Error(`${name} is not a sheet`);
    expect(entry.atlas).toBe(`art/units/${name}-g.json`);
    expect(entry.facing).toBe('both');
    expect(entry.locomotion?.headings).toBe(8);
    const drawn = Object.values(entry.clips).flatMap((clip) => clip?.frames ?? []);
    expect(Object.keys(pinsOf(name).frames).sort()).toEqual([...new Set(drawn)].sort());
    for (const [clip, count] of Object.entries(residentCounts()))
      expect(entry.clips[clip as keyof typeof entry.clips]?.frames, clip).toHaveLength(count);
  });

  it('rebuilds the shipped sheet cel for cel, and places every heading within small bounds', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'resident-g-'));
    TEMP.push(dir);
    const pinsPath = join(dir, 'pins.json');
    copyFileSync(residentPins('pella'), pinsPath);
    const built = await buildResident('pella', { outDir: dir, pinsPath, log: () => {} });
    expect(built.frames).toEqual(pinsOf('pella').frames);
    expect(readFileSync(join(dir, 'pella-g.json'), 'utf8')).toBe(
      readFileSync('public/art/units/pella-g.json', 'utf8'),
    );
    for (const p of Object.values(built.placements)) {
      expect(Math.abs(p.headingDx)).toBeLessThanOrEqual(8);
      expect(Math.abs(p.walkDx)).toBeLessThanOrEqual(8);
      expect(Math.abs(p.walkDy)).toBeLessThanOrEqual(8);
      expect(p.restCel).toBeGreaterThanOrEqual(0);
    }
  });

  it('packs on the native G1 grid (1 sheet px per world px) by a re-run alone', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'resident-g1-'));
    TEMP.push(dir);
    const pinsPath = join(dir, 'pins.json');
    copyFileSync(residentPins('pella'), pinsPath);
    const built = await buildResident('pella', {
      outDir: dir,
      pinsPath,
      pxPerWorldPx: 1,
      log: () => {},
    });
    const atlas = JSON.parse(readFileSync(join(dir, 'pella-g.json'), 'utf8')) as {
      frames: Record<string, { frame: { w: number; h: number } }>;
    };
    const first = Object.values(atlas.frames)[0];
    expect(first?.frame).toMatchObject({ w: 64, h: 96 });
    expect(Object.keys(built.placements)).toHaveLength(8);
  });

  it('refuses a source cel that does not match its pin', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'resident-g-'));
    TEMP.push(dir);
    const pins = pinsOf('household');
    const first = Object.keys(pins.cels)[0] ?? '';
    const pinsPath = join(dir, 'pins.json');
    writeFileSync(
      pinsPath,
      JSON.stringify({ ...pins, cels: { ...pins.cels, [first]: '0'.repeat(64) } }),
    );
    await expect(
      buildResident('household', { outDir: dir, pinsPath, log: () => {} }),
    ).rejects.toThrow(/does not match its pin/);
  });
});
