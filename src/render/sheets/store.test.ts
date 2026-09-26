import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAsset } from '../../content/assets/manifest';
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

function stubPages(): void {
  const entry = resolveAsset(KEY);
  if (entry.kind !== 'sheet' || !entry.atlasPages?.[0]) throw new Error('Expected a paged sheet');
  const pages: Record<string, string> = {
    [entry.atlas]: atlasJson('kaya-g.webp', `${KEY}/idle/0`),
    [entry.atlasPages[0]]: atlasJson('kaya-g-2.webp', `${KEY}/stance/0`),
  };
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
