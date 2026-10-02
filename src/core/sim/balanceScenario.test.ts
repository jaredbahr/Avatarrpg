import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import {
  applyScenario,
  balanceScenarioSchema,
  readScenario,
  unsupportedKnobs,
} from '../../../scripts/balance/scenario';
import { countPropEvents, runScenarioReport } from '../../../scripts/balance/report';
import type { GameEvent } from '../types';
import { runBalanceReport } from './balance';

describe('balance scenario tooling', () => {
  it('loads and applies every early encounter proposal without changing shipped content', () => {
    const scenarioDirectory = fileURLToPath(
      new URL('../../../scripts/balance/scenarios/early/', import.meta.url),
    );
    const files = readdirSync(scenarioDirectory)
      .filter((file) => file.endsWith('.json'))
      .sort();
    expect(files).toEqual([
      'cutting-extra-blade.json',
      'cutting-hp-20.json',
      'cutting-hp-40.json',
      'cutting-power-plus-1.json',
      'forest-road-extra-thug.json',
      'forest-road-hp-20.json',
      'forest-road-hp-40.json',
      'forest-road-power-plus-1.json',
      'quarry-gate-extra-thug.json',
      'quarry-gate-hp-20.json',
      'quarry-gate-hp-40.json',
      'quarry-gate-power-plus-1.json',
    ]);

    const authoredEnemies = JSON.stringify([...CONTENT.enemies]);
    const authoredEncounters = JSON.stringify([...CONTENT.encounters]);
    for (const file of files) {
      const scenario = readScenario(join(scenarioDirectory, file));
      const overlaid = applyScenario(CONTENT, scenario);

      for (const [encounterId, changes] of Object.entries(scenario.encounters ?? {})) {
        const authoredEncounter = CONTENT.encounters.get(encounterId);
        const overlaidEncounter = overlaid.encounters.get(encounterId);
        expect(authoredEncounter, `${file}: authored encounter ${encounterId}`).toBeDefined();
        expect(overlaidEncounter, `${file}: overlaid encounter ${encounterId}`).toBeDefined();
        if (!authoredEncounter || !overlaidEncounter) continue;

        const selectedRoster = changes.enemies ?? authoredEncounter.enemies;
        const expectedRoster = [...selectedRoster, ...(changes.addEnemies ?? [])].map(
          (placement) => ({
            ...placement,
            enemyId: changes.enemyStats?.[placement.enemyId]
              ? `__scenario__${encounterId}__${placement.enemyId}`
              : placement.enemyId,
            pos: { ...placement.pos },
          }),
        );
        expect(overlaidEncounter.enemies).toHaveLength(
          selectedRoster.length + (changes.addEnemies?.length ?? 0),
        );
        expect(overlaidEncounter.enemies).toEqual(expectedRoster);
        expect(overlaidEncounter.expectedLevel).toBe(
          changes.expectedLevel ?? authoredEncounter.expectedLevel,
        );
        for (const [enemyId, statOverrides] of Object.entries(changes.enemyStats ?? {})) {
          const authoredEnemy = CONTENT.enemies.get(enemyId);
          expect(authoredEnemy, `${file}: authored enemy ${enemyId}`).toBeDefined();
          if (!authoredEnemy) continue;
          const scenarioEnemyId = `__scenario__${encounterId}__${enemyId}`;
          expect(overlaid.enemies.get(scenarioEnemyId)?.stats).toEqual({
            ...authoredEnemy.stats,
            ...statOverrides,
          });
          expect(overlaid.enemies.get(enemyId)?.stats).toEqual(authoredEnemy.stats);
        }

        const allPlacements = [
          ...overlaidEncounter.enemies,
          ...overlaidEncounter.reinforcements,
          ...overlaidEncounter.conditionalEnemies.flatMap((group) => group.placements),
          ...overlaidEncounter.variants.flatMap((variant) => variant.enemies ?? []),
        ];
        for (const placement of allPlacements) {
          expect(overlaid.enemies.has(placement.enemyId), `${file}: ${placement.enemyId}`).toBe(
            true,
          );
        }
      }
    }
    expect(JSON.stringify([...CONTENT.enemies])).toBe(authoredEnemies);
    expect(JSON.stringify([...CONTENT.encounters])).toBe(authoredEncounters);
  });

  it('rejects a bad key with a readable path', () => {
    const parsed = balanceScenarioSchema.safeParse({ props: { hay_bale: { fuels: 3 } } });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path.join('.')).toBe('props.hay_bale');
    expect(parsed.error.issues[0]?.message).toContain('Unrecognized key');
  });

  it('overlays copies without mutating shipped content', () => {
    const originalProp = CONTENT.props.get('hay_bale');
    const originalMap = CONTENT.maps.get('ambush_road');
    expect(originalProp).toBeDefined();
    expect(originalMap).toBeDefined();

    const overlaid = applyScenario(CONTENT, {
      props: { hay_bale: { fuel: 3 } },
      placements: {
        ambush_road: { add: [{ propId: 'hay_bale', pos: { x: 8, y: 4 } }] },
      },
    });

    expect(overlaid).not.toBe(CONTENT);
    expect(overlaid.props.get('hay_bale')).not.toBe(originalProp);
    expect(overlaid.props.get('hay_bale')?.fuel).toBe(3);
    expect(originalProp?.fuel).toBe(2);
    expect(overlaid.maps.get('ambush_road')).not.toBe(originalMap);
    expect(overlaid.maps.get('ambush_road')?.props).toHaveLength(1);
    expect(originalMap?.props).toEqual([]);
  });

  it('scopes encounter roster, level, and enemy-stat overlays to scenario copies', () => {
    const originalEncounter = CONTENT.encounters.get('enc_forest_road');
    const originalEnemy = CONTENT.enemies.get('bandit_thug');
    const originalBruiser = CONTENT.enemies.get('bandit_bruiser');
    expect(originalEncounter).toBeDefined();
    expect(originalEnemy).toBeDefined();
    if (!originalEncounter || !originalEnemy || !originalBruiser) return;

    const overlaid = applyScenario(CONTENT, {
      encounters: {
        enc_forest_road: {
          expectedLevel: 2,
          enemyStats: {
            bandit_thug: { maxHp: originalEnemy.stats.maxHp + 4 },
            bandit_bruiser: { maxHp: originalBruiser.stats.maxHp + 4 },
          },
          addEnemies: [{ enemyId: 'bandit_thug', pos: { x: 16, y: 2 } }],
        },
      },
    });

    const encounter = overlaid.encounters.get('enc_forest_road');
    expect(encounter).toBeDefined();
    if (!encounter) return;
    expect(encounter.expectedLevel).toBe(2);
    expect(encounter.enemies).toHaveLength(originalEncounter.enemies.length + 1);
    const scopedEnemyId = encounter.enemies[0]?.enemyId;
    expect(scopedEnemyId).not.toBe('bandit_thug');
    expect(overlaid.enemies.get(scopedEnemyId ?? '')?.stats.maxHp).toBe(
      originalEnemy.stats.maxHp + 4,
    );
    expect(overlaid.enemies.get('bandit_thug')?.stats).toEqual(originalEnemy.stats);
    expect(overlaid.enemies.get('bandit_bruiser')?.stats).toEqual(originalBruiser.stats);
    expect(CONTENT.enemies.get('bandit_thug')?.stats).toEqual(originalEnemy.stats);
    expect(CONTENT.encounters.get('enc_forest_road')).toBe(originalEncounter);
    expect(encounter.variants[2]?.enemies?.[0]?.enemyId).not.toBe('bandit_bruiser');
    expect(
      overlaid.enemies.get(encounter.variants[2]?.enemies?.[0]?.enemyId ?? '')?.stats.maxHp,
    ).toBe(originalBruiser.stats.maxHp + 4);
    expect(encounter.reinforcements[0]?.enemyId).toBe(scopedEnemyId);
  });

  it('rejects invalid levels, unknown encounter references, and out-of-map roster placements', () => {
    expect(
      balanceScenarioSchema.safeParse({ encounters: { enc_forest_road: { expectedLevel: 11 } } })
        .success,
    ).toBe(false);
    expect(
      balanceScenarioSchema.safeParse({
        encounters: { enc_forest_road: { enemyStats: { bandit_thug: { maxHp: 0 } } } },
      }).success,
    ).toBe(false);
    expect(() => applyScenario(CONTENT, { encounters: { missing: { expectedLevel: 2 } } })).toThrow(
      'unknown encounter',
    );
    expect(() =>
      applyScenario(CONTENT, {
        encounters: {
          enc_forest_road: {
            enemies: [{ enemyId: 'bandit_thug', pos: { x: 999, y: 0 } }],
          },
        },
      }),
    ).toThrow('outside the map');
    expect(() =>
      applyScenario(CONTENT, {
        encounters: {
          enc_forest_road: {
            enemies: [{ enemyId: 'unknown_enemy', pos: { x: 0, y: 0 } }],
          },
        },
      }),
    ).toThrow('unknown enemy');
  });

  it('rejects stats for an enemy that the selected encounter cannot spawn', () => {
    expect(() =>
      applyScenario(CONTENT, {
        encounters: {
          enc_forest_road: { enemyStats: { grumbler: { maxHp: 99 } } },
        },
      }),
    ).toThrow('not used by encounter');
  });

  it('can replace an encounter roster without editing the authored roster', () => {
    const original = CONTENT.encounters.get('enc_forest_road');
    expect(original).toBeDefined();
    if (!original) return;
    const overlaid = applyScenario(CONTENT, {
      encounters: {
        enc_forest_road: {
          enemies: [{ enemyId: 'bandit_slinger', pos: { x: 16, y: 2 } }],
        },
      },
    });
    expect(overlaid.encounters.get('enc_forest_road')?.enemies).toEqual([
      { enemyId: 'bandit_slinger', pos: { x: 16, y: 2 } },
    ]);
    expect(CONTENT.encounters.get('enc_forest_road')).toBe(original);
    expect(original.enemies).toHaveLength(3);
  });

  it('adds lifecycle and per-side fire counters from a deterministic event log', () => {
    const events: GameEvent[] = [
      { type: 'propDamaged', propId: 'prop6', name: 'Hay Bale', amount: 2, pos: { x: 1, y: 1 } },
      {
        type: 'propIgnited',
        propId: 'prop6',
        pos: { x: 1, y: 1 },
        label: 'The Hay Bale catches fire!',
      },
      { type: 'damaged', unitId: 'p0', amount: 3, crit: false, damageType: 'fire', sourceId: null },
      { type: 'damaged', unitId: 'e2', amount: 4, crit: false, damageType: 'fire', sourceId: null },
      {
        type: 'propDoused',
        propId: 'prop6',
        pos: { x: 1, y: 1 },
        label: 'The Hay Bale is put out.',
      },
      {
        type: 'propDestroyed',
        propId: 'prop6',
        pos: { x: 1, y: 1 },
        label: 'The Hay Bale burns away.',
      },
    ];
    const counted = countPropEvents(events, new Map([['Hay Bale', 'hay_bale']]));

    expect(counted.props.hay_bale).toEqual({ ignited: 1, burnedAway: 1, doused: 1 });
    expect(counted.fire).toEqual({ party: 3, enemy: 4 });
  });

  it('leaves baseline output unchanged for an empty scenario', () => {
    const overlaid = applyScenario(CONTENT, {});
    expect(overlaid.props).not.toBe(CONTENT.props);
    expect([...overlaid.props]).toEqual([...CONTENT.props]);
    expect([...overlaid.maps]).toEqual([...CONTENT.maps]);

    const encounter = CONTENT.encounters.get('enc_forest_road');
    expect(encounter).toBeDefined();
    if (!encounter) return;
    const onlyForest = { ...CONTENT, encounters: new Map([[encounter.id, encounter]]) };
    const overlaidForest = { ...overlaid, encounters: onlyForest.encounters };
    expect(runBalanceReport(overlaidForest, { trials: 2 })).toEqual(
      runBalanceReport(onlyForest, { trials: 2 }),
    );
  });

  it('reports win rate, remaining HP fraction, rounds, and average deaths per scenario row', () => {
    const encounter = CONTENT.encounters.get('enc_forest_road');
    expect(encounter).toBeDefined();
    if (!encounter) return;
    const onlyForest = { ...CONTENT, encounters: new Map([[encounter.id, encounter]]) };
    const report = runScenarioReport(onlyForest, [1], 1);
    const row = report.rows[0];
    expect(row).toMatchObject({
      encounterId: encounter.id,
      partySize: 1,
      winRate: expect.any(Number),
      meanRounds: expect.any(Number),
      meanPartyHpRemaining: expect.any(Number),
      meanPartyDeaths: expect.any(Number),
    });
    expect(row?.meanPartyHpRemaining).toBeGreaterThanOrEqual(0);
    expect(row?.meanPartyHpRemaining).toBeLessThanOrEqual(1);
    expect(row?.meanPartyDeaths).toBeGreaterThanOrEqual(0);
  });
  it('reports an unapplied rules knob whenever it is named, true or false', () => {
    const knobs = (scenario: Parameters<typeof unsupportedKnobs>[0]) =>
      unsupportedKnobs(scenario).map((entry) => entry.knob);
    expect(knobs({ squareFootprints: false })).toEqual(['squareFootprints']);
    expect(knobs({ breakRestoresLiveSurface: false, adjacentCover: true })).toEqual([
      'breakRestoresLiveSurface',
      'adjacentCover',
    ]);
    expect(knobs({})).toEqual([]);
  });
});
