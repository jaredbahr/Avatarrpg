import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import type { Ability, GameState, Unit, Vec2 } from '../types';
import { planAiTurn, previewAiPlan, scoreAbility, weightsFor } from './ai';
import { isValidTarget, previewAbility } from './abilities';
import { DEFAULT_TILE } from './grid';

const STANDING: Vec2 = { x: 8, y: 6 };

function ability(id: string): Ability {
  const found = CONTENT.abilities.get(id);
  if (!found) throw new Error(`Missing support ability ${id}`);
  return found;
}

function unit(state: GameState, id: string): Unit {
  const found = state.battle?.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing support fixture unit ${id}`);
  return found;
}

/**
 * Real encounter creation supplies the authored units, including the fourth
 * ambush reinforcement: six heroes plus Ruon bring in the Mercenary Sergeant.
 * The clear board, distant opponent, zero movement and optional restricted kit
 * isolate support decisions; they do not claim campaign balance coverage.
 */
function fixture(
  who: 'nilak' | 'bo' | 'merc_sergeant',
  kit?: readonly string[],
): { state: GameState; caster: Unit; friend: Unit } {
  const seeded = createGame(CONTENT, {
    seed: 'ai-self-support-558',
    startNode: '',
    party: ['kaya', 'nilak', 'bo', 'riko', 'nima', 'sura'].map((characterId) => ({
      characterId,
      level: 3,
      autoChoose: true,
    })),
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_ambush', rng);
  const nilak = battle.units.find((candidate) => candidate.characterId === 'nilak');
  const bo = battle.units.find((candidate) => candidate.characterId === 'bo');
  const kaya = battle.units.find((candidate) => candidate.characterId === 'kaya');
  const sergeant = battle.units.find((candidate) => candidate.enemyId === 'merc_sergeant');
  if (!nilak || !bo || !kaya || !sergeant) throw new Error('Missing authored support units');
  const original = who === 'merc_sergeant' ? sergeant : who === 'nilak' ? nilak : bo;
  const caster: Unit = {
    ...original,
    pos: STANDING,
    ai: original.faction === 'enemy' ? original.ai : 'support',
    abilities: kit ?? original.abilities,
    hp: original.base.maxHp,
    ap: original.base.maxAp,
    move: 0,
    cooldowns: {},
    statuses: [],
  };
  const opponent: Unit = {
    ...(caster.faction === 'enemy' ? kaya : sergeant),
    pos: { x: 0, y: 0 },
  };
  const units = [caster, opponent];
  return {
    caster,
    friend: kaya,
    state: {
      ...seeded,
      screen: 'combat',
      rng: rng.state,
      battle: {
        ...battle,
        grid: {
          width: 16,
          height: 12,
          tiles: Array.from({ length: 16 * 12 }, () => DEFAULT_TILE),
        },
        units,
        order: units.map((candidate) => candidate.id),
        turnIndex: 0,
        props: [],
        temporaryWalls: [],
      },
    },
  };
}

function replace(state: GameState, replacement: Unit): GameState {
  if (!state.battle) throw new Error('Missing support battle');
  return {
    ...state,
    battle: {
      ...state.battle,
      units: state.battle.units.map((candidate) =>
        candidate.id === replacement.id ? replacement : candidate,
      ),
    },
  };
}

function draftFor(state: GameState, squareFootprints = true): BattleDraft {
  if (!state.battle) throw new Error('Missing support battle');
  return new BattleDraft(CONTENT, state.battle, new RngCursor(state.rng), {
    squareFootprints,
  });
}

function score(draft: BattleDraft, caster: Unit, id: string, target = caster.pos): number {
  return scoreAbility(draft, caster, ability(id), target, weightsFor(caster.ai), new Map());
}

/** The planned activation must reproduce the real legal command, not just its score. */
function expectPlannedCast(state: GameState, caster: Unit, id: string, target: Vec2) {
  if (!state.battle) throw new Error('Missing support battle');
  const draft = draftFor(state);
  const plan = previewAiPlan(draft, caster.id);
  expect(plan?.ability.id).toBe(id);
  // Self shapes ignore their aim coordinate. Preserve the planner's existing
  // candidate order rather than requiring an unrelated aim canonicalization.
  const aim = ability(id).targeting.shape === 'self' ? (plan?.target ?? target) : target;
  if (ability(id).targeting.shape !== 'self') expect(plan?.target).toEqual(target);
  expect(isValidTarget(CONTENT, state.battle, caster, ability(id), aim).ok).toBe(true);
  const direct = apply(CONTENT, state, {
    type: 'useAbility',
    unitId: caster.id,
    abilityId: id,
    target: aim,
  });
  expect(direct.state).not.toBe(state);
  expect(direct.events).toContainEqual(
    expect.objectContaining({ type: 'abilityUsed', unitId: caster.id, abilityId: id, target: aim }),
  );
  const rng = new RngCursor(state.rng);
  planAiTurn(draft, caster.id, rng);
  expect(draft.events).toEqual(direct.events);
  expect(draft.toBattle()).toEqual(direct.state.battle);
  expect(rng.state).toBe(direct.state.rng);
  return direct;
}

describe('AI self-support recipient parity', () => {
  it('plans legal Healing Stream on a wounded caster and applies the real self-heal', () => {
    const initial = fixture('nilak', ['healing_stream']);
    const caster = { ...initial.caster, hp: initial.caster.base.maxHp - 8 };
    const state = replace(initial.state, caster);
    const preview = previewAbility(
      CONTENT,
      state.battle!,
      caster,
      ability('healing_stream'),
      caster.pos,
    );
    expect(preview.targets).toContainEqual(expect.objectContaining({ unitId: caster.id, heal: 8 }));
    expect(score(draftFor(state), caster, 'healing_stream')).toBeGreaterThan(0);
    const direct = expectPlannedCast(state, caster, 'healing_stream', caster.pos);
    expect(unit(direct.state, caster.id).hp).toBe(caster.base.maxHp);
    expect(direct.events).toContainEqual({ type: 'healed', unitId: caster.id, amount: 8 });
  });

  it('lets the authored Mercenary Sergeant use Rally on itself with its unchanged kit', () => {
    const { state, caster } = fixture('merc_sergeant');
    expect(caster.name).toBe('Mercenary Sergeant');
    expect(caster.ai).toBe('support');
    expect(caster.abilities).toEqual(CONTENT.enemies.get('merc_sergeant')?.abilities);
    expect(score(draftFor(state), caster, 'rally')).toBeGreaterThan(0);
    const direct = expectPlannedCast(state, caster, 'rally', caster.pos);
    const after = unit(direct.state, caster.id);
    expect(after.statuses).toContainEqual({ id: 'inspired', duration: 2, stacks: 1 });
    expect(after.ap).toBe(caster.ap - ability('rally').apCost + 1);
    expect(after.cooldowns.rally).toBe(ability('rally').cooldown);
  });

  it('counts an authored self-shape to:self buff once and actually casts it', () => {
    const { state, caster } = fixture('bo', ['stone_stance']);
    // Existing support weights value Guarded at 9 * 2, for this 1-AP cast.
    // Including the caster must not count to:self in both effect loops.
    expect(score(draftFor(state), caster, 'stone_stance')).toBe(18);
    const direct = expectPlannedCast(state, caster, 'stone_stance', caster.pos);
    expect(unit(direct.state, caster.id).statuses).toEqual([
      { id: 'guarded', duration: 2, stacks: 1 },
    ]);
    expect(direct.events.filter((event) => event.type === 'statusApplied')).toHaveLength(1);
  });

  it.each([true, false])(
    'scores the hypothetical size-2 caster at its new footprint without stale occupancy (square=%s)',
    (square) => {
      const initial = fixture('nilak', ['healing_stream']);
      const stored: Unit = { ...initial.caster, size: 2, hp: initial.caster.base.maxHp - 8 };
      const state = replace(initial.state, stored);
      const draft = draftFor(state, square);
      const hypothetical = { ...stored, pos: { x: 3, y: 3 } };
      const aim = { x: 4, y: square ? 4 : 3 };
      const prospective = replace(state, hypothetical);
      expect(
        isValidTarget(
          CONTENT,
          prospective.battle!,
          hypothetical,
          ability('healing_stream'),
          aim,
          square,
        ).ok,
      ).toBe(true);
      expect(score(draft, hypothetical, 'healing_stream', aim)).toBeGreaterThan(0);
      expect(score(draft, hypothetical, 'healing_stream', stored.pos)).toBeLessThanOrEqual(0);
      expect(draft.unit(stored.id)).toEqual(stored);
      expect(draft.events).toEqual([]);
    },
  );

  it('preserves healing an injured ally instead of the healthy caster', () => {
    const initial = fixture('nilak', ['healing_stream']);
    const friend = {
      ...initial.friend,
      pos: { x: STANDING.x - 1, y: STANDING.y },
      hp: initial.friend.base.maxHp - 8,
    };
    const battle = initial.state.battle!;
    const state = {
      ...initial.state,
      battle: { ...battle, units: [...battle.units, friend], order: [...battle.order, friend.id] },
    };
    expect(score(draftFor(state), initial.caster, 'healing_stream', friend.pos)).toBeGreaterThan(0);
    const direct = expectPlannedCast(state, initial.caster, 'healing_stream', friend.pos);
    expect(unit(direct.state, friend.id).hp).toBe(friend.base.maxHp);
    expect(unit(direct.state, initial.caster.id).hp).toBe(initial.caster.hp);
  });

  it('keeps the caster out of area attack scoring, preview and actual effects', () => {
    const initial = fixture('bo', ['fire_blast']);
    const battle = initial.state.battle!;
    const opponent = battle.units.find((candidate) => candidate.id !== initial.caster.id);
    if (!opponent) throw new Error('Missing area opponent');
    const state = replace(initial.state, {
      ...opponent,
      pos: { x: STANDING.x + 1, y: STANDING.y },
    });
    const draft = draftFor(state);
    const withoutCaster = draftFor({
      ...state,
      battle: {
        ...state.battle!,
        units: state.battle!.units.filter((candidate) => candidate.id !== initial.caster.id),
      },
    });
    expect(score(draft, initial.caster, 'fire_blast')).toBeGreaterThan(0);
    expect(score(draft, initial.caster, 'fire_blast')).toBe(
      score(withoutCaster, initial.caster, 'fire_blast'),
    );
    const preview = previewAbility(
      CONTENT,
      state.battle!,
      initial.caster,
      ability('fire_blast'),
      initial.caster.pos,
    );
    expect(preview.targets.map((target) => target.unitId)).not.toContain(initial.caster.id);
    const direct = apply(CONTENT, state, {
      type: 'useAbility',
      unitId: initial.caster.id,
      abilityId: 'fire_blast',
      target: initial.caster.pos,
    });
    expect(direct.events).toContainEqual(
      expect.objectContaining({ type: 'abilityUsed', abilityId: 'fire_blast' }),
    );
    expect(unit(direct.state, initial.caster.id).hp).toBe(initial.caster.hp);
    expect(unit(direct.state, initial.caster.id).statuses).toEqual(initial.caster.statuses);
  });

  it('still rejects empty area attacks even when they carry a caster-side buff', () => {
    const { state, caster } = fixture('nilak', ['octopus_form']);
    const draft = draftFor(state);
    expect(score(draft, caster, 'octopus_form')).toBe(-Infinity);
    expect(previewAiPlan(draft, caster.id)).toBeNull();
    planAiTurn(draft, caster.id, new RngCursor(state.rng));
    expect(draft.events).toEqual([]);
    expect(draft.unit(caster.id)?.statuses).toEqual([]);
  });

  it('does not spend AP on a full-HP heal-only cast', () => {
    const { state, caster } = fixture('nilak', ['healing_stream']);
    const draft = draftFor(state);
    expect(score(draft, caster, 'healing_stream')).toBeLessThanOrEqual(0);
    expect(previewAiPlan(draft, caster.id)).toBeNull();
    planAiTurn(draft, caster.id, new RngCursor(state.rng));
    expect(draft.events).toEqual([]);
    expect(draft.unit(caster.id)?.ap).toBe(caster.ap);
    expect(draft.unit(caster.id)?.hp).toBe(caster.hp);
  });

  it('keeps support scoring and plan preview read-only, including the live RNG', () => {
    const { state, caster } = fixture('merc_sergeant');
    const draft = draftFor(state);
    const before = structuredClone(draft.toBattle());
    const original = structuredClone(state);
    const rng = draft.rng.state;
    const first = score(draft, caster, 'rally');
    const plan = previewAiPlan(draft, caster.id);
    expect(score(draft, caster, 'rally')).toBe(first);
    expect(previewAiPlan(draft, caster.id)).toEqual(plan);
    expect(draft.toBattle()).toEqual(before);
    expect(state).toEqual(original);
    expect(draft.rng.state).toBe(rng);
    expect(draft.events).toEqual([]);
  });
});
