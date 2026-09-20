import type { SceneScenery } from '../../core/types';

type ExteriorRimSource = SceneScenery & {
  readonly sourceRect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

/**
 * Reviewed source metadata for the rear-only pieces used by the integrated
 * Cutting and Driller Floor MapScene definitions.
 */
export const CUTTING_EXTERIOR_RIM = [
  {
    id: 'cutting-rear-rim',
    url: 'art/maps/cutting-scene/exterior-rim.webp',
    sourceRect: { x: 29, y: 130, width: 1289, height: 803 },
    x: 765,
    y: -158,
    width: 1289,
    height: 803,
    footprint: [{ x: 0, y: -1 }],
    depth: { x: -1, y: -1 },
    exterior: true,
  },
  {
    id: 'cutting-west-upper-buttress',
    url: 'art/maps/cutting-scene/exterior-rim.webp',
    sourceRect: { x: 1357, y: 130, width: 202, height: 258 },
    x: 572,
    y: -158,
    width: 202,
    height: 258,
    footprint: [{ x: -1, y: 0 }],
    depth: { x: -1, y: -1 },
    exterior: true,
  },
  {
    id: 'cutting-west-lower-buttress',
    url: 'art/maps/cutting-scene/exterior-rim.webp',
    sourceRect: { x: 1598, y: 143, width: 202, height: 246 },
    x: -4,
    y: 143,
    width: 202,
    height: 246,
    footprint: [{ x: -1, y: 9 }],
    depth: { x: -1, y: -1 },
    exterior: true,
  },
] as const satisfies readonly ExteriorRimSource[];

export const DRILLER_FLOOR_EXTERIOR_RIM = [
  {
    id: 'driller-rear-west-rim',
    url: 'art/maps/driller-floor-scene/exterior-rim.webp',
    sourceRect: { x: 28, y: 152, width: 330, height: 300 },
    x: 764,
    y: -136,
    width: 330,
    height: 300,
    footprint: [{ x: 0, y: -1 }],
    depth: { x: -1, y: -1 },
    exterior: true,
  },
  {
    id: 'driller-rear-east-rim',
    url: 'art/maps/driller-floor-scene/exterior-rim.webp',
    sourceRect: { x: 397, y: 152, width: 330, height: 302 },
    x: 1724,
    y: 344,
    width: 330,
    height: 302,
    footprint: [{ x: 15, y: -1 }],
    depth: { x: -1, y: -1 },
    exterior: true,
  },
  {
    id: 'driller-west-upper-buttress',
    url: 'art/maps/driller-floor-scene/exterior-rim.webp',
    sourceRect: { x: 766, y: 152, width: 202, height: 235 },
    x: 572,
    y: -136,
    width: 202,
    height: 235,
    footprint: [{ x: -1, y: 0 }],
    depth: { x: -1, y: -1 },
    exterior: true,
  },
  {
    id: 'driller-west-lower-buttress',
    url: 'art/maps/driller-floor-scene/exterior-rim.webp',
    sourceRect: { x: 1007, y: 151, width: 202, height: 238 },
    x: -4,
    y: 151,
    width: 202,
    height: 238,
    footprint: [{ x: -1, y: 9 }],
    depth: { x: -1, y: -1 },
    exterior: true,
  },
] as const satisfies readonly ExteriorRimSource[];
