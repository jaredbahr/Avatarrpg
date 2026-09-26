import { describe, expect, it } from 'vitest';
import type { ClipDef } from '../../content/assets/clips';
import { frameIndex, resolveClip } from './resolveClip';

const clip = (count: number, fps = 4, loop = false): ClipDef => ({
  frames: Array.from({ length: count }, (_, i) => `f/${i}`),
  fps,
  loop,
});

const minimal = { idle: clip(2, 1, true), cast: clip(3, 8) };
const full = { ...minimal, walk: clip(4, 4, true), melee: clip(2), hit: clip(1), ko: clip(1) };

describe('resolveClip', () => {
  it('keeps optional exploration rests compatible with existing directional sheets', () => {
    const directional = { ...minimal, idleNorth: clip(1), idleSouth: clip(1) };
    expect(resolveClip(directional, 'restNorth')?.clip).toBe('idleNorth');
    expect(resolveClip(directional, 'restSouth')?.clip).toBe('idleSouth');
    expect(resolveClip(minimal, 'rest')?.clip).toBe('idle');
    expect(resolveClip({ ...minimal, rest: clip(1) }, 'restNorth')?.clip).toBe('rest');
    expect(resolveClip({ ...directional, restNorth: clip(1) }, 'restNorth')).toMatchObject({
      clip: 'restNorth',
      exact: true,
    });
    expect(resolveClip({ ...directional, rest: clip(1) }, 'idle')?.clip).toBe('idle');
  });

  it('draws a missing fighting stance as the idle of the same heading (ADR 0052)', () => {
    const directional = { ...minimal, idleNorth: clip(1), idleSouth: clip(1) };
    expect(resolveClip(minimal, 'stance')?.clip).toBe('idle');
    expect(resolveClip(directional, 'stanceNorth')?.clip).toBe('idleNorth');
    expect(resolveClip(directional, 'stanceSouthWest')?.clip).toBe('idleSouth');
    expect(resolveClip(directional, 'stanceWest')?.clip).toBe('idle');
    expect(resolveClip({ ...directional, idleNorthEast: clip(4) }, 'stanceNorthEast')?.clip).toBe(
      'idleNorthEast',
    );
    expect(resolveClip({ ...minimal, stance: clip(8, 6, true) }, 'stance')).toMatchObject({
      clip: 'stance',
      exact: true,
    });
  });

  it('holds each tea cel slowly and falls back honestly when the sheet lacks it', () => {
    const tea = resolveClip({ ...minimal, tea: clip(2, 0.25, true) }, 'tea');
    if (!tea) throw new Error('missing tea');
    expect(frameIndex(tea, 3999, undefined)).toBe(0);
    expect(frameIndex(tea, 4000, undefined)).toBe(1);
    expect(frameIndex(tea, 8000, undefined)).toBe(0);
    expect(frameIndex(tea, 5000, 0)).toBe(0);
    expect(resolveClip(minimal, 'tea')).toMatchObject({ clip: 'idle', exact: false });
  });

  it('finds the clip itself when the sheet has it', () => {
    expect(resolveClip(full, 'melee')).toMatchObject({ clip: 'melee', exact: true });
  });

  it('falls down the table when it does not', () => {
    expect(resolveClip(minimal, 'walk')).toMatchObject({ clip: 'idle', exact: false });
    expect(resolveClip(minimal, 'melee')).toMatchObject({ clip: 'cast', exact: false });
    expect(resolveClip(minimal, 'hit')).toMatchObject({ clip: 'idle', exact: false });
    expect(resolveClip(minimal, 'ko')).toMatchObject({ clip: 'idle', exact: false });
    expect(resolveClip({ idle: clip(2), cast: clip(3), hit: clip(1) }, 'ko')).toMatchObject({
      clip: 'hit',
    });
  });

  it('is null only for a sheet with nothing to draw', () => {
    expect(resolveClip({}, 'idle')).toBeNull();
    expect(resolveClip({ idle: { frames: [], fps: 1, loop: true } }, 'idle')).toBeNull();
  });
});

describe('frameIndex', () => {
  it('takes the named frame on an exact clip, clamped', () => {
    const cast = resolveClip(full, 'cast');
    if (!cast) throw new Error('no cast');
    expect(frameIndex(cast, 9999, 1)).toBe(1);
    expect(frameIndex(cast, 0, 7)).toBe(2);
  });

  it('plays the wind-up and strike when melee borrows compatible cast drawings', () => {
    const melee = resolveClip(minimal, 'melee');
    if (!melee) throw new Error('no melee');
    expect(frameIndex(melee, 0, 0)).toBe(0);
    expect(frameIndex(melee, 999, 1)).toBe(1);
  });

  it('holds the last drawing for an unrelated fallback, such as a cast borrowing idle', () => {
    const idle = resolveClip({ idle: clip(2) }, 'cast');
    if (!idle) throw new Error('no idle');
    expect(frameIndex(idle, 0, 0)).toBe(1);
  });

  it('plays by time otherwise, looping or holding the last frame', () => {
    const walk = resolveClip(full, 'walk');
    const cast = resolveClip(full, 'cast');
    if (!walk || !cast) throw new Error('no clips');
    expect(frameIndex(walk, 0, undefined)).toBe(0);
    expect(frameIndex(walk, 250, undefined)).toBe(1);
    expect(frameIndex(walk, 1250, undefined)).toBe(1);
    expect(frameIndex(cast, 125, undefined)).toBe(1);
    expect(frameIndex(cast, 5000, undefined)).toBe(2);
    expect(frameIndex(resolveClip(full, 'hit')!, 5000, undefined)).toBe(0);
  });
});
