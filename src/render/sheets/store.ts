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

import type { ClipDef, ClipName, Heading, MeleeDirection } from '../../content/assets/clips';
import type { SheetEntry } from '../../content/assets/manifest';
// Types only: the bend schemas stay out of the bundle (ADR 0055).
import type { BendSetDef, BendSocket } from '../../content/bends';
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

/**
 * One cel of a character's bend (ADR 0055), drawn like any sheet frame but by
 * its own heading's foot anchor, never the sheet's: every heading of a bend is
 * trimmed to its own rectangle. Placed by that anchor on the unit's foot, the
 * cel stands exactly where the stance does.
 */
export interface ResolvedBendFrame extends Omit<ResolvedFrame, 'clip'> {
  readonly heading: Heading;
  /** How long this cel holds, in ms, before any hit-stop. */
  readonly ms: number;
  /**
   * The sockets this cel records, in cel pixels measured from the cel's
   * top-left corner, as continuous points: a pixel (u, v) of the cel covers
   * [u, u+1) x [v, v+1), so its centre is (u + 0.5, v + 0.5). This is the
   * space `frame` draws in, so a socket moves with the cel exactly as the
   * anchor does (ADR 0055, sub-pixel sockets).
   */
  readonly sockets: Readonly<
    Partial<Record<BendSocket, { readonly x: number; readonly y: number }>>
  >;
}

interface AtlasPage {
  readonly atlas: AtlasJson;
  readonly image: HTMLImageElement;
}

interface LoadedAtlas {
  /** `atlas` first, then each of `atlasPages` (ADR 0052). */
  readonly pages: readonly AtlasPage[];
  /** Stable silhouette envelope measured once across the asset's authored clips. */
  readonly headroom: number;
  /** The entry's `bend` data, when it names one; loaded with the pages. */
  readonly bend?: BendSetDef;
}

/** The page a frame lives on, and its rectangle there. */
function findFrame(
  loaded: LoadedAtlas,
  name: string | undefined,
): { readonly image: HTMLImageElement; readonly frame: AtlasFrame } | undefined {
  if (name === undefined) return undefined;
  for (const page of loaded.pages) {
    const frame = page.atlas.frames.get(name);
    if (frame) return { image: page.image, frame };
  }
  return undefined;
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
  const names = new Set([
    ...Object.values(entry.clips).flatMap((clip) => clip?.frames ?? []),
    ...Object.values(entry.meleeDirections ?? {}).flatMap((frames) => frames ?? []),
  ]);
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
    meleeDirection?: MeleeDirection,
  ): ResolvedFrame | null {
    const entry = resolveAsset(key);
    if (entry.kind === 'sheet') {
      const atlas = this.atlas(key, entry);
      if (atlas) return this.fromAtlas(entry, atlas, clip, clipTime, clipFrame, meleeDirection);
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
    meleeDirection?: MeleeDirection,
  ): ResolvedFrame | null {
    const directionalFrames =
      clip === 'melee' && meleeDirection ? entry.meleeDirections?.[meleeDirection] : undefined;
    if (directionalFrames) {
      const directional: { clip: ClipName; def: ClipDef; exact: boolean } = {
        clip: 'melee',
        def: { frames: directionalFrames, fps: 8, loop: false },
        exact: true,
      };
      const index = frameIndex(directional, clipTime, clipFrame);
      const found = findFrame(loaded, directional.def.frames[index]);
      if (found)
        return {
          source: found.image,
          frame: found.frame,
          pixelsPerTile: entry.pixelsPerTile,
          footprint: entry.footprint,
          anchor: entry.anchor,
          headroom: loaded.headroom,
          clip: directional.clip,
          index,
          placeholder: false,
        };
    }
    const resolved = resolveClip(entry.clips, clip);
    if (!resolved) return null;
    const index = frameIndex(resolved, clipTime, clipFrame);
    const found = findFrame(loaded, resolved.def.frames[index]);
    if (!found) return null;
    return {
      source: found.image,
      frame: found.frame,
      pixelsPerTile: entry.pixelsPerTile,
      footprint: entry.footprint,
      anchor: entry.anchor,
      headroom: loaded.headroom,
      clip: resolved.clip,
      index,
      placeholder: false,
    };
  }

  /**
   * The bend set `key`'s sheet names, once the sheet has loaded; undefined
   * before then or when the sheet has no bend. Asking starts the load.
   */
  bendSet(key: string): BendSetDef | undefined {
    const entry = resolveAsset(key);
    return entry.kind === 'sheet' ? this.atlas(key, entry)?.bend : undefined;
  }

  /**
   * Cel `index` of `key`'s bend facing `heading`: the page and rectangle it is
   * on, the heading's own anchor, and its hold and sockets. Null until the
   * sheet has loaded, for a sheet with no bend, and for an index or a cel the
   * bend does not have. Nothing plays a bend yet (ADR 0055, steps 6 and 7).
   */
  bendFrame(key: string, heading: Heading, index: number): ResolvedBendFrame | null {
    const entry = resolveAsset(key);
    const loaded = entry.kind === 'sheet' ? this.atlas(key, entry) : null;
    const facing = loaded?.bend?.facings[heading];
    if (!loaded || !facing || entry.kind !== 'sheet') return null;
    const found = findFrame(loaded, facing.frames[index]);
    const ms = facing.frameMs[index];
    const { width, height } = facing.frameSize;
    // The anchor is a fraction of `frameSize`; a cel of any other size would
    // stand somewhere else.
    if (!found || ms === undefined || found.frame.w !== width || found.frame.h !== height) {
      return null;
    }
    return {
      source: found.image,
      frame: found.frame,
      pixelsPerTile: entry.pixelsPerTile,
      footprint: entry.footprint,
      anchor: facing.anchor,
      headroom: loaded.headroom,
      index,
      placeholder: false,
      heading,
      ms,
      sockets: facing.socketsPerFrame[index]?.sockets ?? {},
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

  /**
   * The loaded atlas for a sheet key, kicking off the load on first ask. A
   * sheet with further pages (ADR 0052) is loaded only once every page is, so
   * a clip never draws from half a sheet, and the same holds for its bend
   * data (ADR 0055).
   */
  private atlas(key: string, entry: SheetEntry): LoadedAtlas | null {
    const state = this.loaded.get(key);
    if (state && state !== 'loading' && state !== 'failed') return state;
    if (state !== undefined) return null;

    this.loaded.set(key, 'loading');
    Promise.all([
      Promise.all([entry.atlas, ...(entry.atlasPages ?? [])].map(loadPage)),
      // Checked by its schema in CI (`art:validate`), so only typed here.
      entry.bend ? fetchText(entry.bend).then((text) => JSON.parse(text) as BendSetDef) : undefined,
    ])
      .then(([pages, bend]) =>
        this.loaded.set(key, {
          pages,
          headroom: Math.max(...pages.map((page) => atlasHeadroom(entry, page.atlas, page.image))),
          ...(bend ? { bend } : {}),
        }),
      )
      .catch((reason: unknown) => {
        this.loaded.set(key, 'failed');
        console.warn(`Sheet "${key}" failed to load; using the drawn placeholder.`, reason);
      });
    return null;
  }
}

/** A site-relative text file. */
async function fetchText(path: string): Promise<string> {
  const url = assetUrl(path);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.text();
}

/** One atlas page: its JSON, then the image its `meta.image` names beside it. */
async function loadPage(path: string): Promise<AtlasPage> {
  const atlas = parseAtlasJson(await fetchText(path));
  const image = new Image();
  image.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`image ${atlas.image}`));
    image.src = assetUrl(`${path.slice(0, path.lastIndexOf('/') + 1)}${atlas.image}`);
  });
  return { atlas, image };
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
