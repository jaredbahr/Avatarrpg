import assert from 'node:assert/strict';
import { canUseAbility } from '../../src/core/rules/abilities';
import { runCombat, type SimOptions, type SimResult } from '../../src/core/sim/runCombat';
import { BattleDraft } from '../../src/core/state/battleDraft';
import type { ContentIndex, StatusId, Unit } from '../../src/core/types';

export interface TurnCycleCoverage {
  starts: number;
  completedRounds: number;
  midRoundDeaths: number;
  statusesExpired: number;
  longStatusesExpired: number;
  singleTurnSkips: number;
  recoveredSkips: number;
  cooldownsReady: number;
  longCooldownsReady: number;
  cooldownUseChecks: number;
  bossRounds: number;
}

type Marker =
  | { type: 'round'; at: number; round: number }
  | { type: 'opening'; at: number; round: number; id: string; skipped: boolean; died: boolean };

function assertEventOrder(
  result: SimResult,
  units: readonly Unit[],
  order: readonly string[],
  markers: readonly Marker[],
  coverage: TurnCycleCoverage,
) {
  const living = new Set(units.filter((unit) => unit.hp > 0).map((unit) => unit.id));
  const bossIds = units.filter((unit) => unit.size === 2).map((unit) => unit.id);
  assert.equal(new Set(order).size, order.length, 'initiative has a unique slot per unit');
  assert.ok(order.length > 0, 'the battle has an opening actor');
  assert.equal(order.length, units.length, 'initiative includes the complete opening roster');
  assert.ok(
    order.every((id) => living.has(id)),
    'all members of the opening roster start alive',
  );

  // Creation opens the first turn before the simulator emits any events.
  let round = 1;
  let next = 1;
  let acting: string | undefined = order[0]!;
  let announced = true;
  let skip: string | undefined;
  let ended = false;
  let markerIndex = 0;
  let index = 0;
  let draftIndex = 0;
  let announcedRound = true;
  let taken = new Set([acting]);
  let startLiving = new Set(living);

  while (index <= result.events.length) {
    const marker = markers[markerIndex];
    if (marker?.at === draftIndex) {
      markerIndex++;
      if (marker.type === 'round') {
        assert.ok(acting === undefined && skip === undefined, 'a round cannot interrupt a turn');
        for (const id of startLiving) {
          if (living.has(id)) assert.ok(taken.has(id), `${id} missed completed round ${round}`);
        }
        for (const id of bossIds) {
          if (startLiving.has(id) && living.has(id)) coverage.bossRounds++;
        }
        coverage.completedRounds++;
        assert.equal(marker.round, round + 1, 'round numbers advance one at a time');
        startLiving = new Set(living);
        taken = new Set();
        round = marker.round;
        announcedRound = false;
        next = 0;
        continue;
      }

      assert.equal(marker.round, round, `opening ${marker.id} is in the current round`);
      assert.ok(acting === undefined && skip === undefined, 'the previous activation is closed');
      assert.ok(announcedRound, 'round upkeep and its event precede the first unit start');
      while (next < order.length && !living.has(order[next]!)) next++;
      assert.equal(
        marker.id,
        order[next++],
        `opening ${marker.id} follows fixed living initiative`,
      );
      assert.ok(startLiving.has(marker.id), 'a new unit cannot silently join this round');
      assert.ok(!taken.has(marker.id), `${marker.id} opened twice in round ${round}`);
      taken.add(marker.id);
      coverage.starts++;
      if (!marker.died) {
        if (marker.skipped) skip = marker.id;
        else {
          acting = marker.id;
          announced = false;
        }
      }
      continue;
    }

    const event = result.events[index++];
    if (event === undefined) break;
    // The outer reducer appends discovery events after the draft events.
    if (event.type === 'comboDiscovered') continue;
    draftIndex++;
    assert.ok(!ended, 'battleEnded is the final draft event');
    switch (event.type) {
      case 'roundStarted':
        assert.equal(event.round, round);
        assert.ok(!announcedRound, 'a round is announced once');
        announcedRound = true;
        break;
      case 'turnStarted':
        assert.equal(event.round, round);
        assert.equal(event.unitId, acting, 'reported starter matches the surviving upkeep owner');
        assert.ok(!announced, 'a turn is announced once');
        assert.ok(living.has(event.unitId), 'dead units cannot start turns');
        announced = true;
        break;
      case 'turnEnded':
        assert.equal(event.unitId, skip ?? acting, 'the ending belongs to the current activation');
        assert.ok(
          skip !== undefined || announced,
          'a non-skipped activation must start before ending',
        );
        skip = undefined;
        acting = undefined;
        break;
      case 'abilityUsed':
        assert.equal(event.unitId, acting, 'only the announced actor may use an ability');
        assert.ok(
          announced && living.has(event.unitId),
          'a dead or skipped unit cannot use an ability',
        );
        break;
      case 'unitMoved':
        // A walk can die from fire on its final step; the movement summary is
        // emitted after contact, while that same activation still owns the log.
        assert.equal(event.unitId, acting, 'movement belongs to the current activation');
        assert.ok(announced, 'movement cannot start during skipped/upkeep-only turns');
        break;
      case 'unitDied':
        assert.ok(living.delete(event.unitId), `${event.unitId} died more than once`);
        if (!taken.has(event.unitId)) coverage.midRoundDeaths++;
        break;
      case 'battleEnded':
        assert.equal(event.outcome, result.outcome);
        assert.ok(acting === undefined && skip === undefined, 'battle ends between activations');
        ended = true;
        break;
    }
  }

  assert.ok(announcedRound, 'every round boundary has an event');
  assert.equal(markerIndex, markers.length, 'every recorded draft boundary is in the log');
  assert.ok(ended, 'the battle completed; only its final round may be partial');
}

type ClockEdit = 'status' | 'cooldown' | 'turn';

/**
 * Forward temporary, worker-local observers through the same draft the
 * reducer commits. Forecasts use a non-resolving draft and are ignored.
 */
export function verifyTurnCycle(content: ContentIndex, options: SimOptions) {
  const coverage: TurnCycleCoverage = {
    starts: 0,
    completedRounds: 0,
    midRoundDeaths: 0,
    statusesExpired: 0,
    longStatusesExpired: 0,
    singleTurnSkips: 0,
    recoveredSkips: 0,
    cooldownsReady: 0,
    longCooldownsReady: 0,
    cooldownUseChecks: 0,
    bossRounds: 0,
  };
  const draftMethods = BattleDraft.prototype;
  const { beginTurn, replace, tickTerrain, setCooldown, applyStatusTo, cleanseFrom } = draftMethods;
  let firstUnits: readonly Unit[] | undefined;
  let order: readonly string[] | undefined;
  let draft: BattleDraft | undefined;
  let priorEvents = 0;
  let edit: ClockEdit | undefined;
  let owner: string | undefined;
  let pendingTick: Unit | undefined;
  const markers: Marker[] = [];
  const longStatuses = new Set<string>();
  const longCooldowns = new Set<string>();
  const previousSingleSkips = new Set<string>();

  function observe(current: BattleDraft): void {
    if (draft === current) return;
    if (draft === undefined) {
      firstUnits = [...current.units];
      order = [...current.order];
    } else {
      priorEvents += draft.events.length;
    }
    draft = current;
  }

  function checkTick(before: Unit, after: Unit): void {
    assert.equal(after.statuses.length, before.statuses.filter((s) => s.duration > 1).length);
    for (const status of before.statuses) {
      const key = `${before.id}/${status.id}`;
      const remaining = after.statuses.find((s) => s.id === status.id);
      if (status.duration > 1) {
        assert.equal(remaining?.duration, status.duration - 1, `${key} ticks once`);
        assert.equal(remaining?.stacks, status.stacks, `${key} keeps its stack count`);
      } else {
        assert.equal(remaining, undefined, `${key} expires at its owner's start`);
        coverage.statusesExpired++;
        if (longStatuses.delete(key)) coverage.longStatusesExpired++;
      }
    }
    let stillCooling = 0;
    for (const [id, rounds] of Object.entries(before.cooldowns)) {
      const key = `${before.id}/${id}`;
      if (rounds > 1) {
        assert.equal(after.cooldowns[id], rounds - 1, `${key} cooldown ticks once`);
        stillCooling++;
      } else {
        assert.equal(after.cooldowns[id], undefined, `${key} is ready on its Nth owner-start`);
        coverage.cooldownsReady++;
        if (longCooldowns.delete(key)) coverage.longCooldownsReady++;
      }
    }
    assert.equal(Object.keys(after.cooldowns).length, stillCooling, 'upkeep adds no cooldowns');
  }

  draftMethods.replace = function (unit) {
    if (this.resolveChanceStatuses) {
      observe(this);
      const before = this.unit(unit.id);
      assert.ok(before, `no summon is defined for this scenario (${unit.id})`);
      if (edit === 'turn' && owner === unit.id && pendingTick) {
        assert.equal(unit.hp, pendingTick.hp, 'the duration tick precedes any upkeep damage');
        checkTick(pendingTick, unit);
        pendingTick = undefined;
      } else {
        if (edit !== 'status' || unit.id !== owner) {
          if (unit.statuses !== before.statuses) {
            assert.deepEqual(
              unit.statuses,
              before.statuses,
              `${unit.id} statuses changed outside upkeep/application`,
            );
          }
        }
        if (edit !== 'cooldown' || unit.id !== owner) {
          if (unit.cooldowns !== before.cooldowns) {
            assert.deepEqual(
              unit.cooldowns,
              before.cooldowns,
              `${unit.id} cooldowns changed outside upkeep/cast`,
            );
          }
        }
      }
    }
    return replace.call(this, unit);
  };

  draftMethods.beginTurn = function (id) {
    if (!this.resolveChanceStatuses) return beginTurn.call(this, id);
    observe(this);
    const before = this.unit(id);
    assert.ok(before, `upkeep owner ${id} exists`);
    if (before.hp <= 0) {
      // Round-level terrain ran after the pointer was picked; it may have
      // killed that unit. beginTurn must leave the dead slot untouched.
      const at = this.events.length;
      const skipped = beginTurn.call(this, id);
      assert.equal(skipped, false);
      assert.equal(this.events.length, at);
      assert.equal(this.unit(id), before);
      return skipped;
    }
    const at = this.events.length;
    const skipStatus = before.statuses.filter(
      (status) => content.statuses.get(status.id)?.skipsTurn,
    );
    edit = 'turn';
    owner = id;
    pendingTick = before;
    let skipped: boolean;
    try {
      skipped = beginTurn.call(this, id);
      assert.equal(pendingTick, undefined, `${id} committed its upkeep clock tick`);
    } finally {
      edit = undefined;
      owner = undefined;
      pendingTick = undefined;
    }

    const after = this.unit(id)!;
    assert.equal(skipped, skipStatus.length > 0, 'skip is decided from pre-tick statuses');
    const expiries = before.statuses.filter((status) => status.duration === 1);
    for (const [offset, status] of expiries.entries()) {
      const event = this.events[at + offset];
      assert.ok(
        event?.type === 'statusExpired' && event.unitId === id && event.status === status.id,
        `${id} logs the expiry of ${status.id} before contact or damage`,
      );
    }
    if (previousSingleSkips.delete(id) && skipStatus.length === 0 && after.hp > 0) {
      assert.equal(skipped, false, 'an expired one-turn skip cannot cost the next activation');
      coverage.recoveredSkips++;
    }
    if (skipStatus.length === 1 && skipStatus[0]!.duration === 1 && after.hp > 0) {
      coverage.singleTurnSkips++;
      previousSingleSkips.add(id);
      assert.equal(after.ap, 0);
      assert.equal(after.move, 0);
    }
    if (after.hp <= 0) {
      assert.ok(
        this.events.slice(at).some((event) => event.type === 'unitDied' && event.unitId === id),
        'a fatal upkeep emits the death before advancing',
      );
    }
    if (after.hp > 0 && !skipped) {
      for (const id of Object.keys(before.cooldowns)) {
        const ability = content.abilities.get(id)!;
        const withoutCooldown = { ...after, cooldowns: {} };
        if (canUseAbility(content, withoutCooldown, ability).ok) {
          coverage.cooldownUseChecks++;
          assert.equal(
            canUseAbility(content, after, ability).ok,
            before.cooldowns[id] === 1,
            `${id} cooldown is the only difference in usability`,
          );
        }
      }
    }
    markers.push({
      type: 'opening',
      at: priorEvents + at,
      round: this.round,
      id,
      skipped,
      died: after.hp <= 0,
    });
    return skipped;
  };

  draftMethods.tickTerrain = function () {
    if (this.resolveChanceStatuses) {
      observe(this);
      markers.push({ type: 'round', at: priorEvents + this.events.length, round: this.round });
    }
    return tickTerrain.call(this);
  };

  draftMethods.setCooldown = function (id, ability, rounds) {
    if (!this.resolveChanceStatuses) return setCooldown.call(this, id, ability, rounds);
    observe(this);
    assert.equal(
      rounds,
      content.abilities.get(ability)?.cooldown,
      'cast uses its authored cooldown',
    );
    const before = this.unit(id)!;
    assert.equal(before.cooldowns[ability] ?? 0, 0, `${id} cast ${ability} while cooling down`);
    edit = 'cooldown';
    owner = id;
    try {
      setCooldown.call(this, id, ability, rounds);
    } finally {
      edit = undefined;
      owner = undefined;
    }
    const after = this.unit(id)!;
    assert.equal(after.cooldowns[ability] ?? 0, rounds);
    if (rounds > 1) longCooldowns.add(`${id}/${ability}`);
    for (const other of Object.keys(before.cooldowns)) {
      if (other !== ability) assert.equal(after.cooldowns[other], before.cooldowns[other]);
    }
    assert.equal(
      Object.keys(after.cooldowns).length,
      Object.keys(before.cooldowns).length + (rounds > 0 ? 1 : 0),
    );
  };

  function editStatuses(current: BattleDraft, id: string, apply: () => void): void {
    if (!current.resolveChanceStatuses) return apply();
    observe(current);
    const previousEdit = edit;
    const previousOwner = owner;
    const at = current.events.length;
    const before = current.unit(id);
    edit = 'status';
    owner = id;
    try {
      apply();
      const after = current.unit(id);
      if (before?.statuses === after?.statuses) return;
      assert.ok(before && after);
      const durations = new Map(before.statuses.map((status) => [status.id, status.duration]));
      for (let i = at; i < current.events.length; i++) {
        const event = current.events[i]!;
        if (event.type === 'statusExpired') {
          assert.equal(event.unitId, id);
          assert.ok(durations.delete(event.status), 'only an existing status can be cleared');
          longStatuses.delete(`${id}/${event.status}`);
        } else if (event.type === 'statusApplied') {
          assert.equal(event.unitId, id);
          durations.set(event.status, event.duration);
          if (event.duration > 1) longStatuses.add(`${id}/${event.status}`);
        }
      }
      assert.equal(after.statuses.length, durations.size);
      for (const status of after.statuses) {
        assert.equal(
          status.duration,
          durations.get(status.id),
          'status edits match explicit events',
        );
      }
    } finally {
      edit = previousEdit;
      owner = previousOwner;
    }
  }
  draftMethods.applyStatusTo = function (id, status, duration) {
    return editStatuses(this, id, () => applyStatusTo.call(this, id, status, duration));
  };
  draftMethods.cleanseFrom = function (id, statuses: readonly StatusId[]) {
    return editStatuses(this, id, () => cleanseFrom.call(this, id, statuses));
  };

  try {
    const result = runCombat(content, { ...options, recordEvents: true });
    assert.deepEqual(result.anomalies, [], 'real combat finished normally');
    assert.ok(firstUnits && order, 'observed a live draft');
    assertEventOrder(result, firstUnits, order, markers, coverage);
    return { result, coverage };
  } catch (error) {
    throw new Error(
      `${options.encounterId} size ${options.party.length} seed ${options.seed}: ${String(error)}`,
      { cause: error },
    );
  } finally {
    Object.assign(draftMethods, {
      beginTurn,
      replace,
      tickTerrain,
      setCooldown,
      applyStatusTo,
      cleanseFrom,
    });
  }
}
