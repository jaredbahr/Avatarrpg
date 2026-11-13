import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolveAsset, useTopDownStyle } from '../../content/assets/manifest';
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
/** The top-down Driller: the one sheet on two atlas pages (ADR 0052), laid over `ASSETS` at boot. */
const PAGED = 'unit.enemy.driller';

const shipped = (path: string): string => readFileSync(`public/${path}`, 'utf8');

/**
 * Serves `pages` (site path to body) to `fetch`, every other path a 404, and loads images with
 * `FakeImage`.
 */
function serve(pages: Record<string, string>): void {
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

function sheet(key: string) {
  const entry = resolveAsset(key);
  if (entry.kind !== 'sheet') throw new Error(`Expected a sheet for ${key}`);
  return entry;
}

/** Kaya's top-down sheet as shipped: its atlas, its clips and its actions (ADR 0104). */
function serveKaya(missing: readonly string[] = []): void {
  const entry = sheet(KEY);
  const pages: Record<string, string> = {};
  for (const path of [entry.atlas, entry.clipData, entry.actions])
    if (path && !missing.includes(path)) pages[path] = shipped(path);
  serve(pages);
}

/** The Driller's two pages, each holding one named cel; its clips and actions are missing. */
function servePaged(): void {
  const entry = sheet(PAGED);
  const second = entry.atlasPages?.[0];
  if (!second) throw new Error('Expected a paged sheet');
  serve({
    [entry.atlas]: atlasJson('driller.webp', `${PAGED}/idle/0`),
    [second]: atlasJson('driller-2.webp', `${PAGED}/cast/0`),
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

/** Polls until `done` holds, so a chained load is waited on rather than guessed at. */
async function until(done: () => boolean): Promise<void> {
  for (let tries = 0; tries < 400 && !done(); tries++) await settle();
  expect(done()).toBe(true);
}

beforeAll(() => useTopDownStyle());

describe('a sheet on more than one atlas page (ADR 0052)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeImage.failing.clear();
  });

  it('loads every page, then draws each clip from the page that holds it', async () => {
    servePaged();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new SheetStore();
    expect(store.frame(PAGED, 'cast', 0, 0, 128, 2)).toBeNull();
    // Wait for the load itself: a fixed 5 ms was not always enough on a busy runner.
    await until(() => store.loadedFor(PAGED));
    const idle = store.frame(PAGED, 'idle', 0, 0, 128, 2);
    const cast = store.frame(PAGED, 'cast', 0, 0, 128, 2);
    expect(idle?.clip).toBe('idle');
    expect(cast?.clip).toBe('cast');
    expect((idle?.source as unknown as FakeImage).src).toMatch(/driller\.webp$/);
    expect((cast?.source as unknown as FakeImage).src).toMatch(/driller-2\.webp$/);
  });

  it('never draws from half a sheet: one failed page fails the whole sheet', async () => {
    servePaged();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    FakeImage.failing.add('/art/topdown/driller-2.webp');
    const store = new SheetStore();
    store.frame(PAGED, 'idle', 0, undefined, 128, 2);
    await settle();
    expect(store.loadedFor(PAGED)).toBe(false);
    expect(store.frame(PAGED, 'idle', 0, undefined, 128, 2)).toBeNull();
  });
});

describe('a knockout fetched with its sheet (ADR 0059)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeImage.failing.clear();
  });

  it('draws each by its own trimmed cel and anchor, timed cel by cel', async () => {
    serveKaya();
    const entry = sheet(KEY);
    // The manifest does not carry them: they cost the bundle nothing.
    expect(entry.clipData).toBeDefined();
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
        expect(frame?.anchor).toEqual(def.anchor ?? entry.anchor);
        expect({ w: frame?.frame.w, h: frame?.frame.h }).toEqual(def.frameSize);
        at += ms;
      });
      // Played through, it holds its last frame.
      expect(store.frame(KEY, clip, at + 10_000, undefined, 128, 1)?.index).toBe(
        def.frames.length - 1,
      );
    }
  });

  // A missing clip file drops only the extra clips; a top-down sheet's legacy `ko` and `hit` ride
  // in that file too, so a `koX` falls back to the idle.
  it('drops only the extra clips when its clip data is missing', async () => {
    const clipData = sheet(KEY).clipData ?? '';
    serveKaya([clipData]);
    const store = new SheetStore();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    store.frame(KEY, 'idle', 0, undefined, 128, 1);
    await until(() => store.loadedFor(KEY));
    // The sheet and its own clips are in; only the fetched clips are missing.
    expect(store.loadedFor(KEY)).toBe(true);
    expect(store.clips(KEY)?.koNorthWest).toBeUndefined();
    expect(store.frame(KEY, 'idle', 0, undefined, 128, 1)?.placeholder).toBe(false);
    const ko = store.frame(KEY, 'koNorthWest', 0, undefined, 128, 1);
    expect(ko?.clip).toBe('idle');
    expect(ko?.placeholder).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still fails the whole sheet when one of its pages fails', async () => {
    serveKaya([sheet(KEY).atlas]);
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

describe('a standing cel stands on its own soles (ADR 0093, planting amendment)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeImage.failing.clear();
  });

  it('moves an idle cel onto the row under its lowest sole, and leaves a knockout as authored', async () => {
    const { atlas, clipData = '' } = sheet(KEY);
    serve({
      [atlas]: atlasJson('kaya.webp', `${KEY}/idle/0`, `${KEY}/ko/0`),
      [clipData]: shipped(clipData),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Every cel the store reads is 128 x 192 with its lowest opaque row 3 px above the anchor's line.
    const line = Math.round(sheet(KEY).anchor.y * 192);
    const pixels = new Uint8ClampedArray(128 * 192 * 4);
    for (let y = 100; y <= line - 3; y++)
      for (let x = 50; x < 70; x++) pixels[(y * 128 + x) * 4 + 3] = 255;
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          clearRect: () => undefined,
          drawImage: () => undefined,
          getImageData: () => ({ data: pixels }),
        }),
      }),
    });
    const store = new SheetStore();
    // Load without asking for a frame, which would bake a painter placeholder meanwhile.
    expect(await store.whenLoaded(KEY)).toBe(true);
    const idle = store.frame(KEY, 'idle', 0, undefined, 128, 1);
    expect(idle?.anchor.y).toBeCloseTo((line - 2) / 192, 6);
    expect(idle?.feet?.ground).toBe(line - 2);
    const entry = resolveAsset(KEY);
    const ko = store.frame(KEY, 'ko', 0, undefined, 128, 1);
    // A knockout stands by its own authored anchor, never its soles.
    const koClip = ko ? store.clips(KEY)?.[ko.clip] : undefined;
    expect(ko?.anchor).toEqual(
      koClip?.anchor ?? (entry.kind === 'sheet' ? entry.anchor : undefined),
    );
    expect(ko?.feet).toBeUndefined();
  });
});
