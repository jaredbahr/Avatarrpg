import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE, STORY_ENTRY } from './index';
import { conditionSchema, validateContent } from './schemas';
import type { Condition } from '../core/types';
import { createGame } from '../core/state/createGame';
import { evaluate } from '../core/story/conditions';

describe('flag condition operands', () => {
  it.each([
    ['gte without a value', { kind: 'flag', key: 'audit.score', op: 'gte' }],
    ['gte with a string', { kind: 'flag', key: 'audit.score', op: 'gte', value: '3' }],
    ['gte with a boolean', { kind: 'flag', key: 'audit.score', op: 'gte', value: true }],
    ['lte without a value', { kind: 'flag', key: 'audit.score', op: 'lte' }],
    ['lte with a string', { kind: 'flag', key: 'audit.score', op: 'lte', value: '3' }],
    ['lte with a boolean', { kind: 'flag', key: 'audit.score', op: 'lte', value: true }],
  ])('rejects %s', (_description, condition) => {
    expect(conditionSchema.safeParse(condition).success).toBe(false);
  });

  it('preserves optional eq values, falsey equality values and valueless set/unset', () => {
    for (const condition of [
      { kind: 'flag', key: 'audit.score', op: 'set' },
      { kind: 'flag', key: 'audit.score', op: 'unset' },
      { kind: 'flag', key: 'audit.score', op: 'eq' },
      { kind: 'flag', key: 'audit.enabled', op: 'eq', value: false },
      { kind: 'flag', key: 'audit.score', op: 'eq', value: 0 },
      { kind: 'flag', key: 'audit.label', op: 'eq', value: '' },
      { kind: 'flag', key: 'audit.label', op: 'eq', value: 'ready' },
      { kind: 'flag', key: 'audit.score', op: 'eq', value: 2.5 },
      { kind: 'flag', key: 'audit.enabled', op: 'eq', value: true },
      { kind: 'flag', key: 'audit.score', op: 'gte', value: 0 },
      { kind: 'flag', key: 'audit.score', op: 'gte', value: -1.5 },
      { kind: 'flag', key: 'audit.score', op: 'gte', value: 2.25 },
      { kind: 'flag', key: 'audit.score', op: 'lte', value: 0 },
      { kind: 'flag', key: 'audit.score', op: 'lte', value: -1.5 },
      { kind: 'flag', key: 'audit.score', op: 'lte', value: 2.25 },
    ]) {
      expect(conditionSchema.safeParse(condition).success).toBe(true);
    }
  });

  it('keeps eq without a value as strict comparison with an absent flag', () => {
    const character = CONTENT_BUNDLE.characters[0];
    if (!character) throw new Error('Missing a character');
    const state = createGame(CONTENT, {
      seed: 'flag-condition-eq-absence',
      party: [{ characterId: character.id }],
      startNode: STORY_ENTRY,
    });

    expect(evaluate(state, { kind: 'flag', key: 'audit.score', op: 'eq' })).toBe(true);
    expect(evaluate(state, { kind: 'flag', key: 'audit.score', op: 'eq', value: false })).toBe(
      false,
    );
  });

  it('validates flag operands when conditions are nested', () => {
    const nested: Condition = {
      kind: 'all',
      of: [
        {
          kind: 'any',
          of: [
            { kind: 'flag', key: 'audit.enabled', op: 'eq', value: false },
            { kind: 'flag', key: 'audit.score', op: 'gte', value: -0.5 },
          ],
        },
        { kind: 'not', of: { kind: 'flag', key: 'audit.label', op: 'eq', value: '' } },
      ],
    };

    expect(conditionSchema.safeParse(nested).success).toBe(true);
  });

  it('reports the operand path for malformed conditions in content', () => {
    const map = CONTENT_BUNDLE.maps[0];
    const npc = map?.npcs[0];
    if (!map || !npc) throw new Error('Missing a map NPC to probe');

    const condition = {
      kind: 'all',
      of: [{ kind: 'flag', key: 'audit.score', op: 'gte', value: '3' }],
    } as const;
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      maps: [
        {
          ...map,
          npcs: [{ ...npc, routes: [{ when: condition, node: npc.node }] }, ...map.npcs.slice(1)],
        },
        ...CONTENT_BUNDLE.maps.slice(1),
      ],
    });

    expect(
      problems.some(
        (problem) =>
          problem.includes(`map "${map.id}"`) &&
          problem.includes('npcs.0.routes.0.when.of.0.value') &&
          problem.includes('gte requires a numeric value'),
      ),
    ).toBe(true);
  });
});
