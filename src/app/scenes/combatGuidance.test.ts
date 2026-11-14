import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { EncounterDef, GameEvent, GameState, PropDef, Unit } from '../../core/types';
import {
  FIRST_FIGHT_GUIDANCE,
  combatTipEvents,
  combatTipFeatures,
  firstFightStage,
  nextFirstFightStage,
  unseenCombatTips,
} from './combatGuidance';

const party = {
  id: 'p0',
  faction: 'party',
  pos: { x: 0, y: 0 },
  size: 1,
  statuses: [],
} as unknown as Unit;
const enemy = {
  id: 'e0',
  faction: 'enemy',
  pos: { x: 2, y: 0 },
  size: 1,
  statuses: [],
} as unknown as Unit;

/** The guided fight declares itself on its encounter (`EncounterDef.guidance`). */
const ENCOUNTERS: ReadonlyMap<string, Pick<EncounterDef, 'guidance'>> = new Map([
  ['enc_forest_road', { guidance: 'firstFight' }],
  ['enc_quarry_gate', {}],
]);

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    screen: 'combat',
    flags: { [FIRST_FIGHT_GUIDANCE.eligible]: true },
    battle: {
      mapId: 'forest_road',
      encounterId: 'enc_forest_road',
      phase: 'active',
      units: [party, enemy],
      grid: { tiles: [{ cover: true, surface: { id: 'oil', duration: 1, spread: 0 } }] },
      props: [{ id: 'barrel', propId: 'barrel' }],
    },
    ...overrides,
  } as unknown as GameState;
}

describe('first fight guidance', () => {
  it('is declared by the shipped Forest Road encounter and no other', () => {
    const guided = [...CONTENT.encounters.values()].filter(
      (encounter) => encounter.guidance === 'firstFight',
    );
    expect(guided.map((encounter) => encounter.id)).toEqual(['enc_forest_road']);
  });

  it('starts only for a flagged new game in the Forest Road fight', () => {
    expect(firstFightStage(state(), ENCOUNTERS)).toBe(0);
    expect(firstFightStage(state({ flags: {} }), ENCOUNTERS)).toBeNull();
    expect(
      firstFightStage(
        state({
          battle: { ...state().battle!, mapId: 'quarry_gate', encounterId: 'enc_quarry_gate' },
        }),
        ENCOUNTERS,
      ),
    ).toBeNull();
    expect(
      firstFightStage(
        state({ battle: { ...state().battle!, encounterId: 'another_forest_fight' } }),
        ENCOUNTERS,
      ),
    ).toBeNull();
    expect(
      firstFightStage(state({ battle: { ...state().battle!, phase: 'victory' } }), ENCOUNTERS),
    ).toBeNull();
    expect(
      firstFightStage(
        state({
          flags: {
            [FIRST_FIGHT_GUIDANCE.eligible]: true,
            [FIRST_FIGHT_GUIDANCE.stage]: 'done',
          },
        }),
        ENCOUNTERS,
      ),
    ).toBeNull();
  });

  it('advances only on accepted move, enemy-targeted ability and actual turn end', () => {
    const before = state();
    expect(
      nextFirstFightStage(0, { type: 'move', unitId: 'p0', path: [{ x: 1, y: 0 }] }, [], before),
    ).toBeNull();
    expect(
      nextFirstFightStage(
        0,
        { type: 'move', unitId: 'p0', path: [{ x: 1, y: 0 }] },
        [{ type: 'unitMoved', unitId: 'p0', path: [{ x: 1, y: 0 }], cost: 1 }],
        before,
      ),
    ).toBe(1);

    const ability = {
      type: 'useAbility',
      unitId: 'p0',
      abilityId: 'fire_blast',
      target: { x: 2, y: 0 },
    } as const;
    const used: GameEvent[] = [
      {
        type: 'abilityUsed',
        unitId: 'p0',
        abilityId: 'fire_blast',
        target: ability.target,
        tiles: [ability.target],
      },
    ];
    expect(nextFirstFightStage(1, ability, [], before)).toBeNull();
    expect(nextFirstFightStage(1, { ...ability, target: { x: 1, y: 0 } }, used, before)).toBeNull();
    expect(nextFirstFightStage(1, ability, used, before)).toBe(2);

    expect(nextFirstFightStage(2, { type: 'endTurn', unitId: 'p0' }, [], before)).toBeNull();
    expect(
      nextFirstFightStage(
        2,
        { type: 'endTurn', unitId: 'p0' },
        [{ type: 'turnEnded', unitId: 'p0' }],
        before,
      ),
    ).toBe(3);
  });
});

describe('later combat tips', () => {
  it('recognizes features and only schedules unseen feature keys', () => {
    const laterFight = state({
      battle: { ...state().battle!, mapId: 'quarry_gate', encounterId: 'enc_quarry_gate' },
    });
    expect(combatTipFeatures(state(), new Map(), ENCOUNTERS)).toEqual([]);
    expect(
      combatTipFeatures(laterFight, new Map([['barrel', { hp: 6 } as PropDef]]), ENCOUNTERS),
    ).toEqual(['cover', 'surface.oil', 'prop']);
    expect(
      combatTipFeatures(laterFight, new Map([['barrel', { hp: 0 } as PropDef]]), ENCOUNTERS),
    ).toEqual(['cover', 'surface.oil']);
    expect(
      combatTipEvents([{ type: 'statusApplied', unitId: 'e0', status: 'burning', duration: 1 }]),
    ).toEqual(['status']);
    expect(unseenCombatTips(['cover', 'surface.oil'], { 'guidance.tip.cover': true })).toEqual([
      'surface.oil',
    ]);
  });
});
