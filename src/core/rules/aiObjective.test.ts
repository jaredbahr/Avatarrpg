/**
 * The AI and objectives (ADR 0116's 2026-11-15 amendment): a unit on the
 * party's side walks onto an objective cell it can reach, and stays on it; an
 * enemy steps onto it to block, or closes on it. Placeholder objective on a
 * test copy of the Forest Road.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { BattleState, ContentIndex, EncounterDef, Unit, Vec2 } from '../types';
import { OBJECTIVE_BLOCK, OBJECTIVE_HOLD, objectiveValue, planAiTurn } from './ai';
import { standsOnObjective } from './objectives';

const BASE = CONTENT.encounters.get('enc_forest_road');
if (!BASE) throw new Error('The Forest Road encounter is missing');

function setup(goal: Vec2 | null, guestPos: Vec2 = { x: 4, y: 7 }) {
  const encounter: EncounterDef = {
    ...BASE!,
    variants: [],
    reinforcements: [],
    guests: [{ characterId: 'sura', pos: guestPos, level: 3 }],
    ...(goal ? { objective: { kind: 'holdAtRoundEnd', cells: [goal], label: 'Placeholder' } } : {}),
  };
  const content: ContentIndex = {
    ...CONTENT,
    encounters: new Map(CONTENT.encounters).set(encounter.id, encounter),
  };
  const state = createGame(content, {
    seed: 'objective-ai',
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'riko', level: 2, autoChoose: true },
    ],
    startNode: '',
  });
  const battle = createBattle(content, state, encounter.id, new RngCursor(state.rng));
  return { content, battle, encounter };
}

function turn(content: ContentIndex, battle: BattleState, unitId: string): BattleState {
  const rng = new RngCursor(1);
  const draft = new BattleDraft(content, battle, rng);
  planAiTurn(draft, unitId, rng);
  return draft.toBattle();
}

const unitWith = (battle: BattleState, test: (u: Unit) => boolean) => {
  const unit = battle.units.find(test);
  if (!unit) throw new Error('fixture unit missing');
  return unit;
};

describe('objective AI: the party side', () => {
  it('an AI guest walks onto an objective cell in reach', () => {
    const goal = { x: 6, y: 8 };
    const { content, battle, encounter } = setup(goal);
    const guest = unitWith(battle, (u) => u.faction === 'ally');
    const after = turn(content, battle, guest.id);
    const moved = unitWith(after, (u) => u.id === guest.id);
    expect(standsOnObjective(encounter.objective, moved, moved.pos)).toBe(true);
  });

  it('without an objective the same guest goes elsewhere', () => {
    const { content, battle } = setup(null);
    const guest = unitWith(battle, (u) => u.faction === 'ally');
    const moved = unitWith(turn(content, battle, guest.id), (u) => u.id === guest.id);
    expect(moved.pos).not.toEqual({ x: 6, y: 8 });
  });

  it('a guest already on the cell stays on it', () => {
    const goal = { x: 6, y: 8 };
    const { content, battle, encounter } = setup(goal, goal);
    const guest = unitWith(battle, (u) => u.faction === 'ally');
    const moved = unitWith(turn(content, battle, guest.id), (u) => u.id === guest.id);
    expect(standsOnObjective(encounter.objective, moved, moved.pos)).toBe(true);
  });

  it('a guest out of reach closes on the cell', () => {
    const goal = { x: 15, y: 8 };
    const { content, battle } = setup(goal);
    const guest = unitWith(battle, (u) => u.faction === 'ally');
    const moved = unitWith(turn(content, battle, guest.id), (u) => u.id === guest.id);
    const gap = (p: Vec2) => Math.max(Math.abs(p.x - goal.x), Math.abs(p.y - goal.y));
    expect(gap(moved.pos)).toBeLessThan(gap(guest.pos));
  });
});

describe('objective AI: the enemy side', () => {
  it('an enemy steps onto a free objective cell beside it to block it', () => {
    const { content, battle, encounter } = setup({ x: 16, y: 6 });
    const thug = unitWith(battle, (u) => u.faction === 'enemy' && u.pos.x === 17 && u.pos.y === 5);
    const moved = unitWith(turn(content, battle, thug.id), (u) => u.id === thug.id);
    expect(standsOnObjective(encounter.objective, moved, moved.pos)).toBe(true);
  });

  it('values: holding beats a kill for the party side, blocking is worth about one', () => {
    const { content, battle } = setup({ x: 6, y: 8 });
    const draft = new BattleDraft(content, battle, new RngCursor(1));
    const guest = unitWith(battle, (u) => u.faction === 'ally');
    const thug = unitWith(battle, (u) => u.faction === 'enemy');
    expect(objectiveValue(draft, guest, { x: 6, y: 8 })).toBe(OBJECTIVE_HOLD);
    expect(objectiveValue(draft, thug, { x: 6, y: 8 })).toBe(OBJECTIVE_BLOCK);
    // Nearer is better for both sides; beside the cell costs an enemy nothing.
    expect(objectiveValue(draft, guest, { x: 4, y: 8 })).toBeGreaterThan(
      objectiveValue(draft, guest, { x: 2, y: 8 }),
    );
    expect(Math.abs(objectiveValue(draft, thug, { x: 7, y: 8 }))).toBe(0);
    expect(objectiveValue(draft, thug, { x: 10, y: 8 })).toBeLessThan(0);
  });

  it('every value is 0 without an objective', () => {
    const { content, battle } = setup(null);
    const draft = new BattleDraft(content, battle, new RngCursor(1));
    for (const unit of battle.units) expect(objectiveValue(draft, unit, { x: 6, y: 8 })).toBe(0);
  });

  it('the same turn twice is the same turn', () => {
    const { content, battle } = setup({ x: 6, y: 8 });
    const guest = unitWith(battle, (u) => u.faction === 'ally');
    const first = turn(content, battle, guest.id);
    const second = turn(content, battle, guest.id);
    expect(second).toEqual(first);
  });
});
