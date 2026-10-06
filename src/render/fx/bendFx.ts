/**
 * The painted bend effects' atlas, looked up (ADR 0055).
 *
 * `scripts/art/bend-effects.ts` packs every effect's sequences onto the pages
 * `BEND_FX` registers, one cel per `<sequence>/<index>`, and writes the
 * `BendEffectDef`s beside them. This module reads both as typed JSON, with no
 * schema (`art:validate` holds them to it), and answers what a layer draws:
 * which cel at a given time, where on which page, and how the cel is placed:
 * its pivot, and whether the runtime turns it toward the travel direction,
 * turns it by a fixed angle, or stretches it between two points.
 *
 * Consumers draw from it now; it is the lookup those steps use.
 */

import type { BendEffectDef, BendEffectLayer } from '../../content/bends';
import { effectCelName } from '../../content/fxCels';
import { parseAtlasJson } from '../sheets/atlasJson';
import type { AtlasFrame } from '../sheets/atlasJson';

/**
 * How a cel is placed. Angles are degrees clockwise of +x on screen, the way
 * `atan2(dy, dx)` measures with y pointing down.
 */
export interface BendFxCelMeta {
  /** The cel point placed on the socket, tile or path point, in cel pixels from its corner. */
  readonly pivot: { readonly x: number; readonly y: number };
  /** The direction the art points: the runtime turns it by `travel - facing`. */
  readonly facing?: number;
  /** A fixed turn, whatever the travel direction. */
  readonly angle?: number;
  /**
   * The cel is a segment laid between two points: centred on their midpoint,
   * turned along them, and its whole width stretched to this many times their
   * distance (its ink overshoots the points a little, as the prototype drew it).
   */
  readonly segment?: number;
}

export interface BendFxCel {
  readonly name: string;
  /** The page's image, relative to the site root. */
  readonly image: string;
  readonly frame: AtlasFrame;
  readonly meta: BendFxCelMeta;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** One page's cels. `path` is the page JSON's, so its image resolves beside it. */
export function parseBendFxPage(input: unknown, path: string): Map<string, BendFxCel> {
  const raw = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  const atlas = parseAtlasJson(raw);
  const entries = (raw as { frames: Record<string, { fx?: Partial<BendFxCelMeta> }> }).frames;
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  const cels = new Map<string, BendFxCel>();
  for (const [name, frame] of atlas.frames) {
    const fx = entries[name]?.fx;
    const pivot = fx?.pivot;
    if (!pivot || !finite(pivot.x) || !finite(pivot.y))
      throw new Error(`Effect cel "${name}" has no pivot.`);
    for (const key of ['facing', 'angle', 'segment'] as const) {
      if (fx[key] !== undefined && !finite(fx[key]))
        throw new Error(`Effect cel "${name}" has a ${key} that is not a number.`);
    }
    const meta: BendFxCelMeta = {
      pivot: { x: pivot.x, y: pivot.y },
      ...(fx.facing === undefined ? {} : { facing: fx.facing }),
      ...(fx.angle === undefined ? {} : { angle: fx.angle }),
      ...(fx.segment === undefined ? {} : { segment: fx.segment }),
    };
    cels.set(name, { name, image: `${dir}${atlas.image}`, frame, meta });
  }
  return cels;
}

/**
 * The cel a sequence shows `elapsedMs` into it, by its cumulative `frameMs`.
 * A looping sequence wraps; one that plays once returns null after its last
 * cel, so a finished layer draws nothing. Time before the start is its first cel.
 */
export function celIndexAt(
  frameMs: readonly number[],
  elapsedMs: number,
  loop: boolean,
): number | null {
  const total = frameMs.reduce((sum, ms) => sum + ms, 0);
  if (frameMs.length === 0 || total <= 0) return null;
  let t = Math.max(0, elapsedMs);
  if (loop) t %= total;
  else if (t >= total) return null;
  for (const [index, ms] of frameMs.entries()) {
    if (t < ms) return index;
    t -= ms;
  }
  return frameMs.length - 1;
}

/** Travel loops for as long as the flight takes; every other phase plays once. */
export const layerLoops = (layer: BendEffectLayer): boolean => layer.phase === 'travel';

export interface BendFxIndex {
  effect(id: string): BendEffectDef | undefined;
  /** The layers one release of an attack plays: those keyed to it and those keyed to none. */
  layersFor(effectId: string, release: number): readonly BendEffectLayer[];
  cel(name: string): BendFxCel | undefined;
  /** The cel a layer shows `elapsedMs` after its phase begins, or null once it is done. */
  layerCel(layer: BendEffectLayer, elapsedMs: number): BendFxCel | null;
  /** Every page image a cel is on, so a caller can have them decoded before the first draw. */
  readonly images: readonly string[];
}

/**
 * Indexes the effects over their pages. Throws when a layer names a cel no
 * page carries, or a cel is on two pages: a bad load must fail loudly, never
 * draw nothing.
 */
export function bendFxIndex(
  effects: readonly BendEffectDef[],
  pages: readonly ReadonlyMap<string, BendFxCel>[],
): BendFxIndex {
  const cels = new Map<string, BendFxCel>();
  for (const page of pages) {
    for (const [name, cel] of page) {
      if (cels.has(name)) throw new Error(`Effect cel "${name}" is on two pages.`);
      cels.set(name, cel);
    }
  }
  const byId = new Map(effects.map((effect) => [effect.id, effect]));
  for (const effect of effects) {
    for (const layer of effect.layers) {
      layer.frameMs.forEach((_, index) => {
        const name = effectCelName(layer.sequence, index);
        if (!cels.has(name)) throw new Error(`Effect "${effect.id}" needs cel "${name}".`);
      });
    }
  }
  return {
    effect: (id) => byId.get(id),
    layersFor: (effectId, release) =>
      (byId.get(effectId)?.layers ?? []).filter(
        (layer) => layer.release === undefined || layer.release === release,
      ),
    cel: (name) => cels.get(name),
    layerCel: (layer, elapsedMs) => {
      const index = celIndexAt(layer.frameMs, elapsedMs, layerLoops(layer));
      return index === null ? null : (cels.get(effectCelName(layer.sequence, index)) ?? null);
    },
    images: [...new Set([...cels.values()].map((cel) => cel.image))],
  };
}

/** `fetch` as JSON, rejecting a response that is not ok. */
export async function fetchJson(
  url: string,
  get: (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>> = fetch,
): Promise<unknown> {
  const response = await get(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

/**
 * Fetches the registered effects and pages (`BEND_FX`, relative to `base`)
 * and indexes them. The page images are not fetched: that is the drawing's
 * business, through the cel's `image`. A response that is not ok rejects,
 * rather than parsing an error page as data.
 */
export async function loadBendFx(
  registration: { readonly data: string; readonly pages: readonly string[] },
  base: string,
  get: (url: string) => Promise<unknown> = fetchJson,
): Promise<BendFxIndex> {
  const [effects, ...pages] = await Promise.all([
    get(`${base}${registration.data}`),
    ...registration.pages.map((page) => get(`${base}${page}`)),
  ]);
  return bendFxIndex(
    effects as BendEffectDef[],
    pages.map((page, index) => parseBendFxPage(page, registration.pages[index] ?? '')),
  );
}
