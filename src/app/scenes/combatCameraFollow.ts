import type { ActorBodyBounds } from '../../render/geometry/actorSilhouette';

export function shouldFollowAnimatedLargeActor(options: {
  readonly animated: boolean;
  readonly manualCamera: boolean;
  readonly size: 1 | 2;
  readonly scale: number;
  readonly squareFootprints: boolean;
}): boolean {
  return (
    options.animated &&
    !options.manualCamera &&
    options.squareFootprints &&
    options.size === 2 &&
    options.scale > 1
  );
}

/** Smallest screen-space translation which puts a body inside the safe frame. */
export function actorKeepInViewDelta(
  body: ActorBodyBounds,
  viewport: { readonly width: number; readonly height: number },
  margin = 12,
): { x: number; y: number } {
  const x =
    body.left < margin
      ? margin - body.left
      : body.right > viewport.width - margin
        ? viewport.width - margin - body.right
        : 0;
  const y =
    body.top < margin
      ? margin - body.top
      : body.bottom > viewport.height - margin
        ? viewport.height - margin - body.bottom
        : 0;
  return { x, y };
}
