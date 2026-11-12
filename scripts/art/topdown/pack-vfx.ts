/**
 * The prototype's approved painted VFX strips packed for the top-down style.
 *
 * node --import tsx scripts/art/topdown/pack-vfx.ts [--check]
 *
 * PixelLab frames are cropped from their committed strips, alpha-thresholded
 * to the figure packer's hard-alpha rule, and packed losslessly. Recipe
 * metadata remains JSON so the default game's JavaScript carries no atlas
 * data. This task adds no playback.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeAtlas, shelfPack, type Item } from '../lib/atlas';
import { newImage, readPng, type Image } from '../lib/image';
import { encodeWebpLossless } from '../lib/webp';

export const SOURCE = 'prototypes/topdown/assets';
export const OUT = 'public/art/topdown';
export const WEBP = OUT + '/vfx.webp';
export const JSON_OUTPUT = OUT + '/vfx.json';
const GUTTER = 2;
const MAX_ATLAS = 2048;
const FAMILY_BUDGET = 6 * 1024 * 1024;

export type VfxUse =
  | {
      readonly kind: 'ability';
      readonly abilityId: string;
      readonly fxId?: string;
      /** Explain when the current ability has no registered FX recipe to reference. */
      readonly fxOmittedReason?: string;
      readonly prototypeUse: string;
      /** Only present when this exact prototype ability actually applies hit-stop. */
      readonly hitStopMs?: number;
    }
  | {
      readonly kind: 'surface';
      readonly fxId: string;
      readonly abilityIds?: readonly string[];
      readonly prototypeUse: string;
    };

interface VfxSpec {
  readonly uses?: readonly VfxUse[];
  readonly unused?: string;
  readonly durationOverrideMs?: number;
  readonly directionTable?: 'burst' | 'ball-cardinal' | 'ball-diagonal' | 'whip';
}

/**
 * Verified prototype uses and current-game IDs. The keys are source-relative
 * asset names; never add a speculative ability or fx identifier here.
 */
export const VFX_RECIPES: Readonly<Record<string, VfxSpec>> = {
  'vfx13/bolt_hit': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'merc_crossbow',
        fxId: 'fx.enemy.crossbow',
        prototypeUse: 'b3/combat.js: merc_crossbow impact',
      },
    ],
  },
  'vfx13/club_hit': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'club_swing',
        fxOmittedReason:
          'club_swing declares fx.enemy.club, but that ID has no FX_RECIPES entry in current game content.',
        prototypeUse: 'b3/combat.js: club_swing impact',
        hitStopMs: 90,
      },
    ],
  },
  'vfx13/debris': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'driller_debris',
        fxId: 'fx.enemy.debris',
        prototypeUse:
          'b3/combat.js: driller_debris impact; excluded from hit-stop despite its HEAVY entry',
      },
    ],
  },
  'vfx13/drill_sparks': {
    unused:
      'No named current b3 consumer and no matching game ability or fx recipe exists in src/content.',
  },
  'vfx13/dust_ring': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'bandit_rush',
        fxId: 'fx.enemy.rush',
        prototypeUse: 'b3/combat.js: bandit_rush cast',
      },
      {
        kind: 'ability',
        abilityId: 'earth_wall',
        fxId: 'fx.earth.wall',
        prototypeUse: 'b3/combat.js: earth_wall placement',
      },
      {
        kind: 'ability',
        abilityId: 'stone_stance',
        fxId: 'fx.earth.stance',
        prototypeUse: 'b3/combat.js: stone_stance cast',
      },
      {
        kind: 'ability',
        abilityId: 'raise_rubble',
        fxId: 'fx.earth.rubble',
        prototypeUse: 'b3/combat.js: raise_rubble placement',
      },
      {
        kind: 'ability',
        abilityId: 'fire_step',
        fxId: 'fx.fire.step',
        prototypeUse: 'b3/combat.js: generic dash result',
      },
      {
        kind: 'ability',
        abilityId: 'air_scooter',
        fxId: 'fx.air.scooter',
        prototypeUse: 'b3/combat.js: generic dash result',
      },
    ],
  },
  'vfx13/exhaust': {
    unused:
      'No named current b3 consumer and no matching game ability or fx recipe exists in src/content.',
  },
  'vfx13/fire_ground_a': {
    durationOverrideMs: 85,
    uses: [
      {
        kind: 'surface',
        fxId: 'fx.surface.fire',
        prototypeUse: 'b3/surfvis.js: fire surface loop',
      },
    ],
  },
  'vfx13/fire_ground_b': {
    durationOverrideMs: 85,
    uses: [
      {
        kind: 'surface',
        fxId: 'fx.surface.fire',
        prototypeUse: 'b3/surfvis.js: newly-created fire surface loop',
      },
    ],
  },
  'vfx13/fire_ground_c': {
    durationOverrideMs: 85,
    uses: [
      {
        kind: 'surface',
        fxId: 'fx.surface.fire',
        prototypeUse: 'b3/surfvis.js: deep-fire surface variant',
      },
    ],
  },
  'vfx13/fire_punch': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'fire_blast',
        fxId: 'fx.fire.blast',
        prototypeUse: 'b3/combat.js: fire_blast release',
      },
    ],
  },
  'vfx13/ice_burst': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'ice_path',
        fxId: 'fx.water.path',
        prototypeUse: 'b3/combat.js: ice_path tiles',
      },
    ],
  },
  'vfx13/heal': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'healing_stream',
        fxId: 'fx.water.heal',
        prototypeUse: 'b3/combat.js: healing_stream target',
      },
      {
        kind: 'ability',
        abilityId: 'ruon_order',
        fxId: 'fx.enemy.order',
        prototypeUse: 'b3/combat.js: ruon_order target',
      },
    ],
  },
  'vfx13/mud_churn': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'driller_churn',
        fxId: 'fx.enemy.churn',
        prototypeUse: 'b3/combat.js: driller_churn area',
      },
    ],
  },
  'vfx13/oil_splash': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'oil_flask',
        fxId: 'fx.enemy.oil',
        prototypeUse: 'b3/combat.js: oil_flask impact',
      },
      {
        kind: 'ability',
        abilityId: 'driller_spray',
        fxId: 'fx.enemy.spray',
        prototypeUse: 'b3/combat.js: driller_spray tiles',
      },
    ],
  },
  'vfx13/rock_hit': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'sling_stone',
        fxId: 'fx.enemy.sling',
        prototypeUse: 'b3/combat.js: sling_stone impact',
      },
      {
        kind: 'ability',
        abilityId: 'rock_throw',
        fxId: 'fx.earth.rock',
        prototypeUse: 'b3/combat.js: rock_throw impact',
        hitStopMs: 50,
      },
      {
        kind: 'ability',
        abilityId: 'raise_rubble',
        fxId: 'fx.earth.rubble',
        prototypeUse: 'b3/combat.js: raise_rubble secondary impact',
      },
    ],
  },
  'vfx13/slam_shock': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'driller_slam',
        fxId: 'fx.enemy.slam',
        prototypeUse: 'b3/combat.js: driller_slam impact',
        hitStopMs: 170,
      },
    ],
  },
  'vfx13/slash': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'merc_blade',
        fxOmittedReason:
          'merc_blade declares fx.enemy.blade, but that ID has no FX_RECIPES entry in current game content.',
        prototypeUse: 'b3/combat.js: merc_blade impact',
        hitStopMs: 70,
      },
      {
        kind: 'ability',
        abilityId: 'ruon_sabre',
        fxOmittedReason:
          'ruon_sabre declares fx.enemy.sabre, but that ID has no FX_RECIPES entry in current game content.',
        prototypeUse: 'b3/combat.js: ruon_sabre impact',
        hitStopMs: 80,
      },
    ],
  },
  'vfx13/torch': {
    durationOverrideMs: 70,
    uses: [
      {
        kind: 'ability',
        abilityId: 'torch_toss',
        fxId: 'fx.enemy.torch',
        prototypeUse: 'b3/fx.js: torch projectile',
      },
    ],
  },
  'vfx13/water_lash': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'water_whip',
        fxId: 'fx.water.whip',
        prototypeUse: 'b3/combat.js: water_whip cast',
      },
    ],
  },
  'vfx13/water_splash': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'water_whip',
        fxId: 'fx.water.whip',
        prototypeUse: 'b3/combat.js: water_whip impact',
      },
    ],
  },
  'vfx/vfx_ball': {
    directionTable: 'ball-cardinal',
    uses: [
      {
        kind: 'ability',
        abilityId: 'fire_jab',
        fxId: 'fx.fire.jab',
        prototypeUse: 'b3/fx.js: fireJab projectile; also used by the fire_blast call site',
      },
      {
        kind: 'ability',
        abilityId: 'fire_blast',
        fxId: 'fx.fire.blast',
        prototypeUse: 'b3/fx.js: fireJab projectile used by b3/combat.js fire_blast',
      },
    ],
  },
  'vfx/vfx_ball_diag': {
    directionTable: 'ball-diagonal',
    uses: [
      {
        kind: 'ability',
        abilityId: 'fire_jab',
        fxId: 'fx.fire.jab',
        prototypeUse:
          'b3/fx.js: fireJab diagonal projectile; also used by the fire_blast call site',
      },
      {
        kind: 'ability',
        abilityId: 'fire_blast',
        fxId: 'fx.fire.blast',
        prototypeUse: 'b3/fx.js: fireJab diagonal projectile used by b3/combat.js fire_blast',
      },
    ],
  },
  'vfx/vfx_burst': {
    directionTable: 'burst',
    uses: [
      {
        kind: 'ability',
        abilityId: 'fire_jab',
        fxId: 'fx.fire.jab',
        prototypeUse: 'b3/fx.js: fireJab release burst; also used by the fire_blast call site',
      },
      {
        kind: 'ability',
        abilityId: 'fire_blast',
        fxId: 'fx.fire.blast',
        prototypeUse: 'b3/fx.js: fireJab burst used by b3/combat.js fire_blast',
      },
    ],
  },
  'vfx/vfx_embers': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'fire_jab',
        fxId: 'fx.fire.jab',
        prototypeUse: 'b3/fx.js: fireJab impact embers; also used by the fire_blast call site',
      },
      {
        kind: 'ability',
        abilityId: 'fire_blast',
        fxId: 'fx.fire.blast',
        prototypeUse: 'b3/fx.js: fireJab embers used by b3/combat.js fire_blast',
      },
    ],
  },
  'vfx/vfx_ring': {
    unused:
      'The active b3 table selects vfx_ring_pro, which maps to fire_blast; this older strip has no separate current-game counterpart.',
  },
  'vfx/vfx_ring_pro': {
    uses: [
      {
        kind: 'ability',
        abilityId: 'fire_blast',
        fxId: 'fx.fire.blast',
        prototypeUse: 'b3/combat.js: fire_blast impact ring; b3/moves4.py selects this ring strip',
      },
    ],
  },
  'vfx/vfx_whip': {
    unused:
      'The active b3 table selects vfx_whip_pro, which maps to flame_arc; this older strip has no separate current-game counterpart.',
  },
  'vfx/vfx_whip_pro': {
    directionTable: 'whip',
    uses: [
      {
        kind: 'ability',
        abilityId: 'flame_arc',
        fxId: 'fx.fire.arc',
        prototypeUse: 'b3/moves4.py: Fire Whip sweep; current-game Flame Arc counterpart',
      },
    ],
  },
};

interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface SourceFrame {
  readonly frame: PixelRect;
  readonly pivot?: { readonly x: number; readonly y: number };
  readonly duration?: number;
  readonly rotated?: boolean;
}

interface SourceMetadata {
  readonly frames: readonly SourceFrame[];
  readonly meta?: { readonly size?: { readonly w: number; readonly h: number } };
}

interface PackedFrame {
  readonly frame: PixelRect;
}

type VfxHeading =
  'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west' | 'north' | 'north-east';
type VfxTransform =
  'identity' | 'flip-x' | 'flip-y' | 'rotate-180' | 'rotate-90-cw' | 'rotate-90-ccw';

interface DirectionRecipe {
  readonly frames: readonly string[];
  readonly transform: VfxTransform;
  readonly pivot: { readonly x: number; readonly y: number };
  readonly frameSize: { readonly w: number; readonly h: number };
}

const DIRECTIONS: readonly VfxHeading[] = [
  'south',
  'south-east',
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
];
const CARDINALS: readonly VfxHeading[] = ['south', 'east', 'north', 'west'];
const DIAGONALS: readonly VfxHeading[] = ['south-east', 'north-east', 'north-west', 'south-west'];
const AXIAL_TURNS: Partial<Record<VfxHeading, VfxTransform>> = {
  east: 'identity',
  west: 'flip-x',
  south: 'rotate-90-cw',
  north: 'rotate-90-ccw',
};

export interface PackedVfx {
  readonly frames: Readonly<Record<string, PackedFrame>>;
  readonly effects: Readonly<
    Record<
      string,
      {
        readonly frames: readonly string[];
        readonly pivot: { readonly x: number; readonly y: number };
        readonly frameMs: readonly number[];
        readonly sourceFrameMs?: readonly number[];
        readonly directions?: Readonly<Partial<Record<VfxHeading, DirectionRecipe>>>;
        readonly uses?: readonly VfxUse[];
        readonly unused?: string;
      }
    >
  >;
  readonly meta: {
    readonly image: string;
    readonly size: { readonly w: number; readonly h: number };
  };
}

const hardAlpha = (image: Image): Image => {
  const out = { width: image.width, height: image.height, data: new Uint8Array(image.data) };
  for (let i = 3; i < out.data.length; i += 4) {
    if ((out.data[i] ?? 0) >= 128) out.data[i] = 255;
    else out.data.fill(0, i - 3, i + 1);
  }
  return out;
};

function transformFor(
  table: NonNullable<VfxSpec['directionTable']>,
  heading: VfxHeading,
): VfxTransform {
  if (table === 'ball-cardinal') return AXIAL_TURNS[heading] ?? 'identity';
  if (table === 'burst' && AXIAL_TURNS[heading]) return AXIAL_TURNS[heading] as VfxTransform;
  if (table === 'ball-diagonal') {
    const turns: Readonly<Partial<Record<VfxHeading, VfxTransform>>> = {
      'north-east': 'identity',
      'north-west': 'flip-x',
      'south-east': 'flip-y',
      'south-west': 'rotate-180',
    };
    return turns[heading] ?? 'identity';
  }
  if (table === 'whip' && AXIAL_TURNS[heading]) return AXIAL_TURNS[heading] as VfxTransform;
  return heading.includes('east') ? 'identity' : 'flip-x';
}

function transformedPivot(
  pivot: { readonly x: number; readonly y: number },
  width: number,
  height: number,
  transform: VfxTransform,
): {
  readonly pivot: { readonly x: number; readonly y: number };
  readonly w: number;
  readonly h: number;
} {
  switch (transform) {
    case 'identity':
      return { pivot, w: width, h: height };
    case 'flip-x':
      return { pivot: { x: width - 1 - pivot.x, y: pivot.y }, w: width, h: height };
    case 'flip-y':
      return { pivot: { x: pivot.x, y: height - 1 - pivot.y }, w: width, h: height };
    case 'rotate-180':
      return {
        pivot: { x: width - 1 - pivot.x, y: height - 1 - pivot.y },
        w: width,
        h: height,
      };
    case 'rotate-90-cw':
      return { pivot: { x: height - 1 - pivot.y, y: pivot.x }, w: height, h: width };
    case 'rotate-90-ccw':
      return { pivot: { x: pivot.y, y: width - 1 - pivot.x }, w: height, h: width };
  }
}

function directionRecipes(
  table: NonNullable<VfxSpec['directionTable']>,
  frames: readonly string[],
  pivot: { readonly x: number; readonly y: number },
  width: number,
  height: number,
): Readonly<Partial<Record<VfxHeading, DirectionRecipe>>> {
  const headings =
    table === 'ball-cardinal' ? CARDINALS : table === 'ball-diagonal' ? DIAGONALS : DIRECTIONS;
  return Object.fromEntries(
    headings.map((heading) => {
      const transform = transformFor(table, heading);
      const transformed = transformedPivot(pivot, width, height, transform);
      return [
        heading,
        {
          frames,
          transform,
          pivot: transformed.pivot,
          frameSize: { w: transformed.w, h: transformed.h },
        },
      ];
    }),
  );
}

function sourceFiles(): string[] {
  return ['vfx13', 'vfx']
    .flatMap((folder) =>
      readdirSync(join(SOURCE, folder))
        .filter((name) => name.endsWith('.json'))
        .map((name) => folder + '/' + name.slice(0, -5)),
    )
    .sort();
}

function crop(source: Image, rect: PixelRect, label: string): Image {
  if (
    !Number.isInteger(rect.x) ||
    !Number.isInteger(rect.y) ||
    !Number.isInteger(rect.w) ||
    !Number.isInteger(rect.h) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.w <= 0 ||
    rect.h <= 0 ||
    rect.x + rect.w > source.width ||
    rect.y + rect.h > source.height
  )
    throw new Error(label + ': source frame lies outside its strip');
  const image = newImage(rect.w, rect.h);
  for (let y = 0; y < rect.h; y++) {
    const from = ((rect.y + y) * source.width + rect.x) * 4;
    const to = y * rect.w * 4;
    image.data.set(source.data.subarray(from, from + rect.w * 4), to);
  }
  return hardAlpha(image);
}

function frameMetadata(
  key: string,
  sourcePath: string,
  sourceImage: Image,
): {
  readonly items: Item[];
  readonly recipe: PackedVfx['effects'][string];
} {
  const raw = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourceMetadata;
  if (!Array.isArray(raw.frames) || raw.frames.length === 0)
    throw new Error(key + ': source JSON has no frames');
  if (
    raw.meta?.size &&
    (raw.meta.size.w !== sourceImage.width || raw.meta.size.h !== sourceImage.height)
  )
    throw new Error(key + ': metadata size does not match the source strip');
  const first = raw.frames[0];
  if (!first?.pivot || !Number.isFinite(first.pivot.x) || !Number.isFinite(first.pivot.y))
    throw new Error(key + ': first frame has no valid pivot');
  const width = first.frame.w;
  const height = first.frame.h;
  const pivot = { x: Math.round(first.pivot.x * width), y: Math.round(first.pivot.y * height) };
  const sourceFrameMs: number[] = [];
  const items = raw.frames.map((frame, index) => {
    if (frame.rotated)
      throw new Error(key + '/' + index + ': rotated source frames are unsupported');
    if (
      frame.frame.w !== width ||
      frame.frame.h !== height ||
      frame.pivot?.x !== first.pivot?.x ||
      frame.pivot?.y !== first.pivot?.y
    )
      throw new Error(key + '/' + index + ': frame size or pivot differs from the strip recipe');
    const duration = frame.duration ?? 83;
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error(key + '/' + index + ': invalid frame duration');
    sourceFrameMs.push(duration);
    return {
      name: key + '/' + index,
      image: crop(sourceImage, frame.frame, key + '/' + index),
    };
  });
  const spec = VFX_RECIPES[key];
  if (!spec) throw new Error(key + ': no verified recipe mapping or unused reason');
  if (!!spec.uses === !!spec.unused)
    throw new Error(key + ': provide either mapped uses or an explicit unused reason');
  const frameMs = spec.durationOverrideMs
    ? sourceFrameMs.map(() => spec.durationOverrideMs as number)
    : sourceFrameMs;
  return {
    items,
    recipe: {
      frames: items.map(({ name }) => name),
      pivot,
      frameMs,
      ...(spec.durationOverrideMs ? { sourceFrameMs } : {}),
      ...(spec.directionTable
        ? {
            directions: directionRecipes(
              spec.directionTable,
              items.map(({ name }) => name),
              pivot,
              width,
              height,
            ),
          }
        : {}),
      ...(spec.uses ? { uses: spec.uses } : { unused: spec.unused }),
    },
  };
}

function familyBytes(files: ReadonlyMap<string, Uint8Array | string>): number {
  const packedBytes = [...files].reduce(
    (sum, [, content]) =>
      sum + (content instanceof Uint8Array ? content.byteLength : Buffer.byteLength(content)),
    0,
  );
  const existingBytes = existsSync(OUT)
    ? readdirSync(OUT, { withFileTypes: true })
        .filter((entry) => entry.isFile() && ![WEBP, JSON_OUTPUT].includes(OUT + '/' + entry.name))
        .reduce((sum, entry) => sum + readFileSync(join(OUT, entry.name)).byteLength, 0)
    : 0;
  return existingBytes + packedBytes;
}

/** `#rrggbb` as RGBA. */
const rgb = (hex: string): [number, number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  255,
];

/** A cel `w` x `h` with the prototype's `fillRect` calls painted on it, in order. */
/** One painted pixel: its fill and the darker tone of its material that outlines it, or a bare trail pixel. */
type Ink = { fill: string; line?: string; trail?: true };

/**
 * A `w` x `h` cel from `paint` (pixel centre to ink), on the world-pixel grid: every transparent pixel beside a body
 * pixel takes that material's outline (1 px, the darker tone of the material); a trail pixel is laid only
 * where neither is.
 */
function inked(w: number, h: number, paint: (x: number, y: number) => Ink | null): Image {
  const image = newImage(w, h);
  const ink = Array.from({ length: w * h }, (_, i) => paint(i % w, Math.floor(i / w)));
  const body = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h ? ink[y * w + x] : undefined;
  ink.forEach((pixel, i) => {
    const x = i % w;
    const y = Math.floor(i / w);
    const near = [body(x, y - 1), body(x - 1, y), body(x + 1, y), body(x, y + 1)].find(
      (n) => n?.line,
    );
    const solid = pixel?.line ? pixel.fill : !pixel?.line && near?.line;
    if (solid) image.data.set(rgb(solid), i * 4);
    else if (pixel?.trail) image.data.set(rgb(pixel.fill), i * 4);
  });
  return image;
}

/** `mask` (rows of `#`) turned `quarter` right angles clockwise. */
function turned(mask: readonly string[], quarter: number): string[] {
  let rows = [...mask];
  for (let q = 0; q < quarter; q++)
    rows = Array.from({ length: rows[0]?.length ?? 0 }, (_, x) =>
      rows
        .map((row) => row[x] ?? '.')
        .reverse()
        .join(''),
    );
  return rows;
}

/** A body `mask`, lit from the upper left: light where its top or left edge is open, shade on its bottom or right. */
function lit(mask: readonly string[], [light, mid, dark, line]: readonly string[]): Image {
  const at = (x: number, y: number) => (mask[y]?.[x] ?? '.') !== '.';
  return inked((mask[0]?.length ?? 0) + 2, mask.length + 2, (px, py) => {
    const x = px - 1;
    const y = py - 1;
    if (!at(x, y)) return null;
    const material = {
      c: ['#c9a878', '#a88458', '#7a5c3a', '#3a2416'],
      w: ['#c4ae84', '#9a8660', '#6a5a40', line],
    }[mask[y]?.[x] ?? ''];
    const [l, m, d, o] = material ?? [light, mid, dark, line];
    const fill = !at(x, y - 1) || !at(x - 1, y) ? l : !at(x, y + 1) || !at(x + 1, y) ? d : m;
    return { fill: fill ?? '', line: o ?? '' };
  });
}

/** The thrown rock and sling stone in `rock_hit`'s palette: light, mid, shade, outline. */
const ROCK = ['#b8b0a4', '#8a8278', '#5e5850', '#3a3530'];
const ROCK_BODY = ['.###..', '#####.', '######', '##w###', '.####.', '...##.'];
const STONE_BODY = ['.##.', '#w##', '###.', '.#..'];
/** `w` is a warm fleck from the same palette, so the tumble shows. The oil flask: cork (`c`) on a clay jar. */
const JAR_BODY = ['..cc..', '..##..', '.####.', '######', '######', '######', '.####.'];

/**
 * The projectiles in flight (#588, readability pass), drawn procedurally one art px a world px with their point of
 * flight at each cel's centre, each in a 1 px outline of its material's darker tone so it reads on sand, dirt, grass,
 * water and oil. `shot/bolt/<i>` is the crossbow bolt flying along heading `i` (0 east, clockwise in 45 degree steps):
 * a steel head, a 2 px wooden shaft and light fletching, 12 px from tail to tip, with a three-step streak thinning out
 * behind it. `shot/rock/<q>` and `shot/stone/<q>` tumble a quarter turn a cel, always lit from the upper left;
 * `shot/jar` is the oil flask; `shot/torch/<i>` outlines the prototype's burning torch cels; `shot/shadow` is the
 * small hard shadow that tracks a shot across the ground.
 */
export function shotCels(torch: readonly Item[] = []): Item[] {
  const bolts = Array.from({ length: 8 }, (_, i) => {
    const [c, s] = [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)];
    const image = inked(30, 30, (x, y) => {
      const u = (x - 14.5) * c + (y - 14.5) * s;
      const v = Math.abs((x - 14.5) * -s + (y - 14.5) * c);
      if (u > 2.5 && u <= 6.6 && v <= Math.min(1.6, Math.max(0.5, (6.6 - u) * 0.75)))
        return { fill: v < 0.5 && u > 4.5 ? '#f4f7fa' : '#c8d0da', line: '#2e3038' };
      if (u > -5.6 && u <= 2.5 && v <= 0.8) return { fill: '#b07a46', line: '#4a2c18' };
      if (u > -5.6 && u <= -3 && v <= 1.9) return { fill: '#f2ead6', line: '#6a5a40' };
      // The streak fades in three steps by thinning on the pixel grid (the atlas is hard-alpha).
      if (u < -6.5 && u >= -13.5 && v <= 0.6 && (x + y) % (u > -8.8 ? 1 : u > -11.1 ? 2 : 3) === 0)
        return { fill: u > -8.8 ? '#f4ecd8' : '#e2d6bc', trail: true };
      return null;
    });
    return { name: `shot/bolt/${i}`, image };
  });
  const tumble = (name: string, body: readonly string[]) =>
    [0, 1, 2, 3].map((q) => ({ name: `${name}/${q}`, image: lit(turned(body, q), ROCK) }));
  return [
    ...bolts,
    ...tumble('shot/rock', ROCK_BODY),
    ...tumble('shot/stone', STONE_BODY),
    { name: 'shot/jar', image: lit(JAR_BODY, ['#e09a6a', '#c4643f', '#8e4128', '#3a2016']) },
    ...torch.map(({ name, image }) => ({
      name: name.replace('vfx13/', 'shot/'),
      image: inked(image.width, image.height, (x, y) => {
        const [r = 0, g = 0, b = 0, a = 0] = image.data.slice((y * image.width + x) * 4);
        const hex = (k: number) =>
          '#' +
          [r, g, b]
            .map((n) =>
              Math.round(n * k)
                .toString(16)
                .padStart(2, '0'),
            )
            .join('');
        return a > 127 ? { fill: hex(1), line: hex(0.35) } : null;
      }),
    })),
    {
      name: 'shot/shadow',
      image: inked(7, 3, (x, y) =>
        (x === 0 || x === 6) && y !== 1 ? null : { fill: '#322125', trail: true },
      ),
    },
  ];
}

export async function packTopdownVfx(): Promise<Map<string, Uint8Array | string>> {
  const specs = new Set(Object.keys(VFX_RECIPES));
  const sources = sourceFiles();
  for (const source of sources)
    if (!specs.delete(source))
      throw new Error(source + ': add a mapped recipe or an explicit unused reason');
  for (const source of specs) throw new Error(source + ': recipe has no source strip');

  const items: Item[] = [];
  const effects: Record<string, PackedVfx['effects'][string]> = {};
  for (const key of sources) {
    const parts = key.split('/');
    const folder = parts[0];
    const file = parts[1];
    if (!folder || !file) throw new Error('invalid VFX source key: ' + key);
    const sourcePath = join(SOURCE, folder, file + '.json');
    const image = readPng(join(SOURCE, folder, file + '.png'));
    const parsed = frameMetadata(key, sourcePath, image);
    items.push(...parsed.items);
    effects[key] = parsed.recipe;
  }
  items.push(...shotCels(items.filter(({ name }) => name.startsWith('vfx13/torch/'))));

  let width = 256;
  let placed: ReturnType<typeof shelfPack>['placed'] | undefined;
  let height = 0;
  for (; width <= MAX_ATLAS; width += 64) {
    const packed = shelfPack(items, width, GUTTER, false);
    if (packed.height <= MAX_ATLAS) {
      placed = packed.placed;
      height = packed.height;
      break;
    }
  }
  if (!placed) throw new Error('VFX atlas does not fit a 2048 px texture');
  const image = composeAtlas(items, placed, width, height, GUTTER);
  const atlas = await encodeWebpLossless(image, 6);
  const frames: Record<string, PackedFrame> = {};
  for (const p of [...placed].sort((a, b) => a.name.localeCompare(b.name)))
    frames[p.name] = { frame: { x: p.x, y: p.y, w: p.width, h: p.height } };
  const manifest: PackedVfx = {
    frames,
    effects,
    meta: { image: 'vfx.webp', size: { w: width, h: height } },
  };
  const files = new Map<string, Uint8Array | string>([
    [WEBP, atlas],
    [JSON_OUTPUT, JSON.stringify(manifest) + '\n'],
  ]);
  if (familyBytes(files) > FAMILY_BUDGET)
    throw new Error('top-down art family exceeds ' + FAMILY_BUDGET + ' bytes');
  return files;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const files = await packTopdownVfx();
  if (!check) mkdirSync(OUT, { recursive: true });
  let stale = 0;
  for (const [path, content] of files) {
    const bytes = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content);
    if (existsSync(path) && Buffer.compare(readFileSync(path), bytes) === 0) continue;
    stale++;
    if (check) console.error('stale: ' + path);
    else writeFileSync(path, bytes);
  }
  const bytes = [...files.values()].reduce(
    (sum, content) =>
      sum + (typeof content === 'string' ? Buffer.byteLength(content) : content.byteLength),
    0,
  );
  console.log(
    '2 VFX files, ' +
      bytes +
      ' bytes' +
      (check ? ', ' + stale + ' stale' : ', ' + stale + ' written'),
  );
  if (check && stale > 0) process.exit(1);
}

if (process.argv[1]?.endsWith('pack-vfx.ts')) await main();
