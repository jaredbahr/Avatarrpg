import { describe, expect, it } from 'vitest';
import { FOOT_LINE } from './sheets/bake';
import { G_HEAD_TILES, npcPipLift } from './npcPip';

describe('the talk pip (issue #284)', () => {
  it('sits over a G resident’s head, never on its face', () => {
    // The head tops measured on the packed cels: adults 0.87-0.94 tiles, Pella 0.68.
    for (const sprite of ['npc.elder', 'npc.shopkeeper', 'npc.dorin', 'npc.guard', 'npc.household'])
      expect(npcPipLift(sprite, 1)).toBeGreaterThan(0.94);
    expect(npcPipLift('npc.kid', 1)).toBeGreaterThan(0.68);
    expect(npcPipLift('npc.kid', 1)).toBeLessThan(G_HEAD_TILES);
    expect(npcPipLift('npc.elder', 1.25)).toBeCloseTo(npcPipLift('npc.elder', 1) * 1.25, 9);
  });

  it('keeps the old height for a painted or image figure', () => {
    expect(npcPipLift('npc.hanru', 1.4)).toBeCloseTo((FOOT_LINE - 0.08) * 1.4, 9);
    expect(npcPipLift('world.tea_station', 1.5)).toBeCloseTo((FOOT_LINE - 0.08) * 1.5, 9);
  });
});
