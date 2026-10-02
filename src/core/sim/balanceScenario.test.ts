import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import {
  applyScenario,
  balanceScenarioSchema,
  unsupportedKnobs,
} from '../../../scripts/balance/scenario';
import { countPropEvents } from '../../../scripts/balance/report';
import type { GameEvent } from '../types';
import { runBalanceReport } from './balance';

describe('balance scenario tooling', () => {
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
