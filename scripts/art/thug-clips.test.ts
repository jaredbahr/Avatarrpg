import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEADINGS, KO_HEADINGS, hitClip, koClip } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import { buildEnemyClips, checkEnemyClipSources, enemyTakes, parseTiming } from './enemy-clips';
import type { EnemyClipPins, PackedClip } from './enemy-clips';
import { THUG_CLIPS, THUG_CLIP_PINS, THUG_CLIP_SOURCE } from './thug-clips';
import { THUG_KEY } from './thug-g';

// Decoding WebP pages is cheap alone and slow on a busy machine (see thug-g.test.ts).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const TEMP: string[] = [];
afterEach(() => {
  for (const dir of TEMP.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const pins = (): EnemyClipPins => JSON.parse(readFileSync(THUG_CLIP_PINS, 'utf8')) as EnemyClipPins;
const shippedClips = (): Record<string, PackedClip> =>
  JSON.parse(readFileSync('public/art/units/thug-g-clips.json', 'utf8')) as Record<
    string,
    PackedClip
  >;

describe('thug hits and knockouts (ADR 0059, ADR 0063)', () => {
  it('pins exactly the cels and timing files the build reads, from the frozen tone', () => {
    const p = pins();
    expect(checkEnemyClipSources(resolve(THUG_CLIP_SOURCE), THUG_CLIPS, p)).toEqual([]);
    expect(p.tone).toEqual(THUG_CLIPS.tone);
    const hitCels = Object.keys(p.cels).filter((file) => file.startsWith('hit'));
    const koCels = Object.keys(p.cels).filter((file) => file.startsWith('ko'));
    // A hit is stance, H1, H2, H3, stance; a knockout is the stance and six cels.
    expect(hitCels).toHaveLength(8 * 5);
    expect(koCels).toHaveLength(4 * 7);
    expect(Object.keys(p.timing)).toHaveLength(12);
    for (const hash of [...Object.values(p.cels), ...Object.values(p.timing)])
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('starts every take on the thug’s own idle cel 0 for the heading', () => {
    const idle = JSON.parse(readFileSync('art/source/thug-g/pins.json', 'utf8')) as {
      pixellab: Record<string, string>;
    };
    const p = pins();
    for (const set of ['hit', 'ko'] as const)
      for (const take of enemyTakes(THUG_CLIPS, set))
        expect(p.cels[`${take.clip}/00.png`], take.clip).toBe(
          idle.pixellab[`idle/${take.heading.direction}/0.png`],
        );
    // A hit ends on the stance it began on.
    for (const heading of HEADINGS)
      expect(p.cels[`${hitClip(heading)}/04.png`]).toBe(p.cels[`${hitClip(heading)}/00.png`]);
  });

  it('writes a hit in each of eight headings and a knockout on each diagonal', () => {
    const clips = shippedClips();
    expect(Object.keys(clips).sort()).toEqual(
      [...HEADINGS.map(hitClip), ...KO_HEADINGS.map(koClip)].sort(),
    );
    for (const [name, clip] of Object.entries(clips)) {
      const hit = name.startsWith('hit');
      expect(clip.loop, name).toBe(false);
      expect(clip.frameMs, name).toHaveLength(clip.frames.length);
      expect(clip.frames, name).toHaveLength(hit ? 5 : 7);
      expect(clip.anchor.x, name).toBeGreaterThan(0);
      expect(clip.anchor.x, name).toBeLessThan(1);
      expect(clip.anchor.y, name).toBeGreaterThan(0.5);
      expect(clip.anchor.y, name).toBeLessThan(1);
      // The hit-stop rides the contact frame: 70 ms + 80 ms.
      if (hit) {
        expect(clip.frameMs[1], name).toBe(150);
        expect(clip.frames[4], name).toBe(clip.frames[0]);
      } else {
        expect(clip.frameMs[1], name).toBe(160);
        expect(clip.frameMs.at(-1), name).toBe(400);
      }
    }
  });

  it('draws only frames the pages hold, one pin each', () => {
    const p = pins();
    const drawn = Object.values(shippedClips()).flatMap((clip) => [...clip.frames]);
    expect(Object.keys(p.frames).sort()).toEqual([...new Set(drawn)].sort());
    for (const frame of Object.keys(p.frames)) expect(frame.startsWith(`${THUG_KEY}/`)).toBe(true);
  });

  it('is what the manifest lists for the thug, and for no other enemy', () => {
    const thug = ASSETS[THUG_KEY];
    if (thug?.kind !== 'sheet') throw new Error('The thug is not a sheet');
    expect(thug.atlasPages).toEqual(['art/units/thug-g-2.json', 'art/units/thug-g-3.json']);
    expect(thug.clipData).toBe('art/units/thug-g-clips.json');
    for (const other of ['slinger', 'bruiser', 'quarrybender']) {
      const entry = ASSETS[`unit.enemy.${other}`];
      if (entry?.kind !== 'sheet') throw new Error(`${other} is not a sheet`);
      expect(entry.clipData, other).toBeUndefined();
      expect(entry.atlasPages, other).toBeUndefined();
    }
  });

  it('rebuilds to the shipped clip data, atlas pages and cel pins', async () => {
    const root = mkdtempSync(join(tmpdir(), 'thug-clips-'));
    TEMP.push(root);
    const pinsPath = join(root, 'pins.json');
    cpSync(THUG_CLIP_PINS, pinsPath);
    const out = join(root, 'out');
    const dataPath = join(out, 'thug-g-clips.json');
    await buildEnemyClips(THUG_CLIPS, resolve(THUG_CLIP_SOURCE), {
      outDir: out,
      dataPath,
      pinsPath,
      log: () => undefined,
    });
    expect(readFileSync(dataPath, 'utf8')).toBe(
      readFileSync('public/art/units/thug-g-clips.json', 'utf8'),
    );
    for (const page of ['thug-g-2.json', 'thug-g-3.json'])
      expect(readFileSync(join(out, page), 'utf8')).toBe(
        readFileSync(`public/art/units/${page}`, 'utf8'),
      );
    expect(JSON.parse(readFileSync(pinsPath, 'utf8'))).toEqual(pins());
  });

  it('refuses a changed cel, and a timing that does not credit CMU capture', async () => {
    const root = mkdtempSync(join(tmpdir(), 'thug-clips-src-'));
    TEMP.push(root);
    const source = join(root, 'cels');
    cpSync(resolve(THUG_CLIP_SOURCE), source, { recursive: true });
    writeFileSync(join(source, 'hitSouth/02.png'), new Uint8Array([1, 2, 3]));
    await expect(
      buildEnemyClips(THUG_CLIPS, source, {
        outDir: join(root, 'out'),
        dataPath: join(root, 'out/clips.json'),
        log: () => undefined,
      }),
    ).rejects.toThrow(/hitSouth\/02.png does not match its pin/);
    const text = readFileSync(join(resolve(THUG_CLIP_SOURCE), 'hitSouth/timing.json'), 'utf8');
    expect(() => parseTiming(text, 'hitSouth', 'hit')).not.toThrow();
    expect(() =>
      parseTiming(text.replace(/mocap\.cs\.cmu\.edu/g, 'mocapdata.com'), 'hitSouth', 'hit'),
    ).toThrow(/does not credit CMU capture/);
    expect(() => parseTiming(text, 'hitSouth', 'ko')).toThrow(/is not a ko timing file/);
  });
});
