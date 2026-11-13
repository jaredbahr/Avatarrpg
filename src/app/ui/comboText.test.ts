/**
 * #622: a combo joins the save's discovered set the first time it fires, and
 * the preview only hints at it until then. The hint is read off the real
 * forecast, so it can only appear where the rules say a reaction will happen.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../../core/rng';
import { previewAbility } from '../../core/rules/abilities';
import { tileAt, withSurface } from '../../core/rules/grid';
import { comboHint } from './comboText';
import type { GameEvent, GameState, Unit, Vec2 } from '../../core/types';
import { createBattle, createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';

/** Kaya three tiles from a bandit standing in lamp oil, with her turn up. */
function oilShot(seed = 'combo-discovery'): { state: GameState; kaya: Unit; target: Vec2 } {
  const seeded = createGame(CONTENT, {
    seed,
    party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_forest_road', rng);
  const kaya = battle.units.find((unit) => unit.characterId === 'kaya');
  const enemy = battle.units.find((unit) => unit.faction === 'enemy');
  if (!kaya || !enemy) throw new Error('fixture needs Kaya and a bandit');

  // An open row three tiles long, so the jab has a clear line.
  let spot: { from: Vec2; to: Vec2 } | null = null;
  for (let y = 0; y < battle.grid.height && !spot; y++) {
    for (let x = 0; x + 3 < battle.grid.width && !spot; x++) {
      const row = [0, 1, 2, 3].map((dx) => tileAt(battle.grid, { x: x + dx, y }));
      if (row.every((tile) => tile && !tile.blocked && tile.elevation === row[0]?.elevation)) {
        spot = { from: { x, y }, to: { x: x + 3, y } };
      }
    }
  }
  if (!spot) throw new Error('no open row on the forest road');
  const { from, to } = spot;
  const grid = withSurface(battle.grid, to, { id: 'oil', duration: -1, spread: 0 });

  const placedKaya: Unit = { ...kaya, pos: from, ai: 'none' };
  const placedEnemy: Unit = { ...enemy, pos: to, size: 1 };
  const state: GameState = {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...battle,
      grid,
      props: [],
      units: [placedKaya, placedEnemy],
      order: [placedKaya.id, placedEnemy.id],
      turnIndex: 0,
    },
  };
  return { state, kaya: placedKaya, target: to };
}

function jab(state: GameState, kaya: Unit, target: Vec2) {
  return apply(CONTENT, state, {
    type: 'useAbility',
    unitId: kaya.id,
    abilityId: 'fire_jab',
    target,
  });
}

describe('combo discovery (#622)', () => {
  it('starts a new game having found nothing', () => {
    expect(oilShot().state.discoveredCombos).toEqual([]);
  });

  it('hints at an undiscovered combo from the real forecast, and names it once found', () => {
    const { state, kaya, target } = oilShot();
    const battle = state.battle;
    const ability = CONTENT.abilities.get('fire_jab');
    if (!battle || !ability) throw new Error('fixture incomplete');
    const preview = previewAbility(CONTENT, battle, kaya, ability, target);
    const entry = preview.reactions.find((candidate) => candidate.kind === 'reaction');
    expect(entry?.comboId).toBe('fire-into-oil');
    if (!entry) return;

    expect(comboHint(CONTENT, entry, state.discoveredCombos)).toBe(
      'Something here reacts to fire.',
    );
    expect(comboHint(CONTENT, entry, ['fire-into-oil'])).toBeNull();
    expect(comboHint(CONTENT, entry, 'all')).toBeNull();

    // Bare ground has no rule to hint at, so no hint appears.
    const bare = { ...battle, grid: withSurface(battle.grid, target, null) };
    const plain = previewAbility(CONTENT, bare, kaya, ability, target);
    expect(plain.reactions.every((e) => comboHint(CONTENT, e, []) === null)).toBe(true);
  });

  it('records a combo the first time it fires, once, and says so', () => {
    const { state, kaya, target } = oilShot();
    const first = jab(state, kaya, target);
    expect(first.state.discoveredCombos).toEqual(['fire-into-oil']);
    const found = first.events.filter(
      (event): event is Extract<GameEvent, { type: 'comboDiscovered' }> =>
        event.type === 'comboDiscovered',
    );
    expect(found).toEqual([{ type: 'comboDiscovered', comboId: 'fire-into-oil' }]);
    // The original state is untouched.
    expect(state.discoveredCombos).toEqual([]);

    // Already found: the same shot again reports nothing new.
    const again = jab({ ...state, discoveredCombos: ['fire-into-oil'] }, kaya, target);
    expect(again.events.some((event) => event.type === 'comboDiscovered')).toBe(false);
    expect(again.state.discoveredCombos).toEqual(['fire-into-oil']);
  });

  it('does not count a plain paint or a bare-ground hit as a discovery', () => {
    const { state, kaya, target } = oilShot();
    const battle = state.battle;
    if (!battle) throw new Error('fixture incomplete');
    const bare = { ...state, battle: { ...battle, grid: withSurface(battle.grid, target, null) } };
    const result = jab(bare, kaya, target);
    expect(result.state.discoveredCombos).toEqual([]);
  });

  it('is deterministic: the same shot gives the same events and state', () => {
    const { state, kaya, target } = oilShot('combo-determinism');
    const a = jab(state, kaya, target);
    const b = jab(state, kaya, target);
    expect(b.events).toEqual(a.events);
    expect(b.state).toEqual(a.state);
  });
});
