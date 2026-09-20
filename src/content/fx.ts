/**
 * Bending effects, as data.
 *
 * An ability names an effect key (`fx.fire.blast`) and this file says what
 * that looks like: which particles leave the caster's hands, what travels,
 * what lands, whether the screen shakes. The renderer turns a recipe into
 * particles and strokes; the choreography decides when each part plays. A
 * new ability, or a whole element, needs a recipe here and nothing in
 * `src/core/` (ADR 0004).
 *
 * Colours are roles, not hexes: the renderer resolves `base`, `light`,
 * `dark` and `accent` through the element's palette at draw time, so the
 * palette stays in the three places it already lives and not a fourth.
 *
 * Every number is in tiles or milliseconds, so a recipe reads the same at
 * any zoom.
 */

import { z } from 'zod';
import { FX_CELS, type FxCel } from './fxCels';
import { BENDING_CEL_CUES } from './bendingCels';

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export const FX_CELLS = [
  'disc',
  'glow',
  'ring',
  'spark',
  'shard',
  'leaf',
  'puff',
  'drop',
  'square',
] as const;
export type FxCell = (typeof FX_CELLS)[number];

/** Palette roles, plus three fixed tones no palette carries: white heat, smoke and stone. */
export const FX_COLORS = [
  'base',
  'light',
  'dark',
  'accent',
  'ink',
  'white',
  'smoke',
  'stone',
] as const;
export type FxColor = (typeof FX_COLORS)[number];

/**
 * How particles are born and move. Every shape is sampled analytically from
 * the emitter's age, so nothing is simulated frame to frame and both
 * backends get identical pictures from the same seed.
 *
 * - `burst`: from a point, every direction, slowing down.
 * - `ring`: on a circle that expands from the point.
 * - `rise`: drifting up from the point, scattered across `spread` tiles.
 * - `fall`: raining down onto the point from above.
 * - `stream`: born along the line from `from` to `to` as a head travels it.
 * - `spiral`: orbiting the point, radius growing with age.
 * - `sheet`: born across a bar perpendicular to the direction of travel and
 *   swept forward, for waves and cones.
 * - `projectile`: rides the head from `from` to `to` over the emitter's life,
 *   lobbed by the travel's arc; the thrown stone itself.
 * - `drift`: born anywhere in the rectangle from `from` to `to` and carried
 *   along the heading `spread` names, swaying; a map's ambience.
 */
export const PARTICLE_SHAPES = [
  'burst',
  'ring',
  'rise',
  'fall',
  'stream',
  'spiral',
  'sheet',
  'projectile',
  'drift',
] as const;
export type ParticleShape = (typeof PARTICLE_SHAPES)[number];

/**
 * Drawn shapes, one stroke or polygon each, with the art bible's ink edge.
 * Like particles they are born at `from`; `to` is only where they are aimed.
 *
 * - `bolt`: a jagged line from `from` to `to`, re-jittered as it flickers.
 * - `strike`: the same bolt down out of the sky onto `from`; a storm's.
 * - `ribbon`: a wavy thick line out of `from` towards `to`, for a lick of flame.
 * - `whip`: an arc from `from` that reaches `to` and snaps back.
 * - `crack`: jagged lines radiating from `from` across the ground.
 * - `slab`: rectangles rising out of the ground at `from`.
 * - `arc`: a curved band sweeping across `from` towards `to`, for gusts and waves.
 * - `gust`: tapered, open wind streaks carried from `from` to `to`.
 * - `flame`: a pointed flame silhouette carried from `from` to `to`.
 */
export const STROKE_SHAPES = [
  'bolt',
  'strike',
  'ribbon',
  'whip',
  'crack',
  'slab',
  'arc',
  'gust',
  'flame',
] as const;
export type StrokeShape = (typeof STROKE_SHAPES)[number];

const range = z.tuple([z.number(), z.number()]);

export const particleEmitterSchema = z.object({
  kind: z.literal('particles'),
  shape: z.enum(PARTICLE_SHAPES),
  cell: z.enum(FX_CELLS),
  /** Optional coloured animation cels; `cell` remains the loading/error fallback. */
  cel: z.enum(FX_CELS).optional(),
  /** How many, in total across the emitter's life. */
  count: z.number().int().min(1).max(120),
  /** The emitter's own life in ms; particles born late are cut off by it. An ambience loops for seconds. */
  duration: z.number().int().min(40).max(12000),
  /** Each particle's life in ms, drawn between the two. */
  life: range,
  /** When each particle is born, ms into the emitter's life. */
  delay: range,
  /** Tiles per second at birth. */
  speed: range,
  /** For directional shapes the cone half-angle in radians; for `rise`/`fall`/`spiral` the radius in tiles; for `drift` the heading in radians. */
  spread: z.number().min(0),
  /** Tiles per second squared, positive is down the screen. */
  gravity: z.number(),
  /** How fast a particle loses its speed: 0 keeps it, 6 stops it in a third of a second. */
  drag: z.number().min(0).max(20),
  /** Size in tiles at birth, drawn between the two. */
  size: range,
  /** Size multiplier at the end of its life. */
  grow: z.number().min(0),
  /** Radians per second, up to; sign picked per particle. */
  spin: z.number().min(0),
  color: z.enum(FX_COLORS),
  fade: z.enum(['out', 'in-out', 'none']),
  blend: z.enum(['normal', 'add']),
  layer: z.enum(['under', 'over']),
});

export const strokeEmitterSchema = z.object({
  kind: z.literal('strokes'),
  shape: z.enum(STROKE_SHAPES),
  duration: z.number().int().min(40).max(1500),
  /** How many strokes; branches for a bolt, cracks for a crack, slabs for a slab. */
  count: z.number().int().min(1).max(12),
  /** Line width in tiles. */
  width: z.number().min(0.01).max(1),
  /** Reach in tiles, where the shape is not defined by `from` and `to`. */
  reach: z.number().min(0).max(6),
  color: z.enum(FX_COLORS),
  /** Draw the ink edge under the stroke. */
  ink: z.boolean(),
  blend: z.enum(['normal', 'add']),
  layer: z.enum(['under', 'over']),
});

export const emitterSchema = z.discriminatedUnion('kind', [
  particleEmitterSchema,
  strokeEmitterSchema,
]);

export type ParticleEmitterDef = z.infer<typeof particleEmitterSchema>;
export type StrokeEmitterDef = z.infer<typeof strokeEmitterSchema>;
export type EmitterDef = z.infer<typeof emitterSchema>;

export const fxRecipeSchema = z.object({
  /** Which palette colours the roles: an element, `enemy`, or `neutral`. Default: the key's own element. */
  palette: z.string().optional(),
  /** At the caster as the ability releases. */
  cast: z.array(emitterSchema).default([]),
  /**
   * From caster to target while something is in flight; absent for an instant
   * effect. The choreography stretches a particle emitter to the real flight;
   * a stroke goes out and comes back, so it lasts twice the flight and a whip
   * reaches the target as the hit lands.
   */
  travel: z
    .object({
      emitters: z.array(emitterSchema),
      /** Tiles per second. */
      speed: z.number().min(2).max(60),
      /** Lob height in tiles at the midpoint; 0 flies straight. */
      arc: z.number().min(0).max(2).default(0),
    })
    .optional(),
  /** At the target when the effect lands. */
  impact: z.array(emitterSchema),
  /** On every affected tile, staggered outward from the target. */
  area: z.array(emitterSchema).default([]),
  /** Milliseconds the playback holds still on the hit, 0 for none. */
  hitStop: z.number().int().min(0).max(160).default(0),
  /** Screen shake in tiles, 0 for none. */
  shake: z.number().min(0).max(0.3).default(0),
  /** How hard hit units flash, 0..1. */
  flash: z.number().min(0).max(1).default(0.6),
});

export type FxRecipe = z.infer<typeof fxRecipeSchema>;
/** What content authors write: every defaulted field optional. */
export type FxRecipeInput = z.input<typeof fxRecipeSchema>;

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

type Particles = Omit<ParticleEmitterDef, 'kind'>;
type Strokes = Omit<StrokeEmitterDef, 'kind'>;

const particles = (def: Particles): ParticleEmitterDef => ({ kind: 'particles', ...def });
const strokes = (def: Strokes): StrokeEmitterDef => ({ kind: 'strokes', ...def });

const embers = (count: number, color: FxColor = 'accent'): ParticleEmitterDef =>
  particles({
    shape: 'rise',
    cell: 'glow',
    count,
    duration: 700,
    life: [400, 800],
    delay: [0, 350],
    speed: [0.6, 1.6],
    spread: 0.35,
    gravity: -0.8,
    drag: 1.5,
    size: [0.05, 0.11],
    grow: 0.3,
    spin: 0,
    color,
    fade: 'out',
    blend: 'add',
    layer: 'over',
  });

const fireBurst = (count: number): ParticleEmitterDef =>
  particles({
    shape: 'burst',
    cell: 'glow',
    count,
    duration: 420,
    life: [220, 420],
    delay: [0, 60],
    speed: [1.2, 3.2],
    spread: Math.PI,
    gravity: -1.2,
    drag: 6,
    size: [0.2, 0.36],
    grow: 1.6,
    spin: 0,
    color: 'light',
    fade: 'out',
    blend: 'add',
    layer: 'over',
  });

const fireLicks = (count: number, duration = 460): StrokeEmitterDef =>
  strokes({
    shape: 'ribbon',
    duration,
    count,
    width: 0.2,
    reach: 0.9,
    color: 'light',
    ink: true,
    blend: 'normal',
    layer: 'over',
  });

const smokePuff = (count: number, size: [number, number] = [0.14, 0.26]): ParticleEmitterDef =>
  particles({
    shape: 'rise',
    cell: 'puff',
    count,
    duration: 800,
    life: [500, 800],
    delay: [0, 200],
    speed: [0.3, 0.8],
    spread: 0.3,
    gravity: -0.4,
    drag: 2,
    size,
    grow: 2.2,
    spin: 0.8,
    color: 'smoke',
    fade: 'in-out',
    blend: 'normal',
    layer: 'over',
  });

const droplets = (count: number, color: FxColor = 'light'): ParticleEmitterDef =>
  particles({
    shape: 'burst',
    cell: 'drop',
    count,
    duration: 520,
    life: [300, 520],
    delay: [0, 80],
    speed: [1.5, 3.5],
    spread: Math.PI,
    gravity: 7,
    drag: 1,
    size: [0.06, 0.12],
    grow: 0.8,
    spin: 0,
    color,
    fade: 'out',
    blend: 'normal',
    layer: 'over',
  });

const waterSheet = (count = 36): ParticleEmitterDef =>
  particles({
    shape: 'sheet',
    cell: 'disc',
    count,
    duration: 380,
    life: [200, 360],
    delay: [0, 120],
    speed: [3, 5],
    spread: 0.45,
    gravity: 2,
    drag: 4,
    size: [0.12, 0.22],
    grow: 1.3,
    spin: 0,
    color: 'light',
    fade: 'out',
    blend: 'normal',
    layer: 'over',
  });

const iceFacets = (count: number): ParticleEmitterDef =>
  particles({
    shape: 'burst',
    cell: 'shard',
    count,
    duration: 600,
    life: [400, 600],
    delay: [0, 60],
    speed: [0.4, 1.4],
    spread: Math.PI,
    gravity: 0.6,
    drag: 4,
    size: [0.1, 0.2],
    grow: 1,
    spin: 1.5,
    color: 'accent',
    fade: 'out',
    blend: 'normal',
    layer: 'over',
  });

const shards = (count: number, color: FxColor = 'base'): ParticleEmitterDef =>
  particles({
    shape: 'burst',
    cell: 'shard',
    count,
    duration: 560,
    life: [300, 560],
    delay: [0, 40],
    speed: [2, 5],
    spread: Math.PI,
    gravity: 9,
    drag: 1.2,
    size: [0.08, 0.18],
    grow: 0.9,
    spin: 6,
    color,
    fade: 'none',
    blend: 'normal',
    layer: 'over',
  });

const dust = (count: number, size: [number, number] = [0.18, 0.3]): ParticleEmitterDef =>
  particles({
    shape: 'ring',
    cell: 'puff',
    count,
    duration: 620,
    life: [380, 620],
    delay: [0, 60],
    speed: [1.2, 2.4],
    spread: 0.2,
    gravity: -0.3,
    drag: 4,
    size,
    grow: 2,
    spin: 0.6,
    color: 'stone',
    fade: 'in-out',
    blend: 'normal',
    layer: 'under',
  });

const cracks = (count: number, reach: number): StrokeEmitterDef =>
  strokes({
    shape: 'crack',
    duration: 700,
    count,
    width: 0.05,
    reach,
    color: 'ink',
    ink: false,
    blend: 'normal',
    layer: 'under',
  });

const slabs = (count: number, reach: number, duration = 520): StrokeEmitterDef =>
  strokes({
    shape: 'slab',
    duration,
    count,
    width: 0.3,
    reach,
    color: 'base',
    ink: true,
    blend: 'normal',
    layer: 'over',
  });

const spirals = (count: number, radius = 0.5, color: FxColor = 'light'): ParticleEmitterDef =>
  particles({
    shape: 'spiral',
    cell: 'leaf',
    count,
    duration: 640,
    life: [400, 640],
    delay: [0, 160],
    speed: [4, 7],
    spread: radius,
    gravity: -0.6,
    drag: 0.5,
    size: [0.08, 0.16],
    grow: 0.7,
    spin: 8,
    color,
    fade: 'in-out',
    blend: 'normal',
    layer: 'over',
  });

const airArc = (reach: number, count = 3): StrokeEmitterDef =>
  strokes({
    shape: 'arc',
    duration: 360,
    count,
    width: 0.08,
    reach,
    color: 'white',
    ink: false,
    blend: 'add',
    layer: 'over',
  });

const bolt = (count: number, width = 0.1): StrokeEmitterDef =>
  strokes({
    shape: 'bolt',
    duration: 260,
    count,
    width,
    reach: 0,
    color: 'white',
    ink: true,
    blend: 'add',
    layer: 'over',
  });

const strike = (count: number, width = 0.08): StrokeEmitterDef =>
  strokes({
    shape: 'strike',
    duration: 240,
    count,
    width,
    reach: 0,
    color: 'white',
    ink: true,
    blend: 'add',
    layer: 'over',
  });

const whip = (width: number, color: FxColor, ink: boolean, duration = 360): StrokeEmitterDef =>
  strokes({
    shape: 'whip',
    duration,
    count: 1,
    width,
    reach: 0,
    color,
    ink,
    blend: 'normal',
    layer: 'over',
  });

/** A still bloom at the point: the element gathering at the hands, or the core of a hit. */
const glowBurst = (color: FxColor, size: number, count = 2): ParticleEmitterDef =>
  particles({
    shape: 'burst',
    cell: 'glow',
    count,
    duration: 200,
    life: [180, 260],
    delay: [0, 20],
    speed: [0, 0],
    spread: 0,
    gravity: 0,
    drag: 0,
    size: [size * 0.8, size],
    grow: 1.7,
    spin: 0,
    color,
    fade: 'out',
    blend: 'add',
    layer: 'over',
  });

/** A ring of water thrown up around the point. */
const splash = (count: number): ParticleEmitterDef =>
  particles({
    shape: 'ring',
    cell: 'disc',
    count,
    duration: 400,
    life: [240, 400],
    delay: [0, 40],
    speed: [1.6, 2.8],
    spread: 0,
    gravity: 3,
    drag: 3,
    size: [0.1, 0.2],
    grow: 1.2,
    spin: 0,
    color: 'light',
    fade: 'out',
    blend: 'normal',
    layer: 'over',
  });

const sparks = (count: number, color: FxColor = 'accent'): ParticleEmitterDef =>
  particles({
    shape: 'burst',
    cell: 'spark',
    count,
    duration: 360,
    life: [160, 340],
    delay: [0, 40],
    speed: [3, 7],
    spread: Math.PI,
    gravity: 5,
    drag: 3,
    size: [0.08, 0.16],
    grow: 0.5,
    spin: 0,
    color,
    fade: 'out',
    blend: 'add',
    layer: 'over',
  });

const flashRing = (color: FxColor = 'light', size = 0.4): ParticleEmitterDef =>
  particles({
    shape: 'burst',
    cell: 'ring',
    count: 1,
    duration: 320,
    life: [320, 320],
    delay: [0, 0],
    speed: [0, 0],
    spread: 0,
    gravity: 0,
    drag: 0,
    size: [size, size],
    grow: 2.6,
    spin: 0,
    color,
    fade: 'out',
    blend: 'add',
    layer: 'over',
  });

const healMotes = (count: number): ParticleEmitterDef =>
  particles({
    shape: 'rise',
    cell: 'glow',
    count,
    duration: 800,
    life: [500, 800],
    delay: [0, 300],
    speed: [0.5, 1.1],
    spread: 0.35,
    gravity: -0.5,
    drag: 1,
    size: [0.06, 0.12],
    grow: 0.5,
    spin: 0,
    color: 'accent',
    fade: 'in-out',
    blend: 'add',
    layer: 'over',
  });

/** Shed along the flight as the head passes: a tail. Authored for a nominal 300 ms flight. */
const trail = (
  cell: FxCell,
  count: number,
  color: FxColor,
  blend: 'normal' | 'add',
  size: [number, number] = [0.14, 0.28],
): ParticleEmitterDef =>
  particles({
    shape: 'stream',
    cell,
    count,
    duration: 300,
    life: [160, 320],
    delay: [0, 300],
    speed: [0.1, 0.5],
    spread: Math.PI,
    gravity: 0,
    drag: 3,
    size,
    grow: 0.4,
    spin: 3,
    color,
    fade: 'out',
    blend,
    layer: 'over',
  });

/** The thing in flight: `count` cells stacked on the head, sizes drawn between the two. */
const head = (
  cell: FxCell,
  count: number,
  size: [number, number],
  color: FxColor,
  blend: 'normal' | 'add',
  spin = 0,
): ParticleEmitterDef =>
  particles({
    shape: 'projectile',
    cell,
    count,
    duration: 300,
    life: [300, 300],
    delay: [0, 0],
    speed: [0, 0],
    spread: 0,
    gravity: 0,
    drag: 0,
    size,
    grow: 1,
    spin,
    color,
    fade: 'none',
    blend,
    layer: 'over',
  });

/** One authored animation, keeping the particle clock and bounded shared atlas. */
const cel = (clip: FxCel, size: number, duration = 480, projectile = false): ParticleEmitterDef =>
  particles({
    cel: clip,
    shape: projectile ? 'projectile' : 'burst',
    cell:
      clip === 'boulder' || clip === 'earth-rise'
        ? 'square'
        : clip === 'ice' || clip === 'metal'
          ? 'shard'
          : clip === 'wind' || clip === 'cyclone' || clip === 'cushion' || clip === 'healing'
            ? 'ring'
            : 'spark',
    count: 1,
    duration,
    life: [duration, duration],
    delay: [0, 0],
    speed: [0, 0],
    spread: 0,
    gravity: 0,
    drag: 0,
    size: [size, size],
    grow: 1,
    spin: 0,
    color: clip === 'boulder' || clip === 'earth-rise' || clip === 'metal' ? 'stone' : 'light',
    fade: 'none',
    blend: 'normal',
    layer: 'over',
  });

/** A short carried-water draw; choreography opts in only where gear is visible. */
export const WATERSKIN_DRAW: ParticleEmitterDef = particles({
  shape: 'projectile',
  cell: 'drop',
  count: 1,
  duration: 156,
  life: [156, 156],
  delay: [0, 0],
  speed: [0, 0],
  spread: 0,
  gravity: 0,
  drag: 0,
  size: [0.12, 0.12],
  grow: 1,
  spin: 0,
  color: 'base',
  fade: 'none',
  blend: 'normal',
  layer: 'over',
});

/** Faceted, tumbling stone in the same colours as its ground eruption. */
const stone = (): ParticleEmitterDef => cel('boulder', 0.85, 300, true);

/** Nested flame silhouettes keep the flame's point and direction legible. */
const fireball = (): StrokeEmitterDef[] =>
  (
    [
      ['base', 0.2],
      ['light', 0.12],
      ['accent', 0.045],
    ] as const
  ).map(([color, width]) =>
    strokes({
      shape: 'flame',
      duration: 300,
      count: 1,
      width,
      reach: 0.9,
      color,
      ink: false,
      blend: 'normal',
      layer: 'over',
    }),
  );

/** Air reads as flowing streaks, with the scene visible between them. */
const gust = (): StrokeEmitterDef[] => [
  strokes({
    shape: 'gust',
    duration: 300,
    count: 3,
    width: 0.035,
    reach: 1.1,
    color: 'white',
    ink: false,
    blend: 'normal',
    layer: 'over',
  }),
];

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

/**
 * One recipe per element and per event family. An fx key falls back to the
 * family named by its middle segment (`fx.fire.*` -> fire), so an ability
 * with no recipe of its own still bends the right element.
 */
export const FX_FAMILIES: Readonly<Record<string, FxRecipeInput>> = {
  fire: {
    cast: [glowBurst('light', 0.5), fireLicks(2, 300), embers(6)],
    travel: {
      emitters: [...fireball(), trail('spark', 8, 'light', 'normal', [0.06, 0.12])],
      speed: 22,
    },
    impact: [glowBurst('accent', 0.9), fireBurst(14), fireLicks(4), embers(10), smokePuff(3)],
    shake: 0.04,
    hitStop: 40,
  },
  water: {
    cast: [glowBurst('accent', 0.4), droplets(6)],
    travel: {
      emitters: [
        whip(0.17, 'base', false),
        whip(0.055, 'accent', false),
        trail('drop', 8, 'light', 'normal', [0.06, 0.12]),
      ],
      speed: 15,
    },
    impact: [glowBurst('accent', 0.5), splash(12), droplets(14), flashRing('light', 0.3)],
    shake: 0.03,
    hitStop: 40,
  },
  ice: {
    cast: [iceFacets(4)],
    impact: [iceFacets(14), flashRing('accent', 0.35), droplets(4, 'accent')],
    hitStop: 50,
  },
  earth: {
    cast: [dust(8, [0.14, 0.24]), shards(4, 'stone')],
    travel: {
      emitters: [stone(), trail('puff', 8, 'smoke', 'normal', [0.1, 0.18])],
      speed: 14,
      arc: 0.6,
    },
    impact: [
      shards(12, 'stone'),
      dust(10, [0.22, 0.36]),
      cracks(4, 0.7),
      flashRing('accent', 0.25),
    ],
    shake: 0.09,
    hitStop: 70,
  },
  air: {
    cast: [airArc(0.3, 1)],
    travel: { emitters: [...gust(), trail('leaf', 3, 'light', 'normal', [0.04, 0.08])], speed: 20 },
    impact: [airArc(0.7, 2), dust(4, [0.1, 0.16])],
    shake: 0.02,
    hitStop: 20,
  },
  lightning: {
    cast: [glowBurst('white', 0.45), sparks(6, 'white')],
    travel: { emitters: [bolt(3)], speed: 40 },
    impact: [glowBurst('white', 0.8), bolt(2, 0.08), sparks(18, 'white'), flashRing('white', 0.4)],
    shake: 0.06,
    hitStop: 90,
    flash: 1,
  },
  non: {
    palette: 'nonbender',
    impact: [sparks(6, 'light'), dust(4, [0.1, 0.16]), flashRing('light', 0.2)],
    hitStop: 40,
  },
  enemy: {
    palette: 'enemy',
    impact: [sparks(5, 'light'), dust(5, [0.1, 0.18])],
    shake: 0.03,
    hitStop: 40,
  },
  heal: {
    impact: [healMotes(16), flashRing('accent', 0.3)],
    flash: 0,
  },
  shield: {
    impact: [flashRing('light', 0.35), spirals(6, 0.4, 'accent')],
    flash: 0,
  },
  ko: {
    palette: 'neutral',
    impact: [dust(8, [0.16, 0.26])],
    flash: 0,
  },
  status: {
    palette: 'neutral',
    impact: [flashRing('light', 0.2)],
    flash: 0,
  },
  surface: {
    palette: 'neutral',
    impact: [dust(5, [0.1, 0.18])],
    flash: 0,
  },
  prop: {
    palette: 'neutral',
    impact: [shards(10, 'dark'), dust(6)],
    shake: 0.04,
    flash: 0,
  },
};

/* ------------------------------------------------------------------ */
/* Named recipes                                                       */
/* ------------------------------------------------------------------ */

/** Recipes for keys that need more than their family gives them. */
const DRAWN_RECIPES: Readonly<Record<string, FxRecipeInput>> = {
  'fx.fire.jab': {
    cast: [glowBurst('light', 0.4), fireLicks(1, 220)],
    travel: {
      emitters: [
        ...fireball().map((def) => ({ ...def, reach: 0.65, width: def.width * 0.8 })),
        trail('spark', 5, 'light', 'normal', [0.04, 0.09]),
      ],
      speed: 26,
    },
    impact: [glowBurst('accent', 0.6), fireBurst(8), fireLicks(2), embers(6)],
    shake: 0.02,
    hitStop: 30,
  },
  'fx.fire.blast': {
    cast: [glowBurst('light', 0.55), fireLicks(3, 320), embers(8)],
    travel: {
      emitters: [...fireball(), trail('spark', 10, 'light', 'normal', [0.06, 0.12])],
      speed: 20,
    },
    impact: [glowBurst('accent', 1.1), fireBurst(24), fireLicks(6), embers(14), smokePuff(5)],
    area: [fireBurst(6), embers(4)],
    shake: 0.07,
    hitStop: 60,
  },
  'fx.fire.arc': {
    cast: [fireLicks(3, 360)],
    impact: [fireBurst(10), fireLicks(3)],
    area: [fireBurst(5), fireLicks(2), embers(3)],
    shake: 0.04,
  },
  'fx.fire.dragon': {
    cast: [fireLicks(4, 460), embers(10)],
    impact: [fireBurst(12), fireLicks(4)],
    area: [fireBurst(8), fireLicks(3), embers(5), smokePuff(2)],
    shake: 0.06,
    hitStop: 50,
  },
  'fx.fire.wall': {
    cast: [embers(6)],
    impact: [fireBurst(6)],
    area: [fireLicks(4, 700), embers(8), smokePuff(2)],
    flash: 0,
  },
  'fx.fire.step': {
    cast: [fireBurst(8), embers(8)],
    impact: [fireBurst(6), embers(6)],
    flash: 0,
  },
  'fx.fire.shield': { impact: [flashRing('light', 0.35), embers(10)], flash: 0 },
  'fx.fire.lightning': {
    palette: 'fire',
    cast: [glowBurst('white', 0.5), sparks(8, 'white')],
    travel: { emitters: [bolt(3, 0.12)], speed: 40 },
    impact: [glowBurst('white', 0.9), bolt(2, 0.08), sparks(22, 'white'), flashRing('white', 0.45)],
    shake: 0.07,
    hitStop: 100,
    flash: 1,
  },
  'fx.fire.chain': {
    palette: 'fire',
    cast: [glowBurst('white', 0.45), sparks(6, 'white')],
    travel: { emitters: [bolt(2, 0.09)], speed: 40 },
    impact: [glowBurst('white', 0.7), sparks(12, 'white')],
    area: [bolt(1, 0.07), sparks(8, 'white'), flashRing('white', 0.25)],
    shake: 0.05,
    hitStop: 80,
    flash: 1,
  },
  'fx.fire.storm': {
    palette: 'fire',
    cast: [glowBurst('white', 0.5), sparks(10, 'white')],
    impact: [
      glowBurst('white', 1.1),
      strike(3, 0.12),
      sparks(20, 'white'),
      flashRing('white', 0.5),
    ],
    area: [strike(1, 0.08), sparks(8, 'white')],
    shake: 0.1,
    hitStop: 110,
    flash: 1,
  },

  'fx.water.whip': FX_FAMILIES.water ?? { impact: [] },
  'fx.water.pull': {
    cast: [glowBurst('accent', 0.4)],
    travel: { emitters: [whip(0.18, 'base', true), whip(0.07, 'accent', false)], speed: 15 },
    impact: [splash(8), droplets(10)],
    hitStop: 40,
  },
  'fx.water.wave': {
    cast: [droplets(8)],
    impact: [waterSheet(), droplets(8)],
    area: [waterSheet(14), droplets(4)],
    shake: 0.05,
  },
  'fx.water.spikes': {
    cast: [iceFacets(6)],
    impact: [iceFacets(12), slabs(3, 0.5), flashRing('accent', 0.3)],
    area: [iceFacets(6), slabs(2, 0.4)],
    hitStop: 60,
  },
  'fx.water.path': {
    impact: [iceFacets(6)],
    area: [iceFacets(4), flashRing('accent', 0.2)],
    flash: 0,
  },
  'fx.water.shield': { impact: [flashRing('accent', 0.35), iceFacets(8)], flash: 0 },
  'fx.water.octopus': {
    impact: [droplets(10)],
    area: [whip(0.14, 'base', true, 380), droplets(5)],
    hitStop: 40,
  },
  'fx.water.heal': {
    impact: [healMotes(14), droplets(4, 'accent'), flashRing('accent', 0.3)],
    flash: 0,
  },
  'fx.water.hands': { impact: [healMotes(18), flashRing('accent', 0.32)], flash: 0 },
  'fx.water.mist': {
    impact: [healMotes(8), smokePuff(4, [0.2, 0.34])],
    area: [healMotes(4), smokePuff(2, [0.16, 0.3])],
    flash: 0,
  },
  'fx.water.tide': {
    impact: [waterSheet(), healMotes(10)],
    area: [droplets(4, 'accent'), healMotes(4)],
    flash: 0,
  },

  'fx.earth.rock': FX_FAMILIES.earth ?? { impact: [] },
  'fx.earth.boulder': {
    cast: [dust(10, [0.16, 0.28]), shards(6, 'stone')],
    travel: {
      emitters: [
        head('square', 3, [0.4, 0.7], 'stone', 'normal', 3),
        trail('puff', 10, 'smoke', 'normal', [0.12, 0.22]),
      ],
      speed: 12,
      arc: 0.9,
    },
    impact: [shards(16, 'stone'), dust(14, [0.24, 0.4]), cracks(6, 0.9), flashRing('accent', 0.3)],
    area: [shards(6, 'stone'), dust(6)],
    shake: 0.14,
    hitStop: 90,
  },
  'fx.earth.wall': {
    cast: [dust(6)],
    impact: [slabs(2, 0.6), dust(6)],
    area: [slabs(2, 0.6), dust(5), cracks(2, 0.4)],
    flash: 0,
  },
  'fx.earth.rubble': { impact: [slabs(3, 0.4), shards(8, 'dark'), dust(8)], flash: 0 },
  'fx.earth.shockwave': {
    cast: [dust(8)],
    impact: [cracks(6, 1), dust(12), flashRing('accent', 0.4)],
    area: [cracks(2, 0.5), dust(5), shards(4)],
    shake: 0.12,
    hitStop: 70,
  },
  'fx.earth.fissure': {
    cast: [dust(6)],
    impact: [cracks(5, 1), shards(8)],
    area: [cracks(3, 0.6), dust(4), shards(3)],
    shake: 0.1,
    hitStop: 60,
  },
  'fx.earth.mudslide': {
    cast: [dust(6)],
    impact: [droplets(8, 'dark'), dust(8)],
    area: [droplets(5, 'dark'), dust(4)],
    shake: 0.06,
  },
  'fx.earth.sense': { impact: [flashRing('accent', 0.4), cracks(4, 0.6)], flash: 0 },
  'fx.earth.stance': { impact: [slabs(2, 0.35), dust(6), flashRing('accent', 0.3)], flash: 0 },
  'fx.earth.armor': {
    impact: [slabs(3, 0.4), sparks(6, 'accent'), flashRing('accent', 0.35)],
    flash: 0,
  },
  'fx.earth.metal': {
    cast: [sparks(6, 'accent')],
    travel: {
      emitters: [
        head('shard', 2, [0.26, 0.44], 'stone', 'normal'),
        trail('spark', 6, 'accent', 'add'),
      ],
      speed: 24,
    },
    impact: [sparks(14, 'accent'), shards(8, 'stone'), flashRing('accent', 0.3)],
    shake: 0.06,
    hitStop: 60,
  },
  'fx.earth.cable': {
    travel: { emitters: [whip(0.1, 'dark', true)], speed: 24 },
    impact: [sparks(8, 'accent')],
    hitStop: 50,
  },

  'fx.air.blast': {
    cast: [airArc(0.3, 1)],
    travel: { emitters: [...gust(), trail('leaf', 3, 'light', 'normal', [0.04, 0.08])], speed: 20 },
    impact: [airArc(0.7, 2), dust(4, [0.1, 0.16])],
    shake: 0.03,
    hitStop: 30,
  },
  'fx.air.gust': {
    cast: [spirals(6, 0.3)],
    impact: [airArc(0.9, 4)],
    area: [airArc(0.6, 2), spirals(5, 0.4), dust(3, [0.1, 0.16])],
    shake: 0.03,
  },
  'fx.air.cyclone': {
    cast: [spirals(8, 0.4)],
    impact: [spirals(18, 0.9), airArc(0.8, 4)],
    area: [spirals(6, 0.5), dust(3, [0.1, 0.16])],
    shake: 0.04,
  },
  'fx.air.tornado': {
    cast: [spirals(10, 0.4)],
    impact: [spirals(24, 1.2), airArc(1, 5), dust(6)],
    area: [spirals(6, 0.6), airArc(0.5, 2)],
    shake: 0.06,
    hitStop: 40,
  },
  'fx.air.scooter': {
    cast: [spirals(10, 0.4), dust(4, [0.1, 0.16])],
    impact: [spirals(8, 0.4)],
    flash: 0,
  },
  'fx.air.cushion': { impact: [spirals(10, 0.4, 'accent'), flashRing('white', 0.35)], flash: 0 },
  'fx.air.shield': { impact: [spirals(12, 0.45, 'accent'), flashRing('white', 0.4)], flash: 0 },
  'fx.air.boom': {
    cast: [airArc(0.5, 2)],
    impact: [flashRing('white', 0.5), airArc(1, 5), sparks(8, 'white')],
    shake: 0.08,
    hitStop: 60,
  },
  'fx.air.shout': {
    cast: [airArc(0.5, 2)],
    impact: [airArc(0.8, 3)],
    area: [airArc(0.5, 2), flashRing('white', 0.25)],
    shake: 0.05,
  },
  'fx.air.shatter': {
    impact: [flashRing('white', 0.5), sparks(14, 'white'), shards(8, 'dark')],
    area: [sparks(6, 'white'), shards(3, 'dark')],
    shake: 0.08,
    hitStop: 70,
  },

  'fx.non.smoke': {
    palette: 'nonbender',
    impact: [smokePuff(8, [0.24, 0.4])],
    area: [smokePuff(4, [0.2, 0.34])],
    flash: 0,
  },
  'fx.non.bolas': {
    palette: 'nonbender',
    travel: { emitters: [stone(), sparks(3, 'light')], speed: 20, arc: 0.4 },
    impact: [sparks(6, 'light'), dust(4, [0.1, 0.16])],
    hitStop: 40,
  },
  'fx.non.glove': {
    palette: 'nonbender',
    impact: [bolt(2, 0.08), sparks(14, 'white'), flashRing('white', 0.3)],
    shake: 0.05,
    hitStop: 80,
    flash: 1,
  },
  'fx.non.mine': {
    palette: 'nonbender',
    impact: [bolt(2, 0.08), sparks(12, 'white')],
    area: [sparks(6, 'white')],
    shake: 0.06,
    hitStop: 60,
    flash: 1,
  },
  'fx.non.array': {
    palette: 'nonbender',
    impact: [bolt(3, 0.08), sparks(12, 'white')],
    area: [bolt(1, 0.06), sparks(6, 'white')],
    shake: 0.05,
    hitStop: 60,
    flash: 1,
  },
  'fx.non.rally': {
    palette: 'nonbender',
    impact: [flashRing('accent', 0.4), healMotes(8)],
    flash: 0,
  },
  'fx.non.cover': {
    palette: 'nonbender',
    impact: [flashRing('light', 0.3), dust(4, [0.1, 0.16])],
    flash: 0,
  },
  'fx.non.chi': {
    palette: 'nonbender',
    impact: [flashRing('accent', 0.3), sparks(6, 'accent')],
    hitStop: 50,
  },
  'fx.non.points': {
    palette: 'nonbender',
    impact: [flashRing('accent', 0.25), sparks(5, 'accent')],
    hitStop: 50,
  },

  'fx.enemy.sling': {
    palette: 'enemy',
    travel: { emitters: [stone(), dust(3, [0.06, 0.1])], speed: 22, arc: 0.5 },
    impact: [sparks(5, 'light'), dust(5)],
    hitStop: 40,
  },
  'fx.enemy.crossbow': {
    palette: 'enemy',
    travel: {
      emitters: [
        head('spark', 1, [0.5, 0.5], 'dark', 'normal'),
        trail('spark', 6, 'light', 'normal', [0.1, 0.18]),
      ],
      speed: 34,
    },
    impact: [sparks(6, 'light'), dust(3, [0.08, 0.14])],
    hitStop: 40,
  },
  'fx.enemy.oil': {
    palette: 'enemy',
    travel: {
      emitters: [
        { ...cel('flask', 0.3, 300, true), cell: 'drop', color: 'dark', spin: 3 },
        droplets(3, 'dark'),
      ],
      speed: 16,
      arc: 0.7,
    },
    impact: [droplets(14, 'dark'), shards(6, 'dark')],
    flash: 0,
  },
  'fx.enemy.torch': {
    palette: 'fire',
    travel: { emitters: [...fireball(), trail('glow', 12, 'light', 'add')], speed: 16, arc: 0.6 },
    impact: [fireBurst(8), embers(8)],
    flash: 0,
  },
  'fx.enemy.rush': { palette: 'enemy', cast: [dust(6)], impact: [dust(6)], flash: 0 },
  'fx.enemy.slam': {
    palette: 'enemy',
    impact: [cracks(5, 0.9), dust(14), shards(8, 'dark')],
    area: [cracks(2, 0.5), dust(5)],
    shake: 0.14,
    hitStop: 80,
  },
  'fx.enemy.spray': {
    palette: 'enemy',
    impact: [droplets(10, 'dark')],
    area: [droplets(6, 'dark'), dust(3, [0.08, 0.14])],
    shake: 0.04,
  },
  'fx.enemy.debris': {
    palette: 'enemy',
    travel: { emitters: [stone(), dust(4, [0.08, 0.14])], speed: 14, arc: 0.8 },
    impact: [shards(12, 'dark'), dust(10), cracks(3, 0.6)],
    area: [shards(4, 'dark'), dust(4)],
    shake: 0.1,
    hitStop: 60,
  },
  'fx.enemy.churn': {
    palette: 'enemy',
    impact: [droplets(10, 'dark'), dust(10)],
    area: [droplets(4, 'dark'), dust(4)],
    shake: 0.08,
  },
  'fx.enemy.order': { palette: 'neutral', impact: [flashRing('accent', 0.35)], flash: 0 },

  'fx.status.burning': { palette: 'fire', impact: [embers(8), fireLicks(2, 300)], flash: 0 },
  'fx.status.wet': { palette: 'water', impact: [droplets(8)], flash: 0 },
  'fx.status.chilled': { palette: 'water', impact: [iceFacets(6)], flash: 0 },
  'fx.status.frozen': {
    palette: 'water',
    impact: [iceFacets(12), slabs(2, 0.35), flashRing('accent', 0.3)],
    flash: 0,
  },
  'fx.status.shocked': {
    palette: 'fire',
    impact: [strike(2, 0.06), sparks(10, 'white'), glowBurst('white', 0.5, 1)],
    flash: 0.6,
  },
  'fx.status.stunned': { palette: 'neutral', impact: [spirals(6, 0.3, 'accent')], flash: 0 },
  'fx.status.slowed': { palette: 'earth', impact: [droplets(6, 'dark')], flash: 0 },
  'fx.status.blinded': { palette: 'neutral', impact: [smokePuff(6, [0.16, 0.28])], flash: 0 },
  'fx.status.rooted': { palette: 'earth', impact: [shards(6), slabs(2, 0.3)], flash: 0 },
  'fx.status.chiBlocked': {
    palette: 'nonbender',
    impact: [flashRing('accent', 0.3), sparks(6, 'accent')],
    flash: 0,
  },
  'fx.status.guarded': { palette: 'earth', impact: [flashRing('accent', 0.35)], flash: 0 },
  'fx.status.inspired': {
    palette: 'neutral',
    impact: [healMotes(8), flashRing('accent', 0.3)],
    flash: 0,
  },

  'fx.surface.fire': {
    palette: 'fire',
    impact: [fireBurst(8), fireLicks(3, 400), embers(8)],
    flash: 0,
  },
  'fx.surface.steam': { palette: 'neutral', impact: [smokePuff(8, [0.2, 0.36])], flash: 0 },
  'fx.surface.ice': {
    palette: 'water',
    impact: [iceFacets(8), flashRing('accent', 0.25)],
    flash: 0,
  },
  'fx.surface.water': {
    palette: 'water',
    impact: [droplets(10), flashRing('light', 0.2)],
    flash: 0,
  },
  'fx.surface.mud': { palette: 'earth', impact: [droplets(8, 'dark'), dust(4)], flash: 0 },
  'fx.surface.oil': { palette: 'neutral', impact: [droplets(8, 'ink')], flash: 0 },
  'fx.surface.rubble': { palette: 'earth', impact: [shards(6, 'dark'), dust(6)], flash: 0 },
  'fx.surface.doused': { palette: 'neutral', impact: [smokePuff(6, [0.18, 0.3])], flash: 0 },

  'fx.prop.water_barrel': {
    palette: 'water',
    impact: [droplets(16), shards(6, 'dark'), dust(4)],
    shake: 0.03,
    flash: 0,
  },
  'fx.prop.oil_flask': {
    palette: 'neutral',
    impact: [droplets(12, 'ink'), shards(6, 'dark')],
    flash: 0,
  },
  'fx.prop.brazier': {
    palette: 'fire',
    impact: [fireBurst(12), embers(12), shards(6, 'dark')],
    shake: 0.04,
    flash: 0,
  },
  'fx.prop.hay_bale': {
    palette: 'fire',
    impact: [fireBurst(8), embers(10), shards(8, 'accent')],
    flash: 0,
  },
  'fx.prop.rubble_pile': {
    palette: 'earth',
    impact: [shards(10, 'dark'), dust(10)],
    shake: 0.04,
    flash: 0,
  },
  'fx.prop.cabbage_cart': {
    palette: 'earth',
    impact: [shards(14, 'light'), dust(6), spirals(6, 0.5, 'light')],
    shake: 0.03,
    flash: 0,
  },
};

/* ------------------------------------------------------------------ */
/* Hand-drawn technique coverage                                       */
/* ------------------------------------------------------------------ */

/** Keep directional lines and small debris; coloured cels carry the silhouette. */
function supportingFx(defs: readonly EmitterDef[]): EmitterDef[] {
  return defs.flatMap((def): EmitterDef[] => {
    if (def.kind === 'strokes') return def.shape === 'slab' || def.shape === 'ribbon' ? [] : [def];
    if (
      def.cel ||
      ['glow', 'disc', 'square', 'ring'].includes(def.cell) ||
      def.shape === 'projectile'
    )
      return [];
    return [{ ...def, count: Math.min(def.count, 6) }];
  });
}

export const FX_RECIPES: Readonly<Record<string, FxRecipeInput>> = Object.fromEntries(
  Object.entries(DRAWN_RECIPES).map(([key, recipe]) => {
    const cues = BENDING_CEL_CUES[key];
    if (!cues) return [key, recipe];
    const phase = (
      cue: readonly [FxCel, number] | undefined,
      defs: readonly EmitterDef[] = [],
      duration = 480,
    ): EmitterDef[] => [...(cue ? [cel(cue[0], cue[1], duration)] : []), ...supportingFx(defs)];
    return [
      key,
      {
        ...recipe,
        cast: phase(cues.cast, recipe.cast, 300),
        impact: phase(cues.impact, recipe.impact),
        area: phase(cues.area, recipe.area, 420),
        ...(recipe.travel && cues.travel
          ? {
              travel: {
                ...recipe.travel,
                emitters: [
                  cel(cues.travel[0], cues.travel[1], 300, true),
                  ...supportingFx(recipe.travel.emitters),
                ],
              },
            }
          : {}),
      },
    ];
  }),
);

/* ------------------------------------------------------------------ */
/* Ambience                                                            */
/* ------------------------------------------------------------------ */

/** Something in the air over the whole board, looped for as long as the map is up. */
const drifting = (
  cell: FxCell,
  count: number,
  color: FxColor,
  heading: number,
  speed: [number, number],
  size: [number, number],
  blend: 'normal' | 'add' = 'normal',
  spin = 2,
): ParticleEmitterDef =>
  particles({
    shape: 'drift',
    cell,
    count,
    duration: 8000,
    life: [4000, 7000],
    delay: [0, 8000],
    speed,
    spread: heading,
    gravity: 0,
    drag: 0,
    size,
    grow: 1,
    spin,
    color,
    fade: 'in-out',
    blend,
    layer: 'over',
  });

export interface AmbienceRecipe {
  /** Which palette colours the roles. */
  readonly palette: string;
  readonly emitters: readonly ParticleEmitterDef[];
}

/**
 * What a map's `ambience` puts in the air, keyed by the ambience string. A
 * map whose ambience is not here gets nothing, which is a valid answer for
 * a cellar. WebGL-only and off under reduce motion: it is fidelity, not
 * information (ADR 0002).
 */
export const FX_AMBIENCE: Readonly<Record<string, AmbienceRecipe>> = {
  forest: {
    palette: 'earth',
    emitters: [
      drifting('leaf', 14, 'light', 0.9, [0.25, 0.5], [0.08, 0.13]),
      drifting('glow', 10, 'white', 4.98, [0.05, 0.12], [0.03, 0.05], 'add', 0),
    ],
  },
  village: {
    palette: 'air',
    emitters: [
      drifting('leaf', 8, 'base', 0.7, [0.2, 0.4], [0.07, 0.11]),
      drifting('glow', 8, 'white', 4.88, [0.05, 0.1], [0.03, 0.05], 'add', 0),
    ],
  },
  quarry: {
    palette: 'neutral',
    emitters: [drifting('glow', 16, 'stone', 3.88, [0.08, 0.18], [0.03, 0.06], 'add', 0)],
  },
};

/** The ambience recipe for a map's ambience string, or null for still air. */
export function ambienceFx(ambience: string): AmbienceRecipe | null {
  return FX_AMBIENCE[ambience] ?? null;
}

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

const GENERIC: FxRecipeInput = {
  palette: 'neutral',
  impact: [flashRing('light', 0.3), sparks(6, 'light')],
};

/** The family an fx key belongs to, from its middle segment: `fx.fire.jab` -> `fire`. */
export function fxFamily(key: string): string {
  return key.split('.')[1] ?? 'neutral';
}

/** The parsed recipe for a key: its own, else its family's, else something that at least flashes. */
export function resolveFx(key: string): FxRecipe {
  const own = FX_RECIPES[key];
  if (own) return fxRecipeSchema.parse(own);
  const family = FX_FAMILIES[fxFamily(key)];
  return fxRecipeSchema.parse(family ?? GENERIC);
}

/** The palette an fx key draws with: the recipe's override, else its element. */
export function fxPalette(key: string, recipe: FxRecipe): string {
  if (recipe.palette) return recipe.palette;
  const family = fxFamily(key);
  return family === 'non' ? 'nonbender' : family === 'lightning' ? 'fire' : family;
}

/** Every recipe, for validation: the named ones and the families. */
export const ALL_FX: readonly { readonly key: string; readonly recipe: FxRecipeInput }[] = [
  ...Object.entries(FX_RECIPES).map(([key, recipe]) => ({ key, recipe })),
  ...Object.entries(FX_FAMILIES).map(([key, recipe]) => ({ key: `family:${key}`, recipe })),
];
