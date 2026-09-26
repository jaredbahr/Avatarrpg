import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../content/assets/manifest';
import type { ContentIndex, Unit, Vec2 } from '../../core/types';
import { riversideWalkTime } from '../../render/living/geometry';
import { frameIndex, resolveClip } from '../../render/sheets/resolveClip';
import { Animator } from '../animator';
import { drawnPose, drawnSprite } from './riversidePose';

const content = { abilities: new Map() } as unknown as ContentIndex;

const MEMBERS = [
  { id: 'sura', characterId: 'sura', sprite: 'unit.water.sura' },
  { id: 'kaya', characterId: 'kaya', sprite: 'unit.fire.kaya' },
] as const satisfies readonly Pick<Unit, 'id' | 'characterId' | 'sprite'>[];

function walker(member: (typeof MEMBERS)[number], to: Vec2): Animator {
  const a = new Animator(content, { motionReduced: () => false });
  a.push(0, [{ type: 'partyWalked', unitId: member.id, from: { x: 4, y: 4 }, path: [to] }], []);
  return a;
}

describe('the riverside poses Sura and Kaya from the sheets it draws', () => {
  it('draws them from their village sheets there, and from their unit art elsewhere', () => {
    for (const member of MEMBERS) {
      expect(drawnSprite(member, true)).toBe(`unit.village.${member.characterId}`);
      expect(drawnSprite(member, false)).toBe(member.sprite);
    }
    expect(drawnSprite({ characterId: 'bo', sprite: 'unit.earth.bo' }, true)).toBe('unit.earth.bo');
  });

  for (const member of MEMBERS) {
    it(`plays ${member.id}'s four village walk drawings once over two tiles`, () => {
      const village = ASSETS[`unit.village.${member.characterId}`];
      if (village?.kind !== 'sheet' || village.locomotion)
        throw new Error('Four-way village sheet');
      const walk = resolveClip(village.clips, 'walk');
      if (!walk) throw new Error('Village walk');
      const a = walker(member, { x: 8, y: 4 });
      const end = a.finishesAt;
      const seen: number[] = [];
      for (let t = 0; t <= end; t += end / 40) {
        const at = a.renderPos(t, member.id);
        if (!at) continue;
        const pose = drawnPose(a, t, member, true);
        expect(pose.clip, `${t}`).toBe('walk');
        // The real unitPose clock of the drawn sheet: 500 ms of clip a tile.
        const travelled = at.x - 4;
        expect(pose.clipTime ?? -1, `${t}`).toBeCloseTo(500 * travelled, 0);
        // One drawing every half tile: all four over two tiles, in order.
        const half = travelled * 2;
        if (Math.abs(half - Math.round(half)) < 0.05) continue;
        const frame = frameIndex(walk, riversideWalkTime(pose.clipTime ?? 0, true), undefined);
        expect(frame, `${travelled.toFixed(2)} tiles`).toBe(Math.floor(half) % 4);
        seen.push(frame);
      }
      expect(new Set(seen).size).toBe(4);
      // The unit art would have run the same walk on its own eight-way gait.
      const unit = ASSETS[member.sprite];
      if (unit?.kind !== 'sheet' || !unit.locomotion) throw new Error('Eight-way unit art');
      const mid = a.renderPos(end / 2, member.id);
      expect(drawnPose(a, end / 2, member, false).clipTime).toBeCloseTo(
        unit.locomotion.walkMsPerTile.east * ((mid?.x ?? 4) - 4),
        0,
      );
      expect(unit.locomotion.walkMsPerTile.east).toBeGreaterThan(1000);
    });

    it(`walks ${member.id} on the village sheet's four-way headings`, () => {
      // A (0.8, -0.6) tangent is a side walk on a four-way sheet and a
      // diagonal on the eight-way unit art; straight up is the back walk.
      const side = walker(member, { x: 8, y: 1 });
      expect(drawnPose(side, 200, member, true).clip).toBe('walk');
      expect(drawnPose(side, 200, member, false).clip).toBe('walkNorthEast');
      const back = walker(member, { x: 4, y: 0 });
      const pose = drawnPose(back, back.finishesAt / 2, member, true);
      expect(pose.clip).toBe('walkNorth');
      const at = back.renderPos(back.finishesAt / 2, member.id);
      expect(pose.clipTime ?? -1).toBeCloseTo(500 * (4 - (at?.y ?? 4)), 0);
    });
  }
});
