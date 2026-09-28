import { expect, it } from 'vitest';
import { CONTENT } from '../content';
import { LEGEND } from '../content/maps/legend';
import { SURFACE_BY_ID } from '../content/surfaces';
import {
  HP_CAP,
  HP_COLORS,
  HP_THRESHOLDS,
  NEUTRAL_PALETTE,
  SURFACE_STYLES,
  TERRAIN_STYLES,
  hpFill,
} from './palettes';
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

it('fills an enemy bar hostile red at any health, and never a friendly one', () => {
  for (const hatch of [false, true]) {
    const tints = hatch ? HP_COLORS.hatchTints : HP_COLORS.tints;
    for (const fraction of [1, 0.61, 0.6, 0.31, 0.3, 0.01, 0]) {
      expect(hpFill('enemy', fraction, hatch)).toBe(tints.hostile);
      expect(hpFill('party', fraction, hatch)).not.toBe(tints.hostile);
      expect(hpFill('ally', fraction, hatch)).not.toBe(tints.hostile);
    }
  }
});

it('turns a friendly bar mid, then low, at the thresholds', () => {
  for (const hatch of [false, true]) {
    const tints = hatch ? HP_COLORS.hatchTints : HP_COLORS.tints;
    for (const faction of ['party', 'ally'] as const) {
      expect(hpFill(faction, 1, hatch)).toBe(tints[faction]);
      expect(hpFill(faction, HP_THRESHOLDS.mid + 0.01, hatch)).toBe(tints[faction]);
      expect(hpFill(faction, HP_THRESHOLDS.mid, hatch)).toBe(tints.mid);
      expect(hpFill(faction, HP_THRESHOLDS.low + 0.01, hatch)).toBe(tints.mid);
      expect(hpFill(faction, HP_THRESHOLDS.low, hatch)).toBe(tints.low);
      expect(hpFill(faction, 0, hatch)).toBe(tints.low);
    }
  }
});

it('keeps every bar tint distinct, in both palettes', () => {
  for (const tints of [HP_COLORS.tints, HP_COLORS.hatchTints]) {
    const values = Object.values(tints);
    expect(new Set(values).size).toBe(values.length);
  }
  // The party's low bar is warm, but nowhere near the hostile red.
  const [lr, lg] = rgb(HP_COLORS.tints.low);
  const [, hg] = rgb(HP_COLORS.tints.hostile);
  expect(lr).toBeGreaterThan(lg);
  expect(lg - hg).toBeGreaterThan(40);
});

it('marks each side with its own cap shape, not colour alone', () => {
  expect(HP_CAP.party).toBe('none');
  expect(new Set(Object.values(HP_CAP)).size).toBe(3);
});

/*
 * Colour-vision deficiency, simulated with Machado, Oliveira & Fernandes (2009)
 * at full severity: the matrix acts on linear sRGB, and the result is compared
 * in CIELAB (D65) by ΔE76.
 */
type Mat3 = readonly [Rgb, Rgb, Rgb];
const CVD: Record<'protan' | 'deutan' | 'tritan', Mat3> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
const linear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const simulate = (hex: string, m: Mat3): Rgb => {
  const [r8, g8, b8] = rgb(hex);
  const [r, g, b] = [linear(r8), linear(g8), linear(b8)];
  const row = ([x, y, z]: Rgb) => Math.min(1, Math.max(0, x * r + y * g + z * b));
  return [row(m[0]), row(m[1]), row(m[2])];
};
const lab = ([r, g, b]: Rgb): Rgb => {
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const cvdDelta = (a: string, b: string, m: Mat3): number => {
  const [l1, a1, b1] = lab(simulate(a, m));
  const [l2, a2, b2] = lab(simulate(b, m));
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};
type Tint = keyof typeof HP_COLORS.tints;
const pairs = (keys: readonly Tint[]): [Tint, Tint][] =>
  keys.flatMap((a, i) => keys.slice(i + 1).map((b): [Tint, Tint] => [a, b]));

it('keeps every colourblind bar tint apart under simulated CVD', () => {
  const tints = HP_COLORS.hatchTints;
  for (const [kind, m] of Object.entries(CVD))
    for (const [a, b] of pairs(['party', 'ally', 'mid', 'low', 'hostile'])) {
      expect(cvdDelta(tints[a], tints[b], m), `${kind} ${a}/${b}`).toBeGreaterThanOrEqual(15);
    }
});

it('keeps hostile clear of every friendly tint under simulated CVD, in both sets', () => {
  for (const tints of [HP_COLORS.tints, HP_COLORS.hatchTints])
    for (const [kind, m] of Object.entries(CVD))
      for (const friend of ['party', 'ally', 'mid', 'low'] as const) {
        const delta = cvdDelta(tints[friend], tints.hostile, m);
        expect(delta, `${kind} ${friend}/hostile`).toBeGreaterThanOrEqual(20);
      }
});

it('leans on the cap and fill length where the default set merges', () => {
  // palettes.ts owns up to these two; if a retint fixes them, drop the caveat.
  const { tints } = HP_COLORS;
  expect(cvdDelta(tints.mid, tints.low, CVD.deutan)).toBeLessThan(15);
  expect(cvdDelta(tints.party, tints.ally, CVD.tritan)).toBeLessThan(15);
  expect(HP_CAP.party).not.toBe(HP_CAP.ally);
});
