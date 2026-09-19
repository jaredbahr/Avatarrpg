import { expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import { encounterText } from './encounterText';
import { enterStoryNode } from './storyEngine';

it('introduces the roster actually selected by a story battle', () => {
  const encounter = CONTENT.encounters.get('enc_forest_road')!;
  const slingers = encounter.variants.find((entry) => entry.id === 'slingers')!;
  const encounters = new Map(CONTENT.encounters);
  encounters.set(encounter.id, { ...encounter, variants: [slingers] });
  const content = { ...CONTENT, encounters };
  const state = createGame(content, {
    seed: 'forest-variant-guidance',
    party: [{ characterId: 'sura' }, { characterId: 'riko' }],
    startNode: 'act1_open',
  });
  const result = enterStoryNode(content, state, 'battle_forest_road');
  expect(result.state.battle?.variantId).toBe('slingers');
  expect(result.events).toContainEqual({ type: 'message', text: slingers.intro });
  expect(encounterText(encounter, result.state.battle!.variantId).tip).toBe(slingers.tip);
});

it('keeps base guidance for missing overrides or an old unknown variant', () => {
  const encounter = CONTENT.encounters.get('enc_forest_road')!;
  expect(encounterText(encounter, 'thugs').tip).toBe(encounter.tip);
  for (const variant of [null, 'removed-variant']) {
    expect(encounterText(encounter, variant)).toEqual({
      intro: encounter.intro,
      tip: encounter.tip,
    });
  }
});
