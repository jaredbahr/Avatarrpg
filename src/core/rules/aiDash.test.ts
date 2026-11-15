import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { partyOfSize } from '../sim/balance';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import type { Ability, ContentIndex, GameState, Unit } from '../types';
import { canUseAbility, isValidTarget } from './abilities';
import { planAiTurn, previewAiPlan, scoreAbility, weightsFor } from './ai';
import { DEFAULT_TILE, distance, reachable, samePos } from './grid';

function battleOf(state: GameState) {
  if (!state.battle) throw new Error('Missing dash test battle');
  return state.battle;
}

function unitOf(state: GameState, id: string): Unit {
  const unit = battleOf(state).units.find((candidate) => candidate.id === id);
  if (!unit) throw new Error(`Missing dash test unit ${id}`);
  return unit;
}

function rush(): Ability {
  const ability = CONTENT.abilities.get('bandit_rush');
  if (!ability) throw new Error('Missing authored Rush');
  return ability;
}

/** The retained #520 trial71: no edited stats, positions or activation markers. */
function forestWitness(): GameState {
  const encounter = CONTENT.encounters.get('enc_forest_road');
  if (!encounter) throw new Error('Missing Forest Road encounter');
  const seeded = createGame(CONTENT, {
    seed: 899863172,
    startNode: '',
    party: partyOfSize(1).map((slot) => ({
      ...slot,
      level: encounter.expectedLevel,
      autoChoose: true,
    })),
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, encounter.id, rng);
  return { ...seeded, screen: 'combat', battle, rng: rng.state };
}

function active(state: GameState): Unit {
  const battle = battleOf(state);
  const id = battle.order[battle.turnIndex];
  if (!id) throw new Error('Missing active dash test actor');
  return unitOf(state, id);
}

function draftOf(state: GameState, content = CONTENT): BattleDraft {
  return new BattleDraft(content, battleOf(state), new RngCursor(state.rng));
}

/**
 * Labelled mechanics fixture: keep real unit stats and Rush data, but isolate
 * one enemy and one opponent on empty ground, with only Rush and no ordinary
 * movement. This proves legal moving Rush can still be planned and executed;
 * it makes no claim about an earned campaign or the authored witness above.
 */
function isolated(ability = rush()): { content: ContentIndex; state: GameState; actor: Unit } {
  const original = forestWitness();
  const enemy = active(original);
  const party = battleOf(original).units.find((unit) => unit.faction === 'party');
  if (!party) throw new Error('Missing isolated dash opponent');
  const actor: Unit = {
    ...enemy,
    pos: { x: 2, y: 2 },
    abilities: [ability.id],
    move: 0,
  };
  const opponent: Unit = { ...party, pos: { x: 6, y: 2 } };
  const content: ContentIndex = {
    ...CONTENT,
    abilities: new Map(CONTENT.abilities).set(ability.id, ability),
  };
  return {
    content,
    actor,
    state: {
      ...original,
      battle: {
        ...battleOf(original),
        grid: { width: 9, height: 5, tiles: Array.from({ length: 45 }, () => DEFAULT_TILE) },
        units: [actor, opponent],
        order: [actor.id, opponent.id],
        turnIndex: 0,
        props: [],
        temporaryWalls: [],
      },
    },
  };
}

describe('AI pure dash decisions', () => {
  it('rejects own-position pure Rush, including a hypothetical move-first caster pose', () => {
    const state = forestWitness();
    const actor = active(state);
    const draft = draftOf(state);
    const before = JSON.stringify(state);
    expect(isValidTarget(CONTENT, battleOf(state), actor, rush(), actor.pos).ok).toBe(true);
    expect(scoreAbility(draft, actor, rush(), actor.pos, weightsFor(actor.ai), new Map())).toBe(
      -Infinity,
    );
    const alternative = [
      ...reachable(draft.moveContext(actor), actor.pos, actor.move).values(),
    ].find((cell) => cell.path.length > 0)?.pos;
    if (!alternative) throw new Error('No real reachable hypothetical caster pose');
    const hypothetical = { ...actor, pos: alternative };
    expect(
      scoreAbility(draft, hypothetical, rush(), alternative, weightsFor(actor.ai), new Map()),
    ).toBe(-Infinity);
    expect(
      scoreAbility(draft, hypothetical, rush(), actor.pos, weightsFor(actor.ai), new Map()),
    ).toBe(-Infinity);
    expect(JSON.stringify(state)).toBe(before);
    expect(draft.events).toEqual([]);
  });

  it('executes the authored Forest first activation without a zero-distance Rush', () => {
    const state = forestWitness();
    const actor = active(state);
    expect(battleOf(state).round).toBe(1);
    expect(actor.id).toBe('e5');
    expect(actor.faction).toBe('enemy');
    expect(actor.pos).toEqual({ x: 17, y: 5 });
    expect(actor.ap).toBe(4);
    expect(actor.abilities).toContain('bandit_rush');
    const before = JSON.stringify(state);
    const step = apply(CONTENT, state, { type: 'runAiTurn' });
    let position = actor.pos;
    for (const event of step.events) {
      if (
        event.type === 'abilityUsed' &&
        event.unitId === actor.id &&
        event.abilityId === 'bandit_rush'
      ) {
        expect(
          samePos(event.target, position),
          'Pure Rush must buy a real change of position',
        ).toBe(false);
      }
      if (event.type === 'unitMoved' && event.unitId === actor.id) {
        const destination = event.path.at(-1);
        expect(destination).toBeDefined();
        if (!destination) throw new Error('Empty authored AI movement');
        expect(samePos(destination, position)).toBe(false);
        expect(event.cost).toBeGreaterThan(0);
        position = destination;
      }
    }
    expect(
      step.events.some(
        (event) => event.type === 'unitMoved' && event.unitId === actor.id && event.cost > 0,
      ),
    ).toBe(true);
    expect(unitOf(step.state, actor.id).pos).not.toEqual(actor.pos);
    expect(step.events).toContainEqual({ type: 'turnEnded', unitId: actor.id });
    expect(battleOf(step.state).order[battleOf(step.state).turnIndex]).not.toBe(actor.id);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps a real moving Rush planned and equal to its public command, including cost and cooldown', () => {
    const { content, state, actor } = isolated();
    const draft = draftOf(state, content);
    const before = JSON.stringify(state);
    const plan = previewAiPlan(draft, actor.id);
    expect(plan?.ability.id).toBe('bandit_rush');
    if (!plan) throw new Error('No legal moving Rush plan');
    expect(samePos(plan.target, actor.pos)).toBe(false);
    expect(plan.score).toBeGreaterThan(0);
    expect(isValidTarget(content, battleOf(state), actor, rush(), plan.target).ok).toBe(true);
    const direct = apply(content, state, {
      type: 'useAbility',
      unitId: actor.id,
      abilityId: rush().id,
      target: plan.target,
    });
    expect(direct.state).not.toBe(state);
    const moved = unitOf(direct.state, actor.id);
    expect(moved.pos).toEqual(plan.target);
    expect(moved.ap).toBe(actor.ap - rush().apCost);
    expect(moved.cooldowns[rush().id]).toBe(rush().cooldown);
    expect(moved.move).toBe(actor.move);
    expect(direct.events).toContainEqual({
      type: 'unitMoved',
      unitId: actor.id,
      path: [plan.target],
      cost: distance(actor.pos, plan.target),
    });
    expect(canUseAbility(content, moved, rush()).ok).toBe(false);
    const repeated = apply(content, direct.state, {
      type: 'useAbility',
      unitId: actor.id,
      abilityId: rush().id,
      target: actor.pos,
    });
    expect(repeated.state).toBe(direct.state);
    planAiTurn(draft, actor.id, draft.rng);
    expect(draft.events).toEqual(direct.events);
    expect(draft.toBattle()).toEqual(direct.state.battle);
    expect(draft.rng.state).toBe(direct.state.rng);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('preserves occupied and blocked landing rejection without spending resources', () => {
    const { content, state, actor } = isolated();
    const battle = battleOf(state);
    const blocked = { x: 3, y: 2 };
    const withBlock: GameState = {
      ...state,
      battle: {
        ...battle,
        grid: {
          ...battle.grid,
          tiles: battle.grid.tiles.map((tile, index) =>
            index === blocked.y * battle.grid.width + blocked.x ? { ...tile, blocked: true } : tile,
          ),
        },
      },
    };
    for (const target of [{ x: 6, y: 2 }, blocked]) {
      expect(distance(actor.pos, target)).toBeLessThanOrEqual(rush().range);
      expect(isValidTarget(content, battleOf(withBlock), actor, rush(), target)).toEqual({
        ok: false,
        reason: 'Cannot land there.',
      });
      const before = JSON.stringify(withBlock);
      const step = apply(content, withBlock, {
        type: 'useAbility',
        unitId: actor.id,
        abilityId: rush().id,
        target,
      });
      expect(step.state).toBe(withBlock);
      expect(
        step.events.some((event) => event.type === 'abilityUsed' || event.type === 'unitMoved'),
      ).toBe(false);
      expect(JSON.stringify(withBlock)).toBe(before);
    }
  });

  it('keeps an own-position dash with a meaningful self buff eligible and executable', () => {
    // A synthetic compound ability isolates this exception; no shipped kit or
    // effect changes. Range zero makes its intentional own-pose aim unambiguous.
    const compound: Ability = {
      ...rush(),
      id: 'test.dash_guard',
      range: 0,
      effects: [
        { kind: 'dash' },
        { kind: 'status', status: 'guarded', duration: 2, chance: 1, to: 'self' },
      ],
    };
    const { content, state, actor } = isolated(compound);
    const draft = draftOf(state, content);
    const before = JSON.stringify(state);
    expect(
      scoreAbility(draft, actor, compound, actor.pos, weightsFor(actor.ai), new Map()),
    ).toBeGreaterThan(0);
    const plan = previewAiPlan(draft, actor.id);
    expect(plan?.ability.id).toBe(compound.id);
    expect(plan?.target).toEqual(actor.pos);
    const direct = apply(content, state, {
      type: 'useAbility',
      unitId: actor.id,
      abilityId: compound.id,
      target: actor.pos,
    });
    expect(direct.events).toContainEqual({
      type: 'statusApplied',
      unitId: actor.id,
      status: 'guarded',
      duration: 2,
    });
    const guarded = unitOf(direct.state, actor.id);
    expect(guarded.pos).toEqual(actor.pos);
    expect(guarded.ap).toBe(actor.ap - compound.apCost);
    expect(guarded.cooldowns[compound.id]).toBe(compound.cooldown);
    expect(guarded.statuses).toContainEqual({ id: 'guarded', duration: 2, stacks: 1 });
    planAiTurn(draft, actor.id, draft.rng);
    expect(draft.events).toEqual(direct.events);
    expect(draft.toBattle()).toEqual(direct.state.battle);
    expect(JSON.stringify(state)).toBe(before);
  });
});
