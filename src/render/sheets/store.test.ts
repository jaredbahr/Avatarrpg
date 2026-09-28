import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEADINGS } from '../../content/assets/clips';
import { resolveAsset } from '../../content/assets/manifest';
import type { BendSetDef } from '../../content/bends';
import { SheetStore } from './store';

/** A stand-in `Image` that loads, or fails, on the next tick once given a src. */
class FakeImage {
  static failing = new Set<string>();
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
  private url = '';
  get src(): string {
    return this.url;
  }
  set src(url: string) {
    this.url = url;
    setTimeout(() => (FakeImage.failing.has(url) ? this.onerror?.() : this.onload?.()), 0);
  }
}

/** One frame per page: the atlas JSON the store fetches for `path`. */
function atlasJson(image: string, frame: string): string {
  return JSON.stringify({
    frames: { [frame]: { frame: { x: 0, y: 0, w: 128, h: 192 } } },
    meta: { image, size: { w: 128, h: 192 } },
  });
}

const KEY = 'unit.fire.kaya';

const BEND_PAGE = 'art/units/kaya-g-bend.json';
const BEND_DATA = 'art/units/kaya-bend.json';
const shipped = (path: string): string => readFileSync(`public/${path}`, 'utf8');

function stubPages(): void {
  const entry = resolveAsset(KEY);
  if (entry.kind !== 'sheet' || !entry.atlasPages?.[0]) throw new Error('Expected a paged sheet');
  const pages: Record<string, string> = {
    [entry.atlas]: atlasJson('kaya-g.webp', `${KEY}/idle/0`),
    [entry.atlasPages[0]]: atlasJson('kaya-g-2.webp', `${KEY}/stance/0`),
  };
  // Any further page (Kaya's lossless riverside page, ADR 0054) loads too.
  for (const [index, path] of entry.atlasPages.slice(1).entries())
    pages[path] = atlasJson(`kaya-page-${index + 3}.png`, `${KEY}/wave/${index}`);
  // The bend page and its data are the shipped files (ADR 0055).
  pages[BEND_PAGE] = shipped(BEND_PAGE);
  pages[BEND_DATA] = shipped(BEND_DATA);
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const path = Object.keys(pages).find((candidate) => url.endsWith(candidate));
      return Promise.resolve(
        path
          ? { ok: true, status: 200, text: () => Promise.resolve(pages[path]) }
          : { ok: false, status: 404, text: () => Promise.resolve('') },
      );
    }),
  );
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('a sheet on more than one atlas page (ADR 0052)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeImage.failing.clear();
  });

  it('loads every page, then draws each clip from the page that holds it', async () => {
    stubPages();
    const store = new SheetStore();
    expect(store.frame(KEY, 'stance', 0, undefined, 128, 1)).toBeNull();
    await settle();
    expect(store.loadedFor(KEY)).toBe(true);
    const idle = store.frame(KEY, 'idle', 0, undefined, 128, 1);
    const stance = store.frame(KEY, 'stance', 0, undefined, 128, 1);
    expect(idle?.clip).toBe('idle');
    expect(stance?.clip).toBe('stance');
    expect((idle?.source as unknown as FakeImage).src).toMatch(/kaya-g\.webp$/);
    expect((stance?.source as unknown as FakeImage).src).toMatch(/kaya-g-2\.webp$/);
  });

  it('never draws from half a sheet: one failed page fails the whole sheet', async () => {
    stubPages();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    FakeImage.failing.add('/art/units/kaya-g-2.webp');
    const store = new SheetStore();
    store.frame(KEY, 'idle', 0, undefined, 128, 1);
    await settle();
    expect(store.loadedFor(KEY)).toBe(false);
    expect(store.frame(KEY, 'idle', 0, undefined, 128, 1)).toBeNull();
  });
});

describe('a bend on its sheet (ADR 0055)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeImage.failing.clear();
  });

  const data = JSON.parse(shipped(BEND_DATA)) as BendSetDef;

  it('registers each G character’s bend page and data on its sheet', () => {
    for (const name of ['kaya', 'sura', 'bo']) {
      const key = { kaya: KEY, sura: 'unit.water.sura', bo: 'unit.earth.bo' }[name] ?? '';
      const entry = resolveAsset(key);
      if (entry.kind !== 'sheet') throw new Error(`${key} is not a sheet`);
      expect(entry.atlasPages).toContain(`art/units/${name}-g-bend.json`);
      expect(entry.bend).toBe(`art/units/${name}-bend.json`);
    }
  });

  it('resolves no bend until every page and the data are in', async () => {
    stubPages();
    const store = new SheetStore();
    expect(store.bendFrame(KEY, 'east', 0)).toBeNull();
    expect(store.bendSet(KEY)).toBeUndefined();
    await settle();
    expect(store.bendSet(KEY)?.id).toBe(data.id);
    expect(store.bendFrame(KEY, 'east', 0)).not.toBeNull();
  });

  it('draws each cel from the bend page by its heading’s anchor, not the sheet’s', async () => {
    stubPages();
    const store = new SheetStore();
    store.bendSet(KEY);
    await settle();
    const page = JSON.parse(shipped(BEND_PAGE)) as {
      frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
    };
    for (const heading of HEADINGS) {
      const facing = data.facings[heading];
      facing.frames.forEach((name, index) => {
        const bend = store.bendFrame(KEY, heading, index);
        expect(bend?.frame).toEqual(page.frames[name]?.frame);
        expect((bend?.source as unknown as FakeImage).src).toMatch(/kaya-g-bend\.webp$/);
        expect(bend?.anchor).toEqual(facing.anchor);
        expect(bend?.ms).toBe(facing.frameMs[index]);
        expect(bend?.sockets).toEqual(facing.socketsPerFrame[index]?.sockets);
        expect(bend?.heading).toBe(heading);
        expect(bend?.index).toBe(index);
        expect(bend?.placeholder).toBe(false);
      });
      expect(store.bendFrame(KEY, heading, facing.frames.length)).toBeNull();
      expect(store.bendFrame(KEY, heading, -1)).toBeNull();
    }
    // The held cel is one rectangle named twice (Kaya's cross, frames 6 and 7).
    expect(store.bendFrame(KEY, 'east', 7)?.frame).toEqual(store.bendFrame(KEY, 'east', 6)?.frame);
    // The stance still draws by the sheet's anchor.
    expect(store.frame(KEY, 'stance', 0, undefined, 128, 1)?.anchor).toEqual({ x: 0.5, y: 0.85 });
  });

  it('never draws a bend cel whose size is not its heading’s frameSize', async () => {
    stubPages();
    const store = new SheetStore();
    const east = data.facings.east;
    const bad = {
      ...data,
      facings: { ...data.facings, east: { ...east, frameSize: { width: 1, height: 1 } } },
    };
    const fetchStub = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const original = fetchStub.getMockImplementation();
    fetchStub.mockImplementation((url: string) =>
      url.endsWith(BEND_DATA)
        ? Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(bad)),
          })
        : original?.(url),
    );
    store.bendSet(KEY);
    await settle();
    expect(store.bendFrame(KEY, 'east', 0)).toBeNull();
    expect(store.bendFrame(KEY, 'west', 0)).not.toBeNull();
  });

  it('fails the whole sheet when the bend page or the bend data fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubPages();
    FakeImage.failing.add('/art/units/kaya-g-bend.webp');
    const pageFails = new SheetStore();
    pageFails.frame(KEY, 'idle', 0, undefined, 128, 1);
    await settle();
    expect(pageFails.loadedFor(KEY)).toBe(false);

    FakeImage.failing.clear();
    const fetchStub = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const original = fetchStub.getMockImplementation();
    fetchStub.mockImplementation((url: string) =>
      url.endsWith(BEND_DATA)
        ? Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') })
        : original?.(url),
    );
    const dataFails = new SheetStore();
    dataFails.frame(KEY, 'idle', 0, undefined, 128, 1);
    await settle();
    expect(dataFails.loadedFor(KEY)).toBe(false);
    expect(dataFails.frame(KEY, 'idle', 0, undefined, 128, 1)).toBeNull();
    expect(dataFails.bendFrame(KEY, 'east', 0)).toBeNull();
  });

  it('resolves no bend for a sheet that has none', async () => {
    stubPages();
    const store = new SheetStore();
    expect(store.bendFrame('unit.fire.tenzo', 'east', 0)).toBeNull();
    expect(store.bendSet('unit.enemy.thug')).toBeUndefined();
    expect(store.bendSet('npc.elder')).toBeUndefined();
  });
});
