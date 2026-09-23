import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE } from './index';
import { validateContent } from './schemas';
import { createGame } from '../core/state/createGame';
import { visibleNpcs } from '../core/story/world';
import {
  EXCLUDED_RESIDENTS,
  FORBIDDEN_BINDINGS,
  IDENTITY_REGISTER,
  isExcludedResident,
  isReservedIdentity,
} from './identity';

describe('the identity register (ADR 0047 W0)', () => {
  it('lists no record or NpcDef for the seven missing in real content', () => {
    for (const excluded of EXCLUDED_RESIDENTS) {
      const claimedByNpc = CONTENT_BUNDLE.maps.some((map) =>
        map.npcs.some((npc) => npc.id === excluded.id || excluded.names.includes(npc.name)),
      );
      expect(claimedByNpc, `${excluded.id} should have no NpcDef`).toBe(false);
    }
    expect(validateContent(CONTENT_BUNDLE)).toEqual([]);
  });

  it('rejects a fixture that declares one of the seven missing as an NpcDef by design key', () => {
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

  it('rejects a fixture that declares one of the seven missing by its real runtime id', () => {
    // Real content never uses the design key as an NpcDef id — a runtime id
    // looks like `dema` or `elder_mira`. This fixture matches the shape real
    // content would actually take, which is the case the old id-only check
    // could never catch (it only compared against `lw.npc.*` design keys).
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
                  id: 'bo_shan',
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
    expect(problems.some((p) => p.includes('"bo_shan"'))).toBe(true);
  });

  it('keeps every look-alike pair distinct: Bo/Bo-shan, Hesh/Hesra, Miri/Mira, Dema (cook)/Dema (road-keeper), Sen/Senn/Sena', () => {
    expect(isReservedIdentity('lw.npc.bo')).toBe(true);
    expect(isReservedIdentity('lw.npc.bo_shan')).toBe(true);
    expect(isExcludedResident('lw.npc.bo')).toBe(false);
    expect(isExcludedResident('lw.npc.bo_shan')).toBe(true);

    expect(isExcludedResident('lw.npc.hesh')).toBe(true);
    expect(isExcludedResident('lw.npc.hesra')).toBe(true);
    expect(isExcludedResident('lw.npc.miri')).toBe(true);
    expect(isExcludedResident('lw.npc.mira')).toBe(false);
    expect(isReservedIdentity('lw.npc.mira')).toBe(true);
    expect(isReservedIdentity('lw.npc.dema_roadkeeper')).toBe(true);
    expect(isExcludedResident('lw.npc.dema_roadkeeper')).toBe(false);

    const ids = IDENTITY_REGISTER.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('lw.npc.dema_cook');
    expect(ids).toContain('lw.npc.dema_roadkeeper');
    expect(ids).toContain('lw.npc.sen_tea');
    expect(ids).toContain('lw.npc.senn_messenger');
    expect(ids).toContain('lw.npc.sena');
    expect(ids).toContain('lw.npc.mira');

    // Every name and runtime slug is claimed by exactly one entry — the
    // whole point of the register is that these pairs never collide.
    const allNames = IDENTITY_REGISTER.flatMap((entry) => entry.names);
    expect(new Set(allNames).size).toBe(allNames.length);
    const allSlugs = IDENTITY_REGISTER.flatMap((entry) => entry.runtimeSlugs);
    expect(new Set(allSlugs).size).toBe(allSlugs.length);
  });

  it('never yields the seven missing from visibleNpcs on any map', () => {
    const state = createGame(CONTENT, {
      seed: 'identity',
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });
    for (const excluded of EXCLUDED_RESIDENTS) {
      for (const map of CONTENT.maps.values()) {
        const visible = visibleNpcs(map, state);
        expect(
          visible.some((npc) => npc.id === excluded.id || excluded.names.includes(npc.name)),
          `${excluded.id} should never be visible on "${map.id}"`,
        ).toBe(false);
      }
    }
  });

  it('exports the forbidden-binding table for W4a, pointing at real register entries', () => {
    expect(FORBIDDEN_BINDINGS.dema).toContain('lw.npc.dema_cook');
    expect(FORBIDDEN_BINDINGS.rest_keeper).toContain('lw.npc.sen_tea');
    for (const forbiddenIds of Object.values(FORBIDDEN_BINDINGS)) {
      for (const id of forbiddenIds) {
        expect(isReservedIdentity(id), `${id} should be a registered identity`).toBe(true);
      }
    }
  });
});
