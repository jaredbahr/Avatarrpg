import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE } from './index';
import { validateContent } from './schemas';
import type { ContentBundle } from './schemas';
import { createGame } from '../core/state/createGame';
import { visibleNpcs } from '../core/story/world';
import {
  EXCLUDED_RESIDENTS,
  FORBIDDEN_BINDINGS,
  IDENTITY_REGISTER,
  RELEASED_RESIDENTS,
  excludedResidentFor,
  isExcludedResident,
  isReservedIdentity,
} from './identity';

/** Adds an NpcDef to the village map: the shape a real identity claim takes. */
function withVillageNpc(id: string, name: string): ContentBundle {
  const village = CONTENT_BUNDLE.maps.find((map) => map.id === 'ba_dan_village');
  if (!village) throw new Error('Missing village map fixture');
  const base = village.npcs[0];
  if (!base) throw new Error('The village map has no NpcDef to copy');
  return {
    ...CONTENT_BUNDLE,
    maps: CONTENT_BUNDLE.maps.map((map) =>
      map.id === village.id
        ? {
            ...map,
            npcs: [...map.npcs, { id, name, pos: base.pos, sprite: base.sprite, node: base.node }],
          }
        : map,
    ),
  };
}

/** Every blocked entry that would reject a record claiming `entry`. */
function claims(entry: (typeof IDENTITY_REGISTER)[number]) {
  return [entry.id, ...entry.runtimeSlugs, ...entry.names].map((key) =>
    excludedResidentFor(key, entry.name),
  );
}

describe('the identity register (ADR 0047 W0, released W2)', () => {
  it('releases the five returnees under one canonical key each', () => {
    expect(RELEASED_RESIDENTS.map((entry) => entry.id)).toEqual([
      'lw.npc.bo_shan',
      'lw.npc.leto',
      'lw.npc.amri',
      'lw.npc.hesra',
      'lw.npc.senn_messenger',
    ]);
    for (const entry of RELEASED_RESIDENTS) {
      expect(isReservedIdentity(entry.id), `${entry.id} stays reserved`).toBe(true);
      expect(isExcludedResident(entry.id), `${entry.id} is released`).toBe(false);
      expect(claims(entry).filter(Boolean), `${entry.id} should be claimable`).toEqual([]);
    }
    // `senn` is the messenger's runtime slug, and no other entry may wear it.
    const sennSlugs = IDENTITY_REGISTER.filter((entry) => entry.runtimeSlugs.includes('senn'));
    expect(sennSlugs.map((entry) => entry.id)).toEqual(['lw.npc.senn_messenger']);
  });

  it('stays excluded for Hesh and Miri, by key, runtime id and name', () => {
    expect(EXCLUDED_RESIDENTS.map((entry) => entry.id).sort()).toEqual([
      'lw.npc.hesh',
      'lw.npc.miri',
    ]);
    for (const excluded of EXCLUDED_RESIDENTS) {
      expect(isReservedIdentity(excluded.id)).toBe(true);
      expect(isExcludedResident(excluded.id)).toBe(true);
      for (const key of [excluded.id, ...excluded.runtimeSlugs]) {
        expect(excludedResidentFor(key, 'someone else')?.id, key).toBe(excluded.id);
      }
      for (const name of excluded.names) {
        expect(excludedResidentFor('someone_else', name)?.id, name).toBe(excluded.id);
      }
    }
  });

  it('keeps lw.npc.senn only as the blocked legacy alias of the canonical messenger', () => {
    const legacy = excludedResidentFor('lw.npc.senn', 'Senn (a messenger)');
    expect(legacy?.id).toBe('lw.npc.senn');
    expect(isExcludedResident('lw.npc.senn')).toBe(true);
    expect(isReservedIdentity('lw.npc.senn')).toBe(true);
    // The legacy key carries no display name, so the canonical record may wear "Senn".
    expect(excludedResidentFor('lw.npc.senn_messenger', 'Senn')).toBeUndefined();
    expect(excludedResidentFor('senn', 'Senn')).toBeUndefined();
  });

  it('has no NpcDef or visible placement for the five while their profiles are missing', () => {
    for (const entry of RELEASED_RESIDENTS) {
      const claimedByNpc = CONTENT_BUNDLE.maps.some((map) =>
        map.npcs.some(
          (npc) =>
            npc.id === entry.id ||
            entry.runtimeSlugs.includes(npc.id) ||
            entry.names.includes(npc.name),
        ),
      );
      expect(claimedByNpc, `${entry.id} should have no NpcDef`).toBe(false);
    }
    const state = createGame(CONTENT, {
      seed: 'identity',
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });
    for (const entry of RELEASED_RESIDENTS) {
      for (const map of CONTENT.maps.values()) {
        const visible = visibleNpcs(CONTENT, map, state);
        expect(
          visible.some(
            (npc) =>
              npc.id === entry.id ||
              entry.runtimeSlugs.includes(npc.id) ||
              entry.names.includes(npc.name),
          ),
          `${entry.id} should never be visible on "${map.id}"`,
        ).toBe(false);
      }
    }
    expect(validateContent(CONTENT_BUNDLE)).toEqual([]);
  });

  it('rejects a fixture that declares Hesh or Miri as an NpcDef', () => {
    for (const excluded of EXCLUDED_RESIDENTS) {
      const candidates = [
        { id: excluded.id, name: 'Anyone' },
        { id: excluded.runtimeSlugs[0]!, name: 'Anyone' },
        { id: 'someone_else', name: excluded.name },
      ];
      for (const { id, name } of candidates) {
        const problems = validateContent(withVillageNpc(id, name));
        expect(
          problems.some((p) => p.includes(excluded.id)),
          `${id}/${name}`,
        ).toBe(true);
      }
    }
  });

  it('rejects a fixture that reuses the superseded lw.npc.senn key as an NpcDef id', () => {
    const problems = validateContent(withVillageNpc('lw.npc.senn', 'Senn'));
    expect(problems.some((p) => p.includes('lw.npc.senn'))).toBe(true);
  });

  it('keeps every look-alike pair distinct: Bo/Bo-shan, Hesh/Hesra, Miri/Mira, Dema (cook)/Dema (road-keeper), Sen/Senn/Sena', () => {
    expect(isReservedIdentity('lw.npc.bo')).toBe(true);
    expect(isReservedIdentity('lw.npc.bo_shan')).toBe(true);
    expect(isExcludedResident('lw.npc.bo')).toBe(false);
    expect(isExcludedResident('lw.npc.bo_shan')).toBe(false);
    // "Bo" and "Bo-shan" are two people, not two spellings of one name.
    expect(excludedResidentFor('bo', 'Bo')).toBeUndefined();
    expect(excludedResidentFor('bo_shan', 'Bo')).toBeUndefined();

    expect(isExcludedResident('lw.npc.hesh')).toBe(true);
    expect(isExcludedResident('lw.npc.hesra')).toBe(false);
    expect(isReservedIdentity('lw.npc.hesra')).toBe(true);
    expect(excludedResidentFor('hesra', 'Hesra')).toBeUndefined();
    expect(excludedResidentFor('hesh', 'Hesh')?.id).toBe('lw.npc.hesh');
    // Wearing the carving's name is still a claim on Hesh, whatever the key:
    // the pair stays distinct because neither *key* reaches the other person.
    expect(excludedResidentFor('hesra', 'Hesh')?.id).toBe('lw.npc.hesh');

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

  it('keeps the register ids stable', () => {
    expect(IDENTITY_REGISTER.map((entry) => entry.id).sort()).toEqual([
      'lw.npc.amri',
      'lw.npc.bo',
      'lw.npc.bo_shan',
      'lw.npc.dema_cook',
      'lw.npc.dema_roadkeeper',
      'lw.npc.hesh',
      'lw.npc.hesra',
      'lw.npc.leto',
      'lw.npc.mira',
      'lw.npc.miri',
      'lw.npc.sen_tea',
      'lw.npc.sena',
      'lw.npc.senn',
      'lw.npc.senn_messenger',
    ]);
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
