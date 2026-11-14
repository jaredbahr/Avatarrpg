import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MapScene } from '../core/types';
import { loadTopDownPresentations, TOPDOWN_SCENES } from './topdown';

// Mutations operate on copies of shipped JSON, not a second scene validator.
interface Payload {
  ground: Record<string, unknown>[];
  scenery: Record<string, unknown>[];
  [key: string]: unknown;
}

const shipped = [...TOPDOWN_SCENES].map(([id, source]) => ({ id, url: source.url }));

function readScene(url: string): Payload {
  return JSON.parse(readFileSync(`public/${url}`, 'utf8')) as Payload;
}

function first(items: Record<string, unknown>[]): Record<string, unknown> {
  const item = items[0];
  if (!item) throw new Error('Missing shipped scene entry');
  return item;
}

function load(payload: Payload, url: string) {
  return loadTopDownPresentations(() => Promise.resolve(payload), new Map([['fixture', { url }]]));
}

async function rejectsAt(payload: Payload, url: string, path: string): Promise<void> {
  const before = structuredClone(payload);
  const result: unknown = await load(payload, url).catch((error: unknown) => error);
  expect(result, `Loader accepted malformed ${url} at ${path}`).toBeInstanceOf(Error);
  if (!(result instanceof Error)) throw new Error('Malformed scene reached presentations');
  expect(result.message).toContain(url);
  expect(result.message).toContain(`${path}:`);
  expect(payload).toStrictEqual(before);
}

describe('fetched top-down scene validation', () => {
  it.each(shipped)(
    'preserves every shipped field of $id, whose ground crop is optional',
    async ({ url }) => {
      const payload = readScene(url);
      const before = structuredClone(payload);
      expect(first(payload.ground).sourceRect).toBeUndefined();
      expect(payload.scenery.length).toBeGreaterThan(0);
      expect(payload.scenery.every((piece) => piece.sourceRect !== undefined)).toBe(true);
      const result = await load(payload, url);
      expect(result.get('fixture')?.scene).toStrictEqual(payload);
      expect(payload).toStrictEqual(before);
    },
  );

  for (const source of shipped) {
    it(`${source.id}: rejects a missing atlas crop at its exact path`, async () => {
      const payload = readScene(source.url);
      delete first(payload.scenery).sourceRect;
      await rejectsAt(payload, source.url, 'scenery.0.sourceRect');
    });

    it(`${source.id}: rejects the wrong sibling atlas URL at its exact path`, async () => {
      const payload = readScene(source.url);
      first(payload.scenery).url = source.url.replace('scene.json', 'wrong-atlas.webp');
      await rejectsAt(payload, source.url, 'scenery.0.url');
    });

    it(`${source.id}: rejects a negative display size at its exact path`, async () => {
      const payload = readScene(source.url);
      first(payload.scenery).width = -1;
      await rejectsAt(payload, source.url, 'scenery.0.width');
    });
  }

  it.each([0, Infinity, -Infinity, NaN])(
    'rejects invalid ground size %s without changing the payload',
    async (value) => {
      const url = 'art/topdown/ba-dan/scene.json';
      const payload = readScene(url);
      first(payload.ground).height = value;
      await rejectsAt(payload, url, 'ground.0.height');
    },
  );

  it.each([-1, 0.5])(
    'rejects non-integer or negative crop origin %s at its exact path',
    async (value) => {
      const url = 'art/topdown/ba-dan/scene.json';
      const payload = readScene(url);
      const crop = first(payload.scenery).sourceRect as Record<string, unknown>;
      crop.x = value;
      await rejectsAt(payload, url, 'scenery.0.sourceRect.x');
    },
  );

  it('uses the supplied scene location for valid custom sibling image URLs', async () => {
    const payload = readScene('art/topdown/ba-dan/scene.json');
    const url = 'art/topdown/custom-board/scene.json';
    for (const plate of payload.ground) plate.url = 'art/topdown/custom-board/ground.webp';
    for (const piece of payload.scenery) piece.url = 'art/topdown/custom-board/uprights.webp';
    expect((await load(payload, url)).get('fixture')?.scene).toStrictEqual(payload);
  });

  it('preserves supported optional scene/image fields and legitimate negative world coordinates', async () => {
    const url = 'art/topdown/ba-dan/scene.json';
    const payload = readScene(url);
    const extras: Partial<MapScene> = {
      marginTone: 'quarry',
      groundMode: 'partial',
      paintedWaterCells: [{ x: 1, y: 2 }],
      paintedRubble: [{ x: 3, y: 4 }],
      chimneys: [{ x: -2.5, y: -3.25 }],
      ambienceSources: { steam: [{ x: -1, y: 2 }], lanterns: [{ x: 3, y: -4 }] },
      actorGrounding: {
        cast: 0.2,
        contact: 0.5,
        castKey: { x: -1, y: 1 },
        ink: { r: 50, g: 33, b: 37 },
      },
      flock: { url: 'art/topdown/ba-dan/birds.webp', frames: 3, frameSize: 16, size: 16, count: 2 },
    };
    Object.assign(payload, extras);
    Object.assign(first(payload.ground), {
      sourceRect: { x: 0, y: 0, width: 16, height: 16 },
      feather: { left: 0.1, right: 0.2 },
      wind: true,
    });
    Object.assign(first(payload.scenery), {
      x: -100,
      y: -50,
      depth: { x: -2.5, y: -1.25 },
      footprint: [{ x: -2, y: -1 }],
      exterior: true,
      wall: true,
      fadeGroup: 'fixture.group',
      flip: true,
      castFrom: 'base',
      castShadow: 'reduced',
      feather: { left: 0.1, right: 0.2 },
      wind: true,
    });
    const before = structuredClone(payload);
    expect((await load(payload, url)).get('fixture')?.scene).toStrictEqual(payload);
    expect(payload).toStrictEqual(before);
  });

  it('drops the retired oblique `reliefLift` from a scene that still carries it (ADR 0104 T7)', async () => {
    const url = 'art/topdown/ba-dan/scene.json';
    const payload = readScene(url);
    const expected = structuredClone(payload);
    Object.assign(payload, { reliefLift: [0, 0.25] });
    const scene = (await load(payload, url)).get('fixture')?.scene;
    expect(scene).toStrictEqual(expected);
    expect(scene && 'reliefLift' in scene).toBe(false);
  });
});
