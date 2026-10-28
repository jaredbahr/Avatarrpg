/**
 * A party member hidden behind a piece that keeps its paint (`revealOccluded`) is drawn over that
 * piece as a flat silhouette, so the building stays solid and in front while the figure stays
 * findable (ADR 0096). Only the covered part of the figure is drawn, on the world-pixel grid: a
 * 1 world px rim at full strength and a translucent fill, never blurred.
 *
 * The decision is the fraction of the figure's own opaque pixels that the pieces in front of it
 * cover, not a probe at a fixed height, so it does not toggle on one pixel of a chimney's edge and
 * does not depend on the figure's scale. Both backends draw the one canvas this builds.
 */
import type { SceneScenery } from '../core/types';
import type { Camera } from './camera';
import { drawSceneImage, sceneImage } from './scene';
import type { RenderUnit } from './view';

/** Revealed once this much of the figure's own silhouette is covered. */
export const REVEAL_MIN = 0.25;
/** Alpha at or above which a pixel counts as part of a silhouette. */
const SOLID = 128;
/**
 * RGBA of the silhouette's rim and its fill. The fill lets the roof through, so the figure reads as
 * behind it; an opaque or dark-rimmed silhouette read as a sticker on the roof (ADR 0096).
 */
const RIM = [255, 238, 196, 255] as const;
const FILL = [255, 226, 160, 120] as const;

/** Only the party is revealed; a resident or an enemy behind a house is simply hidden. */
export const revealsUnit = (unit: Pick<RenderUnit, 'faction' | 'fallen'>): boolean =>
  unit.faction === 'party' && !unit.fallen;

/** One figure's frame where it is drawn, in world px; a mirrored frame flips inside this box. */
export interface RevealFigure {
  readonly source: CanvasImageSource;
  readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly flip: boolean;
  /** The foot's ground point y (world px): a piece is in front when its depth's is greater. */
  readonly foot: number;
}

/** The world box of a frame placed by its anchor, mirrored about the anchor when `flip`. */
export function revealBox(
  placed: { x: number; y: number; w: number; h: number },
  anchorX: number,
  flip: boolean,
): { x: number; y: number; w: number; h: number } {
  return flip ? { ...placed, x: 2 * anchorX - placed.x - placed.w } : placed;
}

/** The pieces that hide this figure: they keep their paint, stand in front, and overlap its box. */
export function revealOccluders(
  scenery: readonly SceneScenery[],
  figure: Pick<RevealFigure, 'x' | 'y' | 'w' | 'h' | 'foot'>,
  camera: Pick<Camera, 'groundPoint'>,
): SceneScenery[] {
  return scenery.filter(
    (piece) =>
      piece.revealOccluded &&
      camera.groundPoint(piece.depth).y > figure.foot &&
      piece.x < figure.x + figure.w &&
      piece.x + piece.width > figure.x &&
      piece.y < figure.y + figure.h &&
      piece.y + piece.height > figure.y,
  );
}

/**
 * The silhouette of the covered part of a figure, as RGBA, or null when less than `REVEAL_MIN` of
 * the figure is covered. `figure` and `cover` are RGBA of the same `w` x `h` world-pixel box: the
 * figure's frame, and the union of the pieces in front of it. A rim pixel is a covered figure pixel
 * with a 4-neighbour outside the figure.
 */
export function revealPixels(
  figure: Uint8ClampedArray,
  cover: Uint8ClampedArray,
  w: number,
  h: number,
): Uint8ClampedArray | null {
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && (figure[(y * w + x) * 4 + 3] ?? 0) >= SOLID;
  const out = new Uint8ClampedArray(w * h * 4);
  let own = 0;
  let covered = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      own++;
      const i = (y * w + x) * 4;
      if ((cover[i + 3] ?? 0) < SOLID) continue;
      covered++;
      const rim = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
      out.set(rim ? RIM : FILL, i);
    }
  return own > 0 && covered / own >= REVEAL_MIN ? out : null;
}

/** World-pixel rectangle of a canvas the backends draw over the scenery. */
export interface RevealDrawn {
  readonly canvas: HTMLCanvasElement;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function context(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Draws `draw` into a w x h box at (x, y), mirrored inside it when `flip`. */
function boxed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  flip: boolean | undefined,
  draw: (x: number) => void,
): void {
  ctx.save();
  if (flip) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    draw(0);
  } else {
    ctx.translate(x, y);
    draw(0);
  }
  ctx.restore();
}

/** Builds the silhouettes of every hidden figure into one canvas, reused frame to frame. */
export class RevealLayer {
  private readonly scratch = document.createElement('canvas');
  readonly canvas = document.createElement('canvas');

  draw(
    figures: readonly RevealFigure[],
    scenery: readonly SceneScenery[],
    camera: Pick<Camera, 'groundPoint'>,
  ): RevealDrawn | null {
    const shown: { x: number; y: number; w: number; h: number; pixels: Uint8ClampedArray }[] = [];
    for (const figure of figures) {
      const occluders = revealOccluders(scenery, figure, camera);
      if (occluders.length === 0) continue;
      const x = Math.floor(figure.x);
      const y = Math.floor(figure.y);
      const w = Math.ceil(figure.x + figure.w) - x;
      const h = Math.ceil(figure.y + figure.h) - y;
      const ctx = context(this.scratch, w, h);
      if (!ctx) continue;
      const { source, rect } = figure;
      boxed(ctx, figure.x - x, figure.y - y, figure.w, figure.flip, (at) =>
        ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, at, 0, figure.w, figure.h),
      );
      const own = ctx.getImageData(0, 0, w, h).data;
      ctx.clearRect(0, 0, w, h);
      for (const piece of occluders) {
        const image = sceneImage(piece);
        if (image)
          boxed(ctx, piece.x - x, piece.y - y, piece.width, piece.flip, (at) =>
            drawSceneImage(ctx, image, piece, at, 0, piece.width, piece.height),
          );
      }
      const pixels = revealPixels(own, ctx.getImageData(0, 0, w, h).data, w, h);
      if (pixels) shown.push({ x, y, w, h, pixels });
    }
    if (shown.length === 0) return null;
    const left = Math.min(...shown.map((s) => s.x));
    const top = Math.min(...shown.map((s) => s.y));
    const width = Math.max(...shown.map((s) => s.x + s.w)) - left;
    const height = Math.max(...shown.map((s) => s.y + s.h)) - top;
    const ctx = context(this.canvas, width, height);
    if (!ctx) return null;
    const out = ctx.createImageData(width, height);
    for (const s of shown)
      for (let row = 0; row < s.h; row++)
        for (let col = 0; col < s.w; col++) {
          const from = (row * s.w + col) * 4;
          if ((s.pixels[from + 3] ?? 0) === 0) continue;
          out.data.set(
            s.pixels.subarray(from, from + 4),
            ((s.y - top + row) * width + s.x - left + col) * 4,
          );
        }
    ctx.putImageData(out, 0, 0);
    return { canvas: this.canvas, x: left, y: top, width, height };
  }
}
