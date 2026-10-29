import type { Vec2 } from '../../core/types';
import type { Camera } from '../../render/camera';
import { actorBodyBounds } from '../../render/geometry/actorSilhouette';

/** Scene-supplied upright geometry; the helper never reads game or asset state. */
export interface EnemyFrameActor {
  readonly pos: Vec2;
  readonly size: 1 | 2;
  readonly scale: number;
  readonly headroom: number | null;
  /** Lift in tiles, matching the renderer's upright placement. */
  readonly lift: number;
}

/** A prop's full upright cache square, lifted as it is in both backends. */
export interface EnemyFrameProp {
  readonly pos: Vec2;
  readonly lift: number;
}

interface TargetBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Tile centres miss the far edges of a footprint and the art standing above it. */
function targetBounds(
  camera: Camera,
  cells: readonly Vec2[],
  enemies: readonly EnemyFrameActor[],
  props: readonly EnemyFrameProp[],
): TargetBounds {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const cell of cells) {
    const corners = [
      cell,
      { x: cell.x + 1, y: cell.y },
      { x: cell.x + 1, y: cell.y + 1 },
      { x: cell.x, y: cell.y + 1 },
    ];
    for (const corner of corners) {
      const point = camera.project(corner);
      left = Math.min(left, point.x);
      top = Math.min(top, point.y);
      right = Math.max(right, point.x);
      bottom = Math.max(bottom, point.y);
    }
  }
  for (const enemy of enemies) {
    const box = camera.spriteBox(enemy.pos, enemy.size);
    box.y -= enemy.lift * box.size;
    const body = actorBodyBounds(
      { ...box, width: box.size * enemy.size },
      enemy.size,
      enemy.headroom,
      enemy.scale,
    );
    left = Math.min(left, body.left);
    top = Math.min(top, body.top);
    right = Math.max(right, body.right);
    bottom = Math.max(bottom, body.bottom);
  }
  for (const prop of props) {
    const box = camera.spriteBox(prop.pos);
    const y = box.y - prop.lift * box.size;
    left = Math.min(left, box.x);
    top = Math.min(top, y);
    right = Math.max(right, box.x + box.size);
    bottom = Math.max(bottom, y + box.size);
  }
  return { left, top, right, bottom };
}

/**
 * Show all supplied footprints, enemy uprights and prop art at the closest stop.
 * The caller supplies live targets only. An empty list leaves the camera alone;
 * an impossible fit returns false at the widest frame the Camera permits. Whole
 * device pixels take priority over its existing sub-device overview exception.
 */
export function frameEnemyTargets(
  camera: Camera,
  cells: readonly Vec2[],
  enemies: readonly EnemyFrameActor[] = [],
  props: readonly EnemyFrameProp[] = [],
): boolean {
  if (cells.length === 0 && enemies.length === 0 && props.length === 0) return false;

  const { width, height, dpr } = camera.viewport;
  const centre = { x: width / 2, y: height / 2 };
  const tolerance = 0.5 / dpr;
  const contains = (bounds: TargetBounds): boolean =>
    bounds.left >= -tolerance &&
    bounds.top >= -tolerance &&
    bounds.right <= width + tolerance &&
    bounds.bottom <= height + tolerance;

  // Reset a pinch's accumulated intent before requesting a programmatic stop.
  // Projected tile spans scale linearly, independent of the current pan.
  camera.fit();
  const bounds = targetBounds(camera, cells, enemies, props);
  const factor = Math.min(
    width / (bounds.right - bounds.left),
    height / (bounds.bottom - bounds.top),
  );
  let target = camera.snapScale(camera.scale * factor, 'floor');
  let previousScale = Infinity;
  let overview = false;

  for (;;) {
    camera.fit();
    // A tiny request selects Camera's own widest stop, including the overview
    // below one device pixel when no whole stop can show the target envelope.
    camera.zoomAt(centre, overview ? 1e-6 : target / camera.scale);
    const at = targetBounds(camera, cells, enemies, props);
    const worldCentre = camera.unproject({
      x: (at.left + at.right) / 2,
      y: (at.top + at.bottom) / 2,
    });
    // centreOn accepts a tile origin; the envelope centre may lie between tiles.
    camera.centreOn({ x: worldCentre.x - 0.5, y: worldCentre.y - 0.5 });
    if (contains(targetBounds(camera, cells, enemies, props))) return true;
    if (overview) return false;

    // Camera clamps can prevent either the requested zoom or its ideal pan.
    // After whole stops stop decreasing, try the existing overview once. An
    // extent may forbid it too; no limits are relaxed to force a successful fit.
    if (camera.scale >= previousScale) {
      overview = true;
      continue;
    }
    previousScale = camera.scale;
    const next = camera.integerZoom
      ? camera.snapScale(camera.scale - 1 / dpr, 'floor')
      : camera.scale * 0.9;
    if (next >= camera.scale) overview = true;
    else target = next;
  }
}
