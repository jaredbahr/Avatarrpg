/**
 * Conditions and nation standing.
 *
 * The test that earns its keep is `a standing of zero is not "unset"`. Every flag
 * reader written before conditions existed tests truthiness, and 0 is falsy, so a
 * neutral nation reads as no nation at all. That bug is invisible in a type
 * checker and plausible in a playthrough, which is the worst combination.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import type { Condition, DayPhase, FlagValue, GameState } from '../types';
import {
  MAX_STANDING,
  MIN_STANDING,
  adjustStanding,
  describe,
  describeStanding,
  evaluate,
  getStanding,
  standingKey,
} from './conditions';

function game(
  characterIds: readonly string[] = ['kaya'],
  flags: Record<string, FlagValue> = {},
): GameState {
  return createGame(CONTENT, {
    seed: 'conditions',
    party: characterIds.map((characterId) => ({ characterId })),
    startNode: 'act1_open',
    flags,
  });
}

/** kaya is fire, nilak is water — see src/content/characters.ts. */
const MIXED = ['kaya', 'nilak'];

suite('flag conditions', () => {
  it('reads set and unset as truthiness, matching every older flag reader', () => {
    const state = game(['kaya'], { spared: true, refused: false });
    expect(evaluate(state, { kind: 'flag', key: 'spared', op: 'set' })).toBe(true);
    expect(evaluate(state, { kind: 'flag', key: 'refused', op: 'set' })).toBe(false);
    expect(evaluate(state, { kind: 'flag', key: 'missing', op: 'unset' })).toBe(true);
    expect(evaluate(state, { kind: 'flag', key: 'spared', op: 'unset' })).toBe(false);
  });

  it('compares equality against every permitted flag type', () => {
    const state = game(['kaya'], { token: 'jade', tally: 3, spared: true });
    expect(evaluate(state, { kind: 'flag', key: 'token', op: 'eq', value: 'jade' })).toBe(true);
    expect(evaluate(state, { kind: 'flag', key: 'token', op: 'eq', value: 'iron' })).toBe(false);
    expect(evaluate(state, { kind: 'flag', key: 'tally', op: 'eq', value: 3 })).toBe(true);
    expect(evaluate(state, { kind: 'flag', key: 'spared', op: 'eq', value: true })).toBe(true);
  });

  it('compares numbers, including zero and negatives', () => {
    const state = game(['kaya'], { tally: 0, debt: -2 });
    expect(evaluate(state, { kind: 'flag', key: 'tally', op: 'gte', value: 0 })).toBe(true);
    expect(evaluate(state, { kind: 'flag', key: 'tally', op: 'lte', value: 0 })).toBe(true);
    expect(evaluate(state, { kind: 'flag', key: 'debt', op: 'lte', value: -1 })).toBe(true);
    expect(evaluate(state, { kind: 'flag', key: 'debt', op: 'gte', value: 0 })).toBe(false);
  });

  it('refuses to compare a non-number rather than coercing it', () => {
    const state = game(['kaya'], { token: 'jade' });
    expect(evaluate(state, { kind: 'flag', key: 'token', op: 'gte', value: 1 })).toBe(false);
    expect(evaluate(state, { kind: 'flag', key: 'missing', op: 'gte', value: 0 })).toBe(false);
  });
});

suite('party conditions', () => {
  it('finds a party member by element', () => {
    const state = game(MIXED);
    expect(evaluate(state, { kind: 'partyHas', element: 'fire' })).toBe(true);
    expect(evaluate(state, { kind: 'partyHas', element: 'air' })).toBe(false);
  });

  it('finds a party member by character', () => {
    const state = game(MIXED);
    expect(evaluate(state, { kind: 'partyHas', characterId: 'kaya' })).toBe(true);
    expect(evaluate(state, { kind: 'partyHas', characterId: 'nilak' })).toBe(true);
    expect(evaluate(state, { kind: 'partyHas', characterId: 'bo' })).toBe(false);
  });

  it('honours a minimum count', () => {
    const state = game(MIXED);
    expect(evaluate(state, { kind: 'partyHas', min: 2 })).toBe(true);
    expect(evaluate(state, { kind: 'partyHas', min: 3 })).toBe(false);
    expect(evaluate(state, { kind: 'partyHas', element: 'fire', min: 2 })).toBe(false);
  });

  it('ignores a fallen member', () => {
    const state = game(MIXED);
    const downed: GameState = {
      ...state,
      party: state.party.map((u) => (u.element === 'fire' ? { ...u, hp: 0 } : u)),
    };
    expect(evaluate(downed, { kind: 'partyHas', element: 'fire' })).toBe(false);
  });

  it('compares party size', () => {
    const state = game(MIXED);
    expect(evaluate(state, { kind: 'partySize', op: 'gte', value: 2 })).toBe(true);
    expect(evaluate(state, { kind: 'partySize', op: 'gte', value: 3 })).toBe(false);
    expect(evaluate(state, { kind: 'partySize', op: 'lte', value: 2 })).toBe(true);
  });
});

suite('resident profile conditions', () => {
  const condition = (profiles: readonly ('missing' | 'returning')[]): Condition => ({
    kind: 'residentProfile',
    residentId: 'lw.npc.bo_shan',
    in: profiles,
  });

  it('reads an absent key as missing', () => {
    expect(evaluate(game(), condition(['missing']))).toBe(true);
    expect(evaluate(game(), condition(['returning']))).toBe(false);
  });

  it('matches the explicitly saved profile', () => {
    const base = game();
    const state: GameState = {
      ...base,
      world: {
        ...base.world,
        residentProfiles: { 'lw.npc.bo_shan': 'returning' },
      },
    };
    expect(evaluate(state, condition(['returning']))).toBe(true);
    expect(evaluate(state, condition(['missing']))).toBe(false);
  });
});

suite('nation standing', () => {
  it('defaults every nation to neutral', () => {
    const state = game();
    expect(getStanding(state.flags, 'fire')).toBe(0);
    expect(getStanding(state.flags, 'earth')).toBe(0);
  });

  it('a standing of zero is not "unset"', () => {
    // The whole reason standing is compared and never tested for truth.
    const flags = adjustStanding({}, { fire: 2 });
    const settled = adjustStanding(flags, { fire: -2 });
    expect(settled[standingKey('fire')]).toBe(0);

    const state: GameState = { ...game(), flags: settled };
    expect(evaluate(state, { kind: 'standing', nation: 'fire', op: 'gte', value: 0 })).toBe(true);
    expect(evaluate(state, { kind: 'standing', nation: 'fire', op: 'lte', value: 0 })).toBe(true);

    // And the trap it avoids: the old truthiness reading calls this absent.
    expect(Boolean(settled[standingKey('fire')])).toBe(false);
  });

  it('accumulates and clamps to the designed band', () => {
    let flags: Readonly<Record<string, FlagValue>> = {};
    for (let i = 0; i < 10; i++) flags = adjustStanding(flags, { water: 2 });
    expect(getStanding(flags, 'water')).toBe(MAX_STANDING);

    for (let i = 0; i < 20; i++) flags = adjustStanding(flags, { water: -2 });
    expect(getStanding(flags, 'water')).toBe(MIN_STANDING);
  });

  it('never mutates the flags it is given', () => {
    const before: Record<string, FlagValue> = { keep: true };
    const after = adjustStanding(before, { earth: 1 });
    expect(before).toEqual({ keep: true });
    expect(after.keep).toBe(true);
    expect(after[standingKey('earth')]).toBe(1);
  });

  it('adjusts several nations at once and skips zero deltas', () => {
    const flags = adjustStanding({}, { fire: 1, water: -1, earth: 0 });
    expect(getStanding(flags, 'fire')).toBe(1);
    expect(getStanding(flags, 'water')).toBe(-1);
    expect(standingKey('earth') in flags).toBe(false);
  });

  it('puts a word to a value', () => {
    expect(describeStanding(-5)).toBe('hostile');
    expect(describeStanding(-2)).toBe('wary');
    expect(describeStanding(0)).toBe('neutral');
    expect(describeStanding(3)).toBe('friendly');
    expect(describeStanding(5)).toBe('trusted');
  });
});

suite('visited', () => {
  it('reads the story trail', () => {
    const state = game();
    expect(evaluate(state, { kind: 'visited', nodeId: 'act1_open' })).toBe(false);

    const walked: GameState = {
      ...state,
      story: { ...state.story, visited: ['act1_open', 'mira_intro'] },
    };
    expect(evaluate(walked, { kind: 'visited', nodeId: 'mira_intro' })).toBe(true);
    expect(evaluate(walked, { kind: 'visited', nodeId: 'road_depart' })).toBe(false);
  });
});

suite('combinators', () => {
  const state = game(MIXED, { spared: true });

  it('requires every branch of all', () => {
    expect(
      evaluate(state, {
        kind: 'all',
        of: [
          { kind: 'partyHas', element: 'fire' },
          { kind: 'flag', key: 'spared', op: 'set' },
        ],
      }),
    ).toBe(true);
    expect(
      evaluate(state, {
        kind: 'all',
        of: [
          { kind: 'partyHas', element: 'fire' },
          { kind: 'partyHas', element: 'air' },
        ],
      }),
    ).toBe(false);
  });

  it('accepts one branch of any', () => {
    expect(
      evaluate(state, {
        kind: 'any',
        of: [
          { kind: 'partyHas', element: 'air' },
          { kind: 'partyHas', element: 'water' },
        ],
      }),
    ).toBe(true);
  });

  it('inverts with not', () => {
    expect(evaluate(state, { kind: 'not', of: { kind: 'partyHas', element: 'air' } })).toBe(true);
    expect(evaluate(state, { kind: 'not', of: { kind: 'partyHas', element: 'fire' } })).toBe(false);
  });

  it('nests', () => {
    expect(
      evaluate(state, {
        kind: 'all',
        of: [
          {
            kind: 'any',
            of: [
              { kind: 'partyHas', element: 'fire' },
              { kind: 'visited', nodeId: 'x' },
            ],
          },
          { kind: 'not', of: { kind: 'flag', key: 'betrayed', op: 'set' } },
        ],
      }),
    ).toBe(true);
  });

  it('treats an absent condition as always true', () => {
    expect(evaluate(state, undefined)).toBe(true);
  });

  it('bails out of an absurdly deep condition instead of hanging', () => {
    let deep: Condition = { kind: 'partyHas', element: 'water' };
    for (let i = 0; i < 40; i++) deep = { kind: 'all', of: [deep] };
    expect(evaluate(state, deep)).toBe(false);
  });
});

suite('describe', () => {
  it('names the bender a locked option needs', () => {
    expect(describe(CONTENT, { kind: 'partyHas', element: 'fire' })).toBe('you have a firebender');
    expect(describe(CONTENT, { kind: 'partyHas', element: 'earth' })).toBe(
      'you have an earthbender',
    );
  });

  it('pluralises a count rather than saying "2 a firebender"', () => {
    expect(describe(CONTENT, { kind: 'partyHas', element: 'water', min: 2 })).toBe(
      'you have 2 waterbenders',
    );
  });

  it('names a required character by their real name', () => {
    const named = describe(CONTENT, { kind: 'partyHas', characterId: 'kaya' });
    expect(named).toContain(CONTENT.characters.get('kaya')?.name ?? 'kaya');
  });

  it('speaks of nations, not of flag keys, for standing', () => {
    expect(describe(CONTENT, { kind: 'standing', nation: 'fire', op: 'gte', value: 2 })).toContain(
      'the Fire Nation',
    );
  });

  it('humanises a raw flag key as a last resort', () => {
    expect(describe(CONTENT, { kind: 'flag', key: 'ruon_spared', op: 'set' })).toBe(
      'you have ruon spared',
    );
  });

  it('joins combinators into a sentence', () => {
    expect(
      describe(CONTENT, {
        kind: 'all',
        of: [
          { kind: 'partyHas', element: 'fire' },
          { kind: 'partySize', op: 'gte', value: 3 },
        ],
      }),
    ).toBe('you have a firebender and there are at least 3 of you');
  });
});

suite('phase condition', () => {
  /** A new game starts at midday (ADR 0047, D4); move the clock for each case. */
  const at = (phase: DayPhase): GameState => {
    const state = game();
    return { ...state, world: { ...state.world, clock: { ...state.world.clock, phase } } };
  };

  it('matches a single phase against the world clock', () => {
    expect(evaluate(at('evening'), { kind: 'phase', in: ['evening'] })).toBe(true);
    expect(evaluate(at('dawn'), { kind: 'phase', in: ['evening'] })).toBe(false);
  });

  it('matches any phase in a multi-phase list', () => {
    const inList: Condition = { kind: 'phase', in: ['dawn', 'evening'] };
    expect(evaluate(at('dawn'), inList)).toBe(true);
    expect(evaluate(at('evening'), inList)).toBe(true);
    expect(evaluate(at('midday'), inList)).toBe(false);
  });

  it('describes a single phase as a time of day', () => {
    expect(describe(CONTENT, { kind: 'phase', in: ['evening'] })).toBe('in the evening');
  });

  it('joins several phases with "or", as the ADR writes them', () => {
    expect(describe(CONTENT, { kind: 'phase', in: ['dawn', 'evening'] })).toBe(
      'at dawn or in the evening',
    );
  });

  it.each([
    ['dawn', 'at dawn'],
    ['morning', 'in the morning'],
    ['midday', 'at midday'],
    ['afternoon', 'in the afternoon'],
    ['evening', 'in the evening'],
    ['night', 'at night'],
  ] as const)('describes %s as "%s"', (phase, phrase) => {
    expect(describe(CONTENT, { kind: 'phase', in: [phase] })).toBe(phrase);
  });
});
