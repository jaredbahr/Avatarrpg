/**
 * Map paintings, loaded once and kept decoded.
 *
 * A painting is one image per map (ADR 0009), fetched like a sheet's atlas
 * (`sheets/store.ts`): an `Image` pointed at the site-relative URL, never
 * Pixi's `Assets`, so one loader serves both backends. Until it lands, or if
 * it never does, the backends draw the procedural ground, so a missing file
 * shows as the old board and never as nothing.
 *
 * Decoded paintings are the largest bitmaps in the game (a 1920-wide one is
 * near 9 MB), so only the most recent few stay resident: enough for the
 * village and the fight the party walked into, inside the iOS canvas cap.
 */

import { assetUrl } from './spriteCache';

type Entry = 'loading' | 'failed' | HTMLImageElement;

/** Paintings kept decoded at once. */
const MAX_RESIDENT = 3;

export class BackdropStore {
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Promise<boolean>>();

  /** The painting at `url` if it has loaded, kicking off the load on first ask. */
  get(url: string): HTMLImageElement | null {
    const entry = this.entries.get(url);
    if (entry === undefined) {
      this.load(url);
      return null;
    }
    if (entry === 'loading' || entry === 'failed') return null;
    // Most recently drawn goes to the back, so eviction takes the oldest.
    this.entries.delete(url);
    this.entries.set(url, entry);
    return entry;
  }

  /** Resolves true once the painting is in, false if it failed. */
  whenLoaded(url: string): Promise<boolean> {
    const entry = this.entries.get(url);
    if (entry === 'failed') return Promise.resolve(false);
    if (entry !== undefined && entry !== 'loading') return Promise.resolve(true);
    if (entry === undefined) this.load(url);
    return this.pending.get(url) ?? Promise.resolve(false);
  }

  clear(): void {
    this.entries.clear();
    this.pending.clear();
  }

  private load(url: string): void {
    this.entries.set(url, 'loading');
    const promise = new Promise<boolean>((resolve) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        this.entries.set(url, image);
        this.evict();
        this.pending.delete(url);
        resolve(true);
      };
      image.onerror = () => {
        this.entries.set(url, 'failed');
        this.pending.delete(url);
        console.warn(`Map painting "${url}" failed to load; drawing the procedural ground.`);
        resolve(false);
      };
      image.src = assetUrl(url);
    });
    this.pending.set(url, promise);
  }

  private evict(): void {
    const resident = [...this.entries].filter(
      ([, entry]) => entry !== 'loading' && entry !== 'failed',
    );
    for (const [url] of resident.slice(0, Math.max(0, resident.length - MAX_RESIDENT))) {
      this.entries.delete(url);
    }
  }
}

export const backdrops = new BackdropStore();
