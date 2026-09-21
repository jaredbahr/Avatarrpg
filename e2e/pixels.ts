import type { Locator, Page } from '@playwright/test';
import { PNG } from 'pngjs';

/**
 * Reads pixels back from a screenshot.
 *
 * WebGL cannot be read back from the page after the frame has been presented
 * (no `preserveDrawingBuffer`), and the Canvas 2D backend can, so the one way
 * to check what either backend actually put on screen is Playwright's own
 * screenshot, decoded here with pngjs. Positions are CSS pixels inside the
 * element; the device pixel ratio is handled from the PNG's size.
 *
 * A probe that draws the frame itself can do better: reading the canvas back
 * inside the same turn reads the drawing buffer that draw just wrote, before
 * the compositor has had a chance to present (or drop) it. That is what
 * `pixelsFromDataUrl` is for, and it is how a probe compares two states of a
 * board that the page may repaint while the capture is on its way.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface Pixels {
  /** Colour at a CSS-pixel position inside the element, or null off the image. */
  at(x: number, y: number): Rgb | null;
  readonly width: number;
  readonly height: number;
}

/**
 * Pixels out of a PNG the page encoded itself, `canvas.toDataURL` most often.
 *
 * Coordinates are the canvas' own device pixels, which is what a drawing
 * buffer is measured in once the device pixel ratio is in play.
 */
export function pixelsFromDataUrl(dataUrl: string): Pixels {
  const comma = dataUrl.indexOf(',');
  const png = PNG.sync.read(Buffer.from(dataUrl.slice(comma + 1), 'base64'));
  return {
    width: png.width,
    height: png.height,
    at(x, y) {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= png.width || py >= png.height) return null;
      const i = (py * png.width + px) * 4;
      return { r: png.data[i] ?? 0, g: png.data[i + 1] ?? 0, b: png.data[i + 2] ?? 0 };
    },
  };
}

export async function screenshotPixels(locator: Locator): Promise<Pixels> {
  const [png, box] = await Promise.all([
    locator
      .screenshot({ scale: 'device', timeout: 60_000 })
      .then((buffer) => PNG.sync.read(buffer)),
    locator.boundingBox(),
  ]);
  const scaleX = box ? png.width / box.width : 1;
  const scaleY = box ? png.height / box.height : 1;
  return {
    width: png.width,
    height: png.height,
    at(x, y) {
      const px = Math.round(x * scaleX);
      const py = Math.round(y * scaleY);
      if (px < 0 || py < 0 || px >= png.width || py >= png.height) return null;
      const i = (py * png.width + px) * 4;
      return { r: png.data[i] ?? 0, g: png.data[i + 1] ?? 0, b: png.data[i + 2] ?? 0 };
    },
  };
}

/** Capture a small screen region around a probe without Playwright's element stability wait. */
export async function screenshotClipPixels(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
): Promise<Pixels> {
  const png = PNG.sync.read(await page.screenshot({ clip, scale: 'device' }));
  const scaleX = png.width / clip.width;
  const scaleY = png.height / clip.height;
  return {
    width: png.width,
    height: png.height,
    at(x, y) {
      const px = Math.round(x * scaleX);
      const py = Math.round(y * scaleY);
      if (px < 0 || py < 0 || px >= png.width || py >= png.height) return null;
      const i = (py * png.width + px) * 4;
      return { r: png.data[i] ?? 0, g: png.data[i + 1] ?? 0, b: png.data[i + 2] ?? 0 };
    },
  };
}

/** Averages the colour over a small square, so a fleck or a grid line cannot swing it. */
export function average(pixels: Pixels, x: number, y: number, radius: number): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const c = pixels.at(x + dx, y + dy);
      if (!c) continue;
      r += c.r;
      g += c.g;
      b += c.b;
      n++;
    }
  }
  return n === 0 ? { r: 0, g: 0, b: 0 } : { r: r / n, g: g / n, b: b / n };
}
