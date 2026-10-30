import { TILE, type Camera } from './camera';
import { drawArt } from './pixelSampling';
import { pixelMarkChunkPlans } from './pixelMarks';
import type { G1Bounds } from './pixelMarks';
import type { PixelMarkDrawableCache } from './pixelMarkDrawables';
import type { PixelOverlayCue } from './pixelOverlayGeometry';

export interface PixelMarkDraw {
  readonly id: string;
  readonly sourceKey: string;
  readonly source: HTMLCanvasElement;
  readonly bounds: G1Bounds;
  readonly alpha: number;
}

/** Resolve only chunks that can intersect the current projected-world view. */
export function resolvePixelMarkDraws(
  camera: Camera,
  cues: readonly PixelOverlayCue[],
  cache: PixelMarkDrawableCache<HTMLCanvasElement>,
  nudge = { x: 0, y: 0 },
): PixelMarkDraw[] {
  const visible = visibleBoardPixels(camera, nudge);
  const draws: PixelMarkDraw[] = [];
  for (const cue of cues) {
    const localVisible = cue.anchor
      ? {
          ...visible,
          left: visible.left - cue.anchor.x,
          top: visible.top - cue.anchor.y,
        }
      : visible;
    for (const plan of pixelMarkChunkPlans(cue.spec, localVisible)) {
      const source = cache.get(cue.spec, plan.bounds);
      if (!source.drawable) continue;
      draws.push({
        id: `${cue.id}:${plan.key}`,
        sourceKey: plan.key,
        source: source.drawable,
        bounds: cue.anchor
          ? {
              ...plan.bounds,
              left: plan.bounds.left + cue.anchor.x,
              top: plan.bounds.top + cue.anchor.y,
            }
          : plan.bounds,
        alpha: cue.alpha ?? 1,
      });
    }
  }
  return draws;
}

export function visibleBoardPixels(camera: Camera, nudge = { x: 0, y: 0 }): G1Bounds {
  // Raised tops can move a source above the viewport. Keep half a tile of
  // headroom plus the camera shake so neither path drops a visible mark.
  // Supported terrain reaches elevation 3 (48 world px above its flat source).
  // One tile also leaves room for the mark's own bounds at the viewport edge.
  const pad = TILE;
  const shiftX = nudge.x * TILE;
  const shiftY = nudge.y * TILE;
  const left = Math.floor(camera.offsetX / camera.scale - shiftX - pad) - 1;
  const top = Math.floor(camera.offsetY / camera.scale - shiftY - pad) - 1;
  const right =
    Math.ceil((camera.offsetX + camera.viewport.width) / camera.scale - shiftX + pad) + 1;
  const bottom =
    Math.ceil((camera.offsetY + camera.viewport.height) / camera.scale - shiftY + pad) + 1;
  return { left, top, width: right - left, height: bottom - top };
}

/** Draw a projected-world source while keeping the caller's clip in place. */
export function drawCanvasPixelMark(
  context: CanvasRenderingContext2D,
  camera: Camera,
  draw: PixelMarkDraw,
  nudge: { x: number; y: number },
  plane: 'ground' | 'screen',
): void {
  const dpr = camera.viewport.dpr;
  const scale = camera.scale;
  const nudgeX = nudge.x * TILE * scale;
  const nudgeY = nudge.y * TILE * scale;
  const current = context.getTransform();
  const matrix = camera.groundMatrix();
  const expectedX =
    dpr * (nudgeX + (plane === 'ground' && camera.projection === 'oblique' ? matrix.tx : 0));
  const expectedY =
    dpr * (nudgeY + (plane === 'ground' && camera.projection === 'oblique' ? matrix.ty : 0));
  const extraX = current.e - expectedX;
  const extraY = current.f - expectedY;

  context.save();
  context.setTransform(
    dpr * scale,
    0,
    0,
    dpr * scale,
    dpr * (-camera.offsetX + nudgeX) + extraX,
    dpr * (-camera.offsetY + nudgeY) + extraY,
  );
  context.globalAlpha *= draw.alpha;
  drawArt(context, draw.bounds.width, draw.bounds.width, () => {
    context.drawImage(
      draw.source,
      draw.bounds.left,
      draw.bounds.top,
      draw.bounds.width,
      draw.bounds.height,
    );
  });
  context.restore();
}
