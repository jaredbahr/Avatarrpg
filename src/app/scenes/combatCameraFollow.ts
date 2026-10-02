import type { ActorBodyBounds } from '../../render/geometry/actorSilhouette';

export function shouldFollowAnimatedLargeActor(options: {
  readonly size: 1 | 2;
  readonly scale: number;
  readonly squareFootprints: boolean;
}): boolean {
  return options.squareFootprints && options.size === 2 && options.scale > 1;
}

export type CombatCameraFollowState =
  { readonly kind: 'idle' } | { readonly kind: 'following'; readonly unitId: string };

export type CombatCameraOwner = 'idle' | 'follow' | 'recentre';

/**
 * One owner per frame: an eligible animation owns follow until it ends; its
 * release owns one active-unit recentre. A manual action suppresses both for
 * that animation without forgetting which animation must eventually release.
 */
export function combatCameraFollowDecision(
  state: CombatCameraFollowState,
  options: {
    readonly animatedUnitId: string | null;
    readonly activeUnitId: string | null;
    readonly manualCamera: boolean;
  },
): { readonly state: CombatCameraFollowState; readonly owner: CombatCameraOwner } {
  if (state.kind === 'following') {
    if (options.animatedUnitId === state.unitId) {
      return { state, owner: options.manualCamera ? 'idle' : 'follow' };
    }
    return {
      state: { kind: 'idle' },
      owner: !options.manualCamera && options.activeUnitId ? 'recentre' : 'idle',
    };
  }
  if (options.animatedUnitId && !options.manualCamera) {
    return {
      state: { kind: 'following', unitId: options.animatedUnitId },
      owner: 'follow',
    };
  }
  return { state, owner: 'idle' };
}

/** Smallest screen-space translation which puts a body inside the safe frame. */
export function actorKeepInViewDelta(
  body: ActorBodyBounds,
  viewport: { readonly width: number; readonly height: number },
  margin = 12,
): { x: number; y: number } {
  const safeWidth = viewport.width - margin * 2;
  const safeHeight = viewport.height - margin * 2;
  const bodyWidth = body.right - body.left;
  const bodyHeight = body.bottom - body.top;
  const x =
    bodyWidth > safeWidth
      ? viewport.width / 2 - (body.left + body.right) / 2
      : body.left < margin
        ? margin - body.left
        : body.right > viewport.width - margin
          ? viewport.width - margin - body.right
          : 0;
  const y =
    bodyHeight > safeHeight
      ? viewport.height / 2 - (body.top + body.bottom) / 2
      : body.top < margin
        ? margin - body.top
        : body.bottom > viewport.height - margin
          ? viewport.height - margin - body.bottom
          : 0;
  return { x, y };
}
