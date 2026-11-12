import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { ENEMIES, ENEMY_BY_ID } from '../../content/enemies';
import { ENCOUNTERS } from '../../content/encounters';
import { RngCursor, seedFromString } from '../rng';
import {
  createBattle,
  createGame,
  encounterRoster,
  xpRoster,
  type PartySlot,
} from '../state/createGame';
import { apply } from '../state/reducer';
import type { ContentIndex, EncounterDef, EncounterPlacement, GameState } from '../types';
import {
  enemiesToDrop,
  enemyHpScale,
  MAX_SCALE,
  MIN_BOSS_AP,
  MIN_SCALE,
  scaleForTable,
  UNDER_STRENGTH_BOSS_AP,
  UNDER_STRENGTH_BOSS_DEFENSE,
  UNDER_STRENGTH_STEP,
} from './difficulty';

const TABLE_SIZES = [1, 2, 3, 4, 5, 6] as const;
const UNTOUCHED_STATS = ['maxAp', 'maxMove', 'power', 'defense', 'speed', 'focus'] as const;
/** A boss below the baseline also loses AP and defense (ADR 0110); nothing else moves. */
const BOSS_UNDER_STRENGTH_STATS = ['maxAp', 'defense'] as const;

function untouchedFor(isBoss: boolean, partySize: number, baseline: number) {
  return isBoss && partySize < baseline
    ? UNTOUCHED_STATS.filter(
        (stat) => !(BOSS_UNDER_STRENGTH_STATS as readonly string[]).includes(stat),
      )
    : UNTOUCHED_STATS;
}

function expectedBossAp(maxAp: number, under: number): number {
  if (under === 0) return maxAp;
  return Math.max(Math.min(maxAp, MIN_BOSS_AP), maxAp - UNDER_STRENGTH_BOSS_AP * under);
}
const PARTY_CHARACTERS = ['kaya', 'nilak', 'bo', 'nima', 'riko', 'sura'] as const;
const PROPERTY_CASES = 160;

function xpTotal(placements: readonly EncounterPlacement[]): number {
  return placements.reduce((total, placement) => {
    const enemy = ENEMY_BY_ID.get(placement.enemyId);
    if (!enemy) throw new Error(`Unknown enemy ${placement.enemyId} in XP roster`);
    return total + enemy.xp;
  }, 0);
}

function expectedAuthoredXp(
  encounter: EncounterDef,
  flags: Readonly<Record<string, boolean>>,
): number {
  const eligibleConditional = encounter.conditionalEnemies
    .filter((group) => Boolean(flags[group.flag]) === group.whenSet)
    .flatMap((group) => group.placements);
  return xpTotal([...encounter.enemies, ...eligibleConditional]);
}

function resolveVictory(
  content: ContentIndex,
  encounter: EncounterDef,
  partySize: number,
  flags: Readonly<Record<string, boolean>> = {},
) {
  const party: readonly PartySlot[] = PARTY_CHARACTERS.slice(0, partySize).map((characterId) => ({
    characterId,
  }));
  const state = createGame(content, {
    seed: `difficulty-xp:${encounter.id}:${partySize}:${JSON.stringify(flags)}`,
    party,
    startNode: 'village_explore',
    flags,
  });
  const rng = new RngCursor(state.rng);
  const firstVariantId = encounter.variants[0]?.id;
  const battle = createBattle(
    content,
    state,
    encounter.id,
    rng,
    firstVariantId ? { variantId: firstVariantId } : {},
  );
  const resolvedState: GameState = {
    ...state,
    screen: 'combat',
    rng: rng.state,
    battle: { ...battle, phase: 'victory' },
  };
  return { battle, result: apply(content, resolvedState, { type: 'resolveBattle' }) };
}

function randomUnitStats(rng: RngCursor) {
  return {
    maxHp: rng.int(1, 5000),
    maxAp: rng.int(1, 8),
    maxMove: rng.int(1, 12),
    power: rng.int(1, 30),
    defense: rng.int(0, 30),
    speed: rng.int(1, 30),
    focus: rng.int(1, 40),
  };
}

describe('difficulty scaling across authored content', () => {
  it('keeps enemy HP scale monotonic and follows the documented baseline rules', () => {
    expect(ENEMIES.length).toBeGreaterThan(0);
    expect(ENCOUNTERS.length).toBeGreaterThan(0);
    expect(ENEMIES.some((enemy) => enemy.ai === 'boss')).toBe(true);
    let uncappedBossCases = 0;

    for (const enemy of ENEMIES) {
      for (const encounter of ENCOUNTERS) {
        const baseline = encounter.baselinePartySize;
        expect(TABLE_SIZES).toContain(baseline);
        const scales = TABLE_SIZES.map((partySize) =>
          enemyHpScale({ baselinePartySize: baseline, partySize, isBoss: enemy.ai === 'boss' }),
        );

        for (let index = 1; index < scales.length; index += 1) {
          expect(scales[index]).toBeGreaterThanOrEqual(scales[index - 1]!);
        }
        expect(scales[baseline - 1]).toBe(1);

        for (const partySize of TABLE_SIZES) {
          const scale = scales[partySize - 1]!;
          if (partySize < baseline) {
            expect(scale).toBeGreaterThan(0);
            expect(scale).toBeLessThan(1);
            if (enemy.ai !== 'boss') {
              expect(scale).toBe(
                Math.max(MIN_SCALE, 1 - UNDER_STRENGTH_STEP * (baseline - partySize)),
              );
            }
          } else if (enemy.ai !== 'boss') {
            expect(scale).toBe(1);
          }

          if (enemy.ai === 'boss' && partySize > baseline && scale < MAX_SCALE) {
            uncappedBossCases += 1;
            expect(scale).toBeGreaterThan(partySize / baseline);
          }
        }
      }
    }
    expect(uncappedBossCases).toBeGreaterThan(0);
  });

  it('caps boss scaling at MAX_SCALE after the uncapped range', () => {
    expect(enemyHpScale({ baselinePartySize: 1, partySize: 2, isBoss: true })).toBeGreaterThan(2);
    expect(enemyHpScale({ baselinePartySize: 1, partySize: 6, isBoss: true })).toBe(MAX_SCALE);
  });

  it('drops no enemies at or above baseline and retains a roster and any boss below it', () => {
    let trimmedRosterCases = 0;
    let reinforcedRosterCases = 0;
    let retainedBossCases = 0;

    for (const encounter of ENCOUNTERS) {
      const authoredRosters = [
        encounter.enemies,
        ...encounter.variants.map((variant) => variant.enemies ?? encounter.enemies),
      ];

      for (const partySize of TABLE_SIZES) {
        const dropped = enemiesToDrop(encounter.baselinePartySize, partySize);
        expect(dropped).toBeGreaterThanOrEqual(0);
        if (partySize >= encounter.baselinePartySize) expect(dropped).toBe(0);

        for (let index = 0; index < authoredRosters.length; index += 1) {
          const authored = authoredRosters[index]!;
          const variant = index === 0 ? null : encounter.variants[index - 1]!;
          const flags: Record<string, boolean> = {};
          const spawned = encounterRoster(encounter, flags, partySize, variant).enemies;
          const friendlyCount = partySize + encounter.allies.length;
          const expectedKept = authored.slice(
            0,
            Math.max(
              1,
              authored.length - enemiesToDrop(encounter.baselinePartySize, friendlyCount),
            ),
          );

          const expectedConditional = encounter.conditionalEnemies
            .filter((group) => Boolean(flags[group.flag]) === group.whenSet)
            .flatMap((group) => group.placements);
          const expectedReinforcements = encounter.reinforcements.slice(
            0,
            Math.max(0, friendlyCount - encounter.baselinePartySize),
          );
          const expectedRoster = [
            ...expectedKept,
            ...expectedConditional,
            ...expectedReinforcements,
          ];

          if (friendlyCount < encounter.baselinePartySize) {
            expect(expectedKept.length).toBeLessThan(authored.length);
            expect(spawned.length).toBeLessThan(authored.length + expectedConditional.length);
            trimmedRosterCases += 1;
          }
          if (friendlyCount > encounter.baselinePartySize) {
            expect(spawned.length).toBeGreaterThan(
              expectedKept.length + expectedConditional.length,
            );
            reinforcedRosterCases += 1;
          }

          expect(spawned).toEqual(expectedRoster);
          expect(spawned.length).toBeGreaterThan(0);

          const bossPlacements = authored.filter(
            (placement) => ENEMY_BY_ID.get(placement.enemyId)?.ai === 'boss',
          );
          if (bossPlacements.length > 0) retainedBossCases += 1;
          for (const boss of bossPlacements) {
            expect(spawned).toContainEqual(boss);
          }
        }
      }
    }
    expect(trimmedRosterCases).toBeGreaterThan(0);
    expect(reinforcedRosterCases).toBeGreaterThan(0);
    expect(retainedBossCases).toBeGreaterThan(0);
  });

  it('at Story, scales max HP, and a boss below the baseline its AP and defense, and nothing else', () => {
    // Only HP is scaled; zero defense is a valid authored value (the Slinger).
    expect(ENEMY_BY_ID.get('bandit_slinger')?.stats.defense).toBe(0);

    for (const enemy of ENEMIES) {
      for (const encounter of ENCOUNTERS) {
        for (const partySize of TABLE_SIZES) {
          const scaled = scaleForTable(enemy.stats, {
            baselinePartySize: encounter.baselinePartySize,
            partySize,
            isBoss: enemy.ai === 'boss',
          });

          expect(Number.isInteger(scaled.maxHp)).toBe(true);
          expect(scaled.maxHp).toBeGreaterThan(0);
          const isBoss = enemy.ai === 'boss';
          const baseline = encounter.baselinePartySize;
          for (const stat of untouchedFor(isBoss, partySize, baseline)) {
            expect(scaled[stat]).toBe(enemy.stats[stat]);
          }
          for (const stat of UNTOUCHED_STATS) {
            expect(Number.isInteger(scaled[stat])).toBe(true);
            expect(scaled[stat]).toBeGreaterThanOrEqual(stat === 'defense' ? 0 : 1);
          }
          if (isBoss) {
            const under = Math.max(0, baseline - partySize);
            expect(scaled.maxAp).toBe(expectedBossAp(enemy.stats.maxAp, under));
            expect(scaled.defense).toBe(
              Math.max(0, enemy.stats.defense - UNDER_STRENGTH_BOSS_DEFENSE * under),
            );
          }
        }
      }
    }
  });

  it('preserves HP invariants for bounded seeded valid stat and table samples', () => {
    const baselines = [...new Set(ENCOUNTERS.map((encounter) => encounter.baselinePartySize))];
    expect(baselines.length).toBeGreaterThan(0);
    const rng = new RngCursor(seedFromString('difficulty-scale-valid-stats-v1'));

    for (let caseIndex = 0; caseIndex < PROPERTY_CASES; caseIndex += 1) {
      const stats = randomUnitStats(rng);
      const before = { ...stats };
      const baseline = baselines[rng.int(0, baselines.length - 1)]!;
      const partySize = rng.int(1, 6);
      const isBoss = rng.chance(0.5);
      const context = { baselinePartySize: baseline, partySize, isBoss };
      const scale = enemyHpScale(context);
      const scaled = scaleForTable(stats, context);
      const failureContext = JSON.stringify({ caseIndex, stats, context, scale });

      expect(Number.isInteger(scaled.maxHp), failureContext).toBe(true);
      expect(scaled.maxHp, failureContext).toBeGreaterThan(0);
      expect(scaled.maxHp, failureContext).toBe(Math.max(1, Math.round(stats.maxHp * scale)));
      for (const stat of untouchedFor(isBoss, partySize, baseline)) {
        expect(scaled[stat], `${failureContext}: ${stat}`).toBe(stats[stat]);
      }
      if (isBoss && partySize < baseline) {
        const under = baseline - partySize;
        expect(scaled.maxAp, failureContext).toBe(expectedBossAp(stats.maxAp, under));
        expect(scaled.maxAp, failureContext).toBeLessThanOrEqual(stats.maxAp);
        expect(scaled.maxAp, failureContext).toBeGreaterThanOrEqual(
          Math.min(stats.maxAp, MIN_BOSS_AP),
        );
        expect(scaled.defense, failureContext).toBeLessThanOrEqual(stats.defense);
        expect(scaled.defense, failureContext).toBeGreaterThanOrEqual(0);
      }
      expect(stats, `${failureContext}: input mutated`).toEqual(before);
      if (partySize === baseline) expect(scaled.maxHp, failureContext).toBe(stats.maxHp);
    }
  });

  it('awards authored per-member XP on real victory resolution at every table size', () => {
    for (const encounter of ENCOUNTERS) {
      const flags = {};
      const expectedTotal = expectedAuthoredXp(encounter, flags);
      expect(xpTotal(xpRoster(encounter, flags))).toBe(expectedTotal);
      const expectedPerMember = Math.max(
        1,
        Math.round(expectedTotal / encounter.baselinePartySize),
      );
      let smallTableEnemyIds: readonly (string | null)[] = [];
      let largeTableEnemyIds: readonly (string | null)[] = [];
      let smallTableXp = 0;
      let largeTableXp = 0;

      for (const partySize of TABLE_SIZES) {
        const { battle, result } = resolveVictory(CONTENT, encounter, partySize, flags);
        const faced = battle.units.filter((unit) => unit.faction === 'enemy');
        const facedIds = faced.map((unit) => unit.enemyId);
        const facedXp = faced.reduce((total, unit) => {
          if (!unit.enemyId) throw new Error(`Enemy unit ${unit.id} has no enemy id`);
          const enemy = ENEMY_BY_ID.get(unit.enemyId);
          if (!enemy) throw new Error(`Unknown faced enemy ${unit.enemyId}`);
          return total + enemy.xp;
        }, 0);
        const gains: { unitId: string; amount: number }[] = [];
        for (const event of result.events) {
          if (event.type === 'xpGained') gains.push({ unitId: event.unitId, amount: event.amount });
        }

        expect(faced.length).toBeGreaterThan(0);
        expect(gains.map((gain) => gain.unitId).sort()).toEqual(
          result.state.party.map((member) => member.id).sort(),
        );
        expect(gains.map((gain) => gain.amount)).toEqual(
          Array.from({ length: partySize }, () => expectedPerMember),
        );

        if (partySize === 1) {
          smallTableEnemyIds = facedIds;
          smallTableXp = facedXp;
        }
        if (partySize === 6) {
          largeTableEnemyIds = facedIds;
          largeTableXp = facedXp;
        }
      }

      expect(smallTableEnemyIds).not.toEqual(largeTableEnemyIds);
      expect(smallTableXp).not.toBe(largeTableXp);
    }
  });

  it('includes eligible flag-gated authored XP in a focused victory fixture', () => {
    const baseEncounter = CONTENT.encounters.get('enc_quarry_gate');
    if (!baseEncounter) throw new Error('Missing encounter enc_quarry_gate');
    const bonusPlacement = baseEncounter.reinforcements[0];
    if (!bonusPlacement)
      throw new Error('enc_quarry_gate needs an authored placement for the flag fixture');
    const encounter: EncounterDef = {
      ...baseEncounter,
      conditionalEnemies: [
        { flag: 'test_conditional_xp', whenSet: true, placements: [bonusPlacement] },
      ],
    };
    const content: ContentIndex = {
      ...CONTENT,
      encounters: new Map(CONTENT.encounters).set(encounter.id, encounter),
    };
    const withoutFlag = {};
    const withFlag = { test_conditional_xp: true };
    const withoutXp = expectedAuthoredXp(encounter, withoutFlag);
    const withXp = expectedAuthoredXp(encounter, withFlag);

    expect(xpTotal(xpRoster(encounter, withFlag))).toBe(withXp);
    expect(withXp).toBeGreaterThan(withoutXp);

    for (const partySize of TABLE_SIZES) {
      const without = resolveVictory(content, encounter, partySize, withoutFlag);
      const withConditional = resolveVictory(content, encounter, partySize, withFlag);
      const withoutEnemies = without.battle.units.filter((unit) => unit.faction === 'enemy');
      const withEnemies = withConditional.battle.units.filter((unit) => unit.faction === 'enemy');
      const withoutBonusCount = withoutEnemies.filter(
        (unit) => unit.enemyId === bonusPlacement.enemyId,
      ).length;
      const withBonusCount = withEnemies.filter(
        (unit) => unit.enemyId === bonusPlacement.enemyId,
      ).length;

      expect(withEnemies.length).toBe(withoutEnemies.length + 1);
      expect(withBonusCount).toBe(withoutBonusCount + 1);

      const expectedPerMember = Math.max(1, Math.round(withXp / encounter.baselinePartySize));
      const amounts = withConditional.result.events.flatMap((event) =>
        event.type === 'xpGained' ? [event.amount] : [],
      );
      expect(amounts).toEqual(Array.from({ length: partySize }, () => expectedPerMember));
    }
  });
});
