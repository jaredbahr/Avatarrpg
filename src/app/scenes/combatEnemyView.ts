import type { Vec2 } from '../../core/types';
import type { Camera, ScreenPoint } from '../../render/camera';

const VIEW_MARGIN = 28;
const MAX_VIEW_ZOOM = 2.5;

/** Frames the supplied live combat targets using the camera's normal zoom stops. */
export function frameCombatEnemyView(
  camera: Camera,
  targets: readonly Vec2[],
  extraBounds: (camera: Camera) => readonly ScreenPoint[] = () => [],
): boolean {
  if (targets.length === 0) return false;

  camera.fit();
  camera.raiseToFit();

  const viewport = camera.viewport;
  const availableWidth = Math.max(1, viewport.width - VIEW_MARGIN * 2);
  const availableHeight = Math.max(1, viewport.height - VIEW_MARGIN * 2);
  const points = () => [
    ...targets.map((target) => camera.project({ x: target.x + 0.5, y: target.y + 0.5 })),
    ...extraBounds(camera),
  ];
  const bounds = () => {
    const projected = points();
    return {
      left: Math.min(...projected.map((point) => point.x)),
      right: Math.max(...projected.map((point) => point.x)),
      top: Math.min(...projected.map((point) => point.y)),
      bottom: Math.max(...projected.map((point) => point.y)),
    };
  };

  const initial = bounds();
  const width = Math.max(1, initial.right - initial.left);
  const height = Math.max(1, initial.bottom - initial.top);
  const zoom = Math.min(MAX_VIEW_ZOOM, availableWidth / width, availableHeight / height);
  const anchor = { x: (initial.left + initial.right) / 2, y: (initial.top + initial.bottom) / 2 };
  camera.zoomAt(anchor, zoom);

  // Integer zoom rounds to whole device-pixel stops. If it stepped up across
  // the target bounds, one normal zoom-out step leaves the whole group clear.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const framed = bounds();
    const tooWide = framed.right - framed.left > availableWidth;
    const tooTall = framed.bottom - framed.top > availableHeight;
    if (!tooWide && !tooTall) break;
    camera.zoomAt(anchor, 0.75);
  }

  const framed = bounds();
  camera.panBy(
    viewport.width / 2 - (framed.left + framed.right) / 2,
    viewport.height / 2 - (framed.top + framed.bottom) / 2,
  );
  return true;
}
