import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import type { GameEvent, GameState, Grid, Tile, Unit, UnitSize, Vec2 } from '../types';
import { planAiTurn } from './ai';
import { DEFAULT_TILE, pathCost } from './grid';

type Moved = Extract<GameEvent, { type: 'unitMoved' }>;

function battleOf(state: GameState) {
  if (!state.battle) throw new Error('Missing AI walk battle');
  return state.battle;
}

function actorOf(state: GameState, id: string): Unit {
  const actor = battleOf(state).units.find((unit) => unit.id === id);
  if (!actor) throw new Error('Missing AI walker');
  return actor;
}

function movement(events: readonly GameEvent[], id: string): Moved {
  const moves = events.filter(
    (event): event is Moved => event.type === 'unitMoved' && event.unitId === id,
  );
  expect(moves).toHaveLength(1);
  const first = moves[0];
  if (!first) throw new Error('AI did not walk');
  return first;
}

/**
 * Authored units on a labelled movement fixture: no abilities or AP, so the
 * public planner takes its existing reposition branch. A narrow corridor or
 * flat two-row field makes its closest reachable destination unambiguous.
 */
function fixture(
  grid: Grid,
  options: { size?: UnitSize; move?: number; hp?: number; opponentX?: number } = {},
): { state: GameState; actor: Unit } {
  const seeded = createGame(CONTENT, {
    seed: 'ai-walk-cost-569',
    startNode: '',
    party: [{ characterId: 'bo', level: 3, autoChoose: true }],
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_forest_road', rng, { variantId: 'thugs' });
  const enemy = battle.units.find((unit) => unit.faction === 'enemy');
  const party = battle.units.find((unit) => unit.faction === 'party');
  if (!enemy || !party) throw new Error('Missing authored walk fixture units');
  const actor: Unit = {
    ...enemy,
    pos: { x: 0, y: 0 },
    size: options.size ?? 1,
    ai: 'aggressive',
    abilities: [],
    ap: 0,
    move: options.move ?? 4,
    hp: options.hp ?? enemy.base.maxHp,
    cooldowns: {},
    statuses: [],
  };
  const opponent: Unit = { ...party, pos: { x: options.opponentX ?? 6, y: 0 } };
  return {
    actor,
    state: {
      ...seeded,
      screen: 'combat',
      rng: rng.state,
      battle: {
        ...battle,
        grid,
        units: [actor, opponent],
        order: [actor.id, opponent.id],
        turnIndex: 0,
        props: [],
        temporaryWalls: [],
      },
    },
  };
}

function planned(state: GameState, id: string, squareFootprints = true) {
  const draft = new BattleDraft(CONTENT, battleOf(state), new RngCursor(state.rng), {
    squareFootprints,
  });
  // Use the already-public planner to inspect the debit before runAiTurn's
  // endTurn zeroes movement; do not expose or replace the private walker.
  planAiTurn(draft, id, draft.rng);
  return { draft, move: movement(draft.events, id) };
}

function publicMove(state: GameState, actor: Unit, path: readonly Vec2[]) {
  const before = structuredClone(state);
  const result = apply(CONTENT, state, { type: 'move', unitId: actor.id, path });
  expect(result.state).not.toBe(state);
  expect(state).toEqual(before);
  return {
    result,
    actor: actorOf(result.state, actor.id),
    move: movement(result.events, actor.id),
  };
}

describe('AI walking uses public movement costs and event paths', () => {
  it('pays the full uphill path cost instead of leaving an extra movement point', () => {
    const grid: Grid = {
      width: 7,
      height: 1,
      tiles: Array.from({ length: 7 }, (_, x) => ({ ...DEFAULT_TILE, elevation: x > 0 ? 1 : 0 })),
    };
    const { state, actor } = fixture(grid);
    const path = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    const context = new BattleDraft(CONTENT, battleOf(state), new RngCursor(state.rng)).moveContext(
      actor,
    );
    expect(CONTENT.tuning.climbCost).toBe(1);
    expect(pathCost(context, actor.pos, path)).toBe(4);
    const oracle = publicMove(state, actor, path);
    expect(oracle.move).toEqual({ type: 'unitMoved', unitId: actor.id, path, cost: 4 });
    expect(oracle.actor.move).toBe(0);

    const actual = planned(state, actor.id);
    expect(actual.move).toEqual(oracle.move);
    expect(actual.draft.unit(actor.id)).toEqual(oracle.actor);
    const activation = apply(CONTENT, state, { type: 'runAiTurn' });
    expect(movement(activation.events, actor.id)).toEqual(oracle.move);
    expect(actorOf(activation.state, actor.id).pos).toEqual(oracle.actor.pos);
  });

  it.each([true, false])(
    'pays the worst surface under the whole size-2 footprint once per step (square=%s)',
    (square) => {
      const grid: Grid = {
        width: 10,
        height: 2,
        tiles: Array.from({ length: 20 }, (_, index): Tile => ({
          ...DEFAULT_TILE,
          surface: index % 10 === 2 ? { id: 'oil', duration: -1, spread: 0 } : null,
        })),
      };
      const { state, actor } = fixture(grid, { size: 2, opponentX: 8 });
      const path = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ];
      const context = new BattleDraft(CONTENT, battleOf(state), new RngCursor(state.rng), {
        squareFootprints: square,
      }).moveContext(actor);
      expect(pathCost(context, actor.pos, path)).toBe(4);
      // The oil column occupies both rows, so the square public reducer and
      // explicit legacy geometry have the same oracle on this fixture. The
      // second footprint row must neither make footing free nor charge twice.
      const oracle = publicMove(state, actor, path);
      expect(oracle.move.cost).toBe(4);
      expect(oracle.actor.move).toBe(0);
      const actual = planned(state, actor.id, square);
      expect(actual.move).toEqual(oracle.move);
      expect(actual.draft.unit(actor.id)).toEqual(oracle.actor);
    },
  );

  it('reports the actually walked prefix but debits the public upfront path cost after a lethal surface', () => {
    const grid: Grid = {
      width: 7,
      height: 1,
      tiles: Array.from({ length: 7 }, (_, x): Tile => ({
        ...DEFAULT_TILE,
        surface: x === 1 ? { id: 'fire', duration: -1, spread: 0 } : null,
      })),
    };
    const { state, actor } = fixture(grid, { move: 3, hp: 1 });
    const path = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    const context = new BattleDraft(CONTENT, battleOf(state), new RngCursor(state.rng)).moveContext(
      actor,
    );
    expect(pathCost(context, actor.pos, path)).toBe(3);
    const oracle = publicMove(state, actor, path);
    expect(oracle.move).toEqual({ type: 'unitMoved', unitId: actor.id, path: [path[0]], cost: 3 });
    expect(oracle.actor).toMatchObject({ pos: { x: 1, y: 0 }, hp: 0, move: 0 });
    expect(oracle.result.events).toContainEqual({ type: 'unitDied', unitId: actor.id });

    const actual = planned(state, actor.id);
    expect(actual.move).toEqual(oracle.move);
    expect(actual.draft.unit(actor.id)).toEqual(oracle.actor);
    // The planner itself does not settle the outcome. All damage/death/move
    // events must still match the public move before that separate final tail.
    expect(actual.draft.events).toEqual(
      oracle.result.events.filter((event) => event.type !== 'battleEnded'),
    );
    const activation = apply(CONTENT, state, { type: 'runAiTurn' });
    expect(movement(activation.events, actor.id)).toEqual(oracle.move);
    expect(actorOf(activation.state, actor.id).hp).toBe(0);
  });
});
