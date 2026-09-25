import { expect, it } from 'vitest';
import { CONTENT } from '../content';
import { LEGEND } from '../content/maps/legend';
import { SURFACE_BY_ID } from '../content/surfaces';
import { NEUTRAL_PALETTE, SURFACE_STYLES, TERRAIN_STYLES } from './palettes';
import { SURFACE_BANK, SURFACE_RIM } from './surfaceRendering';

type Rgb = readonly [number, number, number];
const rgb = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];
const warmth = ([r, , b]: Rgb): number => r - b;
const luma = ([r, g, b]: Rgb): number => 0.299 * r + 0.587 * g + 0.114 * b;
const over = (under: Rgb, top: Rgb, alpha: number): Rgb => [
  under[0] + (top[0] - under[0]) * alpha,
  under[1] + (top[1] - under[1]) * alpha,
  under[2] + (top[2] - under[2]) * alpha,
];

/** DL-2 W1 keyed the procedural `sand` fallback to the §3 quarry spoil row. */
const SPOIL = [TERRAIN_STYLES.sand.fill, TERRAIN_STYLES.sand.edge, TERRAIN_STYLES.sand.detail];
/** The bible's one outline colour. */
const INK = NEUTRAL_PALETTE.ink;
/** The §3 grounds a live rubble patch can land on. */
const GROUNDS = {
  spoil: '#c7a87d',
  'packed earth': '#b39064',
  limestone: '#d8cbb0',
  grass: '#6f9e4c',
} as const;

it('keys the live rubble wash to the ground contract quarry spoil and the ink', () => {
  expect(SPOIL).toEqual(['#c7a87d', '#8e7049', '#d8cbb0']);

  const rubble = SURFACE_STYLES.rubble;
  expect(SPOIL).toContain(rubble.fill);
  expect(SPOIL).toContain(rubble.detail);
  expect([...SPOIL, INK]).toContain(rubble.edge);
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
  const floor = Math.min(...SPOIL.map((tone) => warmth(rgb(tone))));
  for (const tone of SPOIL) {
    // A heap painted in spoil keeps the spoil family's warmth under the wash: a
    // cool grey coat pulls red toward blue and the heap reads as grey stone.
    const washed = over(rgb(tone), rgb(rubble.fill), cover);
    expect(warmth(washed), `${tone} under the wash`).toBeGreaterThanOrEqual(floor);
  }
});

it('rings live rubble with a bank every ground shows at default settings', () => {
  /*
   * Rubble costs movement and grants cover, and rubble an ability leaves has no
   * heap art: with hatch and high contrast off by default the wash is its only
   * cue, and the bank line is what separates the patch from the ground round
   * it. Measured at the line's own strength over each ground it can land on.
   */
  const edge = rgb(SURFACE_STYLES.rubble.edge);
  for (const [name, hex] of Object.entries(GROUNDS)) {
    const ground = rgb(hex);
    const line = over(ground, edge, SURFACE_BANK.alpha);
    expect(Math.abs(luma(line) - luma(ground)), `bank over ${name}`).toBeGreaterThanOrEqual(30);
  }
});

it('lays every rubble cell on the ground contract spoil, not limestone paving', () => {
  /*
   * A partial scene draws the grid's terrain first and the painted heap over
   * it, and the heap's earth bed does not fill the cell's diamond. Under `stone`
   * that margin read as a pale limestone slab (`#d8cbb0`) round every forest
   * heap on Canvas; rubble lies on spoil, which W1 keyed `sand` to.
   */
  const rubble = LEGEND.r;
  expect(rubble?.surface).toBe('rubble');
  expect(rubble?.terrain).toBe('sand');
  expect(TERRAIN_STYLES.sand.fill).toBe(GROUNDS.spoil);
  // Terrain carries no rule, and neither does the tile: cover comes from the
  // live rubble surface, so water that turns the heap to mud takes it away.
  expect(rubble).toMatchObject({ surfaceDuration: -1 });
  expect(rubble?.cover ?? false).toBe(false);
  expect(SURFACE_BY_ID.get('rubble')?.grantsCover).toBe(true);
  expect(rubble?.blocked ?? false).toBe(false);
  expect(rubble?.elevation ?? 0).toBe(0);

  let cells = 0;
  for (const map of CONTENT.maps.values())
    for (const row of map.rows)
      for (const key of row) {
        if (map.legend[key]?.surface !== 'rubble') continue;
        cells++;
        expect(map.legend[key]?.terrain, `${map.id} rubble '${key}'`).toBe('sand');
      }
  expect(cells).toBeGreaterThan(0);
});
