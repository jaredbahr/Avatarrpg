/**
 * What the style contract measures on an asset (ADR 0102, amended 2026-11-06): its distinct fully opaque colours,
 * and how many of its pixels are neither opaque nor clear.
 */
import type { Image } from './image';

export function measureStyle(image: Image): { colours: number; soft: number } {
  const colours = new Set<number>();
  let soft = 0;
  for (let i = 0; i < image.width * image.height; i++) {
    const o = i * 4;
    const a = image.data[o + 3] ?? 0;
    if (a === 0) continue;
    if (a !== 255) {
      soft++;
      continue;
    }
    colours.add(
      ((image.data[o] ?? 0) << 16) | ((image.data[o + 1] ?? 0) << 8) | (image.data[o + 2] ?? 0),
    );
  }
  return { colours: colours.size, soft };
}
