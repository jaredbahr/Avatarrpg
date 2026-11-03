import { PixelMarkRasterCache, pixelMarkRasterKey } from './pixelMarks';
import type { G1Bounds, PixelMarkRaster, PixelMarkSpec } from './pixelMarks';

export function pixelMarkCanvas(raster: PixelMarkRaster): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create a pixel-mark source canvas');
  const image = context.createImageData(raster.width, raster.height);
  image.data.set(raster.data);
  context.putImageData(image, 0, 0);
  return canvas;
}

/** Idle renderer sources stay bounded; the visible frame may exceed this budget. */
export const PIXEL_MARK_DRAWABLE_CACHE_BYTES = 8 * 1024 * 1024;
export const PIXEL_MARK_DRAWABLE_CACHE_ENTRIES = 256;

interface Entry<T> {
  readonly drawable: T | null;
  readonly bytes: number;
}

/**
 * Retains source canvases across frames, including when the smaller CPU mask
 * LRU evicts them. A frame's visible sources are never evicted mid-frame;
 * idle sources age out to a fixed budget after rendering.
 */
export class PixelMarkDrawableCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly usedThisFrame = new Set<string>();
  private readonly rasters = new PixelMarkRasterCache();
  private bytes = 0;
  private rasterizations = 0;

  constructor(
    private readonly create: (raster: PixelMarkRaster) => T,
    private readonly idleByteLimit = PIXEL_MARK_DRAWABLE_CACHE_BYTES,
    private readonly idleEntryLimit = PIXEL_MARK_DRAWABLE_CACHE_ENTRIES,
  ) {
    if (!Number.isSafeInteger(idleByteLimit) || idleByteLimit < 0) {
      throw new Error(`Invalid pixel-mark drawable cache budget: ${idleByteLimit}`);
    }
    if (!Number.isSafeInteger(idleEntryLimit) || idleEntryLimit < 0) {
      throw new Error(`Invalid pixel-mark drawable cache entry budget: ${idleEntryLimit}`);
    }
  }

  beginFrame(): void {
    this.usedThisFrame.clear();
  }

  get(spec: PixelMarkSpec, bounds: G1Bounds): { key: string; drawable: T | null } {
    const key = pixelMarkRasterKey(spec, bounds);
    this.usedThisFrame.add(key);
    const existing = this.entries.get(key);
    if (existing) {
      this.entries.delete(key);
      this.entries.set(key, existing);
      return { key, drawable: existing.drawable };
    }

    const raster = this.rasters.getChunk(spec, bounds);
    this.rasterizations++;
    let drawable: T | null = null;
    for (let i = 3; i < raster.data.length; i += 4) {
      if ((raster.data[i] ?? 0) > 0) {
        drawable = this.create(raster);
        break;
      }
    }
    const bytes = raster.width * raster.height * 4;
    this.entries.set(key, { drawable, bytes });
    this.bytes += bytes;
    return { key, drawable };
  }

  endFrame(): string[] {
    const evicted: string[] = [];
    while (this.bytes > this.idleByteLimit || this.entries.size > this.idleEntryLimit) {
      let removed = false;
      for (const [key, entry] of this.entries) {
        if (this.usedThisFrame.has(key)) continue;
        this.entries.delete(key);
        this.bytes -= entry.bytes;
        evicted.push(key);
        removed = true;
        break;
      }
      if (!removed) break;
    }
    this.usedThisFrame.clear();
    return evicted;
  }

  clear(): void {
    this.entries.clear();
    this.usedThisFrame.clear();
    this.rasters.clear();
    this.bytes = 0;
    this.rasterizations = 0;
  }

  get size(): number {
    return this.entries.size;
  }

  get byteLength(): number {
    return this.bytes;
  }

  get rasterizationCount(): number {
    return this.rasterizations;
  }
}
