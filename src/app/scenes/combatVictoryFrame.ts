import type { Vec2 } from '../../core/types';
import type { Camera } from '../../render/camera';
import { actorBodyBounds, type ActorBodyBounds } from '../../render/geometry/actorSilhouette';

export interface VictoryActor {
  readonly pos: Vec2;
  readonly size: 1 | 2;
  readonly scale: number;
  readonly headroom: number | null;
  /** Lift in tiles, matching the renderer's upright placement. */
  readonly lift: number;
}

const VICTORY_FRAME_MARGIN = 24;

function partyBounds(camera: Camera, actors: readonly VictoryActor[]): ActorBodyBounds {
  const bodies = actors.map((actor) => {
    const box = camera.spriteBox(actor.pos, actor.size, true);
    box.y -= actor.lift * box.size;
    return actorBodyBounds(
      { ...box, width: box.size * actor.size },
      actor.size,
      actor.headroom,
      actor.scale,
    );
  });
  return {
    left: Math.min(...bodies.map((body) => body.left)),
    top: Math.min(...bodies.map((body) => body.top)),
    right: Math.max(...bodies.map((body) => body.right)),
    bottom: Math.max(...bodies.map((body) => body.bottom)),
  };
}

/**
 * Frame the standing party's upright art at the closest fitting camera stop.
 * The scene supplies living party members only. False means there were none
 * (leaving the camera untouched), or its existing zoom/pan limits cannot show
 * the whole group; in that case retain the widest available integer frame.
 */
export function frameVictoryParty(camera: Camera, actors: readonly VictoryActor[]): boolean {
  if (actors.length === 0) return false;

  const { width, height, dpr } = camera.viewport;
  const centre = { x: width / 2, y: height / 2 };
  const margin = Math.min(VICTORY_FRAME_MARGIN, width / 4, height / 4);
  const contains = (bounds: ActorBodyBounds, padding: number): boolean => {
    const tolerance = 0.5 / dpr;
    return (
      bounds.left >= padding - tolerance &&
      bounds.top >= padding - tolerance &&
      bounds.right <= width - padding + tolerance &&
      bounds.bottom <= height - padding + tolerance
    );
  };

  // fit() clears a previous pinch's accumulated zoom intent before applying a
  // programmatic ratio. The silhouette scales linearly with the camera.
  camera.fit();
  const bounds = partyBounds(camera, actors);
  const factor = Math.min(
    (width - margin * 2) / (bounds.right - bounds.left),
    (height - margin * 2) / (bounds.bottom - bounds.top),
  );
  let target = camera.snapScale(camera.scale * factor, 'floor');
  let previousScale = Infinity;

  for (;;) {
    camera.fit();
    camera.zoomAt(centre, target / camera.scale);
    const at = partyBounds(camera, actors);
    const worldCentre = camera.unproject({
      x: (at.left + at.right) / 2,
      y: (at.top + at.bottom) / 2,
    });
    // centreOn takes a tile origin, while this is an arbitrary envelope centre.
    camera.centreOn({ x: worldCentre.x - 0.5, y: worldCentre.y - 0.5 });
    const framed = partyBounds(camera, actors);
    if (contains(framed, margin)) return true;

    // A clamp can prevent the computed centre. Try lower existing stops, and
    // stop when the Camera's own lower limit prevents any further widening.
    if (camera.scale >= previousScale) return contains(framed, 0);
    previousScale = camera.scale;
    const next = camera.integerZoom
      ? camera.snapScale(camera.scale - 1 / dpr, 'floor')
      : camera.scale * 0.9;
    if (next >= camera.scale) return contains(framed, 0);
    target = next;
  }
}
