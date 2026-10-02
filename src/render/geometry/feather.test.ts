import { describe, expect, it } from 'vitest';
import type { SceneScenery } from '../../core/types';
import { featherAlpha } from './feather';

const piece = (feather: SceneScenery['feather'], flip = false): SceneScenery => ({
  id: 'slice',
  url: 'page.webp',
  x: 0,
  y: 0,
  width: 128,
  height: 64,
  footprint: [{ x: -1, y: 0 }],
  depth: { x: -1, y: 0 },
  exterior: true,
  feather,
  flip,
});

function expectMonotonic(values: readonly number[]): void {
  for (let index = 1; index < values.length; index++)
    expect(values[index]).toBeGreaterThanOrEqual(values[index - 1] ?? 0);
}

describe('horizontal scene-image feather', () => {
  it.each(['left', 'right'] as const)('ramps monotonically from exact 0 to 1 on the %s', (side) => {
    const feather = 28;
    const image = piece({ [side]: feather });
    const values = Array.from({ length: feather + 1 }, (_, x) =>
      featherAlpha(image, side === 'left' ? x : 127 - x, 128),
    );
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(1);
    expectMonotonic(values);
  });

  it('combines independent left and right ramps', () => {
    const image = piece({ left: 28, right: 28 });
    expect(featherAlpha(image, 0, 128)).toBe(0);
    expect(featherAlpha(image, 28, 128)).toBe(1);
    expect(featherAlpha(image, 64, 128)).toBe(1);
    expect(featherAlpha(image, 99, 128)).toBe(1);
    expect(featherAlpha(image, 127, 128)).toBe(0);
  });

  it('interprets declared sides after a horizontal flip', () => {
    const image = piece({ left: 28 }, true);
    expect(featherAlpha(image, 127, 128)).toBe(0);
    expect(featherAlpha(image, 99, 128)).toBe(1);
    expect(featherAlpha(image, 0, 128)).toBe(1);
  });
});
