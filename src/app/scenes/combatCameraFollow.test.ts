import { describe, expect, it } from 'vitest';
import { actorKeepInViewDelta, shouldFollowAnimatedLargeActor } from './combatCameraFollow';

describe('animated large-actor camera follow', () => {
  const viewport = { width: 800, height: 500 };

  it('does not pan while the complete silhouette is inside the safe frame', () => {
    expect(actorKeepInViewDelta({ left: 12, top: 20, right: 788, bottom: 480 }, viewport)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('returns the smallest translation which reveals clipped body edges', () => {
    expect(actorKeepInViewDelta({ left: -8, top: 5, right: 720, bottom: 480 }, viewport)).toEqual({
      x: 20,
      y: 7,
    });
    expect(actorKeepInViewDelta({ left: 80, top: 40, right: 810, bottom: 505 }, viewport)).toEqual({
      x: -22,
      y: -17,
    });
  });

  it('leaves 1x1, scale-1, gate-off, stationary and manual-camera behavior unchanged', () => {
    const eligible = {
      animated: true,
      manualCamera: false,
      size: 2 as const,
      scale: 2,
      squareFootprints: true,
    };
    expect(shouldFollowAnimatedLargeActor(eligible)).toBe(true);
    expect(shouldFollowAnimatedLargeActor({ ...eligible, size: 1 })).toBe(false);
    expect(shouldFollowAnimatedLargeActor({ ...eligible, scale: 1 })).toBe(false);
    expect(shouldFollowAnimatedLargeActor({ ...eligible, squareFootprints: false })).toBe(false);
    expect(shouldFollowAnimatedLargeActor({ ...eligible, animated: false })).toBe(false);
    expect(shouldFollowAnimatedLargeActor({ ...eligible, manualCamera: true })).toBe(false);
  });
});
