import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { FOREST_ROADSIDE_PROPS, ROADSIDE_ART_SIZE } from '../../src/content/scenes/forestRoad';
import { encodeWebp } from './lib/webp';
import {
  ROADSIDE_ART,
  ROADSIDE_QUALITY,
  packRoadside,
  roadsideOutput,
} from './forest-roadside-props';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

it('ships eight reproducible alpha-trimmed roadside sprites at the registered sizes', async () => {
  expect([...ROADSIDE_ART].sort()).toEqual(Object.keys(ROADSIDE_ART_SIZE).sort());
  for (const name of ROADSIDE_ART) {
    const { image } = packRoadside(name);
    expect({ width: image.width, height: image.height }, name).toEqual(ROADSIDE_ART_SIZE[name]);
    expect(Buffer.from(await encodeWebp(image, ROADSIDE_QUALITY, true)), name).toEqual(
      readFileSync(roadsideOutput(name)),
    );
  }
});

it('places every sprite at least once', () => {
  expect(new Set(FOREST_ROADSIDE_PROPS.map(({ art }) => art))).toEqual(new Set(ROADSIDE_ART));
});
