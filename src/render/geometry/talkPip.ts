export interface VisibleArtBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Bounds of pixels whose alpha is visible, in source-image pixels. */
export function visiblePixelBounds(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  alphaFloor = 8,
): VisibleArtBounds {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if ((data[(y * width + x) * 4 + 3] ?? 0) > alphaFloor) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
  return right < 0
    ? { left: 0, top: 0, right: width, bottom: height }
    : { left, top, right, bottom };
}

/**
 * Position a pip above the transformed visible art. Bounds are local tile units
 * relative to the foot point; `scale` includes actor and pose scaling. Rotation
 * uses the same foot-centred transform as both renderers.
 */
export function talkPipPosition(
  foot: { readonly x: number; readonly y: number },
  bounds: VisibleArtBounds,
  scale: number,
  lean: number,
  radius: number,
  gap: number,
  facing: 1 | -1 = 1,
): { x: number; y: number } {
  const cos = Math.cos(lean);
  const sin = Math.sin(lean);
  const corners = [
    [bounds.left, bounds.top],
    [bounds.right, bounds.top],
    [bounds.left, bounds.bottom],
    [bounds.right, bounds.bottom],
  ] as const;
  const transformed = corners.map(([x, y]) => ({
    x: foot.x + scale * (facing * x * cos - y * sin),
    y: foot.y + scale * (facing * x * sin + y * cos),
  }));
  const top = Math.min(...transformed.map(({ y }) => y));
  // Keep the cue centred as lean crosses zero: selecting only the highest
  // corner would jump from one side of the figure to the other on a tiny lean.
  const xs = transformed.map(({ x }) => x);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  return { x: centerX, y: top - radius - gap };
}
