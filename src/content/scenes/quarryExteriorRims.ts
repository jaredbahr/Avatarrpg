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
 * Reviewed source metadata only. Gameplay owns the later decision to add these
 * rear-only pieces to the Cutting and Driller Floor MapScene definitions.
 */
export const CUTTING_EXTERIOR_RIM = [
  {
    id: 'cutting-rear-rim',
    url: 'art/maps/cutting-scene/exterior-rim.webp',
    sourceRect: { x: 28, y: 3, width: 1290, height: 930 },
    x: 764,
    y: -285,
    width: 1290,
    height: 930,
    footprint: [{ x: 0, y: -1 }],
    depth: { x: -1, y: -1 },
  },
  {
    id: 'cutting-west-upper-buttress',
    url: 'art/maps/cutting-scene/exterior-rim.webp',
    sourceRect: { x: 1357, y: 1, width: 202, height: 387 },
    x: 572,
    y: -287,
    width: 202,
    height: 387,
    footprint: [{ x: -1, y: 0 }],
    depth: { x: -1, y: -1 },
  },
  {
    id: 'cutting-west-lower-buttress',
    url: 'art/maps/cutting-scene/exterior-rim.webp',
    sourceRect: { x: 1598, y: 21, width: 202, height: 369 },
    x: -4,
    y: 21,
    width: 202,
    height: 369,
    footprint: [{ x: -1, y: 9 }],
    depth: { x: -1, y: -1 },
  },
] as const satisfies readonly ExteriorRimSource[];

export const DRILLER_FLOOR_EXTERIOR_RIM = [
  {
    id: 'driller-rear-west-rim',
    url: 'art/maps/driller-floor-scene/exterior-rim.webp',
    sourceRect: { x: 28, y: 42, width: 330, height: 410 },
    x: 764,
    y: -246,
    width: 330,
    height: 410,
    footprint: [{ x: 0, y: -1 }],
    depth: { x: -1, y: -1 },
  },
  {
    id: 'driller-rear-east-rim',
    url: 'art/maps/driller-floor-scene/exterior-rim.webp',
    sourceRect: { x: 397, y: 42, width: 330, height: 413 },
    x: 1724,
    y: 234,
    width: 330,
    height: 413,
    footprint: [{ x: 15, y: -1 }],
    depth: { x: -1, y: -1 },
  },
  {
    id: 'driller-west-upper-buttress',
    url: 'art/maps/driller-floor-scene/exterior-rim.webp',
    sourceRect: { x: 766, y: 43, width: 202, height: 344 },
    x: 572,
    y: -245,
    width: 202,
    height: 344,
    footprint: [{ x: -1, y: 0 }],
    depth: { x: -1, y: -1 },
  },
  {
    id: 'driller-west-lower-buttress',
    url: 'art/maps/driller-floor-scene/exterior-rim.webp',
    sourceRect: { x: 1007, y: 42, width: 202, height: 347 },
    x: -4,
    y: 42,
    width: 202,
    height: 347,
    footprint: [{ x: -1, y: 9 }],
    depth: { x: -1, y: -1 },
  },
] as const satisfies readonly ExteriorRimSource[];
