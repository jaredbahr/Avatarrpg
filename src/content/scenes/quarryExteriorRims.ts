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

/**
 * West edge band: a spoil bank held back by timber cribbing. The span is the
 * cribbed stretch of the Driller floor's approved rear-rim panel, which the
 * connected quarry surround replaced there, mirrored (ADR 0058) so its long
 * side runs down the x=0 edge; its measured base (a 1:2 slope) stands on that
 * edge, rows `top`..`top + 1`, so no alpha lands on a playable cell. The Quarry
 * Gate and the Driller floor both band their west road mouth with it.
 */
export const quarryCribbing = (prefix: string, top: number): SceneScenery => ({
  id: `${prefix}-cribbing-${top}`,
  url: 'art/maps/driller-floor-scene/exterior-rim.webp',
  sourceRect: { x: 110, y: 186, width: 128, height: 206 },
  x: 768 - (top + 2) * 64,
  y: (top + 2) * 32 - 204,
  width: 128,
  height: 206,
  flip: true,
  footprint: [
    { x: -1, y: top },
    { x: -1, y: top + 1 },
  ],
  depth: { x: -0.5, y: top + 1 },
  exterior: true,
});
