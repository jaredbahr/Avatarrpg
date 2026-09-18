import { FOOT_LINE } from '../sheets/bake';

/** Shared upright geometry. `y` already includes elevation and the current pose offset. */
export function actorHealthBar(
  x: number,
  y: number,
  width: number,
  tileSize: number,
  scale: number,
  headroom = 0,
) {
  // Headroom is measured relative to an unscaled tile top. Scale the entire
  // foot-to-head distance, not just the portion above that tile.
  const silhouetteTop = y + FOOT_LINE * tileSize - (FOOT_LINE + headroom) * tileSize * scale;
  const barWidth = width * 0.72;
  const barHeight = Math.max(3, tileSize * 0.075);
  const gap = Math.max(2, tileSize * 0.04);
  return {
    x: x + (width - barWidth) / 2,
    y: silhouetteTop - gap - barHeight - 1,
    width: barWidth,
    height: barHeight,
    silhouetteTop,
  };
}
