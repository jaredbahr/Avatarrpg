import { describe, expect, it } from 'vitest';
import type { ContentIndex, GameEvent, Unit } from '../../core/types';
import { sheetLocomotion, useTopDownStyle } from '../../content/assets/manifest';
import { Animator } from '../animator';
import { choreograph } from './choreography';

const content = { abilities: new Map() } as unknown as ContentIndex;
const from = { x: 4, y: 4 };
const path = [5, 6, 7, 8].map((x) => ({ x, y: 4 }));
const sprite = 'unit.fire.kaya';
const unit = { id: 'p', pos: from, sprite } as Unit;
const walked: GameEvent = { type: 'partyWalked', unitId: 'p', from, path };
const moved: GameEvent = { type: 'unitMoved', unitId: 'p', path, cost: path.length };

function animate(event: GameEvent, reduced = false): Animator {
  const animator = new Animator(content, { motionReduced: () => reduced });
  animator.push(0, [event], [unit]);
  return animator;
}

describe('exploration pace without a combat gait change', () => {
  it('cruises 20% faster in exploration, retaining the 120 ms ramps and combat pace', () => {
    const exploration = animate(walked);
    const combat = animate(moved);
    expect(exploration.finishesAt).toBe(2620);
    expect(combat.finishesAt).toBe(3000);
    expect(exploration.renderPos(120, 'p')?.x).toBeCloseTo(4.096, 9);
    expect(combat.renderPos(120, 'p')?.x).toBeCloseTo(4 + 1 / 12, 9);
    expect(
      (exploration.renderPos(500, 'p')?.x ?? 0) - (exploration.renderPos(300, 'p')?.x ?? 0),
    ).toBeCloseTo(0.32, 9);
    expect((combat.renderPos(500, 'p')?.x ?? 0) - (combat.renderPos(300, 'p')?.x ?? 0)).toBeCloseTo(
      200 / 720,
      9,
    );
    expect(exploration.renderPos(2619, 'p')?.x).toBeCloseTo(8, 4);
  });

  it('keeps the calibrated native-G1 clip advance for the same distance in exploration and combat', () => {
    const gait = sheetLocomotion(sprite);
    if (!gait) throw new Error('Kaya has a declared gait');
    // One tile at cruising pace: 625 + 60 ms in exploration, 720 + 60 in combat.
    for (const [event, time] of [
      [walked, 685],
      [moved, 780],
    ] as const) {
      const animator = animate(event);
      expect(animator.renderPos(time, 'p')?.x).toBeCloseTo(5, 9);
      expect((animator.unitPose(time, 'p', sprite)?.clipTime ?? 0) - gait.walkStartMs)
        // ADR 0095's accepted 70 ms cel at the original 750 ms/tile.
        .toBeCloseTo((114 * 750) / 70, 8);
      const a = animator.unitPose(time, 'p', sprite)?.clipTime ?? 0;
      const b = animator.unitPose(time + 70, 'p', sprite)?.clipTime ?? 0;
      expect(b - a).toBeCloseTo(((114 * 750) / 70) * (70 / (event === walked ? 625 : 720)), 8);
    }
  });

  it('keeps reduced-motion movement locks and places each audible step on its traveled tile', () => {
    for (const event of [walked, moved]) {
      expect(animate(event, true).finishesAt).toBeCloseTo(8.8, 9);
      for (const rate of [1, 0.02]) {
        const result = choreograph({
          content,
          events: [event],
          unitsBefore: [unit],
          cursor: 0,
          rate,
          pushIndex: 0,
        });
        const move = result.tracks.find((track) => track.kind === 'move');
        if (!move || move.kind !== 'move') throw new Error('a movement track was scheduled');
        expect(result.sounds).toHaveLength(4);
        result.sounds.forEach((sound, distance) => {
          expect(move.ease(sound.at / move.duration) * move.curve.length).toBeCloseTo(distance, 9);
        });
      }
    }
  });
});

describe('the top-down walk (ADR 0104)', () => {
  // Last in the file: `?style=topdown` stays on for the rest of this module.
  it("walks at the prototype's 130 px/s, about 308 ms a tile, and the clip keeps time with the ground", () => {
    useTopDownStyle();
    const gait = sheetLocomotion(sprite);
    if (!gait) throw new Error('top-down Kaya has a declared gait');
    expect(gait.walkCelMs).toBeUndefined();
    const pace = gait.walkMsPerTile.east;
    expect(pace).toBeCloseTo(307.7, 1);
    const animator = new Animator(content, { motionReduced: () => false });
    animator.setProjection('topdown');
    animator.push(0, [walked], [unit]);
    // four tiles at the fitted pace and the 120 ms of ramps
    expect(animator.finishesAt).toBeCloseTo(4 * pace + 120, 6);
    // No slide: at the cruise, clip time runs at exactly the rate the ground goes by.
    for (const at of [200, 600, 1000]) {
      const a = animator.unitPose(at, 'p', sprite)?.clipTime ?? 0;
      const b = animator.unitPose(at + 100, 'p', sprite)?.clipTime ?? 0;
      const ground =
        ((animator.renderPos(at + 100, 'p')?.x ?? 0) - (animator.renderPos(at, 'p')?.x ?? 0)) *
        pace;
      expect(b - a).toBeCloseTo(100, 6);
      expect(ground).toBeCloseTo(100, 6);
    }
  });
});
