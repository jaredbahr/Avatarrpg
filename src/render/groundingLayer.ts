/**
 * The grounding rasters (`grounding.ts`) as canvases, built once per scene.
 *
 * The rasters need to know where grass is. The grid remains authoritative for
 * ground material, so its terrain answers directly; this also avoids retaining
 * readback copies of every painted plate on memory-constrained devices.
 */
import type { MapScene } from '../core/types';
import type { Affine, GroundingRaster } from './grounding';
import { contactRaster } from './grounding';

/** One grounding raster, ready to draw at `x, y` in scene pixels, `width x height` big. */
export interface GroundingCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly x: number;
  readonly y: number;
}

const cache = new WeakMap<MapScene, GroundingCanvas>();

function toCanvas(raster: GroundingRaster): GroundingCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext('2d')!;
  context.putImageData(
    new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height),
    0,
    0,
  );
  return {
    canvas,
    x: raster.x,
    y: raster.y,
  };
}

/**
 * The grounding for a scene, built once per scene and projection; afterwards
 * this is only a lookup.
 */
export function sceneGrounding(scene: MapScene, affine: Affine): GroundingCanvas | null {
  const hit = cache.get(scene);
  if (hit) return hit;
  const raster = contactRaster(scene.scenery, affine);
  if (!raster) return null;
  const built = toCanvas(raster);
  cache.set(scene, built);
  return built;
}
