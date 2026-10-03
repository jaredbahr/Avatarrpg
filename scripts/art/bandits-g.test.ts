import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEADINGS, headingClip } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import { checkSources, sha256 } from './g-sprites';
import type { BanditName } from './bandits-g';
import {
  BANDITS,
  BANDIT_NAMES,
  BANDIT_TONE,
  banditCels,
  banditOrigin,
  importBandit,
} from './bandits-g';
import type { EnemyGPins } from './enemy-g';
import { IDLE_CELS, WALK_CELS, buildEnemyG, enemyCounts, enemySourceFiles } from './enemy-g';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const TEMP: string[] = [];
afterEach(() => {
  for (const dir of TEMP.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const pinsOf = (name: BanditName) =>
  JSON.parse(readFileSync(BANDITS[name].pins, 'utf8')) as EnemyGPins;

describe('quarry bandit G sheets (ADR 0062)', () => {
  it.each(BANDIT_NAMES)('pins exactly the copied cels and preserved actions of the %s', (name) => {
    const def = BANDITS[name];
    const pins = pinsOf(name);
    const files = enemySourceFiles(def);
    expect(files.pixellab).toHaveLength(8 * (IDLE_CELS + WALK_CELS));
    expect(pins.tone).toEqual(BANDIT_TONE);
    expect(checkSources(banditCels(name), files.pixellab, pins.pixellab, 'PixelLab')).toEqual([]);
    expect(checkSources(def.actions, files.actions, pins.actions, 'action')).toEqual([]);
    // Every copied cel records where the hand-off had it.
    expect(Object.keys(pins.origin ?? {}).sort()).toEqual([...files.pixellab].sort());
    for (const file of files.pixellab)
      expect(pins.origin?.[file]).toBe(
        `${banditOrigin(name, file).set}/${banditOrigin(name, file).file}`,
      );
  });

  it('takes each walk the retake rounds replaced, and only those', () => {
    const retakes = (name: BanditName) =>
      Object.values(pinsOf(name).origin ?? {}).filter((path) => !path.includes('/final-toned/'));
    expect(retakes('slinger')).toEqual([]);
    const quarry = retakes('quarrybender');
    expect(quarry).toHaveLength(16);
    expect(quarry.every((path) => /final-r3-toned\/walk\/(north|south-east)-r3\//.test(path))).toBe(
      true,
    );
    const bruiser = retakes('bruiser');
    expect(bruiser.filter((path) => path.includes('/final-r3-toned/walk/west-r3/'))).toHaveLength(
      8,
    );
    expect(
      bruiser.filter((path) => path.includes('/final-r3-toned/walk/south-west-r3b/')),
    ).toHaveLength(8);
    // The supervisor took r4b for its stride over r2's travel number.
    expect(
      bruiser.filter((path) => path.includes('/final-r4-toned/walk/south-east-r4b/')),
    ).toHaveLength(8);
    expect(bruiser).toHaveLength(24);
    // Every idle is the offered final-toned one; the bruiser's south-east is take 1's.
    for (const name of BANDIT_NAMES)
      for (const [file, path] of Object.entries(pinsOf(name).origin ?? {}))
        if (file.startsWith('idle/')) expect(path).toBe(`${name}/final-toned/${file}`);
  });

  it.each(BANDIT_NAMES)(
    'pins a decoded cel for every frame the %s manifest draws, and draws every one',
    (name) => {
      const def = BANDITS[name];
      const pins = pinsOf(name);
      const entry = ASSETS[def.key];
      if (entry?.kind !== 'sheet') throw new Error(`${def.key} is not a sheet`);
      expect(entry.atlas).toBe(`art/units/${name}-g.json`);
      expect(entry.facing).toBe('both');
      expect(entry.locomotion?.headings).toBe(8);
      expect(entry.frameSize?.w ?? 128).toBe(def.frameW);
      const drawn = Object.values(entry.clips).flatMap((clip) => clip?.frames ?? []);
      expect(Object.keys(pins.frames).sort()).toEqual([...new Set(drawn)].sort());
      const counts = enemyCounts(def);
      for (const [clip, count] of Object.entries(counts))
        expect(entry.clips[clip as keyof typeof counts]?.frames, clip).toHaveLength(count);
    },
  );

  it('places every heading within the party rules’ bounds', () => {
    for (const name of BANDIT_NAMES) {
      const def = BANDITS[name];
      expect(def.headings.map((h) => h.idle)).toEqual(
        expect.arrayContaining(HEADINGS.map((heading) => headingClip('idle', heading))),
      );
      for (const h of def.headings) {
        const at = `${name} ${h.direction}`;
        expect(h.restCel, at).toBeGreaterThanOrEqual(0);
        expect(h.restCel, at).toBeLessThan(WALK_CELS);
        expect(Math.abs(h.walkDx), at).toBeLessThanOrEqual(8);
        expect(Math.abs(h.idleDy), at).toBeLessThanOrEqual(8);
        expect(Math.abs(h.walkDy), at).toBeLessThanOrEqual(16);
        // Only the south-east near foot needs the heading moved, and little.
        expect(Math.abs(h.headingDx), at).toBeLessThanOrEqual(h.direction === 'south-east' ? 4 : 0);
      }
    }
  });

  it('refuses a cel its tone manifest did not write, overwrites nothing, and builds only pinned cels', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bandit-src-'));
    TEMP.push(root);
    const handoff = join(root, 'handoff');
    const repo = join(root, 'repo');
    const def = BANDITS.bruiser;
    const bytes = new Uint8Array([1, 2, 3]);
    const manifests: Record<string, Record<string, { out: string }>> = {};
    for (const file of enemySourceFiles(def).pixellab) {
      const from = banditOrigin('bruiser', file);
      mkdirSync(join(handoff, from.set, from.file, '..'), { recursive: true });
      writeFileSync(join(handoff, from.set, from.file), bytes);
      (manifests[from.set] ??= {})[from.file] = { out: sha256(bytes) };
    }
    for (const file of enemySourceFiles(def).actions) {
      mkdirSync(join(repo, def.actions, file, '..'), { recursive: true });
      writeFileSync(join(repo, def.actions, file), bytes);
    }
    const writeManifests = (params: string) => {
      for (const [set, files] of Object.entries(manifests))
        writeFileSync(
          join(handoff, set, 'tone-manifest.json'),
          JSON.stringify({ params_sha256: params, files }),
        );
    };
    writeManifests('0'.repeat(64));
    expect(() => importBandit('bruiser', handoff, repo)).toThrow(
      /final-r4-toned was not toned with the frozen parameters/,
    );
    writeManifests(BANDIT_TONE.params);
    const retake = join(handoff, 'bruiser/final-r4-toned/walk/south-east-r4b/02.png');
    writeFileSync(retake, new Uint8Array([9]));
    expect(() => importBandit('bruiser', handoff, repo)).toThrow(
      /south-east-r4b\/02.png is not the cel its tone manifest wrote/,
    );
    writeFileSync(retake, bytes);
    importBandit('bruiser', handoff, repo);
    expect(readFileSync(join(repo, banditCels('bruiser'), 'walk/south-east/02.png'))).toEqual(
      Buffer.from(bytes),
    );
    expect(() => importBandit('bruiser', handoff, repo)).toThrow(/never rewritten/);
    writeFileSync(join(repo, banditCels('bruiser'), 'walk/west/03.png'), new Uint8Array([7]));
    await expect(
      buildEnemyG(def, join(repo, banditCels('bruiser')), {
        outDir: join(root, 'out'),
        pinsPath: join(repo, def.pins),
        actions: join(repo, def.actions),
      }),
    ).rejects.toThrow(/PixelLab walk\/west\/03.png does not match its pin/);
  });
});
