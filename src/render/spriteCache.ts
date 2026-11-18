/**
 * Sprite cache.
 *
 * Painters draw with a dozen path operations each. At six party members, eight
 * enemies and sixty frames a second that is a lot of repeated work for output
 * that never changes, so each (asset, variant, size, facing) is painted once
 * into an offscreen canvas and blitted thereafter.
 *
 * Sizes are *device* pixels: the caller multiplies its CSS size by the display
 * ratio, so a Surface or an iPad gets a sprite painted for its screen rather
 * than one painted at CSS size and stretched two or three times. The cache is
 * bounded and evicts least-recently-used entries, because iOS caps the total
 * canvas memory a page may hold and a pinch to zoom walks through many sizes.
 *
 * The cache also owns image loading, so pointing a manifest entry at a real
 * bitmap later needs no change anywhere else: the first draw shows the painted
 * placeholder, and the image takes over once it has loaded.
 */

import { resolveAsset } from '../content/assets/manifest';
import { releaseCanvas, releaseCanvasSoon } from './canvasRelease';
import { resolvePainter } from './painters/registry';
import type { PainterOptions } from './painters/units';

interface CacheEntry {
  readonly canvas: HTMLCanvasElement;
  /** Bytes of canvas the sprite holds, for the cache's budget. */
  readonly bytes: number;
}

/**
 * Manifest URLs are written relative to the site root. On GitHub Pages the
 * site root is `/<repo>/`, so a bare `art/kaya.png` would 404 there; Vite
 * knows the base, and this puts it in front. Absolute URLs pass through.
 */
export function assetUrl(url: string): string {
  if (/^(?:[a-z]+:|\/)/i.test(url)) return url;
  return `${import.meta.env.BASE_URL}${url}`;
}

/** Sizes are bucketed so a slow zoom does not repaint every sprite per frame. */
const SIZE_BUCKET = 8;

/**
 * Past this many device pixels per tile a painter has no more detail to give,
 * and a 2-tile boss at the cap is still only a 512x256 canvas.
 */
export const MAX_SPRITE_PX = 256;

/** Entries kept, and the canvas bytes they may add up to, whichever is reached first. */
const MAX_ENTRIES = 128;
/**
 * 128 one-tile sprites at the pixel cap are 32 MB of canvas. The count alone did not hold that: a
 * two-tile boss is two or four tiles of canvas, and 128 of those are up to 128 MB. The bytes are
 * what the tablet counts, so they are the bound (ADR 0112).
 */
export const MAX_SPRITE_BYTES = MAX_ENTRIES * MAX_SPRITE_PX * MAX_SPRITE_PX * 4;

export class SpriteCache {
  private entries = new Map<string, CacheEntry>();
  private bytes = 0;
  private images = new Map<string, HTMLImageElement | null>();
  private loading = new Map<string, Promise<boolean>>();
  private failed = new Set<string>();

  /**
   * Painted sprites are cheap to rebuild; drop them all on a big resize. Their canvases are
   * released, not left for the collector: the caller has let go of every texture made from them.
   */
  clear(): void {
    for (const entry of this.entries.values()) releaseCanvas(entry.canvas);
    this.entries.clear();
    this.bytes = 0;
  }

  /** How many painted sprites are held (never more than the cap). */
  get size(): number {
    return this.entries.size;
  }

  private bucket(size: number): number {
    const bucketed = Math.max(SIZE_BUCKET, Math.round(size / SIZE_BUCKET) * SIZE_BUCKET);
    return Math.min(MAX_SPRITE_PX, bucketed);
  }

  /**
   * Returns a canvas of the requested sprite, painting it if necessary. `size`
   * is the tile's height in device pixels; `widthTiles` differs from 1 only
   * for the 2-tile boss.
   */
  get(
    key: string,
    size: number,
    options: PainterOptions = {},
    widthTiles = 1,
    heightTiles = 1,
  ): HTMLCanvasElement {
    const bucketed = this.bucket(size);
    const pose = options.pose ? `${options.pose.clip}${options.pose.index}` : '';
    const cacheKey = `${key}|${options.variant ?? ''}|${options.facing ?? 1}|${bucketed}|${widthTiles}|${heightTiles}|${pose}`;
    const existing = this.entries.get(cacheKey);
    if (existing) {
      // Re-insert so Map order doubles as recency.
      this.entries.delete(cacheKey);
      this.entries.set(cacheKey, existing);
      return existing.canvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bucketed * widthTiles));
    canvas.height = Math.max(1, Math.round(bucketed * heightTiles));

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const image = this.image(key);
      if (image) {
        // Prop PNGs carry no floor or shadow, and get none here: the backends
        // ground every prop in the shared shadow union (ADR 0093).
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      } else {
        const painter = resolvePainter(key);
        painter.draw(
          ctx,
          { x: 0, y: bucketed * (heightTiles - 1), size: bucketed },
          {
            ...options,
            footprintWidth: widthTiles === 2 ? 2 : 1,
            footprintHeight: heightTiles === 2 ? 2 : 1,
          },
        );
      }
    }

    const bytes = canvas.width * canvas.height * 4;
    this.entries.set(cacheKey, { canvas, bytes });
    this.bytes += bytes;
    // The newest sprite always stays, so one sprite larger than the budget still draws.
    while (
      this.entries.size > 1 &&
      (this.entries.size > MAX_ENTRIES || this.bytes > MAX_SPRITE_BYTES)
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      const dropped = this.entries.get(oldest);
      this.entries.delete(oldest);
      this.bytes -= dropped?.bytes ?? 0;
      // Soon, not now: a sprite handed out earlier in this frame may still be waiting to be drawn.
      releaseCanvasSoon(dropped?.canvas);
    }
    return canvas;
  }

  /**
   * Loaded image for an asset key, or null while it loads (or forever, if the
   * manifest entry is a painter). Kicks off the load on first ask. The DOM
   * portraits draw from this directly, at full resolution.
   */
  imageFor(key: string): HTMLImageElement | null {
    return this.image(key);
  }

  /**
   * Resolves true once the key's bitmap is in, false if the entry is a painter
   * or the load failed. Lets a portrait repaint itself the moment the art
   * arrives instead of waiting for the next HUD rebuild.
   */
  whenLoaded(key: string): Promise<boolean> {
    if (this.image(key)) return Promise.resolve(true);
    return this.loading.get(key) ?? Promise.resolve(false);
  }

  private image(key: string): HTMLImageElement | null {
    const entry = resolveAsset(key);
    if (entry.kind !== 'image') return null;
    if (this.failed.has(key)) return null;

    const cached = this.images.get(key);
    if (cached !== undefined) return cached;

    this.images.set(key, null);
    const img = new Image();
    img.decoding = 'async';
    this.loading.set(
      key,
      new Promise<boolean>((resolve) => {
        img.onload = () => {
          this.images.set(key, img);
          // Anything already painted with the placeholder must be repainted.
          this.clear();
          resolve(true);
        };
        img.onerror = () => {
          // Fall back to the painter rather than showing nothing.
          this.failed.add(key);
          this.images.delete(key);
          console.warn(`Asset "${key}" failed to load; using the drawn placeholder.`);
          resolve(false);
        };
      }),
    );
    img.src = assetUrl(entry.url);
    return null;
  }
}

export const sprites = new SpriteCache();

/**
 * How a walking resident's painted figure is drawn: striding, two drawings a
 * tile as the walk clip is, on the distance clock. Art that cannot stride
 * (a PNG) stays one drawing and rides the bob alone.
 */
export function npcPose(npc: {
  readonly sprite: string;
  readonly walking?: boolean;
  readonly clipTime?: number;
}): PainterOptions {
  return npc.walking && resolveAsset(npc.sprite).kind === 'painter'
    ? { facing: 1, pose: { clip: 'walk', index: Math.floor((npc.clipTime ?? 0) / 250) % 2 } }
    : { facing: 1 };
}
