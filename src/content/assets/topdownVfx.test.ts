import { describe, expect, it, vi } from 'vitest';
import { createTopdownVfxLoader, type TopdownVfxData } from './topdownVfx';

const fixture: TopdownVfxData = {
  frames: {},
  effects: {},
  meta: { image: 'vfx.webp', size: { w: 256, h: 256 } },
};

describe('top-down VFX recipe loading', () => {
  it('does not fetch unless the recognized style is topdown', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const load = createTopdownVfxLoader(fetcher);

    await expect(load(null, '/deploy/')).resolves.toBeNull();
    await expect(load('default', '/deploy/')).resolves.toBeNull();
    await expect(load('topdown-extra', '/deploy/')).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reuses the in-flight request and builds the JSON URL from BASE_URL', async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const load = createTopdownVfxLoader(fetcher);
    const first = load('topdown', '/deployed/game/');
    const second = load('topdown', '/deployed/game/');

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

    await expect(rejected('topdown', '/')).resolves.toBeNull();
    await expect(httpFailure('topdown', '/')).resolves.toBeNull();
    await expect(malformed('topdown', '/')).resolves.toBeNull();
  });
});
