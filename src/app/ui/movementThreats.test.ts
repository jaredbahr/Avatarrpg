import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../../core/rng';
import { createBattle, createGame } from '../../core/state/createGame';
import { BattleDraft } from '../../core/state/battleDraft';
import { MAX_BANKED_TOTAL_AP } from '../../core/rules/stats';
import { createMovementThreatQuery, nextActivationThreatBudget } from './movementThreats';

function fixture() {
  const state = createGame(CONTENT, {
    seed: 'movement-threat-ui',
    party: [{ characterId: 'sura', level: 2 }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const enemy = battle.units.find((u) => u.faction === 'enemy');
  if (!enemy) throw new Error('Missing enemy');
  return { state, battle, enemy };
}

describe('next-activation resource estimate', () => {
  it('matches actual turn preparation on dry ground without contact effects', () => {
    const { state, battle, enemy } = fixture();
    for (const statuses of [
      [],
      [{ id: 'shocked' as const, duration: 2, stacks: 1 }],
      [{ id: 'frozen' as const, duration: 1, stacks: 1 }],
    ]) {
      const unit = {
        ...enemy,
        ap: 0,
        move: 0,
        bankedAp: 1,
        statuses,
        cooldowns: { fire_blast: 1, oil_flask: 2 },
      };
      const snapshot = { ...battle, units: battle.units.map((u) => (u.id === unit.id ? unit : u)) };
      const draft = new BattleDraft(CONTENT, snapshot, new RngCursor(state.rng));
      draft.beginTurn(unit.id);
      const actual = draft.unit(unit.id);
      expect(actual).toBeDefined();
      if (!actual) throw new Error('Turn preparation lost the enemy');
      expect(nextActivationThreatBudget(CONTENT, unit)).toEqual({
        ap: actual.ap,
        move: actual.move,
        statuses: actual.statuses,
        cooldowns: actual.cooldowns,
      });
    }
  });

  it('uses actual banked AP rather than depleted current AP and obeys the shared cap', () => {
    const { enemy } = fixture();
    expect(nextActivationThreatBudget(CONTENT, { ...enemy, ap: 0, bankedAp: 0 }).ap).toBe(4);
    expect(nextActivationThreatBudget(CONTENT, { ...enemy, ap: 0, bankedAp: 1 }).ap).toBe(5);
    expect(
      nextActivationThreatBudget(CONTENT, {
        ...enemy,
        base: { ...enemy.base, maxAp: 6 },
        bankedAp: 1,
      }).ap,
    ).toBe(MAX_BANKED_TOTAL_AP);
  });

  it('expires cooldown one and decrements longer cooldowns', () => {
    const { enemy } = fixture();
    expect(
      nextActivationThreatBudget(CONTENT, {
        ...enemy,
        cooldowns: { fire_blast: 1, oil_flask: 2, torch_toss: 3 },
      }).cooldowns,
    ).toEqual({ oil_flask: 1, torch_toss: 2 });
  });

  it('retains only unexpired statuses and calculates resources after expiration', () => {
    const { enemy } = fixture();
    const budget = nextActivationThreatBudget(CONTENT, {
      ...enemy,
      statuses: [
        { id: 'chiBlocked', duration: 1, stacks: 1 },
        { id: 'shocked', duration: 2, stacks: 1 },
        { id: 'slowed', duration: 2, stacks: 1 },
      ],
    });
    expect(budget.statuses).toEqual([
      { id: 'shocked', duration: 1, stacks: 1 },
      { id: 'slowed', duration: 1, stacks: 1 },
    ]);
    expect(budget.ap).toBe(3);
    expect(budget.move).toBe(2);
  });

  it.each(['frozen', 'stunned'] as const)(
    'skips an activation even when %s expires during upkeep',
    (id) => {
      const { enemy } = fixture();
      expect(
        nextActivationThreatBudget(CONTENT, {
          ...enemy,
          statuses: [{ id, duration: 1, stacks: 1 }],
        }),
      ).toEqual({ ap: 0, move: 0, cooldowns: {}, statuses: [] });
    },
  );
});

describe('movement warning view model', () => {
  it('warns about the gate splash boundary with ability details, never labels an empty result safe', () => {
    const { battle } = fixture();
    const query = createMovementThreatQuery(CONTENT);
    expect(query(battle, 'p0', { x: 4, y: 3 }).warning).toBeNull();
    const result = query(battle, 'p0', { x: 5, y: 3 });
    expect(result.warning).toBe('Fire Nation Deserter could hit here.');
    expect(result.enemies[0]?.abilities.some((a) => a.name === 'Fire Blast')).toBe(true);
    expect(result.qualification).toBe(
      'Based on the current battlefield. Other actions and hazards can change this.',
    );
  });

  it('reuses a battle identity and destination but invalidates on a new state and does not mutate state/RNG', () => {
    const { state, battle, enemy } = fixture();
    const before = structuredClone({ state, battle });
    const query = createMovementThreatQuery(CONTENT);
    const original = query(battle, 'p0', { x: 5, y: 3 });
    expect(query(battle, 'p0', { x: 5, y: 3 })).toBe(original);
    expect(query(battle, 'p0', { x: 4, y: 3 })).not.toBe(original);
    const disabled = {
      ...battle,
      units: battle.units.map((u) =>
        u.id === enemy.id
          ? { ...u, statuses: [{ id: 'chiBlocked' as const, duration: 2, stacks: 1 }] }
          : u,
      ),
    };
    expect(query(disabled, 'p0', { x: 5, y: 3 }).warning).toBeNull();
    expect(query(battle, 'p0', { x: 5, y: 3 })).not.toBe(original);
    expect({ state, battle }).toEqual(before);
  });

  it('shows at most two names while retaining all enemy ability details', () => {
    const { battle, enemy } = fixture();
    const many = {
      ...battle,
      units: [
        ...battle.units,
        { ...enemy, id: 'extra-1', name: 'Second', pos: { x: 16, y: 5 } },
        { ...enemy, id: 'extra-2', name: 'Third', pos: { x: 16, y: 7 } },
      ],
    };
    const result = createMovementThreatQuery(CONTENT)(many, 'p0', { x: 9, y: 5 });
    expect(result.names).toEqual(['Fire Nation Deserter', 'Second']);
    expect(result.remainingCount).toBe(1);
    expect(result.enemies).toHaveLength(3);
    expect(result.warning).toBe('Fire Nation Deserter, Second and 1 other could hit here.');
  });

  it('keeps an invalid selection distinct from an empty threat result', () => {
    const { battle } = fixture();
    const result = createMovementThreatQuery(CONTENT)(battle, 'missing', { x: 5, y: 3 });
    expect(result.warning).toBeNull();
    expect(result.invalidReason).not.toBeNull();
  });
});
