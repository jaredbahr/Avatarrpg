/**
 * Putting a figure into its frame.
 *
 * The frame is `frameWidth` x `frameHeight` (128x192 for a one-tile unit at
 * 128 px a tile), the feet stand on the baseline at 85% of the frame's
 * height, and the figure is centred left to right. A figure that will not
 * fit above the baseline or inside the side margins is reported, not
 * squeezed: the fix is to regenerate or to lower the character's scale.
 */

import type { Image } from './image';
import { newImage, pixelAt, setPixel } from './image';
import { alphaBounds } from './trim';

/** Where the feet stand, as a fraction of the frame's height. Matches the runtime's foot line. */
export const BASELINE = 0.85;
/** Clear pixels the art bible wants on every side. */
export const MARGIN = 8;

export interface Placement {
  readonly image: Image;
  /** Problems with the fit; an empty list is a pass. */
  readonly problems: string[];
}

export function placeOnBaseline(figure: Image, frameWidth: number, frameHeight: number): Placement {
  const problems: string[] = [];
  const out = newImage(frameWidth, frameHeight);
  const bounds = alphaBounds(figure);
  if (!bounds) return { image: out, problems: ['the frame is empty after keying'] };

  const baseline = Math.round(frameHeight * BASELINE);
  const left = Math.round(frameWidth / 2 - bounds.x - bounds.width / 2);
  const top = baseline - (bounds.y + bounds.height);

  if (bounds.width > frameWidth - MARGIN * 2) {
    problems.push(
      `figure is ${bounds.width} px wide; at most ${frameWidth - MARGIN * 2} fits with margins`,
    );
  }
  if (bounds.height > baseline - MARGIN) {
    problems.push(
      `figure is ${bounds.height} px tall; at most ${baseline - MARGIN} fits above the baseline`,
    );
  }

  for (let y = 0; y < figure.height; y++) {
    for (let x = 0; x < figure.width; x++) {
      const px = pixelAt(figure, x, y);
      if (px[3] === 0) continue;
      setPixel(out, x + left, y + top, px);
    }
  }
  return { image: out, problems };
}
