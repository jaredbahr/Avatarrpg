/**
 * Encounter roster variants.
 *
 * The load-bearing claim is the threat budget: variants must cost the same in
 * summed enemy XP, because `xpRoster` pays out from the *authored* roster
 * whichever one actually spawned. Get that wrong and one variant quietly becomes
 * the cheap route — the party arrives at the next fight under-levelled and
 * progression.test.ts starts failing for reasons nobody can trace back here.
 *
 * So the rule lives in `validateContent`, not in a test file, and this proves
 * the rule fires.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE } from './index';
import { VARIANT_BUDGET_TOLERANCE, validateContent } from './schemas';
import { RngCursor } from '../core/rng';
import { createBattle, createGame, pickVariant, xpRoster } from '../core/state/createGame';
import type { EncounterDef, GameState } from '../core/types';

function budget(placements: readonly { enemyId: string }[]): number {
  return placements.reduce((sum, p) => sum + (CONTENT.enemies.get(p.enemyId)?.xp ?? 0), 0);
}

function game(seed: string, partySize = 3): GameState {
  const pool = ['bo', 'nilak', 'kaya', 'riko', 'nima', 'sura'].slice(0, partySize);
  return createGame(CONTENT, {
    seed,
    party: pool.map((characterId) => ({ characterId, level: 2, autoChoose: true })),
    startNode: '',
  });
}

describe('the threat budget', () => {
  it('every authored variant costs what the base roster costs', () => {
    for (const encounter of CONTENT_BUNDLE.encounters) {
      const base = budget(encounter.enemies);
      for (const variant of encounter.variants) {
        if (!variant.enemies) continue;
        const drift = Math.abs(budget(variant.enemies) - base) / base;
        expect(
          drift,
          `${encounter.id}/${variant.id}: ${budget(variant.enemies)} XP against a baseline of ${base}`,
        ).toBeLessThanOrEqual(VARIANT_BUDGET_TOLERANCE);
      }
    }
  });

  it('rejects a variant that is quietly the easy route', () => {
    // One lone thug against a 300 XP baseline, paid as though it were the
    // full roster. This is the failure the rule exists to catch.
    const cheated = CONTENT_BUNDLE.encounters.map((e): EncounterDef =>
      e.id === 'enc_forest_road'
        ? {
            ...e,
            variants: [
              ...e.variants,
              { id: 'freebie', weight: 1, enemies: [{ enemyId: 'bandit_thug', pos: { x: 17, y: 5 } }] },
            ],
          }
        : e,
    );

    const problems = validateContent({ ...CONTENT_BUNDLE, encounters: cheated });
    expect(problems.some((p) => p.includes('freebie') && p.includes('XP'))).toBe(true);
  });

  it('rejects a variant that spawns somebody inside a wall', () => {
    const broken = CONTENT_BUNDLE.encounters.map((e): EncounterDef =>
      e.id === 'enc_forest_road'
        ? {
            ...e,
            variants: [
              ...e.variants,
              {
                id: 'in_the_trees',
                weight: 1,
                enemies: [
                  { enemyId: 'bandit_thug', pos: { x: 0, y: 0 } },
                  { enemyId: 'bandit_thug', pos: { x: 17, y: 5 } },
                  { enemyId: 'bandit_slinger', pos: { x: 18, y: 3 } },
                ],
              },
            ],
          }
        : e,
    );

    const problems = validateContent({ ...CONTENT_BUNDLE, encounters: broken });
    expect(problems.some((p) => p.includes('in_the_trees'))).toBe(true);
  });

  it('pays the same XP whichever variant spawns', () => {
    /*
     * This is the property that keeps progression.test.ts honest, and it holds
     * by construction rather than by care: xpRoster never looks at the variant.
     */
    const encounter = CONTENT.encounters.get('enc_forest_road');
    if (!encounter) throw new Error('no forest road');
    const expected = budget(xpRoster(encounter, {}));

    for (const variant of encounter.variants) {
      const state = game('xp', 3);
      const battle = createBattle(CONTENT, state, 'enc_forest_road', new RngCursor(state.rng), {
        variantId: variant.id,
      });
      expect(battle.variantId).toBe(variant.id);
      expect(budget(xpRoster(encounter, state.flags))).toBe(expected);
    }
  });
});

describe('drawing a variant', () => {
  it('is deterministic for a seed', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const first = game(seed);
      const second = game(seed);
      const a = createBattle(CONTENT, first, 'enc_forest_road', new RngCursor(first.rng));
      const b = createBattle(CONTENT, second, 'enc_forest_road', new RngCursor(second.rng));
      expect(a.variantId).toBe(b.variantId);
      expect(a.units.map((u) => u.enemyId)).toEqual(b.units.map((u) => u.enemyId));
    }
  });

  it('draws more than one roster across many seeds', () => {
    const drawn = new Set<string | null>();
    for (let i = 0; i < 40; i++) {
      const state = game(`seed-${i}`);
      drawn.add(createBattle(CONTENT, state, 'enc_forest_road', new RngCursor(state.rng)).variantId);
    }
    expect(drawn.size, 'the same fight spawned identically every time').toBeGreaterThan(1);
  });

  it('leaves an encounter with no variants alone', () => {
    const state = game('none');
    const battle = createBattle(CONTENT, state, 'enc_grumbler', new RngCursor(state.rng));
    expect(battle.variantId).toBeNull();
  });

  it('honours a variant condition', () => {
    const encounter = CONTENT.encounters.get('enc_forest_road');
    if (!encounter) throw new Error('no forest road');

    const gated: EncounterDef = {
      ...encounter,
      variants: [
        { id: 'only_for_benders', weight: 1, when: { kind: 'partyHas', element: 'air' } },
        { id: 'always', weight: 1 },
      ],
    };

    const withoutAir = createGame(CONTENT, {
      seed: 'gate',
      party: [{ characterId: 'bo' }],
      startNode: '',
    });
    for (let i = 0; i < 12; i++) {
      const picked = pickVariant(gated, withoutAir, new RngCursor((withoutAir.rng + i) as never));
      expect(picked?.id).toBe('always');
    }
  });

  it('spends no randomness when there is nothing to choose', () => {
    /*
     * An encounter without variants must not consume the RNG, or adding a
     * variant to one fight would shift the dice for every fight after it and
     * quietly break every existing seed.
     */
    const state = game('rng');
    const cursor = new RngCursor(state.rng);
    const before = cursor.state;
    pickVariant(CONTENT.encounters.get('enc_grumbler') as EncounterDef, state, cursor);
    expect(cursor.state).toBe(before);
  });
});

describe('what the variants are for', () => {
  it('gives the forest road genuinely different fights at the same price', () => {
    const encounter = CONTENT.encounters.get('enc_forest_road');
    if (!encounter) throw new Error('no forest road');

    const rosters = encounter.variants.map((v) =>
      (v.enemies ?? encounter.enemies).map((p) => p.enemyId).sort().join(','),
    );
    expect(new Set(rosters).size, 'two variants spawn the same squad').toBe(rosters.length);

    // And the shapes differ, not just the names: an all-ranged squad and a
    // two-heavies squad are different problems to solve.
    const sizes = encounter.variants.map((v) => (v.enemies ?? encounter.enemies).length);
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });
});
