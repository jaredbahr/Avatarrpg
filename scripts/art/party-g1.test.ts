import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { HEADINGS, hitClip } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import type { SheetEntry } from '../../src/content/assets/manifest';
import type { BendSetDef } from '../../src/content/bends';
import { bendSetDefSchema, validateBendSets } from '../../src/content/bends';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import type { Image } from './lib/image';
import { newImage, pixelAt, setPixel } from './lib/image';
import { decodeWebp, encodeWebpLossless, isLosslessWebp } from './lib/webp';
import { PARTY, SOURCE, pageOf } from './party-g1';
import { MARGIN } from './lib/align';
import {
  BEND_SHEETS,
  WEBP_SHEET_PINS,
  gridScale,
  readBendEffects,
  validateBends,
  validateSheets,
} from './validate';

/** The art bible's clear margin on the 64 px grid. */
const MARGIN_G1 = Math.round(MARGIN * gridScale(64));

// Decoding WebP plates is cheap alone and slow on a busy machine. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const KEYS = { kaya: 'unit.fire.kaya', sura: 'unit.water.sura', bo: 'unit.earth.bo' } as const;

function sheetOf(key: string): SheetEntry {
  const asset = ASSETS[key];
  if (asset?.kind !== 'sheet') throw new Error(`Missing ${key} sheet`);
  return asset;
}

/**
 * Negative fixtures start from the decoded pixels of every page, re-encoded
 * losslessly: an untouched cel decodes to exactly its pin, and only the cel a
 * fixture edits can change.
 */
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
    if (decoded.length !== atlases.length) throw new Error('Load the atlas first');
    const dir = mkdtempSync(join(tmpdir(), 'party-g1-atlas-'));
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
  /** Move a cel's pixels by (dx, dy), clearing what it uncovers. */
  function shift(pages: Image[], cel: ReturnType<typeof rect>, dx: number, dy: number) {
    const image = pages[cel.page];
    if (!image) throw new Error(`Missing page ${cel.page}`);
    const copy = newImage(cel.w, cel.h);
    for (let y = 0; y < cel.h; y++)
      for (let x = 0; x < cel.w; x++) setPixel(copy, x, y, pixelAt(image, cel.x + x, cel.y + y));
    for (let y = 0; y < cel.h; y++)
      for (let x = 0; x < cel.w; x++) {
        const sx = x - dx;
        const sy = y - dy;
        const from =
          sx >= 0 && sy >= 0 && sx < cel.w && sy < cel.h ? pixelAt(copy, sx, sy) : [0, 0, 0, 0];
        setPixel(image, cel.x + x, cel.y + y, from as [number, number, number, number]);
      }
  }
  function paint(
    pages: Image[],
    cel: ReturnType<typeof rect>,
    x: number,
    y: number,
    rgba: (was: readonly number[]) => [number, number, number, number],
  ) {
    const image = pages[cel.page];
    if (!image) throw new Error(`Missing page ${cel.page}`);
    setPixel(image, cel.x + x, cel.y + y, rgba(pixelAt(image, cel.x + x, cel.y + y)));
  }
  return { entry, load, rect, fixture, shift, paint };
}

describe('the party on the G1 grid (ADR 0089)', () => {
  it('declares 64 px a tile, a 64x96 cel and the same clips as before', () => {
    for (const key of Object.values(KEYS)) {
      const entry = sheetOf(key);
      expect(entry.pixelsPerTile).toBe(64);
      expect(entry.frameSize).toBeUndefined();
      expect(entry.anchor).toEqual({ x: 0.5, y: 0.85 });
      // The riverside cels joined page 1; the page list is otherwise as it was.
      expect(entry.atlasPages).toHaveLength(3);
      for (const clip of ['cast', 'ko'] as const) {
        expect(entry.clips[clip]?.frameSize, `${key} ${clip}`).toBeDefined();
        expect(entry.clips[clip]?.anchor, `${key} ${clip}`).toBeDefined();
      }
    }
  });

  it('pins every packed cel, on lossless pages, in the files art:validate reads', () => {
    for (const name of PARTY) {
      const key = KEYS[name];
      expect(WEBP_SHEET_PINS[key]).toEqual([`${SOURCE}/pins/${name}.json`]);
      expect(BEND_SHEETS[key]?.pins).toBe(`${SOURCE}/pins/${name}-bend.json`);
      const pins = JSON.parse(readFileSync(`${SOURCE}/pins/${name}.json`, 'utf8')) as {
        sources: Record<string, string>;
        frames: Record<string, string>;
      };
      for (const hash of [...Object.values(pins.sources), ...Object.values(pins.frames)])
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      for (const suffix of ['', '-2', '-3', '-4', '-bend'])
        expect(
          isLosslessWebp(new Uint8Array(readFileSync(`public/art/units/${name}-g${suffix}.webp`))),
          `${name}-g${suffix}`,
        ).toBe(true);
    }
    expect(pageOf('stanceNorth')).toBe('-2');
    expect(pageOf('koSouthEast')).toBe('-3');
    expect(pageOf('ko')).toBe('');
    expect(pageOf('hitEast')).toBe('-4');
    expect(pageOf('bendWest')).toBe('-bend');
    expect(pageOf('wave')).toBe('');
  });

  it('keeps every hit’s timing, its hit-stop, and its return to the stance', () => {
    for (const name of PARTY) {
      const data = JSON.parse(
        readFileSync(`public/art/units/${name}-g-clips.json`, 'utf8'),
      ) as Record<string, { frames: string[]; frameMs: number[]; loop: boolean }>;
      const [ms, stop] = ({ kaya: [400, 80], sura: [470, 70], bo: [540, 110] } as const)[name];
      for (const heading of HEADINGS) {
        const hit = data[hitClip(heading)];
        expect(
          hit?.frameMs.reduce((sum, t) => sum + t, 0),
          heading,
        ).toBe(ms + stop);
        expect(hit?.frames.at(-1), heading).toBe(hit?.frames[0]);
        expect(hit?.loop).toBe(false);
      }
    }
  });

  for (const name of PARTY) {
    it(`ships ${name}'s bend as a valid set on the stance, with the shipped timing`, () => {
      const set = JSON.parse(
        readFileSync(`public/art/units/${name}-bend.json`, 'utf8'),
      ) as BendSetDef;
      const before = JSON.parse(
        readFileSync(`${SOURCE}/shipped/${name}-bend.json`, 'utf8'),
      ) as BendSetDef;
      expect(bendSetDefSchema.safeParse(set).success).toBe(true);
      const frames = HEADINGS.flatMap((heading) => set.facings[heading].frames);
      expect(validateBendSets([set], readBendEffects(), Object.keys(ASSETS), frames)).toEqual([]);
      for (const heading of HEADINGS) {
        const facing = set.facings[heading];
        const was = before.facings[heading];
        // Frames, holds, timing, keys and attacks are the approved ones.
        for (const field of ['frames', 'frameMs', 'keyFrames', 'smearFrame', 'attacks'] as const)
          expect(facing[field], `${heading} ${field}`).toEqual(was[field]);
        expect(facing.frames.at(-1)).toBe(facing.frames[0]);
        expect(facing.scale).toBe(1);
        expect(facing.sourceSize).toEqual({ width: 128, height: 128 });
        expect(facing.socketsPerFrame).toHaveLength(facing.frames.length);
      }
    });
  }

  it('art:validate passes the bends and fails a bend cel whose pin moved', async () => {
    expect(await validateBends()).toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), 'party-g1-bend-pins-'));
    const kaya = BEND_SHEETS['unit.fire.kaya'];
    if (!kaya) throw new Error('no kaya bend');
    const pins = JSON.parse(readFileSync(kaya.pins, 'utf8')) as { frames: Record<string, string> };
    const name = 'unit.fire.kaya/bendSouth/3';
    const moved = join(dir, 'kaya-bend.json');
    writeFileSync(moved, JSON.stringify({ frames: { ...pins.frames, [name]: '0'.repeat(64) } }));
    expect(
      await validateBends('public', { ...BEND_SHEETS, 'unit.fire.kaya': { ...kaya, pins: moved } }),
    ).toEqual([`unit.fire.kaya: decoded bend cel "${name}" does not match its pin`]);
    rmSync(dir, { recursive: true });
  });
});

for (const name of PARTY) {
  const KEY = KEYS[name];
  describe(`decoded ${name} G1 atlas validation`, () => {
    const g = decodedAtlas(KEY);
    beforeAll(g.load);

    it('passes the shipped atlas and an exact lossless copy of its decoded pixels', async () => {
      expect(await validateSheets('public', { [KEY]: g.entry })).toEqual([]);
      expect(await validateSheets(await g.fixture(() => {}), { [KEY]: g.entry })).toEqual([]);
    });

    it('fails a cel that touches its margin, scaled to the grid', async () => {
      const rect = g.rect('idle/0');
      const dir = await g.fixture((pages) =>
        g.paint(pages, rect, MARGIN_G1 - 1, 20, () => [200, 40, 40, 255]),
      );
      expect(await validateSheets(dir, { [KEY]: g.entry })).toEqual([
        `${KEY}: frame "${KEY}/idle/0" has art inside the ${MARGIN_G1} px margin`,
        `${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`,
      ]);
    });

    it('fails a knockout that starts off the stance, and a recoloured cel on another page', async () => {
      const start = g.rect('koSouthWest/0');
      const stance = g.rect('stanceSouth/3');
      expect(stance.page).toBe(1);
      const dir = await g.fixture((pages) => {
        g.paint(pages, start, Math.floor(start.w / 2), Math.floor(start.h * 0.6), () => [
          0, 0, 0, 0,
        ]);
        g.paint(pages, stance, 32, 60, ([r = 0, gr = 0, b = 0, a = 0]) => [r, gr ^ 1, b, a]);
      });
      const problems = await validateSheets(dir, { [KEY]: g.entry });
      expect(problems).toContain(
        `${KEY}: decoded cel "${KEY}/koSouthWest/0" does not match its pin`,
      );
      expect(problems).toContain(
        `${KEY}: decoded cel "${KEY}/stanceSouth/3" does not match its pin`,
      );
      expect(problems.filter((p) => p.includes('alpha px off the stance cel'))).toHaveLength(1);
      expect(problems).toHaveLength(3);
    });

    it('fails a walk that sinks below where its idle stands, and a rest beside its feet', async () => {
      const dir = await g.fixture((pages) => {
        for (let i = 0; i < 12; i++) g.shift(pages, g.rect(`walkNorth/${i}`), 0, 3);
        g.shift(pages, g.rect('restSouth/0'), 10, 0);
      });
      const problems = await validateSheets(dir, { [KEY]: g.entry });
      expect(problems.some((p) => p.includes('clip "walkNorth" has its mean foot row'))).toBe(true);
      expect(problems.some((p) => p.includes(`"${KEY}/restSouth/0" centres its feet at x`))).toBe(
        true,
      );
    });

    it('fails a sheet whose second page is missing', async () => {
      // Lossless pages unpinned would be their own record (ADR 0054); the party's are pinned.
      expect(WEBP_SHEET_PINS[KEY]).toHaveLength(1);
      const dir = await g.fixture(() => {});
      const page2 = g.entry.atlasPages?.[0];
      if (!page2) throw new Error('Expected a second page');
      rmSync(join(dir, page2));
      expect(await validateSheets(dir, { [KEY]: g.entry })).toEqual([
        `${KEY}: ${page2} is missing under ${dir}/`,
      ]);
    });
  });
}
