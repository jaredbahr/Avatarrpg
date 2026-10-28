import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { HEADINGS, hitClip } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import type { SheetEntry } from '../../src/content/assets/manifest';
import { RESIDENT_SHEET_PX_PER_WORLD_PX } from '../../src/content/assets/residentGrid';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import type { Image } from './lib/image';
import { newImage, pixelAt, setPixel } from './lib/image';
import { MARGIN } from './lib/align';
import { decodeWebp, encodeWebpLossless, isLosslessWebp } from './lib/webp';
import { BANDITS, NAMES, SOURCE, pageOf, readPack } from './residents-g1';
import type { G1Name } from './residents-g1';
import { WEBP_SHEET_PINS, gridScale, validateSheets } from './validate';

/** The art bible's clear margin on the 64 px grid. */
const MARGIN_G1 = Math.round(MARGIN * gridScale(64));

// Decoding WebP plates is cheap alone and slow on a busy machine. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const KEYS: Readonly<Record<G1Name, string>> = {
  household: 'npc.household',
  watch: 'npc.guard',
  mira: 'npc.elder',
  gao: 'npc.shopkeeper',
  pella: 'npc.kid',
  dorin: 'npc.dorin',
  thug: 'unit.enemy.thug',
  slinger: 'unit.enemy.slinger',
  bruiser: 'unit.enemy.bruiser',
};
const isBandit = (name: G1Name) => (BANDITS as readonly string[]).includes(name);

function sheetOf(key: string): SheetEntry {
  const asset = ASSETS[key];
  if (asset?.kind !== 'sheet') throw new Error(`Missing ${key} sheet`);
  return asset;
}

/** Every page decoded and re-encoded losslessly, so a fixture changes only the cel it edits. */
function decodedAtlas(key: string) {
  const entry = sheetOf(key);
  const paths = [entry.atlas, ...(entry.atlasPages ?? [])];
  const atlases = paths.map((path) => parseAtlasJson(readFileSync(`public/${path}`, 'utf8')));
  let decoded: Image[] = [];
  const load = async () => {
    decoded = await Promise.all(
      atlases.map((atlas) =>
        decodeWebp(new Uint8Array(readFileSync(`public/art/units/${atlas.image}`))),
      ),
    );
  };
  const rect = (name: string) => {
    for (const [page, atlas] of atlases.entries()) {
      const found = atlas.frames.get(`${key}/${name}`);
      if (found) return { ...found, page };
    }
    throw new Error(`Missing ${key}/${name}`);
  };
  async function fixture(edit: (pages: Image[]) => void): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), 'residents-g1-atlas-'));
    mkdirSync(join(dir, 'art', 'units'), { recursive: true });
    for (const path of [...paths, ...(entry.clipData ? [entry.clipData] : [])])
      copyFileSync(`public/${path}`, join(dir, path));
    const pages = decoded.map((page) => {
      const copy = newImage(page.width, page.height);
      copy.data.set(page.data);
      return copy;
    });
    edit(pages);
    for (const [index, atlas] of atlases.entries()) {
      const page = pages[index];
      if (!page) throw new Error(`Missing page ${index}`);
      writeFileSync(join(dir, 'art', 'units', atlas.image), await encodeWebpLossless(page));
    }
    return dir;
  }
  /** Move a cel's pixels down by dy, clearing what it uncovers. */
  function sink(pages: Image[], cel: ReturnType<typeof rect>, dy: number) {
    const image = pages[cel.page];
    if (!image) throw new Error(`Missing page ${cel.page}`);
    for (let y = cel.h - 1; y >= 0; y--)
      for (let x = 0; x < cel.w; x++) {
        const from = y - dy >= 0 ? pixelAt(image, cel.x + x, cel.y + y - dy) : [0, 0, 0, 0];
        setPixel(image, cel.x + x, cel.y + y, from as [number, number, number, number]);
      }
  }
  function paint(pages: Image[], cel: ReturnType<typeof rect>, x: number, y: number) {
    const image = pages[cel.page];
    if (!image) throw new Error(`Missing page ${cel.page}`);
    setPixel(image, cel.x + x, cel.y + y, [200, 40, 40, 255]);
  }
  return { entry, load, rect, fixture, sink, paint };
}

describe('the residents and the forest bandits on the G1 grid (ADR 0091)', () => {
  it('packs the residents at 1 sheet px per world px', () => {
    expect(RESIDENT_SHEET_PX_PER_WORLD_PX).toBe(1);
  });

  it('declares 64 px a tile, the anchor, and a cel wider than a tile only for a club', () => {
    for (const name of NAMES) {
      const entry = sheetOf(KEYS[name]);
      expect(entry.pixelsPerTile, name).toBe(64);
      expect(entry.anchor).toEqual({ x: 0.5, y: 0.85 });
      expect(entry.frameSize, name).toEqual(
        ({ thug: { w: 80, h: 96 }, bruiser: { w: 96, h: 96 } } as Record<string, unknown>)[name],
      );
      expect(readPack(name).grid.frame).toEqual([entry.frameSize?.w ?? 64, 96]);
      if (!isBandit(name)) {
        expect(entry.atlasPages).toBeUndefined();
        continue;
      }
      expect(entry.atlasPages).toHaveLength(2);
      for (const clip of ['hit', 'ko'] as const) {
        expect(entry.clips[clip]?.frameSize, `${name} ${clip}`).toBeDefined();
        expect(entry.clips[clip]?.anchor, `${name} ${clip}`).toBeDefined();
      }
    }
  });

  it('pins every packed cel, on lossless pages, in the files art:validate reads', () => {
    for (const name of NAMES) {
      expect(WEBP_SHEET_PINS[KEYS[name]]).toEqual([`${SOURCE}/pins/${name}.json`]);
      const pins = JSON.parse(readFileSync(`${SOURCE}/pins/${name}.json`, 'utf8')) as {
        sources: Record<string, string>;
        frames: Record<string, string>;
      };
      for (const hash of [...Object.values(pins.sources), ...Object.values(pins.frames)])
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      for (const suffix of isBandit(name) ? ['', '-2', '-3'] : [''])
        expect(
          isLosslessWebp(new Uint8Array(readFileSync(`public/art/units/${name}-g${suffix}.webp`))),
          `${name}-g${suffix}`,
        ).toBe(true);
    }
    expect(pageOf('koSouthEast')).toBe('-2');
    expect(pageOf('ko')).toBe('');
    expect(pageOf('hitNorth')).toBe('-3');
    expect(pageOf('hit')).toBe('');
    expect(pageOf('walkWest')).toBe('');
  });

  it('keeps every bandit hit’s and knockout’s frames and timing, and returns a hit to idle', () => {
    for (const name of BANDITS) {
      const now = JSON.parse(
        readFileSync(`public/art/units/${name}-g-clips.json`, 'utf8'),
      ) as Record<string, { frames: string[]; frameMs: number[]; fps: number; loop: boolean }>;
      const was = JSON.parse(
        readFileSync(`${SOURCE}/shipped/${name}-g-clips.json`, 'utf8'),
      ) as typeof now;
      expect(Object.keys(now)).toEqual(Object.keys(was));
      for (const [clip, def] of Object.entries(was)) {
        expect(now[clip]?.frames, `${name} ${clip}`).toEqual(def.frames);
        expect(now[clip]?.frameMs, `${name} ${clip}`).toEqual(def.frameMs);
        expect(now[clip]?.fps).toBe(def.fps);
        expect(now[clip]?.loop).toBe(def.loop);
      }
      for (const heading of HEADINGS) {
        const hit = now[hitClip(heading)];
        expect(hit?.frames.at(-1), `${name} ${heading}`).toBe(hit?.frames[0]);
      }
    }
  });
});

for (const name of NAMES) {
  const KEY = KEYS[name];
  describe(`decoded ${name} G1 atlas validation`, () => {
    const g = decodedAtlas(KEY);
    beforeAll(g.load);

    it('passes the shipped atlas and an exact lossless copy of its decoded pixels', async () => {
      expect(await validateSheets('public', { [KEY]: g.entry })).toEqual([]);
      expect(await validateSheets(await g.fixture(() => {}), { [KEY]: g.entry })).toEqual([]);
    });

    it('fails a cel that touches its margin, and a walk that sinks below its idle', async () => {
      const idle = g.rect('idle/0');
      const dir = await g.fixture((pages) => {
        g.paint(pages, idle, MARGIN_G1 - 1, 20);
        for (let i = 0; i < 8; i++) g.sink(pages, g.rect(`walkSouth/${i}`), 4);
      });
      const problems = await validateSheets(dir, { [KEY]: g.entry });
      expect(problems).toContain(
        `${KEY}: frame "${KEY}/idle/0" has art inside the ${MARGIN_G1} px margin`,
      );
      expect(problems).toContain(`${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`);
      expect(problems.some((p) => p.includes('clip "walkSouth" has its mean foot row'))).toBe(true);
    });
  });
}
