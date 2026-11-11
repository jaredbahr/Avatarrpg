/**
 * What both backends need to draw a top-down board's surfaces (#458): the board's `TopdownSurfaces`,
 * brought up to the view's grid each frame (a no-op unless a surface changed), and the PixelLab
 * ground flames' atlas (`public/art/topdown/vfx.json`, packed by `pack-vfx.ts`), fetched the first
 * time a top-down board shows fire. Rubble stays on the board's own drawing (#577 gives it a sprite).
 */
import type { Grid, SurfaceId } from '../../core/types';
import { BackdropStore } from '../backdrops';
import { surfaceIsPainted } from '../sceneSurfaces';
import { assetUrl } from '../spriteCache';
import type { MapView } from '../view';
import { CS } from './organic';
import { rgbaCanvas } from './propLayer';
import { TopdownSurfaces, type FlameSite, type SurfaceArt } from './surfaces';

/** The surfaces the organic layer paints on a top-down board (rubble is a sprite, `structures.ts`). */
export const ORGANIC_SURFACES: ReadonlySet<SurfaceId> = new Set([
  'mud',
  'water',
  'oil',
  'ice',
  'fire',
  'steam',
]);

/**
 * Whether a board draws its surfaces organically: the top-down board, except where the player asked
 * for the cell-exact reading (the colourblind hatch, High contrast), which keeps the cell drawing.
 */
export function drawsOrganicSurfaces(
  view: Pick<MapView, 'hatch' | 'crispOverlays'>,
  projection: string,
): boolean {
  return projection === 'topdown' && !view.hatch && !view.crispOverlays;
}

/**
 * Whether a tile's surface is drawn by the top-down board's own art (the cell painters then skip
 * it): the organic layer's surfaces, and rubble, which stands as a heap sprite (#577).
 */
export function organicOwns(organic: boolean, surface: SurfaceId | undefined): boolean {
  return (
    organic && surface !== undefined && (ORGANIC_SURFACES.has(surface) || surface === 'rubble')
  );
}

let board: TopdownSurfaces | null = null;
const filtered = new WeakMap<Grid, { painted: boolean; grid: Grid }>();

/**
 * The view's surfaces as the organic layer draws them, `painted` saying whether the scene's art is in
 * (a surface the scene paints itself, such as its own pool, is left to the art).
 */
export function surfaceArt(view: MapView, painted: boolean): SurfaceArt {
  let grid =
    filtered.get(view.grid)?.painted === painted ? filtered.get(view.grid)?.grid : undefined;
  if (!grid) {
    const source = view.grid;
    grid = {
      ...source,
      tiles: source.tiles.map((tile, i) =>
        tile.surface &&
        (!ORGANIC_SURFACES.has(tile.surface.id) ||
          surfaceIsPainted(view, painted, tile, {
            x: i % source.width,
            y: Math.floor(i / source.width),
          }))
          ? { ...tile, surface: null }
          : tile,
      ),
    };
    filtered.set(view.grid, { painted, grid });
  }
  if (!board || board.layout !== TopdownSurfaces.layoutKey(grid)) board = new TopdownSurfaces(grid);
  board.update(grid);
  return board.art;
}

/* ------------------------------------------------------------------ */
/* The ground flames                                                   */
/* ------------------------------------------------------------------ */

export interface FlameFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One flame sheet: its cels in the atlas and its pivot (the foot), in px. */
export interface FlameSheet {
  readonly frames: readonly FlameFrame[];
  readonly pivot: { readonly x: number; readonly y: number };
}

export interface FlameAtlas {
  readonly url: string;
  readonly sheets: Readonly<Record<FlameSite['sheet'], FlameSheet>>;
}

const VFX_JSON = 'art/topdown/vfx.json';
const SHEETS = ['fire_ground_a', 'fire_ground_b', 'fire_ground_c'] as const;

let atlas: FlameAtlas | null | undefined;
let request: Promise<void> | null = null;
export const flameImages = new BackdropStore(1, 'Top-down flames', 'drawing the fire still');

interface VfxJson {
  frames: Record<string, { frame: FlameFrame }>;
  effects: Record<string, { frames: string[]; pivot: { x: number; y: number } }>;
  meta: { image: string };
}

/** Reads the packed atlas's flame sheets; null when any is missing. */
export function flameAtlasFrom(json: unknown): FlameAtlas | null {
  const data = json as Partial<VfxJson> | null;
  if (!data?.frames || !data.effects || !data.meta?.image) return null;
  const sheets = {} as Record<FlameSite['sheet'], FlameSheet>;
  for (const name of SHEETS) {
    const effect = data.effects[`vfx13/${name}`];
    const frames = effect?.frames.map((key) => data.frames?.[key]?.frame);
    if (!effect || !frames?.length || frames.some((f) => !f)) return null;
    sheets[name] = { frames: frames as FlameFrame[], pivot: effect.pivot };
  }
  return { url: `art/topdown/${data.meta.image}`, sheets };
}

/** The flame atlas and its decoded page once both are in; asks for them the first time. */
export function flames(
  fetcher: typeof fetch | undefined = typeof fetch === 'undefined' ? undefined : fetch,
): { atlas: FlameAtlas; image: HTMLImageElement } | null {
  if (atlas === undefined && !request && fetcher) {
    request = fetcher(assetUrl(VFX_JSON))
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        atlas = flameAtlasFrom(json);
      })
      .catch(() => {
        atlas = null;
      });
  }
  if (!atlas) return null;
  const image = flameImages.get(atlas.url);
  return image ? { atlas, image } : null;
}

/** Test seam: set the atlas as if fetched, or forget it. */
export function setFlameAtlas(next: FlameAtlas | null | undefined): void {
  atlas = next;
  request = null;
}

/** How long a newly caught cell shows only small licks (`surfvis.js`: 500 ms). */
export const CATCH_MS = 500;
const born = new Map<string, number>();

/**
 * The sheet a site shows at `time`: a cell that caught within {@link CATCH_MS} shows only the small
 * licks, so fire visibly creeps from cell to cell; still (`time` null), every site its own sheet.
 */
export function flameSheet(site: FlameSite, time: number | null, burning: ReadonlySet<string>) {
  for (const key of [...born.keys()]) if (!burning.has(key)) born.delete(key);
  if (time === null) return site.sheet;
  if (!born.has(site.cell)) born.set(site.cell, time);
  return time - (born.get(site.cell) ?? time) < CATCH_MS ? 'fire_ground_b' : site.sheet;
}

/** The depth point of a flame in cells (its foot, a px below the site), as `boardDepth` reads it. */
export function flameFoot(site: FlameSite): { x: number; y: number } {
  return { x: site.x / CS, y: (site.y + 1) / CS };
}

let canvases: {
  version: number;
  layer: HTMLCanvasElement | null;
  glow: HTMLCanvasElement | null;
} | null = null;

/**
 * The layer and the glow as canvases both backends draw (Pixi through its bounded texture map),
 * remade only when the surfaces change.
 */
export function surfaceCanvases(art: SurfaceArt): {
  layer: HTMLCanvasElement | null;
  glow: HTMLCanvasElement | null;
} {
  if (canvases?.version === art.version) return canvases;
  canvases = {
    version: art.version,
    layer: rgbaCanvas({ ...art.layer, data: art.layer.data.slice() }),
    glow: art.flames.length ? rgbaCanvas({ ...art.glow, data: art.glow.data.slice() }) : null,
  };
  return canvases;
}

/** A steam puff's stepped pixel ellipse, row by row (`drawSteam`'s `ell`): x, width, alpha. */
export function puffRows(
  cx: number,
  cy: number,
  rw: number,
  rh: number,
): { x: number; y: number; w: number }[] {
  const out: { x: number; y: number; w: number }[] = [];
  for (let j = -rh; j <= rh; j++) {
    const w = Math.round(rw * Math.sqrt(Math.max(0, 1 - (j / (rh + 0.5)) ** 2)));
    if (w) out.push({ x: cx - w, y: cy + j, w: 2 * w });
  }
  return out;
}
