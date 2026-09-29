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

/** The atlas JSON the store fetches for `path`, holding the named frames. */
function atlasJson(image: string, ...frames: string[]): string {
  return JSON.stringify({
    frames: Object.fromEntries(
      frames.map((frame) => [frame, { frame: { x: 0, y: 0, w: 128, h: 192 } }]),
    ),
    meta: { image, size: { w: 128, h: 192 } },
  });
}

const KEY = 'unit.fire.kaya';

const BEND_PAGE = 'art/units/kaya-g-bend.json';
const BEND_DATA = 'art/units/kaya-bend.json';
const CLIP_PAGE = 'art/units/kaya-g-3.json';
const CLIP_DATA = 'art/units/kaya-g-clips.json';
const shipped = (path: string): string => readFileSync(`public/${path}`, 'utf8');

function stubPages(failing: readonly string[] = []): void {
  const entry = resolveAsset(KEY);
  if (entry.kind !== 'sheet' || !entry.atlasPages?.[0]) throw new Error('Expected a paged sheet');
  const pages: Record<string, string> = {
    [entry.atlas]: atlasJson('kaya-g.webp', `${KEY}/idle/0`, `${KEY}/ko/0`),
    [entry.atlasPages[0]]: atlasJson('kaya-g-2.webp', `${KEY}/stance/0`),
  };
  // Any further page (Kaya's lossless riverside page, ADR 0054) loads too.
  for (const [index, path] of entry.atlasPages.slice(1).entries())
    pages[path] = atlasJson(`kaya-page-${index + 3}.png`, `${KEY}/wave/${index}`);
  // The knockout page and its clips are the shipped files (ADR 0059).
  pages[CLIP_PAGE] = shipped(CLIP_PAGE);
  pages[CLIP_DATA] = shipped(CLIP_DATA);
  // The bend page and its data are the shipped files (ADR 0055).
  pages[BEND_PAGE] = shipped(BEND_PAGE);
  pages[BEND_DATA] = shipped(BEND_DATA);
  for (const path of failing) delete pages[path];
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

/** Polls until `done` holds, so a chained load is waited on rather than guessed at. */
async function until(done: () => boolean): Promise<void> {
  for (let tries = 0; tries < 400 && !done(); tries++) await settle();
  expect(done()).toBe(true);
}

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

describe('a G knockout fetched with its sheet (ADR 0059)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws each by its own trimmed cel and anchor, timed cel by cel', async () => {
    stubPages();
    const entry = resolveAsset(KEY);
    if (entry.kind !== 'sheet') throw new Error('Expected a sheet');
    expect(entry.atlasPages).toContain(CLIP_PAGE);
    expect(entry.clipData).toBe(CLIP_DATA);
    // The manifest does not carry them: they cost the bundle nothing.
    expect(entry.clips.koNorthWest).toBeUndefined();
    const store = new SheetStore();
    expect(store.clips(KEY)).toBeUndefined();
    store.frame(KEY, 'idle', 0, undefined, 128, 1);
    await until(() => store.loadedFor(KEY));
    const clips = store.clips(KEY);
    expect(clips?.idle).toBe(entry.clips.idle);
    for (const clip of ['koSouthEast', 'koNorthWest'] as const) {
      const def = clips?.[clip];
      if (!def?.frameMs || !def.frameSize) throw new Error(`Expected a timed ${clip}`);
      let at = 0;
      def.frameMs.forEach((ms, index) => {
        // A named frame does not stop a timed clip from playing by time.
        const frame = store.frame(KEY, clip, at + ms / 2, 0, 128, 1);
        expect(frame?.clip).toBe(clip);
        expect(frame?.index).toBe(index);
        expect(frame?.anchor).toEqual(def.anchor);
        expect({ w: frame?.frame.w, h: frame?.frame.h }).toEqual(def.frameSize);
        at += ms;
      });
      // Played through, it holds its last frame.
      expect(store.frame(KEY, clip, at + 10_000, undefined, 128, 1)?.index).toBe(
        def.frames.length - 1,
      );
    }
    // The stance still stands by the sheet's anchor.
    expect(store.frame(KEY, 'stance', 0, undefined, 128, 1)?.anchor).toEqual(entry.anchor);
  });

  // A missing clip file drops only the extra clips; a `koX` falls back to `ko`.
  it('drops only the extra clips when its clip data is missing', async () => {
    stubPages([CLIP_DATA]);
    const store = new SheetStore();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    store.frame(KEY, 'idle', 0, undefined, 128, 1);
    await until(() => store.loadedFor(KEY));
    // The sheet and its own clips are in; only the fetched clips are missing.
    expect(store.loadedFor(KEY)).toBe(true);
    expect(store.clips(KEY)?.koNorthWest).toBeUndefined();
    expect(store.frame(KEY, 'idle', 0, undefined, 128, 1)?.placeholder).toBe(false);
    // A G knockout resolves back to the sheet's legacy `ko` pose.
    const ko = store.frame(KEY, 'koNorthWest', 0, undefined, 128, 1);
    expect(ko?.clip).toBe('ko');
    expect(ko?.placeholder).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still fails the whole sheet when one of its pages fails', async () => {
    stubPages([CLIP_PAGE]);
    const store = new SheetStore();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    store.frame(KEY, 'idle', 0, undefined, 128, 1);
    await settle();
    await settle();
    expect(store.loadedFor(KEY)).toBe(false);
    expect(store.clips(KEY)).toBeUndefined();
    expect(store.frame(KEY, 'idle', 0, undefined, 128, 1)).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('a bend on its sheet (ADR 0055)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeImage.failing.clear();
  });

  const data = JSON.parse(shipped(BEND_DATA)) as BendSetDef;
  const fetchStub = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  const fetched = (path: string): number =>
    fetchStub().mock.calls.filter(([url]) => String(url).endsWith(path)).length;
  /** Answers `path` with `response` from now on. */
  const answer = (path: string, response: { ok: boolean; status: number; body: string }): void => {
    const original = fetchStub().getMockImplementation();
    fetchStub().mockImplementation((url: string) =>
      url.endsWith(path)
        ? Promise.resolve({
            ok: response.ok,
            status: response.status,
            text: () => Promise.resolve(response.body),
          })
        : original?.(url),
    );
  };

  it('registers each G character’s bend page and data on its sheet, apart from its pages', () => {
    for (const name of ['kaya', 'sura', 'bo']) {
      const key = { kaya: KEY, sura: 'unit.water.sura', bo: 'unit.earth.bo' }[name] ?? '';
      const entry = resolveAsset(key);
      if (entry.kind !== 'sheet') throw new Error(`${key} is not a sheet`);
      expect(entry.bendPages).toEqual([`art/units/${name}-g-bend.json`]);
      expect(entry.atlasPages).not.toContain(`art/units/${name}-g-bend.json`);
      expect(entry.bend).toBe(`art/units/${name}-bend.json`);
    }
  });

  it('never fetches a bend for a scene that only draws the sheet', async () => {
    stubPages();
    const store = new SheetStore();
    store.frame(KEY, 'idle', 0, undefined, 128, 1);
    await until(() => store.loadedFor(KEY));
    await settle();
    expect(store.frame(KEY, 'stance', 0, undefined, 128, 1)?.placeholder).toBe(false);
    expect(store.bendState(KEY)).toBe('idle');
    expect(fetched(BEND_PAGE)).toBe(0);
    expect(fetched(BEND_DATA)).toBe(0);
  });

  it('loads the bend only after the sheet, on the first ask, and resolves nothing before', async () => {
    stubPages();
    const store = new SheetStore();
    expect(store.bendFrame(KEY, 'east', 0)).toBeNull();
    expect(store.bendSet(KEY)).toBeUndefined();
    // The sheet is still loading, so the bend waits for it.
    expect(store.bendState(KEY)).toBe('loading');
    expect(fetched(BEND_DATA)).toBe(0);
    await until(() => store.bendState(KEY) === 'loaded');
    expect(store.loadedFor(KEY)).toBe(true);
    expect(fetched(BEND_DATA)).toBe(1);
    expect(fetched(BEND_PAGE)).toBe(1);
    expect(store.bendSet(KEY)?.id).toBe(data.id);
    expect(store.bendFrame(KEY, 'east', 0)).not.toBeNull();
  });

  it('preloads a bend on request, once, with its sheet first', async () => {
    stubPages();
    const store = new SheetStore();
    store.preloadBend(KEY);
    store.preloadBend(KEY);
    await until(() => store.bendState(KEY) === 'loaded');
    store.preloadBend(KEY);
    expect(fetched(BEND_DATA)).toBe(1);
    expect(store.loadedFor(KEY)).toBe(true);
    expect(store.bendFrame(KEY, 'south', 0)?.heading).toBe('south');
    // A key with no bend has nothing to preload.
    store.preloadBend('unit.enemy.thug');
    expect(store.bendState('unit.enemy.thug')).toBe('none');
  });

  it('releases a loaded bend on combat exit, keeps the sheet, and loads it again when asked', async () => {
    stubPages();
    const store = new SheetStore();
    store.preloadBend(KEY);
    await until(() => store.bendState(KEY) === 'loaded');
    store.releaseBends();
    expect(store.bendState(KEY)).toBe('idle');
    expect(store.loadedFor(KEY)).toBe(true);
    expect(fetched(BEND_DATA)).toBe(1);
    store.preloadBend(KEY);
    await until(() => store.bendState(KEY) === 'loaded');
    expect(fetched(BEND_DATA)).toBe(2);
    expect(store.bendFrame(KEY, 'east', 0)).not.toBeNull();
  });

  it('draws each cel from the bend page by its heading’s anchor, not the sheet’s', async () => {
    stubPages();
    const store = new SheetStore();
    store.bendSet(KEY);
    await until(() => store.bendState(KEY) === 'loaded');
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

  it('never draws a bend cel with no hold, or whose size is not its heading’s frameSize', async () => {
    stubPages();
    const store = new SheetStore();
    const east = data.facings.east;
    const south = data.facings.south;
    const bad = {
      ...data,
      facings: {
        ...data.facings,
        east: { ...east, frameSize: { width: 1, height: 1 } },
        south: { ...south, frameMs: south.frameMs.slice(0, 1) },
      },
    };
    answer(BEND_DATA, { ok: true, status: 200, body: JSON.stringify(bad) });
    store.bendSet(KEY);
    await until(() => store.bendState(KEY) === 'loaded');
    expect(store.bendFrame(KEY, 'east', 0)).toBeNull();
    expect(store.bendFrame(KEY, 'west', 0)).not.toBeNull();
    expect(store.bendFrame(KEY, 'south', 0)).not.toBeNull();
    expect(store.bendFrame(KEY, 'south', 1)).toBeNull();
  });

  for (const [what, fail] of [
    ['page', () => FakeImage.failing.add('/art/units/kaya-g-bend.webp')],
    ['data', () => answer(BEND_DATA, { ok: false, status: 404, body: '' })],
  ] as const) {
    it(`fails only the bend when its ${what} fails, for the session`, async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      stubPages();
      fail();
      const store = new SheetStore();
      store.preloadBend(KEY);
      await until(() => store.bendState(KEY) === 'failed');
      // The sheet, its locomotion and its stance still draw from the atlas.
      expect(store.loadedFor(KEY)).toBe(true);
      expect(store.frame(KEY, 'idle', 0, undefined, 128, 1)?.placeholder).toBe(false);
      expect(store.frame(KEY, 'stance', 0, undefined, 128, 1)?.placeholder).toBe(false);
      expect(store.bendFrame(KEY, 'east', 0)).toBeNull();
      expect(store.bendSet(KEY)).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      // No retry: asking again, even once the files would load, fetches nothing.
      FakeImage.failing.clear();
      stubPages();
      store.preloadBend(KEY);
      store.bendFrame(KEY, 'east', 0);
      await settle();
      expect(fetched(BEND_DATA)).toBe(0);
      expect(store.bendState(KEY)).toBe('failed');
    });
  }

  it('fails the bend with its sheet, and fetches none of it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubPages();
    FakeImage.failing.add('/art/units/kaya-g-2.webp');
    const store = new SheetStore();
    expect(store.bendFrame(KEY, 'east', 0)).toBeNull();
    await until(() => store.bendState(KEY) === 'failed');
    expect(store.loadedFor(KEY)).toBe(false);
    expect(fetched(BEND_DATA)).toBe(0);
    expect(fetched(BEND_PAGE)).toBe(0);
  });

  it('resolves no bend for a sheet that has none', async () => {
    stubPages();
    const store = new SheetStore();
    expect(store.bendFrame('unit.fire.tenzo', 'east', 0)).toBeNull();
    expect(store.bendSet('unit.enemy.thug')).toBeUndefined();
    expect(store.bendSet('npc.elder')).toBeUndefined();
    expect(store.bendState('unit.enemy.thug')).toBe('none');
  });
});
