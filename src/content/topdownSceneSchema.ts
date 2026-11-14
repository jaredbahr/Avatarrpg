/**
 * Runtime validation for packed top-down scenes (ADR 0060).
 *
 * Ground plates may draw their whole image; atlas scenery must name its crop.
 * Bind their URLs to the supplied scene's sibling files, including custom scene
 * locations. These checks establish neither image existence nor crop bounds in
 * a decoded atlas. World coordinates may be negative outside the logical board.
 */
import * as s from '../core/schema';
import type { Schema } from '../core/schema';
import type { MapScene } from '../core/types';

const finite = s.number().min(-Number.MAX_VALUE).max(Number.MAX_VALUE);
const positive = s.number().positive().max(Number.MAX_VALUE);
const nonnegative = s.number().min(0).max(Number.MAX_VALUE);
const pixelOrigin = s.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const pixelSize = s.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const cell = s.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const point = s.object({ x: finite, y: finite });
const crop = s.object({ x: pixelOrigin, y: pixelOrigin, width: pixelSize, height: pixelSize });
const feather = s.object({ left: nonnegative.optional(), right: nonnegative.optional() });
const imageFields = {
  x: finite,
  y: finite,
  width: positive,
  height: positive,
  feather: feather.optional(),
  wind: s.boolean().optional(),
};

/** All supported MapScene fields survive parsing; no defaults rewrite the asset. */
export function topDownSceneSchema(sceneUrl: string): Schema<MapScene> {
  const directory = sceneUrl.slice(0, sceneUrl.lastIndexOf('/') + 1);
  return s.object({
    marginTone: s.enum(['verdant', 'quarry']).optional(),
    paintedWater: s.boolean().optional(),
    groundMode: s.literal('partial').optional(),
    paintedWaterCells: s.array(point).optional(),
    paintedRubble: s.array(point).optional(),
    paintExtent: s.object({ x: finite, y: finite, width: positive, height: positive }).optional(),
    chimneys: s.array(point).optional(),
    pavedCells: s.array(point).optional(),
    canopies: s.array(point).optional(),
    ambienceSources: s.object({ steam: s.array(point), lanterns: s.array(point) }).optional(),
    actorGrounding: s
      .object({
        cast: s.number().min(0).max(1).optional(),
        contact: s.number().min(0).max(1).optional(),
        castKey: point.optional(),
        ink: s
          .object({
            r: s.number().int().min(0).max(255),
            g: s.number().int().min(0).max(255),
            b: s.number().int().min(0).max(255),
          })
          .optional(),
      })
      .optional(),
    ground: s
      .array(
        s.object({
          url: s.literal(`${directory}ground.webp`),
          sourceRect: crop.optional(),
          ...imageFields,
        }),
      )
      .min(1),
    scenery: s.array(
      s.object({
        id: s.string().min(1),
        url: s.literal(`${directory}uprights.webp`),
        sourceRect: crop,
        ...imageFields,
        footprint: s.array(s.object({ x: cell, y: cell })),
        depth: point,
        exterior: s.boolean().optional(),
        wall: s.boolean().optional(),
        fadeWhenOccluding: s.boolean().optional(),
        revealOccluded: s.boolean().optional(),
        fadeGroup: s.string().optional(),
        flip: s.boolean().optional(),
        contactShadow: s.literal(false).optional(),
        castShadow: s.union([s.literal(false), s.literal('reduced')]).optional(),
        castFrom: s.literal('base').optional(),
      }),
    ),
    flock: s
      .object({
        url: s.string().min(1),
        frames: pixelSize,
        frameSize: pixelSize,
        size: positive,
        count: s.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      })
      .optional(),
  });
}
