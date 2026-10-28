/** One scene light shared by painted geometry and both runtime backends. */
export const KEY_LIGHT_SCREEN = { x: -0.72, y: -0.69 } as const;
/** Bible ink; shadows are tinted once after all silhouettes have been unioned. */
export const SHADOW_COLOR = '#1b1410';
export const SHADOW_RGB = [27, 20, 16] as const;
/** Measured on the quarry reference: cast ground is ~0.65 of the lit ground beside it. */
export const CAST_SHADOW_ALPHA = 0.4;
/**
 * Form shading, ink laid over a solid's faces, so a block reads as a lit top
 * over a mid-tone face over a darker one. Measured on the reference block, its
 * two side faces sit at ~0.75 and ~0.53 of the lit top. The key is upper-left:
 * the south face only grazes it and the east face turns away; `foot` darkens
 * either toward the ground.
 *
 * `FACE_SHADE` is for procedural faces (palettes ELEVATION), which copy the
 * flat ground and so start as bright as the top. `PAINTED_FACE_SHADE` is the
 * extra for the quarry's painted cubes, whose art already carries about 0.91
 * (south) and 0.62 (east) of its top, and lands them on the same two targets.
 */
export const FACE_SHADE = { south: 0.36, east: 0.55, foot: 0.14 } as const;
export const PAINTED_FACE_SHADE = { south: 0.16, east: 0.135, foot: 0.08 } as const;
export const REDUCED_CAST_ALPHA = 0.72;
export const CONTACT_SHADOW_ALPHA = 0.3;
export const FALLEN_SHADOW_ALPHA = 0.52;

/**
 * Screen-space projection of an upright silhouette onto the ground. Both the
 * orthographic and oblique cameras keep vertical objects upright on screen,
 * so the same foot-anchored projection applies: every pixel above the foot
 * travels down-right, opposite the upper-left key. This is the key the runtime
 * scenery, the procedural structure and the figures of a scene that names no
 * key of its own all share.
 */
export const CAST_PER_PIXEL = { x: 0.42, y: 0.27 } as const;

/** A cast key: how far a pixel `h` above the foot lands, `x * h` right and `y * h` down. */
export interface CastKey {
  readonly x: number;
  readonly y: number;
}

/**
 * How a scene grounds the figures and props standing in it (ADR 0077, ADR 0093).
 * `cast` is the alpha of a figure's ground pool and short cast and of a prop's
 * cast, and `castKey` the direction and length they fall along, which a painted
 * scene sets to its painting's own; `contact` is the tighter, darker layer: the
 * core under a figure's soles and the line under a prop's base. Every scene has
 * a contact layer: `0` would leave a figure and a prop on nothing.
 */
export interface ActorGrounding {
  readonly cast: number;
  readonly contact: number;
  readonly castKey: CastKey;
  /**
   * The colour the shadow union is tinted with, 0-255 a channel. A painted scene sets the ink that,
   * at its `cast` and `contact` levels, lands on its painting's own shadow tone (ADR 0093's figure
   * amendment); one that sets none keeps the bible ink `SHADOW_RGB`.
   */
  readonly ink: ShadowInk;
}

export interface ShadowInk {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export const DEFAULT_SHADOW_INK: ShadowInk = {
  r: SHADOW_RGB[0],
  g: SHADOW_RGB[1],
  b: SHADOW_RGB[2],
};

/** The ink as a CSS colour, for Canvas. */
export function inkColor(ink: ShadowInk): string {
  return `rgb(${ink.r}, ${ink.g}, ${ink.b})`;
}

/**
 * The contact a scene that sets nothing gets. The forest road and the quarry
 * paint no shadows of their own, so the runtime is their only grounding: this
 * keeps the contact clearly darker than the 0.4 cast it sits in, without the
 * black rim a full-strength contact read as.
 */
export const DEFAULT_CONTACT_ALPHA = 0.6;

export const DEFAULT_ACTOR_GROUNDING: ActorGrounding = {
  cast: CAST_SHADOW_ALPHA,
  contact: DEFAULT_CONTACT_ALPHA,
  castKey: CAST_PER_PIXEL,
  ink: DEFAULT_SHADOW_INK,
};

export function actorGrounding(
  scene?: { readonly actorGrounding?: Partial<ActorGrounding> } | null,
): ActorGrounding {
  const own = scene?.actorGrounding;
  return own ? { ...DEFAULT_ACTOR_GROUNDING, ...own } : DEFAULT_ACTOR_GROUNDING;
}

/**
 * The shadow union is tinted once at its strongest alpha; every caster writes
 * its own alpha as a fraction of that, so a scene that sets nothing keeps the
 * single `CAST_SHADOW_ALPHA` and coverage 1.
 */
export function shadowCeiling(grounding: Pick<ActorGrounding, 'cast' | 'contact'>): number {
  return Math.max(CAST_SHADOW_ALPHA, grounding.cast, grounding.contact);
}

/**
 * How far a prop's contact line sits below its silhouette, in world pixels. The
 * painting's G1 objects meet the ground on a 1 px line (`objects.py`), but a
 * prop's art is four pixels to a world pixel and its outline lands mid-texel,
 * covering half of a 1 px line; at 2 a whole world pixel shows under every edge.
 */
export const CONTACT_LINE = 2;

/**
 * A figure's ground shadow (ADR 0093's figure amendment; owner, 2026-10-28: "the shadows make them look
 * off"). Not its silhouette: a calm pool under the feet, the shape the painting gives its own objects,
 * and a short cast along the scene's key. Sizes are in tiles of the figure's own scale, so a figure
 * drawn larger casts a larger pool.
 *
 * - `pool`: the ellipse at the feet, half-width and half-height (2:1, as the ground is).
 * - `core`: the tighter ellipse under the soles at the contact level, as the painting's contact line.
 * - `reach`: how far the pool is swept along the key, as the height (tiles) a pixel is cast from, so
 *   the key's own slope and length set the direction; never more than `maxReach` of `height`, the
 *   figure's height, which keeps the cast to about a quarter of it.
 * - `taper`: the swept ellipse's size at the cast's far end, as a fraction of the pool's.
 */
export const FIGURE_SHADOW = {
  pool: { rx: 0.18, ry: 0.08 },
  core: { rx: 0.11, ry: 0.03 },
  reach: 0.6,
  height: 1.15,
  maxReach: 0.25,
  taper: 0.7,
} as const;

/** Levels in a `figureShadow` mask. */
export const FIGURE_CAST = 1;
export const FIGURE_CONTACT = 2;

/** A figure's ground shadow on the world-pixel grid: one byte a world pixel, 0, `FIGURE_CAST` or `FIGURE_CONTACT`. */
export interface FigureShadow {
  readonly width: number;
  readonly height: number;
  /** The foot's position in the mask, in world pixels from its top-left corner. */
  readonly footX: number;
  readonly footY: number;
  readonly mask: Uint8Array;
}

/** The sweep along the key the cast runs to, in world pixels from the foot. */
export function figureCastReach(tilePx: number, key: CastKey): { x: number; y: number } {
  const full = { x: key.x * FIGURE_SHADOW.reach * tilePx, y: key.y * FIGURE_SHADOW.reach * tilePx };
  const cap = FIGURE_SHADOW.maxReach * FIGURE_SHADOW.height * tilePx;
  const length = Math.hypot(full.x, full.y);
  const k = length > cap ? cap / length : 1;
  return { x: full.x * k, y: full.y * k };
}

/**
 * Rasterises a figure's ground shadow at `tilePx` world pixels a tile, `widthTiles` wide (a two-tile
 * figure's pool is twice as wide): the pool swept along `key` and tapering, with the core under the
 * feet. Every pixel is in or out by its centre, so the edge steps a whole world pixel, as the
 * painting's do. It depends on nothing a figure's legs do, so it is steady across every cel.
 */
export function figureShadow(tilePx: number, key: CastKey, widthTiles = 1): FigureShadow {
  const pool = {
    rx: FIGURE_SHADOW.pool.rx * widthTiles * tilePx,
    ry: FIGURE_SHADOW.pool.ry * widthTiles * tilePx,
  };
  const core = {
    rx: FIGURE_SHADOW.core.rx * widthTiles * tilePx,
    ry: FIGURE_SHADOW.core.ry * widthTiles * tilePx,
  };
  const reach = figureCastReach(tilePx, key);
  const left = Math.floor(-pool.rx) - 1;
  const top = Math.floor(-pool.ry) - 1;
  const width = Math.ceil(pool.rx + reach.x) + 2 - left;
  const height = Math.ceil(pool.ry + reach.y) + 2 - top;
  const mask = new Uint8Array(width * height);
  const steps = Math.max(8, Math.ceil(Math.hypot(reach.x, reach.y) * 2));
  const inside = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
    rx > 0 && ry > 0 && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let j = 0; j < height; j += 1)
    for (let i = 0; i < width; i += 1) {
      const x = left + i + 0.5;
      const y = top + j + 0.5;
      let level = 0;
      if (inside(x, y, 0, 0, Math.max(1, core.rx), Math.max(1, core.ry))) level = FIGURE_CONTACT;
      else
        for (let t = 0; t <= steps; t += 1) {
          const f = t / steps;
          const s = 1 - (1 - FIGURE_SHADOW.taper) * f;
          if (inside(x, y, reach.x * f, reach.y * f, pool.rx * s, pool.ry * s)) {
            level = FIGURE_CAST;
            break;
          }
        }
      mask[j * width + i] = level;
    }
  return { width, height, footX: -left, footY: -top, mask };
}

/**
 * Whether a figure or prop gets a contact under it: any that casts, in a scene
 * with a contact layer, which every oblique board has (ADR 0093). Nothing else
 * grounds a figure; one that casts nothing draws no shadow at all.
 */
export function contactBand(
  grounding: Pick<ActorGrounding, 'contact'>,
  castStrength: number,
): boolean {
  return grounding.contact > 0 && castStrength > 0;
}

export interface ShadowProjection {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export interface ShadowCell {
  readonly blocked: boolean;
  readonly elevation: number;
}

/**
 * The part of a tile that stands up and so casts. Only a `wall` is a block of
 * its own; other blocked tiles (water, a pit, a tree's or a house's footprint)
 * are flat, or are drawn by scenery that casts its own silhouette.
 */
export function tileShadowCell(
  tile:
    { readonly terrain: string; readonly blocked: boolean; readonly elevation: number } | undefined,
): ShadowCell | undefined {
  return tile && { blocked: tile.blocked && tile.terrain === 'wall', elevation: tile.elevation };
}

export interface StructureShadowPolygon {
  readonly source: { readonly x: number; readonly y: number };
  readonly receiver: { readonly x: number; readonly y: number };
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

/** Canvas/Pixi affine coefficients; `(footX, footY)` remains fixed. */
export function silhouetteProjection(
  footX: number,
  footY: number,
  key: CastKey = CAST_PER_PIXEL,
): ShadowProjection {
  // Horizontal coordinates already remain anchored under this shear; retaining
  // footX in the API makes the two-dimensional anchor contract explicit.
  void footX;
  return {
    a: 1,
    b: 0,
    c: -key.x,
    d: -key.y,
    e: key.x * footY,
    f: footY * (1 + key.y),
  };
}

export function projectShadowPoint(
  point: { readonly x: number; readonly y: number },
  foot: { readonly x: number; readonly y: number },
  key: CastKey = CAST_PER_PIXEL,
): { x: number; y: number } {
  const rise = foot.y - point.y;
  return { x: point.x + rise * key.x, y: foot.y + rise * key.y };
}

/**
 * Where the shared shadow mask's texels lie (ADR 0093). The world is pixel art
 * on a world-pixel grid, so a shadow is too: one mask texel per world pixel,
 * its edges on the same grid as the art beside it, sampled nearest both ways,
 * so a cast or a contact band is hard-edged and stepped, never a blur.
 *
 * `scale` is CSS px per world px and `offset` the screen offset of world (0, 0)
 * negated, as the camera keeps them; the origin is the screen point of the first
 * texel corner at or left of / above the viewport's. The mask is one texel wider
 * and taller than the viewport so the shifted grid still covers it.
 */
export interface ShadowGrid {
  /** CSS px per texel (the camera scale: one world pixel). */
  readonly texel: number;
  /** Screen position of texel (0, 0)'s top-left corner, CSS px, at or before 0. */
  readonly originX: number;
  readonly originY: number;
  /** Texels across and down. */
  readonly width: number;
  readonly height: number;
}

export function shadowGrid(
  viewport: { readonly width: number; readonly height: number },
  scale: number,
  offsetX: number,
  offsetY: number,
): ShadowGrid {
  const texel = scale > 0 && Number.isFinite(scale) ? scale : 1;
  // World pixel k's left edge is on screen at k * texel - offsetX.
  const phase = (offset: number) => {
    const r = -offset % texel;
    return r > 0 ? r - texel : r;
  };
  const originX = phase(offsetX);
  const originY = phase(offsetY);
  return {
    texel,
    originX,
    originY,
    width: Math.ceil((viewport.width - originX) / texel),
    height: Math.ceil((viewport.height - originY) / texel),
  };
}

/**
 * Shadow swept from a renderer-drawn raised edge. `edge` is the top lip and
 * `height` its screen-space rise above the receiving ground. Keeping this
 * primitive independent of either backend makes procedural height answer the
 * same key as sprite silhouettes.
 */
export function projectRaisedEdgeShadow(
  edge: readonly [
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
  ],
  height: number,
): readonly { x: number; y: number }[] {
  const dx = Math.max(0, height) * CAST_PER_PIXEL.x;
  const dy = Math.max(0, height) * CAST_PER_PIXEL.y;
  const [a, b] = edge;
  return [a, b, { x: b.x + dx, y: b.y + dy }, { x: a.x + dx, y: a.y + dy }];
}

function clipConvexPolygon(
  subject: readonly { readonly x: number; readonly y: number }[],
  clip: readonly { readonly x: number; readonly y: number }[],
): readonly { x: number; y: number }[] {
  let output = [...subject];
  const area = clip.reduce((sum, a, index) => {
    const b = clip[(index + 1) % clip.length] ?? a;
    return sum + a.x * b.y - b.x * a.y;
  }, 0);
  const inside = (
    point: { readonly x: number; readonly y: number },
    a: { readonly x: number; readonly y: number },
    b: { readonly x: number; readonly y: number },
  ) =>
    (area >= 0 ? 1 : -1) * ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) >= -1e-6;
  const intersection = (
    start: { readonly x: number; readonly y: number },
    end: { readonly x: number; readonly y: number },
    a: { readonly x: number; readonly y: number },
    b: { readonly x: number; readonly y: number },
  ) => {
    const rx = end.x - start.x;
    const ry = end.y - start.y;
    const sx = b.x - a.x;
    const sy = b.y - a.y;
    const denominator = rx * sy - ry * sx;
    if (Math.abs(denominator) < 1e-9) return end;
    const t = ((a.x - start.x) * sy - (a.y - start.y) * sx) / denominator;
    return { x: start.x + t * rx, y: start.y + t * ry };
  };
  for (let index = 0; index < clip.length && output.length; index += 1) {
    const a = clip[index];
    const b = clip[(index + 1) % clip.length];
    if (!a || !b) continue;
    const input = output;
    output = [];
    let start = input[input.length - 1];
    if (!start) continue;
    for (const end of input) {
      if (inside(end, a, b)) {
        if (!inside(start, a, b)) output.push(intersection(start, end, a, b));
        output.push(end);
      } else if (inside(start, a, b)) output.push(intersection(start, end, a, b));
      start = end;
    }
  }
  return output;
}

/** How far a tier's top rises on screen, in tiles (geometry/elevation.ts TIER_LIFT). */
const TIER_RISE = 0.25;
/** How high a procedural blocked cell stands above its ground, in tiles. */
const BLOCK_RISE = 0.72;

/**
 * Casts only exposed south/east structure boundaries onto the cell they face.
 * Internal tier edges never stack, a crown never shades itself, and the
 * receiver diamond stops a cast at the next ground boundary. A raised
 * receiver is drawn lifted, so its diamond and the cast on it lift with it.
 * Cells outside the grid are empty, never the next row's first cell.
 */
export function structureShadowPolygons(
  width: number,
  height: number,
  cellAt: (x: number, y: number) => ShadowCell | undefined,
  project: (point: { readonly x: number; readonly y: number }) => {
    readonly x: number;
    readonly y: number;
  },
  skipBlocked: ReadonlySet<string> = new Set(),
  pixelsPerTile = 64,
): readonly StructureShadowPolygon[] {
  const result: StructureShadowPolygon[] = [];
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? undefined : cellAt(x, y);
  /** Screen rise of a cell's walkable surface, and of its top (a block stands on its ground). */
  const lift = (cell: ShadowCell) => (cell.blocked ? 0 : Math.max(0, cell.elevation) * TIER_RISE);
  const top = (cell: ShadowCell) => lift(cell) + (cell.blocked ? BLOCK_RISE : 0);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const source = at(x, y);
      if (!source || (source.blocked && skipBlocked.has(`${x},${y}`))) continue;
      const sourceTop = top(source);
      if (sourceTop <= 0) continue;
      for (const edge of [
        { dx: 0, dy: 1, a: { x, y: y + 1 }, b: { x: x + 1, y: y + 1 } },
        { dx: 1, dy: 0, a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } },
      ]) {
        const rx = x + edge.dx;
        const ry = y + edge.dy;
        const receiver = at(rx, ry);
        if (!receiver || receiver.blocked) continue;
        const surface = lift(receiver);
        if (surface >= sourceTop) continue;
        const raise = surface * pixelsPerTile;
        const place = (point: { readonly x: number; readonly y: number }) => {
          const screen = project(point);
          return { x: screen.x, y: screen.y - raise };
        };
        const receiverDiamond = [
          place({ x: rx, y: ry }),
          place({ x: rx + 1, y: ry }),
          place({ x: rx + 1, y: ry + 1 }),
          place({ x: rx, y: ry + 1 }),
        ];
        const points = clipConvexPolygon(
          projectRaisedEdgeShadow(
            [place(edge.a), place(edge.b)],
            (sourceTop - surface) * pixelsPerTile,
          ),
          receiverDiamond,
        );
        if (points.length >= 3)
          result.push({ source: { x, y }, receiver: { x: rx, y: ry }, points });
      }
    }
  return result;
}

/** Opaque masks use max coverage; fixed alpha is applied only when composited. */
export function unionShadowCoverage(a: number, b: number): number {
  return Math.max(a, b);
}

export function castShadowStrength(policy?: false | 'reduced'): number {
  return policy === false ? 0 : policy === 'reduced' ? REDUCED_CAST_ALPHA : 1;
}

/** How many levels the WebGL shadow composite can snap a texel to (two vec4 uniforms). */
export const SHADOW_LEVEL_SLOTS = 8;

/**
 * The levels a frame's casters wrote into the union, for the composite to snap
 * each texel to (ADR 0093): the distinct alphas, strongest first, padded with
 * 0 (which is always a candidate). More distinct levels than slots — several
 * figures fading at once — fall onto eighths, so the set always fits.
 */
export function shadowLevels(alphas: readonly number[]): readonly number[] {
  const clean = alphas.filter((a) => Number.isFinite(a) && a > 0).map((a) => Math.min(1, a));
  // Two alphas one 8-bit step apart are one level: the mask stores 8 bits.
  const distinct = (values: readonly number[]) =>
    [...new Map(values.map((a) => [Math.round(a * 255), a] as const)).values()].sort(
      (a, b) => b - a,
    );
  let levels = distinct(clean);
  if (levels.length > SHADOW_LEVEL_SLOTS)
    levels = distinct(
      clean.map((a) => Math.max(1, Math.round(a * SHADOW_LEVEL_SLOTS)) / SHADOW_LEVEL_SLOTS),
    );
  return [...levels, ...Array<number>(SHADOW_LEVEL_SLOTS - levels.length).fill(0)];
}

/**
 * The ground under each column of a prop's art (ADR 0093): the lower convex hull
 * of its silhouette's bottom edge, in art pixels, `-1` where the art has no
 * pixels at all. A box's base edges are their own hull, so they are on the
 * ground; a tripod's or a cart's hull is the line between its feet or wheels,
 * so the bowl or the bed between them stands above it. A figure keeps the foot
 * projection instead: its hands are not on the ground.
 */
export function groundProfile(
  alpha: (x: number, y: number) => number,
  width: number,
  height: number,
  threshold = 128,
  feet?: GroundSpan,
): Int32Array {
  const bottom: { x: number; y: number }[] = [];
  const lowest = new Int32Array(width).fill(-1);
  for (let x = 0; x < width; x += 1)
    for (let y = height - 1; y >= 0; y -= 1)
      if (alpha(x, y) >= threshold) {
        lowest[x] = y;
        const span = feet?.(x);
        // With a footprint, only a column whose bottom reaches its ground is a foot.
        if (!feet || (span && y >= span.top - FOOT_TOLERANCE)) bottom.push({ x, y });
        break;
      }
  const base = new Int32Array(width).fill(-1);
  if (bottom.length === 0) return base;
  // Monotone chain over the bottom points, keeping the chain that bounds them from below (largest y).
  const hull: { x: number; y: number }[] = [];
  for (const p of bottom) {
    for (;;) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      if (!a || !b) break;
      // Drop b unless it lies below (larger y than) the segment a -> p.
      if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) break;
      hull.pop();
    }
    hull.push(p);
  }
  const first = hull[0];
  const last = hull[hull.length - 1];
  if (!first || !last) return base;
  for (let x = 0; x < width; x += 1) {
    const own = lowest[x] ?? -1;
    if (own < 0) continue;
    // Between the feet, the hull; past either end, level with the end foot, so what overhangs is cast from the
    // ground under it rather than standing on its own bottom.
    let ground = x < first.x ? first.y : last.y;
    for (let i = 0; i < hull.length - 1; i += 1) {
      const a = hull[i];
      const b = hull[i + 1];
      if (a && b && a.x <= x && x <= b.x) {
        ground = Math.round(a.y + ((b.y - a.y) * (x - a.x)) / Math.max(1, b.x - a.x));
        break;
      }
    }
    base[x] = Math.max(ground, own);
  }
  return base;
}

/** How far above its footprint's ground a column's bottom may sit and still count as a foot, in art pixels. */
const FOOT_TOLERANCE = 3;

/**
 * Per column of a piece's art, the rows its footprint's ground spans (`top` the farthest edge, `bottom` the nearest),
 * or `null` where the footprint does not reach: what `groundProfile` takes as feet.
 */
export type GroundSpan = (x: number) => { readonly top: number; readonly bottom: number } | null;

/**
 * The `GroundSpan` of a footprint in a piece's art: each cell's ground diamond, from its four corners in the art's
 * pixels (`corner` maps a logical ground point there).
 */
export function footprintSpan(
  cells: readonly { readonly x: number; readonly y: number }[],
  corner: (point: { readonly x: number; readonly y: number }) => { x: number; y: number },
): GroundSpan {
  const diamonds = cells.map((c) => [
    corner({ x: c.x, y: c.y }),
    corner({ x: c.x + 1, y: c.y }),
    corner({ x: c.x + 1, y: c.y + 1 }),
    corner({ x: c.x, y: c.y + 1 }),
  ]);
  return (x) => {
    const X = x + 0.5;
    let top = Infinity;
    let bottom = -Infinity;
    for (const d of diamonds)
      d.forEach((a, i) => {
        const b = d[(i + 1) % d.length];
        if (!b || a.x === b.x || X < Math.min(a.x, b.x) || X > Math.max(a.x, b.x)) return;
        const y = a.y + ((b.y - a.y) * (X - a.x)) / (b.x - a.x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      });
    return top <= bottom ? { top, bottom } : null;
  };
}

/** A prop's cast as a mask in its art's pixels, from its own ground (`groundProfile`). */
export interface GroundedCast {
  readonly width: number;
  readonly height: number;
  /** 1 where the cast falls, 0 elsewhere; row-major, `width * height`. */
  readonly mask: Uint8Array;
}

/**
 * Casts a prop's silhouette along `key`, each pixel from the ground under its
 * own column: a pixel `h` above it lands `key.x * h` right and `key.y * h`
 * down of that ground point. The base row is its own cast, so the shadow starts
 * at the base with no gap, wherever the base is on screen. The mask shares the
 * art's origin and runs past its right and bottom edges as far as the cast does.
 */
export function groundedCast(
  alpha: (x: number, y: number) => number,
  width: number,
  height: number,
  key: CastKey,
  threshold = 128,
  feet?: GroundSpan,
): GroundedCast {
  const base = groundProfile(alpha, width, height, threshold, feet);
  const outW = width + Math.ceil(key.x * height) + 1;
  const outH = height + Math.ceil(key.y * height) + 1;
  const mask = new Uint8Array(outW * outH);
  // Half columns and half steps, the ground eased between neighbouring columns: a base edge
  // that climbs across the art would otherwise leave hairline holes between columns' casts.
  for (let x = 0; x < width; x += 1) {
    const ground = base[x] ?? -1;
    if (ground < 0) continue;
    const next = base[x + 1] ?? -1;
    for (let y = 0; y <= ground; y += 1) {
      if (alpha(x, y) < threshold) continue;
      for (const sub of [0, 0.5]) {
        const g = next >= 0 ? ground + (next - ground) * sub : ground;
        for (const step of [0, 0.5]) {
          const rise = Math.max(0, g - y + step);
          const cx = Math.round(x + sub + key.x * rise);
          const cy = Math.round(g + key.y * rise);
          if (cx >= 0 && cy >= 0 && cx < outW && cy < outH) mask[cy * outW + cx] = 1;
        }
      }
    }
  }
  return { width: outW, height: outH, mask: closeMask(mask, outW, outH) };
}

/**
 * A 3 x 3 closing (dilate, then erode): fills the hairline holes the forward
 * map leaves where a rounded base climbs steeply between columns, and keeps
 * every pixel that was set, so a cast that touched its base still does.
 */
function closeMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  const pass = (src: Uint8Array, outside: number, keep: (count: number) => boolean) => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy += 1)
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            const inside = nx >= 0 && ny >= 0 && nx < width && ny < height;
            count += inside ? (src[ny * width + nx] ?? 0) : outside;
          }
        out[y * width + x] = keep(count) ? 1 : 0;
      }
    return out;
  };
  // Outside the mask is empty both ways: the edge is never grown, and what the erosion eats there
  // was set to begin with, so it is put back below.
  const dilated = pass(mask, 0, (count) => count > 0);
  const closed = pass(dilated, 0, (count) => count === 9);
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) closed[i] = 1;
  return closed;
}
