import { expect, it } from 'vitest';
import { SURFACE_STYLES, TERRAIN_STYLES } from './palettes';
import { SURFACE_RIM } from './surfaceRendering';

const rgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];
const warmth = ([r, , b]: readonly number[]): number => r! - b!;

/** DL-2 W1 keyed the procedural `sand` fallback to the §3 quarry spoil row. */
const SPOIL = [TERRAIN_STYLES.sand.fill, TERRAIN_STYLES.sand.edge, TERRAIN_STYLES.sand.detail];

it('keys the live rubble wash to the ground contract quarry spoil', () => {
  const rubble = SURFACE_STYLES.rubble;
  for (const tone of [rubble.fill, rubble.edge, rubble.detail]) expect(SPOIL).toContain(tone);
  // Partial scenes keep the live overlay over painted heaps, so the wash stays
  // a translucent coat that marks the hazard rather than hiding the art.
  expect(rubble.alpha).toBeGreaterThan(0);
  expect(rubble.alpha).toBeLessThan(0.5);
});

it('does not grey a spoil heap under the rubble wash', () => {
  const rubble = SURFACE_STYLES.rubble;
  // The strongest the wash gets: its base coat under its firmer interior.
  const cover =
    1 - (1 - rubble.alpha * SURFACE_RIM.coat.base) * (1 - rubble.alpha * SURFACE_RIM.coat.interior);
  const wash = rgb(rubble.fill);
  const floor = Math.min(...SPOIL.map((tone) => warmth(rgb(tone))));
  for (const tone of SPOIL) {
    const washed = rgb(tone).map((channel, i) => channel + (wash[i]! - channel) * cover);
    // A heap painted in spoil keeps the spoil family's warmth under the wash: a
    // cool grey coat pulls red toward blue and the heap reads as grey stone.
    expect(warmth(washed), `${tone} under the wash`).toBeGreaterThanOrEqual(floor);
  }
});
