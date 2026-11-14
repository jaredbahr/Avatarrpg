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
import {
  actionClip,
  headingClip,
  hitClip,
  HEADINGS,
  KO_HEADINGS,
  koClip,
} from '../../content/assets/clips';
import type { SheetEntry } from '../../content/assets/manifest';
import { resolveAsset } from '../../content/assets/manifest';
import { resolvePainter } from '../painters/registry';
import { assetUrl } from '../spriteCache';
import type { AtlasFrame, AtlasJson } from './atlasJson';
import { parseAtlasJson } from './atlasJson';
import type { BakedSheet } from './bake';
import { bakeSheet, frameHeadroom, headroomFromPixels } from './bake';
import { frameIndex, resolveClip } from './resolveClip';
import { feetFromPixels, plantAnchor, standsOnSoles, type FrameFeet } from './feet';
import { cropPixels, readPagePixels, type PagePixels } from './pagePixels';

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
  /**
   * Where its drawn soles meet the ground, in frame px, for a standing or walking cel of an atlas whose pixels could
   * be read (ADR 0093's planting amendment); its `anchor` already stands on them.
   */
  readonly feet?: FrameFeet;
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
  /** Each standing or walking cel's feet, by frame name, measured once when the atlas loads. */
  readonly feet: ReadonlyMap<string, FrameFeet>;
}

export type SheetLoadState = 'ready' | 'loading' | 'failed';

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
  const page = readPagePixels(image, atlas.width, atlas.height);
  let envelope = 0;
  for (const [name, anchorY] of names) {
    const frame = atlas.frames.get(name);
    if (!frame || frame.w === 0 || frame.h === 0) continue;
    const height = page
      ? headroomFromPixels(cropPixels(page, frame), frame.w, frame.h, entry.pixelsPerTile, anchorY)
      : frameHeadroom(frame, anchorY, entry.pixelsPerTile);
    envelope = Math.max(envelope, height);
  }
  return envelope;
}

/**
 * The feet of every standing or walking cel an atlas page holds (`feetFromPixels`), read once when it loads. Empty
 * where pixels cannot be read (no DOM, a tainted image): those cels keep their authored anchor.
 */
export function atlasFeet(
  entry: SheetEntry,
  atlas: AtlasJson,
  image: CanvasImageSource,
  clips: SheetClips = entry.clips,
): Map<string, FrameFeet> {
  const feet = new Map<string, FrameFeet>();
  let page: PagePixels | null;
  try {
    page = readPagePixels(image, atlas.width, atlas.height);
  } catch {
    return feet;
  }
  if (!page) return feet;
  for (const [clip, def] of Object.entries(clips))
    if (def && standsOnSoles(clip))
      for (const name of def.frames) {
        const frame = atlas.frames.get(name);
        if (feet.has(name) || !frame || frame.w === 0 || frame.h === 0) continue;
        const found = feetFromPixels(
          cropPixels(page, frame),
          frame.w,
          frame.h,
          entry.pixelsPerTile,
        );
        if (found) feet.set(name, found);
      }
  return feet;
}

/** A top-down sheet's actions file (ADR 0104): clips by pose, then by heading. */
export type SheetActions = Readonly<Record<string, Readonly<Partial<Record<Heading, ClipDef>>>>>;

/**
 * A top-down sheet's clips with its actions in (ADR 0104): each pose as `pose@heading`, each ability its
 * `actionMap` names as `abilityId@heading` and any other as `cast@heading`, and the map's idle pose looping
 * in place of the idle. Every heading's hits, knockouts and actions stand on the ground its idle is planted
 * on (`plantAnchor`, which moves the idle a pixel or two onto its soles), so the figure does not hop when
 * one starts or ends: they are cut round the same foot point as the idle.
 */
export function withActions(
  entry: SheetEntry,
  clips: SheetClips,
  actions: SheetActions,
  feet: ReadonlyMap<string, FrameFeet>,
  frameOf: (name: string) => AtlasFrame | undefined,
): SheetClips {
  const out: Partial<Record<ClipName, ClipDef>> = { ...clips };
  const map = entry.actionMap;
  for (const heading of HEADINGS) {
    const idle = headingClip('idle', heading);
    const name = clips[idle]?.frames[0];
    const frame = name === undefined ? undefined : frameOf(name);
    const lift = frame
      ? (plantAnchor(idle, entry.anchor, frame, feet.get(name ?? ''), entry.pixelsPerTile).y -
          entry.anchor.y) *
        frame.h
      : 0;
    const planted = (def: ClipDef | undefined): ClipDef | undefined =>
      def?.anchor && def.frameSize && lift
        ? { ...def, anchor: { x: def.anchor.x, y: def.anchor.y + lift / def.frameSize.h } }
        : def;
    const own = [hitClip(heading), ...KO_HEADINGS.filter((ko) => ko === heading).map(koClip)];
    for (const clip of own) {
      const def = planted(clips[clip]);
      if (def) out[clip] = def;
    }
    for (const [pose, byHeading] of Object.entries(actions)) {
      const def = planted(byHeading[heading]);
      if (def) out[actionClip(pose, heading)] = def;
    }
    const cast = out[actionClip(map?.cast ?? '', heading)];
    if (cast) out[actionClip('cast', heading)] = cast;
    for (const [ability, pose] of Object.entries(map?.abilities ?? {})) {
      const def = out[actionClip(pose, heading)];
      if (def) out[actionClip(ability, heading)] = def;
    }
    const loop = out[actionClip(map?.idle ?? '', heading)];
    if (loop) out[idle] = { ...loop, loop: true };
  }
  return out;
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
  private loading = new Map<string, Promise<boolean>>();

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
   * Starts the existing atlas load and reports its state without baking a
   * fallback. Non-sheet actors have no atlas to hold a scene reveal for.
   */
  loadState(key: string): SheetLoadState {
    const entry = resolveAsset(key);
    if (entry.kind !== 'sheet') return 'ready';
    this.atlas(key, entry);
    const state = this.loaded.get(key);
    if (state === 'loading' || state === 'failed') return state;
    return 'ready';
  }

  /** Settles true when the existing sheet load is resident, false on failure. */
  whenLoaded(key: string): Promise<boolean> {
    const state = this.loadState(key);
    if (state === 'ready') return Promise.resolve(true);
    if (state === 'failed') return Promise.resolve(false);
    return this.loading.get(key) ?? Promise.resolve(false);
  }

  /** Loaded silhouette envelope, without baking a painter fallback at a new size. */
  silhouetteHeadroom(key: string): number | null {
    const entry = resolveAsset(key);
    if (entry.kind !== 'sheet') return null;
    return this.atlas(key, entry)?.headroom ?? null;
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
    heightTiles: 1 | 2 = 1,
  ): ResolvedFrame | null {
    const entry = resolveAsset(key);
    if (entry.kind === 'sheet') {
      const atlas = this.atlas(key, entry);
      if (atlas) return this.fromAtlas(entry, atlas, clip, clipTime, clipFrame, meleeDirection);
    }
    const sheet = this.bake(key, pixelsPerTile, widthTiles, heightTiles);
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
    const name = resolved.def.frames[index];
    const found = findFrame(loaded, name);
    if (!found) return null;
    const feet = name === undefined ? undefined : loaded.feet.get(name);
    return {
      source: found.image,
      frame: found.frame,
      pixelsPerTile: entry.pixelsPerTile,
      footprint: entry.footprint,
      // A trimmed clip (a G knockout, ADR 0059) stands by its own anchor; a standing or
      // walking cel stands on its own soles (ADR 0093's planting amendment).
      anchor: plantAnchor(
        resolved.clip,
        resolved.def.anchor ?? entry.anchor,
        found.frame,
        feet,
        entry.pixelsPerTile,
      ),
      headroom: loaded.headroom,
      clip: resolved.clip,
      index,
      placeholder: false,
      ...(feet ? { feet } : {}),
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

  private bake(
    key: string,
    pixelsPerTile: number,
    widthTiles: 1 | 2,
    heightTiles: 1 | 2 = 1,
  ): BakedSheet | null {
    const px = Math.min(
      MAX_BAKE_PX,
      Math.max(SIZE_BUCKET, Math.round(pixelsPerTile / SIZE_BUCKET) * SIZE_BUCKET),
    );
    const cacheKey = `${key}|${px}|${widthTiles}|${heightTiles}`;
    const existing = this.baked.get(cacheKey);
    if (existing) {
      this.baked.delete(cacheKey);
      this.baked.set(cacheKey, existing);
      return existing;
    }
    const sheet = bakeSheet(key, resolvePainter(key), px, widthTiles, heightTiles);
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
   * falls back to the sheet's legacy `ko` pose.
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
    // A top-down sheet's actions (ADR 0104) are optional the same way: without them, the legacy cast plays.
    const actionsPromise = entry.actions
      ? fetchText(entry.actions)
          .then((text) => JSON.parse(text) as SheetActions)
          .catch((reason: unknown) => {
            console.warn(`Sheet "${key}" actions failed; drawing its cast.`, reason);
            return undefined;
          })
      : Promise.resolve(undefined);
    // Only a page failure rejects here; the clip data already caught its own.
    const loading = Promise.all([pages, clipsPromise, actionsPromise])
      .then(([pages, fetched, actions]) => {
        const clips: SheetClips = fetched ? { ...entry.clips, ...fetched } : entry.clips;
        const feet = new Map(
          pages.flatMap((page) => [...atlasFeet(entry, page.atlas, page.image, clips)]),
        );
        this.loaded.set(key, {
          pages,
          // The bar's envelope and the measured feet stay those of the clips before the actions.
          clips: actions
            ? withActions(entry, clips, actions, feet, (name) => findFrame({ pages }, name)?.frame)
            : clips,
          headroom: Math.min(
            entry.uiHeadroomCap ?? Number.POSITIVE_INFINITY,
            Math.max(...pages.map((page) => atlasHeadroom(entry, page.atlas, page.image, clips))),
          ),
          feet,
        });
        return true;
      })
      .catch((reason: unknown) => {
        this.loaded.set(key, 'failed');
        console.warn(`Sheet "${key}" failed to load; using the drawn placeholder.`, reason);
        return false;
      });
    this.loading.set(key, loading);
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
