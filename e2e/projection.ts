import type { Page } from '@playwright/test';
import type { CameraInfo } from '../src/app/App';

export type Point = { x: number; y: number };

/** Continuous grid coordinates through the exposed logical-pixel affine, at the board's own tile size. */
export function groundPoint(camera: CameraInfo, pos: Point): Point {
  const m = camera.groundTransform;
  const t = camera.tile;
  return { x: (m.a * pos.x + m.c * pos.y) * t + m.tx, y: (m.b * pos.x + m.d * pos.y) * t + m.ty };
}

export function groundTile(camera: CameraInfo, point: Point): Point {
  const m = camera.groundTransform;
  const x = point.x - m.tx,
    y = point.y - m.ty;
  const det = m.a * m.d - m.b * m.c;
  return {
    x: Math.floor((m.d * x - m.c * y) / det / camera.tile),
    y: Math.floor((m.a * y - m.b * x) / det / camera.tile),
  };
}

/** A continuous ground coordinate through the canvas's actual CSS/backing stretch. */
export async function paintedGroundPoint(page: Page, pos: Point): Promise<Point | null> {
  return page.evaluate((p) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const camera = window.fnt?.app.rendererCamera();
    if (!canvas || !camera) return null;
    const m = camera.groundTransform;
    const x = p.x * camera.tile;
    const y = p.y * camera.tile;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: rect.left + ((m.a * x + m.c * y + m.tx) * rect.width) / (canvas.width / dpr),
      y: rect.top + ((m.b * x + m.d * y + m.ty) * rect.height) / (canvas.height / dpr),
    };
  }, pos);
}

/** Painted tile center in page CSS coordinates, including backing-store stretch. */
export async function paintedTileCentre(page: Page, pos: Point): Promise<Point | null> {
  return paintedGroundPoint(page, { x: pos.x + 0.5, y: pos.y + 0.5 });
}
