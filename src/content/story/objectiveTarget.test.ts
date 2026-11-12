import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE } from '../index';
import { RETURNEE_IDS } from '../residents/returnees';
import { createGame } from '../../core/state/createGame';
import { evaluate } from '../../core/story/conditions';
import { visibleNpcs, worldObjective, worldObjectiveTargetId } from '../../core/story/world';
import type { GameState } from '../../core/types';
import { validateContent } from '../schemas';

function at(nodeId: string, mapId: string): GameState {
  const state = createGame(CONTENT, {
    seed: 'objective-target',
    party: [{ characterId: 'wen' }],
    startNode: nodeId,
  });
  return {
    ...state,
    screen: 'explore',
    location: { mapId, pos: { x: 5, y: 5 } },
  };
}

function mapFallback(
  flags: GameState['flags'] = {},
  profiles: GameState['world']['residentProfiles'] = {},
) {
  const state = at('', 'forest_road');
  return {
    ...state,
    flags,
    story: { ...state.story, nodeId: '' },
    world: { ...state.world, residentProfiles: profiles },
  };
}

describe('authored exploration objective targets', () => {
  it('validates each objective target id against exactly one npc or exit', () => {
    expect(validateContent(CONTENT_BUNDLE)).toEqual([]);

    const forest = CONTENT_BUNDLE.maps.find((map) => map.id === 'forest_road')!;
    const unknownExit = validateContent({
      ...CONTENT_BUNDLE,
      maps: CONTENT_BUNDLE.maps.map((map) =>
        map.id === 'forest_road' ? { ...map, objectiveTargetId: 'missing' } : map,
      ),
    });
    expect(unknownExit).toContain(
      'map "forest_road" objective targets unknown npc or exit "missing" on map "forest_road"',
    );

    const unknownStoryExit = validateContent({
      ...CONTENT_BUNDLE,
      story: CONTENT_BUNDLE.story.map((node) =>
        node.id === 'forest_explore' ? { ...node, objectiveTargetId: 'missing' } : node,
      ),
    });
    expect(unknownStoryExit).toContain(
      'story node "forest_explore" targets unknown npc or exit "missing" on map "forest_road"',
    );

    const quarryExit = forest.exits?.find((exit) => exit.toMapId === 'quarry_gate');
    expect(quarryExit).toBeDefined();
    const ambiguousExit = validateContent({
      ...CONTENT_BUNDLE,
      maps: CONTENT_BUNDLE.maps.map((map) =>
        map.id === 'forest_road' ? { ...map, exits: [...(map.exits ?? []), quarryExit!] } : map,
      ),
    });
    expect(ambiguousExit).toContain(
      'map "forest_road" objective target "quarry_gate" is ambiguous on map "forest_road"',
    );
  });

  it('keeps Elder Mira as the opening target and preserves the visited-variant clear', () => {
    const village = at('village_explore', 'ba_dan_village');
    expect(worldObjectiveTargetId(CONTENT, village)).toBe('elder_mira');
    const mira = visibleNpcs(CONTENT, CONTENT.maps.get('ba_dan_village')!, village).find(
      (npc) => npc.id === 'elder_mira',
    );
    expect(mira).toBeDefined();

    const visited = {
      ...village,
      story: { ...village.story, visited: ['mira_intro'] },
    };
    expect(worldObjective(CONTENT, visited)).toContain('Take the east road');
    expect(worldObjectiveTargetId(CONTENT, visited)).toBe('forest_road');
    expect(
      visibleNpcs(CONTENT, CONTENT.maps.get('ba_dan_village')!, visited).some(
        (npc) => npc.id === worldObjectiveTargetId(CONTENT, visited),
      ),
    ).toBe(false);

    const homeProfiles = Object.fromEntries(
      RETURNEE_IDS.map((id) => [id, 'resting']),
    ) as GameState['world']['residentProfiles'];
    const homecoming = {
      ...village,
      world: { ...village.world, residentProfiles: homeProfiles },
    };
    expect(worldObjective(CONTENT, homecoming)).toContain('The workers are home');
    expect(worldObjectiveTargetId(CONTENT, homecoming)).toBeNull();
  });

  it.each(['forest_explore', 'forest_after_explore'] as const)(
    'targets the authored east Quarry Gate route during %s, including while locked',
    (nodeId) => {
      const initial = at(nodeId, 'forest_road');
      const state =
        nodeId === 'forest_after_explore'
          ? { ...initial, story: { ...initial.story, visited: ['after_forest'] } }
          : initial;
      expect(worldObjectiveTargetId(CONTENT, state)).toBe('quarry_gate');
      const map = CONTENT.maps.get('forest_road');
      const exit = map?.exits?.find((candidate) => candidate.toMapId === 'quarry_gate');
      expect(exit).toBeDefined();
      expect(exit?.direction).toBe('east');
      expect(evaluate(state, exit?.requires)).toBe(nodeId === 'forest_after_explore');
    },
  );

  it('uses both authored west-return targets in the Forest Road map fallback', () => {
    const openingFallback = mapFallback();
    const eastExit = CONTENT.maps
      .get('forest_road')
      ?.exits?.find((candidate) => candidate.toMapId === 'quarry_gate');
    expect(worldObjectiveTargetId(CONTENT, openingFallback)).toBe('quarry_gate');
    expect(evaluate(openingFallback, eastExit?.requires)).toBe(false);

    const returning = Object.fromEntries(
      RETURNEE_IDS.map((id) => [id, 'returning']),
    ) as GameState['world']['residentProfiles'];
    const returningFallback = mapFallback({ act1_complete: true }, returning);
    expect(worldObjective(CONTENT, returningFallback)).toContain('workers are returning');
    expect(worldObjectiveTargetId(CONTENT, returningFallback)).toBe('ba_dan_village');

    const rescuedFallback = mapFallback({ act1_complete: true });
    expect(worldObjective(CONTENT, rescuedFallback)).toContain('roadblock is gone');
    expect(worldObjectiveTargetId(CONTENT, rescuedFallback)).toBe('ba_dan_village');
  });
});
