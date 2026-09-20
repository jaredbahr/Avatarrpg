import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { JOURNAL_NOTES } from '../../content/journal';
import { conditionSchema } from '../../content/schemas';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { deserialize, serialize, stateFromBlob } from '../../core/save/serialize';
import { travelJournal } from './journal';
import { DISCOVERIES } from '../../content/maps/discoveries';

const start = () => {
  const state = createGame(CONTENT, {
    seed: 'journal',
    party: [{ characterId: 'sura' }],
    startNode: 'riverside_explore',
  });
  return apply(CONTENT, state, { type: 'enterNode', nodeId: 'riverside_explore' }).state;
};

describe('travel journal and riverside routes', () => {
  it('validates authored notes and conditions against the current content', () => {
    expect(new Set(JOURNAL_NOTES.map((note) => note.id)).size).toBe(JOURNAL_NOTES.length);
    for (const note of JOURNAL_NOTES) {
      expect(CONTENT.maps.has(note.mapId)).toBe(true);
      expect(conditionSchema.safeParse(note.when).success).toBe(true);
    }
  });
  it('shows nearby places and leads without spoiling unseen areas', () => {
    const state = start();
    const before = JSON.stringify(state);
    const journal = travelJournal(CONTENT, state);
    expect(journal.places.map((place) => place.id)).toEqual(['ba_dan_village', 'ba_dan_riverside']);
    expect(journal.discoveries).toHaveLength(3);
    expect(journal.discoveries.every((note) => !note.found)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('uses the active story objective, then the matching world objective while roaming', () => {
    const state = start();
    const map = CONTENT.maps.get(state.location.mapId);
    const node = CONTENT.story.get(state.story.nodeId ?? '');
    if (!map || node?.kind !== 'explore') throw new Error('Missing riverside exploration');
    const content = {
      ...CONTENT,
      maps: new Map(CONTENT.maps).set(map.id, {
        ...map,
        objective: 'Follow the river path.',
        objectiveVariants: [
          {
            when: { kind: 'flag' as const, key: 'act1_complete', op: 'set' as const },
            text: 'Bring the quarry news home.',
          },
        ],
      }),
    };
    expect(travelJournal(content, state).objective).toBe(node.objective);
    const roaming = { ...state, story: { ...state.story, nodeId: null } };
    expect(travelJournal(content, roaming).objective).toBe('Follow the river path.');
    expect(
      travelJournal(content, {
        ...roaming,
        flags: { ...roaming.flags, act1_complete: true },
      }).objective,
    ).toBe('Bring the quarry news home.');
  });
  it('walks the riverside/village loop with no story cursor and preserves discoveries after loading', () => {
    const initial = start();
    let state = apply(CONTENT, initial, { type: 'setFlags', flags: { riverside_pet: true } }).state;
    state = apply(CONTENT, state, { type: 'walkTo', pos: { x: 10, y: 20 } }).state;
    expect(state.location).toEqual({ mapId: 'ba_dan_village', pos: { x: 18, y: 14 } });
    expect(state.story.nodeId).toBeNull();
    state = apply(CONTENT, state, { type: 'walkTo', pos: { x: 19, y: 14 } }).state;
    expect(state.location).toEqual({ mapId: 'ba_dan_riverside', pos: { x: 10, y: 19 } });
    expect(state.party).toEqual(initial.party);
    const saved = deserialize(
      serialize(state, {
        label: 'Journal',
        summary: 'By the river',
        savedAt: 1,
        session: { players: [] },
      }),
    );
    if (!saved.ok) throw new Error(saved.error);
    const loaded = stateFromBlob(saved.blob);
    expect(travelJournal(CONTENT, loaded)).toEqual(travelJournal(CONTENT, state));
    expect(
      travelJournal(CONTENT, loaded).discoveries.find((note) => note.id === 'pebble')?.found,
    ).toBe(true);
    expect(
      apply(CONTENT, loaded, { type: 'walkTo', pos: { x: 10, y: 20 } }).state.location.mapId,
    ).toBe('ba_dan_village');
  });
  it('retains known places from story history in migrated saves with empty world memory', () => {
    const state = start();
    const journal = travelJournal(CONTENT, {
      ...state,
      story: { ...state.story, visited: ['forest_explore'] },
    });
    expect(journal.places.find((place) => place.id === 'forest_road')?.status).toBe('Visited');
    expect(journal.places.some((place) => place.id === 'quarry_gate')).toBe(true);
  });
  it('records every roadside inspection after its actual story resolves', () => {
    for (const discovery of DISCOVERIES) {
      let state = apply(CONTENT, start(), {
        type: 'enterNode',
        nodeId: `discover_${discovery.id}`,
      }).state;
      for (let i = 0; i < 8 && state.screen === 'dialogue'; i++)
        state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
      const note = travelJournal(CONTENT, state).discoveries.find(
        (item) => item.id === discovery.id,
      );
      expect(note?.found).toBe(true);
    }
  });
});
