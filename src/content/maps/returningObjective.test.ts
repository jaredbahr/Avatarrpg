import { describe, expect, it } from 'vitest';
import { CONTENT, STORY_ENTRY } from '../index';
import { RETURNEE_RECORDS } from '../residents/returnees';
import { serialize } from '../../core/save/serialize';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { visibleNpcs, worldObjective } from '../../core/story/world';
import type { Command, GameState } from '../../core/types';
import { loadQuarryCheckpoint, QUARRY_ROUTES } from '../../../scripts/e2e/quarry-checkpoints';
import { returningWorkerCheckpoint } from '../../../scripts/e2e/returning-worker-checkpoint';

function issue(state: GameState, command: Command): GameState {
  const result = apply(CONTENT, state, command);
  expect(result.state, JSON.stringify(command)).not.toBe(state);
  return result.state;
}

function finishDialogue(state: GameState): GameState {
  for (let guard = 0; state.screen === 'dialogue' && guard < 20; guard++)
    state = issue(state, { type: 'advanceDialogue' });
  expect(state.screen).toBe('explore');
  return state;
}

const forest = CONTENT.maps.get('forest_road');
if (!forest) throw new Error('Missing forest road');

for (const custody of ['trade', 'escort'] as const) {
  describe(`${custody} returning-worker objective`, () => {
    const fixture = returningWorkerCheckpoint(custody);

    it('replays its complete earned checkpoint without changing campaign state', () => {
      const route = QUARRY_ROUTES[custody];
      let state = createGame(CONTENT, {
        seed: route.seed,
        party: route.characters.map((characterId) => ({ characterId })),
        startNode: STORY_ENTRY,
      });
      for (const command of fixture.transcript) state = issue(state, command);
      expect(state).toEqual(fixture.state);
      expect(loadQuarryCheckpoint(fixture.json)).toEqual(state);
      expect(worldObjective(CONTENT, state)).toMatch(/returning.*west to Ba Dan/);
      expect(state.flags.act1_complete).toBe(true);
    });

    it.each(RETURNEE_RECORDS)(
      'keeps the return cue after approaching $name and loading the save',
      (worker) => {
        // Senn has no reachable adjacent approach from the south of the group.
        // Walk to the north verge with a public command before tapping him.
        const before =
          worker.npc === 'senn'
            ? issue(fixture.state, { type: 'walkTo', pos: { x: 5, y: 1 } })
            : fixture.state;
        const npc = visibleNpcs(CONTENT, forest, before).find((npc) => npc.id === worker.npc);
        if (!npc) throw new Error(`Returning worker ${worker.name} is absent`);
        const approached = issue(before, { type: 'walkTo', pos: npc.pos });
        expect(approached.screen).toBe('explore');
        expect.soft(approached.story.nodeId).toBe(before.story.nodeId);
        expect.soft(worldObjective(CONTENT, approached)).toBe(worldObjective(CONTENT, before));
        expect(approached.world.residentProfiles).toEqual(before.world.residentProfiles);
        for (const record of RETURNEE_RECORDS)
          expect(approached.world.residentProfiles[record.id]).toBe('returning');

        const loaded = loadQuarryCheckpoint(
          serialize(approached, {
            label: 'Slot 1',
            summary: `After approaching ${worker.name}`,
            savedAt: 1_700_000_000_000,
            session: fixture.session,
          }),
        );
        expect(loaded).toEqual(approached);
        expect.soft(loaded.story.nodeId).toBe(before.story.nodeId);
        expect.soft(worldObjective(CONTENT, loaded)).toBe(worldObjective(CONTENT, before));
        expect(loaded.world.residentProfiles).toEqual(before.world.residentProfiles);

        const arrival = issue(loaded, { type: 'walkTo', pos: { x: 0, y: 4 } });
        expect(arrival.story.nodeId).toBe('forest_return_arrival');
        expect(arrival.screen).toBe('dialogue');
        expect(arrival.world.residentProfiles).toEqual(before.world.residentProfiles);
        const home = finishDialogue(arrival);
        expect(home.location.mapId).toBe('ba_dan_village');
        expect(home.story.nodeId).toBe('village_return_explore');
        expect(worldObjective(CONTENT, home)).toContain('workers are home');
        for (const record of RETURNEE_RECORDS)
          expect(home.world.residentProfiles[record.id]).toBe('resting');
      },
    );

    it('keeps workers absent and the eastbound objective intact before rescue', () => {
      const route = QUARRY_ROUTES[custody];
      let outbound = createGame(CONTENT, {
        seed: route.seed,
        party: route.characters.map((characterId) => ({ characterId })),
        startNode: STORY_ENTRY,
      });
      for (const command of fixture.transcript) {
        outbound = issue(outbound, command);
        if (outbound.location.mapId === 'forest_road' && outbound.screen === 'explore') break;
      }
      expect(outbound.flags.act1_complete).not.toBe(true);
      expect(
        visibleNpcs(CONTENT, forest, outbound).filter((npc) =>
          RETURNEE_RECORDS.some((record) => record.npc === npc.id),
        ),
      ).toEqual([]);
      const objective = worldObjective(CONTENT, outbound);
      expect(objective).toMatch(/east|quarry/i);
      const dema = issue(outbound, { type: 'walkTo', pos: { x: 3, y: 1 } });
      expect(dema.story.nodeId).toBe('forest_dema');
      const after = finishDialogue(dema);
      expect(after.story.nodeId).toBe('forest_explore');
      expect(worldObjective(CONTENT, after)).toMatch(/east to the quarry/);
      expect(worldObjective(CONTENT, after)).not.toContain('workers are returning');
    });
  });
}
