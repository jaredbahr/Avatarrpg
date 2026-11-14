import type { ActorBodyBounds } from './geometry/actorSilhouette';
import type { Camera } from './camera';
import type { Vec2 } from '../core/types';

export interface TopdownFollowInput {
  /** Actor or focus point in CSS pixels, before this frame's pan. */
  readonly focus: Vec2;
  /** Optional two ends of a blow; both must fit inside the soft frame to hold. */
  readonly blowEndpoints?: readonly Vec2[];
  /** The complete rendered body bounds in CSS pixels. */
  readonly body: ActorBodyBounds;
  readonly viewport: { readonly width: number; readonly height: number; readonly dpr: number };
  readonly deltaMs: number;
}

export interface TopdownFollowResult {
  /** Incremental screen-space pan for Camera.panBy, snapped to device pixels. */
  readonly pan: Vec2;
  /** True when the focus and every blow endpoint fit inside the soft margins. */
  readonly focusInsideMargins: boolean;
  /** True when the complete body bounds fit inside the physical viewport. */
  readonly bodyContained: boolean;
  /** False means panning cannot keep the complete body within the viewport. */
  readonly bodyFitsViewport: boolean;
}

const FOLLOW_RATE = 6.5;
const BODY_EDGE_EPSILON = 1e-6;

interface Range {
  readonly low: number;
  readonly high: number;
}

function translationRange(min: number, max: number, allowedMin: number, allowedMax: number): Range {
  const low = allowedMin - min;
  const high = allowedMax - max;
  // If the target is too wide for its frame, centre it as the stable best fit.
  if (low > high) {
    const centred = (allowedMin + allowedMax - min - max) / 2;
    return { low: centred, high: centred };
  }
  return { low, high };
}

function closestToZero(range: Range): number {
  return Math.max(range.low, Math.min(0, range.high));
}

function snapDevice(value: number, dpr: number): number {
  return Math.round(value * dpr) / dpr;
}

function hardCorrection(range: Range, dpr: number): number {
  if (range.low > 0) return Math.ceil(range.low * dpr) / dpr;
  if (range.high < 0) return Math.floor(range.high * dpr) / dpr;
  return 0;
}

function inside(value: number, min: number, max: number): boolean {
  return value >= min - BODY_EDGE_EPSILON && value <= max + BODY_EDGE_EPSILON;
}

/**
 * Pure top-down hold/ease follow. Soft focus margins govern when the camera
 * moves; full body bounds have priority when they cannot both be satisfied.
 * The caller owns the camera and applies the returned pan through Camera APIs.
 */
export function topdownFollow(input: TopdownFollowInput): TopdownFollowResult {
  const { focus, blowEndpoints = [], body, viewport } = input;
  const width = Math.max(0, viewport.width);
  const height = Math.max(0, viewport.height);
  const dpr = Number.isFinite(viewport.dpr) && viewport.dpr > 0 ? viewport.dpr : 1;
  const marginX = Math.min(64, width * 0.18);
  const marginY = Math.min(56, height * 0.2);
  const points = [focus, ...blowEndpoints];
  const focusLeft = Math.min(...points.map((point) => point.x));
  const focusRight = Math.max(...points.map((point) => point.x));
  const focusTop = Math.min(...points.map((point) => point.y));
  const focusBottom = Math.max(...points.map((point) => point.y));

  const softX = translationRange(focusLeft, focusRight, marginX, width - marginX);
  const softY = translationRange(focusTop, focusBottom, marginY, height - marginY);
  const factor = 1 - Math.exp((-FOLLOW_RATE * Math.max(0, input.deltaMs)) / 1000);
  // Ease toward the soft margin goal, then apply a hard same-frame body clamp.
  // If the focus/blow union conflicts with the body, full body containment wins.
  const easedX = snapDevice(closestToZero(softX) * factor, dpr);
  const easedY = snapDevice(closestToZero(softY) * factor, dpr);
  const bodyAfterEaseX = translationRange(body.left + easedX, body.right + easedX, 0, width);
  const bodyAfterEaseY = translationRange(body.top + easedY, body.bottom + easedY, 0, height);
  const nextPan = {
    x: easedX + hardCorrection(bodyAfterEaseX, dpr),
    y: easedY + hardCorrection(bodyAfterEaseY, dpr),
  };
  const finalBody = {
    left: body.left + nextPan.x,
    right: body.right + nextPan.x,
    top: body.top + nextPan.y,
    bottom: body.bottom + nextPan.y,
  };

  return {
    pan: nextPan,
    focusInsideMargins:
      inside(focusLeft + nextPan.x, marginX, width - marginX) &&
      inside(focusRight + nextPan.x, marginX, width - marginX) &&
      inside(focusTop + nextPan.y, marginY, height - marginY) &&
      inside(focusBottom + nextPan.y, marginY, height - marginY),
    bodyContained:
      finalBody.left >= -BODY_EDGE_EPSILON &&
      finalBody.top >= -BODY_EDGE_EPSILON &&
      finalBody.right <= width + BODY_EDGE_EPSILON &&
      finalBody.bottom <= height + BODY_EDGE_EPSILON,
    bodyFitsViewport: body.right - body.left <= width && body.bottom - body.top <= height,
  };
}

/** Applies a pure follow decision through Camera APIs, accounting for clamp rejection. */
export function applyTopdownFollow(
  camera: Camera,
  body: ActorBodyBounds,
  result: TopdownFollowResult,
): void {
  if (!result.bodyFitsViewport) {
    const width = body.right - body.left;
    const height = body.bottom - body.top;
    camera.zoomAt(
      { x: camera.viewport.width / 2, y: camera.viewport.height / 2 },
      Math.min(camera.viewport.width / width, camera.viewport.height / height),
    );
    return;
  }

  // At a hard board edge panBy may clamp part of the correction away, so a tall figure on the
  // first or last row stays clipped by the board's own edge. That is accepted: never refit from
  // here, or the board drops its integer zoom for the rest of the fight (#456 review).
  if (result.pan.x !== 0 || result.pan.y !== 0) camera.panBy(result.pan.x, result.pan.y);
}
