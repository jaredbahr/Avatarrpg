import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from './index';
import { validateContent } from './schemas';
import {
  EXCLUDED_RESIDENTS,
  IDENTITY_REGISTER,
  isExcludedResident,
  isReservedIdentity,
} from './identity';

describe('the identity register (ADR 0047 W0)', () => {
  it('lists no record or NpcDef for the five missing in real content', () => {
    for (const excluded of EXCLUDED_RESIDENTS) {
      const claimedByNpc = CONTENT_BUNDLE.maps.some((map) =>
        map.npcs.some((npc) => npc.id === excluded.id),
      );
      expect(claimedByNpc, `${excluded.id} should have no NpcDef`).toBe(false);
    }
    expect(validateContent(CONTENT_BUNDLE)).toEqual([]);
  });

  it('rejects a fixture that declares one of the five missing as an NpcDef', () => {
    const village = CONTENT_BUNDLE.maps.find((map) => map.id === 'ba_dan_village');
    if (!village) throw new Error('Missing village map fixture');
    const withCaptive = {
      ...CONTENT_BUNDLE,
      maps: CONTENT_BUNDLE.maps.map((map) =>
        map.id === village.id
          ? {
              ...map,
              npcs: [
                ...map.npcs,
                {
                  id: 'lw.npc.bo_shan',
                  name: 'Bo-shan',
                  pos: map.npcs[0]!.pos,
                  sprite: map.npcs[0]!.sprite,
                  node: map.npcs[0]!.node,
                },
              ],
            }
          : map,
      ),
    };
    const problems = validateContent(withCaptive);
    expect(problems.some((p) => p.includes('lw.npc.bo_shan'))).toBe(true);
  });

  it('keeps Bo distinct from Bo-shan, and Dema/Sen/Senn/Sena distinct from each other', () => {
    expect(isReservedIdentity('lw.npc.bo')).toBe(true);
    expect(isReservedIdentity('lw.npc.bo_shan')).toBe(true);
    expect(isExcludedResident('lw.npc.bo')).toBe(false);
    expect(isExcludedResident('lw.npc.bo_shan')).toBe(true);

    const ids = IDENTITY_REGISTER.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('lw.npc.dema_cook');
    expect(ids).toContain('lw.npc.sen_tea');
    expect(ids).toContain('lw.npc.senn_messenger');
    expect(ids).toContain('lw.npc.sena');
  });

  it('never yields the five missing from visibleNpcs on any map', () => {
    for (const excluded of EXCLUDED_RESIDENTS) {
      for (const map of CONTENT_BUNDLE.maps) {
        expect(map.npcs.some((npc) => npc.id === excluded.id)).toBe(false);
      }
    }
  });
});
