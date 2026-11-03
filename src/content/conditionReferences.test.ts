import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE, STORY_ENTRY } from './index';
import type { ContentBundle } from './schemas';
import { validateContent } from './schemas';
import { DAY_PHASES } from '../core/types';
import type { Condition } from '../core/types';

interface ConditionFixture {
  readonly name: string;
  readonly withCondition: (condition: Condition) => { bundle: ContentBundle; owner: string };
}

function withStoryCondition(condition: Condition): { bundle: ContentBundle; owner: string } {
  const node = CONTENT_BUNDLE.story.find(
    (candidate) => candidate.kind === 'choice' && candidate.options.length > 0,
  );
  if (!node || node.kind !== 'choice') throw new Error('Missing a story choice');
  const option = node.options[0];
  if (!option) throw new Error('Missing an option in the story choice');

  return {
    owner: `story node "${node.id}"`,
    bundle: {
      ...CONTENT_BUNDLE,
      story: CONTENT_BUNDLE.story.map((candidate) =>
        candidate.id === node.id && candidate.kind === 'choice'
          ? {
              ...candidate,
              options: candidate.options.map((entry, index) =>
                index === 0 ? { ...entry, requires: condition } : entry,
              ),
            }
          : candidate,
      ),
    },
  };
}

function withMapRouteCondition(condition: Condition): { bundle: ContentBundle; owner: string } {
  const map = CONTENT_BUNDLE.maps.find((candidate) =>
    candidate.npcs.some((npc) => !npc.resident && (npc.routes?.length ?? 0) > 0),
  );
  const npc = map?.npcs.find(
    (candidate) => !candidate.resident && (candidate.routes?.length ?? 0) > 0,
  );
  const route = npc?.routes?.[0];
  if (!map || !npc || !route) throw new Error('Missing a route on an unbound map NPC');

  return {
    owner: `map "${map.id}"`,
    bundle: {
      ...CONTENT_BUNDLE,
      maps: CONTENT_BUNDLE.maps.map((candidate) =>
        candidate.id === map.id
          ? {
              ...candidate,
              npcs: candidate.npcs.map((entry) =>
                entry.id === npc.id
                  ? {
                      ...entry,
                      routes: entry.routes?.map((item, index) =>
                        index === 0 ? { ...item, when: condition } : item,
                      ),
                    }
                  : entry,
              ),
            }
          : candidate,
      ),
    },
  };
}

function withEncounterCondition(condition: Condition): { bundle: ContentBundle; owner: string } {
  const encounter = CONTENT_BUNDLE.encounters.find((candidate) => candidate.variants.length > 0);
  const variant = encounter?.variants[0];
  if (!encounter || !variant) throw new Error('Missing an encounter variant');

  return {
    owner: `encounter "${encounter.id}"`,
    bundle: {
      ...CONTENT_BUNDLE,
      encounters: CONTENT_BUNDLE.encounters.map((candidate) =>
        candidate.id === encounter.id
          ? {
              ...candidate,
              variants: candidate.variants.map((entry, index) =>
                index === 0 ? { ...entry, when: condition } : entry,
              ),
            }
          : candidate,
      ),
    },
  };
}

function withResidentCondition(condition: Condition): { bundle: ContentBundle; owner: string } {
  const resident = CONTENT_BUNDLE.residents.find(
    (candidate) => (candidate.overrides?.length ?? 0) > 0,
  );
  const override = resident?.overrides?.[0];
  if (!resident || !override) throw new Error('Missing a resident override');

  return {
    owner: `resident "${resident.id}"`,
    bundle: {
      ...CONTENT_BUNDLE,
      residents: CONTENT_BUNDLE.residents.map((candidate) =>
        candidate.id === resident.id
          ? {
              ...candidate,
              overrides: candidate.overrides?.map((entry, index) =>
                index === 0 ? { ...entry, when: condition } : entry,
              ),
            }
          : candidate,
      ),
    },
  };
}

function withBackgroundRoleCondition(condition: Condition): {
  bundle: ContentBundle;
  owner: string;
} {
  const role = CONTENT_BUNDLE.backgroundRoles.find((candidate) =>
    DAY_PHASES.some((phase) => candidate.slots[phase]),
  );
  const phase = role && DAY_PHASES.find((candidate) => role.slots[candidate]);
  const slot = role && phase ? role.slots[phase] : undefined;
  if (!role || !phase || !slot) throw new Error('Missing a background role slot');

  return {
    owner: `background role "${role.id}"`,
    bundle: {
      ...CONTENT_BUNDLE,
      backgroundRoles: CONTENT_BUNDLE.backgroundRoles.map((candidate) =>
        candidate.id === role.id
          ? {
              ...candidate,
              slots: {
                ...candidate.slots,
                [phase]: {
                  ...slot,
                  variants: [{ when: condition, activity: slot.activity }],
                },
              },
            }
          : candidate,
      ),
    },
  };
}

const fixtures: readonly ConditionFixture[] = [
  { name: 'story', withCondition: withStoryCondition },
  { name: 'map route', withCondition: withMapRouteCondition },
  { name: 'encounter variant', withCondition: withEncounterCondition },
  { name: 'resident', withCondition: withResidentCondition },
  { name: 'background role', withCondition: withBackgroundRoleCondition },
];

function nested(condition: Condition): Condition {
  return {
    kind: 'all',
    of: [{ kind: 'any', of: [{ kind: 'not', of: condition }] }],
  };
}

describe('condition references', () => {
  for (const fixture of fixtures) {
    it(`rejects unknown character IDs in nested ${fixture.name} conditions`, () => {
      const { bundle, owner } = fixture.withCondition(
        nested({ kind: 'partyHas', characterId: 'missing_character' }),
      );
      const problems = validateContent(bundle);

      expect(problems).toContain(`${owner} checks for unknown character "missing_character"`);
    });

    it(`rejects unknown story node IDs in nested ${fixture.name} conditions`, () => {
      const { bundle, owner } = fixture.withCondition(
        nested({ kind: 'visited', nodeId: 'missing_story_node' }),
      );
      const problems = validateContent(bundle);

      expect(problems).toContain(`${owner} visits unknown story node "missing_story_node"`);
    });

    it(`accepts valid nested ${fixture.name} conditions and element-only party checks`, () => {
      const character = CONTENT_BUNDLE.characters[0];
      if (!character) throw new Error('Missing a character');

      const { bundle } = fixture.withCondition(
        nested({
          kind: 'all',
          of: [
            { kind: 'partyHas', element: 'fire' },
            { kind: 'partyHas', characterId: character.id },
            { kind: 'visited', nodeId: STORY_ENTRY },
          ],
        }),
      );

      expect(validateContent(bundle)).toEqual([]);
    });
  }
});
