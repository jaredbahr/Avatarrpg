import { expect, it, vi } from 'vitest';
import { FOREST_ROADSIDE_PROPS, ROADSIDE_ART_SIZE } from '../../src/content/scenes/forestRoad';
import { ROADSIDE_ART, packRoadside } from './forest-roadside-props';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/**
 * The packer's sprites are the pre-G1 art: since ADR 0086 they are the input the
 * G1 dressing was redrawn from, at the registered sizes, and no longer ship.
 * `forest-g1-pack.test.ts` holds what does.
 */
it('packs eight reproducible alpha-trimmed roadside sprites at the registered sizes', () => {
  expect([...ROADSIDE_ART].sort()).toEqual(Object.keys(ROADSIDE_ART_SIZE).sort());
  for (const name of ROADSIDE_ART) {
    const { image } = packRoadside(name);
    expect({ width: image.width, height: image.height }, name).toEqual(ROADSIDE_ART_SIZE[name]);
  }
});

it('places every sprite at least once', () => {
  expect(new Set(FOREST_ROADSIDE_PROPS.map(({ art }) => art))).toEqual(new Set(ROADSIDE_ART));
});
