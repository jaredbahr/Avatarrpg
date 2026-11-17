import { describe, expect, it } from 'vitest';
import { CONTENT } from './index';
import { STATUSES } from './statuses';
import { RngCursor } from '../core/rng';
import { canUseAbility, isValidTarget } from '../core/rules/abilities';
import { posKey, tileAt } from '../core/rules/grid';
import { describeStatus } from '../core/rules/status';
import { activeUnit } from '../core/rules/turnOrder';
import { BattleDraft } from '../core/state/battleDraft';
import { createBattle, createGame } from '../core/state/createGame';
import { describeEvent } from '../core/state/log';
import { apply } from '../core/state/reducer';
import type { GameEvent, GameState, StatusId, Unit } from '../core/types';

function required<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) throw new Error(`Missing ${label}`);
  return value;
}

/** Real units and terrain in a four-unit roster; no AI acts. */
function fixture(seed: string) {
  const initial = createGame(CONTENT, {
    seed,
    startNode: '',
    party: [{ characterId: 'kaya' }, { characterId: 'bo' }, { characterId: 'nilak' }],
  });
  const rng = new RngCursor(initial.rng);
  const base = createBattle(CONTENT, initial, 'enc_forest_road', rng);
  const owner = required(
    base.units.find((unit) => unit.characterId === 'kaya'),
    'Kaya',
  );
  const first = required(
    base.units.find((unit) => unit.characterId === 'bo'),
    'Bo',
  );
  const second = required(
    base.units.find((unit) => unit.characterId === 'nilak'),
    'Nilak',
  );
  const enemy = required(
    base.units.find((unit) => unit.faction === 'enemy'),
    'opponent',
  );
  const occupied = new Set(base.props.map((prop) => posKey(prop.pos)));
  const dry = base.grid.tiles.flatMap((tile, index) => {
    const pos = { x: index % base.grid.width, y: Math.floor(index / base.grid.width) };
    return !tile.blocked && !tile.surface && !occupied.has(posKey(pos)) ? [pos] : [];
  });
  const units = [owner, first, second, enemy].map((unit, index) => ({
    ...unit,
    pos: required(dry[index], `dry tile ${index}`),
  }));
  const state: GameState = {
    ...initial,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...base,
      units,
      order: units.map((unit) => unit.id),
      // The owner is next only after two other units and the enemy have acted.
      // Its upkeep crosses the round boundary, independently of those turns.
      turnIndex: 1,
    },
  };
  return { state, ownerId: owner.id, firstId: first.id, secondId: second.id, enemyId: enemy.id };
}

function unit(state: GameState, id: string): Unit {
  return required(
    state.battle?.units.find((member) => member.id === id),
    `unit ${id}`,
  );
}

function applyTo(state: GameState, unitId: string, status: StatusId, duration?: number) {
  const draft = new BattleDraft(
    CONTENT,
    required(state.battle, 'battle'),
    new RngCursor(state.rng),
  );
  draft.applyStatusTo(unitId, status, duration);
  return { state: { ...state, battle: draft.toBattle() }, events: draft.events };
}

function endTurn(state: GameState, expectedActor: string) {
  const battle = required(state.battle, 'active battle');
  expect(battle.phase).toBe('active');
  expect(activeUnit(battle)?.id).toBe(expectedActor);
  const result = apply(CONTENT, state, { type: 'endTurn', unitId: expectedActor });
  expect(result.events).toContainEqual({ type: 'turnEnded', unitId: expectedActor });
  return result;
}

function assertNamedEvent(state: GameState, event: GameEvent, member: Unit, status: StatusId) {
  const definition = required(CONTENT.statuses.get(status), status);
  const text = required(describeEvent(CONTENT, state.battle, event), 'status log line');
  expect(text).toContain(member.name);
  expect(text).toContain(definition.name);
  expect(text).not.toMatch(/undefined|NaN|null|\[object/);
  const tokens = text.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  expect(tokens).not.toContain(member.id);
  // Most status ids are ordinary English words. Chi-Blocked has a separate
  // camelCase identifier, which must never replace its display name.
  if (status !== definition.name.toLowerCase()) expect(tokens).not.toContain(status);
}

describe('shipped status lifetimes through reducer turns', () => {
  it('covers exactly the statuses registered in content', () => {
    expect(new Set(STATUSES.map((status) => status.id))).toEqual(new Set(CONTENT.statuses.keys()));
    expect(STATUSES.length).toBeGreaterThan(0);
  });

  it.each(STATUSES)('$id ticks only at its owner start and expires on the final tick', (def) => {
    const setup = fixture(`status-lifetime-${def.id}`);
    const applied = applyTo(setup.state, setup.ownerId, def.id);
    let state: GameState = applied.state;
    const original = unit(state, setup.ownerId);
    expect(original.statuses).toEqual([{ id: def.id, duration: def.defaultDuration, stacks: 1 }]);
    const application = required(
      applied.events.find((event) => event.type === 'statusApplied'),
      'application event',
    );
    expect(application).toEqual({
      type: 'statusApplied',
      unitId: setup.ownerId,
      status: def.id,
      duration: def.defaultDuration,
    });
    assertNamedEvent(state, application, original, def.id);
    let totalDamage = 0;
    let expiries = 0;
    let skips = 0;

    // The extra lap proves expiry is permanent and a one-turn skip is over.
    for (let activation = 1; activation <= def.defaultDuration + 1; activation++) {
      for (const actor of [setup.firstId, setup.secondId]) {
        const before = unit(state, setup.ownerId);
        const result = endTurn(state, actor);
        state = result.state;
        expect(unit(state, setup.ownerId)).toEqual(before);
        expect(
          result.events.filter(
            (event) =>
              (event.type === 'statusExpired' || event.type === 'damaged') &&
              event.unitId === setup.ownerId,
          ),
        ).toEqual([]);
      }

      const before = unit(state, setup.ownerId);
      const result = endTurn(state, setup.enemyId);
      state = result.state;
      const owner = unit(state, setup.ownerId);
      const remaining = def.defaultDuration - activation;
      expect(owner.statuses).toEqual(
        remaining > 0 ? [{ id: def.id, duration: remaining, stacks: 1 }] : [],
      );
      const expired = result.events.filter(
        (event) => event.type === 'statusExpired' && event.unitId === setup.ownerId,
      );
      if (activation === def.defaultDuration) {
        expect(expired).toEqual([{ type: 'statusExpired', unitId: setup.ownerId, status: def.id }]);
        assertNamedEvent(state, required(expired[0], 'expiry event'), owner, def.id);
      } else expect(expired).toEqual([]);
      expiries += expired.length;

      const expectedDamage = activation <= def.defaultDuration ? def.tickDamage : 0;
      const damage = result.events.filter(
        (event) => event.type === 'damaged' && event.unitId === setup.ownerId,
      );
      expect(damage).toEqual(
        expectedDamage > 0
          ? [
              {
                type: 'damaged',
                unitId: setup.ownerId,
                amount: expectedDamage,
                damageType: def.tickDamageType,
                crit: false,
                sourceId: null,
              },
            ]
          : [],
      );
      expect(before.hp - owner.hp).toBe(expectedDamage);
      totalDamage += expectedDamage;

      const shouldSkip = def.skipsTurn && activation <= def.defaultDuration;
      const ownerTurns = result.events.filter(
        (event) =>
          (event.type === 'turnStarted' || event.type === 'turnEnded') &&
          event.unitId === setup.ownerId,
      );
      if (shouldSkip) {
        expect(ownerTurns).toEqual([{ type: 'turnEnded', unitId: setup.ownerId }]);
        expect(owner.ap).toBe(0);
        expect(owner.move).toBe(0);
        expect(activeUnit(required(state.battle, 'battle'))?.id).toBe(setup.firstId);
        const expiryIndex = result.events.findIndex((event) => event.type === 'statusExpired');
        const skipIndex = result.events.findIndex(
          (event) => event.type === 'turnEnded' && event.unitId === setup.ownerId,
        );
        expect(expiryIndex).toBeGreaterThanOrEqual(0);
        expect(expiryIndex).toBeLessThan(skipIndex);
        skips++;
      } else {
        expect(ownerTurns).toEqual([
          { type: 'turnStarted', unitId: setup.ownerId, round: state.battle?.round },
        ]);
        if (activation > def.defaultDuration) {
          expect(owner.ap).toBeGreaterThan(0);
          expect(owner.move).toBe(owner.base.maxMove);
        }
        const ended = endTurn(state, setup.ownerId);
        state = ended.state;
        expect(unit(state, setup.ownerId).statuses).toEqual(owner.statuses);
        expect(unit(state, setup.ownerId).hp).toBe(owner.hp);
      }
    }
    expect(expiries).toBe(1);
    expect(skips).toBe(def.skipsTurn ? 1 : 0);
    expect(original.hp - unit(state, setup.ownerId).hp).toBe(totalDamage);
    expect(totalDamage).toBe(def.tickDamage * def.defaultDuration);
  });
});

describe('shipped status reapplication', () => {
  it('upgrades a real two-round Chilled hit to one-round Frozen and skips one worker turn', () => {
    const initial = createGame(CONTENT, {
      seed: 3845378261,
      startNode: '',
      party: [
        { characterId: 'nilak', level: 5, discipline: 'ice_shaping' },
        { characterId: 'sura', level: 5, discipline: 'ice_shaping' },
      ],
    });
    const rng = new RngCursor(initial.rng);
    const base = createBattle(CONTENT, initial, 'enc_forest_road', rng, {
      variantId: 'thugs',
      enemyLevel: 10,
    });
    const nilak = required(
      base.units.find((member) => member.characterId === 'nilak'),
      'Nilak',
    );
    const sura = required(
      base.units.find((member) => member.characterId === 'sura'),
      'Sura',
    );
    const worker = required(
      base.units.find((member) => member.enemyId === 'bandit_thug'),
      'Quarry Worker',
    );
    const otherEnemies = base.units.filter(
      (member) => member.faction === 'enemy' && member.id !== worker.id,
    );
    const placements = new Map([
      [nilak.id, { x: 10, y: 4 }],
      [sura.id, { x: 10, y: 9 }],
      [worker.id, { x: 10, y: 7 }],
      ...otherEnemies.map((member, index) => [member.id, { x: 12 + index, y: 7 }] as const),
    ]);
    const units = base.units.map((member) => {
      const pos = required(placements.get(member.id), `placement for ${member.name}`);
      const tile = required(tileAt(base.grid, pos), `tile ${pos.x},${pos.y}`);
      expect(tile.blocked).toBe(false);
      expect(tile.surface).toBeNull();
      expect(base.props.some((prop) => posKey(prop.pos) === posKey(pos))).toBe(false);
      return { ...member, pos };
    });
    const start: GameState = {
      ...initial,
      screen: 'combat',
      rng: rng.state,
      battle: {
        ...base,
        units,
        order: [nilak.id, sura.id, worker.id, ...otherEnemies.map((member) => member.id)],
        turnIndex: 0,
      },
    };
    const target = { x: 10, y: 7 };
    const iceSpikes = required(CONTENT.abilities.get('ice_spikes'), 'Ice Spikes');
    const cast = (state: GameState, casterId: string) => {
      const caster = unit(state, casterId);
      const battle = required(state.battle, 'battle');
      expect(activeUnit(battle)?.id).toBe(casterId);
      expect(caster.abilities).toContain(iceSpikes.id);
      expect(canUseAbility(CONTENT, caster, iceSpikes)).toEqual({ ok: true, reason: '' });
      expect(isValidTarget(CONTENT, battle, caster, iceSpikes, target)).toEqual({
        ok: true,
        reason: '',
      });
      const result = apply(CONTENT, state, {
        type: 'useAbility',
        unitId: casterId,
        abilityId: iceSpikes.id,
        target,
      });
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: 'abilityUsed',
          unitId: casterId,
          abilityId: 'ice_spikes',
        }),
      );
      return result;
    };

    const chilled = cast(start, nilak.id);
    expect(unit(chilled.state, worker.id).statuses).toEqual([
      { id: 'chilled', duration: 2, stacks: 1 },
    ]);
    expect(chilled.events).toContainEqual({
      type: 'statusApplied',
      unitId: worker.id,
      status: 'chilled',
      duration: 2,
    });

    const frozen = cast(endTurn(chilled.state, nilak.id).state, sura.id);
    const workerBeforeSkip = unit(frozen.state, worker.id);
    expect(workerBeforeSkip.hp).toBeGreaterThan(0);
    expect(workerBeforeSkip.statuses).toEqual([{ id: 'frozen', duration: 1, stacks: 1 }]);
    expect(frozen.events).toContainEqual({
      type: 'statusExpired',
      unitId: worker.id,
      status: 'chilled',
    });
    expect(frozen.events).toContainEqual({
      type: 'statusApplied',
      unitId: worker.id,
      status: 'frozen',
      duration: 1,
    });

    const skipped = endTurn(frozen.state, sura.id);
    let state = skipped.state;
    expect(activeUnit(required(state.battle, 'battle'))?.id).not.toBe(worker.id);
    expect(skipped.events).toContainEqual({
      type: 'statusExpired',
      unitId: worker.id,
      status: 'frozen',
    });
    expect(skipped.events).toContainEqual({ type: 'turnEnded', unitId: worker.id });
    expect(skipped.events).not.toContainEqual(
      expect.objectContaining({ type: 'turnStarted', unitId: worker.id }),
    );
    expect(unit(state, worker.id).statuses).toEqual([]);
    expect(unit(state, worker.id).hp).toBe(workerBeforeSkip.hp);

    for (const actor of [...otherEnemies.map((member) => member.id), nilak.id]) {
      state = endTurn(state, actor).state;
    }
    const nextWorkerTurn = endTurn(state, sura.id);
    state = nextWorkerTurn.state;
    expect(activeUnit(required(state.battle, 'battle'))?.id).toBe(worker.id);
    expect(nextWorkerTurn.events).toContainEqual({
      type: 'turnStarted',
      unitId: worker.id,
      round: base.round + 1,
    });
    expect(unit(state, worker.id).ap).toBeGreaterThan(0);
  });

  // Repeating Chilled upgrades to Frozen; other statuses still refresh under
  // the usual explicit-duration policy without shortening or exceeding stacks.
  it.each(STATUSES.filter((status) => status.id !== 'chilled'))(
    '$id refreshes a single instance without shortening it or exceeding maxStacks',
    (def) => {
      const setup = fixture(`status-refresh-${def.id}`);
      let state = setup.state;
      let applications = 0;
      for (const duration of [3, 1, 5, 2, ...Array.from({ length: def.maxStacks }, () => 2)]) {
        applications++;
        const result = applyTo(state, setup.ownerId, def.id, duration);
        state = result.state;
        const expectedDuration = duration === 3 || duration === 1 ? 3 : 5;
        expect(unit(state, setup.ownerId).statuses).toEqual([
          { id: def.id, duration: expectedDuration, stacks: Math.min(applications, def.maxStacks) },
        ]);
        expect(result.events).toEqual([
          {
            type: 'statusApplied',
            unitId: setup.ownerId,
            status: def.id,
            duration: expectedDuration,
          },
        ]);
      }
    },
  );

  it('Wet puts out Burning and prevents its subsequent damage ticks', () => {
    const setup = fixture('status-wet-clears-burning');
    const burning = applyTo(setup.state, setup.ownerId, 'burning');
    const wet = applyTo(burning.state, setup.ownerId, 'wet');
    expect(unit(wet.state, setup.ownerId).statuses).toEqual([
      {
        id: 'wet',
        duration: required(CONTENT.statuses.get('wet'), 'Wet').defaultDuration,
        stacks: 1,
      },
    ]);
    expect(wet.events).toContainEqual({
      type: 'statusExpired',
      unitId: setup.ownerId,
      status: 'burning',
    });
    let state: GameState = wet.state;
    const hp = unit(state, setup.ownerId).hp;
    for (const actor of [setup.firstId, setup.secondId, setup.enemyId]) {
      const result = endTurn(state, actor);
      state = result.state;
      expect(result.events.filter((event) => event.type === 'damaged')).toEqual([]);
    }
    expect(unit(state, setup.ownerId).hp).toBe(hp);
    expect(unit(state, setup.ownerId).statuses.some((status) => status.id === 'burning')).toBe(
      false,
    );
    expect(
      tileAt(required(state.battle, 'battle').grid, unit(state, setup.ownerId).pos)?.surface,
    ).toBeNull();
  });
});

describe('shipped status display text', () => {
  it.each(STATUSES)('$id supplies a name and readable description', (def) => {
    expect(def.name.trim().length).toBeGreaterThan(1);
    expect(def.name).not.toBe(def.id);
    expect(def.description.trim().split(/\s+/).length).toBeGreaterThan(3);
    expect(describeStatus(CONTENT, def.id)).toBe(def.name);
    for (const text of [def.name, def.description]) {
      expect(text).not.toMatch(/undefined|NaN|null|\[object/);
      const tokens = text.match(/[\p{L}\p{N}_-]+/gu) ?? [];
      for (const status of STATUSES) {
        if (status.id !== status.name.toLowerCase()) expect(tokens).not.toContain(status.id);
      }
    }
  });
});
