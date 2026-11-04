/** A legally earned forest return save, immediately before approaching a worker. */
import { CONTENT } from '../../src/content';
import { serialize } from '../../src/core/save/serialize';
import { apply } from '../../src/core/state/reducer';
import type { Command } from '../../src/core/types';
import {
  generateQuarryCheckpoints,
  loadQuarryCheckpoint,
  quarryRouteBoundary,
  type QuarryCheckpoint,
  type QuarryCustody,
} from './quarry-checkpoints';

export function returningWorkerCheckpoint(custody: QuarryCustody): QuarryCheckpoint {
  const earned = generateQuarryCheckpoints(custody).afterDriller;
  let state = earned.state;
  const transcript = [...earned.transcript];
  const commands: readonly Command[] = [
    { type: 'walkTo', pos: { x: 0, y: 5 } },
    { type: 'walkTo', pos: { x: 0, y: 4 } },
    { type: 'walkTo', pos: { x: 0, y: 5 } },
    { type: 'walkTo', pos: { x: 3, y: 1 } },
    { type: 'advanceDialogue' },
    { type: 'advanceDialogue' },
    { type: 'advanceDialogue' },
    { type: 'walkTo', pos: { x: 5, y: 4 } },
  ];
  for (const command of commands) {
    const result = apply(CONTENT, state, command);
    if (result.state === state)
      throw new Error(`Returning-worker checkpoint refused ${JSON.stringify(command)}`);
    state = result.state;
    transcript.push(command);
  }
  if (
    state.screen !== 'explore' ||
    state.story.nodeId !== 'forest_return_explore' ||
    state.location.mapId !== 'forest_road' ||
    state.location.pos.x !== 5 ||
    state.location.pos.y !== 4 ||
    state.world.talk ||
    state.battle ||
    state.pendingChoices.length
  )
    throw new Error('Returning-worker checkpoint did not reach the forest return road');
  const json = serialize(state, {
    label: 'Slot 1',
    summary: 'Returning workers on the forest road',
    savedAt: 1_700_000_000_000,
    session: earned.session,
  });
  if (JSON.stringify(loadQuarryCheckpoint(json)) !== JSON.stringify(state))
    throw new Error('Returning-worker checkpoint changed on load');
  return {
    json,
    state,
    session: earned.session,
    projection: quarryRouteBoundary(state),
    transcript,
  };
}
