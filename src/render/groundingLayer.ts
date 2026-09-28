/**
 * The grounding rasters (`grounding.ts`) as canvases, built once per scene.
 *
 * The rasters need to know where grass is. The painted ground answers first:
 * the topmost loaded ground piece with paint at the point, read from a small
 * copy of each plate. Where no piece has paint, the grid's own terrain does.
 * Nothing is built until every scene image has loaded, the same condition
 * under which the backends draw a partial scene's authored ground at all.
 */
import { tileAt } from '../core/rules/grid';
import type { Grid, MapScene, SceneImage, Vec2 } from '../core/types';
import type { Affine, GroundSampler, GroundingRaster } from './grounding';
import { GROUNDING_GRAIN, contactRaster, tuftRaster } from './grounding';
import { sceneImage } from './scene';

/** One grounding raster, ready to draw at `x, y` in scene pixels, `width x height` big. */
export interface GroundingCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneGrounding {
  readonly contact: GroundingCanvas | null;
  /** Front tufts per scenery id. */
  readonly tufts: ReadonlyMap<string, GroundingCanvas>;
}

/** Plates are read at this fraction of their size: enough to tell grass from paving. */
const SAMPLE_SCALE = 0.25;
/** A few scenes at most are alive at once (a map and the one it hands over to). */
const CACHE_SIZE = 4;
const cache = new Map<string, SceneGrounding>();

function toCanvas(raster: GroundingRaster): GroundingCanvas | null {
  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(raster.width, raster.height);
  image.data.set(raster.data);
  context.putImageData(image, 0, 0);
  return {
    canvas,
    x: raster.x,
    y: raster.y,
    width: raster.width * GROUNDING_GRAIN,
    height: raster.height * GROUNDING_GRAIN,
  };
}

interface Plate {
  readonly piece: SceneImage;
  readonly pixels: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

function readPlate(piece: SceneImage): Plate | null {
  const image = sceneImage(piece);
  if (!image) return null;
  const width = Math.max(1, Math.round(piece.width * SAMPLE_SCALE));
  const height = Math.max(1, Math.round(piece.height * SAMPLE_SCALE));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const rect = piece.sourceRect ?? {
    x: 0,
    y: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
  return { piece, pixels: context.getImageData(0, 0, width, height).data, width, height };
}

/** Green-led and clearly above its blue: meadow, lawn or verge rather than paving, earth or water. */
export function isGrass(rgb: readonly number[]): boolean {
  const [r = 0, g = 0, b = 0] = rgb;
  return g >= r && g > b + 25;
}

const TERRAIN_RGB: Readonly<Record<string, readonly number[]>> = {
  grass: [0x6f, 0x9e, 0x4c],
};

function sampler(scene: MapScene, grid: Grid, affine: Affine): GroundSampler {
  const plates = scene.ground.map(readPlate).filter((plate): plate is Plate => plate !== null);
  return (pos: Vec2) => {
    const world = affine.toWorld(pos);
    for (let i = plates.length - 1; i >= 0; i--) {
      const plate = plates[i];
      if (!plate) continue;
      const u = Math.floor(((world.x - plate.piece.x) / plate.piece.width) * plate.width);
      const v = Math.floor(((world.y - plate.piece.y) / plate.piece.height) * plate.height);
      if (u < 0 || v < 0 || u >= plate.width || v >= plate.height) continue;
      const at = (v * plate.width + u) * 4;
      if ((plate.pixels[at + 3] ?? 0) < 200) continue;
      const rgb = [plate.pixels[at] ?? 0, plate.pixels[at + 1] ?? 0, plate.pixels[at + 2] ?? 0];
      return { grass: isGrass(rgb), rgb };
    }
    const tile = tileAt(grid, { x: Math.floor(pos.x), y: Math.floor(pos.y) });
    if (!tile) return null;
    const rgb = TERRAIN_RGB[tile.terrain];
    return rgb ? { grass: true, rgb } : { grass: false, rgb: [0, 0, 0] };
  };
}

function key(scene: MapScene, grid: Grid, affine: Affine): string {
  const origin = affine.toWorld({ x: 0, y: 0 });
  const unit = affine.toWorld({ x: 1, y: 0 });
  return [
    grid.width,
    grid.height,
    origin.x,
    origin.y,
    unit.x,
    unit.y,
    scene.ground.map((piece) => `${piece.url}@${piece.x},${piece.y}`).join('|'),
    scene.scenery
      .map((piece) => `${piece.id}:${piece.footprint.map((c) => `${c.x},${c.y}`).join(';')}`)
      .join('|'),
  ].join('/');
}

/**
 * The grounding for a scene, or null until every one of its images has
 * loaded. Built once per scene and projection; afterwards a lookup.
 */
export function sceneGrounding(scene: MapScene, grid: Grid, affine: Affine): SceneGrounding | null {
  const id = key(scene, grid, affine);
  const hit = cache.get(id);
  if (hit) return hit;
  if (![...scene.ground, ...scene.scenery].every((piece) => sceneImage(piece) !== null))
    return null;
  const sample = sampler(scene, grid, affine);
  const contact = contactRaster(scene.scenery, affine, sample);
  const tufts = new Map<string, GroundingCanvas>();
  // A piece cut into depth slices shares one footprint; its tufts go with the
  // nearest slice, which paints last.
  const nearest = new Map<string, MapScene['scenery'][number]>();
  for (const piece of scene.scenery) {
    const cells = piece.footprint.map((c) => `${c.x},${c.y}`).join(';');
    const held = nearest.get(cells);
    if (!held || piece.depth.x + piece.depth.y >= held.depth.x + held.depth.y)
      nearest.set(cells, piece);
  }
  for (const piece of nearest.values()) {
    const raster = tuftRaster(piece, affine, sample);
    const canvas = raster && toCanvas(raster);
    if (canvas) tufts.set(piece.id, canvas);
  }
  const built = { contact: contact && toCanvas(contact), tufts };
  cache.set(id, built);
  const oldest = cache.keys().next().value;
  if (cache.size > CACHE_SIZE && oldest !== undefined) cache.delete(oldest);
  return built;
}
