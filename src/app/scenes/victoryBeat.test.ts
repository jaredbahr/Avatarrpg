import { describe, expect, it } from 'vitest';
import type { Unit } from '../../core/types';
import { Camera } from '../../render/camera';
import {
  advanceVictoryBeat,
  beginVictoryBeat,
  frameLivingParty,
  livingPartyFocus,
} from './victoryBeat';

function unit(
  id: string,
  faction: Unit['faction'],
  pos: Unit['pos'],
  size: Unit['size'] = 1,
  hp = 10,
): Unit {
  return {
    id,
    name: id,
    faction,
    element: 'fire',
    characterId: null,
    enemyId: null,
    disciplineId: null,
    level: 1,
    xp: 0,
    pos,
    size,
    hp,
    ap: 0,
    move: 0,
    bankedAp: 0,
    pendingAp: 0,
    base: { maxHp: 10, maxAp: 2, maxMove: 3, power: 1, defense: 1, speed: 1, focus: 1 },
    abilities: [],
    cooldowns: {},
    statuses: [],
    ai: 'none',
    temporary: false,
    sprite: 'unit.test',
  };
}

describe('victory beat', () => {
  it('frames all and only living party members, including large footprints', () => {
    expect(
      livingPartyFocus([
        unit('front', 'party', { x: 2, y: 3 }),
        unit('large', 'party', { x: 8, y: 5 }, 2),
        unit('fallen', 'party', { x: -10, y: -10 }, 1, 0),
        unit('enemy', 'enemy', { x: 20, y: 20 }),
      ]),
    ).toEqual({ x: 5.5, y: 4.5 });
    expect(livingPartyFocus([unit('enemy', 'enemy', { x: 4, y: 4 })])).toBeNull();
  });

  it('holds for the named duration and pauses without consuming time', () => {
    const clock = beginVictoryBeat(100, 700);
    let step = advanceVictoryBeat(clock, 350, false, false);
    expect(step.complete).toBe(false);
    expect(step.clock.remainingMs).toBe(450);

    step = advanceVictoryBeat(step.clock, 900, true, false);
    expect(step.complete).toBe(false);
    expect(step.clock.remainingMs).toBe(450);

    step = advanceVictoryBeat(step.clock, 10_000, false, false);
    expect(step.complete).toBe(false);
    expect(step.clock.remainingMs).toBe(450);
    step = advanceVictoryBeat(step.clock, 10_449, false, false);
    expect(step.complete).toBe(false);
    step = advanceVictoryBeat(step.clock, 10_450, false, false);
    expect(step.complete).toBe(true);
  });

  it('skips the hold immediately for reduced motion', () => {
    expect(advanceVictoryBeat(beginVictoryBeat(100, 700), 100, false, true).complete).toBe(true);
  });

  it('zooms out only as far as needed to keep a spread party in frame', () => {
    const camera = new Camera({ width: 1024, height: 480, dpr: 1 }, { width: 20, height: 12 });
    camera.scale = 1.5;
    camera.centre();
    const survivors = [
      unit('west', 'party', { x: 2, y: 4 }),
      unit('east', 'party', { x: 16, y: 6 }),
    ];

    const focus = livingPartyFocus(survivors);
    const framing = frameLivingParty(camera, survivors);

    expect(framing).toEqual(focus);
    expect(camera.scale).toBeLessThan(1.5);
    expect(camera.scale).toBeGreaterThan(camera.fitScale());
    for (const survivor of survivors) {
      const corners = [
        survivor.pos,
        { x: survivor.pos.x + survivor.size, y: survivor.pos.y },
        { x: survivor.pos.x + survivor.size, y: survivor.pos.y + survivor.size },
        { x: survivor.pos.x, y: survivor.pos.y + survivor.size },
      ];
      for (const corner of corners) {
        const point = camera.project(corner);
        expect(point.x).toBeGreaterThanOrEqual(48);
        expect(point.x).toBeLessThanOrEqual(camera.viewport.width - 48);
        expect(point.y).toBeGreaterThanOrEqual(48);
        expect(point.y).toBeLessThanOrEqual(camera.viewport.height - 48);
      }
    }
  });

  it('keeps pixel-art integer zoom stops while framing a spread party', () => {
    const camera = new Camera(
      { width: 1600, height: 900, dpr: 2 },
      { width: 20, height: 12 },
      'oblique',
    );
    camera.integerZoom = true;
    camera.scale = 2;
    camera.centre();
    const survivors = [
      unit('west', 'party', { x: 2, y: 4 }),
      unit('east', 'party', { x: 16, y: 6 }),
    ];

    frameLivingParty(camera, survivors);

    expect(camera.scale).toBeLessThan(2);
    expect(camera.onWholeDevicePixels).toBe(true);
  });
});
