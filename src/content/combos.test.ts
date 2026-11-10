import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from './index';
import { COMBOS } from './combos';
import { DISCIPLINE_FLAGS } from './disciplines';
import { RngCursor } from '../core/rng';
import {
  affectedTiles,
  canUseAbility,
  isValidTarget,
  unitAbilities,
} from '../core/rules/abilities';
import { connectedSurface, ORTHOGONAL, posKey, tileAt } from '../core/rules/grid';
import { incomingMultiplier } from '../core/rules/stats';
import { activeUnit } from '../core/rules/turnOrder';
import type { SurfaceReaction } from '../core/rules/surfaces';
import { BattleDraft } from '../core/state/battleDraft';
import { createBattle, createGame } from '../core/state/createGame';
import type { PartySlot } from '../core/state/createGame';
import { apply } from '../core/state/reducer';
import type { ComboRule, GameEvent, GameState, Grid, Unit, Vec2 } from '../core/types';

function required<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) throw new Error(`Missing ${label}`);
  return value;
}

interface Technique {
  readonly ability: string;
  readonly slot: PartySlot;
}

// These are actual grants/choices, rather than ability ids injected into units.
const WATER: Technique = {
  ability: 'tidal_wave',
  slot: { characterId: 'sura', level: 7, discipline: 'ice_shaping', chosen: ['tidal_wave'] },
};
const ICE: Technique = { ability: 'ice_path', slot: { characterId: 'sura', level: 2 } };
const OIL: Technique = {
  ability: 'shock_mine',
  slot: { characterId: 'wen', level: 7, discipline: 'engineering' },
};
const FIRE: Technique = {
  ability: 'fire_wall',
  slot: { characterId: 'kaya', level: 5, discipline: 'flame_shaping' },
};
const MUD: Technique = {
  ability: 'mudslide',
  slot: { characterId: 'bo', level: 5, discipline: 'earth_shaping' },
};
const STEAM: Technique = {
  ability: 'smoke_bomb',
  slot: { characterId: 'riko', level: 5, discipline: 'field_craft' },
};
const RUBBLE: Technique = {
  ability: 'raise_rubble',
  slot: { characterId: 'lin_mei', level: 3, chosen: ['raise_rubble'] },
};
const LIGHTNING: Technique = { ability: 'gauntlet_spark', slot: { characterId: 'wen', level: 2 } };
const WHIP: Technique = { ability: 'water_whip', slot: { characterId: 'nilak' } };
const COLD: Technique = {
  ability: 'ice_spikes',
  slot: { characterId: 'nilak', level: 5, discipline: 'ice_shaping' },
};
const ICE_APPLIER: Technique = {
  ability: 'ice_path',
  slot: { characterId: 'nilak', level: 3, chosen: ['ice_path'] },
};
const EARTH: Technique = { ability: 'rock_throw', slot: { characterId: 'bo' } };
const AIR: Technique = { ability: 'air_blast', slot: { characterId: 'nima' } };

const PAIRS: Readonly<Record<string, readonly [Technique, Technique]>> = {
  'lightning-into-water': [WATER, LIGHTNING],
  'lightning-into-ice': [ICE, LIGHTNING],
  'fire-into-oil': [OIL, FIRE],
  'fire-into-water': [WATER, FIRE],
  'fire-into-ice': [ICE, FIRE],
  'fire-into-mud': [MUD, FIRE],
  'fire-into-steam': [STEAM, FIRE],
  'water-onto-fire': [FIRE, WHIP],
  'water-onto-rubble': [RUBBLE, WHIP],
  'cold-into-water': [WATER, COLD],
  'ice-onto-water': [WATER, ICE_APPLIER],
  'cold-into-mud': [MUD, COLD],
  'cold-into-fire': [FIRE, COLD],
  'earth-into-water': [WATER, EARTH],
  'earth-into-ice': [ICE, EARTH],
  'earth-into-fire': [FIRE, EARTH],
  'air-into-fire': [FIRE, AIR],
  'air-into-steam': [STEAM, AIR],
  'water-into-mud': [MUD, WHIP],
  'water-into-oil': [OIL, WHIP],
};

const TARGET: Vec2 = { x: 10, y: 7 };

function member(state: GameState, id: string): Unit {
  return required(
    state.battle?.units.find((unit) => unit.id === id),
    `unit ${id}`,
  );
}

/** Authored dry road, real kits and real level-scaled enemies; only positions/order are staged. */
function fixture(combo: ComboRule, producer: Technique, applicator: Technique) {
  const initial = createGame(CONTENT, {
    seed: `content-combo-${combo.id}`,
    startNode: '',
    party: [producer.slot, applicator.slot],
    flags: { [DISCIPLINE_FLAGS.engineering]: true },
  });
  const rng = new RngCursor(initial.rng);
  // Level 10 is an explicit content-test fixture, not encounter tuning: its
  // unmodified enemies survive the level-7 setup and subsequent chain damage.
  const base = createBattle(CONTENT, initial, 'enc_forest_road', rng, {
    variantId: 'thugs',
    enemyLevel: 10,
  });
  const parties = base.units.filter((unit) => unit.faction === 'party');
  const enemies = base.units.filter((unit) => unit.faction === 'enemy');
  const water = producer.ability === 'tidal_wave';
  const placements: readonly Vec2[] = [
    { x: 10, y: 4 },
    { x: 10, y: 9 },
    water ? { x: 10, y: 5 } : TARGET,
    water ? { x: 11, y: 6 } : { x: 10, y: 6 },
  ];
  const units = [parties[0], parties[1], enemies[0], enemies[1]].map((unit, index) => {
    const pos = required(placements[index], `placement ${index}`);
    const tile = required(tileAt(base.grid, pos), 'authored road tile');
    expect(tile.blocked).toBe(false);
    expect(tile.surface).toBeNull();
    expect(base.props.some((prop) => posKey(prop.pos) === posKey(pos))).toBe(false);
    return { ...required(unit, `real roster member ${index}`), pos };
  });
  expect(new Set(units.map((unit) => posKey(unit.pos))).size).toBe(units.length);
  expect(tileAt(base.grid, TARGET)?.surface).toBeNull();
  const state: GameState = {
    ...initial,
    screen: 'combat',
    rng: rng.state,
    battle: { ...base, units, order: units.map((unit) => unit.id), turnIndex: 0 },
  };
  return {
    state,
    producerId: required(units[0], 'producer').id,
    applicatorId: required(units[1], 'applicator').id,
    victimId: required(units[2], 'victim').id,
    neighbourId: required(units[3], 'connected neighbour').id,
  };
}

interface ObservedReaction {
  readonly reaction: SurfaceReaction;
  readonly sourceId: string | null;
  readonly grid: Grid;
  readonly before: readonly Unit[];
  readonly after: readonly Unit[];
  readonly events: readonly GameEvent[];
  readonly rngBefore: number;
  readonly rngAfter: number;
}

function cast(state: GameState, casterId: string, technique: Technique, target: Vec2) {
  const battle = required(state.battle, 'battle');
  const caster = member(state, casterId);
  const ability = required(CONTENT.abilities.get(technique.ability), technique.ability);
  expect(battle.phase).toBe('active');
  expect(activeUnit(battle)?.id).toBe(casterId);
  expect(caster.abilities).toContain(ability.id);
  expect(unitAbilities(CONTENT, caster)).toContain(ability.id);
  expect(canUseAbility(CONTENT, caster, ability)).toEqual({ ok: true, reason: '' });
  expect(isValidTarget(CONTENT, battle, caster, ability, target)).toEqual({ ok: true, reason: '' });
  expect(affectedTiles(CONTENT, battle.grid, caster, ability, target)).toContainEqual(target);
  const result = apply(CONTENT, state, {
    type: 'useAbility',
    unitId: casterId,
    abilityId: ability.id,
    target,
  });
  expect(result.events).toContainEqual(
    expect.objectContaining({
      type: 'abilityUsed',
      unitId: casterId,
      abilityId: ability.id,
      target,
    }),
  );
  return result;
}

function endTurn(state: GameState, id: string) {
  expect(activeUnit(required(state.battle, 'battle'))?.id).toBe(id);
  const result = apply(CONTENT, state, { type: 'endTurn', unitId: id });
  expect(result.events).toContainEqual({ type: 'turnEnded', unitId: id });
  return result;
}

/** Check the reaction at the exact effect boundary, before later authored effects run. */
function assertReaction(combo: ComboRule, observed: ObservedReaction, target: Vec2) {
  const { reaction, before, after, events } = observed;
  expect(reaction.changes).toContainEqual({
    pos: target,
    from: combo.existing,
    to: combo.result,
    label: combo.label,
    comboId: combo.id,
  });
  expect(events).toContainEqual({
    type: 'surfaceChanged',
    pos: target,
    from: combo.existing,
    to: combo.result,
    label: combo.label,
  });
  expect(tileAt(reaction.grid, target)?.surface).toEqual(
    combo.result
      ? {
          id: combo.result,
          duration:
            combo.duration ||
            required(CONTENT.surfaces.get(combo.result), 'surface').defaultDuration,
          spread: combo.spread,
        }
      : null,
  );

  const connected =
    combo.chainThroughExisting && combo.existing
      ? connectedSurface(observed.grid, target, combo.existing)
      : [];
  expect(reaction.chainHits).toEqual(
    combo.chainThroughExisting && combo.chainDamage > 0
      ? connected.map((pos) => ({
          pos,
          amount: combo.chainDamage,
          damageType: combo.applied,
          comboId: combo.id,
        }))
      : [],
  );
  const statusPositions = combo.chainThroughExisting
    ? connected
    : reaction.changes.filter((change) => change.comboId === combo.id).map((change) => change.pos);
  expect(reaction.statusHits).toEqual(
    combo.status
      ? statusPositions.map((pos) => ({
          pos,
          status: combo.status,
          chance: combo.statusChance,
          comboId: combo.id,
        }))
      : [],
  );

  const expectedDamage: GameEvent[] = [];
  for (const hit of reaction.chainHits) {
    const unit = before.find((candidate) => posKey(candidate.pos) === posKey(hit.pos));
    if (!unit) continue;
    const amount = Math.round(hit.amount * incomingMultiplier(CONTENT, unit, hit.damageType));
    expect(unit.hp).toBeGreaterThan(amount);
    expectedDamage.push({
      type: 'damaged',
      unitId: unit.id,
      amount,
      damageType: hit.damageType,
      sourceId: observed.sourceId,
      crit: false,
    });
    expect(
      required(
        after.find((candidate) => candidate.id === unit.id),
        'chain victim',
      ).hp,
    ).toBe(unit.hp - amount);
  }
  expect(events.filter((event) => event.type === 'damaged')).toEqual(expectedDamage);

  // A separate cursor predicts this one reaction's authored chance rolls from
  // its observed input state. It never replaces or rewinds the battle RNG.
  const chances = new RngCursor(observed.rngBefore);
  const expectedStatuses: GameEvent[] = [];
  for (const hit of reaction.statusHits) {
    const unit = before.find((candidate) => posKey(candidate.pos) === posKey(hit.pos));
    if (!unit || unit.hp <= 0) continue;
    if (!chances.chance(hit.chance)) continue;
    const def = required(CONTENT.statuses.get(hit.status), 'combo status');
    const duration = Math.max(
      def.defaultDuration,
      unit.statuses.find((status) => status.id === hit.status)?.duration ?? 0,
    );
    expectedStatuses.push({ type: 'statusApplied', unitId: unit.id, status: hit.status, duration });
    expect(
      required(
        after.find((candidate) => candidate.id === unit.id),
        'status victim',
      ).statuses,
    ).toContainEqual({
      id: hit.status,
      duration,
      stacks: Math.min(
        def.maxStacks,
        (unit.statuses.find((status) => status.id === hit.status)?.stacks ?? 0) + 1,
      ),
    });
  }
  expect(events.filter((event) => event.type === 'statusApplied')).toEqual(expectedStatuses);
  expect(observed.rngAfter).toBe(chances.state);
}

function witness(combo: ComboRule) {
  const [producer, applicator] = required(PAIRS[combo.id], `real ability pair for ${combo.id}`);
  const setup = fixture(combo, producer, applicator);
  const reactions: ObservedReaction[] = [];
  const original = BattleDraft.prototype.applyReaction;
  const observer = vi.spyOn(BattleDraft.prototype, 'applyReaction').mockImplementation(function (
    this: BattleDraft,
    reaction: SurfaceReaction,
    sourceId: string | null,
  ) {
    const grid = this.grid;
    const before = [...this.units];
    const rngBefore = this.rng.state;
    const eventStart = this.events.length;
    original.call(this, reaction, sourceId);
    reactions.push({
      reaction,
      sourceId,
      grid,
      before,
      after: [...this.units],
      events: this.events.slice(eventStart),
      rngBefore,
      rngAfter: this.rng.state,
    });
  });
  try {
    const allEvents: GameEvent[] = [];
    const produced = cast(setup.state, setup.producerId, producer, TARGET);
    allEvents.push(...produced.events);
    let state = produced.state;
    expect(member(state, setup.victimId).pos).toEqual(TARGET);
    expect(tileAt(required(state.battle, 'battle').grid, TARGET)?.surface?.id).toBe(combo.existing);
    expect(produced.events).toContainEqual(
      expect.objectContaining({
        type: 'surfaceChanged',
        pos: TARGET,
        from: null,
        to: combo.existing,
      }),
    );
    const handed = endTurn(state, setup.producerId);
    allEvents.push(...handed.events);
    state = handed.state;

    if (applicator.ability === 'gauntlet_spark') {
      const path = [{ x: 11, y: 8 }];
      const moved = apply(CONTENT, state, { type: 'move', unitId: setup.applicatorId, path });
      expect(moved.events).toContainEqual(
        expect.objectContaining({
          type: 'unitMoved',
          unitId: setup.applicatorId,
          path,
        }),
      );
      allEvents.push(...moved.events);
      state = moved.state;
    }
    const start = reactions.length;
    const applied = cast(state, setup.applicatorId, applicator, TARGET);
    allEvents.push(...applied.events);
    state = applied.state;
    const matching = reactions
      .slice(start)
      .filter(({ reaction }) =>
        reaction.changes.some(
          (change) => change.comboId === combo.id && posKey(change.pos) === posKey(TARGET),
        ),
      );
    expect(matching).toHaveLength(1);
    const observed = required(matching[0], 'actual combo reaction');
    assertReaction(combo, observed, TARGET);
    expect(applied.events).toContainEqual({
      type: 'surfaceChanged',
      pos: TARGET,
      from: combo.existing,
      to: combo.result,
      label: combo.label,
    });
    if (combo.chainThroughExisting) {
      const neighbour = required(
        observed.before.find((unit) => unit.id === setup.neighbourId),
        'neighbour',
      );
      expect(neighbour.pos).not.toEqual(TARGET);
      expect(observed.reaction.chainHits).toContainEqual(
        expect.objectContaining({ pos: neighbour.pos }),
      );
      expect(observed.events).toContainEqual(
        expect.objectContaining({ type: 'damaged', unitId: neighbour.id }),
      );
      expect(observed.events).toContainEqual(
        expect.objectContaining({
          type: 'statusApplied',
          unitId: neighbour.id,
          status: combo.status,
        }),
      );
    }
    if (combo.id === 'cold-into-fire') {
      const removed = applied.events.findIndex(
        (event) =>
          event.type === 'surfaceChanged' &&
          posKey(event.pos) === posKey(TARGET) &&
          event.label === combo.label,
      );
      const repainted = applied.events.findIndex(
        (event, index) =>
          index > removed &&
          event.type === 'surfaceChanged' &&
          posKey(event.pos) === posKey(TARGET) &&
          event.from === null &&
          event.to === 'ice',
      );
      expect(removed).toBeGreaterThanOrEqual(0);
      expect(repainted).toBeGreaterThan(removed);
      expect(tileAt(required(state.battle, 'battle').grid, TARGET)?.surface?.id).toBe('ice');
    }
    if (combo.spread > 0) {
      const battle = required(state.battle, 'battle');
      const targets = ORTHOGONAL.map((d) => ({ x: TARGET.x + d.x, y: TARGET.y + d.y })).filter(
        (pos) => {
          const tile = tileAt(battle.grid, pos);
          return tile && !tile.blocked && (!tile.surface || tile.surface.id === 'oil');
        },
      );
      expect(targets.length).toBeGreaterThan(0);
      const round = battle.round;
      const spreadEvents: GameEvent[] = [];
      for (let step = 0; step < battle.order.length; step++) {
        const ended = endTurn(
          state,
          required(activeUnit(required(state.battle, 'battle')), 'actor').id,
        );
        state = ended.state;
        spreadEvents.push(...ended.events);
        if (required(state.battle, 'battle').round > round) break;
      }
      expect(required(state.battle, 'battle').round).toBe(round + 1);
      for (const pos of targets) {
        expect(spreadEvents).toContainEqual({
          type: 'surfaceChanged',
          pos,
          from: tileAt(battle.grid, pos)?.surface?.id ?? null,
          to: 'fire',
          label: 'The fire spreads!',
        });
        expect(tileAt(required(state.battle, 'battle').grid, pos)?.surface).toEqual({
          id: 'fire',
          duration: combo.duration - 1,
          spread: combo.spread - 1,
        });
      }
      expect(tileAt(required(state.battle, 'battle').grid, TARGET)?.surface).toEqual({
        id: 'fire',
        duration: combo.duration - 1,
        spread: combo.spread - 1,
      });
      allEvents.push(...spreadEvents);
    }
    return { state, events: allEvents };
  } finally {
    observer.mockRestore();
  }
}

describe('shipped combinations reached by legal real-kit abilities', () => {
  it('assigns a real producer/applicator pair to every registered combo', () => {
    expect(COMBOS).toHaveLength(20);
    expect(new Set(COMBOS.map((combo) => combo.id))).toEqual(new Set(Object.keys(PAIRS)));
    expect(CONTENT.combos).toEqual(COMBOS);
  });

  it.each(COMBOS)('$id fires with its declared effects and repeats from the same seed', (combo) => {
    expect(witness(combo)).toEqual(witness(combo));
  });
});
