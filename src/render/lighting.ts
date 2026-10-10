import { FOOT_LINE } from './sheets/bake';

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
 * How a scene grounds the figures standing in it. `cast` is the projected
 * silhouette's alpha; `contact` is a second, tighter layer drawn from the
 * soles of the frame itself (both feet, whatever the pose) and `0` leaves the
 * radial contact pool in charge. A painted village whose own shadows run at
 * ~0.4 darkening needs both turned up or its figures read as floating.
 */
export interface ActorGrounding {
  readonly cast: number;
  readonly contact: number;
}

export const DEFAULT_ACTOR_GROUNDING: ActorGrounding = { cast: CAST_SHADOW_ALPHA, contact: 0 };

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
export function shadowCeiling(grounding: ActorGrounding): number {
  return Math.max(CAST_SHADOW_ALPHA, grounding.cast, grounding.contact);
}

/** The sole band of a frame laid flat for contact: height in tiles, spread about the foot, drop in tiles. */
export const CONTACT_BAND = { height: 0.14, spreadX: 1.4, spreadY: 1, drop: 0.03 } as const;

/**
 * The rows of a frame that make its contact band: the `CONTACT_BAND.height`
 * tiles ending on the foot line (`anchorY` of the frame), in frame pixels.
 */
export function contactBandRows(
  frameHeight: number,
  anchorY: number,
  pixelsPerTile: number,
): { readonly top: number; readonly height: number } {
  const bottom = Math.max(0, Math.min(frameHeight, anchorY * frameHeight));
  const height = Math.max(1, Math.min(bottom, Math.round(CONTACT_BAND.height * pixelsPerTile)));
  return { top: bottom - height, height };
}

/** The art a contact band is cut from: a sheet frame, or a drawn sprite stood on the foot line. */
export interface BandArt<S = HTMLCanvasElement | HTMLImageElement> {
  readonly source: S;
  readonly frame: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
  readonly anchor: { readonly x: number; readonly y: number };
  readonly pixelsPerTile: number;
}

/**
 * Band art for a figure with no sheet frame (a painter or single-image
 * resident, a painter-fallback unit): its drawn sprite, `heightTiles` tall,
 * standing on `FOOT_LINE` exactly as the backends place it.
 */
export function spriteBandArt<S extends { readonly width: number; readonly height: number }>(
  sprite: S,
  heightTiles = 1,
): BandArt<S> {
  return {
    source: sprite,
    frame: { x: 0, y: 0, w: sprite.width, h: sprite.height },
    anchor: { x: 0.5, y: FOOT_LINE },
    pixelsPerTile: sprite.height / heightTiles,
  };
}

/**
 * What a figure's feet get under it. A scene with a contact layer draws the
 * sole band for any figure that casts (frame or sprite, they all have art to
 * cut it from) and drops the radial pool for it; a figure that casts nothing
 * keeps its pool where the default scene had one. A default scene is untouched:
 * `pool` is whatever the figure drew before (`defaultPool`), never a band.
 */
export function groundTreatment(
  grounding: ActorGrounding,
  figure: { readonly castStrength: number; readonly defaultPool: boolean },
): { readonly band: boolean; readonly pool: boolean } {
  const band = grounding.contact > 0 && figure.castStrength > 0;
  return { band, pool: figure.defaultPool && !band };
}

/**
 * Screen-space projection of an upright silhouette onto the ground. Both the
 * orthographic and oblique cameras keep vertical objects upright on screen,
 * so the same foot-anchored projection applies: every pixel above the foot
 * travels down-right, opposite the upper-left key.
 */
export const CAST_PER_PIXEL = { x: 0.42, y: 0.27 } as const;

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
export function silhouetteProjection(footX: number, footY: number): ShadowProjection {
  // Horizontal coordinates already remain anchored under this shear; retaining
  // footX in the API makes the two-dimensional anchor contract explicit.
  void footX;
  return {
    a: 1,
    b: 0,
    c: -CAST_PER_PIXEL.x,
    d: -CAST_PER_PIXEL.y,
    e: CAST_PER_PIXEL.x * footY,
    f: footY * (1 + CAST_PER_PIXEL.y),
  };
}

export function projectShadowPoint(
  point: { readonly x: number; readonly y: number },
  foot: { readonly x: number; readonly y: number },
): { x: number; y: number } {
  const rise = foot.y - point.y;
  return { x: point.x + rise * CAST_PER_PIXEL.x, y: foot.y + rise * CAST_PER_PIXEL.y };
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
