/**
 * The two difficulties (ADR 0110), layered on the table scaling.
 *
 * Story is the authored tuning; Hard is one profile of multipliers and bonuses
 * that applies to every enemy the same way, with no per-encounter rule. These
 * tests hold both halves of that: Story changes nothing, and Hard changes the
 * same stats in the same direction at every table size, without touching the
 * roster, the initiative order or the dice.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { ENEMIES } from '../../content/enemies';
import { ENCOUNTERS } from '../../content/encounters';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import { runCombat, seedFor } from '../sim/runCombat';
import type { Difficulty } from '../types';
import { DIFFICULTIES } from '../types';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_PROFILES,
  MIN_BOSS_AP,
  enemyHpScale,
  scaleForTable,
} from './difficulty';

const TABLE_SIZES = [1, 2, 3, 4, 5, 6] as const;

function battleAt(difficulty: Difficulty, encounterId: string, heroes: readonly string[]) {
  const state = createGame(CONTENT, {
    seed: `difficulty-levels:${encounterId}:${heroes.length}`,
    party: heroes.map((characterId) => ({ characterId, level: 3 })),
    startNode: 'village_explore',
    difficulty,
  });
  const rng = new RngCursor(state.rng);
  const battle = createBattle(CONTENT, state, encounterId, rng);
  return { battle, rng: rng.state };
}

describe('difficulty levels', () => {
  it('defaults to Story, and Story is the authored tuning', () => {
    expect(DEFAULT_DIFFICULTY).toBe('story');
    expect(DIFFICULTIES).toEqual(['story', 'hard']);
    expect(DIFFICULTY_PROFILES.story).toEqual({ hp: 1, bossHp: 1, power: 0, ap: 0 });
    for (const enemy of ENEMIES) {
      const ctx = { baselinePartySize: 3, partySize: 3, isBoss: enemy.ai === 'boss' };
      expect(scaleForTable(enemy.stats, ctx)).toBe(enemy.stats);
      expect(scaleForTable(enemy.stats, { ...ctx, difficulty: 'story' })).toBe(enemy.stats);
    }
  });

  it('makes every enemy tougher at Hard, the same way at every table size', () => {
    const hard = DIFFICULTY_PROFILES.hard;
    expect(hard.hp).toBeGreaterThan(1);
    expect(hard.bossHp).toBeGreaterThanOrEqual(hard.hp);
    expect(hard.power).toBeGreaterThan(0);

    for (const enemy of ENEMIES) {
      const isBoss = enemy.ai === 'boss';
      for (const encounter of ENCOUNTERS) {
        for (const partySize of TABLE_SIZES) {
          const ctx = { baselinePartySize: encounter.baselinePartySize, partySize, isBoss };
          const story = scaleForTable(enemy.stats, { ...ctx, difficulty: 'story' });
          const tough = scaleForTable(enemy.stats, { ...ctx, difficulty: 'hard' });
          const multiplier = isBoss ? hard.bossHp : hard.hp;

          expect(tough.maxHp).toBe(
            Math.max(1, Math.round(enemy.stats.maxHp * enemyHpScale(ctx) * multiplier)),
          );
          expect(tough.maxHp).toBeGreaterThan(story.maxHp);
          expect(tough.power).toBe(story.power + hard.power);
          expect(tough.maxAp).toBe(story.maxAp + hard.ap);
          for (const stat of ['maxMove', 'defense', 'speed', 'focus'] as const) {
            expect(tough[stat]).toBe(story[stat]);
          }
        }
      }
    }
  });

  it('still grows a Hard boss with the table', () => {
    const boss = ENEMIES.find((enemy) => enemy.ai === 'boss');
    if (!boss) throw new Error('No boss in the content');
    const hp = TABLE_SIZES.map(
      (partySize) =>
        scaleForTable(boss.stats, {
          baselinePartySize: 3,
          partySize,
          isBoss: true,
          difficulty: 'hard',
        }).maxHp,
    );
    for (let index = 1; index < hp.length; index += 1) {
      expect(hp[index]).toBeGreaterThanOrEqual(hp[index - 1]!);
    }
  });

  it('changes stat blocks only: the same roster, order and dice at either level', () => {
    for (const encounter of ENCOUNTERS) {
      for (const heroes of [['kaya'], ['kaya', 'sura', 'bo']]) {
        const story = battleAt('story', encounter.id, heroes);
        const tough = battleAt('hard', encounter.id, heroes);
        expect(tough.rng).toBe(story.rng);
        expect(tough.battle.order).toEqual(story.battle.order);
        expect(tough.battle.units.map((u) => [u.id, u.enemyId, u.pos])).toEqual(
          story.battle.units.map((u) => [u.id, u.enemyId, u.pos]),
        );
        for (const unit of tough.battle.units) {
          const before = story.battle.units.find((candidate) => candidate.id === unit.id);
          if (unit.faction === 'enemy') {
            expect(unit.base.maxHp).toBeGreaterThan(before?.base.maxHp ?? Infinity);
            expect(unit.hp).toBe(unit.base.maxHp);
          } else {
            // Heroes and story allies are never scaled by the difficulty.
            expect(unit.base).toEqual(before?.base);
          }
        }
      }
    }
  });

  it('leaves a lone hero a boss it can answer: fewer actions and thinner armour', () => {
    const solo = battleAt('story', 'enc_grumbler', ['kaya']).battle;
    const full = battleAt('story', 'enc_grumbler', ['kaya', 'sura', 'bo']).battle;
    const boss = (units: typeof solo.units) => units.find((unit) => unit.ai === 'boss');
    expect(boss(solo.units)?.base.maxAp).toBe(MIN_BOSS_AP);
    expect(boss(solo.units)?.base.defense).toBeLessThan(boss(full.units)?.base.defense ?? 0);
    expect(boss(full.units)?.base.maxAp).toBeGreaterThan(MIN_BOSS_AP);
  });

  it('is deterministic at Hard: the same seed plays the same fight', () => {
    const options = {
      seed: seedFor('difficulty-levels', 1),
      encounterId: 'enc_grumbler',
      party: [{ characterId: 'kaya' }, { characterId: 'sura' }, { characterId: 'bo' }],
      difficulty: 'hard' as const,
    };
    const first = runCombat(CONTENT, options);
    const second = runCombat(CONTENT, options);
    expect(second.signature).toBe(first.signature);
    expect(second.outcome).toBe(first.outcome);
    const story = runCombat(CONTENT, { ...options, difficulty: 'story' });
    expect(story.signature).not.toBe(first.signature);
  });
});
