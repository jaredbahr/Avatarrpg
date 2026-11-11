/**
 * Loads the top-down VFX recipes only for the opted-in top-down presentation.
 * The default bundle contains only this small loader, never the fetched JSON.
 */
export interface TopdownVfxData {
  readonly frames: Readonly<Record<string, unknown>>;
  readonly effects: Readonly<Record<string, unknown>>;
  readonly meta: {
    readonly image: string;
    readonly size: { readonly w: number; readonly h: number };
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validData(value: unknown): value is TopdownVfxData {
  if (!record(value) || !record(value.meta) || !record(value.meta.size)) return false;
  return (
    typeof value.meta.image === 'string' &&
    typeof value.meta.size.w === 'number' &&
    typeof value.meta.size.h === 'number' &&
    record(value.frames) &&
    record(value.effects)
  );
}

/** Injectable so the flag, in-flight reuse and failure contract stay testable. */
export function createTopdownVfxLoader(fetcher: typeof fetch) {
  let request: Promise<TopdownVfxData | null> | undefined;
  return (style: string | null, baseUrl: string): Promise<TopdownVfxData | null> => {
    if (style !== 'topdown') return Promise.resolve(null);
    if (!request) {
      request = fetcher(baseUrl + 'art/topdown/vfx.json')
        .then((response) => (response.ok ? response.json() : null))
        .then((data: unknown) => (validData(data) ? data : null))
        .catch(() => null);
    }
    return request;
  };
}

export const loadTopdownVfx = createTopdownVfxLoader(fetch);
