import { describe, expect, it, vi } from 'vitest';
import { createTopdownVfxLoader, type TopdownVfxData } from './topdownVfx';

const fixture: TopdownVfxData = {
  frames: {},
  effects: {},
  meta: { image: 'vfx.webp', size: { w: 256, h: 256 } },
};

describe('top-down VFX recipe loading', () => {
  it('reuses the in-flight request and builds the JSON URL from BASE_URL', async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const load = createTopdownVfxLoader(fetcher);
    const first = load('/deployed/game/');
    const second = load('/deployed/game/');

    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/deployed/game/art/topdown/vfx.json');
    resolveResponse?.({ ok: true, json: async () => fixture } as Response);
    await expect(first).resolves.toEqual(fixture);
  });

  it('resolves fetch, HTTP and malformed JSON failures to null without throwing', async () => {
    const rejected = createTopdownVfxLoader(
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    );
    const httpFailure = createTopdownVfxLoader(
      vi.fn<typeof fetch>().mockResolvedValue({ ok: false } as Response),
    );
    const malformed = createTopdownVfxLoader(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue({ ok: true, json: async () => ({ frames: {} }) } as Response),
    );

    await expect(rejected('/')).resolves.toBeNull();
    await expect(httpFailure('/')).resolves.toBeNull();
    await expect(malformed('/')).resolves.toBeNull();
  });
});
