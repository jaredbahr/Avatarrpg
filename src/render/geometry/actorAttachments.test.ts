import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Grid } from '../../core/types';
import type { ActorAttachment, EmitterInstance } from '../view';
import { Camera } from '../camera';
import { projectGround } from '../projection';
import { BUILDS, FOOT, figureScale, poseFor, solve } from '../painters/figure';
import { sheets } from '../sheets/store';
import type { ResolvedFrame } from '../sheets/store';
import { attachmentPoint, resolveActorEmitters, socketOffset } from './actorAttachments';
import { resolveFx } from '../../content/fx';

const frame = {
  frame: { x: 0, y: 0, w: 128, h: 192 },
  anchor: { x: 0.5, y: 0.85 },
  pixelsPerTile: 128,
  placeholder: false,
};
const actor: ActorAttachment = {
  pos: { x: 9, y: 4 },
  sprite: 'unit.fire.kaya',
  size: 1,
  socket: 'fire-release',
  facing: 1,
  scale: 1.25,
  offset: { x: 0.1, y: -0.04 },
};

const flatGrid = (): Grid => ({
  width: 20,
  height: 12,
  tiles: Array.from({ length: 240 }, () => ({
    terrain: 'grass',
    elevation: 0,
    blocked: false,
    blocksSight: false,
    cover: false,
    surface: null,
  })),
});

afterEach(() => vi.restoreAllMocks());

describe('actor attachment geometry', () => {
  it('lands on measured Kaya and Tenzo palms through the actual upright camera geometry', () => {
    for (const projection of ['orthographic', 'oblique'] as const) {
      const camera = new Camera(
        { width: 1200, height: 800, dpr: 2 },
        { width: 20, height: 12 },
        projection,
      );
      camera.scale = 1.5;
      camera.offsetX = 213;
      camera.offsetY = 97;
      for (const [sprite, gatherX, releaseX] of [
        ['unit.fire.kaya', 59, 99],
        ['unit.fire.tenzo', 90, 109],
      ] as const) {
        for (const [socket, x, y] of [
          ['fire-gather', gatherX, 91],
          ['fire-release', releaseX, 77],
        ] as const) {
          for (const facing of [-1, 1] as const) {
            for (const scale of [0.93, 1.25, 1.35]) {
              const a = { ...actor, sprite, socket, facing, scale };
              const actual = camera.project(attachmentPoint(a, projection, 2, frame));
              const box = camera.spriteBox(a.pos, a.size);
              const footX = box.x + box.size / 2 + a.offset.x * box.size;
              const footY = box.y + 0.85 * box.size + (a.offset.y - 0.12) * box.size;
              expect(actual.x).toBeCloseTo(footX + ((x - 64) / 128) * box.size * facing * scale, 8);
              expect(actual.y).toBeCloseTo(footY + ((y - 0.85 * 192) / 128) * box.size * scale, 8);
            }
          }
        }
      }
    }
  });

  it('raises an oblique socket vertically without an unintended horizontal shift', () => {
    const low = projectGround(attachmentPoint(actor, 'oblique', 0, frame), 'oblique');
    const high = projectGround(attachmentPoint(actor, 'oblique', 3, frame), 'oblique');
    expect(high.x).toBeCloseTo(low.x, 9);
    expect(high.y - low.y).toBeCloseTo(-0.18, 9);
  });

  it('uses the baked figure rig and its growth instead of bitmap pixel sockets', () => {
    const placeholder = { ...frame, placeholder: true };
    for (const [sprite, buildName] of [
      ['unit.fire.kaya', 'lean'],
      ['unit.fire.tenzo', 'broad'],
    ] as const) {
      for (const [socket, index] of [
        ['fire-gather', 0],
        ['fire-release', 1],
      ] as const) {
        const build = BUILDS[buildName];
        const joints = solve(poseFor('cast', index), build);
        const palm = index === 0 ? joints.backArm[2] : joints.frontArm[2];
        const growth = figureScale((0.85 * 192) / 128 - FOOT) * build.scale;
        const offset = socketOffset({ ...actor, sprite, socket }, placeholder);
        expect(offset.x).toBeCloseTo((palm[0] - 0.5) * growth, 9);
        expect(offset.y).toBeCloseTo((palm[1] - FOOT) * growth, 9);
        expect(offset).not.toEqual(socketOffset({ ...actor, sprite, socket }, frame));
        expect(Number.isFinite(socketOffset({ ...actor, sprite, socket }).y)).toBe(true);
      }
    }
  });

  it('keeps ground effects identical and translates both ends of torso impacts equally', () => {
    vi.spyOn(sheets, 'frame').mockReturnValue(frame as ResolvedFrame);
    const def = resolveFx('fx.fire.jab').impact[0];
    if (!def) throw new Error('Missing impact fixture');
    const ground: EmitterInstance = {
      def,
      from: { x: 13.5, y: 5.5 },
      to: { x: 14.5, y: 5.5 },
      elapsed: 20,
      seed: 1,
      palette: 'fire',
      arc: 0,
    };
    const torso: ActorAttachment = {
      ...actor,
      pos: { x: 13, y: 5 },
      size: 2,
      socket: 'torso',
      scale: 1,
      offset: { x: 0, y: 0 },
    };
    const impact = { ...ground, attachments: { from: torso, translateTogether: true } };
    const grid = flatGrid();
    const resolved = resolveActorEmitters([ground, impact], grid, 'oblique', 96);
    expect(resolved[0]).toBe(ground);
    const hit = resolved[1]!;
    expect(hit.from).toEqual(attachmentPoint(torso, 'oblique', 0, frame));
    expect(hit.to.x - hit.from.x).toBeCloseTo(1, 9);
    expect(hit.to.y - hit.from.y).toBeCloseTo(0, 9);
    expect(impact.from).toEqual({ x: 13.5, y: 5.5 });
    expect(sheets.frame).toHaveBeenCalledWith(torso.sprite, 'idle', 0, 0, 96, 2);
  });

  it('freezes the first-presented launch despite later atlas arrival or zoom bucket changes', () => {
    const lookup = vi
      .spyOn(sheets, 'frame')
      .mockReturnValue({ ...frame, placeholder: true } as ResolvedFrame);
    const def = resolveFx('fx.fire.jab').impact[0];
    if (!def) throw new Error('Missing effect');
    const source = { ...actor, pos: { ...actor.pos }, offset: { ...actor.offset } };
    const emitter: EmitterInstance = {
      def,
      from: { x: 9.5, y: 4.5 },
      to: { x: 13.5, y: 5.5 },
      elapsed: 0,
      seed: 2,
      palette: 'fire',
      arc: 0,
      attachments: { from: source },
    };
    const grid = flatGrid();
    const first = resolveActorEmitters([emitter], grid, 'oblique', 64)[0];
    lookup.mockReturnValue(frame as ResolvedFrame);
    const later = resolveActorEmitters([{ ...emitter, elapsed: 120 }], grid, 'oblique', 144)[0];
    expect(later?.from).toEqual(first?.from);
    expect(later?.to).toEqual(first?.to);
    expect(lookup).toHaveBeenCalledTimes(1);
    // A genuinely new cast can use the now-loaded atlas; it does not inherit
    // another track's fallback socket cache.
    const next = resolveActorEmitters(
      [{ ...emitter, attachments: { from: { ...source } } }],
      grid,
      'oblique',
      144,
    )[0];
    expect(next?.from).not.toEqual(first?.from);
  });
});
