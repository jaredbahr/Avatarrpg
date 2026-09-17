/**
 * The placeholder figure: a small rig drawn with the art bible's rules.
 *
 * Every unit without generated art is drawn from this file. A figure is a
 * build (widths and lengths), a spec (colours, hair, garment, an item) and a
 * pose (limb angles). Poses are the art bible's table, one per frame of the
 * clip vocabulary, so the choreography, the sheet baker, the health bar and
 * the mirroring are exercised by the placeholders exactly as they will be by
 * the real sheets, which replace them key by key.
 *
 * The look follows the bible where a few lines of canvas can: a uniform ink
 * outline, two flat tones per material, a rim light on the lit edge, and a
 * silhouette per character. It is meant to be readable at 40 px and honest
 * about being a stand-in, not to compete with the generated figures.
 *
 * Geometry is solved from the feet up: the lowest point of the legs stands on
 * the foot line, the hips sit above it, the torso leans from the hips and the
 * head from the shoulders. A pose is therefore just angles, and every pose
 * lands on the same baseline the sheet contract expects.
 */

import type { ClipName } from '../../content/assets/clips';
import type { Palette } from '../palettes';
import type { Box, Ctx } from './shapes';
import { circle, ellipse, groundShadow, polygon } from './shapes';

/* ------------------------------------------------------------------ */
/* Builds                                                              */
/* ------------------------------------------------------------------ */

export type BuildName = 'lean' | 'broad' | 'robed' | 'kid';

/** Proportions in tiles: the box is one tile square. */
export interface Build {
  /** Half-width at the shoulders. */
  readonly shoulder: number;
  /** Half-width at the hips. */
  readonly hip: number;
  /** Thickness of an arm or a leg. */
  readonly limb: number;
  readonly head: number;
  /** Shoulder to hip. */
  readonly torso: number;
  /** Whole-figure scale about the feet; the kid. */
  readonly scale: number;
}

export const BUILDS: Readonly<Record<BuildName, Build>> = {
  lean: { shoulder: 0.11, hip: 0.085, limb: 0.05, head: 0.08, torso: 0.24, scale: 1 },
  broad: { shoulder: 0.15, hip: 0.115, limb: 0.066, head: 0.086, torso: 0.25, scale: 1 },
  robed: { shoulder: 0.12, hip: 0.105, limb: 0.054, head: 0.08, torso: 0.24, scale: 1 },
  kid: { shoulder: 0.1, hip: 0.085, limb: 0.05, head: 0.1, torso: 0.2, scale: 0.72 },
};

/** Where the feet stand, as a fraction of the box; the painters' shared foot line. */
export const FOOT = 0.86;
const THIGH = 0.18;
const SHIN = 0.16;
const UPPER_ARM = 0.15;
const FOREARM = 0.14;
const NECK = 0.035;

/* ------------------------------------------------------------------ */
/* Poses                                                               */
/* ------------------------------------------------------------------ */

/**
 * Angles are radians from straight down, positive toward the way the figure
 * faces; a hanging arm is 0, an arm held out level is π/2, an arm raised
 * overhead is π. Both angles of a limb are absolute, so a pose reads as a
 * drawing, not as a chain.
 */
export interface Pose {
  /** Torso lean, positive forward. */
  readonly lean: number;
  /** Head tilt on top of the lean, positive chin-forward. */
  readonly head: number;
  readonly frontArm: readonly [number, number];
  readonly backArm: readonly [number, number];
  readonly frontLeg: readonly [number, number];
  readonly backLeg: readonly [number, number];
  /** The whole figure off the ground, in tiles. */
  readonly lift: number;
  /** Torso length scale: the idle breath. */
  readonly breath: number;
  /** Which hand shows the element hint. */
  readonly hint: 'none' | 'front' | 'back';
  readonly eyes: 'open' | 'shut';
}

const rest = (over: Partial<Pose> = {}): Pose => ({
  lean: 0,
  head: 0,
  frontArm: [0.22, 0.32],
  backArm: [-0.18, -0.08],
  frontLeg: [0.12, 0.02],
  backLeg: [-0.12, -0.04],
  lift: 0,
  breath: 1,
  hint: 'none',
  eyes: 'open',
  ...over,
});

/** One pose per frame of the clip table, in the art bible's words. */
export const POSES: Readonly<Record<ClipName, readonly Pose[]>> = {
  wave: [rest({ frontArm: [2.35, 2.5] }), rest({ frontArm: [2.35, 3.05] })],
  // Weight on the back foot, hands ready, eyes on screen-right; B is a breath.
  idle: [rest(), rest({ breath: 1.03, lean: -0.02 })],
  // Contact poses, opposite legs; arms counter-swing.
  walk: [
    rest({
      lean: 0.08,
      frontLeg: [0.5, 0.15],
      backLeg: [-0.4, -0.3],
      frontArm: [-0.45, -0.35],
      backArm: [0.5, 0.75],
    }),
    rest({
      lean: 0.08,
      frontLeg: [-0.4, -0.3],
      backLeg: [0.5, 0.15],
      frontArm: [0.5, 0.75],
      backArm: [-0.45, -0.35],
    }),
  ],
  cast: [
    // Wind-up: weight back, the element gathered at the rear hand.
    rest({
      lean: -0.18,
      head: 0.05,
      frontLeg: [0.4, -0.15],
      backLeg: [-0.35, 0.2],
      frontArm: [0.3, 1.2],
      backArm: [-0.8, -1.7],
      hint: 'back',
    }),
    // Release: a lunge, the leading arm extended, the element leaving the hand.
    rest({
      lean: 0.3,
      head: 0.1,
      frontLeg: [0.65, 0.2],
      backLeg: [-0.55, -0.45],
      frontArm: [1.35, 1.45],
      backArm: [-0.9, -0.5],
      hint: 'front',
    }),
    // Recover: settling, weight returning, element gone.
    rest({
      lean: 0.1,
      frontLeg: [0.3, 0.05],
      backLeg: [-0.25, -0.15],
      frontArm: [0.85, 0.7],
      backArm: [-0.35, -0.2],
    }),
  ],
  melee: [
    // Wind-up: the rear fist at the hip, the lead hand up in a guard.
    rest({
      lean: -0.12,
      frontLeg: [0.35, -0.1],
      backLeg: [-0.3, 0.15],
      frontArm: [0.8, 2.1],
      backArm: [-0.7, 0.4],
    }),
    // Strike: the lead arm driven out and down, the body turned into it.
    rest({
      lean: 0.2,
      head: 0.08,
      frontLeg: [0.6, 0.2],
      backLeg: [-0.5, -0.4],
      frontArm: [1.25, 0.85],
      backArm: [-0.6, 0.3],
    }),
  ],
  // Recoil away from the blow, eyes shut, one foot lifted.
  hit: [
    rest({
      lean: -0.35,
      head: -0.35,
      frontLeg: [0.55, 0.3],
      backLeg: [-0.15, -0.05],
      frontArm: [-0.9, -1.5],
      backArm: [-0.5, -1.2],
      eyes: 'shut',
    }),
  ],
  // On one knee, head down. Never gore.
  ko: [
    rest({
      lean: 0.5,
      head: 0.65,
      frontLeg: [1.5, 0],
      backLeg: [-0.35, -1.57],
      frontArm: [0.9, 0.3],
      backArm: [0.6, 0.2],
      eyes: 'shut',
    }),
  ],
};

/** The pose for a frame; a clip's last pose for an index past its end. */
export function poseFor(clip: ClipName, index: number): Pose {
  const poses = POSES[clip];
  return poses[Math.max(0, Math.min(index, poses.length - 1))] ?? rest();
}

/* ------------------------------------------------------------------ */
/* Joints                                                              */
/* ------------------------------------------------------------------ */

export type Vec = readonly [number, number];
/** Three joints of a limb: root, middle, end. */
export type Limb = readonly [Vec, Vec, Vec];

export interface Joints {
  readonly hip: Vec;
  readonly shoulder: Vec;
  readonly neckTop: Vec;
  readonly head: Vec;
  /** Along the shoulder line, toward the facing. */
  readonly across: Vec;
  readonly frontArm: Limb;
  readonly backArm: Limb;
  readonly frontLeg: Limb;
  readonly backLeg: Limb;
}

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
/** A step of `length` at `angle` from straight down, toward the facing. */
const step = (from: Vec, angle: number, length: number): Vec =>
  add(from, [Math.sin(angle) * length, Math.cos(angle) * length]);

function limb(root: Vec, angles: readonly [number, number], a: number, b: number): Limb {
  const middle = step(root, angles[0], a);
  return [root, middle, step(middle, angles[1], b)];
}

/**
 * Solves a pose into joints, in box units, for a figure facing +x. The feet
 * are pinned: the lowest point of either leg stands on the foot line, less
 * the pose's lift, so a crouch lowers the hips and a kneel lowers them more.
 */
export function solve(pose: Pose, build: Build): Joints {
  const frontLegRel = limb([0.02, 0], pose.frontLeg, THIGH, SHIN);
  const backLegRel = limb([-0.02, 0], pose.backLeg, THIGH, SHIN);
  let lowest = 0;
  for (const leg of [frontLegRel, backLegRel]) {
    for (const joint of leg) lowest = Math.max(lowest, joint[1]);
  }
  const hipY = FOOT - pose.lift - lowest;

  const at = (hipX: number): Joints => {
    const hip: Vec = [hipX, hipY];
    const shift = (leg: Limb): Limb => [add(leg[0], hip), add(leg[1], hip), add(leg[2], hip)];
    const up: Vec = [Math.sin(pose.lean), -Math.cos(pose.lean)];
    const across: Vec = [Math.cos(pose.lean), Math.sin(pose.lean)];
    const shoulder = add(hip, scale(up, build.torso * pose.breath));
    const neckTop = add(shoulder, scale(up, NECK));
    const tilt = pose.lean + pose.head;
    const head = add(neckTop, [Math.sin(tilt) * build.head, -Math.cos(tilt) * build.head]);
    const frontRoot = add(shoulder, scale(across, build.shoulder * 0.8));
    const backRoot = add(shoulder, scale(across, -build.shoulder * 0.8));
    return {
      hip,
      shoulder,
      neckTop,
      head,
      across,
      frontArm: limb(frontRoot, pose.frontArm, UPPER_ARM, FOREARM),
      backArm: limb(backRoot, pose.backArm, UPPER_ARM, FOREARM),
      frontLeg: shift(frontLegRel),
      backLeg: shift(backLegRel),
    };
  };

  // A lunge reaches past a one-tile box; slide the figure back just enough
  // that the hands stay inside it, so no frame is clipped at its edge.
  const centred = at(0.5);
  const reach = build.limb * 0.6 + 0.02;
  let maxX = centred.head[0] + build.head;
  let minX = centred.head[0] - build.head;
  for (const l of [centred.frontArm, centred.backArm, centred.frontLeg, centred.backLeg]) {
    for (const joint of l) {
      maxX = Math.max(maxX, joint[0] + reach);
      minX = Math.min(minX, joint[0] - reach);
    }
  }
  const slide = Math.min(0, 0.98 - maxX) + Math.max(0, 0.02 - minX);
  return slide === 0 ? centred : at(0.5 + slide);
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export type HairStyle =
  | 'crop'
  | 'ponytail'
  | 'sweptBack'
  | 'topknot'
  | 'braid'
  | 'bob'
  | 'bobKnot'
  | 'shaved'
  | 'buns'
  | 'bun'
  | 'pigtails'
  | 'bald';

export type Headwear = 'none' | 'rag' | 'hood' | 'helm' | 'crest' | 'goggles' | 'cap';
export type Item =
  'none' | 'club' | 'sling' | 'blade' | 'crossbow' | 'staff' | 'spear' | 'gauntlet';

export interface Tones {
  readonly base: string;
  readonly dark: string;
}

/** What a figure is: colours, hair, garment, what it carries. */
export interface FigureSpec {
  readonly build: BuildName;
  readonly skin: string;
  readonly hair: string;
  readonly hairStyle: HairStyle;
  readonly garment: Tones;
  /** How far the garment falls below the hips, in tiles: 0 a vest, 0.26 a robe. */
  readonly hem: number;
  /** Sleeve colour when it is not the garment's: a shirt under a vest, or skin. */
  readonly sleeves?: string;
  /** A stripe down the front: an open jacket over a shirt. */
  readonly undershirt?: string;
  readonly trousers: Tones;
  readonly shoes: string;
  readonly sash: { readonly color: string; readonly tails: boolean } | null;
  readonly collar: 'dark' | 'fur' | 'none';
  readonly cape?: string;
  readonly apron?: string;
  readonly item: Item;
  readonly waterskin?: boolean;
  readonly headwear: Headwear;
  readonly pauldrons?: boolean;
  readonly kneeGuards?: string;
  /** Extra forward lean in every pose: the elder's stoop. */
  readonly stoop?: number;
  /** Whether cast poses show the element at the hand. */
  readonly hint: boolean;
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const INK_WIDTH = 0.022;
const CLUB = '#6b4f33';
const CLUB_DARK = '#4a3522';
const STEEL = '#d5d2cb';
const STEEL_DARK = '#8f8b83';
const IRON = '#5a5753';
const BRASS = '#b8873a';
const BRASS_DARK = '#7a5a26';
const CELL = '#8fe3ff';
const FUR = '#efe6d4';
const RAG = '#a34a2e';

/**
 * How much a figure grows about its feet when the frame has `headroom` tiles
 * above the box: a standing figure is 0.8 of a tile in its box, and the real
 * sheets stand about 1.1 tiles tall, so the placeholder is scaled to match
 * without ever reaching the frame's top.
 */
export function figureScale(headroom: number): number {
  if (headroom <= 0) return 1;
  return Math.min(1.35, (FOOT + headroom - 0.06) / FOOT);
}

export function drawFigure(
  ctx: Ctx,
  box: Box,
  spec: FigureSpec,
  pose: Pose,
  palette: Palette,
  facing: 1 | -1 = 1,
  headroom = 0,
): void {
  const build = BUILDS[spec.build];
  const posed = spec.stoop ? { ...pose, lean: pose.lean + spec.stoop } : pose;
  const j = solve(posed, build);
  const s = box.size;
  const px = (v: Vec): [number, number] => [box.x + v[0] * s, box.y + v[1] * s];
  const ink = palette.ink;
  const inkW = Math.max(1, s * INK_WIDTH);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (facing < 0) {
    ctx.translate(box.x * 2 + s, 0);
    ctx.scale(-1, 1);
  }
  const grow = build.scale * figureScale(headroom);
  if (grow !== 1) {
    const [fx, fy] = px([0.5, FOOT]);
    ctx.translate(fx, fy);
    ctx.scale(grow, grow);
    ctx.translate(-fx, -fy);
  }

  /* -- helpers ------------------------------------------------------- */

  /** A limb segment: ink underneath, the base tone, a dark tone on the back side. */
  const segment = (a: Vec, b: Vec, width: number, tones: Tones): void => {
    const w = width * s;
    const [ax, ay] = px(a);
    const [bx, by] = px(b);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineWidth = w + inkW * 2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineWidth = w;
    ctx.strokeStyle = tones.base;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.beginPath();
    ctx.moveTo(ax - w * 0.3, ay);
    ctx.lineTo(bx - w * 0.3, by);
    ctx.lineWidth = w * 0.5;
    ctx.strokeStyle = tones.dark;
    ctx.stroke();
    ctx.restore();
  };

  const fillInk = (fill: string): void => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = inkW;
    ctx.strokeStyle = ink;
    ctx.stroke();
  };

  const hand = (at: Vec, radius: number, fill: string): void => {
    const [hx, hy] = px(at);
    circle(ctx, hx, hy, radius * s);
    fillInk(fill);
  };

  const foot = (leg: Limb, shin: readonly [number, number]): void => {
    const ankle = leg[2];
    // The foot points the way the shin leans, and forward at rest.
    const lean = Math.max(-0.4, Math.min(0.4, shin[1]));
    const [fx, fy] = px([ankle[0] + 0.03 + lean * 0.03, ankle[1] + 0.008]);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(lean * 0.6);
    ellipse(ctx, 0, 0, s * (0.055 + build.limb * 0.2), s * 0.024);
    fillInk(spec.shoes);
    ctx.restore();
  };

  const legTones: Tones = spec.trousers;
  const armTones: Tones = spec.sleeves
    ? { base: spec.sleeves, dark: shade(spec.sleeves) }
    : spec.garment;

  const arm = (l: Limb, front: boolean): void => {
    segment(l[0], l[1], build.limb, armTones);
    segment(l[1], l[2], build.limb * 0.92, armTones);
    if (spec.item === 'gauntlet' && front) {
      segment(l[1], l[2], build.limb * 1.25, { base: IRON, dark: '#3b3936' });
      hand(l[2], build.limb * 0.95, BRASS);
      const [cx, cy] = px(l[2]);
      circle(ctx, cx, cy, build.limb * 0.3 * s);
      ctx.fillStyle = CELL;
      ctx.fill();
    } else {
      hand(l[2], build.limb * 0.6, spec.skin);
    }
  };

  const leg = (l: Limb, angles: readonly [number, number]): void => {
    segment(l[0], l[1], build.limb * 1.1, legTones);
    segment(l[1], l[2], build.limb, legTones);
    if (spec.kneeGuards) {
      const [kx, ky] = px(l[1]);
      circle(ctx, kx, ky, build.limb * 0.55 * s);
      fillInk(spec.kneeGuards);
    }
    foot(l, angles);
  };

  /* -- ground -------------------------------------------------------- */

  const kneeling = pose.backLeg[1] < -1.2;
  groundShadow(ctx, box, build.shoulder * 2 + (kneeling ? 0.24 : 0.14));

  /* -- limbs behind the torso ---------------------------------------- */

  leg(j.backLeg, posed.backLeg);
  leg(j.frontLeg, posed.frontLeg);
  arm(j.backArm, false);
  if (spec.item !== 'none' && spec.item !== 'gauntlet') item(ctx, px, s, inkW, ink, spec, j, false);

  /* -- cape ----------------------------------------------------------- */

  if (spec.cape) {
    const a = j.across;
    const back = add(j.shoulder, scale(a, -build.shoulder * 1.05));
    const front = add(j.shoulder, scale(a, build.shoulder * 0.4));
    const tail = add(add(j.hip, scale(a, -build.hip * 2.4)), [0, 0.02]);
    const low = add(j.hip, scale(a, -build.hip * 0.6));
    polygon(ctx, [px(front), px(back), px(tail), px(low)]);
    fillInk(spec.cape);
  }

  /* -- torso ---------------------------------------------------------- */

  const a = j.across;
  const sl = add(j.shoulder, scale(a, -build.shoulder));
  const sr = add(j.shoulder, scale(a, build.shoulder));
  const hl = add(j.hip, scale(a, -build.hip * 1.05));
  const hr = add(j.hip, scale(a, build.hip * 1.05));
  polygon(ctx, [px(sl), px(sr), px(hr), px(hl)]);
  fillInk(spec.garment.base);
  // The dark tone on the back half, the rim light on the front edge.
  ctx.save();
  polygon(ctx, [px(sl), px(sr), px(hr), px(hl)]);
  ctx.clip();
  polygon(ctx, [
    px(sl),
    px(add(j.shoulder, scale(a, -build.shoulder * 0.3))),
    px(add(j.hip, scale(a, -build.hip * 0.25))),
    px(hl),
  ]);
  ctx.fillStyle = spec.garment.dark;
  ctx.fill();
  if (spec.undershirt) {
    polygon(ctx, [
      px(add(j.shoulder, scale(a, build.shoulder * 0.05))),
      px(add(j.shoulder, scale(a, build.shoulder * 0.45))),
      px(add(j.hip, scale(a, build.hip * 0.35))),
      px(add(j.hip, scale(a, -build.hip * 0.05))),
    ]);
    ctx.fillStyle = spec.undershirt;
    ctx.fill();
  }
  ctx.restore();
  rim(ctx, px(sr), px(hr), palette.light, inkW);

  /* -- hem: the garment below the hips ------------------------------- */

  if (spec.hem > 0) {
    const hemHalf = build.hip * 1.05 + spec.hem * 0.45;
    const hemY = j.hip[1] + spec.hem;
    polygon(ctx, [
      px(hl),
      px(hr),
      px([j.hip[0] + hemHalf + posed.lean * 0.04, hemY]),
      px([j.hip[0] - hemHalf + posed.lean * 0.04, hemY]),
    ]);
    fillInk(spec.garment.base);
    ctx.save();
    polygon(ctx, [
      px(hl),
      px(hr),
      px([j.hip[0] + hemHalf + posed.lean * 0.04, hemY]),
      px([j.hip[0] - hemHalf + posed.lean * 0.04, hemY]),
    ]);
    ctx.clip();
    polygon(ctx, [
      px(hl),
      px(add(j.hip, scale(a, -build.hip * 0.25))),
      px([j.hip[0] - hemHalf * 0.2, hemY]),
      px([j.hip[0] - hemHalf, hemY]),
    ]);
    ctx.fillStyle = spec.garment.dark;
    ctx.fill();
    ctx.restore();
  }

  if (spec.apron) {
    const top = add(j.hip, [0, -0.06]);
    const bottom = j.hip[1] + Math.max(0.1, spec.hem * 0.9);
    polygon(ctx, [
      px(add(top, scale(a, -build.hip * 0.7))),
      px(add(top, scale(a, build.hip * 0.7))),
      px([j.hip[0] + build.hip * 0.8, bottom]),
      px([j.hip[0] - build.hip * 0.8, bottom]),
    ]);
    fillInk(spec.apron);
  }

  /* -- sash ----------------------------------------------------------- */

  if (spec.sash) {
    const top = add(j.hip, [0, -0.028]);
    const bottom = add(j.hip, [0, 0.03]);
    polygon(ctx, [
      px(add(top, scale(a, -build.hip * 1.1))),
      px(add(top, scale(a, build.hip * 1.1))),
      px(add(bottom, scale(a, build.hip * 1.12))),
      px(add(bottom, scale(a, -build.hip * 1.12))),
    ]);
    fillInk(spec.sash.color);
    if (spec.sash.tails) {
      const knot = add(j.hip, scale(a, -build.hip * 1.05));
      polygon(ctx, [
        px(knot),
        px(add(knot, [-0.03, 0.02])),
        px(add(knot, [-0.05 - posed.lean * 0.06, 0.14])),
        px(add(knot, [-0.005, 0.12])),
      ]);
      fillInk(spec.sash.color);
    }
  }

  if (spec.waterskin) {
    const at = add(add(j.hip, scale(a, -build.hip * 1.1)), [0, 0.07]);
    const [wx, wy] = px(at);
    ellipse(ctx, wx, wy, s * 0.034, s * 0.046);
    fillInk('#5f7f8f');
    circle(ctx, wx, wy - s * 0.05, s * 0.012);
    fillInk(CLUB);
  }

  /* -- collar --------------------------------------------------------- */

  if (spec.collar === 'fur') {
    const [cx, cy] = px(j.shoulder);
    ellipse(ctx, cx, cy - s * 0.005, build.shoulder * 1.15 * s, s * 0.04);
    fillInk(FUR);
  } else if (spec.collar === 'dark') {
    const [cx, cy] = px(j.shoulder);
    ellipse(ctx, cx, cy, build.shoulder * 0.42 * s, s * 0.022);
    ctx.fillStyle = spec.garment.dark;
    ctx.fill();
  }

  /* -- front arm and what it holds ----------------------------------- */

  arm(j.frontArm, true);
  if (spec.item !== 'none' && spec.item !== 'gauntlet') item(ctx, px, s, inkW, ink, spec, j, true);

  if (spec.pauldrons) {
    for (const side of [-1, 1] as const) {
      const [sx, sy] = px(add(j.shoulder, scale(a, side * build.shoulder * 0.95)));
      ellipse(ctx, sx, sy, s * 0.06, s * 0.038);
      fillInk(side > 0 ? IRON : '#3b3936');
    }
  }

  /* -- neck and head -------------------------------------------------- */

  segment(add(j.shoulder, [0, 0.01]), j.neckTop, build.limb * 0.9, {
    base: spec.skin,
    dark: shade(spec.skin),
  });
  head(ctx, px, s, inkW, ink, spec, j, build, posed);

  /* -- the element hint ------------------------------------------------ */

  if (spec.hint && posed.hint !== 'none') {
    const at = posed.hint === 'front' ? j.frontArm[2] : j.backArm[2];
    const [hx, hy] = px(at);
    ctx.save();
    ctx.globalAlpha = 0.55;
    circle(ctx, hx, hy, s * 0.085);
    ctx.fillStyle = palette.light;
    ctx.fill();
    ctx.restore();
    circle(ctx, hx, hy, s * 0.045);
    ctx.fillStyle = palette.accent;
    ctx.fill();
  }

  ctx.restore();
}

/** A darker copy of a hex colour for the second tone of a material. */
export function shade(hex: string, amount = 0.32): string {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function rim(ctx: Ctx, from: [number, number], to: [number, number], color: string, inkW: number) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(from[0] - inkW * 0.9, from[1] + inkW);
  ctx.lineTo(to[0] - inkW * 0.9, to[1] - inkW);
  ctx.lineWidth = Math.max(1, inkW * 0.7);
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

type ToPx = (v: Vec) => [number, number];

/**
 * What the front hand holds, drawn along the forearm so a swing carries it.
 * Planted things (a staff, a spear) stand up from the ground through the hand.
 */
function item(
  ctx: Ctx,
  px: ToPx,
  s: number,
  inkW: number,
  ink: string,
  spec: FigureSpec,
  j: Joints,
  frontPass: boolean,
): void {
  // Held things draw with the front arm; planted things behind the body.
  const planted = spec.item === 'staff' || spec.item === 'spear';
  if (planted === frontPass) return;
  const elbow = j.frontArm[1];
  const handAt = j.frontArm[2];
  const dx = handAt[0] - elbow[0];
  const dy = handAt[1] - elbow[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const [hx, hy] = px(handAt);
  const bar = (back: number, forward: number, width: number, fill: string, dark: string) => {
    ctx.beginPath();
    ctx.moveTo(hx - ux * back * s, hy - uy * back * s);
    ctx.lineTo(hx + ux * forward * s, hy + uy * forward * s);
    ctx.lineWidth = width * s + inkW * 2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.lineWidth = width * s;
    ctx.strokeStyle = fill;
    ctx.stroke();
    ctx.lineWidth = width * s * 0.4;
    ctx.strokeStyle = dark;
    ctx.beginPath();
    ctx.moveTo(hx - ux * back * s - width * s * 0.25, hy - uy * back * s);
    ctx.lineTo(hx + ux * forward * s - width * s * 0.25, hy + uy * forward * s);
    ctx.stroke();
  };
  switch (spec.item) {
    case 'club':
      bar(0.05, 0.2, 0.055, CLUB, CLUB_DARK);
      break;
    case 'blade': {
      ctx.beginPath();
      const tip: [number, number] = [hx + ux * 0.26 * s, hy + uy * 0.26 * s];
      const nx = -uy;
      const ny = ux;
      ctx.moveTo(hx - nx * 0.02 * s, hy - ny * 0.02 * s);
      ctx.lineTo(hx + nx * 0.02 * s, hy + ny * 0.02 * s);
      ctx.lineTo(tip[0], tip[1]);
      ctx.closePath();
      ctx.fillStyle = STEEL;
      ctx.fill();
      ctx.lineWidth = inkW;
      ctx.strokeStyle = STEEL_DARK;
      ctx.stroke();
      // The hilt across the hand.
      ctx.beginPath();
      ctx.moveTo(hx - nx * 0.045 * s, hy - ny * 0.045 * s);
      ctx.lineTo(hx + nx * 0.045 * s, hy + ny * 0.045 * s);
      ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }
    case 'crossbow': {
      bar(0.04, 0.22, 0.035, CLUB, CLUB_DARK);
      const nx = -uy;
      const ny = ux;
      const ax = hx + ux * 0.14 * s;
      const ay = hy + uy * 0.14 * s;
      ctx.beginPath();
      ctx.moveTo(ax - nx * 0.11 * s, ay - ny * 0.11 * s);
      ctx.quadraticCurveTo(
        ax + ux * 0.05 * s,
        ay + uy * 0.05 * s,
        ax + nx * 0.11 * s,
        ay + ny * 0.11 * s,
      );
      ctx.lineWidth = Math.max(1, s * 0.022);
      ctx.strokeStyle = STEEL_DARK;
      ctx.stroke();
      break;
    }
    case 'sling': {
      ctx.beginPath();
      ctx.arc(hx + 0.02 * s, hy + 0.06 * s, s * 0.075, -Math.PI * 0.9, Math.PI * 0.6);
      ctx.lineWidth = Math.max(1, s * 0.016);
      ctx.strokeStyle = '#d8c9a8';
      ctx.stroke();
      circle(ctx, hx + 0.075 * s, hy + 0.1 * s, s * 0.03);
      ctx.fillStyle = '#9a958d';
      ctx.fill();
      ctx.lineWidth = inkW;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }
    case 'staff':
    case 'spear': {
      // Planted beside the front hand, from the ground to head height.
      const [gx, gy] = px([handAt[0] + 0.02, FOOT]);
      const top = spec.item === 'spear' ? 0.02 : 0.1;
      const [tx, ty] = px([handAt[0] + 0.02, top]);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(tx, ty);
      ctx.lineWidth = s * 0.028 + inkW * 2;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.lineWidth = s * 0.028;
      ctx.strokeStyle = CLUB;
      ctx.stroke();
      if (spec.item === 'spear') {
        polygon(ctx, [
          [tx - s * 0.025, ty + s * 0.09],
          [tx + s * 0.025, ty + s * 0.09],
          [tx, ty],
        ]);
        ctx.fillStyle = STEEL;
        ctx.fill();
        ctx.lineWidth = inkW;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }
      break;
    }
    default:
      break;
  }
}

/** Hair behind the head, the face, the hair on the crown, then the eyes and headwear. */
function head(
  ctx: Ctx,
  px: ToPx,
  s: number,
  inkW: number,
  ink: string,
  spec: FigureSpec,
  j: Joints,
  build: Build,
  pose: Pose,
): void {
  const r = build.head * s;
  const [cx, cy] = px(j.head);
  const fillInk = (fill: string): void => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = inkW;
    ctx.strokeStyle = ink;
    ctx.stroke();
  };
  const hairColor = spec.hair;
  const style = spec.hairStyle;

  // Behind the head: a bob's fall, a ponytail, a braid, a bun.
  if (style === 'bob' || style === 'bobKnot') {
    circle(ctx, cx - r * 0.25, cy + r * 0.2, r * 1.02);
    fillInk(hairColor);
  } else if (style === 'ponytail') {
    polygon(ctx, [
      [cx - r * 0.2, cy - r * 0.9],
      [cx - r * 1.5, cy - r * 1.4],
      [cx - r * 2.3, cy + r * 0.1],
      [cx - r * 1.2, cy + r * 0.2],
    ]);
    fillInk(hairColor);
  } else if (style === 'braid') {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy - r * 0.2);
    ctx.quadraticCurveTo(cx - r * 1.6, cy + r * 1.2, cx - r * 1.1, cy + r * 3.1);
    ctx.lineWidth = r * 0.42 + inkW * 2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.lineWidth = r * 0.42;
    ctx.strokeStyle = hairColor;
    ctx.stroke();
    circle(ctx, cx - r * 1.1, cy + r * 3.1, r * 0.16);
    fillInk('#7ec8e3');
  } else if (style === 'bun') {
    circle(ctx, cx - r * 0.85, cy - r * 0.1, r * 0.42);
    fillInk(hairColor);
  } else if (style === 'pigtails') {
    for (const side of [-1, 1]) {
      circle(ctx, cx + side * r * 0.95, cy + r * 0.3, r * 0.3);
      fillInk(hairColor);
    }
  }

  // The face.
  circle(ctx, cx, cy, r);
  fillInk(spec.skin);

  // The crown: a crescent of hair clipped to the head, so the hairline is a real line.
  if (style !== 'bald') {
    ctx.save();
    circle(ctx, cx, cy, r);
    ctx.clip();
    const crown = style === 'shaved' ? [-0.1, -0.72, 0.86] : [-0.35, -0.45, 1.0];
    const [ox, oy, k] = crown as [number, number, number];
    circle(ctx, cx + r * ox, cy + r * oy, r * k);
    fillInk(hairColor);
    ctx.restore();
  }

  if (style === 'topknot' || style === 'bobKnot') {
    circle(ctx, cx - r * 0.2, cy - r * 1.3, r * 0.32);
    fillInk(hairColor);
  } else if (style === 'buns') {
    for (const side of [-1, 1]) {
      circle(ctx, cx + side * r * 0.55, cy - r * 1.1, r * 0.4);
      fillInk(hairColor);
    }
  } else if (style === 'sweptBack') {
    ellipse(ctx, cx - r * 0.75, cy - r * 0.45, r * 0.75, r * 0.5);
    fillInk(hairColor);
  }

  // Eyes: the near one forward, the far one nearer the centre; shut is a dash.
  const ey = cy + r * (pose.head * 0.3 - 0.05);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, r * 0.13);
  for (const [ex, er] of [
    [cx + r * 0.45, r * 0.1],
    [cx + r * 0.08, r * 0.085],
  ] as const) {
    if (pose.eyes === 'shut') {
      ctx.beginPath();
      ctx.moveTo(ex - er, ey);
      ctx.lineTo(ex + er, ey);
      ctx.stroke();
    } else {
      circle(ctx, ex, ey, er);
      ctx.fill();
    }
  }

  // Headwear over everything.
  switch (spec.headwear) {
    case 'rag': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.02, cy - r * 0.42);
      ctx.lineTo(cx + r * 1.02, cy - r * 0.42);
      ctx.lineWidth = Math.max(1.5, r * 0.32);
      ctx.strokeStyle = RAG;
      ctx.stroke();
      break;
    }
    case 'hood': {
      polygon(ctx, [
        [cx - r * 1.35, cy + r * 0.25],
        [cx - r * 0.15, cy - r * 1.75],
        [cx + r * 1.1, cy - r * 0.1],
        [cx + r * 0.75, cy + r * 0.45],
      ]);
      fillInk(spec.garment.dark);
      break;
    }
    case 'helm':
    case 'crest': {
      ctx.save();
      circle(ctx, cx, cy, r * 1.12);
      ctx.clip();
      circle(ctx, cx - r * 0.15, cy - r * 0.55, r * 1.05);
      fillInk(IRON);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.05, cy - r * 0.25);
      ctx.lineTo(cx + r * 1.05, cy - r * 0.25);
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.strokeStyle = ink;
      ctx.stroke();
      if (spec.headwear === 'crest') {
        polygon(ctx, [
          [cx - r * 0.55, cy - r * 1.05],
          [cx + r * 0.35, cy - r * 1.05],
          [cx - r * 0.1, cy - r * 1.75],
        ]);
        fillInk('#d1462f');
      }
      break;
    }
    case 'goggles': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.95, cy - r * 0.62);
      ctx.lineTo(cx + r * 0.95, cy - r * 0.62);
      ctx.lineWidth = Math.max(1, r * 0.18);
      ctx.strokeStyle = CLUB_DARK;
      ctx.stroke();
      for (const gx of [cx + r * 0.05, cx + r * 0.55]) {
        circle(ctx, gx, cy - r * 0.68, r * 0.22);
        fillInk(BRASS_DARK);
      }
      break;
    }
    case 'cap': {
      ctx.save();
      circle(ctx, cx, cy, r * 1.08);
      ctx.clip();
      circle(ctx, cx - r * 0.2, cy - r * 0.62, r * 0.95);
      fillInk(spec.garment.dark);
      ctx.restore();
      break;
    }
    default:
      break;
  }
}
