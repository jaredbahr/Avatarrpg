import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { currentSavedIds } from '../../content/savedIds';
import type { GameState } from '../types';
import { SAVED_ID_KINDS, applyIdAliases, resolveAlias, type IdAliases } from './aliases';
import { deserialize, stateFromBlob } from './serialize';

function golden(name: string): GameState {
  const json = readFileSync(new URL(`./fixtures/golden/v5/${name}.json`, import.meta.url), 'utf8');
  const parsed = deserialize(json);
  if (!parsed.ok) throw new Error(parsed.error);
  return stateFromBlob(parsed.blob);
}

/** A save as an older build would have written it, had every id been spelled `was_<id>`. */
const IDS = currentSavedIds(CONTENT);
const RENAME: IdAliases = Object.fromEntries(
  SAVED_ID_KINDS.map((kind) => [
    kind,
    Object.fromEntries(
      IDS[kind].map((id) => {
        if (kind !== 'npcs' && kind !== 'triggers') return [id, `was_${id}`];
        const [mapId, rest] = id.split(/:(.*)/s);
        return [id, `was_${mapId}:was_${rest}`];
      }),
    ),
  ]),
);
const RESTORE: IdAliases = Object.fromEntries(
  Object.entries(RENAME).map(([kind, table]) => [
    kind,
    Object.fromEntries(Object.entries(table).map(([from, to]) => [to, from])),
  ]),
);

/** The mid-boss save with a conversation pin, so every id field is populated. */
function populated(): GameState {
  const state = golden('party-4-driller-mid');
  const map = CONTENT.maps.get('ba_dan_village');
  const npc = map?.npcs[0];
  const anchor = [...CONTENT.anchors.keys()][0];
  if (!npc || !anchor) throw new Error('fixture content moved');
  return {
    ...state,
    world: { ...state.world, talk: { mapId: 'ba_dan_village', npcId: npc.id, anchor } },
  };
}

describe('applyIdAliases', () => {
  it('returns the very same state when there are no aliases', () => {
    const state = populated();
    expect(applyIdAliases(state, {})).toBe(state);
    expect(applyIdAliases(state, { story: {} })).toBe(state);
  });

  it('rewrites every id a save holds, mid-battle included, and back again', () => {
    const state = populated();
    expect(state.battle).not.toBeNull();
    const old = applyIdAliases(state, RENAME);
    const battle = old.battle;
    const leader = old.party[0];
    expect(old.story.nodeId).toBe(`was_${state.story.nodeId}`);
    expect(old.story.visited.every((id) => id.startsWith('was_'))).toBe(true);
    expect(old.location.mapId).toBe(`was_${state.location.mapId}`);
    expect(Object.keys(old.flags).length).toBeGreaterThan(0);
    for (const key of Object.keys(old.flags)) {
      // Run-time flag families (`guidance.tip.*`) are not in the registry by key.
      if (!key.startsWith('guidance.tip.')) expect(key).toMatch(/^was_/);
    }
    expect(Object.keys(old.world.returnPos).every((id) => id.startsWith('was_'))).toBe(true);
    expect(old.world.fired.every((key) => /^was_[^:]+:was_/.test(key))).toBe(true);
    expect(old.world.cleared.every((id) => id.startsWith('was_'))).toBe(true);
    expect(old.world.talk?.mapId).toBe('was_ba_dan_village');
    expect(old.world.talk?.npcId).toMatch(/^was_/);
    expect(old.world.talk?.anchor).toMatch(/^was_/);
    expect(Object.keys(old.world.residentProfiles).every((id) => id.startsWith('was_'))).toBe(true);
    expect(leader?.characterId).toMatch(/^was_/);
    expect(leader?.abilities.every((id) => id.startsWith('was_'))).toBe(true);
    expect(battle?.encounterId).toMatch(/^was_/);
    expect(battle?.mapId).toMatch(/^was_/);
    expect(battle?.units.some((unit) => unit.enemyId?.startsWith('was_'))).toBe(true);
    for (const unit of battle?.units ?? []) {
      expect(Object.keys(unit.cooldowns).every((id) => id.startsWith('was_'))).toBe(true);
      expect(unit.statuses.every((status) => status.id.startsWith('was_'))).toBe(true);
    }
    expect(battle?.props.every((prop) => prop.propId.startsWith('was_'))).toBe(true);

    expect(applyIdAliases(old, RESTORE)).toEqual(state);
  });

  it('is idempotent', () => {
    const old = applyIdAliases(populated(), RENAME);
    const once = applyIdAliases(old, RESTORE);
    expect(applyIdAliases(once, RESTORE)).toEqual(once);
  });

  it('leaves ids it does not know alone', () => {
    const state = populated();
    expect(applyIdAliases(state, { story: { nowhere: 'act1_open' } })).toEqual(state);
  });

  it('keeps the newer value when a retired flag and its replacement are both set', () => {
    const state = { ...populated(), flags: { old_flag: 1, new_flag: 2, other: true } };
    const renamed = applyIdAliases(state, { flags: { old_flag: 'new_flag' } });
    expect(renamed.flags).toEqual({ new_flag: 2, other: true });
  });

  it('follows a chain of renames and folds duplicates', () => {
    const aliases: IdAliases = { story: { a: 'b', b: 'c' } };
    expect(resolveAlias(aliases, 'story', 'a')).toBe('c');
    const state = populated();
    const renamed = applyIdAliases(
      { ...state, story: { ...state.story, nodeId: 'a', visited: ['a', 'b', 'c'] } },
      aliases,
    );
    expect(renamed.story.nodeId).toBe('c');
    expect(renamed.story.visited).toEqual(['c']);
  });

  it('moves a pinned NPC with its renamed map', () => {
    const state = populated();
    const talk = state.world.talk;
    if (!talk) throw new Error('fixture has no pin');
    const renamed = applyIdAliases(
      { ...state, world: { ...state.world, talk: { ...talk, mapId: 'old_village' } } },
      { maps: { old_village: 'ba_dan_village' } },
    );
    expect(renamed.world.talk).toEqual(talk);
  });
});
