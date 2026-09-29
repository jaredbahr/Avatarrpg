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

/** A sheet's clips: the manifest's, with its fetched `clipData` over them (ADR 0059). */
export type SheetClips = Readonly<Partial<Record<ClipName, ClipDef>>>;

interface LoadedAtlas {
  /** `atlas` first, then each of `atlasPages` (ADR 0052). */
  readonly pages: readonly AtlasPage[];
  readonly clips: SheetClips;
  /** Stable silhouette envelope measured once across the asset's authored clips. */
  readonly headroom: number;
}

/** A sheet's bend (ADR 0055): its own pages and its data, loaded apart from the sheet. */
interface LoadedBend {
  readonly pages: readonly AtlasPage[];
  readonly set: BendSetDef;
}

/**
 * Where a sheet's bend stands. `none`: the key has no bend. `idle`: nothing
 * has asked for it. `loading`: asked, waiting on the sheet or its own files.
 * `failed`: its own files, or the sheet under it, failed, for the session.
 */
export type BendLoadState = 'none' | 'idle' | 'loading' | 'loaded' | 'failed';

/** The page a frame lives on, and its rectangle there. */
function findFrame(
  loaded: { readonly pages: readonly AtlasPage[] },
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
  clips: SheetClips = entry.clips,
): number {
  // Each frame is measured from the anchor it stands by: a trimmed clip's own
  // (ADR 0059), or the sheet's.
  const names = new Map<string, number>();
  for (const clip of Object.values(clips))
    for (const name of clip?.frames ?? []) names.set(name, clip?.anchor?.y ?? entry.anchor.y);
  for (const frames of Object.values(entry.meleeDirections ?? {}))
    for (const name of frames ?? []) names.set(name, entry.anchor.y);
  const scratch = typeof document === 'undefined' ? null : document.createElement('canvas');
  const ctx = scratch?.getContext('2d');
  let envelope = 0;
  for (const [name, anchorY] of names) {
    const frame = atlas.frames.get(name);
    if (!frame || frame.w === 0 || frame.h === 0) continue;
    let height = frameHeadroom(frame, anchorY, entry.pixelsPerTile);
    if (scratch && ctx) {
      scratch.width = frame.w;
      scratch.height = frame.h;
      ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
      const data = ctx.getImageData(0, 0, frame.w, frame.h).data;
      height = headroomFromPixels(data, frame.w, frame.h, entry.pixelsPerTile, anchorY);
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
  private bends = new Map<string, LoadedBend | 'loading' | 'failed'>();
  /** Bends asked for before their sheet was in; each loads once its sheet does. */
  private bendsWanted = new Set<string>();
  /** Invalidates bend promises from a combat that has already ended. */
  private bendGeneration = 0;

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
    const resolved = resolveClip(loaded.clips, clip);
    if (!resolved) return null;
    const index = frameIndex(resolved, clipTime, clipFrame);
    const found = findFrame(loaded, resolved.def.frames[index]);
    if (!found) return null;
    return {
      source: found.image,
      frame: found.frame,
      pixelsPerTile: entry.pixelsPerTile,
      footprint: entry.footprint,
      // A trimmed clip (a G knockout, ADR 0059) stands by its own anchor.
      anchor: resolved.def.anchor ?? entry.anchor,
      headroom: loaded.headroom,
      clip: resolved.clip,
      index,
      placeholder: false,
    };
  }

  /**
   * Every clip `key`'s sheet draws once it has loaded, its fetched
   * `clipData` among them (ADR 0059); undefined before then, after it
   * failed, and for a key that is not a sheet. Asking starts the load.
   */
  clips(key: string): SheetClips | undefined {
    const entry = resolveAsset(key);
    return entry.kind === 'sheet' ? this.atlas(key, entry)?.clips : undefined;
  }

  /** Where `key`'s bend load stands (ADR 0055). Tests poll it. */
  bendState(key: string): BendLoadState {
    const entry = resolveAsset(key);
    if (entry.kind !== 'sheet' || !entry.bend) return 'none';
    const state = this.bends.get(key);
    if (state === 'loading' || state === 'failed') return state;
    if (state) return 'loaded';
    if (this.loaded.get(key) === 'failed') return 'failed';
    return this.bendsWanted.has(key) ? 'loading' : 'idle';
  }

  /**
   * Starts loading `key`'s bend, and its sheet first if that is not in yet,
   * so a scene about to bend (combat, at its start) has the cels by the first
   * cast. Otherwise the first `bendSet` or `bendFrame` starts it, and a scene
   * that never bends never fetches it.
   */
  preloadBend(key: string): void {
    const entry = resolveAsset(key);
    if (entry.kind === 'sheet') this.bend(key, entry);
  }

  /**
   * Forgets every loaded bend, so its pages can be collected: combat, the
   * one scene that bends, calls it on its way out, and preloads again at its
   * next start. A failed bend stays failed; one still loading is cancelled
   * so its eventual pages cannot be retained after combat has ended.
   */
  releaseBends(): void {
    this.bendGeneration++;
    this.bendsWanted.clear();
    for (const [key, state] of this.bends) if (state !== 'failed') this.bends.delete(key);
  }

  /**
   * The bend set `key`'s sheet names, once it has loaded; undefined before
   * then, after it failed, or when the sheet has no bend. Asking starts the load.
   */
  bendSet(key: string): BendSetDef | undefined {
    const entry = resolveAsset(key);
    return entry.kind === 'sheet' ? this.bend(key, entry)?.set : undefined;
  }

  /**
   * Cel `index` of `key`'s bend facing `heading`: the page and rectangle it is
   * on, the heading's own anchor, and its hold and sockets. Null until both
   * the sheet and its bend have loaded, after either failed, for a sheet with
   * no bend, for an index with no cel or no hold, and for a cel whose
   * rectangle is not its heading's `frameSize`. Asking starts the load.
   * Both backends draw a bending unit's cel from here (ADR 0055, step 7).
   */
  bendFrame(key: string, heading: Heading, index: number): ResolvedBendFrame | null {
    const entry = resolveAsset(key);
    if (entry.kind !== 'sheet') return null;
    const loaded = this.atlas(key, entry);
    const bend = this.bend(key, entry);
    const facing = bend?.set.facings[heading];
    if (!loaded || !bend || !facing) return null;
    const found = findFrame(bend, facing.frames[index]);
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
   * a clip never draws from half a sheet; a page that fails fails the sheet.
   * Its clip data (ADR 0059) rides along but is best-effort: if it is missing
   * or malformed, only the extra clips it carries are dropped, and a `koX`
   * falls back to the sheet's legacy `ko` pose. Its bend is not one of them.
   */
  private atlas(key: string, entry: SheetEntry): LoadedAtlas | null {
    const state = this.loaded.get(key);
    if (state && state !== 'loading' && state !== 'failed') return state;
    if (state !== undefined) return null;

    this.loaded.set(key, 'loading');
    const pages = Promise.all([entry.atlas, ...(entry.atlasPages ?? [])].map(loadPage));
    // A sheet's extra clips (ADR 0059) are optional to the sheet: losing the
    // file costs the clips it carries, not the art, so a `koX` resolves back
    // to the legacy `ko` pose (`resolveClip`). The schema is checked in CI
    // (`art:validate`), so this only types the parse.
    const clipsPromise = entry.clipData
      ? fetchText(entry.clipData)
          .then((text) => JSON.parse(text) as SheetClips)
          .catch((reason: unknown) => {
            console.warn(`Sheet "${key}" clip data failed; drawing its own clips.`, reason);
            return undefined;
          })
      : Promise.resolve(undefined);
    // Only a page failure rejects here; the clip data already caught its own.
    Promise.all([pages, clipsPromise])
      .then(([pages, fetched]) => {
        const clips: SheetClips = fetched ? { ...entry.clips, ...fetched } : entry.clips;
        this.loaded.set(key, {
          pages,
          clips,
          headroom: Math.max(
            ...pages.map((page) => atlasHeadroom(entry, page.atlas, page.image, clips)),
          ),
        });
        if (this.bendsWanted.has(key)) this.bend(key, entry);
      })
      .catch((reason: unknown) => {
        this.loaded.set(key, 'failed');
        this.bendsWanted.delete(key);
        console.warn(`Sheet "${key}" failed to load; using the drawn placeholder.`, reason);
      });
    return null;
  }

  /**
   * The loaded bend for a sheet key (ADR 0055), kicking off the load on first
   * ask but only once the sheet itself is in. Its pages and its data arrive
   * together or not at all, apart from the sheet, so a bend that fails leaves
   * the sheet, its locomotion and its stance drawing. A failed bend stays
   * failed for the session, as a failed sheet does: nothing retries.
   */
  private bend(key: string, entry: SheetEntry): LoadedBend | null {
    const path = entry.bend;
    if (!path) return null;
    const state = this.bends.get(key);
    if (state && state !== 'loading' && state !== 'failed') return state;
    if (state !== undefined) return null;
    if (!this.atlas(key, entry)) {
      if (this.loaded.get(key) !== 'failed') this.bendsWanted.add(key);
      return null;
    }

    this.bendsWanted.delete(key);
    this.bends.set(key, 'loading');
    const generation = this.bendGeneration;
    Promise.all([
      Promise.all((entry.bendPages ?? []).map(loadPage)),
      // Checked by its schema in CI (`art:validate`), so only typed here.
      fetchText(path).then((text) => JSON.parse(text) as BendSetDef),
    ])
      .then(([pages, set]) => {
        if (generation !== this.bendGeneration) return;
        this.bends.set(key, { pages, set });
      })
      .catch((reason: unknown) => {
        if (generation !== this.bendGeneration) return;
        this.bends.set(key, 'failed');
        console.warn(`The bend of "${key}" failed to load; the sheet still draws.`, reason);
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
