import { afterEach, expect, it, vi } from 'vitest';
import { sceneImages } from '../scene';
import { SceneTextures } from './sceneTextures';
import type { SceneImage } from '../../core/types';

const state = vi.hoisted(() => ({
  created: [] as { source: object; destroy: ReturnType<typeof vi.fn> }[],
  disposal: [] as boolean[],
}));
vi.mock('pixi.js', () => ({
  Rectangle: class {
    constructor(
      public x: number,
      public y: number,
      public width: number,
      public height: number,
    ) {}
  },
  Texture: class {
    source: object;
    destroy = vi.fn((owned: boolean) => {
      state.disposal.push(owned);
    });
    constructor(options: { source: object; frame?: object }) {
      this.source = options.source;
      state.created.push(this);
    }
    static from(image: object) {
      return new this({ source: image });
    }
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  state.created.length = 0;
  state.disposal.length = 0;
});
const piece = (x = 2): SceneImage => ({
  url: 'atlas.webp',
  x: 100,
  y: 200,
  width: 40,
  height: 80,
  sourceRect: { x, y: 2, width: 32, height: 64 },
});
const image = () => ({ naturalWidth: 256, naturalHeight: 128 }) as HTMLImageElement;

it('shares one page across slices, reuses views, and retires only unused views', () => {
  vi.spyOn(sceneImages, 'get').mockReturnValue(image());
  const cache = new SceneTextures();
  cache.begin();
  const a = cache.get(piece()),
    b = cache.get(piece(38));
  expect(a?.source).toBe(b?.source);
  expect(state.created).toHaveLength(3);
  cache.end();
  cache.begin();
  expect(cache.get(piece(38))).toBe(b);
  cache.end();
  expect(a?.destroy).toHaveBeenCalledWith(false);
  expect(b?.destroy).not.toHaveBeenCalled();
  expect(state.created[0]?.destroy).not.toHaveBeenCalled();
  cache.clear();
  expect(state.disposal).toEqual([false, false, true]);
  cache.clear();
  expect(state.disposal).toHaveLength(3);
});

it('replaces image identity and disposes page views before their owned source', () => {
  const get = vi.spyOn(sceneImages, 'get').mockReturnValue(image());
  const cache = new SceneTextures();
  cache.begin();
  const first = cache.get(piece());
  cache.end();
  get.mockReturnValue(image());
  cache.begin();
  expect(cache.get(piece())).not.toBe(first);
  cache.end();
  expect(state.disposal).toEqual([false, true]);
  cache.begin();
  cache.end();
  expect(state.disposal).toEqual([false, true, false, true]);
});

it('supports whole images and refuses missing or out-of-bounds regions without allocating', () => {
  const get = vi.spyOn(sceneImages, 'get').mockReturnValue(image());
  const cache = new SceneTextures();
  cache.begin();
  const { sourceRect: _crop, ...whole } = piece();
  expect(cache.get(whole)).toBe(state.created[0]);
  expect(cache.get(piece(250))).toBeNull();
  get.mockReturnValue(null);
  expect(cache.get(piece())).toBeNull();
  expect(state.created).toHaveLength(1);
  cache.end();
  cache.clear();
  expect(state.disposal).toEqual([true]);
});

it('keeps all 32 depth-owned slices resident on one page without per-frame allocation', () => {
  vi.spyOn(sceneImages, 'get').mockReturnValue(image());
  const cache = new SceneTextures();
  const pieces = Array.from({ length: 32 }, (_, i) => ({
    ...piece(),
    sourceRect: { x: (i % 8) * 28 + 2, y: Math.floor(i / 8) * 28 + 2, width: 24, height: 24 },
  }));
  for (let frame = 0; frame < 3; frame++) {
    cache.begin();
    for (const slice of pieces) expect(cache.get(slice)).not.toBeNull();
    cache.end();
  }
  expect(state.created).toHaveLength(33);
  expect(state.disposal).toEqual([]);
  cache.begin();
  cache.end();
  expect(state.disposal).toEqual([...Array<boolean>(32).fill(false), true]);
});
