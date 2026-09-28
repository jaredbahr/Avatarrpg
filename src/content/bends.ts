/**
 * Bend clips and their painted effects, as data (ADR 0054).
 *
 * A bend _set_ is the one whole-body bending animation a character owns.
 * Every bending ability that character has plays the same clip; only the
 * element's painted effect differs. A heading's bend carries its cels and
 * their timing, the sockets an effect leaves from, and the cues where a
 * rules-level attack launches and lands. `validateBendSets` holds the sets and
 * effects to their cross-references, the way `validateContent` holds the rest
 * of the content to its.
 *
 * Nothing here is wired into `src/content/index.ts` or the manifest yet.
 */

import { z } from 'zod';
import { HEADINGS } from './assets/clips';
import type { Heading } from './assets/clips';

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/** The four limbs a bend releases from: left/right wrist, left/right ankle. */
export const BEND_SOCKETS = ['LW', 'RW', 'LA', 'RA'] as const;
export type BendSocket = (typeof BEND_SOCKETS)[number];

/** The elements a character bends; a bend set is one of these. */
export const BEND_ELEMENTS = ['fire', 'water', 'earth', 'air'] as const;
export type BendElement = (typeof BEND_ELEMENTS)[number];

/** The phases a painted effect passes through, in play order. */
export const BEND_PHASES = ['gather', 'launch', 'travel', 'impact', 'residue'] as const;
export type BendPhase = (typeof BEND_PHASES)[number];

/** How deep a layer draws relative to the actors on the same tile. */
export const BEND_LAYER_Z = ['ground', 'underActor', 'overActor'] as const;
export type BendLayerZ = (typeof BEND_LAYER_Z)[number];

/** Where a layer begins: a socket, a tile, or the end of the layer before it. */
export const BEND_LAYER_ORIGINS = [
  'socket',
  'sourceTile',
  'targetTile',
  'previousPhaseEnd',
] as const;
export type BendLayerOrigin = (typeof BEND_LAYER_ORIGINS)[number];

/** A painted layer either covers what is under it or adds light to it. */
export const BEND_BLENDS = ['normal', 'add'] as const;
export type BendBlend = (typeof BEND_BLENDS)[number];

/** A heading's bend carries 1-16 cels. */
export const BEND_FRAME_MIN = 1;
export const BEND_FRAME_MAX = 16;
/** A cel holds 16-1000 ms. */
export const BEND_FRAME_MS_MIN = 16;
export const BEND_FRAME_MS_MAX = 1000;
/** Hit-stop is 0-300 ms, at launch and again at impact. */
export const BEND_HOLD_MS_MAX = 300;

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

/** One rules-level attack inside a bend: where it leaves, lands and freezes. */
export interface BendAttackCue {
  /** The ability cue this attack belongs to, unique within the heading. */
  readonly id: string;
  /** The cel the strike's contact pose is keyed to. */
  readonly frame: number;
  /** The cel the effect leaves the socket from. */
  readonly launchFrame: number;
  /** The socket the effect travels to the target from. */
  readonly socket: BendSocket;
  /** Hit-stop at launch/contact, on the presentation clock. */
  readonly launchHoldMs: number;
  /** Hit-stop when the effect lands on the target, on the presentation clock. */
  readonly impactHoldMs: number;
  /** The painted effect released by this attack. */
  readonly effectId: string;
}

/** The sockets one cel records, in source-atlas pixels. */
export interface BendFrameSockets {
  readonly frame: number;
  readonly sockets: Partial<Record<BendSocket, { x: number; y: number }>>;
}

/** One heading's bend: its cels, timing, sockets and attack cues. */
export interface HeadingBendDef {
  /** Atlas frame names, in play order. */
  readonly frames: readonly string[];
  /** How long each cel holds, in ms (16-1000). */
  readonly frameMs: readonly number[];
  /** The untrimmed page the cels were cut from. */
  readonly sourceSize: { readonly width: number; readonly height: number };
  /** The root-lock point, in source pixels. */
  readonly root: { readonly x: number; readonly y: number };
  /** The foot anchor, as fractions of the trimmed cel (ADR 0003). */
  readonly anchor: { readonly x: number; readonly y: number };
  /** Named pose frames an effect or the choreography can ask for. */
  readonly keyFrames: Readonly<Record<string, number>>;
  /** The cel that smears between poses, when the art carries one. */
  readonly smearFrame?: number;
  /** The rules-level attacks this heading's bend can play. */
  readonly attacks: readonly BendAttackCue[];
  /** Socket positions, one entry per cel, indexed by `frame`. */
  readonly socketsPerFrame: readonly BendFrameSockets[];
}

/** One character's whole bend: a heading per facing. */
export interface BendSetDef {
  readonly id: string;
  /** The unit asset whose sheet draws this bend (`unit.<element>.<name>`). */
  readonly unitAsset: string;
  readonly element: BendElement;
  readonly facings: Record<Heading, HeadingBendDef>;
}

/** One painted layer of an effect. */
export interface BendEffectLayer {
  readonly phase: BendPhase;
  readonly z: BendLayerZ;
  /** The painted sequence this layer draws. */
  readonly sequence: string;
  /** How long each cel of the sequence holds, in ms. */
  readonly frameMs: readonly number[];
  readonly origin: BendLayerOrigin;
  readonly blend: BendBlend;
}

/** What travels from the caster to the target. */
export type BendTrajectory =
  | { readonly kind: 'straight'; readonly speedTilesPerSecond: number }
  | {
      readonly kind: 'arc';
      readonly speedTilesPerSecond: number;
      readonly heightTiles: number;
      readonly spin: number;
    }
  | {
      readonly kind: 'whipBolt';
      readonly whipFraction: number;
      readonly whipMaxTiles: number;
      readonly boltSpeedTilesPerSecond: number;
    };

/** What the effect draws when it lands. */
export interface BendImpact {
  readonly sequence: string;
  readonly flash: number;
  readonly shakeTiles: number;
}

/** What the effect leaves behind: a drawing, never a rules surface. */
export interface BendResidue {
  readonly sequence: string;
  readonly durationMs: number;
  readonly gameplaySurface: false;
}

/** An element's painted effect: what the game draws when a bend lands. */
export interface BendEffectDef {
  readonly id: string;
  readonly element: BendElement;
  readonly layers: readonly BendEffectLayer[];
  readonly trajectory: BendTrajectory;
  readonly impact: BendImpact;
  readonly residue?: BendResidue;
}

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const bendId = z.string().min(1).max(64);
const bendPoint = z.object({ x: z.number(), y: z.number() });
const anchorPoint = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const frameMsValue = z.number().int().min(BEND_FRAME_MS_MIN).max(BEND_FRAME_MS_MAX);
const pixelSize = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const impactSchema: z.ZodType<BendImpact> = z.object({
  sequence: z.string().min(1),
  flash: z.number().min(0),
  shakeTiles: z.number().min(0),
});

export const bendAttackCueSchema: z.ZodType<BendAttackCue> = z.object({
  id: bendId,
  frame: z.number().int().min(0),
  launchFrame: z.number().int().min(0),
  socket: z.enum(BEND_SOCKETS),
  launchHoldMs: z.number().min(0).max(BEND_HOLD_MS_MAX),
  impactHoldMs: z.number().min(0).max(BEND_HOLD_MS_MAX),
  effectId: z.string().min(1),
});

export const bendFrameSocketsSchema: z.ZodType<BendFrameSockets> = z.object({
  frame: z.number().int().min(0),
  sockets: z.object({
    LW: bendPoint.optional(),
    RW: bendPoint.optional(),
    LA: bendPoint.optional(),
    RA: bendPoint.optional(),
  }),
});

export const headingBendDefSchema: z.ZodType<HeadingBendDef> = z.object({
  frames: z.array(z.string().min(1)).min(BEND_FRAME_MIN).max(BEND_FRAME_MAX),
  frameMs: z.array(frameMsValue).min(BEND_FRAME_MIN).max(BEND_FRAME_MAX),
  sourceSize: pixelSize,
  root: bendPoint,
  anchor: anchorPoint,
  keyFrames: z.record(z.number().int().min(0)),
  smearFrame: z.number().int().min(0).optional(),
  attacks: z.array(bendAttackCueSchema),
  socketsPerFrame: z.array(bendFrameSocketsSchema).min(BEND_FRAME_MIN).max(BEND_FRAME_MAX),
});

const facingsSchema: z.ZodType<Record<Heading, HeadingBendDef>> = z
  .object({
    north: headingBendDefSchema,
    northEast: headingBendDefSchema,
    east: headingBendDefSchema,
    southEast: headingBendDefSchema,
    south: headingBendDefSchema,
    southWest: headingBendDefSchema,
    west: headingBendDefSchema,
    northWest: headingBendDefSchema,
  })
  .strict();

export const bendSetDefSchema: z.ZodType<BendSetDef> = z.object({
  id: bendId,
  unitAsset: z.string().min(1),
  element: z.enum(BEND_ELEMENTS),
  facings: facingsSchema,
});

export const bendEffectLayerSchema: z.ZodType<BendEffectLayer> = z.object({
  phase: z.enum(BEND_PHASES),
  z: z.enum(BEND_LAYER_Z),
  sequence: z.string().min(1),
  frameMs: z.array(z.number().int().positive()).min(1),
  origin: z.enum(BEND_LAYER_ORIGINS),
  blend: z.enum(BEND_BLENDS),
});

export const bendTrajectorySchema: z.ZodType<BendTrajectory> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('straight'), speedTilesPerSecond: z.number().positive() }),
  z.object({
    kind: z.literal('arc'),
    speedTilesPerSecond: z.number().positive(),
    heightTiles: z.number(),
    spin: z.number(),
  }),
  z.object({
    kind: z.literal('whipBolt'),
    whipFraction: z.number().gt(0).max(1),
    whipMaxTiles: z.number().positive(),
    boltSpeedTilesPerSecond: z.number().positive(),
  }),
]);

export const bendEffectDefSchema: z.ZodType<BendEffectDef> = z.object({
  id: bendId,
  element: z.enum(BEND_ELEMENTS),
  layers: z.array(bendEffectLayerSchema).min(1),
  trajectory: bendTrajectorySchema,
  impact: impactSchema,
  residue: z
    .object({
      sequence: z.string().min(1),
      durationMs: z.number().min(0),
      gameplaySurface: z.literal(false),
    })
    .optional(),
});

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const HEADING_SET = new Set<string>(HEADINGS);

/** One heading of one set, checked field by field. */
function validateFacing(
  setId: string,
  element: BendElement,
  heading: Heading,
  facing: HeadingBendDef,
  effectById: ReadonlyMap<string, BendEffectDef>,
  knownFrames: ReadonlySet<string> | undefined,
  problems: string[],
): void {
  const where = `bend "${setId}" ${heading}`;
  const note = (detail: string): void => {
    problems.push(`${where}: ${detail}`);
  };
  const count = facing.frames.length;
  const last = count - 1;
  const range = `0..${last}`;
  const { width, height } = facing.sourceSize;
  if (count < BEND_FRAME_MIN || count > BEND_FRAME_MAX) {
    note(`has ${count} frames, needs ${BEND_FRAME_MIN}..${BEND_FRAME_MAX}`);
  }
  const ms = facing.frameMs.length;
  const sockets = facing.socketsPerFrame.length;
  if (ms !== count || sockets !== count) {
    note(`cel counts differ: ${count} frames, ${ms} ms, ${sockets} sockets`);
  }
  facing.frameMs.forEach((held, index) => {
    if (held < BEND_FRAME_MS_MIN || held > BEND_FRAME_MS_MAX) {
      note(`frameMs[${index}] ${held} is outside ${BEND_FRAME_MS_MIN}..${BEND_FRAME_MS_MAX}`);
    }
  });
  facing.socketsPerFrame.forEach((entry, index) => {
    if (entry.frame !== index) {
      note(`socketsPerFrame[${index}] is frame ${entry.frame}, expected ${index}`);
    }
    for (const socket of BEND_SOCKETS) {
      const point = entry.sockets[socket];
      if (!point) continue;
      if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
        note(`socket ${socket} at ${point.x},${point.y} is outside ${width}x${height}`);
      }
    }
  });
  if (knownFrames) {
    facing.frames.forEach((frame, index) => {
      if (!knownFrames.has(frame)) note(`frame[${index}] "${frame}" is unknown`);
    });
  }
  for (const [name, index] of Object.entries(facing.keyFrames)) {
    if (!Number.isInteger(index) || index < 0 || index >= count) {
      note(`keyFrames "${name}" is frame ${index} of ${count}`);
    }
  }
  const smear = facing.smearFrame;
  if (smear !== undefined && (smear < 0 || smear > last)) {
    note(`smearFrame ${smear} is outside ${range}`);
  }
  for (const attack of facing.attacks) {
    const id = attack.id;
    if (attack.frame < 0 || attack.frame >= count) {
      note(`attack "${id}" frame ${attack.frame} is outside ${range}`);
    }
    if (attack.launchFrame < 0 || attack.launchFrame >= count) {
      note(`attack "${id}" launchFrame ${attack.launchFrame} is outside ${range}`);
    }
    if (attack.launchHoldMs < 0 || attack.launchHoldMs > BEND_HOLD_MS_MAX) {
      note(`attack "${id}" launchHoldMs ${attack.launchHoldMs} is outside 0..${BEND_HOLD_MS_MAX}`);
    }
    if (attack.impactHoldMs < 0 || attack.impactHoldMs > BEND_HOLD_MS_MAX) {
      note(`attack "${id}" impactHoldMs ${attack.impactHoldMs} is outside 0..${BEND_HOLD_MS_MAX}`);
    }
    const effect = effectById.get(attack.effectId);
    if (!effect) note(`attack "${id}" uses unknown effect "${attack.effectId}"`);
    if (effect && effect.element !== element) {
      note(`attack "${id}" uses ${effect.element} effect "${attack.effectId}"`);
    }
    const launch = facing.socketsPerFrame.find((entry) => entry.frame === attack.launchFrame);
    if (!launch || !launch.sockets[attack.socket]) {
      note(`attack "${id}" needs socket ${attack.socket} on frame ${attack.launchFrame}`);
    }
  }
}

/** One effect's own shape rules, which need no bend set to check. */
function validateEffect(effect: BendEffectDef, problems: string[]): void {
  const where = `effect "${effect.id}"`;
  const note = (detail: string): void => {
    problems.push(`${where}: ${detail}`);
  };
  if (effect.layers.length === 0) note(`has no layers`);
  const trajectory = effect.trajectory;
  switch (trajectory.kind) {
    case 'straight':
      if (!(trajectory.speedTilesPerSecond > 0)) {
        note(`speedTilesPerSecond ${trajectory.speedTilesPerSecond} must be above 0`);
      }
      break;
    case 'arc':
      if (!(trajectory.speedTilesPerSecond > 0)) {
        note(`speedTilesPerSecond ${trajectory.speedTilesPerSecond} must be above 0`);
      }
      break;
    case 'whipBolt':
      if (!(trajectory.whipFraction > 0 && trajectory.whipFraction <= 1)) {
        note(`whipFraction ${trajectory.whipFraction} must be in (0,1]`);
      }
      if (!(trajectory.whipMaxTiles > 0)) {
        note(`whipMaxTiles ${trajectory.whipMaxTiles} must be above 0`);
      }
      if (!(trajectory.boltSpeedTilesPerSecond > 0)) {
        note(`boltSpeedTilesPerSecond ${trajectory.boltSpeedTilesPerSecond} must be above 0`);
      }
      break;
  }
  if (effect.residue && effect.residue.gameplaySurface !== false) {
    note(`residue gameplaySurface must be false`);
  }
  effect.layers.forEach((layer, index) => {
    if (layer.frameMs.length === 0) note(`layer ${index} (${layer.phase}) has no frameMs`);
  });
}

/**
 * Returns a list of human-readable problems with the bend data. Empty means
 * the contract is sound. `knownUnitAssets` is the manifest's unit keys, and
 * `knownFrames`, when given, is every frame name the unit atlases carry, so a
 * bend cannot name a cel the packer never wrote. Deliberately collects
 * everything rather than throwing on the first fault, so one CI run reports
 * every broken link at once.
 */
export function validateBendSets(
  sets: readonly BendSetDef[],
  effects: readonly BendEffectDef[],
  knownUnitAssets: readonly string[],
  knownFrames?: readonly string[],
): string[] {
  const problems: string[] = [];
  const assets = new Set(knownUnitAssets);
  const frames = knownFrames ? new Set(knownFrames) : undefined;
  const effectById = new Map(effects.map((effect) => [effect.id, effect]));
  for (const effect of effects) validateEffect(effect, problems);

  const claimed = new Map<string, string>();
  for (const set of sets) {
    if (!assets.has(set.unitAsset)) {
      problems.push(`bend "${set.id}" uses unknown unit asset "${set.unitAsset}"`);
    }
    const owner = claimed.get(set.unitAsset);
    if (owner) problems.push(`bend "${set.id}" repeats unit asset "${set.unitAsset}"`);
    claimed.set(set.unitAsset, set.id);
    for (const key of Object.keys(set.facings)) {
      if (!HEADING_SET.has(key)) problems.push(`bend "${set.id}" has unknown facing "${key}"`);
    }
    for (const heading of HEADINGS) {
      const facing: HeadingBendDef | undefined = set.facings[heading];
      if (!facing) {
        problems.push(`bend "${set.id}" is missing the ${heading} facing`);
        continue;
      }
      validateFacing(set.id, set.element, heading, facing, effectById, frames, problems);
    }
  }
  return problems;
}
