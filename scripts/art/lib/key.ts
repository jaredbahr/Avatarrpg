/**
 * Keying the background out of a generated frame.
 *
 * The packs ask for a flat `#00ff00` behind every pose. Pixels within
 * `tolerance` of the key colour go fully clear, a band beyond it fades so an
 * anti-aliased edge keeps its softness, and the survivors are despilled:
 * the key's dominant channel is clamped to the larger of the other two, which
 * removes the green fringe a keyed edge otherwise carries onto grass, ink
 * and skin alike. `auto` reads the key colour from the four corners, for a
 * generator that could not hold the exact hex.
 */

import type { Image } from './image';
import { newImage, parseHex, pixelAt } from './image';

export interface KeyOptions {
  /** `#rrggbb`, or `auto` to sample the corners. */
  readonly color: string;
  /** Distance in RGB (0-441) inside which a pixel is background. */
  readonly tolerance: number;
  /** Distance over which the edge fades from background to figure, beyond the tolerance. */
  readonly feather: number;
  readonly despill: boolean;
}

export const DEFAULT_KEY: KeyOptions = {
  color: '#00ff00',
  tolerance: 70,
  feather: 50,
  despill: true,
};

/** The average of the four corner pixels: what the generator actually painted as "flat". */
export function cornerColor(image: Image): [number, number, number] {
  const corners = [
    pixelAt(image, 0, 0),
    pixelAt(image, image.width - 1, 0),
    pixelAt(image, 0, image.height - 1),
    pixelAt(image, image.width - 1, image.height - 1),
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of corners) {
    r += c[0];
    g += c[1];
    b += c[2];
  }
  return [Math.round(r / 4), Math.round(g / 4), Math.round(b / 4)];
}

/**
 * How far the corners are from the key colour, in RGB distance: past the
 * tolerance and the feather the background is not the key, and keying would
 * cut the figure instead of the background. Zero for `auto`, which reads the
 * corners as the key by definition.
 */
export function keyDistance(image: Image, options: KeyOptions = DEFAULT_KEY): number {
  if (options.color === 'auto') return 0;
  const key = parseHex(options.color);
  const corner = cornerColor(image);
  return Math.hypot(corner[0] - key[0], corner[1] - key[1], corner[2] - key[2]);
}

export function keyOut(image: Image, options: KeyOptions = DEFAULT_KEY): Image {
  const key = options.color === 'auto' ? cornerColor(image) : parseHex(options.color);
  const dominant = key.indexOf(Math.max(...key));
  const out = newImage(image.width, image.height);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 255;
    const distance = Math.hypot(r - key[0], g - key[1], b - key[2]);
    let keep = 1;
    if (distance <= options.tolerance) keep = 0;
    else if (distance < options.tolerance + options.feather) {
      keep = (distance - options.tolerance) / options.feather;
    }
    const rgb = [r, g, b];
    if (options.despill && keep > 0) {
      const others = rgb.filter((_, index) => index !== dominant);
      const cap = Math.max(...others);
      if ((rgb[dominant] ?? 0) > cap) rgb[dominant] = cap;
    }
    out.data[i] = rgb[0] ?? 0;
    out.data[i + 1] = rgb[1] ?? 0;
    out.data[i + 2] = rgb[2] ?? 0;
    out.data[i + 3] = Math.round(a * keep);
  }
  return out;
}
