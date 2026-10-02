import { describe, expect, it } from 'vitest';
import {
  actorKeepInViewDelta,
  combatCameraFollowDecision,
  shouldFollowAnimatedLargeActor,
} from './combatCameraFollow';

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

  it.each([
    ['horizontal', { left: -100, top: 100, right: 740, bottom: 300 }],
    ['vertical', { left: 100, top: -100, right: 300, bottom: 460 }],
  ] as const)('centres an oversized body stably on the %s axis', (_axis, body) => {
    const delta = actorKeepInViewDelta(body, viewport);
    const moved = {
      left: body.left + delta.x,
      right: body.right + delta.x,
      top: body.top + delta.y,
      bottom: body.bottom + delta.y,
    };
    expect(actorKeepInViewDelta(moved, viewport)).toEqual({ x: 0, y: 0 });
  });

  it('limits eligibility to enlarged square 2x2 actors', () => {
    const eligible = {
      size: 2 as const,
      scale: 2,
      squareFootprints: true,
    };
    expect(shouldFollowAnimatedLargeActor(eligible)).toBe(true);
    expect(shouldFollowAnimatedLargeActor({ ...eligible, size: 1 })).toBe(false);
    expect(shouldFollowAnimatedLargeActor({ ...eligible, scale: 1 })).toBe(false);
    expect(shouldFollowAnimatedLargeActor({ ...eligible, squareFootprints: false })).toBe(false);
  });

  it('moves idle -> following -> release recentre, with one owner per frame', () => {
    const following = combatCameraFollowDecision(
      { kind: 'idle' },
      {
        animatedUnitId: 'boss',
        activeUnitId: 'hero',
        followSuspended: false,
        reducedMotion: false,
      },
    );
    expect(following).toEqual({
      state: { kind: 'following', unitId: 'boss' },
      owner: 'follow',
    });
    expect(
      combatCameraFollowDecision(following.state, {
        animatedUnitId: 'boss',
        activeUnitId: 'hero',
        followSuspended: false,
        reducedMotion: false,
      }),
    ).toEqual({ state: following.state, owner: 'follow' });
    expect(
      combatCameraFollowDecision(following.state, {
        animatedUnitId: null,
        activeUnitId: 'hero',
        followSuspended: false,
        reducedMotion: false,
      }),
    ).toEqual({ state: { kind: 'idle' }, owner: 'recentre' });
  });

  it('suspended framing keeps idle while an animation is present', () => {
    expect(
      combatCameraFollowDecision(
        { kind: 'idle' },
        {
          animatedUnitId: 'boss',
          activeUnitId: 'hero',
          followSuspended: true,
          reducedMotion: false,
        },
      ),
    ).toEqual({ state: { kind: 'idle' }, owner: 'idle' });
  });

  it('manual framing suspends follow and suppresses release recentring', () => {
    const state = { kind: 'following', unitId: 'boss' } as const;
    expect(
      combatCameraFollowDecision(state, {
        animatedUnitId: 'boss',
        activeUnitId: 'hero',
        followSuspended: true,
        reducedMotion: false,
      }).owner,
    ).toBe('idle');
    expect(
      combatCameraFollowDecision(state, {
        animatedUnitId: null,
        activeUnitId: 'hero',
        followSuspended: true,
        reducedMotion: false,
      }),
    ).toEqual({ state: { kind: 'idle' }, owner: 'idle' });
  });

  it('does not follow or release an animated actor under reduced motion', () => {
    expect(
      combatCameraFollowDecision(
        { kind: 'idle' },
        {
          animatedUnitId: 'boss',
          activeUnitId: 'hero',
          followSuspended: false,
          reducedMotion: true,
        },
      ),
    ).toEqual({ state: { kind: 'idle' }, owner: 'idle' });
    expect(
      combatCameraFollowDecision(
        { kind: 'following', unitId: 'boss' },
        {
          animatedUnitId: null,
          activeUnitId: 'hero',
          followSuspended: false,
          reducedMotion: true,
        },
      ),
    ).toEqual({ state: { kind: 'idle' }, owner: 'idle' });
  });
});
