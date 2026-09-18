import type { Grid, Vec2 } from '../../core/types';
import type { ActorAttachment, EmitterInstance } from '../view';
import { projectGround, unprojectGround } from '../projection';
import type { Projection } from '../projection';
import { FOOT_LINE } from '../sheets/bake';
import { sheets } from '../sheets/store';
import type { ResolvedFrame } from '../sheets/store';
import { BUILDS, FOOT, figureScale, poseFor, solve } from '../painters/figure';
import { elevationAt, ELEVATION_LIFT } from './elevation';

type FrameGeometry = Pick<ResolvedFrame, 'frame' | 'anchor' | 'pixelsPerTile' | 'placeholder'>;

// Track-owned keys disappear with playback. Loading a sheet or changing zoom
// during flight must not move an already presented endpoint.
const presented = new WeakMap<ActorAttachment, { projection: Projection; point: Vec2 }>();

/** Measured palm centres in the existing 128x192 cast cels, facing right. */
const CAST_HANDS: Readonly<Record<string, readonly [Vec2, Vec2]>> = {
  'unit.earth.bo': [
    { x: 86, y: 86 },
    { x: 105, y: 78 },
  ],
  'unit.earth.linmei': [
    { x: 40, y: 86 },
    { x: 100, y: 83 },
  ],
  'unit.water.nilak': [
    { x: 95, y: 77 },
    { x: 105, y: 77 },
  ],
  'unit.water.sura': [
    { x: 96, y: 82 },
    { x: 107, y: 72 },
  ],
  'unit.air.nima': [
    { x: 94, y: 89 },
    { x: 106, y: 78 },
  ],
  'unit.air.jinu': [
    { x: 95, y: 89 },
    { x: 102, y: 86 },
  ],
  'unit.fire.kaya': [
    { x: 59, y: 91 },
    { x: 99, y: 77 },
  ],
  'unit.fire.tenzo': [
    { x: 90, y: 91 },
    { x: 109, y: 77 },
  ],
};

/** Upright offset from the foot anchor, in unscaled tile units. */
export function socketOffset(actor: ActorAttachment, frame?: FrameGeometry): Vec2 {
  if (actor.socket === 'ground') return { x: 0, y: 0 };
  const hand = actor.socket !== 'torso';
  const index = actor.socket === 'cast-release' ? 1 : 0;
  const point =
    actor.socket === 'waterskin' ? { x: 53, y: 100 } : CAST_HANDS[actor.sprite]?.[index];
  if (hand && point && frame && !frame.placeholder) {
    return {
      x: (point.x - frame.anchor.x * frame.frame.w) / frame.pixelsPerTile,
      y: (point.y - frame.anchor.y * frame.frame.h) / frame.pixelsPerTile,
    };
  }
  if (hand) {
    // Painter fallback uses its actual rig, including the baker's growth.
    const buildName =
      actor.sprite === 'unit.fire.tenzo' || actor.sprite === 'unit.earth.bo'
        ? 'broad'
        : actor.sprite === 'unit.water.nilak' || actor.sprite === 'unit.air.jinu'
          ? 'robed'
          : 'lean';
    const build = BUILDS[buildName];
    const joints = solve(poseFor('cast', index), build);
    const palm =
      actor.socket === 'waterskin'
        ? [
            joints.hip[0] - joints.across[0] * build.hip * 1.1,
            joints.hip[1] - joints.across[1] * build.hip * 1.1 + 0.02,
          ]
        : index === 0
          ? joints.backArm[2]
          : joints.frontArm[2];
    const headroom = frame ? (frame.anchor.y * frame.frame.h) / frame.pixelsPerTile - FOOT : 0;
    const growth = build.scale * figureScale(headroom);
    return { x: ((palm[0] ?? 0.5) - 0.5) * growth, y: ((palm[1] ?? FOOT) - FOOT) * growth };
  }
  // Torso is relative to the whole actor frame, including a two-cell boss;
  // selecting either occupied cell therefore lands on the same body.
  return frame && !frame.placeholder
    ? { x: 0, y: ((0.53 - frame.anchor.y) * frame.frame.h) / frame.pixelsPerTile }
    : { x: 0, y: -0.43 };
}

export function attachmentPoint(
  actor: ActorAttachment,
  projection: Projection,
  elevation: number,
  frame?: FrameGeometry,
): Vec2 {
  const ground = projectGround(
    { x: actor.pos.x + actor.size / 2, y: actor.pos.y + 0.5 },
    projection,
  );
  const socket = socketOffset(actor, frame);
  // Orthographic sprites have a foot line below their cell centre. Oblique
  // sprites stand at it (Camera.spriteBox uses 0.86, and the sheet uses 0.85).
  const foot = projection === 'oblique' ? FOOT_LINE - 0.86 : FOOT_LINE - 0.5;
  return unprojectGround(
    {
      x: ground.x + actor.offset.x + socket.x * actor.facing * actor.scale,
      y: ground.y + foot + actor.offset.y - elevation * ELEVATION_LIFT + socket.y * actor.scale,
    },
    projection,
  );
}

/** Resolve into the existing ground-space FX pipeline using the inverse projection. */
export function resolveActorEmitters(
  emitters: readonly EmitterInstance[],
  grid: Grid,
  projection: Projection,
  pixelsPerTile: number,
): readonly EmitterInstance[] {
  const point = (actor: ActorAttachment) => {
    const existing = presented.get(actor);
    if (existing?.projection === projection) return existing.point;
    const clip = actor.socket === 'torso' ? 'idle' : 'cast';
    const frame = sheets.frame(
      actor.sprite,
      clip,
      0,
      actor.socket === 'cast-release' ? 1 : 0,
      pixelsPerTile * actor.scale,
      actor.size,
    );
    const resolved = attachmentPoint(
      actor,
      projection,
      elevationAt(grid, actor.pos),
      frame ?? undefined,
    );
    presented.set(actor, { projection, point: resolved });
    return resolved;
  };
  return emitters.map((emitter) => {
    const attachments = emitter.attachments;
    if (!attachments) return emitter;
    const from = attachments.from ? point(attachments.from) : emitter.from;
    const to = attachments.translateTogether
      ? { x: emitter.to.x + from.x - emitter.from.x, y: emitter.to.y + from.y - emitter.from.y }
      : attachments.to
        ? point(attachments.to)
        : emitter.to;
    return { ...emitter, from, to };
  });
}
