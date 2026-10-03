import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEADINGS, headingClip } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import { checkSources, sha256 } from './g-sprites';
import {
  IDLE_CELS,
  THUG_ACTIONS,
  THUG_HEADINGS,
  THUG_KEY,
  THUG_PINS,
  THUG_TONE,
  WALK_CELS,
  buildThug,
  pinThugSources,
  thugCounts,
  thugSourceFiles,
} from './thug-g';
import type { ThugPins } from './thug-g';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const TEMP: string[] = [];
afterEach(() => {
  for (const dir of TEMP.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('thug G sheet (ADR 0059)', () => {
  it('pins exactly the toned cels and preserved actions the build reads', () => {
    const pins = JSON.parse(readFileSync(THUG_PINS, 'utf8')) as ThugPins;
    const files = thugSourceFiles();
    expect(files.pixellab).toHaveLength(8 * (IDLE_CELS + WALK_CELS));
    expect(Object.keys(pins.pixellab).sort()).toEqual([...files.pixellab].sort());
    // The south-east walk is the r2b retake, and only it.
    expect(files.pixellab.filter((file) => file.startsWith('walk-se-r2b/'))).toHaveLength(8);
    expect(files.pixellab.some((file) => file.startsWith('walk/south-east/'))).toBe(false);
    for (const hash of Object.values(pins.pixellab)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(pins.tone).toEqual(THUG_TONE);
    expect(checkSources(THUG_ACTIONS, files.actions, pins.actions, 'action')).toEqual([]);
  });

  it('pins a decoded cel for every frame the manifest draws, and draws every one', () => {
    const pins = JSON.parse(readFileSync(THUG_PINS, 'utf8')) as ThugPins;
    const entry = ASSETS[THUG_KEY];
    if (entry?.kind !== 'sheet') throw new Error('The thug is not a sheet');
    expect(entry.atlas).toBe('art/units/thug-g.json');
    expect(entry.facing).toBe('both');
    expect(entry.locomotion?.headings).toBe(8);
    const drawn = Object.values(entry.clips).flatMap((clip) => clip?.frames ?? []);
    expect(Object.keys(pins.frames).sort()).toEqual([...new Set(drawn)].sort());
    const counts = thugCounts();
    for (const [clip, count] of Object.entries(counts))
      expect(entry.clips[clip as keyof typeof counts]?.frames, clip).toHaveLength(count);
  });

  it('places every heading within the party rules’ bounds', () => {
    expect(THUG_HEADINGS.map((h) => h.idle)).toEqual(
      expect.arrayContaining(HEADINGS.map((heading) => headingClip('idle', heading))),
    );
    for (const h of THUG_HEADINGS) {
      expect(h.restCel).toBeGreaterThanOrEqual(0);
      expect(h.restCel).toBeLessThan(WALK_CELS);
      expect(Math.abs(h.walkDx), h.direction).toBeLessThanOrEqual(8);
      expect(Math.abs(h.idleDy), h.direction).toBeLessThanOrEqual(8);
      // East and west were drawn 20 source px high on the canvas; nothing moves more.
      expect(Math.abs(h.walkDy), h.direction).toBeLessThanOrEqual(16);
    }
  });

  it('refuses a cel its tone manifest did not write, and changed sources', async () => {
    const root = mkdtempSync(join(tmpdir(), 'thug-src-'));
    TEMP.push(root);
    const files = thugSourceFiles();
    const bytes = new Uint8Array([1, 2, 3]);
    const manifests: Record<string, Record<string, { out: string }>> = {};
    for (const file of files.pixellab) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), bytes);
      const folder = file.startsWith('walk-se-r2b/') ? 'walk-se-r2b' : file.split('/')[0]!;
      (manifests[folder] ??= {})[file.slice(folder.length + 1)] = { out: sha256(bytes) };
    }
    const writeManifests = (params: string) => {
      for (const [folder, entries] of Object.entries(manifests))
        writeFileSync(
          join(root, folder, 'tone-manifest.json'),
          JSON.stringify({ params_sha256: params, files: entries }),
        );
    };
    const pinsPath = join(root, 'pins.json');
    writeManifests('0'.repeat(64));
    expect(() => pinThugSources(root, pinsPath)).toThrow(/not toned with the frozen parameters/);
    writeManifests(THUG_TONE.params);
    writeFileSync(join(root, 'idle/north/2.png'), new Uint8Array([9]));
    expect(() => pinThugSources(root, pinsPath)).toThrow(
      /idle\/north\/2.png is not the cel its tone manifest wrote/,
    );
    writeFileSync(join(root, 'idle/north/2.png'), bytes);
    pinThugSources(root, pinsPath);
    expect(() => pinThugSources(root, pinsPath)).toThrow(/never rewritten/);
    writeFileSync(join(root, 'walk-se-r2b/03.png'), new Uint8Array([7]));
    await expect(buildThug(root, { outDir: join(root, 'out'), pinsPath })).rejects.toThrow(
      /PixelLab walk-se-r2b\/03.png does not match its pin/,
    );
  });
});
