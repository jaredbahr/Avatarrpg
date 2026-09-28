/**
 * Bend clips and their painted effects, as data (ADR 0055).
 *
 * A bend _set_ is the one whole-body bending animation a character owns.
 * Every bending ability that character has plays that clip, and no clip is
 * shared across elements: each element has its own motion and martial style.
 * A heading's bend carries its cels and their timing, the sockets an effect
 * leaves from, and the rules-level attacks it plays. An attack is one damage
 * application however many visual hits it draws: each hit is a _release_,
 * and `damageRelease` names the one that applies the damage.
 * `validateBendSets` holds the sets and effects to their cross-references, the
 * way `validateContent` holds the rest of the content to its.
 *
 * The schemas are for the packer's output and CI. The runtime imports types
 * from here, never values, so zod stays out of the bundle (ADR 0048).
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

/**
 * The shared roles a key frame plays. The name of a key frame is free (`F1`,
 * `stomp`); its role is one of these, so choreography can ask for "the
 * contact" without knowing each clip's names.
 */
export const BEND_KEY_ROLES = ['anticipation', 'release', 'contact', 'recovery'] as const;
export type BendKeyRole = (typeof BEND_KEY_ROLES)[number];

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
/** A cel, of a bend or of an effect layer, holds 16-1000 ms. */
export const BEND_FRAME_MS_MIN = 16;
export const BEND_FRAME_MS_MAX = 1000;
/** Hit-stop is 0-300 ms, at launch/contact and again at impact. */
export const BEND_HOLD_MS_MAX = 300;
/** Flash is the peak opacity of the additive white flash frame, 0-1. */
export const BEND_FLASH_MAX = 1;
/** Screen shake is at most half a tile of amplitude. */
export const BEND_SHAKE_TILES_MAX = 0.5;
/** Residue lingers at most 3 s after impact. */
export const BEND_RESIDUE_MS_MAX = 3000;
/** Any travel speed is at most 64 tiles a second. */
export const BEND_SPEED_MAX = 64;
/** An arc rises at most 4 tiles above the straight line. */
export const BEND_ARC_HEIGHT_MAX = 4;
/** An arc turns at most 8 whole turns either way over its flight. */
export const BEND_ARC_SPIN_MAX = 8;
/** A whip reaches at most 16 tiles before its bolt lets go. */
export const BEND_WHIP_TILES_MAX = 16;

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

/**
 * One visual hit of an attack: the effect leaves `socket` on `launchFrame` and
 * the strike's contact pose is `frame`. Flash, hit-stop and shake land on the
 * contact frame; `impactHoldMs` freezes again when the effect reaches the
 * target.
 */
export interface BendRelease {
  /** The cel the strike's contact pose is keyed to. */
  readonly frame: number;
  /** The cel the effect leaves the socket from; never after `frame`. */
  readonly launchFrame: number;
  /** The socket the effect travels to the target from. */
  readonly socket: BendSocket;
  /** Hit-stop at launch/contact, on the presentation clock, 0-300 ms. */
  readonly launchHoldMs: number;
  /** Hit-stop when the effect lands on the target, 0-300 ms. */
  readonly impactHoldMs: number;
  /** Peak opacity of the contact flash frame, 0-1; absent means no flash. */
  readonly flash?: number;
  /** Contact shake amplitude in tiles, 0-0.5; absent means no shake. */
  readonly shakeTiles?: number;
}

/**
 * One rules-level attack inside a bend: a single damage application, drawn as
 * one or more releases. The fire bend's jab and cross are two releases of one
 * attack, not two attacks.
 */
export interface BendAttackCue {
  /** The attack's id, unique within the heading and the same in every heading. */
  readonly id: string;
  /** The painted effect every release of this attack draws. */
  readonly effectId: string;
  /** The visual hits, in play order; at least one. */
  readonly releases: readonly BendRelease[];
  /**
   * The index into `releases` whose impact applies the attack's one damage.
   * It must be the last release, so hit points never drop before the final
   * hit is drawn.
   */
  readonly damageRelease: number;
}

/** A named pose frame and the shared role it plays. */
export interface BendKeyFrame {
  readonly frame: number;
  readonly role: BendKeyRole;
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
  /** Named pose frames, each with a shared role. */
  readonly keyFrames: Readonly<Record<string, BendKeyFrame>>;
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
  /** How long each cel of the sequence holds, in ms (16-1000). */
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
      /** Peak rise above the straight line, 0-4 tiles. */
      readonly heightTiles: number;
      /** Whole turns over the flight, -8..8; the sign is the direction. */
      readonly spin: number;
    }
  | {
      readonly kind: 'whipBolt';
      readonly whipFraction: number;
      readonly whipMaxTiles: number;
      readonly boltSpeedTilesPerSecond: number;
    };

/** What the effect draws when it lands on the target. */
export interface BendImpact {
  readonly sequence: string;
  /** Peak opacity of the impact flash frame, 0-1. */
  readonly flash: number;
  /** Impact shake amplitude in tiles, 0-0.5. */
  readonly shakeTiles: number;
}

/**
 * What the effect leaves behind: a drawing, never a rules surface. Its
 * `sequence` is one of the effect's `residue`-phase layers, and an effect with
 * a `residue` layer must carry this block, so the two cannot drift.
 */
export interface BendResidue {
  readonly sequence: string;
  /** How long the residue lingers after impact, 0-3000 ms. */
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
const bendPoint = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const anchorPoint = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
const celIndex = z.number().int().min(0);
const frameMsValue = z.number().int().min(BEND_FRAME_MS_MIN).max(BEND_FRAME_MS_MAX);
const holdMs = z.number().min(0).max(BEND_HOLD_MS_MAX);
const flashValue = z.number().min(0).max(BEND_FLASH_MAX);
const shakeValue = z.number().min(0).max(BEND_SHAKE_TILES_MAX);
const speedValue = z.number().positive().max(BEND_SPEED_MAX);
const pixelSize = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
const impactSchema: z.ZodType<BendImpact> = z
  .object({
    sequence: z.string().min(1),
    flash: flashValue,
    shakeTiles: shakeValue,
  })
  .strict();

export const bendReleaseSchema: z.ZodType<BendRelease> = z
  .object({
    frame: celIndex,
    launchFrame: celIndex,
    socket: z.enum(BEND_SOCKETS),
    launchHoldMs: holdMs,
    impactHoldMs: holdMs,
    flash: flashValue.optional(),
    shakeTiles: shakeValue.optional(),
  })
  .strict();

export const bendAttackCueSchema: z.ZodType<BendAttackCue> = z
  .object({
    id: bendId,
    effectId: z.string().min(1),
    releases: z.array(bendReleaseSchema).min(1),
    damageRelease: celIndex,
  })
  .strict();

export const bendKeyFrameSchema: z.ZodType<BendKeyFrame> = z
  .object({ frame: celIndex, role: z.enum(BEND_KEY_ROLES) })
  .strict();

export const bendFrameSocketsSchema: z.ZodType<BendFrameSockets> = z
  .object({
    frame: celIndex,
    sockets: z
      .object({
        LW: bendPoint.optional(),
        RW: bendPoint.optional(),
        LA: bendPoint.optional(),
        RA: bendPoint.optional(),
      })
      .strict(),
  })
  .strict();

export const headingBendDefSchema: z.ZodType<HeadingBendDef> = z
  .object({
    frames: z.array(z.string().min(1)).min(BEND_FRAME_MIN).max(BEND_FRAME_MAX),
    frameMs: z.array(frameMsValue).min(BEND_FRAME_MIN).max(BEND_FRAME_MAX),
    sourceSize: pixelSize,
    root: bendPoint,
    anchor: anchorPoint,
    keyFrames: z.record(bendKeyFrameSchema),
    smearFrame: celIndex.optional(),
    attacks: z.array(bendAttackCueSchema),
    socketsPerFrame: z.array(bendFrameSocketsSchema).min(BEND_FRAME_MIN).max(BEND_FRAME_MAX),
  })
  .strict();

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

export const bendSetDefSchema: z.ZodType<BendSetDef> = z
  .object({
    id: bendId,
    unitAsset: z.string().min(1),
    element: z.enum(BEND_ELEMENTS),
    facings: facingsSchema,
  })
  .strict();

export const bendEffectLayerSchema: z.ZodType<BendEffectLayer> = z
  .object({
    phase: z.enum(BEND_PHASES),
    z: z.enum(BEND_LAYER_Z),
    sequence: z.string().min(1),
    frameMs: z.array(frameMsValue).min(1),
    origin: z.enum(BEND_LAYER_ORIGINS),
    blend: z.enum(BEND_BLENDS),
  })
  .strict();

export const bendTrajectorySchema: z.ZodType<BendTrajectory> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('straight'), speedTilesPerSecond: speedValue }).strict(),
  z
    .object({
      kind: z.literal('arc'),
      speedTilesPerSecond: speedValue,
      heightTiles: z.number().min(0).max(BEND_ARC_HEIGHT_MAX),
      spin: z.number().min(-BEND_ARC_SPIN_MAX).max(BEND_ARC_SPIN_MAX),
    })
    .strict(),
  z
    .object({
      kind: z.literal('whipBolt'),
      whipFraction: z.number().gt(0).max(1),
      whipMaxTiles: z.number().positive().max(BEND_WHIP_TILES_MAX),
      boltSpeedTilesPerSecond: speedValue,
    })
    .strict(),
]);

export const bendResidueSchema: z.ZodType<BendResidue> = z
  .object({
    sequence: z.string().min(1),
    durationMs: z.number().min(0).max(BEND_RESIDUE_MS_MAX),
    gameplaySurface: z.literal(false),
  })
  .strict();

export const bendEffectDefSchema: z.ZodType<BendEffectDef> = z
  .object({
    id: bendId,
    element: z.enum(BEND_ELEMENTS),
    layers: z.array(bendEffectLayerSchema).min(1),
    trajectory: bendTrajectorySchema,
    impact: impactSchema,
    residue: bendResidueSchema.optional(),
  })
  .strict();

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const HEADING_SET = new Set<string>(HEADINGS);

/** True when `value` is a finite number in `min..max`, inclusive. */
function within(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** The strings in `values` that appear more than once. */
function repeats(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) twice.add(value);
    seen.add(value);
  }
  return [...twice];
}

/** One release of one attack, checked against the heading it plays in. */
function validateRelease(
  label: string,
  release: BendRelease,
  facing: HeadingBendDef,
  note: (detail: string) => void,
): void {
  const count = facing.frames.length;
  const range = `0..${count - 1}`;
  if (release.frame < 0 || release.frame >= count) {
    note(`${label} frame ${release.frame} is outside ${range}`);
  }
  if (release.launchFrame < 0 || release.launchFrame >= count) {
    note(`${label} launchFrame ${release.launchFrame} is outside ${range}`);
  }
  if (release.launchFrame > release.frame) {
    note(`${label} launchFrame ${release.launchFrame} is after its frame ${release.frame}`);
  }
  if (!within(release.launchHoldMs, 0, BEND_HOLD_MS_MAX)) {
    note(`${label} launchHoldMs ${release.launchHoldMs} is outside 0..${BEND_HOLD_MS_MAX}`);
  }
  if (!within(release.impactHoldMs, 0, BEND_HOLD_MS_MAX)) {
    note(`${label} impactHoldMs ${release.impactHoldMs} is outside 0..${BEND_HOLD_MS_MAX}`);
  }
  if (release.flash !== undefined && !within(release.flash, 0, BEND_FLASH_MAX)) {
    note(`${label} flash ${release.flash} is outside 0..${BEND_FLASH_MAX}`);
  }
  if (release.shakeTiles !== undefined && !within(release.shakeTiles, 0, BEND_SHAKE_TILES_MAX)) {
    note(`${label} shakeTiles ${release.shakeTiles} is outside 0..${BEND_SHAKE_TILES_MAX}`);
  }
  for (const frame of new Set([release.launchFrame, release.frame])) {
    const entry = facing.socketsPerFrame.find((sockets) => sockets.frame === frame);
    if (!entry || !entry.sockets[release.socket]) {
      note(`${label} needs socket ${release.socket} on frame ${frame}`);
    }
  }
}

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
    if (!within(held, BEND_FRAME_MS_MIN, BEND_FRAME_MS_MAX)) {
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
      if (!within(point.x, 0, width) || !within(point.y, 0, height)) {
        note(`socket ${socket} at ${point.x},${point.y} is outside ${width}x${height}`);
      }
    }
  });
  if (knownFrames) {
    facing.frames.forEach((frame, index) => {
      if (!knownFrames.has(frame)) note(`frame[${index}] "${frame}" is unknown`);
    });
  }
  for (const [name, key] of Object.entries(facing.keyFrames)) {
    if (!Number.isInteger(key.frame) || key.frame < 0 || key.frame >= count) {
      note(`keyFrames "${name}" is frame ${key.frame} of ${count}`);
    }
    if (!(BEND_KEY_ROLES as readonly string[]).includes(key.role)) {
      note(`keyFrames "${name}" has unknown role "${key.role}"`);
    }
  }
  const smear = facing.smearFrame;
  if (smear !== undefined && (smear < 0 || smear > last)) {
    note(`smearFrame ${smear} is outside ${range}`);
  }
  for (const id of repeats(facing.attacks.map((attack) => attack.id))) {
    note(`attack id "${id}" repeats`);
  }
  for (const attack of facing.attacks) {
    const id = attack.id;
    if (attack.releases.length === 0) note(`attack "${id}" has no releases`);
    const lastRelease = attack.releases.length - 1;
    if (attack.damageRelease !== lastRelease) {
      note(`attack "${id}" damageRelease ${attack.damageRelease} must be the last, ${lastRelease}`);
    }
    attack.releases.forEach((release, index) => {
      validateRelease(`attack "${id}" release ${index}`, release, facing, note);
      const before = attack.releases[index - 1];
      if (before && release.frame <= before.frame) {
        note(`attack "${id}" release ${index} frame ${release.frame} is not after ${before.frame}`);
      }
    });
    const effect = effectById.get(attack.effectId);
    if (!effect) note(`attack "${id}" uses unknown effect "${attack.effectId}"`);
    if (effect && effect.element !== element) {
      note(`attack "${id}" uses ${effect.element} effect "${attack.effectId}"`);
    }
  }
}

/** The part of an attack every heading must agree on. */
function attackShape(attack: BendAttackCue): string {
  return `${attack.id}/${attack.effectId}/${attack.releases.length}/${attack.damageRelease}`;
}

/**
 * Every heading plays the same attacks: the same ids in the same order, each
 * with the same effect, release count and damage release. Only the frames,
 * sockets and holds follow the heading's art.
 */
function validateAttacksAgree(set: BendSetDef, problems: string[]): void {
  const reference = HEADINGS[0];
  const expected = set.facings[reference]?.attacks.map(attackShape).join(', ');
  if (expected === undefined) return;
  for (const heading of HEADINGS) {
    const facing: HeadingBendDef | undefined = set.facings[heading];
    if (!facing || heading === reference) continue;
    const actual = facing.attacks.map(attackShape).join(', ');
    if (actual !== expected) {
      problems.push(
        `bend "${set.id}" ${heading}: attacks [${actual}] differ from ${reference} [${expected}]`,
      );
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
  const speed = (name: string, value: number): void => {
    if (!(value > 0 && value <= BEND_SPEED_MAX)) {
      note(`${name} ${value} must be above 0 and at most ${BEND_SPEED_MAX}`);
    }
  };
  const trajectory = effect.trajectory;
  switch (trajectory.kind) {
    case 'straight':
      speed('speedTilesPerSecond', trajectory.speedTilesPerSecond);
      break;
    case 'arc':
      speed('speedTilesPerSecond', trajectory.speedTilesPerSecond);
      if (!within(trajectory.heightTiles, 0, BEND_ARC_HEIGHT_MAX)) {
        note(`heightTiles ${trajectory.heightTiles} is outside 0..${BEND_ARC_HEIGHT_MAX}`);
      }
      if (!within(trajectory.spin, -BEND_ARC_SPIN_MAX, BEND_ARC_SPIN_MAX)) {
        note(`spin ${trajectory.spin} is outside -${BEND_ARC_SPIN_MAX}..${BEND_ARC_SPIN_MAX}`);
      }
      break;
    case 'whipBolt':
      if (!(trajectory.whipFraction > 0 && trajectory.whipFraction <= 1)) {
        note(`whipFraction ${trajectory.whipFraction} must be in (0,1]`);
      }
      if (!(trajectory.whipMaxTiles > 0 && trajectory.whipMaxTiles <= BEND_WHIP_TILES_MAX)) {
        note(
          `whipMaxTiles ${trajectory.whipMaxTiles} must be above 0 and at most ${BEND_WHIP_TILES_MAX}`,
        );
      }
      speed('boltSpeedTilesPerSecond', trajectory.boltSpeedTilesPerSecond);
      break;
  }
  if (!within(effect.impact.flash, 0, BEND_FLASH_MAX)) {
    note(`impact flash ${effect.impact.flash} is outside 0..${BEND_FLASH_MAX}`);
  }
  if (!within(effect.impact.shakeTiles, 0, BEND_SHAKE_TILES_MAX)) {
    note(`impact shakeTiles ${effect.impact.shakeTiles} is outside 0..${BEND_SHAKE_TILES_MAX}`);
  }
  effect.layers.forEach((layer, index) => {
    if (layer.frameMs.length === 0) note(`layer ${index} (${layer.phase}) has no frameMs`);
    layer.frameMs.forEach((held, cel) => {
      if (!within(held, BEND_FRAME_MS_MIN, BEND_FRAME_MS_MAX)) {
        note(
          `layer ${index} frameMs[${cel}] ${held} is outside ${BEND_FRAME_MS_MIN}..${BEND_FRAME_MS_MAX}`,
        );
      }
    });
  });
  const residueLayers = effect.layers.filter((layer) => layer.phase === 'residue');
  const residue = effect.residue;
  if (residue) {
    if (residue.gameplaySurface !== false) note(`residue gameplaySurface must be false`);
    if (!within(residue.durationMs, 0, BEND_RESIDUE_MS_MAX)) {
      note(`residue durationMs ${residue.durationMs} is outside 0..${BEND_RESIDUE_MS_MAX}`);
    }
    if (!residueLayers.some((layer) => layer.sequence === residue.sequence)) {
      note(`residue "${residue.sequence}" has no residue layer drawing it`);
    }
  } else if (residueLayers.length > 0) {
    note(`has a residue layer but no residue`);
  }
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
  for (const id of repeats(effects.map((effect) => effect.id))) {
    problems.push(`effect id "${id}" repeats`);
  }
  for (const id of repeats(sets.map((set) => set.id))) {
    problems.push(`bend id "${id}" repeats`);
  }
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
    validateAttacksAgree(set, problems);
  }
  return problems;
}
