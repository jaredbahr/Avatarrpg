import { CONTENT, STORY_ENTRY } from '../src/content';
import { deserialize, serialize, stateFromBlob } from '../src/core/save/serialize';
import { createGame } from '../src/core/state/createGame';
import { apply } from '../src/core/state/reducer';
import { generateQuarryCheckpoints, QUARRY_ROUTES } from '../scripts/e2e/quarry-checkpoints';

let cached: ReturnType<typeof buildEarnedRewardFixture> | undefined;

/** Replay the checked legal campaign up to its earned, unanswered level-3 rewards. */
function buildEarnedRewardFixture() {
  const route = QUARRY_ROUTES.trade;
  const gate = generateQuarryCheckpoints('trade').gate;
  let state = createGame(CONTENT, {
    seed: route.seed,
    party: route.characters.map((characterId) => ({ characterId })),
    startNode: STORY_ENTRY,
  });
  let commandCount = 0;
  for (const command of gate.transcript) {
    const before = state;
    state = apply(CONTENT, state, command).state;
    commandCount++;
    if (state === before) throw new Error(`Reward fixture command ${commandCount} was refused`);
    if (state.story.nodeId === 'ruon_surrender' && state.pendingChoices.length) break;
  }
  if (
    commandCount !== 49 ||
    state.story.nodeId !== 'ruon_surrender' ||
    state.story.lineIndex !== 0 ||
    state.screen !== 'dialogue' ||
    state.battle !== null ||
    state.pendingChoices.length !== 3 ||
    state.pendingChoices.some((choice) => choice.kind !== 'ability') ||
    state.party.length !== 3 ||
    state.party.some((unit) => unit.level !== 3 || unit.xp !== 250) ||
    !state.world.cleared.includes('enc_forest_road') ||
    state.flags.gate_talked_through !== true
  )
    throw new Error('The legally earned reward boundary changed');

  const json = serialize(state, {
    label: 'Earned quarry gate rewards',
    summary: 'Ruon surrenders after the forest victory and gate diplomacy',
    savedAt: 1_700_000_000_000,
    session: gate.session,
  });
  const parsed = deserialize(json);
  if (!parsed.ok) throw new Error(parsed.error);
  const loaded = stateFromBlob(parsed.blob);
  if (JSON.stringify(loaded) !== JSON.stringify(state))
    throw new Error('Earned reward save changed during serialization');
  return { json, state: loaded, session: parsed.blob.session, commandCount };
}

export function earnedRewardFixture() {
  return (cached ??= buildEarnedRewardFixture());
}
