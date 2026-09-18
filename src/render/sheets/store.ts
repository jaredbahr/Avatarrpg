/**
 * Where a unit's frames come from.
 *
 * Asked for a unit key, a clip and a moment, the store answers with one
 * frame of one image: a rectangle of a real atlas when the key has a `sheet`
 * entry whose files have arrived, otherwise a rectangle of a sheet baked
 * from the key's painter (`bake.ts`). The backends draw whatever comes back
 * and never ask which it was, so real art swaps in key by key.
 *
 * Loading is one `fetch` for the JSON and one `Image` for the PNG, never
 * Pixi's `Assets`, so the Canvas 2D backend reads the same file through the
 * same code (ADR 0003, amended). Baked sheets are bucketed by device pixels a
 * tile like sprites and kept in a byte-bounded least-recently-used set, for
 * the iOS canvas cap; a resize clears them.
 */

import type { ClipName } from '../../content/assets/clips';
import type { SheetEntry } from '../../content/assets/manifest';
import { resolveAsset } from '../../content/assets/manifest';
import { resolvePainter } from '../painters/registry';
import { assetUrl } from '../spriteCache';
import type { AtlasFrame, AtlasJson } from './atlasJson';
import { parseAtlasJson } from './atlasJson';
import type { BakedSheet } from './bake';
import { bakeSheet, frameHeadroom, headroomFromPixels } from './bake';
import { frameIndex, resolveClip } from './resolveClip';

export interface ResolvedFrame {
  readonly source: HTMLCanvasElement | HTMLImageElement;
  readonly frame: AtlasFrame;
  /** Atlas pixels per tile, so the backend can size the frame in world units. */
  readonly pixelsPerTile: number;
  readonly footprint: { readonly w: number; readonly h: number };
  /** The point of the frame that stands on the tile's foot line, as fractions of the frame. */
  readonly anchor: { readonly x: number; readonly y: number };
  /** Tiles above the tile's top edge the art reaches; the health bar sits above it. */
  readonly headroom: number;
  /** The clip actually drawn and its frame, for anything that wants to know. */
  readonly clip: ClipName;
  readonly index: number;
  /** True when this came from the painter rather than an atlas. */
  readonly placeholder: boolean;
}

interface LoadedAtlas {
  readonly atlas: AtlasJson;
  readonly image: HTMLImageElement;
  /** Stable silhouette envelope measured once across the asset's authored clips. */
  readonly headroom: number;
}

/**
 * A conservative silhouette envelope over all referenced frames. Measured
 * only when the atlas loads, then cached within its existing asset lifetime.
 * A stable envelope avoids moving the bar with each idle/walk/cast cel.
 */
export function atlasHeadroom(
  entry: SheetEntry,
  atlas: AtlasJson,
  image: CanvasImageSource,
): number {
  const names = new Set(Object.values(entry.clips).flatMap((clip) => clip?.frames ?? []));
  const scratch = typeof document === 'undefined' ? null : document.createElement('canvas');
  const ctx = scratch?.getContext('2d');
  let envelope = 0;
  for (const name of names) {
    const frame = atlas.frames.get(name);
    if (!frame || frame.w === 0 || frame.h === 0) continue;
    let height = frameHeadroom(frame, entry.anchor.y, entry.pixelsPerTile);
    if (scratch && ctx) {
      scratch.width = frame.w;
      scratch.height = frame.h;
      ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
      const data = ctx.getImageData(0, 0, frame.w, frame.h).data;
      height = headroomFromPixels(data, frame.w, frame.h, entry.pixelsPerTile, entry.anchor.y);
    }
    envelope = Math.max(envelope, height);
  }
  return envelope;
}

/** Baked pixels kept, across every sheet: 48 MB is well under the iOS cap with sprites beside it. */
const MAX_BAKED_BYTES = 48 * 1024 * 1024;
/** Bake sizes are bucketed like sprites so a pinch does not re-bake every frame of the gesture. */
const SIZE_BUCKET = 32;
const MAX_BAKE_PX = 256;

export class SheetStore {
  private baked = new Map<string, BakedSheet>();
  private bakedBytes = 0;
  private loaded = new Map<string, LoadedAtlas | 'loading' | 'failed'>();

  /** Drops every baked sheet; loaded atlases stay, they are the same at any zoom. */
  clear(): void {
    this.baked.clear();
    this.bakedBytes = 0;
  }

  /** Resolves true once a `sheet` key's atlas is in, false for anything else. Tests use it. */
  loadedFor(key: string): boolean {
    const state = this.loaded.get(key);
    return state !== undefined && state !== 'loading' && state !== 'failed';
  }

  /**
   * The frame to draw for `key` in `clip` at `clipTime` ms, or `clipFrame`
   * when the choreography named one, baked at `pixelsPerTile` device pixels
   * a tile when it has to be. Null only when nothing at all can be drawn.
   */
  frame(
    key: string,
    clip: ClipName,
    clipTime: number,
    clipFrame: number | undefined,
    pixelsPerTile: number,
    widthTiles: 1 | 2,
  ): ResolvedFrame | null {
    const entry = resolveAsset(key);
    if (entry.kind === 'sheet') {
      const atlas = this.atlas(key, entry);
      if (atlas) return this.fromAtlas(entry, atlas, clip, clipTime, clipFrame);
    }
    const sheet = this.bake(key, pixelsPerTile, widthTiles);
    if (!sheet) return null;
    const resolved = resolveClip(sheet.clips, clip);
    if (!resolved) return null;
    const index = frameIndex(resolved, clipTime, clipFrame);
    const name = resolved.def.frames[index];
    const frame = name ? sheet.frames.get(name) : undefined;
    if (!frame) return null;
    return {
      source: sheet.canvas,
      frame,
      pixelsPerTile: sheet.pixelsPerTile,
      footprint: sheet.footprint,
      anchor: sheet.anchor,
      headroom: sheet.headroom,
      clip: resolved.clip,
      index,
      placeholder: true,
    };
  }

  private fromAtlas(
    entry: SheetEntry,
    loaded: LoadedAtlas,
    clip: ClipName,
    clipTime: number,
    clipFrame: number | undefined,
  ): ResolvedFrame | null {
    const resolved = resolveClip(entry.clips, clip);
    if (!resolved) return null;
    const index = frameIndex(resolved, clipTime, clipFrame);
    const name = resolved.def.frames[index];
    const frame = name ? loaded.atlas.frames.get(name) : undefined;
    if (!frame) return null;
    return {
      source: loaded.image,
      frame,
      pixelsPerTile: entry.pixelsPerTile,
      footprint: entry.footprint,
      anchor: entry.anchor,
      headroom: loaded.headroom,
      clip: resolved.clip,
      index,
      placeholder: false,
    };
  }

  private bake(key: string, pixelsPerTile: number, widthTiles: 1 | 2): BakedSheet | null {
    const px = Math.min(
      MAX_BAKE_PX,
      Math.max(SIZE_BUCKET, Math.round(pixelsPerTile / SIZE_BUCKET) * SIZE_BUCKET),
    );
    const cacheKey = `${key}|${px}|${widthTiles}`;
    const existing = this.baked.get(cacheKey);
    if (existing) {
      this.baked.delete(cacheKey);
      this.baked.set(cacheKey, existing);
      return existing;
    }
    const sheet = bakeSheet(key, resolvePainter(key), px, widthTiles);
    if (!sheet) return null;
    this.baked.set(cacheKey, sheet);
    this.bakedBytes += sheet.bytes;
    while (this.bakedBytes > MAX_BAKED_BYTES && this.baked.size > 1) {
      const oldest = this.baked.keys().next().value;
      if (oldest === undefined) break;
      const dropped = this.baked.get(oldest);
      this.baked.delete(oldest);
      this.bakedBytes -= dropped?.bytes ?? 0;
    }
    return sheet;
  }

  /** The loaded atlas for a sheet key, kicking off the load on first ask. */
  private atlas(key: string, entry: SheetEntry): LoadedAtlas | null {
    const state = this.loaded.get(key);
    if (state && state !== 'loading' && state !== 'failed') return state;
    if (state !== undefined) return null;

    this.loaded.set(key, 'loading');
    const jsonUrl = assetUrl(entry.atlas);
    const fail = (reason: unknown): void => {
      this.loaded.set(key, 'failed');
      console.warn(`Sheet "${key}" failed to load; using the drawn placeholder.`, reason);
    };
    fetch(jsonUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} for ${jsonUrl}`);
        return response.text();
      })
      .then((text) => {
        const atlas = parseAtlasJson(text);
        const image = new Image();
        image.decoding = 'async';
        image.onload = () =>
          this.loaded.set(key, { atlas, image, headroom: atlasHeadroom(entry, atlas, image) });
        image.onerror = () => fail(`image ${atlas.image}`);
        image.src = assetUrl(
          `${entry.atlas.slice(0, entry.atlas.lastIndexOf('/') + 1)}${atlas.image}`,
        );
      })
      .catch(fail);
    return null;
  }
}

export const sheets = new SheetStore();

/**
 * A per-unit offset in ms for the idle breath, from the unit's id, so a row
 * of units does not breathe in step.
 */
export function idlePhase(unitId: string): number {
  let h = 0;
  for (let i = 0; i < unitId.length; i++) h = (h * 31 + unitId.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000;
}
